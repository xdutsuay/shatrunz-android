//! K+Q vs K and K+R vs K must be converted to checkmate by self-play.
//!
//! Regression: with no endgame knowledge the stronger side wandered (no
//! square looks better than another to a material/PST eval) and games
//! reached the 240-ply material adjudication instead of mate.

use std::collections::HashMap;

use shatrunz_core::board::Board;
use shatrunz_core::eval::hce::Persona;
use shatrunz_core::game::Game;
use shatrunz_core::moves::Move;
use shatrunz_core::piece::{Color, Piece, PieceKind};
use shatrunz_core::search::persona::{get_best_move, SearchConfig, SearchMode};

fn game_with(pieces: &[(usize, usize, Color, PieceKind)]) -> Game {
    let mut g = Game::new();
    g.board = Board::empty();
    for &(r, c, color, kind) in pieces {
        g.board.set(r, c, Some(Piece { color, kind }));
    }
    g.turn = Color::White;
    g
}

/// Plays both sides at a fixed depth; returns the ply count at mate.
///
/// Root moves that repeat an earlier position get the same contempt
/// penalty the app adds in JS (frontend/shared/repetition.js, 60 cp per
/// occurrence for the side that is ahead), so this exercises the search
/// the way the app actually calls it.
fn self_play_until_mate(mut g: Game, depth: u32, max_plies: usize) -> usize {
    let cfg = SearchConfig {
        persona: Persona::Material,
        mode: SearchMode::Full,
        add_randomness: false,
        deadline: None,
    };
    let mut seen: HashMap<String, u32> = HashMap::new();
    seen.insert(g.position_key(), 1);
    for ply in 0..max_plies {
        let st = g.check_status();
        if st.over {
            assert_eq!(
                st.winner,
                Some(Color::White),
                "ended without White mating: {}",
                st.msg
            );
            return ply;
        }
        let side = g.turn;
        let probe = g.clone();
        let contempt = |m: Move| {
            if side != Color::White {
                return 0.0; // the lone king has nothing to play for but a draw
            }
            let mut after = probe.clone();
            after.execute_move(m.from, m.to);
            -60.0 * *seen.get(&after.position_key()).unwrap_or(&0) as f64
        };
        let m = get_best_move(&mut g, side, depth, &cfg, &contempt)
            .best_move
            .expect("move");
        assert!(g.execute_move(m.from, m.to));
        *seen.entry(g.position_key()).or_insert(0) += 1;
    }
    panic!("no mate within {max_plies} plies");
}

use Color::*;
use PieceKind::*;

#[test]
fn queen_mates_lone_king_from_the_centre() {
    // Black K e5 (4,4) in the middle; White K a1 (8,0), Q h9 (0,7); nobody starts in check.
    let g = game_with(&[
        (4, 4, Black, King),
        (8, 0, White, King),
        (0, 7, White, Queen),
    ]);
    let plies = self_play_until_mate(g, 3, 120);
    eprintln!("KQ vs K mated in {plies} plies");
}

#[test]
fn rook_mates_lone_king_from_the_centre() {
    let g = game_with(&[
        (4, 4, Black, King),
        (8, 0, White, King),
        (0, 7, White, Rook),
    ]);
    let plies = self_play_until_mate(g, 3, 200);
    eprintln!("KR vs K mated in {plies} plies");
}

#[test]
fn queen_mates_even_with_both_krishnas_on_the_board() {
    // Krishnas can't capture or be captured but do block squares and lines;
    // the real game always still has them.
    let g = game_with(&[
        (4, 4, Black, King),
        (0, 6, Black, Krishna),
        (8, 0, White, King),
        (8, 6, White, Krishna),
        (0, 7, White, Queen),
    ]);
    let plies = self_play_until_mate(g, 3, 160);
    eprintln!("KQZ vs KZ mated in {plies} plies");
}
