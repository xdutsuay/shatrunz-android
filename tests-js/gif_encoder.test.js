import test from 'node:test';
import assert from 'node:assert/strict';

import { encodeGif, lzwEncode } from '../frontend/shared/gif_encoder.js';
import { gameFrames, quantize, PALETTE, GIF_MAX_FRAMES } from '../frontend/shared/gif_export.js';

// Reference GIF LZW decoder, so the encoder is checked by round-trip.
function lzwDecode(bytes, minCodeSize, count) {
    const clear = 1 << minCodeSize;
    const eoi = clear + 1;
    let pos = 0; let cur = 0; let bits = 0;
    let size = minCodeSize + 1;
    let dict = []; let prev = null;
    const reset = () => { dict = []; for (let i = 0; i < clear; i++) dict[i] = [i]; dict[clear] = []; dict[eoi] = []; size = minCodeSize + 1; prev = null; };
    reset();
    const out = [];
    while (out.length < count) {
        while (bits < size) { cur |= bytes[pos++] << bits; bits += 8; }
        const code = cur & ((1 << size) - 1);
        cur >>>= size; bits -= size;
        if (code === clear) { reset(); continue; }
        if (code === eoi) break;
        let entry;
        if (code < dict.length) entry = dict[code];
        else entry = [...dict[prev], dict[prev][0]];
        out.push(...entry);
        if (prev !== null && dict.length < 4096) dict.push([...dict[prev], entry[0]]);
        prev = code;
        if (dict.length === (1 << size) && size < 12) size++;
    }
    return out;
}

test('LZW round-trips, including table resets', () => {
    let s = 7;
    const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) % 16;
    const data = Uint8Array.from({ length: 40000 }, (_, i) => (i % 97 < 60 ? i % 3 : rnd()));
    assert.deepEqual(lzwDecode(lzwEncode(data, 4), 4, data.length), [...data]);
});

test('encodeGif writes a looping GIF89a with one image per frame', () => {
    const px = new Uint8Array(4 * 3).fill(1);
    const gif = encodeGif({ width: 4, height: 3, palette: PALETTE, frames: [{ indices: px, delayCs: 80 }, { indices: px, delayCs: 300 }] });
    assert.equal(String.fromCharCode(...gif.slice(0, 6)), 'GIF89a');
    assert.equal(gif[gif.length - 1], 0x3b);
    assert.ok(Buffer.from(gif).includes('NETSCAPE2.0'));
    assert.equal([...gif].filter((b, i) => b === 0x21 && gif[i + 1] === 0xf9).length, 2);
});

test('quantize snaps to the nearest palette colour', () => {
    const idx = quantize(Uint8Array.from([240, 217, 181, 255, 18, 18, 18, 255, 250, 180, 90, 255]));
    assert.deepEqual([...idx], [0, 5, 6]);
});

test('gameFrames: one frame per ply from the game start, capped', () => {
    const f = gameFrames(['e2e3', 'e8e7', 'd1h5']);
    assert.equal(f.length, 4);
    assert.equal(f[0].last, null);
    assert.deepEqual(f[3].last.to, { r: 4, c: 7 });
    assert.match(f[2].caption, /^1… e8e7$/);
    const long = Array.from({ length: 200 }, (_, i) => (i % 4 === 0 ? 'b1c3' : i % 4 === 1 ? 'b9c7' : i % 4 === 2 ? 'c3b1' : 'c7b9'));
    assert.equal(gameFrames(long).length, Math.min(GIF_MAX_FRAMES, 201));
});
