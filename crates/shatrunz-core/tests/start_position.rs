//! #30: custom start positions are validated, and replaying UCI moves from
//! a custom start lands on the same position as playing them live.
use shatrunz_core::game::Game;
use shatrunz_core::uci::parse_uci_move;

#[test]
fn standard_string_equals_the_default_setup() {
    let g = Game::from_start_fen(Game::STANDARD_START).unwrap();
    assert_eq!(g.position_key(), Game::new().position_key());
}

#[test]
fn rejects_broken_positions() {
    for (fen, why) in [
        ("9/9/9/9/4k4/9/9/9/9 w", "one king"),
        ("4k4/9/9/9/9/9/9/9/K3K4 w", "two white kings"),
        ("p3k4/9/9/9/9/9/9/9/4K4 w", "pawn on last rank"),
        // Black rook checks White's king but it's Black to move: the side
        // that just moved (White) would be in check.
        ("4k4/9/9/9/9/9/9/9/4K3r b", "side not to move in check"),
        ("4k4/9/9/9/9/9/9/9/4K4 x", "bad side"),
        ("4k4/9/9/9/9/9/9/4K4 w", "8 ranks"),
    ] {
        assert!(Game::from_start_fen(fen).is_err(), "{fen}: {why}");
    }
}

#[test]
fn custom_start_replays_identically() {
    let fen = "4k4/9/9/9/9/9/9/9/R3K3R w";
    let moves = ["a1a5", "e9d9", "e1e2"];
    let mut live = Game::from_start_fen(fen).unwrap();
    for m in moves {
        let (f, t) = parse_uci_move(m).unwrap();
        assert!(live.execute_move(f, t), "{m}");
    }
    let mut replay = Game::from_start_fen(live.start_fen.as_deref().unwrap()).unwrap();
    for m in moves {
        let (f, t) = parse_uci_move(m).unwrap();
        replay.execute_move(f, t);
    }
    assert_eq!(replay.position_key(), live.position_key());
    // ...and differs from replaying the same moves from the standard setup.
    assert_ne!(Game::new().position_key(), live.position_key());
}
