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
    }
}
