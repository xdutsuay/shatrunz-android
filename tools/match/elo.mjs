/**
 * Elo from a W/D/L match result, with a 95% error bar.
 *
 * score s = (W + D/2) / N, Elo = -400 * log10(1/s - 1).
 * The error comes from the per-game score variance (trinomial: 1, 0.5, 0),
 * mapped through the derivative of the Elo curve at s.
 */
export function eloFromWDL(w, d, l) {
    const n = w + d + l;
    if (n === 0) return { elo: 0, err: Infinity, score: NaN, n };
    const s = (w + d / 2) / n;
    const toElo = (x) => -400 * Math.log10(1 / x - 1);
    const clamp = (x) => Math.min(Math.max(x, 0.5 / n), 1 - 0.5 / n);
    const variance = (w * (1 - s) ** 2 + d * (0.5 - s) ** 2 + l * (0 - s) ** 2) / n;
    const sd = Math.sqrt(variance / n);
    const elo = toElo(clamp(s));
    const lo = toElo(clamp(s - 1.96 * sd));
    const hi = toElo(clamp(s + 1.96 * sd));
    return { elo, err: (hi - lo) / 2, score: s, n };
}

export function formatElo({ elo, err }) {
    const r = (x) => (Number.isFinite(x) ? Math.round(x) : '∞');
    return `${elo >= 0 ? '+' : ''}${r(elo)} ± ${r(err)}`;
}
