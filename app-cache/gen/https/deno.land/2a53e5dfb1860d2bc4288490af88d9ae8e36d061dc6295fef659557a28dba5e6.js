// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
/** A library of assertion functions.
 *
 * This module is browser compatible, but do not rely on good formatting of
 * values for AssertionError messages in browsers.
 *
 * @module
 */ import { red, stripColor } from "../fmt/colors.ts";
import { buildMessage, diff, diffstr } from "./_diff.ts";
import { format } from "./_format.ts";
const CAN_NOT_DISPLAY = "[Cannot display]";
export class AssertionError extends Error {
  name = "AssertionError";
  constructor(message){
    super(message);
  }
}
function isKeyedCollection(x) {
  return [
    Symbol.iterator,
    "size"
  ].every((k)=>k in x);
}
/**
 * Deep equality comparison used in assertions
 * @param c actual value
 * @param d expected value
 */ export function equal(c, d) {
  const seen = new Map();
  return function compare(a, b) {
    // Have to render RegExp & Date for string comparison
    // unless it's mistreated as object
    if (a && b && (a instanceof RegExp && b instanceof RegExp || a instanceof URL && b instanceof URL)) {
      return String(a) === String(b);
    }
    if (a instanceof Date && b instanceof Date) {
      const aTime = a.getTime();
      const bTime = b.getTime();
      // Check for NaN equality manually since NaN is not
      // equal to itself.
      if (Number.isNaN(aTime) && Number.isNaN(bTime)) {
        return true;
      }
      return aTime === bTime;
    }
    if (typeof a === "number" && typeof b === "number") {
      return Number.isNaN(a) && Number.isNaN(b) || a === b;
    }
    if (Object.is(a, b)) {
      return true;
    }
    if (a && typeof a === "object" && b && typeof b === "object") {
      if (a && b && !constructorsEqual(a, b)) {
        return false;
      }
      if (a instanceof WeakMap || b instanceof WeakMap) {
        if (!(a instanceof WeakMap && b instanceof WeakMap)) return false;
        throw new TypeError("cannot compare WeakMap instances");
      }
      if (a instanceof WeakSet || b instanceof WeakSet) {
        if (!(a instanceof WeakSet && b instanceof WeakSet)) return false;
        throw new TypeError("cannot compare WeakSet instances");
      }
      if (seen.get(a) === b) {
        return true;
      }
      if (Object.keys(a || {}).length !== Object.keys(b || {}).length) {
        return false;
      }
      seen.set(a, b);
      if (isKeyedCollection(a) && isKeyedCollection(b)) {
        if (a.size !== b.size) {
          return false;
        }
        let unmatchedEntries = a.size;
        for (const [aKey, aValue] of a.entries()){
          for (const [bKey, bValue] of b.entries()){
            /* Given that Map keys can be references, we need
             * to ensure that they are also deeply equal */ if (aKey === aValue && bKey === bValue && compare(aKey, bKey) || compare(aKey, bKey) && compare(aValue, bValue)) {
              unmatchedEntries--;
              break;
            }
          }
        }
        return unmatchedEntries === 0;
      }
      const merged = {
        ...a,
        ...b
      };
      for (const key of [
        ...Object.getOwnPropertyNames(merged),
        ...Object.getOwnPropertySymbols(merged)
      ]){
        if (!compare(a && a[key], b && b[key])) {
          return false;
        }
        if (key in a && !(key in b) || key in b && !(key in a)) {
          return false;
        }
      }
      if (a instanceof WeakRef || b instanceof WeakRef) {
        if (!(a instanceof WeakRef && b instanceof WeakRef)) return false;
        return compare(a.deref(), b.deref());
      }
      return true;
    }
    return false;
  }(c, d);
}
// deno-lint-ignore ban-types
function constructorsEqual(a, b) {
  return a.constructor === b.constructor || a.constructor === Object && !b.constructor || !a.constructor && b.constructor === Object;
}
/** Make an assertion, error will be thrown if `expr` does not have truthy value. */ export function assert(expr, msg = "") {
  if (!expr) {
    throw new AssertionError(msg);
  }
}
export function assertFalse(expr, msg = "") {
  if (expr) {
    throw new AssertionError(msg);
  }
}
/**
 * Make an assertion that `actual` and `expected` are equal, deeply. If not
 * deeply equal, then throw.
 *
 * Type parameter can be specified to ensure values under comparison have the same type.
 * For example:
 * ```ts
 * import { assertEquals } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * assertEquals<number>(1, 2)
 * ```
 */ export function assertEquals(actual, expected, msg) {
  if (equal(actual, expected)) {
    return;
  }
  let message = "";
  const actualString = format(actual);
  const expectedString = format(expected);
  try {
    const stringDiff = typeof actual === "string" && typeof expected === "string";
    const diffResult = stringDiff ? diffstr(actual, expected) : diff(actualString.split("\n"), expectedString.split("\n"));
    const diffMsg = buildMessage(diffResult, {
      stringDiff
    }).join("\n");
    message = `Values are not equal:\n${diffMsg}`;
  } catch  {
    message = `\n${red(CAN_NOT_DISPLAY)} + \n\n`;
  }
  if (msg) {
    message = msg;
  }
  throw new AssertionError(message);
}
/**
 * Make an assertion that `actual` and `expected` are not equal, deeply.
 * If not then throw.
 *
 * Type parameter can be specified to ensure values under comparison have the same type.
 * For example:
 * ```ts
 * import { assertNotEquals } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * assertNotEquals<number>(1, 2)
 * ```
 */ export function assertNotEquals(actual, expected, msg) {
  if (!equal(actual, expected)) {
    return;
  }
  let actualString;
  let expectedString;
  try {
    actualString = String(actual);
  } catch  {
    actualString = "[Cannot display]";
  }
  try {
    expectedString = String(expected);
  } catch  {
    expectedString = "[Cannot display]";
  }
  if (!msg) {
    msg = `actual: ${actualString} expected not to be: ${expectedString}`;
  }
  throw new AssertionError(msg);
}
/**
 * Make an assertion that `actual` and `expected` are strictly equal. If
 * not then throw.
 *
 * ```ts
 * import { assertStrictEquals } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * assertStrictEquals(1, 2)
 * ```
 */ export function assertStrictEquals(actual, expected, msg) {
  if (Object.is(actual, expected)) {
    return;
  }
  let message;
  if (msg) {
    message = msg;
  } else {
    const actualString = format(actual);
    const expectedString = format(expected);
    if (actualString === expectedString) {
      const withOffset = actualString.split("\n").map((l)=>`    ${l}`).join("\n");
      message = `Values have the same structure but are not reference-equal:\n\n${red(withOffset)}\n`;
    } else {
      try {
        const stringDiff = typeof actual === "string" && typeof expected === "string";
        const diffResult = stringDiff ? diffstr(actual, expected) : diff(actualString.split("\n"), expectedString.split("\n"));
        const diffMsg = buildMessage(diffResult, {
          stringDiff
        }).join("\n");
        message = `Values are not strictly equal:\n${diffMsg}`;
      } catch  {
        message = `\n${red(CAN_NOT_DISPLAY)} + \n\n`;
      }
    }
  }
  throw new AssertionError(message);
}
/**
 * Make an assertion that `actual` and `expected` are not strictly equal.
 * If the values are strictly equal then throw.
 *
 * ```ts
 * import { assertNotStrictEquals } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * assertNotStrictEquals(1, 1)
 * ```
 */ export function assertNotStrictEquals(actual, expected, msg) {
  if (!Object.is(actual, expected)) {
    return;
  }
  throw new AssertionError(msg ?? `Expected "actual" to be strictly unequal to: ${format(actual)}\n`);
}
/**
 * Make an assertion that `actual` and `expected` are almost equal numbers through
 * a given tolerance. It can be used to take into account IEEE-754 double-precision
 * floating-point representation limitations.
 * If the values are not almost equal then throw.
 *
 * ```ts
 * import { assertAlmostEquals, assertThrows } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * assertAlmostEquals(0.1, 0.2);
 *
 * // Using a custom tolerance value
 * assertAlmostEquals(0.1 + 0.2, 0.3, 1e-16);
 * assertThrows(() => assertAlmostEquals(0.1 + 0.2, 0.3, 1e-17));
 * ```
 */ export function assertAlmostEquals(actual, expected, tolerance = 1e-7, msg) {
  if (Object.is(actual, expected)) {
    return;
  }
  const delta = Math.abs(expected - actual);
  if (delta <= tolerance) {
    return;
  }
  const f = (n)=>Number.isInteger(n) ? n : n.toExponential();
  throw new AssertionError(msg ?? `actual: "${f(actual)}" expected to be close to "${f(expected)}": \
delta "${f(delta)}" is greater than "${f(tolerance)}"`);
}
/**
 * Make an assertion that `obj` is an instance of `type`.
 * If not then throw.
 */ export function assertInstanceOf(actual, expectedType, msg = "") {
  if (!msg) {
    const expectedTypeStr = expectedType.name;
    let actualTypeStr = "";
    if (actual === null) {
      actualTypeStr = "null";
    } else if (actual === undefined) {
      actualTypeStr = "undefined";
    } else if (typeof actual === "object") {
      actualTypeStr = actual.constructor?.name ?? "Object";
    } else {
      actualTypeStr = typeof actual;
    }
    if (expectedTypeStr == actualTypeStr) {
      msg = `Expected object to be an instance of "${expectedTypeStr}".`;
    } else if (actualTypeStr == "function") {
      msg = `Expected object to be an instance of "${expectedTypeStr}" but was not an instanced object.`;
    } else {
      msg = `Expected object to be an instance of "${expectedTypeStr}" but was "${actualTypeStr}".`;
    }
  }
  assert(actual instanceof expectedType, msg);
}
/**
 * Make an assertion that `obj` is not an instance of `type`.
 * If so, then throw.
 */ export function assertNotInstanceOf(actual, // deno-lint-ignore no-explicit-any
unexpectedType, msg = `Expected object to not be an instance of "${typeof unexpectedType}"`) {
  assertFalse(actual instanceof unexpectedType, msg);
}
/**
 * Make an assertion that actual is not null or undefined.
 * If not then throw.
 */ export function assertExists(actual, msg) {
  if (actual === undefined || actual === null) {
    if (!msg) {
      msg = `actual: "${actual}" expected to not be null or undefined`;
    }
    throw new AssertionError(msg);
  }
}
/**
 * Make an assertion that actual includes expected. If not
 * then throw.
 */ export function assertStringIncludes(actual, expected, msg) {
  if (!actual.includes(expected)) {
    if (!msg) {
      msg = `actual: "${actual}" expected to contain: "${expected}"`;
    }
    throw new AssertionError(msg);
  }
}
/**
 * Make an assertion that `actual` includes the `expected` values.
 * If not then an error will be thrown.
 *
 * Type parameter can be specified to ensure values under comparison have the same type.
 * For example:
 *
 * ```ts
 * import { assertArrayIncludes } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * assertArrayIncludes<number>([1, 2], [2])
 * ```
 */ export function assertArrayIncludes(actual, expected, msg) {
  const missing = [];
  for(let i = 0; i < expected.length; i++){
    let found = false;
    for(let j = 0; j < actual.length; j++){
      if (equal(expected[i], actual[j])) {
        found = true;
        break;
      }
    }
    if (!found) {
      missing.push(expected[i]);
    }
  }
  if (missing.length === 0) {
    return;
  }
  if (!msg) {
    msg = `actual: "${format(actual)}" expected to include: "${format(expected)}"\nmissing: ${format(missing)}`;
  }
  throw new AssertionError(msg);
}
/**
 * Make an assertion that `actual` match RegExp `expected`. If not
 * then throw.
 */ export function assertMatch(actual, expected, msg) {
  if (!expected.test(actual)) {
    if (!msg) {
      msg = `actual: "${actual}" expected to match: "${expected}"`;
    }
    throw new AssertionError(msg);
  }
}
/**
 * Make an assertion that `actual` not match RegExp `expected`. If match
 * then throw.
 */ export function assertNotMatch(actual, expected, msg) {
  if (expected.test(actual)) {
    if (!msg) {
      msg = `actual: "${actual}" expected to not match: "${expected}"`;
    }
    throw new AssertionError(msg);
  }
}
/**
 * Make an assertion that `actual` object is a subset of `expected` object, deeply.
 * If not, then throw.
 */ export function assertObjectMatch(// deno-lint-ignore no-explicit-any
actual, expected) {
  function filter(a, b) {
    const seen = new WeakMap();
    return fn(a, b);
    function fn(a, b) {
      // Prevent infinite loop with circular references with same filter
      if (seen.has(a) && seen.get(a) === b) {
        return a;
      }
      seen.set(a, b);
      // Filter keys and symbols which are present in both actual and expected
      const filtered = {};
      const entries = [
        ...Object.getOwnPropertyNames(a),
        ...Object.getOwnPropertySymbols(a)
      ].filter((key)=>key in b).map((key)=>[
          key,
          a[key]
        ]);
      for (const [key, value] of entries){
        // On array references, build a filtered array and filter nested objects inside
        if (Array.isArray(value)) {
          const subset = b[key];
          if (Array.isArray(subset)) {
            filtered[key] = fn({
              ...value
            }, {
              ...subset
            });
            continue;
          }
        } else if (value instanceof RegExp) {
          filtered[key] = value;
          continue;
        } else if (typeof value === "object") {
          const subset = b[key];
          if (typeof subset === "object" && subset) {
            // When both operands are maps, build a filtered map with common keys and filter nested objects inside
            if (value instanceof Map && subset instanceof Map) {
              filtered[key] = new Map([
                ...value
              ].filter(([k])=>subset.has(k)).map(([k, v])=>[
                  k,
                  typeof v === "object" ? fn(v, subset.get(k)) : v
                ]));
              continue;
            }
            // When both operands are set, build a filtered set with common values
            if (value instanceof Set && subset instanceof Set) {
              filtered[key] = new Set([
                ...value
              ].filter((v)=>subset.has(v)));
              continue;
            }
            filtered[key] = fn(value, subset);
            continue;
          }
        }
        filtered[key] = value;
      }
      return filtered;
    }
  }
  return assertEquals(// get the intersection of "actual" and "expected"
  // side effect: all the instances' constructor field is "Object" now.
  filter(actual, expected), // set (nested) instances' constructor field to be "Object" without changing expected value.
  // see https://github.com/denoland/deno_std/pull/1419
  filter(expected, expected));
}
/**
 * Forcefully throws a failed assertion
 */ export function fail(msg) {
  assert(false, `Failed assertion${msg ? `: ${msg}` : "."}`);
}
/**
 * Make an assertion that `error` is an `Error`.
 * If not then an error will be thrown.
 * An error class and a string that should be included in the
 * error message can also be asserted.
 */ export function assertIsError(error, // deno-lint-ignore no-explicit-any
ErrorClass, msgIncludes, msg) {
  if (error instanceof Error === false) {
    throw new AssertionError(`Expected "error" to be an Error object.`);
  }
  if (ErrorClass && !(error instanceof ErrorClass)) {
    msg = `Expected error to be instance of "${ErrorClass.name}", but was "${typeof error === "object" ? error?.constructor?.name : "[not an object]"}"${msg ? `: ${msg}` : "."}`;
    throw new AssertionError(msg);
  }
  if (msgIncludes && (!(error instanceof Error) || !stripColor(error.message).includes(stripColor(msgIncludes)))) {
    msg = `Expected error message to include "${msgIncludes}", but got "${error instanceof Error ? error.message : "[not an Error]"}"${msg ? `: ${msg}` : "."}`;
    throw new AssertionError(msg);
  }
}
export function assertThrows(fn, errorClassOrMsg, msgIncludesOrMsg, msg) {
  // deno-lint-ignore no-explicit-any
  let ErrorClass = undefined;
  let msgIncludes = undefined;
  let err;
  if (typeof errorClassOrMsg !== "string") {
    if (errorClassOrMsg === undefined || errorClassOrMsg.prototype instanceof Error || errorClassOrMsg.prototype === Error.prototype) {
      // deno-lint-ignore no-explicit-any
      ErrorClass = errorClassOrMsg;
      msgIncludes = msgIncludesOrMsg;
    } else {
      msg = msgIncludesOrMsg;
    }
  } else {
    msg = errorClassOrMsg;
  }
  let doesThrow = false;
  const msgToAppendToError = msg ? `: ${msg}` : ".";
  try {
    fn();
  } catch (error) {
    if (ErrorClass) {
      if (error instanceof Error === false) {
        throw new AssertionError("A non-Error object was thrown.");
      }
      assertIsError(error, ErrorClass, msgIncludes, msg);
    }
    err = error;
    doesThrow = true;
  }
  if (!doesThrow) {
    msg = `Expected function to throw${msgToAppendToError}`;
    throw new AssertionError(msg);
  }
  return err;
}
export async function assertRejects(fn, errorClassOrMsg, msgIncludesOrMsg, msg) {
  // deno-lint-ignore no-explicit-any
  let ErrorClass = undefined;
  let msgIncludes = undefined;
  let err;
  if (typeof errorClassOrMsg !== "string") {
    if (errorClassOrMsg === undefined || errorClassOrMsg.prototype instanceof Error || errorClassOrMsg.prototype === Error.prototype) {
      // deno-lint-ignore no-explicit-any
      ErrorClass = errorClassOrMsg;
      msgIncludes = msgIncludesOrMsg;
    }
  } else {
    msg = errorClassOrMsg;
  }
  let doesThrow = false;
  let isPromiseReturned = false;
  const msgToAppendToError = msg ? `: ${msg}` : ".";
  try {
    const possiblePromise = fn();
    if (possiblePromise && typeof possiblePromise === "object" && typeof possiblePromise.then === "function") {
      isPromiseReturned = true;
      await possiblePromise;
    }
  } catch (error) {
    if (!isPromiseReturned) {
      throw new AssertionError(`Function throws when expected to reject${msgToAppendToError}`);
    }
    if (ErrorClass) {
      if (error instanceof Error === false) {
        throw new AssertionError("A non-Error object was rejected.");
      }
      assertIsError(error, ErrorClass, msgIncludes, msg);
    }
    err = error;
    doesThrow = true;
  }
  if (!doesThrow) {
    throw new AssertionError(`Expected function to reject${msgToAppendToError}`);
  }
  return err;
}
/** Use this to stub out methods that will throw when invoked. */ export function unimplemented(msg) {
  throw new AssertionError(msg || "unimplemented");
}
/** Use this to assert unreachable code. */ export function unreachable() {
  throw new AssertionError("unreachable");
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2MC4wL3Rlc3RpbmcvYXNzZXJ0cy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuXG4vKiogQSBsaWJyYXJ5IG9mIGFzc2VydGlvbiBmdW5jdGlvbnMuXG4gKlxuICogVGhpcyBtb2R1bGUgaXMgYnJvd3NlciBjb21wYXRpYmxlLCBidXQgZG8gbm90IHJlbHkgb24gZ29vZCBmb3JtYXR0aW5nIG9mXG4gKiB2YWx1ZXMgZm9yIEFzc2VydGlvbkVycm9yIG1lc3NhZ2VzIGluIGJyb3dzZXJzLlxuICpcbiAqIEBtb2R1bGVcbiAqL1xuXG5pbXBvcnQgeyByZWQsIHN0cmlwQ29sb3IgfSBmcm9tIFwiLi4vZm10L2NvbG9ycy50c1wiO1xuaW1wb3J0IHsgYnVpbGRNZXNzYWdlLCBkaWZmLCBkaWZmc3RyIH0gZnJvbSBcIi4vX2RpZmYudHNcIjtcbmltcG9ydCB7IGZvcm1hdCB9IGZyb20gXCIuL19mb3JtYXQudHNcIjtcblxuY29uc3QgQ0FOX05PVF9ESVNQTEFZID0gXCJbQ2Fubm90IGRpc3BsYXldXCI7XG5cbmV4cG9ydCBjbGFzcyBBc3NlcnRpb25FcnJvciBleHRlbmRzIEVycm9yIHtcbiAgb3ZlcnJpZGUgbmFtZSA9IFwiQXNzZXJ0aW9uRXJyb3JcIjtcbiAgY29uc3RydWN0b3IobWVzc2FnZTogc3RyaW5nKSB7XG4gICAgc3VwZXIobWVzc2FnZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNLZXllZENvbGxlY3Rpb24oeDogdW5rbm93bik6IHggaXMgU2V0PHVua25vd24+IHtcbiAgcmV0dXJuIFtTeW1ib2wuaXRlcmF0b3IsIFwic2l6ZVwiXS5ldmVyeSgoaykgPT4gayBpbiAoeCBhcyBTZXQ8dW5rbm93bj4pKTtcbn1cblxuLyoqXG4gKiBEZWVwIGVxdWFsaXR5IGNvbXBhcmlzb24gdXNlZCBpbiBhc3NlcnRpb25zXG4gKiBAcGFyYW0gYyBhY3R1YWwgdmFsdWVcbiAqIEBwYXJhbSBkIGV4cGVjdGVkIHZhbHVlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBlcXVhbChjOiB1bmtub3duLCBkOiB1bmtub3duKTogYm9vbGVhbiB7XG4gIGNvbnN0IHNlZW4gPSBuZXcgTWFwKCk7XG4gIHJldHVybiAoZnVuY3Rpb24gY29tcGFyZShhOiB1bmtub3duLCBiOiB1bmtub3duKTogYm9vbGVhbiB7XG4gICAgLy8gSGF2ZSB0byByZW5kZXIgUmVnRXhwICYgRGF0ZSBmb3Igc3RyaW5nIGNvbXBhcmlzb25cbiAgICAvLyB1bmxlc3MgaXQncyBtaXN0cmVhdGVkIGFzIG9iamVjdFxuICAgIGlmIChcbiAgICAgIGEgJiZcbiAgICAgIGIgJiZcbiAgICAgICgoYSBpbnN0YW5jZW9mIFJlZ0V4cCAmJiBiIGluc3RhbmNlb2YgUmVnRXhwKSB8fFxuICAgICAgICAoYSBpbnN0YW5jZW9mIFVSTCAmJiBiIGluc3RhbmNlb2YgVVJMKSlcbiAgICApIHtcbiAgICAgIHJldHVybiBTdHJpbmcoYSkgPT09IFN0cmluZyhiKTtcbiAgICB9XG4gICAgaWYgKGEgaW5zdGFuY2VvZiBEYXRlICYmIGIgaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgICBjb25zdCBhVGltZSA9IGEuZ2V0VGltZSgpO1xuICAgICAgY29uc3QgYlRpbWUgPSBiLmdldFRpbWUoKTtcbiAgICAgIC8vIENoZWNrIGZvciBOYU4gZXF1YWxpdHkgbWFudWFsbHkgc2luY2UgTmFOIGlzIG5vdFxuICAgICAgLy8gZXF1YWwgdG8gaXRzZWxmLlxuICAgICAgaWYgKE51bWJlci5pc05hTihhVGltZSkgJiYgTnVtYmVyLmlzTmFOKGJUaW1lKSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBhVGltZSA9PT0gYlRpbWU7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgYSA9PT0gXCJudW1iZXJcIiAmJiB0eXBlb2YgYiA9PT0gXCJudW1iZXJcIikge1xuICAgICAgcmV0dXJuIE51bWJlci5pc05hTihhKSAmJiBOdW1iZXIuaXNOYU4oYikgfHwgYSA9PT0gYjtcbiAgICB9XG4gICAgaWYgKE9iamVjdC5pcyhhLCBiKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIGlmIChhICYmIHR5cGVvZiBhID09PSBcIm9iamVjdFwiICYmIGIgJiYgdHlwZW9mIGIgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgIGlmIChhICYmIGIgJiYgIWNvbnN0cnVjdG9yc0VxdWFsKGEsIGIpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIGlmIChhIGluc3RhbmNlb2YgV2Vha01hcCB8fCBiIGluc3RhbmNlb2YgV2Vha01hcCkge1xuICAgICAgICBpZiAoIShhIGluc3RhbmNlb2YgV2Vha01hcCAmJiBiIGluc3RhbmNlb2YgV2Vha01hcCkpIHJldHVybiBmYWxzZTtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImNhbm5vdCBjb21wYXJlIFdlYWtNYXAgaW5zdGFuY2VzXCIpO1xuICAgICAgfVxuICAgICAgaWYgKGEgaW5zdGFuY2VvZiBXZWFrU2V0IHx8IGIgaW5zdGFuY2VvZiBXZWFrU2V0KSB7XG4gICAgICAgIGlmICghKGEgaW5zdGFuY2VvZiBXZWFrU2V0ICYmIGIgaW5zdGFuY2VvZiBXZWFrU2V0KSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiY2Fubm90IGNvbXBhcmUgV2Vha1NldCBpbnN0YW5jZXNcIik7XG4gICAgICB9XG4gICAgICBpZiAoc2Vlbi5nZXQoYSkgPT09IGIpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgICBpZiAoT2JqZWN0LmtleXMoYSB8fCB7fSkubGVuZ3RoICE9PSBPYmplY3Qua2V5cyhiIHx8IHt9KS5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgc2Vlbi5zZXQoYSwgYik7XG4gICAgICBpZiAoaXNLZXllZENvbGxlY3Rpb24oYSkgJiYgaXNLZXllZENvbGxlY3Rpb24oYikpIHtcbiAgICAgICAgaWYgKGEuc2l6ZSAhPT0gYi5zaXplKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHVubWF0Y2hlZEVudHJpZXMgPSBhLnNpemU7XG5cbiAgICAgICAgZm9yIChjb25zdCBbYUtleSwgYVZhbHVlXSBvZiBhLmVudHJpZXMoKSkge1xuICAgICAgICAgIGZvciAoY29uc3QgW2JLZXksIGJWYWx1ZV0gb2YgYi5lbnRyaWVzKCkpIHtcbiAgICAgICAgICAgIC8qIEdpdmVuIHRoYXQgTWFwIGtleXMgY2FuIGJlIHJlZmVyZW5jZXMsIHdlIG5lZWRcbiAgICAgICAgICAgICAqIHRvIGVuc3VyZSB0aGF0IHRoZXkgYXJlIGFsc28gZGVlcGx5IGVxdWFsICovXG4gICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgIChhS2V5ID09PSBhVmFsdWUgJiYgYktleSA9PT0gYlZhbHVlICYmIGNvbXBhcmUoYUtleSwgYktleSkpIHx8XG4gICAgICAgICAgICAgIChjb21wYXJlKGFLZXksIGJLZXkpICYmIGNvbXBhcmUoYVZhbHVlLCBiVmFsdWUpKVxuICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgIHVubWF0Y2hlZEVudHJpZXMtLTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHVubWF0Y2hlZEVudHJpZXMgPT09IDA7XG4gICAgICB9XG4gICAgICBjb25zdCBtZXJnZWQgPSB7IC4uLmEsIC4uLmIgfTtcbiAgICAgIGZvciAoXG4gICAgICAgIGNvbnN0IGtleSBvZiBbXG4gICAgICAgICAgLi4uT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMobWVyZ2VkKSxcbiAgICAgICAgICAuLi5PYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzKG1lcmdlZCksXG4gICAgICAgIF1cbiAgICAgICkge1xuICAgICAgICB0eXBlIEtleSA9IGtleW9mIHR5cGVvZiBtZXJnZWQ7XG4gICAgICAgIGlmICghY29tcGFyZShhICYmIGFba2V5IGFzIEtleV0sIGIgJiYgYltrZXkgYXMgS2V5XSkpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCgoa2V5IGluIGEpICYmICghKGtleSBpbiBiKSkpIHx8ICgoa2V5IGluIGIpICYmICghKGtleSBpbiBhKSkpKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoYSBpbnN0YW5jZW9mIFdlYWtSZWYgfHwgYiBpbnN0YW5jZW9mIFdlYWtSZWYpIHtcbiAgICAgICAgaWYgKCEoYSBpbnN0YW5jZW9mIFdlYWtSZWYgJiYgYiBpbnN0YW5jZW9mIFdlYWtSZWYpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHJldHVybiBjb21wYXJlKGEuZGVyZWYoKSwgYi5kZXJlZigpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH0pKGMsIGQpO1xufVxuXG4vLyBkZW5vLWxpbnQtaWdub3JlIGJhbi10eXBlc1xuZnVuY3Rpb24gY29uc3RydWN0b3JzRXF1YWwoYTogb2JqZWN0LCBiOiBvYmplY3QpIHtcbiAgcmV0dXJuIGEuY29uc3RydWN0b3IgPT09IGIuY29uc3RydWN0b3IgfHxcbiAgICBhLmNvbnN0cnVjdG9yID09PSBPYmplY3QgJiYgIWIuY29uc3RydWN0b3IgfHxcbiAgICAhYS5jb25zdHJ1Y3RvciAmJiBiLmNvbnN0cnVjdG9yID09PSBPYmplY3Q7XG59XG5cbi8qKiBNYWtlIGFuIGFzc2VydGlvbiwgZXJyb3Igd2lsbCBiZSB0aHJvd24gaWYgYGV4cHJgIGRvZXMgbm90IGhhdmUgdHJ1dGh5IHZhbHVlLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydChleHByOiB1bmtub3duLCBtc2cgPSBcIlwiKTogYXNzZXJ0cyBleHByIHtcbiAgaWYgKCFleHByKSB7XG4gICAgdGhyb3cgbmV3IEFzc2VydGlvbkVycm9yKG1zZyk7XG4gIH1cbn1cblxuLyoqIE1ha2UgYW4gYXNzZXJ0aW9uLCBlcnJvciB3aWxsIGJlIHRocm93biBpZiBgZXhwcmAgaGF2ZSB0cnV0aHkgdmFsdWUuICovXG50eXBlIEZhbHN5ID0gZmFsc2UgfCAwIHwgMG4gfCBcIlwiIHwgbnVsbCB8IHVuZGVmaW5lZDtcbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRGYWxzZShleHByOiB1bmtub3duLCBtc2cgPSBcIlwiKTogYXNzZXJ0cyBleHByIGlzIEZhbHN5IHtcbiAgaWYgKGV4cHIpIHtcbiAgICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3IobXNnKTtcbiAgfVxufVxuXG4vKipcbiAqIE1ha2UgYW4gYXNzZXJ0aW9uIHRoYXQgYGFjdHVhbGAgYW5kIGBleHBlY3RlZGAgYXJlIGVxdWFsLCBkZWVwbHkuIElmIG5vdFxuICogZGVlcGx5IGVxdWFsLCB0aGVuIHRocm93LlxuICpcbiAqIFR5cGUgcGFyYW1ldGVyIGNhbiBiZSBzcGVjaWZpZWQgdG8gZW5zdXJlIHZhbHVlcyB1bmRlciBjb21wYXJpc29uIGhhdmUgdGhlIHNhbWUgdHlwZS5cbiAqIEZvciBleGFtcGxlOlxuICogYGBgdHNcbiAqIGltcG9ydCB7IGFzc2VydEVxdWFscyB9IGZyb20gXCJodHRwczovL2Rlbm8ubGFuZC9zdGRAJFNURF9WRVJTSU9OL3Rlc3RpbmcvYXNzZXJ0cy50c1wiO1xuICpcbiAqIGFzc2VydEVxdWFsczxudW1iZXI+KDEsIDIpXG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydEVxdWFsczxUPihhY3R1YWw6IFQsIGV4cGVjdGVkOiBULCBtc2c/OiBzdHJpbmcpIHtcbiAgaWYgKGVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQpKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGxldCBtZXNzYWdlID0gXCJcIjtcbiAgY29uc3QgYWN0dWFsU3RyaW5nID0gZm9ybWF0KGFjdHVhbCk7XG4gIGNvbnN0IGV4cGVjdGVkU3RyaW5nID0gZm9ybWF0KGV4cGVjdGVkKTtcbiAgdHJ5IHtcbiAgICBjb25zdCBzdHJpbmdEaWZmID0gKHR5cGVvZiBhY3R1YWwgPT09IFwic3RyaW5nXCIpICYmXG4gICAgICAodHlwZW9mIGV4cGVjdGVkID09PSBcInN0cmluZ1wiKTtcbiAgICBjb25zdCBkaWZmUmVzdWx0ID0gc3RyaW5nRGlmZlxuICAgICAgPyBkaWZmc3RyKGFjdHVhbCBhcyBzdHJpbmcsIGV4cGVjdGVkIGFzIHN0cmluZylcbiAgICAgIDogZGlmZihhY3R1YWxTdHJpbmcuc3BsaXQoXCJcXG5cIiksIGV4cGVjdGVkU3RyaW5nLnNwbGl0KFwiXFxuXCIpKTtcbiAgICBjb25zdCBkaWZmTXNnID0gYnVpbGRNZXNzYWdlKGRpZmZSZXN1bHQsIHsgc3RyaW5nRGlmZiB9KS5qb2luKFwiXFxuXCIpO1xuICAgIG1lc3NhZ2UgPSBgVmFsdWVzIGFyZSBub3QgZXF1YWw6XFxuJHtkaWZmTXNnfWA7XG4gIH0gY2F0Y2gge1xuICAgIG1lc3NhZ2UgPSBgXFxuJHtyZWQoQ0FOX05PVF9ESVNQTEFZKX0gKyBcXG5cXG5gO1xuICB9XG4gIGlmIChtc2cpIHtcbiAgICBtZXNzYWdlID0gbXNnO1xuICB9XG4gIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcihtZXNzYWdlKTtcbn1cblxuLyoqXG4gKiBNYWtlIGFuIGFzc2VydGlvbiB0aGF0IGBhY3R1YWxgIGFuZCBgZXhwZWN0ZWRgIGFyZSBub3QgZXF1YWwsIGRlZXBseS5cbiAqIElmIG5vdCB0aGVuIHRocm93LlxuICpcbiAqIFR5cGUgcGFyYW1ldGVyIGNhbiBiZSBzcGVjaWZpZWQgdG8gZW5zdXJlIHZhbHVlcyB1bmRlciBjb21wYXJpc29uIGhhdmUgdGhlIHNhbWUgdHlwZS5cbiAqIEZvciBleGFtcGxlOlxuICogYGBgdHNcbiAqIGltcG9ydCB7IGFzc2VydE5vdEVxdWFscyB9IGZyb20gXCJodHRwczovL2Rlbm8ubGFuZC9zdGRAJFNURF9WRVJTSU9OL3Rlc3RpbmcvYXNzZXJ0cy50c1wiO1xuICpcbiAqIGFzc2VydE5vdEVxdWFsczxudW1iZXI+KDEsIDIpXG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydE5vdEVxdWFsczxUPihhY3R1YWw6IFQsIGV4cGVjdGVkOiBULCBtc2c/OiBzdHJpbmcpIHtcbiAgaWYgKCFlcXVhbChhY3R1YWwsIGV4cGVjdGVkKSkge1xuICAgIHJldHVybjtcbiAgfVxuICBsZXQgYWN0dWFsU3RyaW5nOiBzdHJpbmc7XG4gIGxldCBleHBlY3RlZFN0cmluZzogc3RyaW5nO1xuICB0cnkge1xuICAgIGFjdHVhbFN0cmluZyA9IFN0cmluZyhhY3R1YWwpO1xuICB9IGNhdGNoIHtcbiAgICBhY3R1YWxTdHJpbmcgPSBcIltDYW5ub3QgZGlzcGxheV1cIjtcbiAgfVxuICB0cnkge1xuICAgIGV4cGVjdGVkU3RyaW5nID0gU3RyaW5nKGV4cGVjdGVkKTtcbiAgfSBjYXRjaCB7XG4gICAgZXhwZWN0ZWRTdHJpbmcgPSBcIltDYW5ub3QgZGlzcGxheV1cIjtcbiAgfVxuICBpZiAoIW1zZykge1xuICAgIG1zZyA9IGBhY3R1YWw6ICR7YWN0dWFsU3RyaW5nfSBleHBlY3RlZCBub3QgdG8gYmU6ICR7ZXhwZWN0ZWRTdHJpbmd9YDtcbiAgfVxuICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3IobXNnKTtcbn1cblxuLyoqXG4gKiBNYWtlIGFuIGFzc2VydGlvbiB0aGF0IGBhY3R1YWxgIGFuZCBgZXhwZWN0ZWRgIGFyZSBzdHJpY3RseSBlcXVhbC4gSWZcbiAqIG5vdCB0aGVuIHRocm93LlxuICpcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBhc3NlcnRTdHJpY3RFcXVhbHMgfSBmcm9tIFwiaHR0cHM6Ly9kZW5vLmxhbmQvc3RkQCRTVERfVkVSU0lPTi90ZXN0aW5nL2Fzc2VydHMudHNcIjtcbiAqXG4gKiBhc3NlcnRTdHJpY3RFcXVhbHMoMSwgMilcbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0U3RyaWN0RXF1YWxzPFQ+KFxuICBhY3R1YWw6IHVua25vd24sXG4gIGV4cGVjdGVkOiBULFxuICBtc2c/OiBzdHJpbmcsXG4pOiBhc3NlcnRzIGFjdHVhbCBpcyBUIHtcbiAgaWYgKE9iamVjdC5pcyhhY3R1YWwsIGV4cGVjdGVkKSkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGxldCBtZXNzYWdlOiBzdHJpbmc7XG5cbiAgaWYgKG1zZykge1xuICAgIG1lc3NhZ2UgPSBtc2c7XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgYWN0dWFsU3RyaW5nID0gZm9ybWF0KGFjdHVhbCk7XG4gICAgY29uc3QgZXhwZWN0ZWRTdHJpbmcgPSBmb3JtYXQoZXhwZWN0ZWQpO1xuXG4gICAgaWYgKGFjdHVhbFN0cmluZyA9PT0gZXhwZWN0ZWRTdHJpbmcpIHtcbiAgICAgIGNvbnN0IHdpdGhPZmZzZXQgPSBhY3R1YWxTdHJpbmdcbiAgICAgICAgLnNwbGl0KFwiXFxuXCIpXG4gICAgICAgIC5tYXAoKGwpID0+IGAgICAgJHtsfWApXG4gICAgICAgIC5qb2luKFwiXFxuXCIpO1xuICAgICAgbWVzc2FnZSA9XG4gICAgICAgIGBWYWx1ZXMgaGF2ZSB0aGUgc2FtZSBzdHJ1Y3R1cmUgYnV0IGFyZSBub3QgcmVmZXJlbmNlLWVxdWFsOlxcblxcbiR7XG4gICAgICAgICAgcmVkKHdpdGhPZmZzZXQpXG4gICAgICAgIH1cXG5gO1xuICAgIH0gZWxzZSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBzdHJpbmdEaWZmID0gKHR5cGVvZiBhY3R1YWwgPT09IFwic3RyaW5nXCIpICYmXG4gICAgICAgICAgKHR5cGVvZiBleHBlY3RlZCA9PT0gXCJzdHJpbmdcIik7XG4gICAgICAgIGNvbnN0IGRpZmZSZXN1bHQgPSBzdHJpbmdEaWZmXG4gICAgICAgICAgPyBkaWZmc3RyKGFjdHVhbCBhcyBzdHJpbmcsIGV4cGVjdGVkIGFzIHN0cmluZylcbiAgICAgICAgICA6IGRpZmYoYWN0dWFsU3RyaW5nLnNwbGl0KFwiXFxuXCIpLCBleHBlY3RlZFN0cmluZy5zcGxpdChcIlxcblwiKSk7XG4gICAgICAgIGNvbnN0IGRpZmZNc2cgPSBidWlsZE1lc3NhZ2UoZGlmZlJlc3VsdCwgeyBzdHJpbmdEaWZmIH0pLmpvaW4oXCJcXG5cIik7XG4gICAgICAgIG1lc3NhZ2UgPSBgVmFsdWVzIGFyZSBub3Qgc3RyaWN0bHkgZXF1YWw6XFxuJHtkaWZmTXNnfWA7XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgbWVzc2FnZSA9IGBcXG4ke3JlZChDQU5fTk9UX0RJU1BMQVkpfSArIFxcblxcbmA7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgdGhyb3cgbmV3IEFzc2VydGlvbkVycm9yKG1lc3NhZ2UpO1xufVxuXG4vKipcbiAqIE1ha2UgYW4gYXNzZXJ0aW9uIHRoYXQgYGFjdHVhbGAgYW5kIGBleHBlY3RlZGAgYXJlIG5vdCBzdHJpY3RseSBlcXVhbC5cbiAqIElmIHRoZSB2YWx1ZXMgYXJlIHN0cmljdGx5IGVxdWFsIHRoZW4gdGhyb3cuXG4gKlxuICogYGBgdHNcbiAqIGltcG9ydCB7IGFzc2VydE5vdFN0cmljdEVxdWFscyB9IGZyb20gXCJodHRwczovL2Rlbm8ubGFuZC9zdGRAJFNURF9WRVJTSU9OL3Rlc3RpbmcvYXNzZXJ0cy50c1wiO1xuICpcbiAqIGFzc2VydE5vdFN0cmljdEVxdWFscygxLCAxKVxuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnROb3RTdHJpY3RFcXVhbHM8VD4oXG4gIGFjdHVhbDogVCxcbiAgZXhwZWN0ZWQ6IFQsXG4gIG1zZz86IHN0cmluZyxcbikge1xuICBpZiAoIU9iamVjdC5pcyhhY3R1YWwsIGV4cGVjdGVkKSkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcihcbiAgICBtc2cgPz8gYEV4cGVjdGVkIFwiYWN0dWFsXCIgdG8gYmUgc3RyaWN0bHkgdW5lcXVhbCB0bzogJHtmb3JtYXQoYWN0dWFsKX1cXG5gLFxuICApO1xufVxuXG4vKipcbiAqIE1ha2UgYW4gYXNzZXJ0aW9uIHRoYXQgYGFjdHVhbGAgYW5kIGBleHBlY3RlZGAgYXJlIGFsbW9zdCBlcXVhbCBudW1iZXJzIHRocm91Z2hcbiAqIGEgZ2l2ZW4gdG9sZXJhbmNlLiBJdCBjYW4gYmUgdXNlZCB0byB0YWtlIGludG8gYWNjb3VudCBJRUVFLTc1NCBkb3VibGUtcHJlY2lzaW9uXG4gKiBmbG9hdGluZy1wb2ludCByZXByZXNlbnRhdGlvbiBsaW1pdGF0aW9ucy5cbiAqIElmIHRoZSB2YWx1ZXMgYXJlIG5vdCBhbG1vc3QgZXF1YWwgdGhlbiB0aHJvdy5cbiAqXG4gKiBgYGB0c1xuICogaW1wb3J0IHsgYXNzZXJ0QWxtb3N0RXF1YWxzLCBhc3NlcnRUaHJvd3MgfSBmcm9tIFwiaHR0cHM6Ly9kZW5vLmxhbmQvc3RkQCRTVERfVkVSU0lPTi90ZXN0aW5nL2Fzc2VydHMudHNcIjtcbiAqXG4gKiBhc3NlcnRBbG1vc3RFcXVhbHMoMC4xLCAwLjIpO1xuICpcbiAqIC8vIFVzaW5nIGEgY3VzdG9tIHRvbGVyYW5jZSB2YWx1ZVxuICogYXNzZXJ0QWxtb3N0RXF1YWxzKDAuMSArIDAuMiwgMC4zLCAxZS0xNik7XG4gKiBhc3NlcnRUaHJvd3MoKCkgPT4gYXNzZXJ0QWxtb3N0RXF1YWxzKDAuMSArIDAuMiwgMC4zLCAxZS0xNykpO1xuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRBbG1vc3RFcXVhbHMoXG4gIGFjdHVhbDogbnVtYmVyLFxuICBleHBlY3RlZDogbnVtYmVyLFxuICB0b2xlcmFuY2UgPSAxZS03LFxuICBtc2c/OiBzdHJpbmcsXG4pIHtcbiAgaWYgKE9iamVjdC5pcyhhY3R1YWwsIGV4cGVjdGVkKSkge1xuICAgIHJldHVybjtcbiAgfVxuICBjb25zdCBkZWx0YSA9IE1hdGguYWJzKGV4cGVjdGVkIC0gYWN0dWFsKTtcbiAgaWYgKGRlbHRhIDw9IHRvbGVyYW5jZSkge1xuICAgIHJldHVybjtcbiAgfVxuICBjb25zdCBmID0gKG46IG51bWJlcikgPT4gTnVtYmVyLmlzSW50ZWdlcihuKSA/IG4gOiBuLnRvRXhwb25lbnRpYWwoKTtcbiAgdGhyb3cgbmV3IEFzc2VydGlvbkVycm9yKFxuICAgIG1zZyA/P1xuICAgICAgYGFjdHVhbDogXCIke2YoYWN0dWFsKX1cIiBleHBlY3RlZCB0byBiZSBjbG9zZSB0byBcIiR7ZihleHBlY3RlZCl9XCI6IFxcXG5kZWx0YSBcIiR7ZihkZWx0YSl9XCIgaXMgZ3JlYXRlciB0aGFuIFwiJHtmKHRvbGVyYW5jZSl9XCJgLFxuICApO1xufVxuXG4vLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxudHlwZSBBbnlDb25zdHJ1Y3RvciA9IG5ldyAoLi4uYXJnczogYW55W10pID0+IGFueTtcbnR5cGUgR2V0Q29uc3RydWN0b3JUeXBlPFQgZXh0ZW5kcyBBbnlDb25zdHJ1Y3Rvcj4gPSBUIGV4dGVuZHMgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbm5ldyAoLi4uYXJnczogYW55KSA9PiBpbmZlciBDID8gQ1xuICA6IG5ldmVyO1xuXG4vKipcbiAqIE1ha2UgYW4gYXNzZXJ0aW9uIHRoYXQgYG9iamAgaXMgYW4gaW5zdGFuY2Ugb2YgYHR5cGVgLlxuICogSWYgbm90IHRoZW4gdGhyb3cuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRJbnN0YW5jZU9mPFQgZXh0ZW5kcyBBbnlDb25zdHJ1Y3Rvcj4oXG4gIGFjdHVhbDogdW5rbm93bixcbiAgZXhwZWN0ZWRUeXBlOiBULFxuICBtc2cgPSBcIlwiLFxuKTogYXNzZXJ0cyBhY3R1YWwgaXMgR2V0Q29uc3RydWN0b3JUeXBlPFQ+IHtcbiAgaWYgKCFtc2cpIHtcbiAgICBjb25zdCBleHBlY3RlZFR5cGVTdHIgPSBleHBlY3RlZFR5cGUubmFtZTtcblxuICAgIGxldCBhY3R1YWxUeXBlU3RyID0gXCJcIjtcbiAgICBpZiAoYWN0dWFsID09PSBudWxsKSB7XG4gICAgICBhY3R1YWxUeXBlU3RyID0gXCJudWxsXCI7XG4gICAgfSBlbHNlIGlmIChhY3R1YWwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgYWN0dWFsVHlwZVN0ciA9IFwidW5kZWZpbmVkXCI7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgYWN0dWFsID09PSBcIm9iamVjdFwiKSB7XG4gICAgICBhY3R1YWxUeXBlU3RyID0gYWN0dWFsLmNvbnN0cnVjdG9yPy5uYW1lID8/IFwiT2JqZWN0XCI7XG4gICAgfSBlbHNlIHtcbiAgICAgIGFjdHVhbFR5cGVTdHIgPSB0eXBlb2YgYWN0dWFsO1xuICAgIH1cblxuICAgIGlmIChleHBlY3RlZFR5cGVTdHIgPT0gYWN0dWFsVHlwZVN0cikge1xuICAgICAgbXNnID0gYEV4cGVjdGVkIG9iamVjdCB0byBiZSBhbiBpbnN0YW5jZSBvZiBcIiR7ZXhwZWN0ZWRUeXBlU3RyfVwiLmA7XG4gICAgfSBlbHNlIGlmIChhY3R1YWxUeXBlU3RyID09IFwiZnVuY3Rpb25cIikge1xuICAgICAgbXNnID1cbiAgICAgICAgYEV4cGVjdGVkIG9iamVjdCB0byBiZSBhbiBpbnN0YW5jZSBvZiBcIiR7ZXhwZWN0ZWRUeXBlU3RyfVwiIGJ1dCB3YXMgbm90IGFuIGluc3RhbmNlZCBvYmplY3QuYDtcbiAgICB9IGVsc2Uge1xuICAgICAgbXNnID1cbiAgICAgICAgYEV4cGVjdGVkIG9iamVjdCB0byBiZSBhbiBpbnN0YW5jZSBvZiBcIiR7ZXhwZWN0ZWRUeXBlU3RyfVwiIGJ1dCB3YXMgXCIke2FjdHVhbFR5cGVTdHJ9XCIuYDtcbiAgICB9XG4gIH1cbiAgYXNzZXJ0KGFjdHVhbCBpbnN0YW5jZW9mIGV4cGVjdGVkVHlwZSwgbXNnKTtcbn1cblxuLyoqXG4gKiBNYWtlIGFuIGFzc2VydGlvbiB0aGF0IGBvYmpgIGlzIG5vdCBhbiBpbnN0YW5jZSBvZiBgdHlwZWAuXG4gKiBJZiBzbywgdGhlbiB0aHJvdy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydE5vdEluc3RhbmNlT2Y8QSwgVD4oXG4gIGFjdHVhbDogQSxcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgdW5leHBlY3RlZFR5cGU6IG5ldyAoLi4uYXJnczogYW55W10pID0+IFQsXG4gIG1zZyA9IGBFeHBlY3RlZCBvYmplY3QgdG8gbm90IGJlIGFuIGluc3RhbmNlIG9mIFwiJHt0eXBlb2YgdW5leHBlY3RlZFR5cGV9XCJgLFxuKTogYXNzZXJ0cyBhY3R1YWwgaXMgRXhjbHVkZTxBLCBUPiB7XG4gIGFzc2VydEZhbHNlKGFjdHVhbCBpbnN0YW5jZW9mIHVuZXhwZWN0ZWRUeXBlLCBtc2cpO1xufVxuXG4vKipcbiAqIE1ha2UgYW4gYXNzZXJ0aW9uIHRoYXQgYWN0dWFsIGlzIG5vdCBudWxsIG9yIHVuZGVmaW5lZC5cbiAqIElmIG5vdCB0aGVuIHRocm93LlxuICovXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0RXhpc3RzPFQ+KFxuICBhY3R1YWw6IFQsXG4gIG1zZz86IHN0cmluZyxcbik6IGFzc2VydHMgYWN0dWFsIGlzIE5vbk51bGxhYmxlPFQ+IHtcbiAgaWYgKGFjdHVhbCA9PT0gdW5kZWZpbmVkIHx8IGFjdHVhbCA9PT0gbnVsbCkge1xuICAgIGlmICghbXNnKSB7XG4gICAgICBtc2cgPSBgYWN0dWFsOiBcIiR7YWN0dWFsfVwiIGV4cGVjdGVkIHRvIG5vdCBiZSBudWxsIG9yIHVuZGVmaW5lZGA7XG4gICAgfVxuICAgIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcihtc2cpO1xuICB9XG59XG5cbi8qKlxuICogTWFrZSBhbiBhc3NlcnRpb24gdGhhdCBhY3R1YWwgaW5jbHVkZXMgZXhwZWN0ZWQuIElmIG5vdFxuICogdGhlbiB0aHJvdy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydFN0cmluZ0luY2x1ZGVzKFxuICBhY3R1YWw6IHN0cmluZyxcbiAgZXhwZWN0ZWQ6IHN0cmluZyxcbiAgbXNnPzogc3RyaW5nLFxuKSB7XG4gIGlmICghYWN0dWFsLmluY2x1ZGVzKGV4cGVjdGVkKSkge1xuICAgIGlmICghbXNnKSB7XG4gICAgICBtc2cgPSBgYWN0dWFsOiBcIiR7YWN0dWFsfVwiIGV4cGVjdGVkIHRvIGNvbnRhaW46IFwiJHtleHBlY3RlZH1cImA7XG4gICAgfVxuICAgIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcihtc2cpO1xuICB9XG59XG5cbi8qKlxuICogTWFrZSBhbiBhc3NlcnRpb24gdGhhdCBgYWN0dWFsYCBpbmNsdWRlcyB0aGUgYGV4cGVjdGVkYCB2YWx1ZXMuXG4gKiBJZiBub3QgdGhlbiBhbiBlcnJvciB3aWxsIGJlIHRocm93bi5cbiAqXG4gKiBUeXBlIHBhcmFtZXRlciBjYW4gYmUgc3BlY2lmaWVkIHRvIGVuc3VyZSB2YWx1ZXMgdW5kZXIgY29tcGFyaXNvbiBoYXZlIHRoZSBzYW1lIHR5cGUuXG4gKiBGb3IgZXhhbXBsZTpcbiAqXG4gKiBgYGB0c1xuICogaW1wb3J0IHsgYXNzZXJ0QXJyYXlJbmNsdWRlcyB9IGZyb20gXCJodHRwczovL2Rlbm8ubGFuZC9zdGRAJFNURF9WRVJTSU9OL3Rlc3RpbmcvYXNzZXJ0cy50c1wiO1xuICpcbiAqIGFzc2VydEFycmF5SW5jbHVkZXM8bnVtYmVyPihbMSwgMl0sIFsyXSlcbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0QXJyYXlJbmNsdWRlczxUPihcbiAgYWN0dWFsOiBBcnJheUxpa2U8VD4sXG4gIGV4cGVjdGVkOiBBcnJheUxpa2U8VD4sXG4gIG1zZz86IHN0cmluZyxcbikge1xuICBjb25zdCBtaXNzaW5nOiB1bmtub3duW10gPSBbXTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBleHBlY3RlZC5sZW5ndGg7IGkrKykge1xuICAgIGxldCBmb3VuZCA9IGZhbHNlO1xuICAgIGZvciAobGV0IGogPSAwOyBqIDwgYWN0dWFsLmxlbmd0aDsgaisrKSB7XG4gICAgICBpZiAoZXF1YWwoZXhwZWN0ZWRbaV0sIGFjdHVhbFtqXSkpIHtcbiAgICAgICAgZm91bmQgPSB0cnVlO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKCFmb3VuZCkge1xuICAgICAgbWlzc2luZy5wdXNoKGV4cGVjdGVkW2ldKTtcbiAgICB9XG4gIH1cbiAgaWYgKG1pc3NpbmcubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmICghbXNnKSB7XG4gICAgbXNnID0gYGFjdHVhbDogXCIke2Zvcm1hdChhY3R1YWwpfVwiIGV4cGVjdGVkIHRvIGluY2x1ZGU6IFwiJHtcbiAgICAgIGZvcm1hdChleHBlY3RlZClcbiAgICB9XCJcXG5taXNzaW5nOiAke2Zvcm1hdChtaXNzaW5nKX1gO1xuICB9XG4gIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcihtc2cpO1xufVxuXG4vKipcbiAqIE1ha2UgYW4gYXNzZXJ0aW9uIHRoYXQgYGFjdHVhbGAgbWF0Y2ggUmVnRXhwIGBleHBlY3RlZGAuIElmIG5vdFxuICogdGhlbiB0aHJvdy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydE1hdGNoKFxuICBhY3R1YWw6IHN0cmluZyxcbiAgZXhwZWN0ZWQ6IFJlZ0V4cCxcbiAgbXNnPzogc3RyaW5nLFxuKSB7XG4gIGlmICghZXhwZWN0ZWQudGVzdChhY3R1YWwpKSB7XG4gICAgaWYgKCFtc2cpIHtcbiAgICAgIG1zZyA9IGBhY3R1YWw6IFwiJHthY3R1YWx9XCIgZXhwZWN0ZWQgdG8gbWF0Y2g6IFwiJHtleHBlY3RlZH1cImA7XG4gICAgfVxuICAgIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcihtc2cpO1xuICB9XG59XG5cbi8qKlxuICogTWFrZSBhbiBhc3NlcnRpb24gdGhhdCBgYWN0dWFsYCBub3QgbWF0Y2ggUmVnRXhwIGBleHBlY3RlZGAuIElmIG1hdGNoXG4gKiB0aGVuIHRocm93LlxuICovXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0Tm90TWF0Y2goXG4gIGFjdHVhbDogc3RyaW5nLFxuICBleHBlY3RlZDogUmVnRXhwLFxuICBtc2c/OiBzdHJpbmcsXG4pIHtcbiAgaWYgKGV4cGVjdGVkLnRlc3QoYWN0dWFsKSkge1xuICAgIGlmICghbXNnKSB7XG4gICAgICBtc2cgPSBgYWN0dWFsOiBcIiR7YWN0dWFsfVwiIGV4cGVjdGVkIHRvIG5vdCBtYXRjaDogXCIke2V4cGVjdGVkfVwiYDtcbiAgICB9XG4gICAgdGhyb3cgbmV3IEFzc2VydGlvbkVycm9yKG1zZyk7XG4gIH1cbn1cblxuLyoqXG4gKiBNYWtlIGFuIGFzc2VydGlvbiB0aGF0IGBhY3R1YWxgIG9iamVjdCBpcyBhIHN1YnNldCBvZiBgZXhwZWN0ZWRgIG9iamVjdCwgZGVlcGx5LlxuICogSWYgbm90LCB0aGVuIHRocm93LlxuICovXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0T2JqZWN0TWF0Y2goXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIGFjdHVhbDogUmVjb3JkPFByb3BlcnR5S2V5LCBhbnk+LFxuICBleHBlY3RlZDogUmVjb3JkPFByb3BlcnR5S2V5LCB1bmtub3duPixcbikge1xuICB0eXBlIGxvb3NlID0gUmVjb3JkPFByb3BlcnR5S2V5LCB1bmtub3duPjtcblxuICBmdW5jdGlvbiBmaWx0ZXIoYTogbG9vc2UsIGI6IGxvb3NlKSB7XG4gICAgY29uc3Qgc2VlbiA9IG5ldyBXZWFrTWFwKCk7XG4gICAgcmV0dXJuIGZuKGEsIGIpO1xuXG4gICAgZnVuY3Rpb24gZm4oYTogbG9vc2UsIGI6IGxvb3NlKTogbG9vc2Uge1xuICAgICAgLy8gUHJldmVudCBpbmZpbml0ZSBsb29wIHdpdGggY2lyY3VsYXIgcmVmZXJlbmNlcyB3aXRoIHNhbWUgZmlsdGVyXG4gICAgICBpZiAoKHNlZW4uaGFzKGEpKSAmJiAoc2Vlbi5nZXQoYSkgPT09IGIpKSB7XG4gICAgICAgIHJldHVybiBhO1xuICAgICAgfVxuICAgICAgc2Vlbi5zZXQoYSwgYik7XG4gICAgICAvLyBGaWx0ZXIga2V5cyBhbmQgc3ltYm9scyB3aGljaCBhcmUgcHJlc2VudCBpbiBib3RoIGFjdHVhbCBhbmQgZXhwZWN0ZWRcbiAgICAgIGNvbnN0IGZpbHRlcmVkID0ge30gYXMgbG9vc2U7XG4gICAgICBjb25zdCBlbnRyaWVzID0gW1xuICAgICAgICAuLi5PYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhhKSxcbiAgICAgICAgLi4uT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyhhKSxcbiAgICAgIF1cbiAgICAgICAgLmZpbHRlcigoa2V5KSA9PiBrZXkgaW4gYilcbiAgICAgICAgLm1hcCgoa2V5KSA9PiBba2V5LCBhW2tleSBhcyBzdHJpbmddXSkgYXMgQXJyYXk8W3N0cmluZywgdW5rbm93bl0+O1xuICAgICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgZW50cmllcykge1xuICAgICAgICAvLyBPbiBhcnJheSByZWZlcmVuY2VzLCBidWlsZCBhIGZpbHRlcmVkIGFycmF5IGFuZCBmaWx0ZXIgbmVzdGVkIG9iamVjdHMgaW5zaWRlXG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgICAgICAgIGNvbnN0IHN1YnNldCA9IChiIGFzIGxvb3NlKVtrZXldO1xuICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KHN1YnNldCkpIHtcbiAgICAgICAgICAgIGZpbHRlcmVkW2tleV0gPSBmbih7IC4uLnZhbHVlIH0sIHsgLi4uc3Vic2V0IH0pO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuICAgICAgICB9IC8vIE9uIHJlZ2V4cCByZWZlcmVuY2VzLCBrZWVwIHZhbHVlIGFzIGl0IHRvIGF2b2lkIGxvb3NpbmcgcGF0dGVybiBhbmQgZmxhZ3NcbiAgICAgICAgZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBSZWdFeHApIHtcbiAgICAgICAgICBmaWx0ZXJlZFtrZXldID0gdmFsdWU7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH0gLy8gT24gbmVzdGVkIG9iamVjdHMgcmVmZXJlbmNlcywgYnVpbGQgYSBmaWx0ZXJlZCBvYmplY3QgcmVjdXJzaXZlbHlcbiAgICAgICAgZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSBcIm9iamVjdFwiKSB7XG4gICAgICAgICAgY29uc3Qgc3Vic2V0ID0gKGIgYXMgbG9vc2UpW2tleV07XG4gICAgICAgICAgaWYgKCh0eXBlb2Ygc3Vic2V0ID09PSBcIm9iamVjdFwiKSAmJiAoc3Vic2V0KSkge1xuICAgICAgICAgICAgLy8gV2hlbiBib3RoIG9wZXJhbmRzIGFyZSBtYXBzLCBidWlsZCBhIGZpbHRlcmVkIG1hcCB3aXRoIGNvbW1vbiBrZXlzIGFuZCBmaWx0ZXIgbmVzdGVkIG9iamVjdHMgaW5zaWRlXG4gICAgICAgICAgICBpZiAoKHZhbHVlIGluc3RhbmNlb2YgTWFwKSAmJiAoc3Vic2V0IGluc3RhbmNlb2YgTWFwKSkge1xuICAgICAgICAgICAgICBmaWx0ZXJlZFtrZXldID0gbmV3IE1hcChcbiAgICAgICAgICAgICAgICBbLi4udmFsdWVdLmZpbHRlcigoW2tdKSA9PiBzdWJzZXQuaGFzKGspKS5tYXAoKFxuICAgICAgICAgICAgICAgICAgW2ssIHZdLFxuICAgICAgICAgICAgICAgICkgPT4gW2ssIHR5cGVvZiB2ID09PSBcIm9iamVjdFwiID8gZm4odiwgc3Vic2V0LmdldChrKSkgOiB2XSksXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gV2hlbiBib3RoIG9wZXJhbmRzIGFyZSBzZXQsIGJ1aWxkIGEgZmlsdGVyZWQgc2V0IHdpdGggY29tbW9uIHZhbHVlc1xuICAgICAgICAgICAgaWYgKCh2YWx1ZSBpbnN0YW5jZW9mIFNldCkgJiYgKHN1YnNldCBpbnN0YW5jZW9mIFNldCkpIHtcbiAgICAgICAgICAgICAgZmlsdGVyZWRba2V5XSA9IG5ldyBTZXQoWy4uLnZhbHVlXS5maWx0ZXIoKHYpID0+IHN1YnNldC5oYXModikpKTtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmaWx0ZXJlZFtrZXldID0gZm4odmFsdWUgYXMgbG9vc2UsIHN1YnNldCBhcyBsb29zZSk7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZmlsdGVyZWRba2V5XSA9IHZhbHVlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZpbHRlcmVkO1xuICAgIH1cbiAgfVxuICByZXR1cm4gYXNzZXJ0RXF1YWxzKFxuICAgIC8vIGdldCB0aGUgaW50ZXJzZWN0aW9uIG9mIFwiYWN0dWFsXCIgYW5kIFwiZXhwZWN0ZWRcIlxuICAgIC8vIHNpZGUgZWZmZWN0OiBhbGwgdGhlIGluc3RhbmNlcycgY29uc3RydWN0b3IgZmllbGQgaXMgXCJPYmplY3RcIiBub3cuXG4gICAgZmlsdGVyKGFjdHVhbCwgZXhwZWN0ZWQpLFxuICAgIC8vIHNldCAobmVzdGVkKSBpbnN0YW5jZXMnIGNvbnN0cnVjdG9yIGZpZWxkIHRvIGJlIFwiT2JqZWN0XCIgd2l0aG91dCBjaGFuZ2luZyBleHBlY3RlZCB2YWx1ZS5cbiAgICAvLyBzZWUgaHR0cHM6Ly9naXRodWIuY29tL2Rlbm9sYW5kL2Rlbm9fc3RkL3B1bGwvMTQxOVxuICAgIGZpbHRlcihleHBlY3RlZCwgZXhwZWN0ZWQpLFxuICApO1xufVxuXG4vKipcbiAqIEZvcmNlZnVsbHkgdGhyb3dzIGEgZmFpbGVkIGFzc2VydGlvblxuICovXG5leHBvcnQgZnVuY3Rpb24gZmFpbChtc2c/OiBzdHJpbmcpOiBuZXZlciB7XG4gIGFzc2VydChmYWxzZSwgYEZhaWxlZCBhc3NlcnRpb24ke21zZyA/IGA6ICR7bXNnfWAgOiBcIi5cIn1gKTtcbn1cblxuLyoqXG4gKiBNYWtlIGFuIGFzc2VydGlvbiB0aGF0IGBlcnJvcmAgaXMgYW4gYEVycm9yYC5cbiAqIElmIG5vdCB0aGVuIGFuIGVycm9yIHdpbGwgYmUgdGhyb3duLlxuICogQW4gZXJyb3IgY2xhc3MgYW5kIGEgc3RyaW5nIHRoYXQgc2hvdWxkIGJlIGluY2x1ZGVkIGluIHRoZVxuICogZXJyb3IgbWVzc2FnZSBjYW4gYWxzbyBiZSBhc3NlcnRlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydElzRXJyb3I8RSBleHRlbmRzIEVycm9yID0gRXJyb3I+KFxuICBlcnJvcjogdW5rbm93bixcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgRXJyb3JDbGFzcz86IG5ldyAoLi4uYXJnczogYW55W10pID0+IEUsXG4gIG1zZ0luY2x1ZGVzPzogc3RyaW5nLFxuICBtc2c/OiBzdHJpbmcsXG4pOiBhc3NlcnRzIGVycm9yIGlzIEUge1xuICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA9PT0gZmFsc2UpIHtcbiAgICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3IoYEV4cGVjdGVkIFwiZXJyb3JcIiB0byBiZSBhbiBFcnJvciBvYmplY3QuYCk7XG4gIH1cbiAgaWYgKEVycm9yQ2xhc3MgJiYgIShlcnJvciBpbnN0YW5jZW9mIEVycm9yQ2xhc3MpKSB7XG4gICAgbXNnID0gYEV4cGVjdGVkIGVycm9yIHRvIGJlIGluc3RhbmNlIG9mIFwiJHtFcnJvckNsYXNzLm5hbWV9XCIsIGJ1dCB3YXMgXCIke1xuICAgICAgdHlwZW9mIGVycm9yID09PSBcIm9iamVjdFwiID8gZXJyb3I/LmNvbnN0cnVjdG9yPy5uYW1lIDogXCJbbm90IGFuIG9iamVjdF1cIlxuICAgIH1cIiR7bXNnID8gYDogJHttc2d9YCA6IFwiLlwifWA7XG4gICAgdGhyb3cgbmV3IEFzc2VydGlvbkVycm9yKG1zZyk7XG4gIH1cbiAgaWYgKFxuICAgIG1zZ0luY2x1ZGVzICYmICghKGVycm9yIGluc3RhbmNlb2YgRXJyb3IpIHx8XG4gICAgICAhc3RyaXBDb2xvcihlcnJvci5tZXNzYWdlKS5pbmNsdWRlcyhzdHJpcENvbG9yKG1zZ0luY2x1ZGVzKSkpXG4gICkge1xuICAgIG1zZyA9IGBFeHBlY3RlZCBlcnJvciBtZXNzYWdlIHRvIGluY2x1ZGUgXCIke21zZ0luY2x1ZGVzfVwiLCBidXQgZ290IFwiJHtcbiAgICAgIGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogXCJbbm90IGFuIEVycm9yXVwiXG4gICAgfVwiJHttc2cgPyBgOiAke21zZ31gIDogXCIuXCJ9YDtcbiAgICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3IobXNnKTtcbiAgfVxufVxuXG4vKiogRXhlY3V0ZXMgYSBmdW5jdGlvbiwgZXhwZWN0aW5nIGl0IHRvIHRocm93LiBJZiBpdCBkb2VzIG5vdCwgdGhlbiBpdFxuICogdGhyb3dzLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydFRocm93cyhcbiAgZm46ICgpID0+IHVua25vd24sXG4gIG1zZz86IHN0cmluZyxcbik6IHVua25vd247XG4vKiogRXhlY3V0ZXMgYSBmdW5jdGlvbiwgZXhwZWN0aW5nIGl0IHRvIHRocm93LiBJZiBpdCBkb2VzIG5vdCwgdGhlbiBpdFxuICogdGhyb3dzLiBBbiBlcnJvciBjbGFzcyBhbmQgYSBzdHJpbmcgdGhhdCBzaG91bGQgYmUgaW5jbHVkZWQgaW4gdGhlXG4gKiBlcnJvciBtZXNzYWdlIGNhbiBhbHNvIGJlIGFzc2VydGVkLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydFRocm93czxFIGV4dGVuZHMgRXJyb3IgPSBFcnJvcj4oXG4gIGZuOiAoKSA9PiB1bmtub3duLFxuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICBFcnJvckNsYXNzOiBuZXcgKC4uLmFyZ3M6IGFueVtdKSA9PiBFLFxuICBtc2dJbmNsdWRlcz86IHN0cmluZyxcbiAgbXNnPzogc3RyaW5nLFxuKTogRTtcbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRUaHJvd3M8RSBleHRlbmRzIEVycm9yID0gRXJyb3I+KFxuICBmbjogKCkgPT4gdW5rbm93bixcbiAgZXJyb3JDbGFzc09yTXNnPzpcbiAgICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAgIHwgKG5ldyAoLi4uYXJnczogYW55W10pID0+IEUpXG4gICAgfCBzdHJpbmcsXG4gIG1zZ0luY2x1ZGVzT3JNc2c/OiBzdHJpbmcsXG4gIG1zZz86IHN0cmluZyxcbik6IEUgfCBFcnJvciB8IHVua25vd24ge1xuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICBsZXQgRXJyb3JDbGFzczogKG5ldyAoLi4uYXJnczogYW55W10pID0+IEUpIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICBsZXQgbXNnSW5jbHVkZXM6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgbGV0IGVycjtcblxuICBpZiAodHlwZW9mIGVycm9yQ2xhc3NPck1zZyAhPT0gXCJzdHJpbmdcIikge1xuICAgIGlmIChcbiAgICAgIGVycm9yQ2xhc3NPck1zZyA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICBlcnJvckNsYXNzT3JNc2cucHJvdG90eXBlIGluc3RhbmNlb2YgRXJyb3IgfHxcbiAgICAgIGVycm9yQ2xhc3NPck1zZy5wcm90b3R5cGUgPT09IEVycm9yLnByb3RvdHlwZVxuICAgICkge1xuICAgICAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgICAgIEVycm9yQ2xhc3MgPSBlcnJvckNsYXNzT3JNc2cgYXMgbmV3ICguLi5hcmdzOiBhbnlbXSkgPT4gRTtcbiAgICAgIG1zZ0luY2x1ZGVzID0gbXNnSW5jbHVkZXNPck1zZztcbiAgICB9IGVsc2Uge1xuICAgICAgbXNnID0gbXNnSW5jbHVkZXNPck1zZztcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgbXNnID0gZXJyb3JDbGFzc09yTXNnO1xuICB9XG4gIGxldCBkb2VzVGhyb3cgPSBmYWxzZTtcbiAgY29uc3QgbXNnVG9BcHBlbmRUb0Vycm9yID0gbXNnID8gYDogJHttc2d9YCA6IFwiLlwiO1xuICB0cnkge1xuICAgIGZuKCk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaWYgKEVycm9yQ2xhc3MpIHtcbiAgICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIEVycm9yID09PSBmYWxzZSkge1xuICAgICAgICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3IoXCJBIG5vbi1FcnJvciBvYmplY3Qgd2FzIHRocm93bi5cIik7XG4gICAgICB9XG4gICAgICBhc3NlcnRJc0Vycm9yKFxuICAgICAgICBlcnJvcixcbiAgICAgICAgRXJyb3JDbGFzcyxcbiAgICAgICAgbXNnSW5jbHVkZXMsXG4gICAgICAgIG1zZyxcbiAgICAgICk7XG4gICAgfVxuICAgIGVyciA9IGVycm9yO1xuICAgIGRvZXNUaHJvdyA9IHRydWU7XG4gIH1cbiAgaWYgKCFkb2VzVGhyb3cpIHtcbiAgICBtc2cgPSBgRXhwZWN0ZWQgZnVuY3Rpb24gdG8gdGhyb3cke21zZ1RvQXBwZW5kVG9FcnJvcn1gO1xuICAgIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcihtc2cpO1xuICB9XG4gIHJldHVybiBlcnI7XG59XG5cbi8qKiBFeGVjdXRlcyBhIGZ1bmN0aW9uIHdoaWNoIHJldHVybnMgYSBwcm9taXNlLCBleHBlY3RpbmcgaXQgdG8gcmVqZWN0LiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydFJlamVjdHMoXG4gIGZuOiAoKSA9PiBQcm9taXNlTGlrZTx1bmtub3duPixcbiAgbXNnPzogc3RyaW5nLFxuKTogUHJvbWlzZTx1bmtub3duPjtcbi8qKiBFeGVjdXRlcyBhIGZ1bmN0aW9uIHdoaWNoIHJldHVybnMgYSBwcm9taXNlLCBleHBlY3RpbmcgaXQgdG8gcmVqZWN0LlxuICogSWYgaXQgZG9lcyBub3QsIHRoZW4gaXQgdGhyb3dzLiBBbiBlcnJvciBjbGFzcyBhbmQgYSBzdHJpbmcgdGhhdCBzaG91bGQgYmVcbiAqIGluY2x1ZGVkIGluIHRoZSBlcnJvciBtZXNzYWdlIGNhbiBhbHNvIGJlIGFzc2VydGVkLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydFJlamVjdHM8RSBleHRlbmRzIEVycm9yID0gRXJyb3I+KFxuICBmbjogKCkgPT4gUHJvbWlzZUxpa2U8dW5rbm93bj4sXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIEVycm9yQ2xhc3M6IG5ldyAoLi4uYXJnczogYW55W10pID0+IEUsXG4gIG1zZ0luY2x1ZGVzPzogc3RyaW5nLFxuICBtc2c/OiBzdHJpbmcsXG4pOiBQcm9taXNlPEU+O1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGFzc2VydFJlamVjdHM8RSBleHRlbmRzIEVycm9yID0gRXJyb3I+KFxuICBmbjogKCkgPT4gUHJvbWlzZUxpa2U8dW5rbm93bj4sXG4gIGVycm9yQ2xhc3NPck1zZz86XG4gICAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgICB8IChuZXcgKC4uLmFyZ3M6IGFueVtdKSA9PiBFKVxuICAgIHwgc3RyaW5nLFxuICBtc2dJbmNsdWRlc09yTXNnPzogc3RyaW5nLFxuICBtc2c/OiBzdHJpbmcsXG4pOiBQcm9taXNlPEUgfCBFcnJvciB8IHVua25vd24+IHtcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgbGV0IEVycm9yQ2xhc3M6IChuZXcgKC4uLmFyZ3M6IGFueVtdKSA9PiBFKSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgbGV0IG1zZ0luY2x1ZGVzOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gIGxldCBlcnI7XG5cbiAgaWYgKHR5cGVvZiBlcnJvckNsYXNzT3JNc2cgIT09IFwic3RyaW5nXCIpIHtcbiAgICBpZiAoXG4gICAgICBlcnJvckNsYXNzT3JNc2cgPT09IHVuZGVmaW5lZCB8fFxuICAgICAgZXJyb3JDbGFzc09yTXNnLnByb3RvdHlwZSBpbnN0YW5jZW9mIEVycm9yIHx8XG4gICAgICBlcnJvckNsYXNzT3JNc2cucHJvdG90eXBlID09PSBFcnJvci5wcm90b3R5cGVcbiAgICApIHtcbiAgICAgIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gICAgICBFcnJvckNsYXNzID0gZXJyb3JDbGFzc09yTXNnIGFzIG5ldyAoLi4uYXJnczogYW55W10pID0+IEU7XG4gICAgICBtc2dJbmNsdWRlcyA9IG1zZ0luY2x1ZGVzT3JNc2c7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIG1zZyA9IGVycm9yQ2xhc3NPck1zZztcbiAgfVxuICBsZXQgZG9lc1Rocm93ID0gZmFsc2U7XG4gIGxldCBpc1Byb21pc2VSZXR1cm5lZCA9IGZhbHNlO1xuICBjb25zdCBtc2dUb0FwcGVuZFRvRXJyb3IgPSBtc2cgPyBgOiAke21zZ31gIDogXCIuXCI7XG4gIHRyeSB7XG4gICAgY29uc3QgcG9zc2libGVQcm9taXNlID0gZm4oKTtcbiAgICBpZiAoXG4gICAgICBwb3NzaWJsZVByb21pc2UgJiZcbiAgICAgIHR5cGVvZiBwb3NzaWJsZVByb21pc2UgPT09IFwib2JqZWN0XCIgJiZcbiAgICAgIHR5cGVvZiBwb3NzaWJsZVByb21pc2UudGhlbiA9PT0gXCJmdW5jdGlvblwiXG4gICAgKSB7XG4gICAgICBpc1Byb21pc2VSZXR1cm5lZCA9IHRydWU7XG4gICAgICBhd2FpdCBwb3NzaWJsZVByb21pc2U7XG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGlmICghaXNQcm9taXNlUmV0dXJuZWQpIHtcbiAgICAgIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcihcbiAgICAgICAgYEZ1bmN0aW9uIHRocm93cyB3aGVuIGV4cGVjdGVkIHRvIHJlamVjdCR7bXNnVG9BcHBlbmRUb0Vycm9yfWAsXG4gICAgICApO1xuICAgIH1cbiAgICBpZiAoRXJyb3JDbGFzcykge1xuICAgICAgaWYgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPT09IGZhbHNlKSB7XG4gICAgICAgIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcihcIkEgbm9uLUVycm9yIG9iamVjdCB3YXMgcmVqZWN0ZWQuXCIpO1xuICAgICAgfVxuICAgICAgYXNzZXJ0SXNFcnJvcihcbiAgICAgICAgZXJyb3IsXG4gICAgICAgIEVycm9yQ2xhc3MsXG4gICAgICAgIG1zZ0luY2x1ZGVzLFxuICAgICAgICBtc2csXG4gICAgICApO1xuICAgIH1cbiAgICBlcnIgPSBlcnJvcjtcbiAgICBkb2VzVGhyb3cgPSB0cnVlO1xuICB9XG4gIGlmICghZG9lc1Rocm93KSB7XG4gICAgdGhyb3cgbmV3IEFzc2VydGlvbkVycm9yKFxuICAgICAgYEV4cGVjdGVkIGZ1bmN0aW9uIHRvIHJlamVjdCR7bXNnVG9BcHBlbmRUb0Vycm9yfWAsXG4gICAgKTtcbiAgfVxuICByZXR1cm4gZXJyO1xufVxuXG4vKiogVXNlIHRoaXMgdG8gc3R1YiBvdXQgbWV0aG9kcyB0aGF0IHdpbGwgdGhyb3cgd2hlbiBpbnZva2VkLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHVuaW1wbGVtZW50ZWQobXNnPzogc3RyaW5nKTogbmV2ZXIge1xuICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3IobXNnIHx8IFwidW5pbXBsZW1lbnRlZFwiKTtcbn1cblxuLyoqIFVzZSB0aGlzIHRvIGFzc2VydCB1bnJlYWNoYWJsZSBjb2RlLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHVucmVhY2hhYmxlKCk6IG5ldmVyIHtcbiAgdGhyb3cgbmV3IEFzc2VydGlvbkVycm9yKFwidW5yZWFjaGFibGVcIik7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBRTFFOzs7Ozs7Q0FNQyxHQUVELFNBQVMsR0FBRyxFQUFFLFVBQVUsUUFBUSxtQkFBbUI7QUFDbkQsU0FBUyxZQUFZLEVBQUUsSUFBSSxFQUFFLE9BQU8sUUFBUSxhQUFhO0FBQ3pELFNBQVMsTUFBTSxRQUFRLGVBQWU7QUFFdEMsTUFBTSxrQkFBa0I7QUFFeEIsT0FBTyxNQUFNLHVCQUF1QjtFQUN6QixPQUFPLGlCQUFpQjtFQUNqQyxZQUFZLE9BQWUsQ0FBRTtJQUMzQixLQUFLLENBQUM7RUFDUjtBQUNGO0FBRUEsU0FBUyxrQkFBa0IsQ0FBVTtFQUNuQyxPQUFPO0lBQUMsT0FBTyxRQUFRO0lBQUU7R0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQU0sS0FBTTtBQUN0RDtBQUVBOzs7O0NBSUMsR0FDRCxPQUFPLFNBQVMsTUFBTSxDQUFVLEVBQUUsQ0FBVTtFQUMxQyxNQUFNLE9BQU8s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