//! Faithful port of `frontend/ai.js`'s search (the deterministic core
//! only — brain/opening-book/policy-net bonuses and the browser
//! setTimeout-yield scheduler stay out of scope; see the module doc below
//! for what's deliberately not here).
//!
//! `AIPlayer.generateMoves`/`applyMove`/`undoMove` (board-array based, not
//! `Game`-based) are dead code in ai.js — grepped, unused anywhere else in
//! the JS codebase — and are intentionally not ported; the actual search
//! path (`alphabeta`/`quiescence`/`getBestMove`) uses
//! `Rules.getAllLegalMoves` directly, unordered, and that's what's
//! mirrored here.
//!
//! **Deliberately not ported:**
//! - Randomness (`evaluateWithRandomness`'s `±50cp` via `Math.random()`):
//!   JS's `Math.random()` can't be bit-reproduced in Rust, and P3 (the
//!   parity gate for this module) explicitly runs with randomness off.
//!   `SearchConfig.add_randomness` exists but is currently a no-op —
//!   tracked as a deferred gap in docs/RUST_PORT.md, not silently dropped.
//! - The UI yield scheduler (`shouldYield`/`lastYieldTime`/`setTimeout`):
//!   per docs/plans/PLAN_03_rust_port.md M5, this whole mechanism is
//!   superseded by running search in a Web Worker, not ported at all.
//! - `brain.getBonus`/`openingBookBonus`/`positionValue`/`policyBonuses`:
//!   these stay JS (brain.js is localStorage-backed, policy_net.js does a
//!   network fetch). The combined per-move bonus they produce is passed
//!   into `get_best_move` as `root_bonus`, added exactly where JS adds it
//!   (root moves only, after the recursive search score is known).

use web_time::Instant;

use crate::board::Board;
use crate::eval::hce::{evaluate_for_search, Persona};
use crate::game::Game;
use crate::moves::Move;
use crate::phase::endgame_depth_bonus;
use crate::piece::Color;
use crate::rules::is_king_in_check;

/// Score for being checkmated, far outside any material/positional eval.
/// The remaining depth is added so a mate found closer to the root (sooner)
/// scores higher for the winner than one found deeper.
pub const MATE_SCORE: f64 = 100_000.0;

#[derive(Debug, Clone, Copy)]
pub struct SearchConfig {
    pub persona: Persona,
    /// Not implemented — see module doc. Always behaves as `false`.
    pub add_randomness: bool,
    /// `None` = single fixed-depth search (`budgetMs <= 0` in JS). `Some`
    /// = iterative deepening until the deadline (`budgetMs > 0` in JS).
    pub deadline: Option<Instant>,
}

fn evaluate_with_randomness(board: &Board, turn: Color, cfg: &SearchConfig) -> f64 {
    let _ = cfg.add_randomness; // see module doc: not implemented
    evaluate_for_search(board, turn, cfg.persona) as f64 + mop_up(board, turn)
}

/// "Mop-up" guidance for K + major piece(s) vs a lone king (Krishna aside:
/// it can't capture or be captured, so it doesn't count as material).
///
/// Mating a bare king takes 10–20 moves, far beyond the search horizon, and
/// the normal eval sees every square as equal, so the stronger side just
/// wanders. The two classic hints give the search a gradient to follow:
/// drive the losing king to the edge (distance from the centre) and bring
/// the winning king close (kings' distance). Returned from `turn`'s view.
/// Only applies in lone-king endings, so normal play is unaffected.
pub fn mop_up(board: &Board, turn: Color) -> f64 {
    use crate::board::BOARD_SIZE;
    use crate::piece::PieceKind;
    let mut material = [0i32; 2];
    let mut kings = [None; 2];
    for r in 0..BOARD_SIZE {
        for c in 0..BOARD_SIZE {
            if let Some(p) = board.get(r, c) {
                let i = if p.color == Color::White { 0 } else { 1 };
                match p.kind {
                    PieceKind::King => kings[i] = Some((r as i32, c as i32)),
                    PieceKind::Krishna => {}
                    k => material[i] += k.weight(),
                }
            }
        }
    }
    let (Some(wk), Some(bk)) = (kings[0], kings[1]) else {
        return 0.0;
    };
    let (strong, weak_king, strong_king) = if material[1] == 0 && material[0] >= 500 {
        (Color::White, bk, wk)
    } else if material[0] == 0 && material[1] >= 500 {
        (Color::Black, wk, bk)
    } else {
        return 0.0;
    };
    let center = (BOARD_SIZE / 2) as i32;
    let edge_push = (weak_king.0 - center).abs() + (weak_king.1 - center).abs();
    let kings_apart = (weak_king.0 - strong_king.0).abs() + (weak_king.1 - strong_king.1).abs();
    let bonus = (10 * edge_push + 4 * (2 * BOARD_SIZE as i32 - kings_apart)) as f64;
    if turn == strong {
        bonus
    } else {
        -bonus
    }
}

