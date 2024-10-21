// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
var _computedKey;
import { deferred } from "./deferred.ts";
_computedKey = Symbol.asyncIterator;
/** The MuxAsyncIterator class multiplexes multiple async iterators into a
 * single stream. It currently makes an assumption:
 * - The final result (the value returned and not yielded from the iterator)
 *   does not matter; if there is any, it is discarded.
 */ export class MuxAsyncIterator {
  iteratorCount = 0;
  yields = [];
  // deno-lint-ignore no-explicit-any
  throws = [];
  signal = deferred();
  add(iterable) {
    ++this.iteratorCount;
    this.callIteratorNext(iterable[Symbol.asyncIterator]());
  }
  async callIteratorNext(iterator) {
    try {
      const { value, done } = await iterator.next();
      if (done) {
        --this.iteratorCount;
      } else {
        this.yields.push({
          iterator,
          value
        });
      }
    } catch (e) {
      this.throws.push(e);
    }
    this.signal.resolve();
  }
  async *iterate() {
    while(this.iteratorCount > 0){
      // Sleep until any of the wrapped iterators yields.
      await this.signal;
      // Note that while we're looping over `yields`, new items may be added.
      for(let i = 0; i < this.yields.length; i++){
        const { iterator, value } = this.yields[i];
        yield value;
        this.callIteratorNext(iterator);
      }
      if (this.throws.length) {
        for (const e of this.throws){
          throw e;
        }
        this.throws.length = 0;
      }
      // Clear the `yields` list and reset the `signal` promise.
      this.yields.length = 0;
      this.signal = deferred();
    }
  }
  [_computedKey]() {
    return this.iterate();
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjEzMi4wL2FzeW5jL211eF9hc3luY19pdGVyYXRvci50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuLy8gVGhpcyBtb2R1bGUgaXMgYnJvd3NlciBjb21wYXRpYmxlLlxuXG5pbXBvcnQgeyBEZWZlcnJlZCwgZGVmZXJyZWQgfSBmcm9tIFwiLi9kZWZlcnJlZC50c1wiO1xuXG5pbnRlcmZhY2UgVGFnZ2VkWWllbGRlZFZhbHVlPFQ+IHtcbiAgaXRlcmF0b3I6IEFzeW5jSXRlcmF0b3I8VD47XG4gIHZhbHVlOiBUO1xufVxuXG4vKiogVGhlIE11eEFzeW5jSXRlcmF0b3IgY2xhc3MgbXVsdGlwbGV4ZXMgbXVsdGlwbGUgYXN5bmMgaXRlcmF0b3JzIGludG8gYVxuICogc2luZ2xlIHN0cmVhbS4gSXQgY3VycmVudGx5IG1ha2VzIGFuIGFzc3VtcHRpb246XG4gKiAtIFRoZSBmaW5hbCByZXN1bHQgKHRoZSB2YWx1ZSByZXR1cm5lZCBhbmQgbm90IHlpZWxkZWQgZnJvbSB0aGUgaXRlcmF0b3IpXG4gKiAgIGRvZXMgbm90IG1hdHRlcjsgaWYgdGhlcmUgaXMgYW55LCBpdCBpcyBkaXNjYXJkZWQuXG4gKi9cbmV4cG9ydCBjbGFzcyBNdXhBc3luY0l0ZXJhdG9yPFQ+IGltcGxlbWVudHMgQXN5bmNJdGVyYWJsZTxUPiB7XG4gIHByaXZhdGUgaXRlcmF0b3JDb3VudCA9IDA7XG4gIHByaXZhdGUgeWllbGRzOiBBcnJheTxUYWdnZWRZaWVsZGVkVmFsdWU8VD4+ID0gW107XG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIHByaXZhdGUgdGhyb3dzOiBhbnlbXSA9IFtdO1xuICBwcml2YXRlIHNpZ25hbDogRGVmZXJyZWQ8dm9pZD4gPSBkZWZlcnJlZCgpO1xuXG4gIGFkZChpdGVyYWJsZTogQXN5bmNJdGVyYWJsZTxUPik6IHZvaWQge1xuICAgICsrdGhpcy5pdGVyYXRvckNvdW50O1xuICAgIHRoaXMuY2FsbEl0ZXJhdG9yTmV4dChpdGVyYWJsZVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0oKSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGNhbGxJdGVyYXRvck5leHQoXG4gICAgaXRlcmF0b3I6IEFzeW5jSXRlcmF0b3I8VD4sXG4gICkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCB7IHZhbHVlLCBkb25lIH0gPSBhd2FpdCBpdGVyYXRvci5uZXh0KCk7XG4gICAgICBpZiAoZG9uZSkge1xuICAgICAgICAtLXRoaXMuaXRlcmF0b3JDb3VudDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMueWllbGRzLnB1c2goeyBpdGVyYXRvciwgdmFsdWUgfSk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgdGhpcy50aHJvd3MucHVzaChlKTtcbiAgICB9XG4gICAgdGhpcy5zaWduYWwucmVzb2x2ZSgpO1xuICB9XG5cbiAgYXN5bmMgKml0ZXJhdGUoKTogQXN5bmNJdGVyYWJsZUl0ZXJhdG9yPFQ+IHtcbiAgICB3aGlsZSAodGhpcy5pdGVyYXRvckNvdW50ID4gMCkge1xuICAgICAgLy8gU2xlZXAgdW50aWwgYW55IG9mIHRoZSB3cmFwcGVkIGl0ZXJhdG9ycyB5aWVsZHMuXG4gICAgICBhd2FpdCB0aGlzLnNpZ25hbDtcblxuICAgICAgLy8gTm90ZSB0aGF0IHdoaWxlIHdlJ3JlIGxvb3Bpbmcgb3ZlciBgeWllbGRzYCwgbmV3IGl0ZW1zIG1heSBiZSBhZGRlZC5cbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy55aWVsZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3QgeyBpdGVyYXRvciwgdmFsdWUgfSA9IHRoaXMueWllbGRzW2ldO1xuICAgICAgICB5aWVsZCB2YWx1ZTtcbiAgICAgICAgdGhpcy5jYWxsSXRlcmF0b3JOZXh0KGl0ZXJhdG9yKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMudGhyb3dzLmxlbmd0aCkge1xuICAgICAgICBmb3IgKGNvbnN0IGUgb2YgdGhpcy50aHJvd3MpIHtcbiAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMudGhyb3dzLmxlbmd0aCA9IDA7XG4gICAgICB9XG4gICAgICAvLyBDbGVhciB0aGUgYHlpZWxkc2AgbGlzdCBhbmQgcmVzZXQgdGhlIGBzaWduYWxgIHByb21pc2UuXG4gICAgICB0aGlzLnlpZWxkcy5sZW5ndGggPSAwO1xuICAgICAgdGhpcy5zaWduYWwgPSBkZWZlcnJlZCgpO1xuICAgIH1cbiAgfVxuXG4gIFtTeW1ib2wuYXN5bmNJdGVyYXRvcl0oKTogQXN5bmNJdGVyYXRvcjxUPiB7XG4gICAgcmV0dXJuIHRoaXMuaXRlcmF0ZSgpO1xuICB9XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBQzFFLHFDQUFxQzs7QUFFckMsU0FBbUIsUUFBUSxRQUFRLGdCQUFnQjtlQWdFaEQsT0FBTyxhQUFhO0FBekR2Qjs7OztDQUlDLEdBQ0QsT0FBTyxNQUFNO0VBQ0gsZ0JBQWdCLEVBQUU7RUFDbEIsU0FBdUMsRUFBRSxDQUFDO0VBQ2xELG1DQUFtQztFQUMzQixTQUFnQixFQUFFLENBQUM7RUFDbkIsU0FBeUIsV0FBVztFQUU1QyxJQUFJLFFBQTBCLEVBQVE7SUFDcEMsRUFBRSxJQUFJLENBQUMsYUFBYTtJQUNwQixJQUFJLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxDQUFDLE9BQU8sYUFBYSxDQUFDO0VBQ3REO0VBRUEsTUFBYyxpQkFDWixRQUEwQixFQUMxQjtJQUNBLElBQUk7TUFDRixNQUFNLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxHQUFHLE1BQU0sU0FBUyxJQUFJO01BQzNDLElBQUksTUFBTTtRQUNSLEVBQUUsSUFBSSxDQUFDLGFBQWE7TUFDdEIsT0FBTztRQUNMLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDO1VBQUU7VUFBVTtRQUFNO01BQ3JDO0lBQ0YsRUFBRSxPQUFPLEdBQUc7TUFDVixJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQztJQUNuQjtJQUNBLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTztFQUNyQjtFQUVBLE9BQU8sVUFBb0M7SUFDekMsTUFBTyxJQUFJLENBQUMsYUFBYSxHQUFHLEVBQUc7TUFDN0IsbURBQW1EO01BQ25ELE1BQU0sSUFBSSxDQUFDLE1BQU07TUFFakIsdUVBQXVFO01BQ3ZFLElBQUssSUFBSSxJQUFJLEdBQUcsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxJQUFLO1FBQzNDLE1BQU0sRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFO1FBQzFDLE1BQU07UUFDTixJQUFJLENBQUMsZ0JBQWdCLENBQUM7TUFDeEI7TUFFQSxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFO1FBQ3RCLEtBQUssTUFBTSxLQUFLLElBQUksQ0FBQyxNQUFNLENBQUU7VUFDM0IsTUFBTTtRQUNSO1FBQ0EsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUc7TUFDdkI7TUFDQSwwREFBMEQ7TUFDMUQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUc7TUFDckIsSUFBSSxDQUFDLE1BQU0sR0FBRztJQUNoQjtFQUNGO0VBRUEsaUJBQTJDO0lBQ3pDLE9BQU8sSUFBSSxDQUFDLE9BQU87RUFDckI7QUFDRiJ9