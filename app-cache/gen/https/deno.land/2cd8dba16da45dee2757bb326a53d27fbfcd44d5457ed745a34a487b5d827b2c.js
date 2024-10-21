// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
/*
MIT License

Copyright (c) 2018 cryptocoinjs

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
 */ import { Buffer } from "../buffer.ts";
import { pbkdf2Sync as pbkdf2 } from "./pbkdf2.ts";
const fixOpts = (opts)=>{
  const out = {
    N: 16384,
    p: 1,
    r: 8,
    maxmem: 32 << 20
  };
  if (!opts) return out;
  if (opts.N) out.N = opts.N;
  else if (opts.cost) out.N = opts.cost;
  if (opts.p) out.p = opts.p;
  else if (opts.parallelization) out.p = opts.parallelization;
  if (opts.r) out.r = opts.r;
  else if (opts.blockSize) out.r = opts.blockSize;
  if (opts.maxmem) out.maxmem = opts.maxmem;
  return out;
};
function blockxor(S, Si, D, Di, len) {
  let i = -1;
  while(++i < len)D[Di + i] ^= S[Si + i];
}
function arraycopy(src, srcPos, dest, destPos, length) {
  src.copy(dest, destPos, srcPos, srcPos + length);
}
const R = (a, b)=>a << b | a >>> 32 - b;
class ScryptRom {
  B;
  r;
  N;
  p;
  XY;
  V;
  B32;
  x;
  _X;
  constructor(b, r, N, p){
    this.B = b;
    this.r = r;
    this.N = N;
    this.p = p;
    this.XY = Buffer.allocUnsafe(256 * r);
    this.V = Buffer.allocUnsafe(128 * r * N);
    this.B32 = new Int32Array(16); // salsa20_8
    this.x = new Int32Array(16); // salsa20_8
    this._X = Buffer.allocUnsafe(64); // blockmix_salsa8
  }
  run() {
    const p = this.p | 0;
    const r = this.r | 0;
    for(let i = 0; i < p; i++)this.scryptROMix(i, r);
    return this.B;
  }
  scryptROMix(i, r) {
    const blockStart = i * 128 * r;
    const offset = (2 * r - 1) * 64;
    const blockLen = 128 * r;
    const B = this.B;
    const N = this.N | 0;
    const V = this.V;
    const XY = this.XY;
    B.copy(XY, 0, blockStart, blockStart + blockLen);
    for(let i1 = 0; i1 < N; i1++){
      XY.copy(V, i1 * blockLen, 0, blockLen);
      this.blockmix_salsa8(blockLen);
    }
    let j;
    for(let i2 = 0; i2 < N; i2++){
      j = XY.readUInt32LE(offset) & N - 1;
      blockxor(V, j * blockLen, XY, 0, blockLen);
      this.blockmix_salsa8(blockLen);
    }
    XY.copy(B, blockStart, 0, blockLen);
  }
  blockmix_salsa8(blockLen) {
    const BY = this.XY;
    const r = this.r;
    const _X = this._X;
    arraycopy(BY, (2 * r - 1) * 64, _X, 0, 64);
    let i;
    for(i = 0; i < 2 * r; i++){
      blockxor(BY, i * 64, _X, 0, 64);
      this.salsa20_8();
      arraycopy(_X, 0, BY, blockLen + i * 64, 64);
    }
    for(i = 0; i < r; i++){
      arraycopy(BY, blockLen + i * 2 * 64, BY, i * 64, 64);
      arraycopy(BY, blockLen + (i * 2 + 1) * 64, BY, (i + r) * 64, 64);
    }
  }
  salsa20_8() {
    const B32 = this.B32;
    const B = this._X;
    const x = this.x;
    let i;
    for(i = 0; i < 16; i++){
      B32[i] = (B[i * 4 + 0] & 0xff) << 0;
      B32[i] |= (B[i * 4 + 1] & 0xff) << 8;
      B32[i] |= (B[i * 4 + 2] & 0xff) << 16;
      B32[i] |= (B[i * 4 + 3] & 0xff) << 24;
    }
    for(i = 0; i < 16; i++)x[i] = B32[i];
    for(i = 0; i < 4; i++){
      x[4] ^= R(x[0] + x[12], 7);
      x[8] ^= R(x[4] + x[0], 9);
      x[12] ^= R(x[8] + x[4], 13);
      x[0] ^= R(x[12] + x[8], 18);
      x[9] ^= R(x[5] + x[1], 7);
      x[13] ^= R(x[9] + x[5], 9);
      x[1] ^= R(x[13] + x[9], 13);
      x[5] ^= R(x[1] + x[13], 18);
      x[14] ^= R(x[10] + x[6], 7);
      x[2] ^= R(x[14] + x[10], 9);
      x[6] ^= R(x[2] + x[14], 13);
      x[10] ^= R(x[6] + x[2], 18);
      x[3] ^= R(x[15] + x[11], 7);
      x[7] ^= R(x[3] + x[15], 9);
      x[11] ^= R(x[7] + x[3], 13);
      x[15] ^= R(x[11] + x[7], 18);
      x[1] ^= R(x[0] + x[3], 7);
      x[2] ^= R(x[1] + x[0], 9);
      x[3] ^= R(x[2] + x[1], 13);
      x[0] ^= R(x[3] + x[2], 18);
      x[6] ^= R(x[5] + x[4], 7);
      x[7] ^= R(x[6] + x[5], 9);
      x[4] ^= R(x[7] + x[6], 13);
      x[5] ^= R(x[4] + x[7], 18);
      x[11] ^= R(x[10] + x[9], 7);
      x[8] ^= R(x[11] + x[10], 9);
      x[9] ^= R(x[8] + x[11], 13);
      x[10] ^= R(x[9] + x[8], 18);
      x[12] ^= R(x[15] + x[14], 7);
      x[13] ^= R(x[12] + x[15], 9);
      x[14] ^= R(x[13] + x[12], 13);
      x[15] ^= R(x[14] + x[13], 18);
    }
    for(i = 0; i < 16; i++)B32[i] += x[i];
    let bi;
    for(i = 0; i < 16; i++){
      bi = i * 4;
      B[bi + 0] = B32[i] >> 0 & 0xff;
      B[bi + 1] = B32[i] >> 8 & 0xff;
      B[bi + 2] = B32[i] >> 16 & 0xff;
      B[bi + 3] = B32[i] >> 24 & 0xff;
    }
  }
  clean() {
    this.XY.fill(0);
    this.V.fill(0);
    this._X.fill(0);
    this.B.fill(0);
    for(let i = 0; i < 16; i++){
      this.B32[i] = 0;
      this.x[i] = 0;
    }
  }
}
export function scryptSync(password, salt, keylen, _opts) {
  const { N, r, p, maxmem } = fixOpts(_opts);
  const blen = p * 128 * r;
  if (32 * r * (N + 2) * 4 + blen > maxmem) {
    throw new Error("excedes max memory");
  }
  const b = pbkdf2(password, salt, 1, blen, "sha256");
  const scryptRom = new ScryptRom(b, r, N, p);
  const out = scryptRom.run();
  const fin = pbkdf2(password, out, 1, keylen, "sha256");
  scryptRom.clean();
  return fin;
}
export function scrypt(password, salt, keylen, _opts, cb) {
  if (!cb) {
    cb = _opts;
    _opts = null;
  }
  const { N, r, p, maxmem } = fixOpts(_opts);
  const blen = p * 128 * r;
  if (32 * r * (N + 2) * 4 + blen > maxmem) {
    throw new Error("excedes max memory");
  }
  try {
    const b = pbkdf2(password, salt, 1, blen, "sha256");
    const scryptRom = new ScryptRom(b, r, N, p);
    const out = scryptRom.run();
    const result = pbkdf2(password, out, 1, keylen, "sha256");
    scryptRom.clean();
    cb(null, result);
  } catch (err) {
    return cb(err);
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjEzMi4wL25vZGUvX2NyeXB0by9zY3J5cHQudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbi8qXG5NSVQgTGljZW5zZVxuXG5Db3B5cmlnaHQgKGMpIDIwMTggY3J5cHRvY29pbmpzXG5cblBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhIGNvcHlcbm9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlIFwiU29mdHdhcmVcIiksIHRvIGRlYWxcbmluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmcgd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHNcbnRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCwgZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGxcbmNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXQgcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpc1xuZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgY29uZGl0aW9uczpcblxuVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsXG5jb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuXG5USEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTIE9SXG5JTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSxcbkZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOIE5PIEVWRU5UIFNIQUxMIFRIRVxuQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSwgREFNQUdFUyBPUiBPVEhFUlxuTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUiBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSxcbk9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRSBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFXG5TT0ZUV0FSRS5cbiAqL1xuXG5pbXBvcnQgeyBCdWZmZXIgfSBmcm9tIFwiLi4vYnVmZmVyLnRzXCI7XG5pbXBvcnQgeyBwYmtkZjJTeW5jIGFzIHBia2RmMiB9IGZyb20gXCIuL3Bia2RmMi50c1wiO1xuaW1wb3J0IHsgSEFTSF9EQVRBIH0gZnJvbSBcIi4vdHlwZXMudHNcIjtcblxudHlwZSBPcHRzID0gUGFydGlhbDx7XG4gIE46IG51bWJlcjtcbiAgY29zdDogbnVtYmVyO1xuICBwOiBudW1iZXI7XG4gIHBhcmFsbGVsaXphdGlvbjogbnVtYmVyO1xuICByOiBudW1iZXI7XG4gIGJsb2NrU2l6ZTogbnVtYmVyO1xuICBtYXhtZW06IG51bWJlcjtcbn0+O1xuXG5jb25zdCBmaXhPcHRzID0gKG9wdHM/OiBPcHRzKSA9PiB7XG4gIGNvbnN0IG91dCA9IHsgTjogMTYzODQsIHA6IDEsIHI6IDgsIG1heG1lbTogMzIgPDwgMjAgfTtcbiAgaWYgKCFvcHRzKSByZXR1cm4gb3V0O1xuXG4gIGlmIChvcHRzLk4pIG91dC5OID0gb3B0cy5OO1xuICBlbHNlIGlmIChvcHRzLmNvc3QpIG91dC5OID0gb3B0cy5jb3N0O1xuXG4gIGlmIChvcHRzLnApIG91dC5wID0gb3B0cy5wO1xuICBlbHNlIGlmIChvcHRzLnBhcmFsbGVsaXphdGlvbikgb3V0LnAgPSBvcHRzLnBhcmFsbGVsaXphdGlvbjtcblxuICBpZiAob3B0cy5yKSBvdXQuciA9IG9wdHMucjtcbiAgZWxzZSBpZiAob3B0cy5ibG9ja1NpemUpIG91dC5yID0gb3B0cy5ibG9ja1NpemU7XG5cbiAgaWYgKG9wdHMubWF4bWVtKSBvdXQubWF4bWVtID0gb3B0cy5tYXhtZW07XG5cbiAgcmV0dXJuIG91dDtcbn07XG5cbmZ1bmN0aW9uIGJsb2NreG9yKFM6IEJ1ZmZlciwgU2k6IG51bWJlciwgRDogQnVmZmVyLCBEaTogbnVtYmVyLCBsZW46IG51bWJlcikge1xuICBsZXQgaSA9IC0xO1xuICB3aGlsZSAoKytpIDwgbGVuKSBEW0RpICsgaV0gXj0gU1tTaSArIGldO1xufVxuZnVuY3Rpb24gYXJyYXljb3B5KFxuICBzcmM6IEJ1ZmZlcixcbiAgc3JjUG9zOiBudW1iZXIsXG4gIGRlc3Q6IEJ1ZmZlcixcbiAgZGVzdFBvczogbnVtYmVyLFxuICBsZW5ndGg6IG51bWJlcixcbikge1xuICBzcmMuY29weShkZXN0LCBkZXN0UG9zLCBzcmNQb3MsIHNyY1BvcyArIGxlbmd0aCk7XG59XG5cbmNvbnN0IFIgPSAoYTogbnVtYmVyLCBiOiBudW1iZXIpID0+IChhIDw8IGIpIHwgKGEgPj4+ICgzMiAtIGIpKTtcblxuY2xhc3MgU2NyeXB0Um9tIHtcbiAgQjogQnVmZmVyO1xuICByOiBudW1iZXI7XG4gIE46IG51bWJlcjtcbiAgcDogbnVtYmVyO1xuICBYWTogQnVmZmVyO1xuICBWOiBCdWZmZXI7XG4gIEIzMjogSW50MzJBcnJheTtcbiAgeDogSW50MzJBcnJheTtcbiAgX1g6IEJ1ZmZlcjtcbiAgY29uc3RydWN0b3IoYjogQnVmZmVyLCByOiBudW1iZXIsIE46IG51bWJlciwgcDogbnVtYmVyKSB7XG4gICAgdGhpcy5CID0gYjtcbiAgICB0aGlzLnIgPSByO1xuICAgIHRoaXMuTiA9IE47XG4gICAgdGhpcy5wID0gcDtcbiAgICB0aGlzLlhZID0gQnVmZmVyLmFsbG9jVW5zYWZlKDI1NiAqIHIpO1xuICAgIHRoaXMuViA9IEJ1ZmZlci5hbGxvY1Vuc2FmZSgxMjggKiByICogTik7XG4gICAgdGhpcy5CMzIgPSBuZXcgSW50MzJBcnJheSgxNik7IC8vIHNhbHNhMjBfOFxuICAgIHRoaXMueCA9IG5ldyBJbnQzMkFycmF5KDE2KTsgLy8gc2Fsc2EyMF84XG4gICAgdGhpcy5fWCA9IEJ1ZmZlci5hbGxvY1Vuc2FmZSg2NCk7IC8vIGJsb2NrbWl4X3NhbHNhOFxuICB9XG5cbiAgcnVuKCkge1xuICAgIGNvbnN0IHAgPSB0aGlzLnAgfCAwO1xuICAgIGNvbnN0IHIgPSB0aGlzLnIgfCAwO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcDsgaSsrKSB0aGlzLnNjcnlwdFJPTWl4KGksIHIpO1xuXG4gICAgcmV0dXJuIHRoaXMuQjtcbiAgfVxuXG4gIHNjcnlwdFJPTWl4KGk6IG51bWJlciwgcjogbnVtYmVyKSB7XG4gICAgY29uc3QgYmxvY2tTdGFydCA9IGkgKiAxMjggKiByO1xuICAgIGNvbnN0IG9mZnNldCA9ICgyICogciAtIDEpICogNjQ7XG4gICAgY29uc3QgYmxvY2tMZW4gPSAxMjggKiByO1xuICAgIGNvbnN0IEIgPSB0aGlzLkI7XG4gICAgY29uc3QgTiA9IHRoaXMuTiB8IDA7XG4gICAgY29uc3QgViA9IHRoaXMuVjtcbiAgICBjb25zdCBYWSA9IHRoaXMuWFk7XG4gICAgQi5jb3B5KFhZLCAwLCBibG9ja1N0YXJ0LCBibG9ja1N0YXJ0ICsgYmxvY2tMZW4pO1xuICAgIGZvciAobGV0IGkxID0gMDsgaTEgPCBOOyBpMSsrKSB7XG4gICAgICBYWS5jb3B5KFYsIGkxICogYmxvY2tMZW4sIDAsIGJsb2NrTGVuKTtcbiAgICAgIHRoaXMuYmxvY2ttaXhfc2Fsc2E4KGJsb2NrTGVuKTtcbiAgICB9XG5cbiAgICBsZXQgajogbnVtYmVyO1xuICAgIGZvciAobGV0IGkyID0gMDsgaTIgPCBOOyBpMisrKSB7XG4gICAgICBqID0gWFkucmVhZFVJbnQzMkxFKG9mZnNldCkgJiAoTiAtIDEpO1xuICAgICAgYmxvY2t4b3IoViwgaiAqIGJsb2NrTGVuLCBYWSwgMCwgYmxvY2tMZW4pO1xuICAgICAgdGhpcy5ibG9ja21peF9zYWxzYTgoYmxvY2tMZW4pO1xuICAgIH1cbiAgICBYWS5jb3B5KEIsIGJsb2NrU3RhcnQsIDAsIGJsb2NrTGVuKTtcbiAgfVxuXG4gIGJsb2NrbWl4X3NhbHNhOChibG9ja0xlbjogbnVtYmVyKSB7XG4gICAgY29uc3QgQlkgPSB0aGlzLlhZO1xuICAgIGNvbnN0IHIgPSB0aGlzLnI7XG4gICAgY29uc3QgX1ggPSB0aGlzLl9YO1xuICAgIGFycmF5Y29weShCWSwgKDIgKiByIC0gMSkgKiA2NCwgX1gsIDAsIDY0KTtcbiAgICBsZXQgaTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgMiAqIHI7IGkrKykge1xuICAgICAgYmxvY2t4b3IoQlksIGkgKiA2NCwgX1gsIDAsIDY0KTtcbiAgICAgIHRoaXMuc2Fsc2EyMF84KCk7XG4gICAgICBhcnJheWNvcHkoX1gsIDAsIEJZLCBibG9ja0xlbiArIGkgKiA2NCwgNjQpO1xuICAgIH1cbiAgICBmb3IgKGkgPSAwOyBpIDwgcjsgaSsrKSB7XG4gICAgICBhcnJheWNvcHkoQlksIGJsb2NrTGVuICsgaSAqIDIgKiA2NCwgQlksIGkgKiA2NCwgNjQpO1xuICAgICAgYXJyYXljb3B5KEJZLCBibG9ja0xlbiArIChpICogMiArIDEpICogNjQsIEJZLCAoaSArIHIpICogNjQsIDY0KTtcbiAgICB9XG4gIH1cblxuICBzYWxzYTIwXzgoKSB7XG4gICAgY29uc3QgQjMyID0gdGhpcy5CMzI7XG4gICAgY29uc3QgQiA9IHRoaXMuX1g7XG4gICAgY29uc3QgeCA9IHRoaXMueDtcblxuICAgIGxldCBpO1xuICAgIGZvciAoaSA9IDA7IGkgPCAxNjsgaSsrKSB7XG4gICAgICBCMzJbaV0gPSAoQltpICogNCArIDBdICYgMHhmZikgPDwgMDtcbiAgICAgIEIzMltpXSB8PSAoQltpICogNCArIDFdICYgMHhmZikgPDwgODtcbiAgICAgIEIzMltpXSB8PSAoQltpICogNCArIDJdICYgMHhmZikgPDwgMTY7XG4gICAgICBCMzJbaV0gfD0gKEJbaSAqIDQgKyAzXSAmIDB4ZmYpIDw8IDI0O1xuICAgIH1cblxuICAgIGZvciAoaSA9IDA7IGkgPCAxNjsgaSsrKSB4W2ldID0gQjMyW2ldO1xuXG4gICAgZm9yIChpID0gMDsgaSA8IDQ7IGkrKykge1xuICAgICAgeFs0XSBePSBSKHhbMF0gKyB4WzEyXSwgNyk7XG4gICAgICB4WzhdIF49IFIoeFs0XSArIHhbMF0sIDkpO1xuICAgICAgeFsxMl0gXj0gUih4WzhdICsgeFs0XSwgMTMpO1xuICAgICAgeFswXSBePSBSKHhbMTJdICsgeFs4XSwgMTgpO1xuICAgICAgeFs5XSBePSBSKHhbNV0gKyB4WzFdLCA3KTtcbiAgICAgIHhbMTNdIF49IFIoeFs5XSArIHhbNV0sIDkpO1xuICAgICAgeFsxXSBePSBSKHhbMTNdICsgeFs5XSwgMTMpO1xuICAgICAgeFs1XSBePSBSKHhbMV0gKyB4WzEzXSwgMTgpO1xuICAgICAgeFsxNF0gXj0gUih4WzEwXSArIHhbNl0sIDcpO1xuICAgICAgeFsyXSBePSBSKHhbMTRdICsgeFsxMF0sIDkpO1xuICAgICAgeFs2XSBePSBSKHhbMl0gKyB4WzE0XSwgMTMpO1xuICAgICAgeFsxMF0gXj0gUih4WzZdICsgeFsyXSwgMTgpO1xuICAgICAgeFszXSBePSBSKHhbMTVdICsgeFsxMV0sIDcpO1xuICAgICAgeFs3XSBePSBSKHhbM10gKyB4WzE1XSwgOSk7XG4gICAgICB4WzExXSBePSBSKHhbN10gKyB4WzNdLCAxMyk7XG4gICAgICB4WzE1XSBePSBSKHhbMTFdICsgeFs3XSwgMTgpO1xuICAgICAgeFsxXSBePSBSKHhbMF0gKyB4WzNdLCA3KTtcbiAgICAgIHhbMl0gXj0gUih4WzFdICsgeFswXSwgOSk7XG4gICAgICB4WzNdIF49IFIoeFsyXSArIHhbMV0sIDEzKTtcbiAgICAgIHhbMF0gXj0gUih4WzNdICsgeFsyXSwgMTgpO1xuICAgICAgeFs2XSBePSBSKHhbNV0gKyB4WzRdLCA3KTtcbiAgICAgIHhbN10gXj0gUih4WzZdICsgeFs1XSwgOSk7XG4gICAgICB4WzRdIF49IFIoeFs3XSArIHhbNl0sIDEzKTtcbiAgICAgIHhbNV0gXj0gUih4WzRdICsgeFs3XSwgMTgpO1xuICAgICAgeFsxMV0gXj0gUih4WzEwXSArIHhbOV0sIDcpO1xuICAgICAgeFs4XSBePSBSKHhbMTFdICsgeFsxMF0sIDkpO1xuICAgICAgeFs5XSBePSBSKHhbOF0gKyB4WzExXSwgMTMpO1xuICAgICAgeFsxMF0gXj0gUih4WzldICsgeFs4XSwgMTgpO1xuICAgICAgeFsxMl0gXj0gUih4WzE1XSArIHhbMTRdLCA3KTtcbiAgICAgIHhbMTNdIF49IFIoeFsxMl0gKyB4WzE1XSwgOSk7XG4gICAgICB4WzE0XSBePSBSKHhbMTNdICsgeFsxMl0sIDEzKTtcbiAgICAgIHhbMTVdIF49IFIoeFsxNF0gKyB4WzEzXSwgMTgpO1xuICAgIH1cbiAgICBmb3IgKGkgPSAwOyBpIDwgMTY7IGkrKykgQjMyW2ldICs9IHhbaV07XG5cbiAgICBsZXQgYmk7XG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgMTY7IGkrKykge1xuICAgICAgYmkgPSBpICogNDtcbiAgICAgIEJbYmkgKyAwXSA9IChCMzJbaV0gPj4gMCkgJiAweGZmO1xuICAgICAgQltiaSArIDFdID0gKEIzMltpXSA+PiA4KSAmIDB4ZmY7XG4gICAgICBCW2JpICsgMl0gPSAoQjMyW2ldID4+IDE2KSAmIDB4ZmY7XG4gICAgICBCW2JpICsgM10gPSAoQjMyW2ldID4+IDI0KSAmIDB4ZmY7XG4gICAgfVxuICB9XG5cbiAgY2xlYW4oKSB7XG4gICAgdGhpcy5YWS5maWxsKDApO1xuICAgIHRoaXMuVi5maWxsKDApO1xuICAgIHRoaXMuX1guZmlsbCgwKTtcbiAgICB0aGlzLkIuZmlsbCgwKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IDE2OyBpKyspIHtcbiAgICAgIHRoaXMuQjMyW2ldID0gMDtcbiAgICAgIHRoaXMueFtpXSA9IDA7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzY3J5cHRTeW5jKFxuICBwYXNzd29yZDogSEFTSF9EQVRBLFxuICBzYWx0OiBIQVNIX0RBVEEsXG4gIGtleWxlbjogbnVtYmVyLFxuICBfb3B0cz86IE9wdHMsXG4pOiBCdWZmZXIge1xuICBjb25zdCB7IE4sIHIsIHAsIG1heG1lbSB9ID0gZml4T3B0cyhfb3B0cyk7XG5cbiAgY29uc3QgYmxlbiA9IHAgKiAxMjggKiByO1xuXG4gIGlmICgzMiAqIHIgKiAoTiArIDIpICogNCArIGJsZW4gPiBtYXhtZW0pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJleGNlZGVzIG1heCBtZW1vcnlcIik7XG4gIH1cblxuICBjb25zdCBiID0gcGJrZGYyKHBhc3N3b3JkLCBzYWx0LCAxLCBibGVuLCBcInNoYTI1NlwiKTtcblxuICBjb25zdCBzY3J5cHRSb20gPSBuZXcgU2NyeXB0Um9tKGIsIHIsIE4sIHApO1xuICBjb25zdCBvdXQgPSBzY3J5cHRSb20ucnVuKCk7XG5cbiAgY29uc3QgZmluID0gcGJrZGYyKHBhc3N3b3JkLCBvdXQsIDEsIGtleWxlbiwgXCJzaGEyNTZcIik7XG4gIHNjcnlwdFJvbS5jbGVhbigpO1xuICByZXR1cm4gZmluO1xufVxuXG50eXBlIENhbGxiYWNrID0gKGVycjogdW5rbm93biwgcmVzdWx0PzogQnVmZmVyKSA9PiB2b2lkO1xuXG5leHBvcnQgZnVuY3Rpb24gc2NyeXB0KFxuICBwYXNzd29yZDogSEFTSF9EQVRBLFxuICBzYWx0OiBIQVNIX0RBVEEsXG4gIGtleWxlbjogbnVtYmVyLFxuICBfb3B0czogT3B0cyB8IG51bGwgfCBDYWxsYmFjayxcbiAgY2I/OiBDYWxsYmFjayxcbikge1xuICBpZiAoIWNiKSB7XG4gICAgY2IgPSBfb3B0cyBhcyBDYWxsYmFjaztcbiAgICBfb3B0cyA9IG51bGw7XG4gIH1cbiAgY29uc3QgeyBOLCByLCBwLCBtYXhtZW0gfSA9IGZpeE9wdHMoX29wdHMgYXMgT3B0cyk7XG5cbiAgY29uc3QgYmxlbiA9IHAgKiAxMjggKiByO1xuICBpZiAoMzIgKiByICogKE4gKyAyKSAqIDQgKyBibGVuID4gbWF4bWVtKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiZXhjZWRlcyBtYXggbWVtb3J5XCIpO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBjb25zdCBiID0gcGJrZGYyKHBhc3N3b3JkLCBzYWx0LCAxLCBibGVuLCBcInNoYTI1NlwiKTtcblxuICAgIGNvbnN0IHNjcnlwdFJvbSA9IG5ldyBTY3J5cHRSb20oYiwgciwgTiwgcCk7XG4gICAgY29uc3Qgb3V0ID0gc2NyeXB0Um9tLnJ1bigpO1xuICAgIGNvbnN0IHJlc3VsdCA9IHBia2RmMihwYXNzd29yZCwgb3V0LCAxLCBrZXlsZW4sIFwic2hhMjU2XCIpO1xuICAgIHNjcnlwdFJvbS5jbGVhbigpO1xuICAgIGNiKG51bGwsIHJlc3VsdCk7XG4gIH0gY2F0Y2ggKGVycjogdW5rbm93bikge1xuICAgIHJldHVybiBjYihlcnIpO1xuICB9XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBQzFFOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBc0JDLEdBRUQsU0FBUyxNQUFNLFFBQVEsZUFBZTtBQUN0QyxTQUFTLGNBQWMsTUFBTSxRQUFRLGNBQWM7QUFhbkQsTUFBTSxVQUFVLENBQUM7RUFDZixNQUFNLE1BQU07SUFBRSxHQUFHO0lBQU8sR0FBRztJQUFHLEdBQUc7SUFBRyxRQUFRLE1BQU07RUFBRztFQUNyRCxJQUFJLENBQUMsTUFBTSxPQUFPO0VBRWxCLElBQUksS0FBSyxDQUFDLEVBQUUsSUFBSSxDQUFDLEdBQUcsS0FBSyxDQUFDO09BQ3JCLElBQUksS0FBSyxJQUFJLEVBQUUsSUFBSSxDQUFDLEdBQUcsS0FBSyxJQUFJO0VBRXJDLElBQUksS0FBSyxDQUFDLEVBQUUsSUFBSSxDQUFDLEdBQUcsS0FBSyxDQUFDO09BQ3JCLElBQUksS0FBSyxlQUFlLEVBQUUsSUFBSSxDQUFDLEdB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RyxJQUFJLEtBQUs7SUFDckM7SUFFQSxJQUFLLElBQUksR0FBRyxJQUFJLElBQUksSUFBSyxDQUFDLENBQUMsRUFBRSxHQUFHLEdBQUcsQ0FBQyxFQUFFO0lBRXRDLElBQUssSUFBSSxHQUFHLElBQUksR0FBRyxJQUFLO01BQ3RCLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUU7TUFDeEIsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRTtNQUN2QixDQUFDLENBQUMsR0FBRyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFO01BQ3hCLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUU7TUFDeEIsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRTtNQUN2QixDQUFDLENBQUMsR0FBRyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFO01BQ3hCLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUU7TUFDeEIsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRTtNQUN4QixDQUFDLENBQUMsR0FBRyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFO01BQ3pCLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUU7TUFDekIsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRTtNQUN4QixDQUFDLENBQUMsR0FBRyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFO01BQ3hCLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUU7TUFDekIsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRTtNQUN4QixDQUFDLENBQUMsR0FBRyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFO01BQ3hCLENBQUMsQ0FBQyxHQUFHLElBQUksRUFBRSxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUU7TUFDekIsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRTtNQUN2QixDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFO01BQ3ZCLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUU7TUFDdkIsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRTtNQUN2QixDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFO01BQ3ZCLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUU7TUFDdkIsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRTtNQUN2QixDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFO01BQ3ZCLENBQUMsQ0FBQyxHQUFHLElBQUksRUFBRSxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUU7TUFDekIsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRTtNQUN6QixDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsR0FBRyxFQUFFO01BQ3hCLENBQUMsQ0FBQyxHQUFHLElBQUksRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUU7TUFDeEIsQ0FBQyxDQUFDLEdBQUcsSUFBSSxFQUFFLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRTtNQUMxQixDQUFDLENBQUMsR0FBRyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsR0FBRyxFQUFFO01BQzFCLENBQUMsQ0FBQyxHQUFHLElBQUksRUFBRSxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUU7TUFDMUIsQ0FBQyxDQUFDLEdBQUcsSUFBSSxFQUFFLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRTtJQUM1QjtJQUNBLElBQUssSUFBSSxHQUFHLElBQUksSUFBSSxJQUFLLEdBQUcsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUU7SUFFdkMsSUFBSTtJQUVKLElBQUssSUFBSSxHQUFHLElBQUksSUFBSSxJQUFLO01BQ3ZCLEtBQUssSUFBSTtNQUNULENBQUMsQ0FBQyxLQUFLLEVBQUUsR0FBRyxBQUFDLEdBQUcsQ0FBQyxFQUFFLElBQUksSUFBSztNQUM1QixDQUFDLENBQUMsS0FBSyxFQUFFLEdBQUcsQUFBQyxHQUFHLENBQUMsRUFBRSxJQUFJLElBQUs7TUFDNUIsQ0FBQyxDQUFDLEtBQUssRUFBRSxHQUFHLEFBQUMsR0FBRyxDQUFDLEVBQUUsSUFBSSxLQUFNO01BQzdCLENBQUMsQ0FBQyxLQUFLLEVBQUUsR0FBRyxBQUFDLEdBQUcsQ0FBQyxFQUFFLElBQUksS0FBTTtJQUMvQjtFQUNGO0VBRUEsUUFBUTtJQUNOLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDO0lBQ2IsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7SUFDWixJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQztJQUNiLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO0lBQ1osSUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLElBQUksSUFBSztNQUMzQixJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRztNQUNkLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHO0lBQ2Q7RUFDRjtBQUNGO0FBRUEsT0FBTyxTQUFTLFdBQ2QsUUFBbUIsRUFDbkIsSUFBZSxFQUNmLE1BQWMsRUFDZCxLQUFZO0VBRVosTUFBTSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxHQUFHLFFBQVE7RUFFcEMsTUFBTSxPQUFPLElBQUksTUFBTTtFQUV2QixJQUFJLEtBQUssSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLElBQUksT0FBTyxRQUFRO0lBQ3hDLE1BQU0sSUFBSSxNQUFNO0VBQ2xCO0VBRUEsTUFBTSxJQUFJLE9BQU8sVUFBVSxNQUFNLEdBQUcsTUFBTTtFQUUxQyxNQUFNLFlBQVksSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHO0VBQ3pDLE1BQU0sTUFBTSxVQUFVLEdBQUc7RUFFekIsTUFBTSxNQUFNLE9BQU8sVUFBVSxLQUFLLEdBQUcsUUFBUTtFQUM3QyxVQUFVLEtBQUs7RUFDZixPQUFPO0FBQ1Q7QUFJQSxPQUFPLFNBQVMsT0FDZCxRQUFtQixFQUNuQixJQUFlLEVBQ2YsTUFBYyxFQUNkLEtBQTZCLEVBQzdCLEVBQWE7RUFFYixJQUFJLENBQUMsSUFBSTtJQUNQLEtBQUs7SUFDTCxRQUFRO0VBQ1Y7RUFDQSxNQUFNLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLEdBQUcsUUFBUTtFQUVwQyxNQUFNLE9BQU8sSUFBSSxNQUFNO0VBQ3ZCLElBQUksS0FBSyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxPQUFPLFFBQVE7SUFDeEMsTUFBTSxJQUFJLE1BQU07RUFDbEI7RUFFQSxJQUFJO0lBQ0YsTUFBTSxJQUFJLE9BQU8sVUFBVSxNQUFNLEdBQUcsTUFBTTtJQUUxQyxNQUFNLFlBQVksSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHO0lBQ3pDLE1BQU0sTUFBTSxVQUFVLEdBQUc7SUFDekIsTUFBTSxTQUFTLE9BQU8sVUFBVSxLQUFLLEdBQUcsUUFBUTtJQUNoRCxVQUFVLEtBQUs7SUFDZixHQUFHLE1BQU07RUFDWCxFQUFFLE9BQU8sS0FBYztJQUNyQixPQUFPLEdBQUc7RUFDWjtBQUNGIn0=