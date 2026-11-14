//! A budgeted search always returns a legal move, even when the deadline is
//! already gone before depth 1 finishes. Found by the match harness at a 2 ms
//! budget: the engine returned no move, which the caller reads as "stuck".

use shatrunz_core::eval::hce::Persona;
use shatrunz_core::game::Game;
use shatrunz_core::piece::Color;
use shatrunz_core::search::persona::{get_best_move, SearchMode, SearchConfig};
use web_time::Instant;

#[test]
fn expired_deadline_still_returns_a_legal_move() {
    let mut g = Game::new();
    let cfg = SearchConfig { persona: Persona::Material, mode: SearchMode::Full, add_randomness: false, deadline: Some(Instant::now()) };
    let res = get_best_move(&mut g, Color::White, 4, &cfg, &|_| 0.0);
    let m = res.best_move.expect("a move even with no time");
    assert!(g.legal_moves(Color::White).contains(&m));
    assert!(res.best_score.is_finite());
}
