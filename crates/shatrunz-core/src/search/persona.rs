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
use crate::search::tt::{self, Bound};

/// Score for being checkmated, far outside any material/positional eval.
/// The remaining depth is added so a mate found closer to the root (sooner)
/// scores higher for the winner than one found deeper.
pub const MATE_SCORE: f64 = 100_000.0;

/// Which search the engine runs.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum SearchMode {
    /// The full engine: everything below plus the search-only improvements
    /// that change scores (check extensions, check evasions in quiescence).
    /// What the app plays with.
    #[default]
    Full,
    /// Only the behaviour `frontend/ai.js` has, so fixed-depth results can
    /// be compared with the JS search. Used by the JS↔Rust parity fixtures.
    Parity,
}

#[derive(Debug, Clone, Copy)]
pub struct SearchConfig {
    pub persona: Persona,
    pub mode: SearchMode,
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

thread_local! {
    /// Nodes visited by the current `get_best_move` call (alphabeta +
    /// quiescence entries). Only a statistic for benchmarking; it never
    /// influences the search.
    static NODES: std::cell::Cell<u64> = const { std::cell::Cell::new(0) };
}

fn count_node() {
    NODES.with(|n| n.set(n.get() + 1));
}

const MAX_PLY: usize = 64;

/// Move-ordering memory for one `get_best_move` call.
struct Heuristics {
    /// Two quiet moves per ply that recently caused a beta cutoff.
    killers: [[Option<Move>; 2]; MAX_PLY],
    /// `history[from][to]`: how often a quiet move cut off, weighted by depth².
    history: Vec<i32>,
}

thread_local! {
    static HEUR: std::cell::RefCell<Heuristics> = std::cell::RefCell::new(Heuristics {
        killers: [[None; 2]; MAX_PLY],
        history: vec![0; 81 * 81],
    });
}

fn sq(r: usize, c: usize) -> usize {
    r * crate::board::BOARD_SIZE + c
}

fn reset_heuristics() {
    HEUR.with(|h| {
        let mut h = h.borrow_mut();
        h.killers = [[None; 2]; MAX_PLY];
        h.history.iter_mut().for_each(|x| *x = 0);
    });
}

/// Value of the piece `m` captures, or `None` for a quiet move.
fn victim(board: &Board, m: Move, color: Color) -> Option<i32> {
    match board.get(m.to.r, m.to.c) {
        Some(t) if t.color != color => Some(t.kind.weight()),
        _ => None,
    }
}

/// MVV-LVA: most valuable victim first, cheapest attacker breaking ties.
fn capture_key(board: &Board, m: Move, v: i32) -> i32 {
    let attacker = board.get(m.from.r, m.from.c).map_or(0, |p| p.kind.weight().min(1000));
    100_000 + 10 * v - attacker
}

/// Searches the moves most likely to cause a cutoff first: the
/// transposition table's best move, captures (MVV-LVA), then this ply's killers, then quiet moves by history score.
/// Alpha-beta returns the same exact score whatever the order; a good order
/// just proves the other moves irrelevant sooner. The sort is stable, so
/// ties keep the generator's order.
fn order_moves(board: &Board, moves: &mut [Move], color: Color, ply: usize, tt_move: Option<tt::Entry>) {
    HEUR.with(|h| {
        let h = h.borrow();
        let killers = h.killers[ply.min(MAX_PLY - 1)];
        moves.sort_by_cached_key(|&m| {
            if tt_move.is_some_and(|e| e.is_move(m)) {
                return std::cmp::Reverse(i32::MAX);
            }
            let key = match victim(board, m, color) {
                Some(v) => capture_key(board, m, v),
                None if killers[0] == Some(m) => 90_000,
                None if killers[1] == Some(m) => 89_000,
                None => h.history[sq(m.from.r, m.from.c) * 81 + sq(m.to.r, m.to.c)].min(80_000),
            };
            std::cmp::Reverse(key)
        });
    });
}

/// A quiet move caused a beta cutoff: remember it as a killer for this ply
/// and bump its history score.
fn record_cutoff(m: Move, ply: usize, depth: i32) {
    HEUR.with(|h| {
        let mut h = h.borrow_mut();
        let k = &mut h.killers[ply.min(MAX_PLY - 1)];
        if k[0] != Some(m) {
            k[1] = k[0];
            k[0] = Some(m);
        }
        let i = sq(m.from.r, m.from.c) * 81 + sq(m.to.r, m.to.c);
        h.history[i] = (h.history[i] + depth * depth).min(80_000);
    });
}

fn deadline_passed(cfg: &SearchConfig) -> bool {
    matches!(cfg.deadline, Some(dl) if Instant::now() >= dl)
}

/// Mirrors `quiescence` (ai.js:121-143).
fn quiescence(game: &mut Game, mut alpha: f64, beta: f64, color: Color, cfg: &SearchConfig, q_depth: i32) -> f64 {
    count_node();
    if deadline_passed(cfg) {
        return evaluate_with_randomness(&game.board, color, cfg);
    }
    // In check there is no "standing pat": the side to move must answer the
    // check, and a capture-only search would miss that it can't (mate).
    if cfg.mode == SearchMode::Full && q_depth > 0 && is_king_in_check(&game.board, color) {
        return quiescence_evasions(game, alpha, beta, color, cfg, q_depth);
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

    // Captures only, most valuable victim first.
    let mut caps: Vec<(i32, Move)> = game
        .legal_moves(color)
        .into_iter()
        .filter_map(|m| victim(&game.board, m, color).map(|v| (capture_key(&game.board, m, v), m)))
        .collect();
    caps.sort_by_key(|&(k, _)| std::cmp::Reverse(k));
    for (_, m) in caps {
        if deadline_passed(cfg) {
            break;
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

/// Quiescence node in check: search every legal reply (not only captures).
/// No legal reply is checkmate.
fn quiescence_evasions(game: &mut Game, mut alpha: f64, beta: f64, color: Color, cfg: &SearchConfig, q_depth: i32) -> f64 {
    let moves = game.legal_moves(color);
    if moves.is_empty() {
        return -MATE_SCORE;
    }
    let mut best = f64::NEG_INFINITY;
    for m in moves {
        game.make_move(m.from, m.to);
        let score = -quiescence(game, -beta, -alpha, color.opposite(), cfg, q_depth - 1);
        game.undo_move();
        if score > best {
            best = score;
        }
        if score > alpha {
            alpha = score;
        }
        if alpha >= beta || deadline_passed(cfg) {
            break;
        }
    }
    best
}

/// Mirrors `alphabeta` (ai.js:145-177), with one deliberate divergence:
/// a node with no legal moves returns a mate score (checkmate) or 0
/// (stalemate). The JS original fell back to the static eval there, so the
/// AI could not tell checkmate from any other position and never mated a
/// lone king. The JS search is now only a no-wasm fallback.
#[allow(clippy::too_many_arguments)]
fn alphabeta(
    game: &mut Game,
    depth: i32,
    ply: usize,
    mut alpha: f64,
    beta: f64,
    color: Color,
    cfg: &SearchConfig,
) -> f64 {
    count_node();
    if deadline_passed(cfg) {
        return evaluate_with_randomness(&game.board, color, cfg);
    }
    // Check extension: a position in check is never a quiet leaf. Searching
    // it one ply deeper lets the engine see mates and forced sequences
    // that a check at the horizon would otherwise hide.
    let in_check = cfg.mode == SearchMode::Full && is_king_in_check(&game.board, color);
    let depth = if in_check && ply < MAX_PLY / 2 { depth + 1 } else { depth };
    if depth == 0 {
        return quiescence(game, alpha, beta, color, cfg, 4);
    }

    // Transposition table: a result from an earlier visit at least this
    // deep either settles the node or tells us which move to try first.
    // Parity and Full searches score differently: keep their entries apart.
    let mode_salt = if cfg.mode == SearchMode::Parity { 0x9E37_79B9_7F4A_7C15 } else { 0 };
    let key = tt::hash(&game.board, color, cfg.persona) ^ mode_salt;
    let hit = tt::probe(key);
    if let Some(e) = hit {
        if e.depth as i32 >= depth {
            match e.bound {
                Bound::Exact => return e.score,
                Bound::Lower if e.score >= beta => return e.score,
                Bound::Upper if e.score <= alpha => return e.score,
                _ => {}
            }
        }
    }
    let alpha_orig = alpha;

    // Reverse futility pruning (static null move): close to the horizon,
    // if the static eval beats beta by more than any plausible swing over
    // the remaining plies, assume the node fails high and skip its moves.
    // Not in check, and never with mate scores in the window.
    if cfg.mode == SearchMode::Full && depth <= 2 && !in_check && beta.abs() < MATE_SCORE / 2.0 {
        let margin = 120.0 * depth as f64;
        let static_eval = evaluate_with_randomness(&game.board, color, cfg);
        if static_eval - margin >= beta {
            return static_eval - margin;
        }
    }

    let mut moves = game.legal_moves(color);
    if moves.is_empty() {
        // No legal moves is a game end, not a quiet position: checkmate is
        // the worst possible result for the side to move, stalemate a draw.
        return if is_king_in_check(&game.board, color) {
            -(MATE_SCORE + depth as f64)
        } else {
            0.0
        };
    }

    order_moves(&game.board, &mut moves, color, ply, hit);
    let mut max_eval = f64::NEG_INFINITY;
    let mut best = None;
    for (i, m) in moves.into_iter().enumerate() {
        let quiet = victim(&game.board, m, color).is_none();
        game.make_move(m.from, m.to);
        // Late-move reductions: with good ordering, quiet moves near the end
        // of the list rarely matter. Search them shallower with a null
        // window; only if one surprises us (beats alpha) is it re-searched
        // at full depth. Never for captures, checks, or while in check.
        let reduce = if cfg.mode == SearchMode::Full
            && depth >= 3
            && i >= 3
            && quiet
            && !in_check
            && alpha.is_finite()
            && !is_king_in_check(&game.board, color.opposite())
        {
            if i >= 8 && depth >= 5 { 2 } else { 1 }
        } else {
            0
        };
        let mut eval_score = f64::NEG_INFINITY;
        if reduce > 0 {
            eval_score = -alphabeta(game, depth - 1 - reduce, ply + 1, -alpha - 1.0, -alpha, color.opposite(), cfg);
        }
        if reduce == 0 || eval_score > alpha {
            eval_score = -alphabeta(game, depth - 1, ply + 1, -beta, -alpha, color.opposite(), cfg);
        }
        game.undo_move();

        if eval_score > max_eval {
            max_eval = eval_score;
            best = Some(m);
        }
        if eval_score > alpha {
            alpha = eval_score;
        }
        if beta <= alpha {
            if quiet {
                record_cutoff(m, ply, depth);
            }
            break;
        }
    }
    // A subtree cut short by the deadline returned static evals: never
    // let that noise into the table.
    if !deadline_passed(cfg) {
        let bound = if max_eval <= alpha_orig {
            Bound::Upper
        } else if max_eval >= beta {
            Bound::Lower
        } else {
            Bound::Exact
        };
        tt::store(key, depth, max_eval, bound, best);
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
        // Root window: a move only matters if it beats the current
        // *second*-best (then it changes best or second). So search it with
        // alpha = second - its bonus; anything that fails low is provably
        // irrelevant and its subtree gets cut. Using second (not best) keeps
        // both best_score and second_score exact, so results are identical
        // to the old full-window search, only faster.
        let bonus = root_bonus(m);
        let alpha = local_second - bonus;
        game.make_move(m.from, m.to);
        let mut score = -alphabeta(
            game,
            depth as i32 - 1,
            1,
            f64::NEG_INFINITY,
            -alpha,
            color.opposite(),
            cfg,
        );
        game.undo_move();
        if deadline_passed(cfg) {
            break;
        }
        score += bonus;

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
    /// Search nodes visited (for nodes/sec benchmarks only).
    pub nodes: u64,
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
    NODES.with(|n| n.set(0));
    reset_heuristics();
    let moves = game.legal_moves(color);
    if moves.is_empty() {
        return SearchResult {
            best_move: None,
            best_score: f64::NEG_INFINITY,
            second_score: f64::NEG_INFINITY,
            depth_reached: 0,
            nodes: 0,
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
        if best_move.is_none() {
            // The budget ran out before even depth 1 finished (a tiny budget
            // or a stalled thread). A legal move beats no move: returning
            // None would make the caller treat the game as stuck.
            best_move = Some(order[0]);
            best_score = evaluate_with_randomness(&game.board, color, cfg);
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
        nodes: NODES.with(|n| n.get()),
    }
}
