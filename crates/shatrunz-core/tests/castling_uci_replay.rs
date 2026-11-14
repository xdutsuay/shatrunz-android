//! Regression: a castling move that arrives as plain UCI ("e9g9", no flag)
//! must also move the rook. The AI worker rebuilds the position from UCI
//! every move; before the fix its board kept the rook in the corner, so it
//! searched a different position and could return a move the real game
//! rejected ("Illegal move rejected — auto-play stopped").
use shatrunz_core::game::Game;
use shatrunz_core::uci::parse_uci_move;

const LINE: &[&str] = &[
    "i2i3", "g8g7", "g2g4", "a8a6", "d2d3", "e8e7", "d1d2", "b8b6", "d2i7", "f9i6", "b2b4",
    "d9e8", "i7h6", "g9g8", "c2c4", "f8f7", "h2h4", "e7e6", "a2a3", "c8c7", "e1d1", "e9g9",
];

#[test]
fn castling_from_plain_uci_moves_the_rook() {
    let mut g = Game::new();
    for u in LINE {
        let (from, to) = parse_uci_move(u).unwrap();
        assert!(g.execute_move(from, to), "{u} rejected");
    }
    // Black castled kingside: king on g9 (row 0, col 6), rook from i9 to f9.
    let king = g.board.get(0, 6).expect("king on g9");
    let rook = g.board.get(0, 5).expect("rook on f9");
    assert_eq!(format!("{:?}", king.kind), "King");
    assert_eq!(format!("{:?}", rook.kind), "Rook");
    assert!(g.board.get(0, 8).is_none(), "i9 must be empty after castling");
}

#[test]
fn castling_from_plain_uci_undoes_cleanly() {
    let mut g = Game::new();
    for u in LINE {
        let (from, to) = parse_uci_move(u).unwrap();
        g.execute_move(from, to);
    }
    assert!(g.undo_last_move());
    assert_eq!(format!("{:?}", g.board.get(0, 4).unwrap().kind), "King");
    assert_eq!(format!("{:?}", g.board.get(0, 8).unwrap().kind), "Rook");
    assert!(g.board.get(0, 5).is_none() && g.board.get(0, 6).is_none());
}
