//! The persona search must recognise checkmate.
//!
//! Regression: `alphabeta` scored "no legal moves" with the static eval, so
//! a mated king looked no worse than any other position with the same
//! material. The AI then shuffled a queen around a lone king for 100+ moves
//! until the 240-ply material adjudication ended the game.

use shatrunz_core::board::Board;
use shatrunz_core::game::Game;
use shatrunz_core::piece::{Color, Piece, PieceKind};
use shatrunz_core::search::persona::{get_best_move, SearchConfig};
use shatrunz_core::eval::hce::Persona;

fn game_with(pieces: &[(usize, usize, Color, PieceKind)], turn: Color) -> Game {
    let mut g = Game::new();
    g.board = Board::empty();
    for &(r, c, color, kind) in pieces {
        g.board.set(r, c, Some(Piece { color, kind }));
    }
    g.turn = turn;
    g
}

fn plays_mate(mut g: Game, depth: u32) {
    let cfg = SearchConfig { persona: Persona::Material, add_randomness: false, deadline: None };
    let res = get_best_move(&mut g, Color::White, depth, &cfg, &|_| 0.0);
    let m = res.best_move.expect("a move");
    assert!(g.execute_move(m.from, m.to), "move must be legal");
    let st = g.check_status();
    assert_eq!(st.winner, Some(Color::White), "expected mate, got {:?} after {:?}", st.msg, m);
}

#[test]
fn finds_queen_mate_in_one() {
    use Color::*;
    use PieceKind::*;
    // Black K a9 (0,0); White K b7 (2,1); White Q f4 (5,5) -> Qb8#.
    let g = game_with(&[(0, 0, Black, King), (2, 1, White, King), (5, 5, White, Queen)], White);
    for depth in [2, 3] {
        plays_mate(g.clone(), depth);
    }
}

#[test]
fn finds_rook_mate_in_one() {
    use Color::*;
    use PieceKind::*;
    // Black K e9 (0,4); White K e7 (2,4); White R a1 (8,0) -> Ra9#.
    let g = game_with(&[(0, 4, Black, King), (2, 4, White, King), (8, 0, White, Rook)], White);
    for depth in [2, 3] {
        plays_mate(g.clone(), depth);
    }
}