fn deadline_passed(cfg: &SearchConfig) -> bool {
    matches!(cfg.deadline, Some(dl) if Instant::now() >= dl)
}

/// Mirrors `quiescence` (ai.js:121-143).
fn quiescence(game: &mut Game, mut alpha: f64, beta: f64, color: Color, cfg: &SearchConfig, q_depth: i32) -> f64 {
    if deadline_passed(cfg) {
        return evaluate_with_randomness(&game.board, color, cfg);
    }
    let stand = evaluate_with_randomness(&game.board, color, cfg);
    if stand >= beta {
        return beta;
    }
    if alpha < stand {
        alpha = stand;
    }
    if q_depth <= 0 {
        return alpha;
    }

    let moves = game.legal_moves(color);
    for m in moves {
        if deadline_passed(cfg) {
            break;
        }
        let is_capture = matches!(game.board.get(m.to.r, m.to.c), Some(t) if t.color != color);
        if !is_capture {
            continue;
        }
        game.make_move(m.from, m.to);
        let score = -quiescence(game, -beta, -alpha, color.opposite(), cfg, q_depth - 1);
        game.undo_move();
        if score >= beta {
            return beta;
        }
        if score > alpha {
            alpha = score;
        }
    }
    alpha
}

/// Mirrors `alphabeta` (ai.js:145-177), with one deliberate divergence:
/// a node with no legal moves returns a mate score (checkmate) or 0
/// (stalemate). The JS original fell back to the static eval there, so the
/// AI could not tell checkmate from any other position and never mated a
/// lone king. The JS search is now only a no-wasm fallback.
fn alphabeta(game: &mut Game, depth: i32, mut alpha: f64, beta: f64, color: Color, cfg: &SearchConfig) -> f64 {
    if deadline_passed(cfg) {
        return evaluate_with_randomness(&game.board, color, cfg);
    }
    if depth == 0 {
        return quiescence(game, alpha, beta, color, cfg, 4);
    }

    let moves = game.legal_moves(color);
    if moves.is_empty() {
        // No legal moves is a game end, not a quiet position: checkmate is
        // the worst possible result for the side to move, stalemate a draw.
        return if is_king_in_check(&game.board, color) {
            -(MATE_SCORE + depth as f64)
        } else {
            0.0
        };
    }

    let mut max_eval = f64::NEG_INFINITY;
    for m in moves {
        game.make_move(m.from, m.to);
        let eval_score = -alphabeta(game, depth - 1, -beta, -alpha, color.opposite(), cfg);
        game.undo_move();

        if eval_score > max_eval {
            max_eval = eval_score;
        }
        if eval_score > alpha {
            alpha = eval_score;
        }
        if beta <= alpha {
            break;
        }
    }
    max_eval
}

struct DepthResult {
    best_move: Move,
    best_score: f64,
    second_score: f64,
}

