// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
import { Tokenizer } from "./tokenizer.ts";
function digits(value, count = 2) {
  return String(value).padStart(count, "0");
}
function createLiteralTestFunction(value) {
  return (string)=>{
    return string.startsWith(value) ? {
      value,
      length: value.length
    } : undefined;
  };
}
function createMatchTestFunction(match) {
  return (string)=>{
    const result = match.exec(string);
    if (result) return {
      value: result,
      length: result[0].length
    };
  };
}
// according to unicode symbols (http://www.unicode.org/reports/tr35/tr35-dates.html#Date_Field_Symbol_Table)
const defaultRules = [
  {
    test: createLiteralTestFunction("yyyy"),
    fn: ()=>({
        type: "year",
        value: "numeric"
      })
  },
  {
    test: createLiteralTestFunction("yy"),
    fn: ()=>({
        type: "year",
        value: "2-digit"
      })
  },
  {
    test: createLiteralTestFunction("MM"),
    fn: ()=>({
        type: "month",
        value: "2-digit"
      })
  },
  {
    test: createLiteralTestFunction("M"),
    fn: ()=>({
        type: "month",
        value: "numeric"
      })
  },
  {
    test: createLiteralTestFunction("dd"),
    fn: ()=>({
        type: "day",
        value: "2-digit"
      })
  },
  {
    test: createLiteralTestFunction("d"),
    fn: ()=>({
        type: "day",
        value: "numeric"
      })
  },
  {
    test: createLiteralTestFunction("HH"),
    fn: ()=>({
        type: "hour",
        value: "2-digit"
      })
  },
  {
    test: createLiteralTestFunction("H"),
    fn: ()=>({
        type: "hour",
        value: "numeric"
      })
  },
  {
    test: createLiteralTestFunction("hh"),
    fn: ()=>({
        type: "hour",
        value: "2-digit",
        hour12: true
      })
  },
  {
    test: createLiteralTestFunction("h"),
    fn: ()=>({
        type: "hour",
        value: "numeric",
        hour12: true
      })
  },
  {
    test: createLiteralTestFunction("mm"),
    fn: ()=>({
        type: "minute",
        value: "2-digit"
      })
  },
  {
    test: createLiteralTestFunction("m"),
    fn: ()=>({
        type: "minute",
        value: "numeric"
      })
  },
  {
    test: createLiteralTestFunction("ss"),
    fn: ()=>({
        type: "second",
        value: "2-digit"
      })
  },
  {
    test: createLiteralTestFunction("s"),
    fn: ()=>({
        type: "second",
        value: "numeric"
      })
  },
  {
    test: createLiteralTestFunction("SSS"),
    fn: ()=>({
        type: "fractionalSecond",
        value: 3
      })
  },
  {
    test: createLiteralTestFunction("SS"),
    fn: ()=>({
        type: "fractionalSecond",
        value: 2
      })
  },
  {
    test: createLiteralTestFunction("S"),
    fn: ()=>({
        type: "fractionalSecond",
        value: 1
      })
  },
  {
    test: createLiteralTestFunction("a"),
    fn: (value)=>({
        type: "dayPeriod",
        value: value
      })
  },
  // quoted literal
  {
    test: createMatchTestFunction(/^(')(?<value>\\.|[^\']*)\1/),
    fn: (match)=>({
        type: "literal",
        value: match.groups.value
      })
  },
  // literal
  {
    test: createMatchTestFunction(/^.+?\s*/),
    fn: (match)=>({
        type: "literal",
        value: match[0]
      })
  }
];
export class DateTimeFormatter {
  #format;
  constructor(formatString, rules = defaultRules){
    const tokenizer = new Tokenizer(rules);
    this.#format = tokenizer.tokenize(formatString, ({ type, value, hour12 })=>{
      const result = {
        type,
        value
      };
      if (hour12) result.hour12 = hour12;
      return result;
    });
  }
  format(date, options = {}) {
    let string = "";
    const utc = options.timeZone === "UTC";
    for (const token of this.#format){
      const type = token.type;
      switch(type){
        case "year":
          {
            const value = utc ? date.getUTCFullYear() : date.getFullYear();
            switch(token.value){
              case "numeric":
                {
                  string += value;
                  break;
                }
              case "2-digit":
                {
                  string += digits(value, 2).slice(-2);
                  break;
                }
              default:
                throw Error(`FormatterError: value "${token.value}" is not supported`);
            }
            break;
          }
        case "month":
          {
            const value = (utc ? date.getUTCMonth() : date.getMonth()) + 1;
            switch(token.value){
              case "numeric":
                {
                  string += value;
                  break;
                }
              case "2-digit":
                {
                  string += digits(value, 2);
                  break;
                }
              default:
                throw Error(`FormatterError: value "${token.value}" is not supported`);
            }
            break;
          }
        case "day":
          {
            const value = utc ? date.getUTCDate() : date.getDate();
            switch(token.value){
              case "numeric":
                {
                  string += value;
                  break;
                }
              case "2-digit":
                {
                  string += digits(value, 2);
                  break;
                }
              default:
                throw Error(`FormatterError: value "${token.value}" is not supported`);
            }
            break;
          }
        case "hour":
          {
            let value = utc ? date.getUTCHours() : date.getHours();
            value -= token.hour12 && date.getHours() > 12 ? 12 : 0;
            switch(token.value){
              case "numeric":
                {
                  string += value;
                  break;
                }
              case "2-digit":
                {
                  string += digits(value, 2);
                  break;
                }
              default:
                throw Error(`FormatterError: value "${token.value}" is not supported`);
            }
            break;
          }
        case "minute":
          {
            const value = utc ? date.getUTCMinutes() : date.getMinutes();
            switch(token.value){
              case "numeric":
                {
                  string += value;
                  break;
                }
              case "2-digit":
                {
                  string += digits(value, 2);
                  break;
                }
              default:
                throw Error(`FormatterError: value "${token.value}" is not supported`);
            }
            break;
          }
        case "second":
          {
            const value = utc ? date.getUTCSeconds() : date.getSeconds();
            switch(token.value){
              case "numeric":
                {
                  string += value;
                  break;
                }
              case "2-digit":
                {
                  string += digits(value, 2);
                  break;
                }
              default:
                throw Error(`FormatterError: value "${token.value}" is not supported`);
            }
            break;
          }
        case "fractionalSecond":
          {
            const value = utc ? date.getUTCMilliseconds() : date.getMilliseconds();
            string += digits(value, Number(token.value));
            break;
          }
        // FIXME(bartlomieju)
        case "timeZoneName":
          {
            break;
          }
        case "dayPeriod":
          {
            string += token.value ? date.getHours() >= 12 ? "PM" : "AM" : "";
            break;
          }
        case "literal":
          {
            string += token.value;
            break;
          }
        default:
          throw Error(`FormatterError: { ${token.type} ${token.value} }`);
      }
    }
    return string;
  }
  parseToParts(string) {
    const parts = [];
    for (const token of this.#format){
      const type = token.type;
      let value = "";
      switch(token.type){
        case "year":
          {
            switch(token.value){
              case "numeric":
                {
                  value = /^\d{1,4}/.exec(string)?.[0];
                  break;
                }
              case "2-digit":
                {
                  value = /^\d{1,2}/.exec(string)?.[0];
                  break;
                }
            }
            break;
          }
        case "month":
          {
            switch(token.value){
              case "numeric":
                {
                  value = /^\d{1,2}/.exec(string)?.[0];
                  break;
                }
              case "2-digit":
                {
                  value = /^\d{2}/.exec(string)?.[0];
                  break;
                }
              case "narrow":
                {
                  value = /^[a-zA-Z]+/.exec(string)?.[0];
                  break;
                }
              case "short":
                {
                  value = /^[a-zA-Z]+/.exec(string)?.[0];
                  break;
                }
              case "long":
                {
                  value = /^[a-zA-Z]+/.exec(string)?.[0];
                  break;
                }
              default:
                throw Error(`ParserError: value "${token.value}" is not supported`);
            }
            break;
          }
        case "day":
          {
            switch(token.value){
              case "numeric":
                {
                  value = /^\d{1,2}/.exec(string)?.[0];
                  break;
                }
              case "2-digit":
                {
                  value = /^\d{2}/.exec(string)?.[0];
                  break;
                }
              default:
                throw Error(`ParserError: value "${token.value}" is not supported`);
            }
            break;
          }
        case "hour":
          {
            switch(token.value){
              case "numeric":
                {
                  value = /^\d{1,2}/.exec(string)?.[0];
                  if (token.hour12 && parseInt(value) > 12) {
                    console.error(`Trying to parse hour greater than 12. Use 'H' instead of 'h'.`);
                  }
                  break;
                }
              case "2-digit":
                {
                  value = /^\d{2}/.exec(string)?.[0];
                  if (token.hour12 && parseInt(value) > 12) {
                    console.error(`Trying to parse hour greater than 12. Use 'HH' instead of 'hh'.`);
                  }
                  break;
                }
              default:
                throw Error(`ParserError: value "${token.value}" is not supported`);
            }
            break;
          }
        case "minute":
          {
            switch(token.value){
              case "numeric":
                {
                  value = /^\d{1,2}/.exec(string)?.[0];
                  break;
                }
              case "2-digit":
                {
                  value = /^\d{2}/.exec(string)?.[0];
                  break;
                }
              default:
                throw Error(`ParserError: value "${token.value}" is not supported`);
            }
            break;
          }
        case "second":
          {
            switch(token.value){
              case "numeric":
                {
                  value = /^\d{1,2}/.exec(string)?.[0];
                  break;
                }
              case "2-digit":
                {
                  value = /^\d{2}/.exec(string)?.[0];
                  break;
                }
              default:
                throw Error(`ParserError: value "${token.value}" is not supported`);
            }
            break;
          }
        case "fractionalSecond":
          {
            value = new RegExp(`^\\d{${token.value}}`).exec(string)?.[0];
            break;
          }
        case "timeZoneName":
          {
            value = token.value;
            break;
          }
        case "dayPeriod":
          {
            value = /^(A|P)M/.exec(string)?.[0];
            break;
          }
        case "literal":
          {
            if (!string.startsWith(token.value)) {
              throw Error(`Literal "${token.value}" not found "${string.slice(0, 25)}"`);
            }
            value = token.value;
            break;
          }
        default:
          throw Error(`${token.type} ${token.value}`);
      }
      if (!value) {
        throw Error(`value not valid for token { ${type} ${value} } ${string.slice(0, 25)}`);
      }
      parts.push({
        type,
        value
      });
      string = string.slice(value.length);
    }
    if (string.length) {
      throw Error(`datetime string was not fully parsed! ${string.slice(0, 25)}`);
    }
    return parts;
  }
  /** sort & filter dateTimeFormatPart */ sortDateTimeFormatPart(parts) {
    let result = [];
    const typeArray = [
      "year",
      "month",
      "day",
      "hour",
      "minute",
      "second",
      "fractionalSecond"
    ];
    for (const type of typeArray){
      const current = parts.findIndex((el)=>el.type === type);
      if (current !== -1) {
        result = result.concat(parts.splice(current, 1));
      }
    }
    result = result.concat(parts);
    return result;
  }
  partsToDate(parts) {
    const date = new Date();
    const utc = parts.find((part)=>part.type === "timeZoneName" && part.value === "UTC");
    const dayPart = parts.find((part)=>part.type === "day");
    utc ? date.setUTCHours(0, 0, 0, 0) : date.setHours(0, 0, 0, 0);
    for (const part of parts){
      switch(part.type){
        case "year":
          {
            const value = Number(part.value.padStart(4, "20"));
            utc ? date.setUTCFullYear(value) : date.setFullYear(value);
            break;
          }
        case "month":
          {
            const value = Number(part.value) - 1;
            if (dayPart) {
              utc ? date.setUTCMonth(value, Number(dayPart.value)) : date.setMonth(value, Number(dayPart.value));
            } else {
              utc ? date.setUTCMonth(value) : date.setMonth(value);
            }
            break;
          }
        case "day":
          {
            const value = Number(part.value);
            utc ? date.setUTCDate(value) : date.setDate(value);
            break;
          }
        case "hour":
          {
            let value = Number(part.value);
            const dayPeriod = parts.find((part)=>part.type === "dayPeriod");
            if (dayPeriod?.value === "PM") value += 12;
            utc ? date.setUTCHours(value) : date.setHours(value);
            break;
          }
        case "minute":
          {
            const value = Number(part.value);
            utc ? date.setUTCMinutes(value) : date.setMinutes(value);
            break;
          }
        case "second":
          {
            const value = Number(part.value);
            utc ? date.setUTCSeconds(value) : date.setSeconds(value);
            break;
          }
        case "fractionalSecond":
          {
            const value = Number(part.value);
            utc ? date.setUTCMilliseconds(value) : date.setMilliseconds(value);
            break;
          }
      }
    }
    return date;
  }
  parse(string) {
    const parts = this.parseToParts(string);
    const sortParts = this.sortDateTimeFormatPart(parts);
    return this.partsToDate(sortParts);
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2MC4wL2RhdGV0aW1lL2Zvcm1hdHRlci50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuLy8gVGhpcyBtb2R1bGUgaXMgYnJvd3NlciBjb21wYXRpYmxlLlxuXG5pbXBvcnQge1xuICBDYWxsYmFja1Jlc3VsdCxcbiAgUmVjZWl2ZXJSZXN1bHQsXG4gIFJ1bGUsXG4gIFRlc3RGdW5jdGlvbixcbiAgVGVzdFJlc3VsdCxcbiAgVG9rZW5pemVyLFxufSBmcm9tIFwiLi90b2tlbml6ZXIudHNcIjtcblxuZnVuY3Rpb24gZGlnaXRzKHZhbHVlOiBzdHJpbmcgfCBudW1iZXIsIGNvdW50ID0gMik6IHN0cmluZyB7XG4gIHJldHVybiBTdHJpbmcodmFsdWUpLnBhZFN0YXJ0KGNvdW50LCBcIjBcIik7XG59XG5cbi8vIGFzIGRlY2xhcmVkIGFzIGluIG5hbWVzcGFjZSBJbnRsXG50eXBlIERhdGVUaW1lRm9ybWF0UGFydFR5cGVzID1cbiAgfCBcImRheVwiXG4gIHwgXCJkYXlQZXJpb2RcIlxuICAvLyB8IFwiZXJhXCJcbiAgfCBcImhvdXJcIlxuICB8IFwibGl0ZXJhbFwiXG4gIHwgXCJtaW51dGVcIlxuICB8IFwibW9udGhcIlxuICB8IFwic2Vjb25kXCJcbiAgfCBcInRpbWVab25lTmFtZVwiXG4gIC8vIHwgXCJ3ZWVrZGF5XCJcbiAgfCBcInllYXJcIlxuICB8IFwiZnJhY3Rpb25hbFNlY29uZFwiO1xuXG5pbnRlcmZhY2UgRGF0ZVRpbWVGb3JtYXRQYXJ0IHtcbiAgdHlwZTogRGF0ZVRpbWVGb3JtYXRQYXJ0VHlwZXM7XG4gIHZhbHVlOiBzdHJpbmc7XG59XG5cbnR5cGUgVGltZVpvbmUgPSBcIlVUQ1wiO1xuXG5pbnRlcmZhY2UgT3B0aW9ucyB7XG4gIHRpbWVab25lPzogVGltZVpvbmU7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUxpdGVyYWxUZXN0RnVuY3Rpb24odmFsdWU6IHN0cmluZyk6IFRlc3RGdW5jdGlvbiB7XG4gIHJldHVybiAoc3RyaW5nOiBzdHJpbmcpOiBUZXN0UmVzdWx0ID0+IHtcbiAgICByZXR1cm4gc3RyaW5nLnN0YXJ0c1dpdGgodmFsdWUpXG4gICAgICA/IHsgdmFsdWUsIGxlbmd0aDogdmFsdWUubGVuZ3RoIH1cbiAgICAgIDogdW5kZWZpbmVkO1xuICB9O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVNYXRjaFRlc3RGdW5jdGlvbihtYXRjaDogUmVnRXhwKTogVGVzdEZ1bmN0aW9uIHtcbiAgcmV0dXJuIChzdHJpbmc6IHN0cmluZyk6IFRlc3RSZXN1bHQgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IG1hdGNoLmV4ZWMoc3RyaW5nKTtcbiAgICBpZiAocmVzdWx0KSByZXR1cm4geyB2YWx1ZTogcmVzdWx0LCBsZW5ndGg6IHJlc3VsdFswXS5sZW5ndGggfTtcbiAgfTtcbn1cblxuLy8gYWNjb3JkaW5nIHRvIHVuaWNvZGUgc3ltYm9scyAoaHR0cDovL3d3dy51bmljb2RlLm9yZy9yZXBvcnRzL3RyMzUvdHIzNS1kYXRlcy5odG1sI0RhdGVfRmllbGRfU3ltYm9sX1RhYmxlKVxuY29uc3QgZGVmYXVsdFJ1bGVzID0gW1xuICB7XG4gICAgdGVzdDogY3JlYXRlTGl0ZXJhbFRlc3RGdW5jdGlvbihcInl5eXlcIiksXG4gICAgZm46ICgpOiBDYWxsYmFja1Jlc3VsdCA9PiAoeyB0eXBlOiBcInllYXJcIiwgdmFsdWU6IFwibnVtZXJpY1wiIH0pLFxuICB9LFxuICB7XG4gICAgdGVzdDogY3JlYXRlTGl0ZXJhbFRlc3RGdW5jdGlvbihcInl5XCIpLFxuICAgIGZuOiAoKTogQ2FsbGJhY2tSZXN1bHQgPT4gKHsgdHlwZTogXCJ5ZWFyXCIsIHZhbHVlOiBcIjItZGlnaXRcIiB9KSxcbiAgfSxcblxuICB7XG4gICAgdGVzdDogY3JlYXRlTGl0ZXJhbFRlc3RGdW5jdGlvbihcIk1NXCIpLFxuICAgIGZuOiAoKTogQ2FsbGJhY2tSZXN1bHQgPT4gKHsgdHlwZTogXCJtb250aFwiLCB2YWx1ZTogXCIyLWRpZ2l0XCIgfSksXG4gIH0sXG4gIHtcbiAgICB0ZXN0OiBjcmVhdGVMaXRlcmFsVGVzdEZ1bmN0aW9uKFwiTVwiKSxcbiAgICBmbjogKCk6IENhbGxiYWNrUmVzdWx0ID0+ICh7IHR5cGU6IFwibW9udGhcIiwgdmFsdWU6IFwibnVtZXJpY1wiIH0pLFxuICB9LFxuICB7XG4gICAgdGVzdDogY3JlYXRlTGl0ZXJhbFRlc3RGdW5jdGlvbihcImRkXCIpLFxuICAgIGZuOiAoKTogQ2FsbGJhY2tSZXN1bHQgPT4gKHsgdHlwZTogXCJkYXlcIiwgdmFsdWU6IFwiMi1kaWdpdFwiIH0pLFxuICB9LFxuICB7XG4gICAgdGVzdDogY3JlYXRlTGl0ZXJhbFRlc3RGdW5jdGlvbihcImRcIiksXG4gICAgZm46ICgpOiBDYWxsYmFja1Jlc3VsdCA9PiAoeyB0eXBlOiBcImRheVwiLCB2YWx1ZTogXCJudW1lcmljXCIgfSksXG4gIH0sXG5cbiAge1xuICAgIHRlc3Q6IGNyZWF0ZUxpdGVyYWxUZXN0RnVuY3Rpb24oXCJISFwiKSxcbiAgICBmbjogKCk6IENhbGxiYWNrUmVzdWx0ID0+ICh7IHR5cGU6IFwiaG91clwiLCB2YWx1ZTogXCIyLWRpZ2l0XCIgfSksXG4gIH0sXG4gIHtcbiAgICB0ZXN0OiBjcmVhdGVMaXRlcmFsVGVzdEZ1bmN0aW9uKFwiSFwiKSxcbiAgICBmbjogKCk6IENhbGxiYWNrUmVzdWx0ID0+ICh7IHR5cGU6IFwiaG91clwiLCB2YWx1ZTogXCJudW1lcmljXCIgfSksXG4gIH0sXG4gIHtcbiAgICB0ZXN0OiBjcmVhdGVMaXRlcmFsVGVzdEZ1bmN0aW9uKFwiaGhcIiksXG4gICAgZm46ICgpOiBDYWxsYmFja1Jlc3VsdCA9PiAoe1xuICAgICAgdHlwZTogXCJob3VyXCIsXG4gICAgICB2YWx1ZTogXCIyLWRpZ2l0XCIsXG4gICAgICBob3VyMTI6IHRydWUsXG4gICAgfSksXG4gIH0sXG4gIHtcbiAgICB0ZXN0OiBjcmVhdGVMaXRlcmFsVGVzdEZ1bmN0aW9uKFwiaFwiKSxcbiAgICBmbjogKCk6IENhbGxiYWNrUmVzdWx0ID0+ICh7XG4gICAgICB0eXBlOiBcImhvdXJcIixcbiAgICAgIHZhbHVlOiBcIm51bWVyaWNcIixcbiAgICAgIGhvdXIxMjogdHJ1ZSxcbiAgICB9KSxcbiAgfSxcbiAge1xuICAgIHRlc3Q6IGNyZWF0ZUxpdGVyYWxUZXN0RnVuY3Rpb24oXCJtbVwiKSxcbiAgICBmbjogKCk6IENhbGxiYWNrUmVzdWx0ID0+ICh7IHR5cGU6IFwibWludXRlXCIsIHZhbHVlOiBcIjItZGlnaXRcIiB9KSxcbiAgfSxcbiAge1xuICAgIHRlc3Q6IGNyZWF0ZUxpdGVyYWxUZXN0RnVuY3Rpb24oXCJtXCIpLFxuICAgIGZuOiAoKTogQ2FsbGJhY2tSZXN1bHQgPT4gKHsgdHlwZTogXCJtaW51dGVcIiwgdmFsdWU6IFwibnVtZXJpY1wiIH0pLFxuICB9LFxuICB7XG4gICAgdGVzdDogY3JlYXRlTGl0ZXJhbFRlc3RGdW5jdGlvbihcInNzXCIpLFxuICAgIGZuOiAoKTogQ2FsbGJhY2tSZXN1bHQgPT4gKHsgdHlwZTogXCJzZWNvbmRcIiwgdmFsdWU6IFwiMi1kaWdpdFwiIH0pLFxuICB9LFxuICB7XG4gICAgdGVzdDogY3JlYXRlTGl0ZXJhbFRlc3RGdW5jdGlvbihcInNcIiksXG4gICAgZm46ICgpOiBDYWxsYmFja1Jlc3VsdCA9PiAoeyB0eXBlOiBcInNlY29uZFwiLCB2YWx1ZTogXCJudW1lcmljXCIgfSksXG4gIH0sXG4gIHtcbiAgICB0ZXN0OiBjcmVhdGVMaXRlcmFsVGVzdEZ1bmN0aW9uKFwiU1NTXCIpLFxuICAgIGZuOiAoKTogQ2FsbGJhY2tSZXN1bHQgPT4gKHsgdHlwZTogXCJmcmFjdGlvbmFsU2Vjb25kXCIsIHZhbHVlOiAzIH0pLFxuICB9LFxuICB7XG4gICAgdGVzdDogY3JlYXRlTGl0ZXJhbFRlc3RGdW5jdGlvbihcIlNTXCIpLFxuICAgIGZuOiAoKTogQ2FsbGJhY2tSZXN1bHQgPT4gKHsgdHlwZTogXCJmcmFjdGlvbmFsU2Vjb25kXCIsIHZhbHVlOiAyIH0pLFxuICB9LFxuICB7XG4gICAgdGVzdDogY3JlYXRlTGl0ZXJhbFRlc3RGdW5jdGlvbihcIlNcIiksXG4gICAgZm46ICgpOiBDYWxsYmFja1Jlc3VsdCA9PiAoeyB0eXBlOiBcImZyYWN0aW9uYWxTZWNvbmRcIiwgdmFsdWU6IDEgfSksXG4gIH0sXG5cbiAge1xuICAgIHRlc3Q6IGNyZWF0ZUxpdGVyYWxUZXN0RnVuY3Rpb24oXCJhXCIpLFxuICAgIGZuOiAodmFsdWU6IHVua25vd24pOiBDYWxsYmFja1Jlc3VsdCA9PiAoe1xuICAgICAgdHlwZTogXCJkYXlQZXJpb2RcIixcbiAgICAgIHZhbHVlOiB2YWx1ZSBhcyBzdHJpbmcsXG4gICAgfSksXG4gIH0sXG5cbiAgLy8gcXVvdGVkIGxpdGVyYWxcbiAge1xuICAgIHRlc3Q6IGNyZWF0ZU1hdGNoVGVzdEZ1bmN0aW9uKC9eKCcpKD88dmFsdWU+XFxcXC58W15cXCddKilcXDEvKSxcbiAgICBmbjogKG1hdGNoOiB1bmtub3duKTogQ2FsbGJhY2tSZXN1bHQgPT4gKHtcbiAgICAgIHR5cGU6IFwibGl0ZXJhbFwiLFxuICAgICAgdmFsdWU6IChtYXRjaCBhcyBSZWdFeHBFeGVjQXJyYXkpLmdyb3VwcyEudmFsdWUgYXMgc3RyaW5nLFxuICAgIH0pLFxuICB9LFxuICAvLyBsaXRlcmFsXG4gIHtcbiAgICB0ZXN0OiBjcmVhdGVNYXRjaFRlc3RGdW5jdGlvbigvXi4rP1xccyovKSxcbiAgICBmbjogKG1hdGNoOiB1bmtub3duKTogQ2FsbGJhY2tSZXN1bHQgPT4gKHtcbiAgICAgIHR5cGU6IFwibGl0ZXJhbFwiLFxuICAgICAgdmFsdWU6IChtYXRjaCBhcyBSZWdFeHBFeGVjQXJyYXkpWzBdLFxuICAgIH0pLFxuICB9LFxuXTtcblxudHlwZSBGb3JtYXRQYXJ0ID0ge1xuICB0eXBlOiBEYXRlVGltZUZvcm1hdFBhcnRUeXBlcztcbiAgdmFsdWU6IHN0cmluZyB8IG51bWJlcjtcbiAgaG91cjEyPzogYm9vbGVhbjtcbn07XG50eXBlIEZvcm1hdCA9IEZvcm1hdFBhcnRbXTtcblxuZXhwb3J0IGNsYXNzIERhdGVUaW1lRm9ybWF0dGVyIHtcbiAgI2Zvcm1hdDogRm9ybWF0O1xuXG4gIGNvbnN0cnVjdG9yKGZvcm1hdFN0cmluZzogc3RyaW5nLCBydWxlczogUnVsZVtdID0gZGVmYXVsdFJ1bGVzKSB7XG4gICAgY29uc3QgdG9rZW5pemVyID0gbmV3IFRva2VuaXplcihydWxlcyk7XG4gICAgdGhpcy4jZm9ybWF0ID0gdG9rZW5pemVyLnRva2VuaXplKFxuICAgICAgZm9ybWF0U3RyaW5nLFxuICAgICAgKHsgdHlwZSwgdmFsdWUsIGhvdXIxMiB9KSA9PiB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IHtcbiAgICAgICAgICB0eXBlLFxuICAgICAgICAgIHZhbHVlLFxuICAgICAgICB9IGFzIHVua25vd24gYXMgUmVjZWl2ZXJSZXN1bHQ7XG4gICAgICAgIGlmIChob3VyMTIpIHJlc3VsdC5ob3VyMTIgPSBob3VyMTIgYXMgYm9vbGVhbjtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH0sXG4gICAgKSBhcyBGb3JtYXQ7XG4gIH1cblxuICBmb3JtYXQoZGF0ZTogRGF0ZSwgb3B0aW9uczogT3B0aW9ucyA9IHt9KTogc3RyaW5nIHtcbiAgICBsZXQgc3RyaW5nID0gXCJcIjtcblxuICAgIGNvbnN0IHV0YyA9IG9wdGlvbnMudGltZVpvbmUgPT09IFwiVVRDXCI7XG5cbiAgICBmb3IgKGNvbnN0IHRva2VuIG9mIHRoaXMuI2Zvcm1hdCkge1xuICAgICAgY29uc3QgdHlwZSA9IHRva2VuLnR5cGU7XG5cbiAgICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgICBjYXNlIFwieWVhclwiOiB7XG4gICAgICAgICAgY29uc3QgdmFsdWUgPSB1dGMgPyBkYXRlLmdldFVUQ0Z1bGxZZWFyKCkgOiBkYXRlLmdldEZ1bGxZZWFyKCk7XG4gICAgICAgICAgc3dpdGNoICh0b2tlbi52YWx1ZSkge1xuICAgICAgICAgICAgY2FzZSBcIm51bWVyaWNcIjoge1xuICAgICAgICAgICAgICBzdHJpbmcgKz0gdmFsdWU7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBcIjItZGlnaXRcIjoge1xuICAgICAgICAgICAgICBzdHJpbmcgKz0gZGlnaXRzKHZhbHVlLCAyKS5zbGljZSgtMik7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgdGhyb3cgRXJyb3IoXG4gICAgICAgICAgICAgICAgYEZvcm1hdHRlckVycm9yOiB2YWx1ZSBcIiR7dG9rZW4udmFsdWV9XCIgaXMgbm90IHN1cHBvcnRlZGAsXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGNhc2UgXCJtb250aFwiOiB7XG4gICAgICAgICAgY29uc3QgdmFsdWUgPSAodXRjID8gZGF0ZS5nZXRVVENNb250aCgpIDogZGF0ZS5nZXRNb250aCgpKSArIDE7XG4gICAgICAgICAgc3dpdGNoICh0b2tlbi52YWx1ZSkge1xuICAgICAgICAgICAgY2FzZSBcIm51bWVyaWNcIjoge1xuICAgICAgICAgICAgICBzdHJpbmcgKz0gdmFsdWU7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBcIjItZGlnaXRcIjoge1xuICAgICAgICAgICAgICBzdHJpbmcgKz0gZGlnaXRzKHZhbHVlLCAyKTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICB0aHJvdyBFcnJvcihcbiAgICAgICAgICAgICAgICBgRm9ybWF0dGVyRXJyb3I6IHZhbHVlIFwiJHt0b2tlbi52YWx1ZX1cIiBpcyBub3Qgc3VwcG9ydGVkYCxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgY2FzZSBcImRheVwiOiB7XG4gICAgICAgICAgY29uc3QgdmFsdWUgPSB1dGMgPyBkYXRlLmdldFVUQ0RhdGUoKSA6IGRhdGUuZ2V0RGF0ZSgpO1xuICAgICAgICAgIHN3aXRjaCAodG9rZW4udmFsdWUpIHtcbiAgICAgICAgICAgIGNhc2UgXCJudW1lcmljXCI6IHtcbiAgICAgICAgICAgICAgc3RyaW5nICs9IHZhbHVlO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgXCIyLWRpZ2l0XCI6IHtcbiAgICAgICAgICAgICAgc3RyaW5nICs9IGRpZ2l0cyh2YWx1ZSwgMik7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgdGhyb3cgRXJyb3IoXG4gICAgICAgICAgICAgICAgYEZvcm1hdHRlckVycm9yOiB2YWx1ZSBcIiR7dG9rZW4udmFsdWV9XCIgaXMgbm90IHN1cHBvcnRlZGAsXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGNhc2UgXCJob3VyXCI6IHtcbiAgICAgICAgICBsZXQgdmFsdWUgPSB1dGMgPyBkYXRlLmdldFVUQ0hvdXJzKCkgOiBkYXRlLmdldEhvdXJzKCk7XG4gICAgICAgICAgdmFsdWUgLT0gdG9rZW4uaG91cjEyICYmIGRhdGUuZ2V0SG91cnMoKSA+IDEyID8gMTIgOiAwO1xuICAgICAgICAgIHN3aXRjaCAodG9rZW4udmFsdWUpIHtcbiAgICAgICAgICAgIGNhc2UgXCJudW1lcmljXCI6IHtcbiAgICAgICAgICAgICAgc3RyaW5nICs9IHZhbHVlO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgXCIyLWRpZ2l0XCI6IHtcbiAgICAgICAgICAgICAgc3RyaW5nICs9IGRpZ2l0cyh2YWx1ZSwgMik7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgdGhyb3cgRXJyb3IoXG4gICAgICAgICAgICAgICAgYEZvcm1hdHRlckVycm9yOiB2YWx1ZSBcIiR7dG9rZW4udmFsdWV9XCIgaXMgbm90IHN1cHBvcnRlZGAsXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGNhc2UgXCJtaW51dGVcIjoge1xuICAgICAgICAgIGNvbnN0IHZhbHVlID0gdXRjID8gZGF0ZS5nZXRVVENNaW51dGVzKCkgOiBkYXRlLmdldE1pbnV0ZXMoKTtcbiAgICAgICAgICBzd2l0Y2ggKHRva2VuLnZhbHVlKSB7XG4gICAgICAgICAgICBjYXNlIFwibnVtZXJpY1wiOiB7XG4gICAgICAgICAgICAgIHN0cmluZyArPSB2YWx1ZTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIFwiMi1kaWdpdFwiOiB7XG4gICAgICAgICAgICAgIHN0cmluZyArPSBkaWdpdHModmFsdWUsIDIpO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgIHRocm93IEVycm9yKFxuICAgICAgICAgICAgICAgIGBGb3JtYXR0ZXJFcnJvcjogdmFsdWUgXCIke3Rva2VuLnZhbHVlfVwiIGlzIG5vdCBzdXBwb3J0ZWRgLFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBjYXNlIFwic2Vjb25kXCI6IHtcbiAgICAgICAgICBjb25zdCB2YWx1ZSA9IHV0YyA/IGRhdGUuZ2V0VVRDU2Vjb25kcygpIDogZGF0ZS5nZXRTZWNvbmRzKCk7XG4gICAgICAgICAgc3dpdGNoICh0b2tlbi52YWx1ZSkge1xuICAgICAgICAgICAgY2FzZSBcIm51bWVyaWNcIjoge1xuICAgICAgICAgICAgICBzdHJpbmcgKz0gdmFsdWU7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBcIjItZGlnaXRcIjoge1xuICAgICAgICAgICAgICBzdHJpbmcgKz0gZGlnaXRzKHZhbHVlLCAyKTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICB0aHJvdyBFcnJvcihcbiAgICAgICAgICAgICAgICBgRm9ybWF0dGVyRXJyb3I6IHZhbHVlIFwiJHt0b2tlbi52YWx1ZX1cIiBpcyBub3Qgc3VwcG9ydGVkYCxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgY2FzZSBcImZyYWN0aW9uYWxTZWNvbmRcIjoge1xuICAgICAgICAgIGNvbnN0IHZhbHVlID0gdXRjXG4gICAgICAgICAgICA/IGRhdGUuZ2V0VVRDTWlsbGlzZWNvbmRzKClcbiAgICAgICAgICAgIDogZGF0ZS5nZXRNaWxsaXNlY29uZHMoKTtcbiAgICAgICAgICBzdHJpbmcgKz0gZGlnaXRzKHZhbHVlLCBOdW1iZXIodG9rZW4udmFsdWUpKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICAvLyBGSVhNRShiYXJ0bG9taWVqdSlcbiAgICAgICAgY2FzZSBcInRpbWVab25lTmFtZVwiOiB7XG4gICAgICAgICAgLy8gc3RyaW5nICs9IHV0YyA/IFwiWlwiIDogdG9rZW4udmFsdWVcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBjYXNlIFwiZGF5UGVyaW9kXCI6IHtcbiAgICAgICAgICBzdHJpbmcgKz0gdG9rZW4udmFsdWUgPyAoZGF0ZS5nZXRIb3VycygpID49IDEyID8gXCJQTVwiIDogXCJBTVwiKSA6IFwiXCI7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgY2FzZSBcImxpdGVyYWxcIjoge1xuICAgICAgICAgIHN0cmluZyArPSB0b2tlbi52YWx1ZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgdGhyb3cgRXJyb3IoYEZvcm1hdHRlckVycm9yOiB7ICR7dG9rZW4udHlwZX0gJHt0b2tlbi52YWx1ZX0gfWApO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBzdHJpbmc7XG4gIH1cblxuICBwYXJzZVRvUGFydHMoc3RyaW5nOiBzdHJpbmcpOiBEYXRlVGltZUZvcm1hdFBhcnRbXSB7XG4gICAgY29uc3QgcGFydHM6IERhdGVUaW1lRm9ybWF0UGFydFtdID0gW107XG5cbiAgICBmb3IgKGNvbnN0IHRva2VuIG9mIHRoaXMuI2Zvcm1hdCkge1xuICAgICAgY29uc3QgdHlwZSA9IHRva2VuLnR5cGU7XG5cbiAgICAgIGxldCB2YWx1ZSA9IFwiXCI7XG4gICAgICBzd2l0Y2ggKHRva2VuLnR5cGUpIHtcbiAgICAgICAgY2FzZSBcInllYXJcIjoge1xuICAgICAgICAgIHN3aXRjaCAodG9rZW4udmFsdWUpIHtcbiAgICAgICAgICAgIGNhc2UgXCJudW1lcmljXCI6IHtcbiAgICAgICAgICAgICAgdmFsdWUgPSAvXlxcZHsxLDR9Ly5leGVjKHN0cmluZyk/LlswXSBhcyBzdHJpbmc7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBcIjItZGlnaXRcIjoge1xuICAgICAgICAgICAgICB2YWx1ZSA9IC9eXFxkezEsMn0vLmV4ZWMoc3RyaW5nKT8uWzBdIGFzIHN0cmluZztcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGNhc2UgXCJtb250aFwiOiB7XG4gICAgICAgICAgc3dpdGNoICh0b2tlbi52YWx1ZSkge1xuICAgICAgICAgICAgY2FzZSBcIm51bWVyaWNcIjoge1xuICAgICAgICAgICAgICB2YWx1ZSA9IC9eXFxkezEsMn0vLmV4ZWMoc3RyaW5nKT8uWzBdIGFzIHN0cmluZztcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIFwiMi1kaWdpdFwiOiB7XG4gICAgICAgICAgICAgIHZhbHVlID0gL15cXGR7Mn0vLmV4ZWMoc3RyaW5nKT8uWzBdIGFzIHN0cmluZztcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIFwibmFycm93XCI6IHtcbiAgICAgICAgICAgICAgdmFsdWUgPSAvXlthLXpBLVpdKy8uZXhlYyhzdHJpbmcpPy5bMF0gYXMgc3RyaW5nO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgXCJzaG9ydFwiOiB7XG4gICAgICAgICAgICAgIHZhbHVlID0gL15bYS16QS1aXSsvLmV4ZWMoc3RyaW5nKT8uWzBdIGFzIHN0cmluZztcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIFwibG9uZ1wiOiB7XG4gICAgICAgICAgICAgIHZhbHVlID0gL15bYS16QS1aXSsvLmV4ZWMoc3RyaW5nKT8uWzBdIGFzIHN0cmluZztcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICB0aHJvdyBFcnJvcihcbiAgICAgICAgICAgICAgICBgUGFyc2VyRXJyb3I6IHZhbHVlIFwiJHt0b2tlbi52YWx1ZX1cIiBpcyBub3Qgc3VwcG9ydGVkYCxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgY2FzZSBcImRheVwiOiB7XG4gICAgICAgICAgc3dpdGNoICh0b2tlbi52YWx1ZSkge1xuICAgICAgICAgICAgY2FzZSBcIm51bWVyaWNcIjoge1xuICAgICAgICAgICAgICB2YWx1ZSA9IC9eXFxkezEsMn0vLmV4ZWMoc3RyaW5nKT8uWzBdIGFzIHN0cmluZztcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIFwiMi1kaWdpdFwiOiB7XG4gICAgICAgICAgICAgIHZhbHVlID0gL15cXGR7Mn0vLmV4ZWMoc3RyaW5nKT8uWzBdIGFzIHN0cmluZztcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICB0aHJvdyBFcnJvcihcbiAgICAgICAgICAgICAgICBgUGFyc2VyRXJyb3I6IHZhbHVlIFwiJHt0b2tlbi52YWx1ZX1cIiBpcyBub3Qgc3VwcG9ydGVkYCxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgY2FzZSBcImhvdXJcIjoge1xuICAgICAgICAgIHN3aXRjaCAodG9rZW4udmFsdWUpIHtcbiAgICAgICAgICAgIGNhc2UgXCJudW1lcmljXCI6IHtcbiAgICAgICAgICAgICAgdmFsdWUgPSAvXlxcZHsxLDJ9Ly5leGVjKHN0cmluZyk/LlswXSBhcyBzdHJpbmc7XG4gICAgICAgICAgICAgIGlmICh0b2tlbi5ob3VyMTIgJiYgcGFyc2VJbnQodmFsdWUpID4gMTIpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICAgICAgICAgICAgYFRyeWluZyB0byBwYXJzZSBob3VyIGdyZWF0ZXIgdGhhbiAxMi4gVXNlICdIJyBpbnN0ZWFkIG9mICdoJy5gLFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIFwiMi1kaWdpdFwiOiB7XG4gICAgICAgICAgICAgIHZhbHVlID0gL15cXGR7Mn0vLmV4ZWMoc3RyaW5nKT8uWzBdIGFzIHN0cmluZztcbiAgICAgICAgICAgICAgaWYgKHRva2VuLmhvdXIxMiAmJiBwYXJzZUludCh2YWx1ZSkgPiAxMikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgICAgICAgICBgVHJ5aW5nIHRvIHBhcnNlIGhvdXIgZ3JlYXRlciB0aGFuIDEyLiBVc2UgJ0hIJyBpbnN0ZWFkIG9mICdoaCcuYCxcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgdGhyb3cgRXJyb3IoXG4gICAgICAgICAgICAgICAgYFBhcnNlckVycm9yOiB2YWx1ZSBcIiR7dG9rZW4udmFsdWV9XCIgaXMgbm90IHN1cHBvcnRlZGAsXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGNhc2UgXCJtaW51dGVcIjoge1xuICAgICAgICAgIHN3aXRjaCAodG9rZW4udmFsdWUpIHtcbiAgICAgICAgICAgIGNhc2UgXCJudW1lcmljXCI6IHtcbiAgICAgICAgICAgICAgdmFsdWUgPSAvXlxcZHsxLDJ9Ly5leGVjKHN0cmluZyk/LlswXSBhcyBzdHJpbmc7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBcIjItZGlnaXRcIjoge1xuICAgICAgICAgICAgICB2YWx1ZSA9IC9eXFxkezJ9Ly5leGVjKHN0cmluZyk/LlswXSBhcyBzdHJpbmc7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgdGhyb3cgRXJyb3IoXG4gICAgICAgICAgICAgICAgYFBhcnNlckVycm9yOiB2YWx1ZSBcIiR7dG9rZW4udmFsdWV9XCIgaXMgbm90IHN1cHBvcnRlZGAsXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGNhc2UgXCJzZWNvbmRcIjoge1xuICAgICAgICAgIHN3aXRjaCAodG9rZW4udmFsdWUpIHtcbiAgICAgICAgICAgIGNhc2UgXCJudW1lcmljXCI6IHtcbiAgICAgICAgICAgICAgdmFsdWUgPSAvXlxcZHsxLDJ9Ly5leGVjKHN0cmluZyk/LlswXSBhcyBzdHJpbmc7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBcIjItZGlnaXRcIjoge1xuICAgICAgICAgICAgICB2YWx1ZSA9IC9eXFxkezJ9Ly5leGVjKHN0cmluZyk/LlswXSBhcyBzdHJpbmc7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgdGhyb3cgRXJyb3IoXG4gICAgICAgICAgICAgICAgYFBhcnNlckVycm9yOiB2YWx1ZSBcIiR7dG9rZW4udmFsdWV9XCIgaXMgbm90IHN1cHBvcnRlZGAsXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGNhc2UgXCJmcmFjdGlvbmFsU2Vjb25kXCI6IHtcbiAgICAgICAgICB2YWx1ZSA9IG5ldyBSZWdFeHAoYF5cXFxcZHske3Rva2VuLnZhbHVlfX1gKS5leGVjKHN0cmluZylcbiAgICAgICAgICAgID8uWzBdIGFzIHN0cmluZztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBjYXNlIFwidGltZVpvbmVOYW1lXCI6IHtcbiAgICAgICAgICB2YWx1ZSA9IHRva2VuLnZhbHVlIGFzIHN0cmluZztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBjYXNlIFwiZGF5UGVyaW9kXCI6IHtcbiAgICAgICAgICB2YWx1ZSA9IC9eKEF8UClNLy5leGVjKHN0cmluZyk/LlswXSBhcyBzdHJpbmc7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgY2FzZSBcImxpdGVyYWxcIjoge1xuICAgICAgICAgIGlmICghc3RyaW5nLnN0YXJ0c1dpdGgodG9rZW4udmFsdWUgYXMgc3RyaW5nKSkge1xuICAgICAgICAgICAgdGhyb3cgRXJyb3IoXG4gICAgICAgICAgICAgIGBMaXRlcmFsIFwiJHt0b2tlbi52YWx1ZX1cIiBub3QgZm91bmQgXCIke3N0cmluZy5zbGljZSgwLCAyNSl9XCJgLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdmFsdWUgPSB0b2tlbi52YWx1ZSBhcyBzdHJpbmc7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHRocm93IEVycm9yKGAke3Rva2VuLnR5cGV9ICR7dG9rZW4udmFsdWV9YCk7XG4gICAgICB9XG5cbiAgICAgIGlmICghdmFsdWUpIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoXG4gICAgICAgICAgYHZhbHVlIG5vdCB2YWxpZCBmb3IgdG9rZW4geyAke3R5cGV9ICR7dmFsdWV9IH0gJHtcbiAgICAgICAgICAgIHN0cmluZy5zbGljZShcbiAgICAgICAgICAgICAgMCxcbiAgICAgICAgICAgICAgMjUsXG4gICAgICAgICAgICApXG4gICAgICAgICAgfWAsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICBwYXJ0cy5wdXNoKHsgdHlwZSwgdmFsdWUgfSk7XG5cbiAgICAgIHN0cmluZyA9IHN0cmluZy5zbGljZSh2YWx1ZS5sZW5ndGgpO1xuICAgIH1cblxuICAgIGlmIChzdHJpbmcubGVuZ3RoKSB7XG4gICAgICB0aHJvdyBFcnJvcihcbiAgICAgICAgYGRhdGV0aW1lIHN0cmluZyB3YXMgbm90IGZ1bGx5IHBhcnNlZCEgJHtzdHJpbmcuc2xpY2UoMCwgMjUpfWAsXG4gICAgICApO1xuICAgIH1cblxuICAgIHJldHVybiBwYXJ0cztcbiAgfVxuXG4gIC8qKiBzb3J0ICYgZmlsdGVyIGRhdGVUaW1lRm9ybWF0UGFydCAqL1xuICBzb3J0RGF0ZVRpbWVGb3JtYXRQYXJ0KHBhcnRzOiBEYXRlVGltZUZvcm1hdFBhcnRbXSk6IERhdGVUaW1lRm9ybWF0UGFydFtdIHtcbiAgICBsZXQgcmVzdWx0OiBEYXRlVGltZUZvcm1hdFBhcnRbXSA9IFtdO1xuICAgIGNvbnN0IHR5cGVBcnJheSA9IFtcbiAgICAgIFwieWVhclwiLFxuICAgICAgXCJtb250aFwiLFxuICAgICAgXCJkYXlcIixcbiAgICAgIFwiaG91clwiLFxuICAgICAgXCJtaW51dGVcIixcbiAgICAgIFwic2Vjb25kXCIsXG4gICAgICBcImZyYWN0aW9uYWxTZWNvbmRcIixcbiAgICBdO1xuICAgIGZvciAoY29uc3QgdHlwZSBvZiB0eXBlQXJyYXkpIHtcbiAgICAgIGNvbnN0IGN1cnJlbnQgPSBwYXJ0cy5maW5kSW5kZXgoKGVsKSA9PiBlbC50eXBlID09PSB0eXBlKTtcbiAgICAgIGlmIChjdXJyZW50ICE9PSAtMSkge1xuICAgICAgICByZXN1bHQgPSByZXN1bHQuY29uY2F0KHBhcnRzLnNwbGljZShjdXJyZW50LCAxKSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJlc3VsdCA9IHJlc3VsdC5jb25jYXQocGFydHMpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwYXJ0c1RvRGF0ZShwYXJ0czogRGF0ZVRpbWVGb3JtYXRQYXJ0W10pOiBEYXRlIHtcbiAgICBjb25zdCBkYXRlID0gbmV3IERhdGUoKTtcbiAgICBjb25zdCB1dGMgPSBwYXJ0cy5maW5kKFxuICAgICAgKHBhcnQpID0+IHBhcnQudHlwZSA9PT0gXCJ0aW1lWm9uZU5hbWVcIiAmJiBwYXJ0LnZhbHVlID09PSBcIlVUQ1wiLFxuICAgICk7XG5cbiAgICBjb25zdCBkYXlQYXJ0ID0gcGFydHMuZmluZCgocGFydCkgPT4gcGFydC50eXBlID09PSBcImRheVwiKTtcblxuICAgIHV0YyA/IGRhdGUuc2V0VVRDSG91cnMoMCwgMCwgMCwgMCkgOiBkYXRlLnNldEhvdXJzKDAsIDAsIDAsIDApO1xuICAgIGZvciAoY29uc3QgcGFydCBvZiBwYXJ0cykge1xuICAgICAgc3dpdGNoIChwYXJ0LnR5cGUpIHtcbiAgICAgICAgY2FzZSBcInllYXJcIjoge1xuICAgICAgICAgIGNvbnN0IHZhbHVlID0gTnVtYmVyKHBhcnQudmFsdWUucGFkU3RhcnQoNCwgXCIyMFwiKSk7XG4gICAgICAgICAgdXRjID8gZGF0ZS5zZXRVVENGdWxsWWVhcih2YWx1ZSkgOiBkYXRlLnNldEZ1bGxZZWFyKHZhbHVlKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBjYXNlIFwibW9udGhcIjoge1xuICAgICAgICAgIGNvbnN0IHZhbHVlID0gTnVtYmVyKHBhcnQudmFsdWUpIC0gMTtcbiAgICAgICAgICBpZiAoZGF5UGFydCkge1xuICAgICAgICAgICAgdXRjXG4gICAgICAgICAgICAgID8gZGF0ZS5zZXRVVENNb250aCh2YWx1ZSwgTnVtYmVyKGRheVBhcnQudmFsdWUpKVxuICAgICAgICAgICAgICA6IGRhdGUuc2V0TW9udGgodmFsdWUsIE51bWJlcihkYXlQYXJ0LnZhbHVlKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHV0YyA/IGRhdGUuc2V0VVRDTW9udGgodmFsdWUpIDogZGF0ZS5zZXRNb250aCh2YWx1ZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGNhc2UgXCJkYXlcIjoge1xuICAgICAgICAgIGNvbnN0IHZhbHVlID0gTnVtYmVyKHBhcnQudmFsdWUpO1xuICAgICAgICAgIHV0YyA/IGRhdGUuc2V0VVRDRGF0ZSh2YWx1ZSkgOiBkYXRlLnNldERhdGUodmFsdWUpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGNhc2UgXCJob3VyXCI6IHtcbiAgICAgICAgICBsZXQgdmFsdWUgPSBOdW1iZXIocGFydC52YWx1ZSk7XG4gICAgICAgICAgY29uc3QgZGF5UGVyaW9kID0gcGFydHMuZmluZChcbiAgICAgICAgICAgIChwYXJ0OiBEYXRlVGltZUZvcm1hdFBhcnQpID0+IHBhcnQudHlwZSA9PT0gXCJkYXlQZXJpb2RcIixcbiAgICAgICAgICApO1xuICAgICAgICAgIGlmIChkYXlQZXJpb2Q/LnZhbHVlID09PSBcIlBNXCIpIHZhbHVlICs9IDEyO1xuICAgICAgICAgIHV0YyA/IGRhdGUuc2V0VVRDSG91cnModmFsdWUpIDogZGF0ZS5zZXRIb3Vycyh2YWx1ZSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgY2FzZSBcIm1pbnV0ZVwiOiB7XG4gICAgICAgICAgY29uc3QgdmFsdWUgPSBOdW1iZXIocGFydC52YWx1ZSk7XG4gICAgICAgICAgdXRjID8gZGF0ZS5zZXRVVENNaW51dGVzKHZhbHVlKSA6IGRhdGUuc2V0TWludXRlcyh2YWx1ZSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgY2FzZSBcInNlY29uZFwiOiB7XG4gICAgICAgICAgY29uc3QgdmFsdWUgPSBOdW1iZXIocGFydC52YWx1ZSk7XG4gICAgICAgICAgdXRjID8gZGF0ZS5zZXRVVENTZWNvbmRzKHZhbHVlKSA6IGRhdGUuc2V0U2Vjb25kcyh2YWx1ZSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgY2FzZSBcImZyYWN0aW9uYWxTZWNvbmRcIjoge1xuICAgICAgICAgIGNvbnN0IHZhbHVlID0gTnVtYmVyKHBhcnQudmFsdWUpO1xuICAgICAgICAgIHV0YyA/IGRhdGUuc2V0VVRDTWlsbGlzZWNvbmRzKHZhbHVlKSA6IGRhdGUuc2V0TWlsbGlzZWNvbmRzKHZhbHVlKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZGF0ZTtcbiAgfVxuXG4gIHBhcnNlKHN0cmluZzogc3RyaW5nKTogRGF0ZSB7XG4gICAgY29uc3QgcGFydHMgPSB0aGlzLnBhcnNlVG9QYXJ0cyhzdHJpbmcpO1xuICAgIGNvbnN0IHNvcnRQYXJ0cyA9IHRoaXMuc29ydERhdGVUaW1lRm9ybWF0UGFydChwYXJ0cyk7XG4gICAgcmV0dXJuIHRoaXMucGFydHNUb0RhdGUoc29ydFBhcnRzKTtcbiAgfVxufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUMxRSxxQ0FBcUM7QUFFckMsU0FNRSxTQUFTLFFBQ0osaUJBQWlCO0FBRXhCLFNBQVMsT0FBTyxLQUFzQixFQUFFLFFBQVEsQ0FBQztFQUMvQyxPQUFPLE9BQU8sT0FBTyxRQUFRLENBQUMsT0FBTztBQUN2QztBQTRCQSxTQUFTLDBCQUEwQixLQUFhO0VBQzlDLE9BQU8sQ0FBQztJQUNOLE9BQU8sT0FBTyxVQUFVLENBQUMsU0FDckI7TUFBRTtNQUFPLFFBQVEsTUFBTSxNQUFNO0lBQUMsSUFDOUI7RUFDTjtBQUNGO0FBRUEsU0FBUyx3QkFBd0IsS0FBYTtFQUM1QyxPQUFPLENBQUM7SUFDTixNQUFNLFNBQVMsTUFBTSxJQUFJLENBQUM7SUFDMUIsSUFBSSxRQUFRLE9BQU87TUFBRSxPQUFPO01BQVEsUUFBUSxNQUFNLENBQUMsRUFBRSxDQUFDLE1BQU07SUFBQztFQUMvRDtBQUNGO0FBRUEsNkdBQTZHO0FBQzdHLE1BQU0sZUFBZTtFQUNuQjtJQUNFLE1BQU0sMEJBQTBCO0lBQ2hDLElBQUksSUFBc0IsQ0FBQztRQUFFLE1BQU07UUFBUSxPQUFPO01BQVUsQ0FBQztFQUMvRDtFQUNBO0lBQ0UsTUFBTSwwQkFBMEI7SUFDaEMsSUFBSSxJQUFzQixDQUFDO1FBQUUsTUFBTTtRQUFRLE9BQU87TUFBVSxD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