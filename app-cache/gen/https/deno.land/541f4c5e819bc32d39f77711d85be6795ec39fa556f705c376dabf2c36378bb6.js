// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
export { DigestContext, instantiate as instantiateWasm } from "./lib/deno_std_wasm_crypto.generated.mjs";
/**
 * All cryptographic hash/digest algorithms supported by std/_wasm_crypto.
 *
 * For algorithms that are supported by WebCrypto, the name here must match the
 * one used by WebCrypto. Otherwise we should prefer the formatting used in the
 * official specification. All names are uppercase to facilitate case-insensitive
 * comparisons required by the WebCrypto spec.
 */ export const digestAlgorithms = [
  "BLAKE2B-256",
  "BLAKE2B-384",
  "BLAKE2B",
  "BLAKE2S",
  "BLAKE3",
  "KECCAK-224",
  "KECCAK-256",
  "KECCAK-384",
  "KECCAK-512",
  "SHA-384",
  "SHA3-224",
  "SHA3-256",
  "SHA3-384",
  "SHA3-512",
  "SHAKE128",
  "SHAKE256",
  "TIGER",
  // insecure (length-extendable):
  "RIPEMD-160",
  "SHA-224",
  "SHA-256",
  "SHA-512",
  // insecure (collidable and length-extendable):
  "MD4",
  "MD5",
  "SHA-1"
];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2MC4wL2NyeXB0by9fd2FzbV9jcnlwdG8vbW9kLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjIgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG5leHBvcnQge1xuICBEaWdlc3RDb250ZXh0LFxuICBpbnN0YW50aWF0ZSBhcyBpbnN0YW50aWF0ZVdhc20sXG59IGZyb20gXCIuL2xpYi9kZW5vX3N0ZF93YXNtX2NyeXB0by5nZW5lcmF0ZWQubWpzXCI7XG5cbi8qKlxuICogQWxsIGNyeXB0b2dyYXBoaWMgaGFzaC9kaWdlc3QgYWxnb3JpdGhtcyBzdXBwb3J0ZWQgYnkgc3RkL193YXNtX2NyeXB0by5cbiAqXG4gKiBGb3IgYWxnb3JpdGhtcyB0aGF0IGFyZSBzdXBwb3J0ZWQgYnkgV2ViQ3J5cHRvLCB0aGUgbmFtZSBoZXJlIG11c3QgbWF0Y2ggdGhlXG4gKiBvbmUgdXNlZCBieSBXZWJDcnlwdG8uIE90aGVyd2lzZSB3ZSBzaG91bGQgcHJlZmVyIHRoZSBmb3JtYXR0aW5nIHVzZWQgaW4gdGhlXG4gKiBvZmZpY2lhbCBzcGVjaWZpY2F0aW9uLiBBbGwgbmFtZXMgYXJlIHVwcGVyY2FzZSB0byBmYWNpbGl0YXRlIGNhc2UtaW5zZW5zaXRpdmVcbiAqIGNvbXBhcmlzb25zIHJlcXVpcmVkIGJ5IHRoZSBXZWJDcnlwdG8gc3BlYy5cbiAqL1xuZXhwb3J0IGNvbnN0IGRpZ2VzdEFsZ29yaXRobXMgPSBbXG4gIFwiQkxBS0UyQi0yNTZcIixcbiAgXCJCTEFLRTJCLTM4NFwiLFxuICBcIkJMQUtFMkJcIixcbiAgXCJCTEFLRTJTXCIsXG4gIFwiQkxBS0UzXCIsXG4gIFwiS0VDQ0FLLTIyNFwiLFxuICBcIktFQ0NBSy0yNTZcIixcbiAgXCJLRUNDQUstMzg0XCIsXG4gIFwiS0VDQ0FLLTUxMlwiLFxuICBcIlNIQS0zODRcIixcbiAgXCJTSEEzLTIyNFwiLFxuICBcIlNIQTMtMjU2XCIsXG4gIFwiU0hBMy0zODRcIixcbiAgXCJTSEEzLTUxMlwiLFxuICBcIlNIQUtFMTI4XCIsXG4gIFwiU0hBS0UyNTZcIixcbiAgXCJUSUdFUlwiLFxuICAvLyBpbnNlY3VyZSAobGVuZ3RoLWV4dGVuZGFibGUpOlxuICBcIlJJUEVNRC0xNjBcIixcbiAgXCJTSEEtMjI0XCIsXG4gIFwiU0hBLTI1NlwiLFxuICBcIlNIQS01MTJcIixcbiAgLy8gaW5zZWN1cmUgKGNvbGxpZGFibGUgYW5kIGxlbmd0aC1leHRlbmRhYmxlKTpcbiAgXCJNRDRcIixcbiAgXCJNRDVcIixcbiAgXCJTSEEtMVwiLFxuXSBhcyBjb25zdDtcblxuLyoqIEFuIGFsZ29yaXRobSBuYW1lIHN1cHBvcnRlZCBieSBzdGQvX3dhc21fY3J5cHRvLiAqL1xuZXhwb3J0IHR5cGUgRGlnZXN0QWxnb3JpdGhtID0gdHlwZW9mIGRpZ2VzdEFsZ29yaXRobXNbbnVtYmVyXTtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFDMUUsU0FDRSxhQUFhLEVBQ2IsZUFBZSxlQUFlLFFBQ3pCLDJDQUEyQztBQUVsRDs7Ozs7OztDQU9DLEdBQ0QsT0FBTyxNQUFNLG1CQUFtQjtFQUM5QjtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsZ0NBQWdDO0VBQ2hDO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsK0NBQStDO0VBQy9DO0VBQ0E7RUFDQTtDQUNELENBQVUifQ==