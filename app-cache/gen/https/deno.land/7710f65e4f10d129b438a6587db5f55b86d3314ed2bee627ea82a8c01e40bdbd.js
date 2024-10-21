// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
import { bgGreen, bgRed, bold, gray, green, red, white } from "../fmt/colors.ts";
export var DiffType;
(function(DiffType) {
  DiffType["removed"] = "removed";
  DiffType["common"] = "common";
  DiffType["added"] = "added";
})(DiffType || (DiffType = {}));
const REMOVED = 1;
const COMMON = 2;
const ADDED = 3;
function createCommon(A, B, reverse) {
  const common = [];
  if (A.length === 0 || B.length === 0) return [];
  for(let i = 0; i < Math.min(A.length, B.length); i += 1){
    if (A[reverse ? A.length - i - 1 : i] === B[reverse ? B.length - i - 1 : i]) {
      common.push(A[reverse ? A.length - i - 1 : i]);
    } else {
      return common;
    }
  }
  return common;
}
/**
 * Renders the differences between the actual and expected values
 * @param A Actual value
 * @param B Expected value
 */ export function diff(A, B) {
  const prefixCommon = createCommon(A, B);
  const suffixCommon = createCommon(A.slice(prefixCommon.length), B.slice(prefixCommon.length), true).reverse();
  A = suffixCommon.length ? A.slice(prefixCommon.length, -suffixCommon.length) : A.slice(prefixCommon.length);
  B = suffixCommon.length ? B.slice(prefixCommon.length, -suffixCommon.length) : B.slice(prefixCommon.length);
  const swapped = B.length > A.length;
  [A, B] = swapped ? [
    B,
    A
  ] : [
    A,
    B
  ];
  const M = A.length;
  const N = B.length;
  if (!M && !N && !suffixCommon.length && !prefixCommon.length) return [];
  if (!N) {
    return [
      ...prefixCommon.map((c)=>({
          type: DiffType.common,
          value: c
        })),
      ...A.map((a)=>({
          type: swapped ? DiffType.added : DiffType.removed,
          value: a
        })),
      ...suffixCommon.map((c)=>({
          type: DiffType.common,
          value: c
        }))
    ];
  }
  const offset = N;
  const delta = M - N;
  const size = M + N + 1;
  const fp = Array.from({
    length: size
  }, ()=>({
      y: -1,
      id: -1
    }));
  /**
   * INFO:
   * This buffer is used to save memory and improve performance.
   * The first half is used to save route and last half is used to save diff
   * type.
   * This is because, when I kept new uint8array area to save type,performance
   * worsened.
   */ const routes = new Uint32Array((M * N + size + 1) * 2);
  const diffTypesPtrOffset = routes.length / 2;
  let ptr = 0;
  let p = -1;
  function backTrace(A, B, current, swapped) {
    const M = A.length;
    const N = B.length;
    const result = [];
    let a = M - 1;
    let b = N - 1;
    let j = routes[current.id];
    let type = routes[current.id + diffTypesPtrOffset];
    while(true){
      if (!j && !type) break;
      const prev = j;
      if (type === REMOVED) {
        result.unshift({
          type: swapped ? DiffType.removed : DiffType.added,
          value: B[b]
        });
        b -= 1;
      } else if (type === ADDED) {
        result.unshift({
          type: swapped ? DiffType.added : DiffType.removed,
          value: A[a]
        });
        a -= 1;
      } else {
        result.unshift({
          type: DiffType.common,
          value: A[a]
        });
        a -= 1;
        b -= 1;
      }
      j = routes[prev];
      type = routes[prev + diffTypesPtrOffset];
    }
    return result;
  }
  function createFP(slide, down, k, M) {
    if (slide && slide.y === -1 && down && down.y === -1) {
      return {
        y: 0,
        id: 0
      };
    }
    if (down && down.y === -1 || k === M || (slide && slide.y) > (down && down.y) + 1) {
      const prev = slide.id;
      ptr++;
      routes[ptr] = prev;
      routes[ptr + diffTypesPtrOffset] = ADDED;
      return {
        y: slide.y,
        id: ptr
      };
    } else {
      const prev = down.id;
      ptr++;
      routes[ptr] = prev;
      routes[ptr + diffTypesPtrOffset] = REMOVED;
      return {
        y: down.y + 1,
        id: ptr
      };
    }
  }
  function snake(k, slide, down, _offset, A, B) {
    const M = A.length;
    const N = B.length;
    if (k < -N || M < k) return {
      y: -1,
      id: -1
    };
    const fp = createFP(slide, down, k, M);
    while(fp.y + k < M && fp.y < N && A[fp.y + k] === B[fp.y]){
      const prev = fp.id;
      ptr++;
      fp.id = ptr;
      fp.y += 1;
      routes[ptr] = prev;
      routes[ptr + diffTypesPtrOffset] = COMMON;
    }
    return fp;
  }
  while(fp[delta + offset].y < N){
    p = p + 1;
    for(let k = -p; k < delta; ++k){
      fp[k + offset] = snake(k, fp[k - 1 + offset], fp[k + 1 + offset], offset, A, B);
    }
    for(let k = delta + p; k > delta; --k){
      fp[k + offset] = snake(k, fp[k - 1 + offset], fp[k + 1 + offset], offset, A, B);
    }
    fp[delta + offset] = snake(delta, fp[delta - 1 + offset], fp[delta + 1 + offset], offset, A, B);
  }
  return [
    ...prefixCommon.map((c)=>({
        type: DiffType.common,
        value: c
      })),
    ...backTrace(A, B, fp[delta + offset], swapped),
    ...suffixCommon.map((c)=>({
        type: DiffType.common,
        value: c
      }))
  ];
}
/**
 * Renders the differences between the actual and expected strings
 * Partially inspired from https://github.com/kpdecker/jsdiff
 * @param A Actual string
 * @param B Expected string
 */ export function diffstr(A, B) {
  function unescape(string) {
    // unescape invisible characters.
    // ref: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String#escape_sequences
    return string.replaceAll("\b", "\\b").replaceAll("\f", "\\f").replaceAll("\t", "\\t").replaceAll("\v", "\\v").replaceAll(/\r\n|\r|\n/g, (str)=>str === "\r" ? "\\r" : str === "\n" ? "\\n\n" : "\\r\\n\r\n");
  }
  function tokenize(string, { wordDiff = false } = {}) {
    if (wordDiff) {
      // Split string on whitespace symbols
      const tokens = string.split(/([^\S\r\n]+|[()[\]{}'"\r\n]|\b)/);
      // Extended Latin character set
      const words = /^[a-zA-Z\u{C0}-\u{FF}\u{D8}-\u{F6}\u{F8}-\u{2C6}\u{2C8}-\u{2D7}\u{2DE}-\u{2FF}\u{1E00}-\u{1EFF}]+$/u;
      // Join boundary splits that we do not consider to be boundaries and merge empty strings surrounded by word chars
      for(let i = 0; i < tokens.length - 1; i++){
        if (!tokens[i + 1] && tokens[i + 2] && words.test(tokens[i]) && words.test(tokens[i + 2])) {
          tokens[i] += tokens[i + 2];
          tokens.splice(i + 1, 2);
          i--;
        }
      }
      return tokens.filter((token)=>token);
    } else {
      // Split string on new lines symbols
      const tokens = [], lines = string.split(/(\n|\r\n)/);
      // Ignore final empty token when text ends with a newline
      if (!lines[lines.length - 1]) {
        lines.pop();
      }
      // Merge the content and line separators into single tokens
      for(let i = 0; i < lines.length; i++){
        if (i % 2) {
          tokens[tokens.length - 1] += lines[i];
        } else {
          tokens.push(lines[i]);
        }
      }
      return tokens;
    }
  }
  // Create details by filtering relevant word-diff for current line
  // and merge "space-diff" if surrounded by word-diff for cleaner displays
  function createDetails(line, tokens) {
    return tokens.filter(({ type })=>type === line.type || type === DiffType.common).map((result, i, t)=>{
      if (result.type === DiffType.common && t[i - 1] && t[i - 1]?.type === t[i + 1]?.type && /\s+/.test(result.value)) {
        result.type = t[i - 1].type;
      }
      return result;
    });
  }
  // Compute multi-line diff
  const diffResult = diff(tokenize(`${unescape(A)}\n`), tokenize(`${unescape(B)}\n`));
  const added = [], removed = [];
  for (const result of diffResult){
    if (result.type === DiffType.added) {
      added.push(result);
    }
    if (result.type === DiffType.removed) {
      removed.push(result);
    }
  }
  // Compute word-diff
  const aLines = added.length < removed.length ? added : removed;
  const bLines = aLines === removed ? added : removed;
  for (const a of aLines){
    let tokens = [], b;
    // Search another diff line with at least one common token
    while(bLines.length){
      b = bLines.shift();
      tokens = diff(tokenize(a.value, {
        wordDiff: true
      }), tokenize(b?.value ?? "", {
        wordDiff: true
      }));
      if (tokens.some(({ type, value })=>type === DiffType.common && value.trim().length)) {
        break;
      }
    }
    // Register word-diff details
    a.details = createDetails(a, tokens);
    if (b) {
      b.details = createDetails(b, tokens);
    }
  }
  return diffResult;
}
/**
 * Colors the output of assertion diffs
 * @param diffType Difference type, either added or removed
 */ function createColor(diffType, { background = false } = {}) {
  // TODO(@littledivy): Remove this when we can detect
  // true color terminals.
  // https://github.com/denoland/deno_std/issues/2575
  background = false;
  switch(diffType){
    case DiffType.added:
      return (s)=>background ? bgGreen(white(s)) : green(bold(s));
    case DiffType.removed:
      return (s)=>background ? bgRed(white(s)) : red(bold(s));
    default:
      return white;
  }
}
/**
 * Prefixes `+` or `-` in diff output
 * @param diffType Difference type, either added or removed
 */ function createSign(diffType) {
  switch(diffType){
    case DiffType.added:
      return "+   ";
    case DiffType.removed:
      return "-   ";
    default:
      return "    ";
  }
}
export function buildMessage(diffResult, { stringDiff = false } = {}) {
  const messages = [], diffMessages = [];
  messages.push("");
  messages.push("");
  messages.push(`    ${gray(bold("[Diff]"))} ${red(bold("Actual"))} / ${green(bold("Expected"))}`);
  messages.push("");
  messages.push("");
  diffResult.forEach((result)=>{
    const c = createColor(result.type);
    const line = result.details?.map((detail)=>detail.type !== DiffType.common ? createColor(detail.type, {
        background: true
      })(detail.value) : detail.value).join("") ?? result.value;
    diffMessages.push(c(`${createSign(result.type)}${line}`));
  });
  messages.push(...stringDiff ? [
    diffMessages.join("")
  ] : diffMessages);
  messages.push("");
  return messages;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2MC4wL3Rlc3RpbmcvX2RpZmYudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbi8vIFRoaXMgbW9kdWxlIGlzIGJyb3dzZXIgY29tcGF0aWJsZS5cblxuaW1wb3J0IHtcbiAgYmdHcmVlbixcbiAgYmdSZWQsXG4gIGJvbGQsXG4gIGdyYXksXG4gIGdyZWVuLFxuICByZWQsXG4gIHdoaXRlLFxufSBmcm9tIFwiLi4vZm10L2NvbG9ycy50c1wiO1xuXG5pbnRlcmZhY2UgRmFydGhlc3RQb2ludCB7XG4gIHk6IG51bWJlcjtcbiAgaWQ6IG51bWJlcjtcbn1cblxuZXhwb3J0IGVudW0gRGlmZlR5cGUge1xuICByZW1vdmVkID0gXCJyZW1vdmVkXCIsXG4gIGNvbW1vbiA9IFwiY29tbW9uXCIsXG4gIGFkZGVkID0gXCJhZGRlZFwiLFxufVxuXG5leHBvcnQgaW50ZXJmYWNlIERpZmZSZXN1bHQ8VD4ge1xuICB0eXBlOiBEaWZmVHlwZTtcbiAgdmFsdWU6IFQ7XG4gIGRldGFpbHM/OiBBcnJheTxEaWZmUmVzdWx0PFQ+Pjtcbn1cblxuY29uc3QgUkVNT1ZFRCA9IDE7XG5jb25zdCBDT01NT04gPSAyO1xuY29uc3QgQURERUQgPSAzO1xuXG5mdW5jdGlvbiBjcmVhdGVDb21tb248VD4oQTogVFtdLCBCOiBUW10sIHJldmVyc2U/OiBib29sZWFuKTogVFtdIHtcbiAgY29uc3QgY29tbW9uID0gW107XG4gIGlmIChBLmxlbmd0aCA9PT0gMCB8fCBCLmxlbmd0aCA9PT0gMCkgcmV0dXJuIFtdO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IE1hdGgubWluKEEubGVuZ3RoLCBCLmxlbmd0aCk7IGkgKz0gMSkge1xuICAgIGlmIChcbiAgICAgIEFbcmV2ZXJzZSA/IEEubGVuZ3RoIC0gaSAtIDEgOiBpXSA9PT0gQltyZXZlcnNlID8gQi5sZW5ndGggLSBpIC0gMSA6IGldXG4gICAgKSB7XG4gICAgICBjb21tb24ucHVzaChBW3JldmVyc2UgPyBBLmxlbmd0aCAtIGkgLSAxIDogaV0pO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gY29tbW9uO1xuICAgIH1cbiAgfVxuICByZXR1cm4gY29tbW9uO1xufVxuXG4vKipcbiAqIFJlbmRlcnMgdGhlIGRpZmZlcmVuY2VzIGJldHdlZW4gdGhlIGFjdHVhbCBhbmQgZXhwZWN0ZWQgdmFsdWVzXG4gKiBAcGFyYW0gQSBBY3R1YWwgdmFsdWVcbiAqIEBwYXJhbSBCIEV4cGVjdGVkIHZhbHVlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkaWZmPFQ+KEE6IFRbXSwgQjogVFtdKTogQXJyYXk8RGlmZlJlc3VsdDxUPj4ge1xuICBjb25zdCBwcmVmaXhDb21tb24gPSBjcmVhdGVDb21tb24oQSwgQik7XG4gIGNvbnN0IHN1ZmZpeENvbW1vbiA9IGNyZWF0ZUNvbW1vbihcbiAgICBBLnNsaWNlKHByZWZpeENvbW1vbi5sZW5ndGgpLFxuICAgIEIuc2xpY2UocHJlZml4Q29tbW9uLmxlbmd0aCksXG4gICAgdHJ1ZSxcbiAgKS5yZXZlcnNlKCk7XG4gIEEgPSBzdWZmaXhDb21tb24ubGVuZ3RoXG4gICAgPyBBLnNsaWNlKHByZWZpeENvbW1vbi5sZW5ndGgsIC1zdWZmaXhDb21tb24ubGVuZ3RoKVxuICAgIDogQS5zbGljZShwcmVmaXhDb21tb24ubGVuZ3RoKTtcbiAgQiA9IHN1ZmZpeENvbW1vbi5sZW5ndGhcbiAgICA/IEIuc2xpY2UocHJlZml4Q29tbW9uLmxlbmd0aCwgLXN1ZmZpeENvbW1vbi5sZW5ndGgpXG4gICAgOiBCLnNsaWNlKHByZWZpeENvbW1vbi5sZW5ndGgpO1xuICBjb25zdCBzd2FwcGVkID0gQi5sZW5ndGggPiBBLmxlbmd0aDtcbiAgW0EsIEJdID0gc3dhcHBlZCA/IFtCLCBBXSA6IFtBLCBCXTtcbiAgY29uc3QgTSA9IEEubGVuZ3RoO1xuICBjb25zdCBOID0gQi5sZW5ndGg7XG4gIGlmICghTSAmJiAhTiAmJiAhc3VmZml4Q29tbW9uLmxlbmd0aCAmJiAhcHJlZml4Q29tbW9uLmxlbmd0aCkgcmV0dXJuIFtdO1xuICBpZiAoIU4pIHtcbiAgICByZXR1cm4gW1xuICAgICAgLi4ucHJlZml4Q29tbW9uLm1hcChcbiAgICAgICAgKGMpOiBEaWZmUmVzdWx0PHR5cGVvZiBjPiA9PiAoeyB0eXBlOiBEaWZmVHlwZS5jb21tb24sIHZhbHVlOiBjIH0pLFxuICAgICAgKSxcbiAgICAgIC4uLkEubWFwKFxuICAgICAgICAoYSk6IERpZmZSZXN1bHQ8dHlwZW9mIGE+ID0+ICh7XG4gICAgICAgICAgdHlwZTogc3dhcHBlZCA/IERpZmZUeXBlLmFkZGVkIDogRGlmZlR5cGUucmVtb3ZlZCxcbiAgICAgICAgICB2YWx1ZTogYSxcbiAgICAgICAgfSksXG4gICAgICApLFxuICAgICAgLi4uc3VmZml4Q29tbW9uLm1hcChcbiAgICAgICAgKGMpOiBEaWZmUmVzdWx0PHR5cGVvZiBjPiA9PiAoeyB0eXBlOiBEaWZmVHlwZS5jb21tb24sIHZhbHVlOiBjIH0pLFxuICAgICAgKSxcbiAgICBdO1xuICB9XG4gIGNvbnN0IG9mZnNldCA9IE47XG4gIGNvbnN0IGRlbHRhID0gTSAtIE47XG4gIGNvbnN0IHNpemUgPSBNICsgTiArIDE7XG4gIGNvbnN0IGZwOiBGYXJ0aGVzdFBvaW50W10gPSBBcnJheS5mcm9tKFxuICAgIHsgbGVuZ3RoOiBzaXplIH0sXG4gICAgKCkgPT4gKHsgeTogLTEsIGlkOiAtMSB9KSxcbiAgKTtcbiAgLyoqXG4gICAqIElORk86XG4gICAqIFRoaXMgYnVmZmVyIGlzIHVzZWQgdG8gc2F2ZSBtZW1vcnkgYW5kIGltcHJvdmUgcGVyZm9ybWFuY2UuXG4gICAqIFRoZSBmaXJzdCBoYWxmIGlzIHVzZWQgdG8gc2F2ZSByb3V0ZSBhbmQgbGFzdCBoYWxmIGlzIHVzZWQgdG8gc2F2ZSBkaWZmXG4gICAqIHR5cGUuXG4gICAqIFRoaXMgaXMgYmVjYXVzZSwgd2hlbiBJIGtlcHQgbmV3IHVpbnQ4YXJyYXkgYXJlYSB0byBzYXZlIHR5cGUscGVyZm9ybWFuY2VcbiAgICogd29yc2VuZWQuXG4gICAqL1xuICBjb25zdCByb3V0ZXMgPSBuZXcgVWludDMyQXJyYXkoKE0gKiBOICsgc2l6ZSArIDEpICogMik7XG4gIGNvbnN0IGRpZmZUeXBlc1B0ck9mZnNldCA9IHJvdXRlcy5sZW5ndGggLyAyO1xuICBsZXQgcHRyID0gMDtcbiAgbGV0IHAgPSAtMTtcblxuICBmdW5jdGlvbiBiYWNrVHJhY2U8VD4oXG4gICAgQTogVFtdLFxuICAgIEI6IFRbXSxcbiAgICBjdXJyZW50OiBGYXJ0aGVzdFBvaW50LFxuICAgIHN3YXBwZWQ6IGJvb2xlYW4sXG4gICk6IEFycmF5PHtcbiAgICB0eXBlOiBEaWZmVHlwZTtcbiAgICB2YWx1ZTogVDtcbiAgfT4ge1xuICAgIGNvbnN0IE0gPSBBLmxlbmd0aDtcbiAgICBjb25zdCBOID0gQi5sZW5ndGg7XG4gICAgY29uc3QgcmVzdWx0ID0gW107XG4gICAgbGV0IGEgPSBNIC0gMTtcbiAgICBsZXQgYiA9IE4gLSAxO1xuICAgIGxldCBqID0gcm91dGVzW2N1cnJlbnQuaWRdO1xuICAgIGxldCB0eXBlID0gcm91dGVzW2N1cnJlbnQuaWQgKyBkaWZmVHlwZXNQdHJPZmZzZXRdO1xuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICBpZiAoIWogJiYgIXR5cGUpIGJyZWFrO1xuICAgICAgY29uc3QgcHJldiA9IGo7XG4gICAgICBpZiAodHlwZSA9PT0gUkVNT1ZFRCkge1xuICAgICAgICByZXN1bHQudW5zaGlmdCh7XG4gICAgICAgICAgdHlwZTogc3dhcHBlZCA/IERpZmZUeXBlLnJlbW92ZWQgOiBEaWZmVHlwZS5hZGRlZCxcbiAgICAgICAgICB2YWx1ZTogQltiXSxcbiAgICAgICAgfSk7XG4gICAgICAgIGIgLT0gMTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gQURERUQpIHtcbiAgICAgICAgcmVzdWx0LnVuc2hpZnQoe1xuICAgICAgICAgIHR5cGU6IHN3YXBwZWQgPyBEaWZmVHlwZS5hZGRlZCA6IERpZmZUeXBlLnJlbW92ZWQsXG4gICAgICAgICAgdmFsdWU6IEFbYV0sXG4gICAgICAgIH0pO1xuICAgICAgICBhIC09IDE7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHQudW5zaGlmdCh7IHR5cGU6IERpZmZUeXBlLmNvbW1vbiwgdmFsdWU6IEFbYV0gfSk7XG4gICAgICAgIGEgLT0gMTtcbiAgICAgICAgYiAtPSAxO1xuICAgICAgfVxuICAgICAgaiA9IHJvdXRlc1twcmV2XTtcbiAgICAgIHR5cGUgPSByb3V0ZXNbcHJldiArIGRpZmZUeXBlc1B0ck9mZnNldF07XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBmdW5jdGlvbiBjcmVhdGVGUChcbiAgICBzbGlkZTogRmFydGhlc3RQb2ludCxcbiAgICBkb3duOiBGYXJ0aGVzdFBvaW50LFxuICAgIGs6IG51bWJlcixcbiAgICBNOiBudW1iZXIsXG4gICk6IEZhcnRoZXN0UG9pbnQge1xuICAgIGlmIChzbGlkZSAmJiBzbGlkZS55ID09PSAtMSAmJiBkb3duICYmIGRvd24ueSA9PT0gLTEpIHtcbiAgICAgIHJldHVybiB7IHk6IDAsIGlkOiAwIH07XG4gICAgfVxuICAgIGlmIChcbiAgICAgIChkb3duICYmIGRvd24ueSA9PT0gLTEpIHx8XG4gICAgICBrID09PSBNIHx8XG4gICAgICAoc2xpZGUgJiYgc2xpZGUueSkgPiAoZG93biAmJiBkb3duLnkpICsgMVxuICAgICkge1xuICAgICAgY29uc3QgcHJldiA9IHNsaWRlLmlkO1xuICAgICAgcHRyKys7XG4gICAgICByb3V0ZXNbcHRyXSA9IHByZXY7XG4gICAgICByb3V0ZXNbcHRyICsgZGlmZlR5cGVzUHRyT2Zmc2V0XSA9IEFEREVEO1xuICAgICAgcmV0dXJuIHsgeTogc2xpZGUueSwgaWQ6IHB0ciB9O1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBwcmV2ID0gZG93bi5pZDtcbiAgICAgIHB0cisrO1xuICAgICAgcm91dGVzW3B0cl0gPSBwcmV2O1xuICAgICAgcm91dGVzW3B0ciArIGRpZmZUeXBlc1B0ck9mZnNldF0gPSBSRU1PVkVEO1xuICAgICAgcmV0dXJuIHsgeTogZG93bi55ICsgMSwgaWQ6IHB0ciB9O1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHNuYWtlPFQ+KFxuICAgIGs6IG51bWJlcixcbiAgICBzbGlkZTogRmFydGhlc3RQb2ludCxcbiAgICBkb3duOiBGYXJ0aGVzdFBvaW50LFxuICAgIF9vZmZzZXQ6IG51bWJlcixcbiAgICBBOiBUW10sXG4gICAgQjogVFtdLFxuICApOiBGYXJ0aGVzdFBvaW50IHtcbiAgICBjb25zdCBNID0gQS5sZW5ndGg7XG4gICAgY29uc3QgTiA9IEIubGVuZ3RoO1xuICAgIGlmIChrIDwgLU4gfHwgTSA8IGspIHJldHVybiB7IHk6IC0xLCBpZDogLTEgfTtcbiAgICBjb25zdCBmcCA9IGNyZWF0ZUZQKHNsaWRlLCBkb3duLCBrLCBNKTtcbiAgICB3aGlsZSAoZnAueSArIGsgPCBNICYmIGZwLnkgPCBOICYmIEFbZnAueSArIGtdID09PSBCW2ZwLnldKSB7XG4gICAgICBjb25zdCBwcmV2ID0gZnAuaWQ7XG4gICAgICBwdHIrKztcbiAgICAgIGZwLmlkID0gcHRyO1xuICAgICAgZnAueSArPSAxO1xuICAgICAgcm91dGVzW3B0cl0gPSBwcmV2O1xuICAgICAgcm91dGVzW3B0ciArIGRpZmZUeXBlc1B0ck9mZnNldF0gPSBDT01NT047XG4gICAgfVxuICAgIHJldHVybiBmcDtcbiAgfVxuXG4gIHdoaWxlIChmcFtkZWx0YSArIG9mZnNldF0ueSA8IE4pIHtcbiAgICBwID0gcCArIDE7XG4gICAgZm9yIChsZXQgayA9IC1wOyBrIDwgZGVsdGE7ICsraykge1xuICAgICAgZnBbayArIG9mZnNldF0gPSBzbmFrZShcbiAgICAgICAgayxcbiAgICAgICAgZnBbayAtIDEgKyBvZmZzZXRdLFxuICAgICAgICBmcFtrICsgMSArIG9mZnNldF0sXG4gICAgICAgIG9mZnNldCxcbiAgICAgICAgQSxcbiAgICAgICAgQixcbiAgICAgICk7XG4gICAgfVxuICAgIGZvciAobGV0IGsgPSBkZWx0YSArIHA7IGsgPiBkZWx0YTsgLS1rKSB7XG4gICAgICBmcFtrICsgb2Zmc2V0XSA9IHNuYWtlKFxuICAgICAgICBrLFxuICAgICAgICBmcFtrIC0gMSArIG9mZnNldF0sXG4gICAgICAgIGZwW2sgKyAxICsgb2Zmc2V0XSxcbiAgICAgICAgb2Zmc2V0LFxuICAgICAgICBBLFxuICAgICAgICBCLFxuICAgICAgKTtcbiAgICB9XG4gICAgZnBbZGVsdGEgKyBvZmZzZXRdID0gc25ha2UoXG4gICAgICBkZWx0YSxcbiAgICAgIGZwW2RlbHRhIC0gMSArIG9mZnNldF0sXG4gICAgICBmcFtkZWx0YSArIDEgKyBvZmZzZXRdLFxuICAgICAgb2Zmc2V0LFxuICAgICAgQSxcbiAgICAgIEIsXG4gICAgKTtcbiAgfVxuICByZXR1cm4gW1xuICAgIC4uLnByZWZpeENvbW1vbi5tYXAoXG4gICAgICAoYyk6IERpZmZSZXN1bHQ8dHlwZW9mIGM+ID0+ICh7IHR5cGU6IERpZmZUeXBlLmNvbW1vbiwgdmFsdWU6IGMgfSksXG4gICAgKSxcbiAgICAuLi5iYWNrVHJhY2UoQSwgQiwgZnBbZGVsdGEgKyBvZmZzZXRdLCBzd2FwcGVkKSxcbiAgICAuLi5zdWZmaXhDb21tb24ubWFwKFxuICAgICAgKGMpOiBEaWZmUmVzdWx0PHR5cGVvZiBjPiA9PiAoeyB0eXBlOiBEaWZmVHlwZS5jb21tb24sIHZhbHVlOiBjIH0pLFxuICAgICksXG4gIF07XG59XG5cbi8qKlxuICogUmVuZGVycyB0aGUgZGlmZmVyZW5jZXMgYmV0d2VlbiB0aGUgYWN0dWFsIGFuZCBleHBlY3RlZCBzdHJpbmdzXG4gKiBQYXJ0aWFsbHkgaW5zcGlyZWQgZnJvbSBodHRwczovL2dpdGh1Yi5jb20va3BkZWNrZXIvanNkaWZmXG4gKiBAcGFyYW0gQSBBY3R1YWwgc3RyaW5nXG4gKiBAcGFyYW0gQiBFeHBlY3RlZCBzdHJpbmdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRpZmZzdHIoQTogc3RyaW5nLCBCOiBzdHJpbmcpIHtcbiAgZnVuY3Rpb24gdW5lc2NhcGUoc3RyaW5nOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIC8vIHVuZXNjYXBlIGludmlzaWJsZSBjaGFyYWN0ZXJzLlxuICAgIC8vIHJlZjogaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvU3RyaW5nI2VzY2FwZV9zZXF1ZW5jZXNcbiAgICByZXR1cm4gc3RyaW5nXG4gICAgICAucmVwbGFjZUFsbChcIlxcYlwiLCBcIlxcXFxiXCIpXG4gICAgICAucmVwbGFjZUFsbChcIlxcZlwiLCBcIlxcXFxmXCIpXG4gICAgICAucmVwbGFjZUFsbChcIlxcdFwiLCBcIlxcXFx0XCIpXG4gICAgICAucmVwbGFjZUFsbChcIlxcdlwiLCBcIlxcXFx2XCIpXG4gICAgICAucmVwbGFjZUFsbCggLy8gZG9lcyBub3QgcmVtb3ZlIGxpbmUgYnJlYWtzXG4gICAgICAgIC9cXHJcXG58XFxyfFxcbi9nLFxuICAgICAgICAoc3RyKSA9PiBzdHIgPT09IFwiXFxyXCIgPyBcIlxcXFxyXCIgOiBzdHIgPT09IFwiXFxuXCIgPyBcIlxcXFxuXFxuXCIgOiBcIlxcXFxyXFxcXG5cXHJcXG5cIixcbiAgICAgICk7XG4gIH1cblxuICBmdW5jdGlvbiB0b2tlbml6ZShzdHJpbmc6IHN0cmluZywgeyB3b3JkRGlmZiA9IGZhbHNlIH0gPSB7fSk6IHN0cmluZ1tdIHtcbiAgICBpZiAod29yZERpZmYpIHtcbiAgICAgIC8vIFNwbGl0IHN0cmluZyBvbiB3aGl0ZXNwYWNlIHN5bWJvbHNcbiAgICAgIGNvbnN0IHRva2VucyA9IHN0cmluZy5zcGxpdCgvKFteXFxTXFxyXFxuXSt8WygpW1xcXXt9J1wiXFxyXFxuXXxcXGIpLyk7XG4gICAgICAvLyBFeHRlbmRlZCBMYXRpbiBjaGFyYWN0ZXIgc2V0XG4gICAgICBjb25zdCB3b3JkcyA9XG4gICAgICAgIC9eW2EtekEtWlxcdXtDMH0tXFx1e0ZGfVxcdXtEOH0tXFx1e0Y2fVxcdXtGOH0tXFx1ezJDNn1cXHV7MkM4fS1cXHV7MkQ3fVxcdXsyREV9LVxcdXsyRkZ9XFx1ezFFMDB9LVxcdXsxRUZGfV0rJC91O1xuXG4gICAgICAvLyBKb2luIGJvdW5kYXJ5IHNwbGl0cyB0aGF0IHdlIGRvIG5vdCBjb25zaWRlciB0byBiZSBib3VuZGFyaWVzIGFuZCBtZXJnZSBlbXB0eSBzdHJpbmdzIHN1cnJvdW5kZWQgYnkgd29yZCBjaGFyc1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0b2tlbnMubGVuZ3RoIC0gMTsgaSsrKSB7XG4gICAgICAgIGlmIChcbiAgICAgICAgICAhdG9rZW5zW2kgKyAxXSAmJiB0b2tlbnNbaSArIDJdICYmIHdvcmRzLnRlc3QodG9rZW5zW2ldKSAmJlxuICAgICAgICAgIHdvcmRzLnRlc3QodG9rZW5zW2kgKyAyXSlcbiAgICAgICAgKSB7XG4gICAgICAgICAgdG9rZW5zW2ldICs9IHRva2Vuc1tpICsgMl07XG4gICAgICAgICAgdG9rZW5zLnNwbGljZShpICsgMSwgMik7XG4gICAgICAgICAgaS0tO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gdG9rZW5zLmZpbHRlcigodG9rZW4pID0+IHRva2VuKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gU3BsaXQgc3RyaW5nIG9uIG5ldyBsaW5lcyBzeW1ib2xzXG4gICAgICBjb25zdCB0b2tlbnMgPSBbXSwgbGluZXMgPSBzdHJpbmcuc3BsaXQoLyhcXG58XFxyXFxuKS8pO1xuXG4gICAgICAvLyBJZ25vcmUgZmluYWwgZW1wdHkgdG9rZW4gd2hlbiB0ZXh0IGVuZHMgd2l0aCBhIG5ld2xpbmVcbiAgICAgIGlmICghbGluZXNbbGluZXMubGVuZ3RoIC0gMV0pIHtcbiAgICAgICAgbGluZXMucG9wKCk7XG4gICAgICB9XG5cbiAgICAgIC8vIE1lcmdlIHRoZSBjb250ZW50IGFuZCBsaW5lIHNlcGFyYXRvcnMgaW50byBzaW5nbGUgdG9rZW5zXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpbmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChpICUgMikge1xuICAgICAgICAgIHRva2Vuc1t0b2tlbnMubGVuZ3RoIC0gMV0gKz0gbGluZXNbaV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdG9rZW5zLnB1c2gobGluZXNbaV0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gdG9rZW5zO1xuICAgIH1cbiAgfVxuXG4gIC8vIENyZWF0ZSBkZXRhaWxzIGJ5IGZpbHRlcmluZyByZWxldmFudCB3b3JkLWRpZmYgZm9yIGN1cnJlbnQgbGluZVxuICAvLyBhbmQgbWVyZ2UgXCJzcGFjZS1kaWZmXCIgaWYgc3Vycm91bmRlZCBieSB3b3JkLWRpZmYgZm9yIGNsZWFuZXIgZGlzcGxheXNcbiAgZnVuY3Rpb24gY3JlYXRlRGV0YWlscyhcbiAgICBsaW5lOiBEaWZmUmVzdWx0PHN0cmluZz4sXG4gICAgdG9rZW5zOiBBcnJheTxEaWZmUmVzdWx0PHN0cmluZz4+LFxuICApIHtcbiAgICByZXR1cm4gdG9rZW5zLmZpbHRlcigoeyB0eXBlIH0pID0+XG4gICAgICB0eXBlID09PSBsaW5lLnR5cGUgfHwgdHlwZSA9PT0gRGlmZlR5cGUuY29tbW9uXG4gICAgKS5tYXAoKHJlc3VsdCwgaSwgdCkgPT4ge1xuICAgICAgaWYgKFxuICAgICAgICAocmVzdWx0LnR5cGUgPT09IERpZmZUeXBlLmNvbW1vbikgJiYgKHRbaSAtIDFdKSAmJlxuICAgICAgICAodFtpIC0gMV0/LnR5cGUgPT09IHRbaSArIDFdPy50eXBlKSAmJiAvXFxzKy8udGVzdChyZXN1bHQudmFsdWUpXG4gICAgICApIHtcbiAgICAgICAgcmVzdWx0LnR5cGUgPSB0W2kgLSAxXS50eXBlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIENvbXB1dGUgbXVsdGktbGluZSBkaWZmXG4gIGNvbnN0IGRpZmZSZXN1bHQgPSBkaWZmKFxuICAgIHRva2VuaXplKGAke3VuZXNjYXBlKEEpfVxcbmApLFxuICAgIHRva2VuaXplKGAke3VuZXNjYXBlKEIpfVxcbmApLFxuICApO1xuXG4gIGNvbnN0IGFkZGVkID0gW10sIHJlbW92ZWQgPSBbXTtcbiAgZm9yIChjb25zdCByZXN1bHQgb2YgZGlmZlJlc3VsdCkge1xuICAgIGlmIChyZXN1bHQudHlwZSA9PT0gRGlmZlR5cGUuYWRkZWQpIHtcbiAgICAgIGFkZGVkLnB1c2gocmVzdWx0KTtcbiAgICB9XG4gICAgaWYgKHJlc3VsdC50eXBlID09PSBEaWZmVHlwZS5yZW1vdmVkKSB7XG4gICAgICByZW1vdmVkLnB1c2gocmVzdWx0KTtcbiAgICB9XG4gIH1cblxuICAvLyBDb21wdXRlIHdvcmQtZGlmZlxuICBjb25zdCBhTGluZXMgPSBhZGRlZC5sZW5ndGggPCByZW1vdmVkLmxlbmd0aCA/IGFkZGVkIDogcmVtb3ZlZDtcbiAgY29uc3QgYkxpbmVzID0gYUxpbmVzID09PSByZW1vdmVkID8gYWRkZWQgOiByZW1vdmVkO1xuICBmb3IgKGNvbnN0IGEgb2YgYUxpbmVzKSB7XG4gICAgbGV0IHRva2VucyA9IFtdIGFzIEFycmF5PERpZmZSZXN1bHQ8c3RyaW5nPj4sXG4gICAgICBiOiB1bmRlZmluZWQgfCBEaWZmUmVzdWx0PHN0cmluZz47XG4gICAgLy8gU2VhcmNoIGFub3RoZXIgZGlmZiBsaW5lIHdpdGggYXQgbGVhc3Qgb25lIGNvbW1vbiB0b2tlblxuICAgIHdoaWxlIChiTGluZXMubGVuZ3RoKSB7XG4gICAgICBiID0gYkxpbmVzLnNoaWZ0KCk7XG4gICAgICB0b2tlbnMgPSBkaWZmKFxuICAgICAgICB0b2tlbml6ZShhLnZhbHVlLCB7IHdvcmREaWZmOiB0cnVlIH0pLFxuICAgICAgICB0b2tlbml6ZShiPy52YWx1ZSA/PyBcIlwiLCB7IHdvcmREaWZmOiB0cnVlIH0pLFxuICAgICAgKTtcbiAgICAgIGlmIChcbiAgICAgICAgdG9rZW5zLnNvbWUoKHsgdHlwZSwgdmFsdWUgfSkgPT5cbiAgICAgICAgICB0eXBlID09PSBEaWZmVHlwZS5jb21tb24gJiYgdmFsdWUudHJpbSgpLmxlbmd0aFxuICAgICAgICApXG4gICAgICApIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIFJlZ2lzdGVyIHdvcmQtZGlmZiBkZXRhaWxzXG4gICAgYS5kZXRhaWxzID0gY3JlYXRlRGV0YWlscyhhLCB0b2tlbnMpO1xuICAgIGlmIChiKSB7XG4gICAgICBiLmRldGFpbHMgPSBjcmVhdGVEZXRhaWxzKGIsIHRva2Vucyk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGRpZmZSZXN1bHQ7XG59XG5cbi8qKlxuICogQ29sb3JzIHRoZSBvdXRwdXQgb2YgYXNzZXJ0aW9uIGRpZmZzXG4gKiBAcGFyYW0gZGlmZlR5cGUgRGlmZmVyZW5jZSB0eXBlLCBlaXRoZXIgYWRkZWQgb3IgcmVtb3ZlZFxuICovXG5mdW5jdGlvbiBjcmVhdGVDb2xvcihcbiAgZGlmZlR5cGU6IERpZmZUeXBlLFxuICB7IGJhY2tncm91bmQgPSBmYWxzZSB9ID0ge30sXG4pOiAoczogc3RyaW5nKSA9PiBzdHJpbmcge1xuICAvLyBUT0RPKEBsaXR0bGVkaXZ5KTogUmVtb3ZlIHRoaXMgd2hlbiB3ZSBjYW4gZGV0ZWN0XG4gIC8vIHRydWUgY29sb3IgdGVybWluYWxzLlxuICAvLyBodHRwczovL2dpdGh1Yi5jb20vZGVub2xhbmQvZGVub19zdGQvaXNzdWVzLzI1NzVcbiAgYmFja2dyb3VuZCA9IGZhbHNlO1xuICBzd2l0Y2ggKGRpZmZUeXBlKSB7XG4gICAgY2FzZSBEaWZmVHlwZS5hZGRlZDpcbiAgICAgIHJldHVybiAoczogc3RyaW5nKTogc3RyaW5nID0+XG4gICAgICAgIGJhY2tncm91bmQgPyBiZ0dyZWVuKHdoaXRlKHMpKSA6IGdyZWVuKGJvbGQocykpO1xuICAgIGNhc2UgRGlmZlR5cGUucmVtb3ZlZDpcbiAgICAgIHJldHVybiAoczogc3RyaW5nKTogc3RyaW5nID0+IGJhY2tncm91bmQgPyBiZ1JlZCh3aGl0ZShzKSkgOiByZWQoYm9sZChzKSk7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiB3aGl0ZTtcbiAgfVxufVxuXG4vKipcbiAqIFByZWZpeGVzIGArYCBvciBgLWAgaW4gZGlmZiBvdXRwdXRcbiAqIEBwYXJhbSBkaWZmVHlwZSBEaWZmZXJlbmNlIHR5cGUsIGVpdGhlciBhZGRlZCBvciByZW1vdmVkXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZVNpZ24oZGlmZlR5cGU6IERpZmZUeXBlKTogc3RyaW5nIHtcbiAgc3dpdGNoIChkaWZmVHlwZSkge1xuICAgIGNhc2UgRGlmZlR5cGUuYWRkZWQ6XG4gICAgICByZXR1cm4gXCIrICAgXCI7XG4gICAgY2FzZSBEaWZmVHlwZS5yZW1vdmVkOlxuICAgICAgcmV0dXJuIFwiLSAgIFwiO1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gXCIgICAgXCI7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkTWVzc2FnZShcbiAgZGlmZlJlc3VsdDogUmVhZG9ubHlBcnJheTxEaWZmUmVzdWx0PHN0cmluZz4+LFxuICB7IHN0cmluZ0RpZmYgPSBmYWxzZSB9ID0ge30sXG4pOiBzdHJpbmdbXSB7XG4gIGNvbnN0IG1lc3NhZ2VzOiBzdHJpbmdbXSA9IFtdLCBkaWZmTWVzc2FnZXM6IHN0cmluZ1tdID0gW107XG4gIG1lc3NhZ2VzLnB1c2goXCJcIik7XG4gIG1lc3NhZ2VzLnB1c2goXCJcIik7XG4gIG1lc3NhZ2VzLnB1c2goXG4gICAgYCAgICAke2dyYXkoYm9sZChcIltEaWZmXVwiKSl9ICR7cmVkKGJvbGQoXCJBY3R1YWxcIikpfSAvICR7XG4gICAgICBncmVlbihib2xkKFwiRXhwZWN0ZWRcIikpXG4gICAgfWAsXG4gICk7XG4gIG1lc3NhZ2VzLnB1c2goXCJcIik7XG4gIG1lc3NhZ2VzLnB1c2goXCJcIik7XG4gIGRpZmZSZXN1bHQuZm9yRWFjaCgocmVzdWx0OiBEaWZmUmVzdWx0PHN0cmluZz4pID0+IHtcbiAgICBjb25zdCBjID0gY3JlYXRlQ29sb3IocmVzdWx0LnR5cGUpO1xuICAgIGNvbnN0IGxpbmUgPSByZXN1bHQuZGV0YWlscz8ubWFwKChkZXRhaWwpID0+XG4gICAgICBkZXRhaWwudHlwZSAhPT0gRGlmZlR5cGUuY29tbW9uXG4gICAgICAgID8gY3JlYXRlQ29sb3IoZGV0YWlsLnR5cGUsIHsgYmFja2dyb3VuZDogdHJ1ZSB9KShkZXRhaWwudmFsdWUpXG4gICAgICAgIDogZGV0YWlsLnZhbHVlXG4gICAgKS5qb2luKFwiXCIpID8/IHJlc3VsdC52YWx1ZTtcbiAgICBkaWZmTWVzc2FnZXMucHVzaChjKGAke2NyZWF0ZVNpZ24ocmVzdWx0LnR5cGUpfSR7bGluZX1gKSk7XG4gIH0pO1xuICBtZXNzYWdlcy5wdXNoKC4uLihzdHJpbmdEaWZmID8gW2RpZmZNZXNzYWdlcy5qb2luKFwiXCIpXSA6IGRpZmZNZXNzYWdlcykpO1xuICBtZXNzYWdlcy5wdXNoKFwiXCIpO1xuXG4gIHJldHVybiBtZXNzYWdlcztcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFDMUUscUNBQXFDO0FBRXJDLFNBQ0UsT0FBTyxFQUNQLEtBQUssRUFDTCxJQUFJLEVBQ0osSUFBSSxFQUNKLEtBQUssRUFDTCxHQUFHLEVBQ0gsS0FBSyxRQUNBLG1CQUFtQjs7VUFPZDs7OztHQUFBLGFBQUE7QUFZWixNQUFNLFVBQVU7QUFDaEIsTUFBTSxTQUFTO0FBQ2YsTUFBTSxRQUFRO0FBRWQsU0FBUyxhQUFnQixDQUFNLEVBQUUsQ0FBTSxFQUFFLE9BQWlCO0VBQ3hELE1BQU0sU0FBUyxFQUFFO0VBQ2pCLElBQUksRUFBRSxNQUFNLEtBQUssS0FBSyxFQUFFLE1BQU0sS0FBSyxHQUFHLE9BQU8sRUFBRTtFQUMvQyxJQUFLLElBQUksSUFBSSxHQUFHLElBQUksS0FBSyxHQUFHLENBQUMsRUFBRSxNQUFNLEVBQUUsRUFBRSxNQUFNLEdBQUcsS0FBSyxFQUFH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