//! Transposition table for the persona search.
//!
//! The same position is reached by many move orders (Nf3 then e4, or e4
//! then Nf3) and again at every iteration of iterative deepening. The table
//! remembers, per position, the score found at some depth, whether that
//! score is exact or only a bound, and the best move. A later visit can
//! then either return immediately or at least search that move first.
//!
//! Positions are identified by a 64-bit Zobrist hash: one random number per
//! (piece, square), XOR-ed together, plus the side to move and the persona
//! (personas evaluate differently, so their scores must not mix).

use crate::board::{Board, BOARD_SIZE};
use crate::eval::hce::Persona;
use crate::moves::{Move, Square};
use crate::piece::{Color, PieceKind};

const SQUARES: usize = BOARD_SIZE * BOARD_SIZE;
/// 2^18 entries × 24 bytes ≈ 6 MB: small enough for a phone's WebView.
const TT_BITS: u32 = 18;

struct Zobrist {
    pieces: Vec<u64>, // [color][kind][square]
    black_to_move: u64,
    persona: [u64; 3],
}

fn splitmix(state: &mut u64) -> u64 {
    *state = state.wrapping_add(0x9E37_79B9_7F4A_7C15);
    let mut z = *state;
    z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    z ^ (z >> 31)
}

fn kind_index(k: PieceKind) -> usize {
    match k {
        PieceKind::Pawn => 0,
        PieceKind::Rook => 1,
        PieceKind::Knight => 2,
        PieceKind::Bishop => 3,
        PieceKind::Queen => 4,
        PieceKind::King => 5,
        PieceKind::Krishna => 6,
    }
}

thread_local! {
    static ZOBRIST: Zobrist = {
        let mut s = 0x5348_4154_5255_4e5au64; // fixed seed: hashes are reproducible
        Zobrist {
            pieces: (0..2 * 7 * SQUARES).map(|_| splitmix(&mut s)).collect(),
            black_to_move: splitmix(&mut s),
            persona: [splitmix(&mut s), splitmix(&mut s), splitmix(&mut s)],
        }
    };
    static TABLE: std::cell::RefCell<Vec<Entry>> =
        std::cell::RefCell::new(vec![Entry::EMPTY; 1 << TT_BITS]);
}

/// Hash of the board, side to move and persona.
pub fn hash(board: &Board, color: Color, persona: Persona) -> u64 {
    ZOBRIST.with(|z| {
        let mut h = if color == Color::Black { z.black_to_move } else { 0 };
        h ^= z.persona[persona as usize];
        for r in 0..BOARD_SIZE {
            for c in 0..BOARD_SIZE {
                if let Some(p) = board.get(r, c) {
                    let ci = if p.color == Color::White { 0 } else { 1 };
                    h ^= z.pieces[(ci * 7 + kind_index(p.kind)) * SQUARES + r * BOARD_SIZE + c];
                }
            }
        }
        h
    })
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Bound {
    /// The true score at `depth`.
    Exact,
    /// The search failed high: true score >= `score`.
    Lower,
    /// The search failed low: true score <= `score`.
    Upper,
}

#[derive(Debug, Clone, Copy)]
pub struct Entry {
    pub key: u64,
    pub score: f64,
    pub depth: i16,
    pub bound: Bound,
    /// Best (or cutoff) move as (from square, to square); `u8::MAX` = none.
    from: u8,
    to: u8,
}

impl Entry {
    const EMPTY: Entry = Entry { key: 0, score: 0.0, depth: -1, bound: Bound::Upper, from: u8::MAX, to: u8::MAX };

    /// Whether `m` is the move stored in this entry.
    pub fn is_move(&self, m: Move) -> bool {
        self.from != u8::MAX && sq(m.from) == self.from && (m.to.r * BOARD_SIZE + m.to.c) as u8 == self.to
    }
}

fn sq(s: Square) -> u8 {
    (s.r * BOARD_SIZE + s.c) as u8
}

fn slot(key: u64) -> usize {
    (key >> (64 - TT_BITS)) as usize
}

pub fn probe(key: u64) -> Option<Entry> {
    TABLE.with(|t| {
        let e = t.borrow()[slot(key)];
        (e.key == key && e.depth >= 0).then_some(e)
    })
}

/// Always-replace: the newest result is the most relevant to the next move.
pub fn store(key: u64, depth: i32, score: f64, bound: Bound, best: Option<Move>) {
    let (from, to) = best.map_or((u8::MAX, u8::MAX), |m| (sq(m.from), (m.to.r * BOARD_SIZE + m.to.c) as u8));
    TABLE.with(|t| {
        t.borrow_mut()[slot(key)] = Entry { key, score, depth: depth as i16, bound, from, to };
    });
}

/// Forget everything (used by tests that need a cold start).
pub fn clear() {
    TABLE.with(|t| t.borrow_mut().iter_mut().for_each(|e| *e = Entry::EMPTY));
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::game::Game;

    #[test]
    fn hash_depends_on_side_persona_and_pieces() {
        let mut g = Game::new();
        let h = hash(&g.board, Color::White, Persona::Material);
        assert_ne!(h, hash(&g.board, Color::Black, Persona::Material));
        assert_ne!(h, hash(&g.board, Color::White, Persona::Positional));
        let m = g.legal_moves(Color::White)[0];
        g.make_move(m.from, m.to);
        assert_ne!(h, hash(&g.board, Color::White, Persona::Material));
        g.undo_move();
        assert_eq!(h, hash(&g.board, Color::White, Persona::Material));
    }

    #[test]
    fn store_then_probe_round_trips() {
        clear();
        let g = Game::new();
        let m = g.legal_moves(Color::White)[3];
        let k = hash(&g.board, Color::White, Persona::Material);
        assert!(probe(k).is_none());
        store(k, 3, 42.0, Bound::Lower, Some(m));
        let e = probe(k).expect("stored");
        assert_eq!((e.depth, e.score, e.bound), (3, 42.0, Bound::Lower));
        assert!(e.is_move(m));
        assert!(probe(k ^ 1).is_none());
    }
}