/// Mirrors the per-depth root loop inside `getBestMove`'s `searchOneDepth`
/// (ai.js:253-304) — root moves are scored via `alphabeta`, then
/// `root_bonus` is added (replacing JS's brain/book/positionValue/policy
/// terms, computed externally and passed in already summed per move; see
/// module doc). A partial sweep cut short by the deadline commits the best
/// of the moves it *finished*; the move whose subtree was interrupted is
/// dropped, because the deadline makes every node below it return a static
/// eval and its score is noise. Callers put the previous iteration's best
/// move first, so a partial sweep can only replace it with a move that
/// genuinely scored better at the deeper depth.
fn search_one_depth(
    game: &mut Game,
    moves: &[Move],
    depth: u32,
    color: Color,
    cfg: &SearchConfig,
    root_bonus: &dyn Fn(Move) -> f64,
) -> Option<DepthResult> {
    let mut local_best: Option<Move> = None;
    let mut local_score = f64::NEG_INFINITY;
    let mut local_second = f64::NEG_INFINITY;

    for &m in moves {
        if deadline_passed(cfg) {
            break;
        }
        game.make_move(m.from, m.to);
        let mut score = -alphabeta(
            game,
            depth as i32 - 1,
            f64::NEG_INFINITY,
            f64::INFINITY,
            color.opposite(),
            cfg,
        );
        game.undo_move();
        if deadline_passed(cfg) {
            break;
        }
        score += root_bonus(m);

        if score > local_score {
            local_second = local_score;
            local_score = score;
            local_best = Some(m);
        } else if score > local_second {
            local_second = score;
        }
    }

    local_best.map(|m| DepthResult {
        best_move: m,
        best_score: local_score,
        second_score: local_second,
    })
}

#[derive(Debug, Clone, Copy)]
pub struct SearchResult {
    pub best_move: Option<Move>,
    pub best_score: f64,
    pub second_score: f64,
    pub depth_reached: u32,
}

/// Mirrors `AIPlayer.getBestMove` (ai.js:213-339), minus the brain
/// persistence side effect (`brain.recordMove`, stays JS) and the
/// `onSearchUpdate`/UI progress callback (not core logic). `base_depth`
/// is `this.depth` — already resolved from a difficulty level by
/// `levelToJsDepth` (persona.js), which stays JS/UI-facing config, not
/// core search.
pub fn get_best_move(
    game: &mut Game,
    color: Color,
    base_depth: u32,
    cfg: &SearchConfig,
    root_bonus: &dyn Fn(Move) -> f64,
) -> SearchResult {
    let moves = game.legal_moves(color);
    if moves.is_empty() {
        return SearchResult {
            best_move: None,
            best_score: f64::NEG_INFINITY,
            second_score: f64::NEG_INFINITY,
            depth_reached: 0,
        };
    }

    let mut max_depth = base_depth + endgame_depth_bonus(game);
    if cfg.deadline.is_some() {
        max_depth = max_depth.min(8);
    }

    let mut best_move = None;
    let mut best_score = f64::NEG_INFINITY;
    let mut second_score = f64::NEG_INFINITY;
    let mut depth_reached = 0;

    if cfg.deadline.is_some() {
        // Iterative deepening, best-move-first: the previous iteration's
        // best is searched first so a deadline-truncated iteration can't
        // swap it for a move that merely happened to be looked at early.
        let mut order = moves.clone();
        for d in 1..=max_depth {
            if deadline_passed(cfg) {
                break;
            }
            if let Some(r) = search_one_depth(game, &order, d, color, cfg, root_bonus) {
                if let Some(i) = order.iter().position(|&m| m == r.best_move) {
                    order[..=i].rotate_right(1);
                }
                best_move = Some(r.best_move);
                best_score = r.best_score;
                second_score = r.second_score;
                depth_reached = d;
            }
            if deadline_passed(cfg) {
                break;
            }
        }
    } else if let Some(r) = search_one_depth(game, &moves, max_depth, color, cfg, root_bonus) {
        best_move = Some(r.best_move);
        best_score = r.best_score;
        second_score = r.second_score;
        depth_reached = max_depth;
    }

    let second_score = if second_score == f64::NEG_INFINITY {
        best_score
    } else {
        second_score
    };

    SearchResult {
        best_move,
        best_score,
        second_score,
        depth_reached,
    }
}
