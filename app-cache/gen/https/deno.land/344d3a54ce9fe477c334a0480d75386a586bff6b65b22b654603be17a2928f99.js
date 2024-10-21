// Copyright 2009 The Go Authors. All rights reserved.
// https://github.com/golang/go/blob/master/LICENSE
// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
/** Port of the Go
 * [encoding/hex](https://github.com/golang/go/blob/go1.12.5/src/encoding/hex/hex.go)
 * library.
 *
 * This module is browser compatible.
 *
 * @module
 */ const hexTable = new TextEncoder().encode("0123456789abcdef");
function errInvalidByte(byte) {
  return new TypeError(`Invalid byte '${String.fromCharCode(byte)}'`);
}
function errLength() {
  return new RangeError("Odd length hex string");
}
/** Converts a hex character into its value. */ function fromHexChar(byte) {
  // '0' <= byte && byte <= '9'
  if (48 <= byte && byte <= 57) return byte - 48;
  // 'a' <= byte && byte <= 'f'
  if (97 <= byte && byte <= 102) return byte - 97 + 10;
  // 'A' <= byte && byte <= 'F'
  if (65 <= byte && byte <= 70) return byte - 65 + 10;
  throw errInvalidByte(byte);
}
/** Encodes `src` into `src.length * 2` bytes. */ export function encode(src) {
  const dst = new Uint8Array(src.length * 2);
  for(let i = 0; i < dst.length; i++){
    const v = src[i];
    dst[i * 2] = hexTable[v >> 4];
    dst[i * 2 + 1] = hexTable[v & 0x0f];
  }
  return dst;
}
/**
 * Decodes `src` into `src.length / 2` bytes.
 * If the input is malformed, an error will be thrown.
 */ export function decode(src) {
  const dst = new Uint8Array(src.length / 2);
  for(let i = 0; i < dst.length; i++){
    const a = fromHexChar(src[i * 2]);
    const b = fromHexChar(src[i * 2 + 1]);
    dst[i] = a << 4 | b;
  }
  if (src.length % 2 == 1) {
    // Check for invalid char before reporting bad length,
    // since the invalid char (if present) is an earlier problem.
    fromHexChar(src[dst.length * 2]);
    throw errLength();
  }
  return dst;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2MC4wL2VuY29kaW5nL2hleC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAwOSBUaGUgR28gQXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbi8vIGh0dHBzOi8vZ2l0aHViLmNvbS9nb2xhbmcvZ28vYmxvYi9tYXN0ZXIvTElDRU5TRVxuLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cblxuLyoqIFBvcnQgb2YgdGhlIEdvXG4gKiBbZW5jb2RpbmcvaGV4XShodHRwczovL2dpdGh1Yi5jb20vZ29sYW5nL2dvL2Jsb2IvZ28xLjEyLjUvc3JjL2VuY29kaW5nL2hleC9oZXguZ28pXG4gKiBsaWJyYXJ5LlxuICpcbiAqIFRoaXMgbW9kdWxlIGlzIGJyb3dzZXIgY29tcGF0aWJsZS5cbiAqXG4gKiBAbW9kdWxlXG4gKi9cblxuY29uc3QgaGV4VGFibGUgPSBuZXcgVGV4dEVuY29kZXIoKS5lbmNvZGUoXCIwMTIzNDU2Nzg5YWJjZGVmXCIpO1xuXG5mdW5jdGlvbiBlcnJJbnZhbGlkQnl0ZShieXRlOiBudW1iZXIpIHtcbiAgcmV0dXJuIG5ldyBUeXBlRXJyb3IoYEludmFsaWQgYnl0ZSAnJHtTdHJpbmcuZnJvbUNoYXJDb2RlKGJ5dGUpfSdgKTtcbn1cblxuZnVuY3Rpb24gZXJyTGVuZ3RoKCkge1xuICByZXR1cm4gbmV3IFJhbmdlRXJyb3IoXCJPZGQgbGVuZ3RoIGhleCBzdHJpbmdcIik7XG59XG5cbi8qKiBDb252ZXJ0cyBhIGhleCBjaGFyYWN0ZXIgaW50byBpdHMgdmFsdWUuICovXG5mdW5jdGlvbiBmcm9tSGV4Q2hhcihieXRlOiBudW1iZXIpOiBudW1iZXIge1xuICAvLyAnMCcgPD0gYnl0ZSAmJiBieXRlIDw9ICc5J1xuICBpZiAoNDggPD0gYnl0ZSAmJiBieXRlIDw9IDU3KSByZXR1cm4gYnl0ZSAtIDQ4O1xuICAvLyAnYScgPD0gYnl0ZSAmJiBieXRlIDw9ICdmJ1xuICBpZiAoOTcgPD0gYnl0ZSAmJiBieXRlIDw9IDEwMikgcmV0dXJuIGJ5dGUgLSA5NyArIDEwO1xuICAvLyAnQScgPD0gYnl0ZSAmJiBieXRlIDw9ICdGJ1xuICBpZiAoNjUgPD0gYnl0ZSAmJiBieXRlIDw9IDcwKSByZXR1cm4gYnl0ZSAtIDY1ICsgMTA7XG5cbiAgdGhyb3cgZXJySW52YWxpZEJ5dGUoYnl0ZSk7XG59XG5cbi8qKiBFbmNvZGVzIGBzcmNgIGludG8gYHNyYy5sZW5ndGggKiAyYCBieXRlcy4gKi9cbmV4cG9ydCBmdW5jdGlvbiBlbmNvZGUoc3JjOiBVaW50OEFycmF5KTogVWludDhBcnJheSB7XG4gIGNvbnN0IGRzdCA9IG5ldyBVaW50OEFycmF5KHNyYy5sZW5ndGggKiAyKTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBkc3QubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCB2ID0gc3JjW2ldO1xuICAgIGRzdFtpICogMl0gPSBoZXhUYWJsZVt2ID4+IDRdO1xuICAgIGRzdFtpICogMiArIDFdID0gaGV4VGFibGVbdiAmIDB4MGZdO1xuICB9XG4gIHJldHVybiBkc3Q7XG59XG5cbi8qKlxuICogRGVjb2RlcyBgc3JjYCBpbnRvIGBzcmMubGVuZ3RoIC8gMmAgYnl0ZXMuXG4gKiBJZiB0aGUgaW5wdXQgaXMgbWFsZm9ybWVkLCBhbiBlcnJvciB3aWxsIGJlIHRocm93bi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRlY29kZShzcmM6IFVpbnQ4QXJyYXkpOiBVaW50OEFycmF5IHtcbiAgY29uc3QgZHN0ID0gbmV3IFVpbnQ4QXJyYXkoc3JjLmxlbmd0aCAvIDIpO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGRzdC5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGEgPSBmcm9tSGV4Q2hhcihzcmNbaSAqIDJdKTtcbiAgICBjb25zdCBiID0gZnJvbUhleENoYXIoc3JjW2kgKiAyICsgMV0pO1xuICAgIGRzdFtpXSA9IChhIDw8IDQpIHwgYjtcbiAgfVxuXG4gIGlmIChzcmMubGVuZ3RoICUgMiA9PSAxKSB7XG4gICAgLy8gQ2hlY2sgZm9yIGludmFsaWQgY2hhciBiZWZvcmUgcmVwb3J0aW5nIGJhZCBsZW5ndGgsXG4gICAgLy8gc2luY2UgdGhlIGludmFsaWQgY2hhciAoaWYgcHJlc2VudCkgaXMgYW4gZWFybGllciBwcm9ibGVtLlxuICAgIGZyb21IZXhDaGFyKHNyY1tkc3QubGVuZ3RoICogMl0pO1xuICAgIHRocm93IGVyckxlbmd0aCgpO1xuICB9XG5cbiAgcmV0dXJuIGRzdDtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxzREFBc0Q7QUFDdEQsbURBQW1EO0FBQ25ELDBFQUEwRTtBQUUxRTs7Ozs7OztDQU9DLEdBRUQsTUFBTSxXQUFXLElBQUksY0FBYyxNQUFNLENBQUM7QUFFMUMsU0FBUyxlQUFlLElBQVk7RUFDbEMsT0FBTyxJQUFJLFVBQVUsQ0FBQyxjQUFjLEVBQUUsT0FBTyxZQUFZLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDcEU7QUFFQSxTQUFTO0VBQ1AsT0FBTyxJQUFJLFdBQVc7QUFDeEI7QUFFQSw2Q0FBNkMsR0FDN0MsU0FBUyxZQUFZLElBQVk7RUFDL0IsNkJBQTZCO0VBQzdCLElBQUksTUFBTSxRQUFRLFFBQVEsSUFBSSxPQUFPLE9BQU87RUFDNUMsNkJBQTZCO0VBQzdCLElBQUksTUFBTSxRQUFRLFFBQVEsS0FBSyxPQUFPLE9BQU8sS0FBSztFQUNsRCw2QkFBNkI7RUFDN0IsSUFBSSxNQUFNLFFBQVEsUUFBUSxJQUFJLE9BQU8sT0FBTyxLQUFLO0VBRWpELE1BQU0sZUFBZTtBQUN2QjtBQUVBLCtDQUErQyxHQUMvQyxPQUFPLFNBQVMsT0FBTyxHQUFlO0VBQ3BDLE1BQU0sTUFBTSxJQUFJLFdBQVcsSUFBSSxNQUFNLEdBQUc7RUFDeEMsSUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLElBQUksTUFBTSxFQUFFLElBQUs7SUFDbkMsTUFBTSxJQUFJLEdBQUcsQ0FBQyxFQUFFO0lBQ2hCLEdBQUcsQ0FBQyxJQUFJLEVBQUUsR0FBRyxRQUFRLENBQUMsS0FBSyxFQUFFO0lBQzdCLEdBQUcsQ0FBQyxJQUFJLElBQUksRUFBRSxHQUFHLFFBQVEsQ0FBQyxJQUFJLEtBQUs7RUFDckM7RUFDQSxPQUFPO0FBQ1Q7QUFFQTs7O0NBR0MsR0FDRCxPQUFPLFNBQVMsT0FBTyxHQUFlO0VBQ3BDLE1BQU0sTUFBTSxJQUFJLFdBQVcsSUFBSSxNQUFNLEdBQUc7RUFDeEMsSUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLElBQUksTUFBTSxFQUFFLElBQUs7SUFDbkMsTUFBTSxJQUFJLFlBQVksR0FBRyxDQUFDLElBQUksRUFBRTtJQUNoQyxNQUFNLElBQUksWUFBWSxHQUFHLENBQUMsSUFBSSxJQUFJLEVBQUU7SUFDcEMsR0FBRyxDQUFDLEVBQUUsR0FBRyxBQUFDLEtBQUssSUFBSztFQUN0QjtFQUVBLElBQUksSUFBSSxNQUFNLEdBQUcsS0FBSyxHQUFHO0lBQ3ZCLHNEQUFzRDtJQUN0RCw2REFBNkQ7SUFDN0QsWUFBWSxHQUFHLENBQUMsSUFBSSxNQUFNLEdBQUcsRUFBRTtJQUMvQixNQUFNO0VBQ1I7RUFFQSxPQUFPO0FBQ1QifQ==