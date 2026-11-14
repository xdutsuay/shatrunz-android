/**
 * Shatrunz960 (#31): Fischer-random-style starts for the 9x9 board.
 *
 * Adapted from chessprogramming.org "Chess960" and "Chess960 Start Positions"
 * (Scharnagl numbering). The back rank holds R R N N B B Q K Z, and:
 *   - bishops on opposite colours: one on an even file (a,c,e,g,i, 5 squares),
 *     one on an odd file (b,d,f,h, 4 squares);
 *   - the king stands between the two rooks;
 *   - Krishna (Z) goes on any square left over. It can't be captured and it
 *     blocks rays, so behind its own pawns it's a shield wherever it lands.
 *     No square is unsafe, and no square makes the start illegal;
 *   - Black mirrors White file for file (symmetric), pawns as usual.
 * 5 * 4 * 7 (queen) * 6 (Krishna) * 10 (knight pairs) = 8400 starts, numbered
 * 0..8399 by a mixed-radix decode like Scharnagl's. The standard Shatrunz
 * setup is #4671.
 *
 * Castling: Shatrunz castling is positional (king on e1 and a rook on the a/i
 * corner). So it's only available when a 960 start happens to have K on e and
 * rooks on a and i. Chess960's "king and rook land on c/g" castling isn't
 * implemented.
 */
export const SHATRUNZ960_COUNT = 8400;
export const SHATRUNZ960_STANDARD_ID = 4671;

const EVEN = [0, 2, 4, 6, 8];
const ODD = [1, 3, 5, 7];
const PAIRS5 = [];
for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) PAIRS5.push([i, j]);

/** Back rank (lower-case letters, files a..i) for start number `id`. */
export function backRankFor(id) {
    if (!Number.isInteger(id) || id < 0 || id >= SHATRUNZ960_COUNT) {
        throw new RangeError(`Shatrunz960 number must be 0..${SHATRUNZ960_COUNT - 1}`);
    }
    const rank = Array(9).fill(null);
    let n = id;
    rank[EVEN[n % 5]] = 'b'; n = Math.floor(n / 5);
    rank[ODD[n % 4]] = 'b'; n = Math.floor(n / 4);
    const free = () => rank.map((p, i) => (p ? -1 : i)).filter((i) => i >= 0);
    rank[free()[n % 7]] = 'q'; n = Math.floor(n / 7);
    rank[free()[n % 6]] = 'z'; n = Math.floor(n / 6);
    const [k1, k2] = PAIRS5[n];
    const f5 = free();
    rank[f5[k1]] = 'n';
    rank[f5[k2]] = 'n';
    const [r1, k, r2] = free(); // left to right: rook, king, rook
    rank[r1] = 'r'; rank[k] = 'k'; rank[r2] = 'r';
    return rank.join('');
}

/** Full start string (placement + side) for start number `id`. */
export function startFenFor(id) {
    const back = backRankFor(id);
    return `${back}/ppppppppp/9/9/9/9/9/PPPPPPPPP/${back.toUpperCase()} w`;
}

/** The Shatrunz960 number of a start string, or null if it isn't one. */
export function idForStartFen(fen) {
    const m = /^([a-z]{9})\/ppppppppp\/9\/9\/9\/9\/9\/PPPPPPPPP\/([A-Z]{9}) w$/.exec((fen || '').trim());
    if (!m || m[2] !== m[1].toUpperCase()) return null;
    const back = m[1];
    const bE = EVEN.findIndex((c) => back[c] === 'b');
    const bO = ODD.findIndex((c) => back[c] === 'b');
    if (bE < 0 || bO < 0) return null;
    // Re-derive the rest by decoding candidates with these bishops (cheap: 420 tries).
    for (let rest = 0; rest < SHATRUNZ960_COUNT / 20; rest++) {
        const id = bE + 5 * (bO + 4 * rest);
        if (backRankFor(id) === back) return id;
    }
    return null;
}

/** A random start number (crypto RNG when available). */
export function randomShatrunz960Id() {
    const c = globalThis.crypto;
    if (c?.getRandomValues) return c.getRandomValues(new Uint32Array(1))[0] % SHATRUNZ960_COUNT;
    return Math.floor(Math.random() * SHATRUNZ960_COUNT);
}
