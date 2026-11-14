/**
 * Export a game as an animated GIF (#32): one frame per position, with the
 * last move highlighted and an optional move caption. The board is drawn on
 * a canvas with the same glyphs as the app, then snapped to a 16-colour
 * palette (fast, small, no quantiser library) and encoded by gif_encoder.js.
 */
import { BOARD_SIZE, FILES, SYMBOLS } from '../constants.js';
import { Game } from '../game.js';
import { parseUCIMove } from './uci.js';
import { encodeGif } from './gif_encoder.js';

export const GIF_SQ = 36;              // px per square
export const GIF_CAPTION = 26;         // caption strip height
export const GIF_MOVE_DELAY_CS = 80;   // 0.8 s per move
export const GIF_LAST_DELAY_CS = 300;  // hold the final position 3 s
export const GIF_MAX_FRAMES = 301;     // start + 300 plies; longer games keep the ending
export const GIF_MAX_BYTES = 6 * 1024 * 1024;

export const PALETTE = [
    [240, 217, 181], [181, 136, 99],   // 0 light, 1 dark
    [205, 210, 106], [170, 162, 58],   // 2 last-move light, 3 last-move dark
    [255, 255, 255], [17, 17, 17],     // 4 white piece, 5 black piece
    [255, 177, 92],  [30, 30, 30],     // 6 Krishna, 7 caption background
    [235, 235, 235], [128, 128, 128],  // 8 caption text, 9 mid grey
    [190, 190, 190], [70, 70, 70],     // 10 light grey, 11 dark grey
    [210, 60, 60],   [222, 184, 140],  // 12 check red, 13 board mid
    [120, 90, 60],   [160, 160, 80],   // 14 dark wood edge, 15 olive edge
];

/** Nearest palette entry for each RGBA pixel (cached per colour). */
export function quantize(rgba, palette = PALETTE) {
    const out = new Uint8Array(rgba.length / 4);
    const cache = new Map();
    for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
        const key = (rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2];
        let idx = cache.get(key);
        if (idx === undefined) {
            let best = Infinity;
            for (let j = 0; j < palette.length; j++) {
                const dr = rgba[i] - palette[j][0];
                const dg = rgba[i + 1] - palette[j][1];
                const db = rgba[i + 2] - palette[j][2];
                const d = dr * dr * 3 + dg * dg * 4 + db * db * 2;
                if (d < best) { best = d; idx = j; }
            }
            cache.set(key, idx);
        }
        out[p] = idx;
    }
    return out;
}

/** Positions (+ last move + caption) for every ply from the game's start. */
export function gameFrames(uciMoves, startFen = null) {
    const g = new Game({ fen: startFen });
    const snap = (last, caption) => ({ board: g.board.map((row) => row.map((p) => (p ? { ...p } : null))), last, caption });
    const frames = [snap(null, 'Start')];
    uciMoves.forEach((u, i) => {
        const mv = parseUCIMove(u);
        if (!mv || !g.executeMove(mv.from, mv.to)) return;
        const num = Math.floor(i / 2) + 1;
        frames.push(snap(mv, `${num}${i % 2 ? '…' : '.'} ${u}`));
    });
    return frames.length > GIF_MAX_FRAMES ? [frames[0], ...frames.slice(-(GIF_MAX_FRAMES - 1))] : frames;
}

function drawFrame(ctx, f, { flipped, caption }) {
    const S = GIF_SQ;
    const N = BOARD_SIZE;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
            const br = flipped ? N - 1 - r : r;
            const bc = flipped ? N - 1 - c : c;
            const light = (r + c) % 2 === 0;
            const hl = f.last && ((f.last.from.r === br && f.last.from.c === bc) || (f.last.to.r === br && f.last.to.c === bc));
            const col = PALETTE[(hl ? 2 : 0) + (light ? 0 : 1)];
            ctx.fillStyle = `rgb(${col})`;
            ctx.fillRect(c * S, r * S, S, S);
            const p = f.board[br][bc];
            if (p) {
                ctx.font = `${Math.round(S * 0.82)}px "Segoe UI Symbol","Noto Sans Symbols 2","DejaVu Sans",serif`;
                ctx.fillStyle = p.type === 'z' ? `rgb(${PALETTE[6]})` : p.color === 'w' ? '#fff' : '#111';
                if (p.color === 'w' && p.type !== 'z') {
                    ctx.strokeStyle = '#111';
                    ctx.lineWidth = 1.5;
                    ctx.strokeText(SYMBOLS.b[p.type], c * S + S / 2, r * S + S / 2 + 2);
                    ctx.fillText(SYMBOLS.b[p.type], c * S + S / 2, r * S + S / 2 + 2);
                } else {
                    ctx.fillText(SYMBOLS[p.color][p.type], c * S + S / 2, r * S + S / 2 + 2);
                }
            }
        }
    }
    ctx.font = '9px sans-serif';
    ctx.fillStyle = 'rgb(70,70,70)';
    for (let i = 0; i < N; i++) {
        ctx.fillText(FILES[flipped ? N - 1 - i : i], i * S + S - 5, N * S - 5);
    }
    if (caption) {
        ctx.fillStyle = `rgb(${PALETTE[7]})`;
        ctx.fillRect(0, N * S, N * S, GIF_CAPTION);
        ctx.fillStyle = `rgb(${PALETTE[8]})`;
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(f.caption, (N * S) / 2, N * S + GIF_CAPTION / 2 + 1);
    }
}

/** Render + encode. Returns a Uint8Array GIF. Browser only (needs canvas). */
export function renderGameGif(uciMoves, { startFen = null, flipped = false, caption = true } = {}) {
    const frames = gameFrames(uciMoves, startFen);
    const W = GIF_SQ * BOARD_SIZE;
    const H = W + (caption ? GIF_CAPTION : 0);
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const out = frames.map((f, i) => {
        ctx.clearRect(0, 0, W, H);
        drawFrame(ctx, f, { flipped, caption });
        return {
            indices: quantize(ctx.getImageData(0, 0, W, H).data),
            delayCs: i === frames.length - 1 ? GIF_LAST_DELAY_CS : GIF_MOVE_DELAY_CS,
        };
    });
    return encodeGif({ width: W, height: H, palette: PALETTE, frames: out });
}

function toBase64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
}

/** Share (Android share sheet) or download (browser) the game as a GIF. */
export function shareGameGif(uciMoves, opts = {}) {
    const bytes = renderGameGif(uciMoves, opts);
    if (bytes.length > GIF_MAX_BYTES) throw new Error('GIF too large to share');
    const filename = `shatrunz_${Date.now()}.gif`;
    if (window.AndroidApp?.shareGif) {
        window.AndroidApp.shareGif(filename, toBase64(bytes));
        return bytes.length;
    }
    const url = URL.createObjectURL(new Blob([bytes], { type: 'image/gif' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return bytes.length;
}
