/**
 * Minimal animated-GIF89a encoder (#32), no dependencies.
 *
 * Frames are already palette-indexed (Uint8Array, one byte per pixel), so
 * there's no quantiser here: the renderer draws with a small fixed palette.
 * Compression is plain GIF LZW (variable code width, clear code when the
 * 4096-entry table fills). Spec: https://www.w3.org/Graphics/GIF/spec-gif89a.txt
 */

/** LZW-compress `indices` with the given minimum code size; returns bytes. */
export function lzwEncode(indices, minCodeSize) {
    const clear = 1 << minCodeSize;
    const eoi = clear + 1;
    const out = [];
    let cur = 0;
    let bits = 0;
    let codeSize = minCodeSize + 1;
    const emit = (code) => {
        cur |= code << bits;
        bits += codeSize;
        while (bits >= 8) { out.push(cur & 0xff); cur >>>= 8; bits -= 8; }
    };
    let dict = new Map();
    let next = eoi + 1;
    emit(clear);
    let prefix = indices[0];
    for (let i = 1; i < indices.length; i++) {
        const k = indices[i];
        const key = prefix * 4096 + k;
        const hit = dict.get(key);
        if (hit !== undefined) { prefix = hit; continue; }
        emit(prefix);
        if (next < 4096) {
            dict.set(key, next++);
            if (next > (1 << codeSize) && codeSize < 12) codeSize++;
        } else {
            emit(clear);
            dict = new Map();
            next = eoi + 1;
            codeSize = minCodeSize + 1;
        }
        prefix = k;
    }
    emit(prefix);
    emit(eoi);
    if (bits > 0) out.push(cur & 0xff);
    return out;
}

/**
 * @param {{width:number,height:number,palette:number[][],frames:{indices:Uint8Array,delayCs:number}[],loop?:boolean}} o
 * palette: up to 256 [r,g,b] entries (padded to a power of two).
 * @returns {Uint8Array}
 */
export function encodeGif({ width, height, palette, frames, loop = true }) {
    let depth = 1;
    while ((1 << depth) < palette.length) depth++;
    const size = 1 << depth;
    const minCodeSize = Math.max(2, depth);
    const b = [];
    const u16 = (v) => b.push(v & 0xff, (v >> 8) & 0xff);
    const str = (s) => { for (const ch of s) b.push(ch.charCodeAt(0)); };

    str('GIF89a');
    u16(width); u16(height);
    b.push(0x80 | ((depth - 1) << 4) | (depth - 1), 0, 0); // global table, bg 0, aspect 0
    for (let i = 0; i < size; i++) {
        const [r, g, bl] = palette[i] || [0, 0, 0];
        b.push(r, g, bl);
    }
    if (loop) { // NETSCAPE2.0 loop forever
        b.push(0x21, 0xff, 0x0b); str('NETSCAPE2.0'); b.push(0x03, 0x01, 0, 0, 0);
    }
    for (const f of frames) {
        b.push(0x21, 0xf9, 0x04, 0x00); u16(Math.max(2, f.delayCs | 0)); b.push(0, 0); // GCE
        b.push(0x2c); u16(0); u16(0); u16(width); u16(height); b.push(0); // image desc
        b.push(minCodeSize);
        const data = lzwEncode(f.indices, minCodeSize);
        for (let i = 0; i < data.length; i += 255) {
            const chunk = data.slice(i, i + 255);
            b.push(chunk.length, ...chunk);
        }
        b.push(0);
    }
    b.push(0x3b);
    return Uint8Array.from(b);
}
