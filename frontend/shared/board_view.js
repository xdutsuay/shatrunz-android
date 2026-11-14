import { BOARD_SIZE, FILES, PIECES, SYMBOLS } from '../constants.js';
import { Rules } from '../rules.js';

export class BoardView {
    constructor({ boardEl, getGame, getSelection, onSquareClick, isTraining, isFlipped = () => false }) {
        this.boardEl = boardEl;
        this.getGame = getGame;
        this.getSelection = getSelection;
        this.onSquareClick = onSquareClick;
        this.isTraining = isTraining;
        this.isFlipped = isFlipped;
        // Move-history length at the last render: animate only when exactly
        // one new move appeared (not on undo, replay jumps or new game).
        this._renderedPlies = null;
    }

    render() {
        const game = this.getGame();
        const { selectedSq, legalMoves } = this.getSelection();

        let checkKingPos = null;
        try {
            if (Rules.isKingInCheck(game.board, game.turn)) {
                for (let rr = 0; rr < BOARD_SIZE; rr++) {
                    for (let cc = 0; cc < BOARD_SIZE; cc++) {
                        const pp = game.board[rr][cc];
                        if (pp && pp.color === game.turn && pp.type === PIECES.KING) {
                            checkKingPos = { r: rr, c: cc };
                            break;
                        }
                    }
                    if (checkKingPos) break;
                }
            }
        } catch (_) {
            checkKingPos = null;
        }

        this.boardEl.innerHTML = '';
        const flipped = this.isFlipped();
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const boardR = flipped ? BOARD_SIZE - 1 - r : r;
                const boardC = flipped ? BOARD_SIZE - 1 - c : c;
                const sq = document.createElement('div');
                sq.className = `square ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
                sq.onclick = () => this.onSquareClick(boardR, boardC);

                if (c === 0) {
                    const t = document.createElement('span');
                    t.className = 'coord rank';
                    t.innerText = 9 - boardR;
                    sq.appendChild(t);
                }
                if (r === 8) {
                    const t = document.createElement('span');
                    t.className = 'coord file';
                    t.innerText = FILES[boardC];
                    sq.appendChild(t);
                }

                if (selectedSq && selectedSq.r === boardR && selectedSq.c === boardC) {
                    sq.classList.add('selected');
                }

                const lastMove = game.moveHistory[game.moveHistory.length - 1];
                if (lastMove && ((lastMove.from.r === boardR && lastMove.from.c === boardC) ||
                    (lastMove.to.r === boardR && lastMove.to.c === boardC))) {
                    sq.classList.add('last-move');
                }

                if (checkKingPos && checkKingPos.r === boardR && checkKingPos.c === boardC) {
                    sq.classList.add('in-check');
                }

                const isLegal = legalMoves.find(m => m.r === boardR && m.c === boardC);
                if (isLegal) {
                    if (game.board[boardR][boardC]) sq.classList.add('capture-move');
                    else sq.classList.add('legal-move');
                }

                const p = game.board[boardR][boardC];
                if (p) {
                    const d = document.createElement('div');
                    d.className = `piece ${p.color === 'w' ? 'white-piece' : 'black-piece'} ${p.type === PIECES.KRISHNA ? 'krishna' : ''}`;
                    d.innerText = SYMBOLS[p.color][p.type];
                    sq.appendChild(d);
                }

                this.boardEl.appendChild(sq);
            }
        }
        this._animateLastMove(game, flipped);
    }

    /**
     * Slide the piece that just moved from its old square to its new one.
     * The DOM is rebuilt every render, so this is a FLIP animation: the
     * piece is already drawn at its destination; we start it offset back at
     * the source square and let the compositor slide it home. It only
     * touches `transform`, so it never blocks the UI thread, and a render
     * during the slide simply replaces the element (fast AI vs AI can't
     * queue animations up).
     */
    _animateLastMove(game, flipped) {
        const plies = game.moveHistory.length;
        const prev = this._renderedPlies;
        this._renderedPlies = plies;
        if (prev === null || plies !== prev + 1) return;
        if (typeof window === 'undefined' || !window.matchMedia) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const last = game.moveHistory[plies - 1];
        if (!last) return;
        const idx = (r, c) => (flipped ? BOARD_SIZE - 1 - r : r) * BOARD_SIZE + (flipped ? BOARD_SIZE - 1 - c : c);
        const squares = this.boardEl.children;
        const fromSq = squares[idx(last.from.r, last.from.c)];
        const toSq = squares[idx(last.to.r, last.to.c)];
        const piece = toSq?.querySelector('.piece');
        if (!fromSq || !piece || typeof piece.animate !== 'function') return;
        const a = fromSq.getBoundingClientRect();
        const b = toSq.getBoundingClientRect();
        const dx = a.left - b.left;
        const dy = a.top - b.top;
        if (!dx && !dy) return;
        piece.style.zIndex = '3';
        const anim = piece.animate(
            [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
            { duration: MOVE_ANIMATION_MS, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
        );
        anim.onfinish = () => { piece.style.zIndex = ''; };
    }
}

// Short enough that even 50 ms-per-move AI vs AI just looks like a quick
// slide (the next render replaces the element), long enough to follow.
export const MOVE_ANIMATION_MS = 160;
