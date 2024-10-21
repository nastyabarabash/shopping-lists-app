// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
/**
 * Utilities for dealing with {@linkcode Date} objects.
 *
 * This module is browser compatible.
 *
 * @module
 */ import { DateTimeFormatter } from "./formatter.ts";
export const SECOND = 1e3;
export const MINUTE = SECOND * 60;
export const HOUR = MINUTE * 60;
export const DAY = HOUR * 24;
export const WEEK = DAY * 7;
const DAYS_PER_WEEK = 7;
var Day;
(function(Day) {
  Day[Day["Sun"] = 0] = "Sun";
  Day[Day["Mon"] = 1] = "Mon";
  Day[Day["Tue"] = 2] = "Tue";
  Day[Day["Wed"] = 3] = "Wed";
  Day[Day["Thu"] = 4] = "Thu";
  Day[Day["Fri"] = 5] = "Fri";
  Day[Day["Sat"] = 6] = "Sat";
})(Day || (Day = {}));
/**
 * Parse date from string using format string
 * @param dateString Date string
 * @param format Format string
 * @return Parsed date
 */ export function parse(dateString, formatString) {
  const formatter = new DateTimeFormatter(formatString);
  const parts = formatter.parseToParts(dateString);
  const sortParts = formatter.sortDateTimeFormatPart(parts);
  return formatter.partsToDate(sortParts);
}
/**
 * Format date using format string
 * @param date Date
 * @param format Format string
 * @return formatted date string
 */ export function format(date, formatString) {
  const formatter = new DateTimeFormatter(formatString);
  return formatter.format(date);
}
/**
 * Get number of the day in the year
 * @return Number of the day in year
 */ export function dayOfYear(date) {
  // Values from 0 to 99 map to the years 1900 to 1999. All other values are the actual year. (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/Date)
  // Using setFullYear as a workaround
  const yearStart = new Date(date);
  yearStart.setUTCFullYear(date.getUTCFullYear(), 0, 0);
  const diff = date.getTime() - yearStart.getTime();
  return Math.floor(diff / DAY);
}
/**
 * Get number of the week in the year (ISO-8601)
 * @return Number of the week in year
 */ export function weekOfYear(date) {
  const workingDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = workingDate.getUTCDay();
  const nearestThursday = workingDate.getUTCDate() + Day.Thu - (day === Day.Sun ? DAYS_PER_WEEK : day);
  workingDate.setUTCDate(nearestThursday);
  // Get first day of year
  const yearStart = new Date(Date.UTC(workingDate.getUTCFullYear(), 0, 1));
  // return the calculated full weeks to nearest Thursday
  return Math.ceil((workingDate.getTime() - yearStart.getTime() + DAY) / WEEK);
}
/**
 * Parse a date to return a IMF formatted string date
 * RFC: https://tools.ietf.org/html/rfc7231#section-7.1.1.1
 * IMF is the time format to use when generating times in HTTP
 * headers. The time being formatted must be in UTC for Format to
 * generate the correct format.
 * @param date Date to parse
 * @return IMF date formatted string
 */ export function toIMF(date) {
  function dtPad(v, lPad = 2) {
    return v.padStart(lPad, "0");
  }
  const d = dtPad(date.getUTCDate().toString());
  const h = dtPad(date.getUTCHours().toString());
  const min = dtPad(date.getUTCMinutes().toString());
  const s = dtPad(date.getUTCSeconds().toString());
  const y = date.getUTCFullYear();
  const days = [
    "Sun",
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat"
  ];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
  ];
  return `${days[date.getUTCDay()]}, ${d} ${months[date.getUTCMonth()]} ${y} ${h}:${min}:${s} GMT`;
}
/**
 * Check given year is a leap year or not.
 * based on : https://docs.microsoft.com/en-us/office/troubleshoot/excel/determine-a-leap-year
 * @param year year in number or Date format
 */ export function isLeap(year) {
  const yearNumber = year instanceof Date ? year.getFullYear() : year;
  return yearNumber % 4 === 0 && yearNumber % 100 !== 0 || yearNumber % 400 === 0;
}
/**
 * Calculate difference between two dates.
 * @param from Year to calculate difference
 * @param to Year to calculate difference with
 * @param options Options for determining how to respond
 *
 * example :
 *
 * ```typescript
 * import * as datetime from "https://deno.land/std@$STD_VERSION/datetime/mod.ts";
 *
 * datetime.difference(new Date("2020/1/1"),new Date("2020/2/2"),{ units : ["days","months"] })
 * ```
 */ export function difference(from, to, options) {
  const uniqueUnits = options?.units ? [
    ...new Set(options?.units)
  ] : [
    "milliseconds",
    "seconds",
    "minutes",
    "hours",
    "days",
    "weeks",
    "months",
    "quarters",
    "years"
  ];
  const bigger = Math.max(from.getTime(), to.getTime());
  const smaller = Math.min(from.getTime(), to.getTime());
  const differenceInMs = bigger - smaller;
  const differences = {};
  for (const uniqueUnit of uniqueUnits){
    switch(uniqueUnit){
      case "milliseconds":
        differences.milliseconds = differenceInMs;
        break;
      case "seconds":
        differences.seconds = Math.floor(differenceInMs / SECOND);
        break;
      case "minutes":
        differences.minutes = Math.floor(differenceInMs / MINUTE);
        break;
      case "hours":
        differences.hours = Math.floor(differenceInMs / HOUR);
        break;
      case "days":
        differences.days = Math.floor(differenceInMs / DAY);
        break;
      case "weeks":
        differences.weeks = Math.floor(differenceInMs / WEEK);
        break;
      case "months":
        differences.months = calculateMonthsDifference(bigger, smaller);
        break;
      case "quarters":
        differences.quarters = Math.floor(typeof differences.months !== "undefined" && differences.months / 4 || calculateMonthsDifference(bigger, smaller) / 4);
        break;
      case "years":
        differences.years = Math.floor(typeof differences.months !== "undefined" && differences.months / 12 || calculateMonthsDifference(bigger, smaller) / 12);
        break;
    }
  }
  return differences;
}
function calculateMonthsDifference(bigger, smaller) {
  const biggerDate = new Date(bigger);
  const smallerDate = new Date(smaller);
  const yearsDiff = biggerDate.getFullYear() - smallerDate.getFullYear();
  const monthsDiff = biggerDate.getMonth() - smallerDate.getMonth();
  const calendarDifferences = Math.abs(yearsDiff * 12 + monthsDiff);
  const compareResult = biggerDate > smallerDate ? 1 : -1;
  biggerDate.setMonth(biggerDate.getMonth() - compareResult * calendarDifferences);
  const isLastMonthNotFull = biggerDate > smallerDate ? 1 : -1 === -compareResult ? 1 : 0;
  const months = compareResult * (calendarDifferences - isLastMonthNotFull);
  return months === 0 ? 0 : months;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2MC4wL2RhdGV0aW1lL21vZC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuXG4vKipcbiAqIFV0aWxpdGllcyBmb3IgZGVhbGluZyB3aXRoIHtAbGlua2NvZGUgRGF0ZX0gb2JqZWN0cy5cbiAqXG4gKiBUaGlzIG1vZHVsZSBpcyBicm93c2VyIGNvbXBhdGlibGUuXG4gKlxuICogQG1vZHVsZVxuICovXG5cbmltcG9ydCB7IERhdGVUaW1lRm9ybWF0dGVyIH0gZnJvbSBcIi4vZm9ybWF0dGVyLnRzXCI7XG5cbmV4cG9ydCBjb25zdCBTRUNPTkQgPSAxZTM7XG5leHBvcnQgY29uc3QgTUlOVVRFID0gU0VDT05EICogNjA7XG5leHBvcnQgY29uc3QgSE9VUiA9IE1JTlVURSAqIDYwO1xuZXhwb3J0IGNvbnN0IERBWSA9IEhPVVIgKiAyNDtcbmV4cG9ydCBjb25zdCBXRUVLID0gREFZICogNztcbmNvbnN0IERBWVNfUEVSX1dFRUsgPSA3O1xuXG5lbnVtIERheSB7XG4gIFN1bixcbiAgTW9uLFxuICBUdWUsXG4gIFdlZCxcbiAgVGh1LFxuICBGcmksXG4gIFNhdCxcbn1cblxuLyoqXG4gKiBQYXJzZSBkYXRlIGZyb20gc3RyaW5nIHVzaW5nIGZvcm1hdCBzdHJpbmdcbiAqIEBwYXJhbSBkYXRlU3RyaW5nIERhdGUgc3RyaW5nXG4gKiBAcGFyYW0gZm9ybWF0IEZvcm1hdCBzdHJpbmdcbiAqIEByZXR1cm4gUGFyc2VkIGRhdGVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlKGRhdGVTdHJpbmc6IHN0cmluZywgZm9ybWF0U3RyaW5nOiBzdHJpbmcpOiBEYXRlIHtcbiAgY29uc3QgZm9ybWF0dGVyID0gbmV3IERhdGVUaW1lRm9ybWF0dGVyKGZvcm1hdFN0cmluZyk7XG4gIGNvbnN0IHBhcnRzID0gZm9ybWF0dGVyLnBhcnNlVG9QYXJ0cyhkYXRlU3RyaW5nKTtcbiAgY29uc3Qgc29ydFBhcnRzID0gZm9ybWF0dGVyLnNvcnREYXRlVGltZUZvcm1hdFBhcnQocGFydHMpO1xuICByZXR1cm4gZm9ybWF0dGVyLnBhcnRzVG9EYXRlKHNvcnRQYXJ0cyk7XG59XG5cbi8qKlxuICogRm9ybWF0IGRhdGUgdXNpbmcgZm9ybWF0IHN0cmluZ1xuICogQHBhcmFtIGRhdGUgRGF0ZVxuICogQHBhcmFtIGZvcm1hdCBGb3JtYXQgc3RyaW5nXG4gKiBAcmV0dXJuIGZvcm1hdHRlZCBkYXRlIHN0cmluZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0KGRhdGU6IERhdGUsIGZvcm1hdFN0cmluZzogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3QgZm9ybWF0dGVyID0gbmV3IERhdGVUaW1lRm9ybWF0dGVyKGZvcm1hdFN0cmluZyk7XG4gIHJldHVybiBmb3JtYXR0ZXIuZm9ybWF0KGRhdGUpO1xufVxuXG4vKipcbiAqIEdldCBudW1iZXIgb2YgdGhlIGRheSBpbiB0aGUgeWVhclxuICogQHJldHVybiBOdW1iZXIgb2YgdGhlIGRheSBpbiB5ZWFyXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkYXlPZlllYXIoZGF0ZTogRGF0ZSk6IG51bWJlciB7XG4gIC8vIFZhbHVlcyBmcm9tIDAgdG8gOTkgbWFwIHRvIHRoZSB5ZWFycyAxOTAwIHRvIDE5OTkuIEFsbCBvdGhlciB2YWx1ZXMgYXJlIHRoZSBhY3R1YWwgeWVhci4gKGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL0RhdGUvRGF0ZSlcbiAgLy8gVXNpbmcgc2V0RnVsbFllYXIgYXMgYSB3b3JrYXJvdW5kXG5cbiAgY29uc3QgeWVhclN0YXJ0ID0gbmV3IERhdGUoZGF0ZSk7XG5cbiAgeWVhclN0YXJ0LnNldFVUQ0Z1bGxZZWFyKGRhdGUuZ2V0VVRDRnVsbFllYXIoKSwgMCwgMCk7XG4gIGNvbnN0IGRpZmYgPSBkYXRlLmdldFRpbWUoKSAtXG4gICAgeWVhclN0YXJ0LmdldFRpbWUoKTtcblxuICByZXR1cm4gTWF0aC5mbG9vcihkaWZmIC8gREFZKTtcbn1cbi8qKlxuICogR2V0IG51bWJlciBvZiB0aGUgd2VlayBpbiB0aGUgeWVhciAoSVNPLTg2MDEpXG4gKiBAcmV0dXJuIE51bWJlciBvZiB0aGUgd2VlayBpbiB5ZWFyXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB3ZWVrT2ZZZWFyKGRhdGU6IERhdGUpOiBudW1iZXIge1xuICBjb25zdCB3b3JraW5nRGF0ZSA9IG5ldyBEYXRlKFxuICAgIERhdGUuVVRDKGRhdGUuZ2V0RnVsbFllYXIoKSwgZGF0ZS5nZXRNb250aCgpLCBkYXRlLmdldERhdGUoKSksXG4gICk7XG5cbiAgY29uc3QgZGF5ID0gd29ya2luZ0RhdGUuZ2V0VVRDRGF5KCk7XG5cbiAgY29uc3QgbmVhcmVzdFRodXJzZGF5ID0gd29ya2luZ0RhdGUuZ2V0VVRDRGF0ZSgpICtcbiAgICBEYXkuVGh1IC1cbiAgICAoZGF5ID09PSBEYXkuU3VuID8gREFZU19QRVJfV0VFSyA6IGRheSk7XG5cbiAgd29ya2luZ0RhdGUuc2V0VVRDRGF0ZShuZWFyZXN0VGh1cnNkYXkpO1xuXG4gIC8vIEdldCBmaXJzdCBkYXkgb2YgeWVhclxuICBjb25zdCB5ZWFyU3RhcnQgPSBuZXcgRGF0ZShEYXRlLlVUQyh3b3JraW5nRGF0ZS5nZXRVVENGdWxsWWVhcigpLCAwLCAxKSk7XG5cbiAgLy8gcmV0dXJuIHRoZSBjYWxjdWxhdGVkIGZ1bGwgd2Vla3MgdG8gbmVhcmVzdCBUaHVyc2RheVxuICByZXR1cm4gTWF0aC5jZWlsKCh3b3JraW5nRGF0ZS5nZXRUaW1lKCkgLSB5ZWFyU3RhcnQuZ2V0VGltZSgpICsgREFZKSAvIFdFRUspO1xufVxuXG4vKipcbiAqIFBhcnNlIGEgZGF0ZSB0byByZXR1cm4gYSBJTUYgZm9ybWF0dGVkIHN0cmluZyBkYXRlXG4gKiBSRkM6IGh0dHBzOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmM3MjMxI3NlY3Rpb24tNy4xLjEuMVxuICogSU1GIGlzIHRoZSB0aW1lIGZvcm1hdCB0byB1c2Ugd2hlbiBnZW5lcmF0aW5nIHRpbWVzIGluIEhUVFBcbiAqIGhlYWRlcnMuIFRoZSB0aW1lIGJlaW5nIGZvcm1hdHRlZCBtdXN0IGJlIGluIFVUQyBmb3IgRm9ybWF0IHRvXG4gKiBnZW5lcmF0ZSB0aGUgY29ycmVjdCBmb3JtYXQuXG4gKiBAcGFyYW0gZGF0ZSBEYXRlIHRvIHBhcnNlXG4gKiBAcmV0dXJuIElNRiBkYXRlIGZvcm1hdHRlZCBzdHJpbmdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRvSU1GKGRhdGU6IERhdGUpOiBzdHJpbmcge1xuICBmdW5jdGlvbiBkdFBhZCh2OiBzdHJpbmcsIGxQYWQgPSAyKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdi5wYWRTdGFydChsUGFkLCBcIjBcIik7XG4gIH1cbiAgY29uc3QgZCA9IGR0UGFkKGRhdGUuZ2V0VVRDRGF0ZSgpLnRvU3RyaW5nKCkpO1xuICBjb25zdCBoID0gZHRQYWQoZGF0ZS5nZXRVVENIb3VycygpLnRvU3RyaW5nKCkpO1xuICBjb25zdCBtaW4gPSBkdFBhZChkYXRlLmdldFVUQ01pbnV0ZXMoKS50b1N0cmluZygpKTtcbiAgY29uc3QgcyA9IGR0UGFkKGRhdGUuZ2V0VVRDU2Vjb25kcygpLnRvU3RyaW5nKCkpO1xuICBjb25zdCB5ID0gZGF0ZS5nZXRVVENGdWxsWWVhcigpO1xuICBjb25zdCBkYXlzID0gW1wiU3VuXCIsIFwiTW9uXCIsIFwiVHVlXCIsIFwiV2VkXCIsIFwiVGh1XCIsIFwiRnJpXCIsIFwiU2F0XCJdO1xuICBjb25zdCBtb250aHMgPSBbXG4gICAgXCJKYW5cIixcbiAgICBcIkZlYlwiLFxuICAgIFwiTWFyXCIsXG4gICAgXCJBcHJcIixcbiAgICBcIk1heVwiLFxuICAgIFwiSnVuXCIsXG4gICAgXCJKdWxcIixcbiAgICBcIkF1Z1wiLFxuICAgIFwiU2VwXCIsXG4gICAgXCJPY3RcIixcbiAgICBcIk5vdlwiLFxuICAgIFwiRGVjXCIsXG4gIF07XG4gIHJldHVybiBgJHtkYXlzW2RhdGUuZ2V0VVRDRGF5KCldfSwgJHtkfSAke1xuICAgIG1vbnRoc1tkYXRlLmdldFVUQ01vbnRoKCldXG4gIH0gJHt5fSAke2h9OiR7bWlufToke3N9IEdNVGA7XG59XG5cbi8qKlxuICogQ2hlY2sgZ2l2ZW4geWVhciBpcyBhIGxlYXAgeWVhciBvciBub3QuXG4gKiBiYXNlZCBvbiA6IGh0dHBzOi8vZG9jcy5taWNyb3NvZnQuY29tL2VuLXVzL29mZmljZS90cm91Ymxlc2hvb3QvZXhjZWwvZGV0ZXJtaW5lLWEtbGVhcC15ZWFyXG4gKiBAcGFyYW0geWVhciB5ZWFyIGluIG51bWJlciBvciBEYXRlIGZvcm1hdFxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNMZWFwKHllYXI6IERhdGUgfCBudW1iZXIpOiBib29sZWFuIHtcbiAgY29uc3QgeWVhck51bWJlciA9IHllYXIgaW5zdGFuY2VvZiBEYXRlID8geWVhci5nZXRGdWxsWWVhcigpIDogeWVhcjtcbiAgcmV0dXJuIChcbiAgICAoeWVhck51bWJlciAlIDQgPT09IDAgJiYgeWVhck51bWJlciAlIDEwMCAhPT0gMCkgfHwgeWVhck51bWJlciAlIDQwMCA9PT0gMFxuICApO1xufVxuXG5leHBvcnQgdHlwZSBVbml0ID1cbiAgfCBcIm1pbGxpc2Vjb25kc1wiXG4gIHwgXCJzZWNvbmRzXCJcbiAgfCBcIm1pbnV0ZXNcIlxuICB8IFwiaG91cnNcIlxuICB8IFwiZGF5c1wiXG4gIHwgXCJ3ZWVrc1wiXG4gIHwgXCJtb250aHNcIlxuICB8IFwicXVhcnRlcnNcIlxuICB8IFwieWVhcnNcIjtcblxuZXhwb3J0IHR5cGUgRGlmZmVyZW5jZUZvcm1hdCA9IFBhcnRpYWw8UmVjb3JkPFVuaXQsIG51bWJlcj4+O1xuXG5leHBvcnQgdHlwZSBEaWZmZXJlbmNlT3B0aW9ucyA9IHtcbiAgdW5pdHM/OiBVbml0W107XG59O1xuXG4vKipcbiAqIENhbGN1bGF0ZSBkaWZmZXJlbmNlIGJldHdlZW4gdHdvIGRhdGVzLlxuICogQHBhcmFtIGZyb20gWWVhciB0byBjYWxjdWxhdGUgZGlmZmVyZW5jZVxuICogQHBhcmFtIHRvIFllYXIgdG8gY2FsY3VsYXRlIGRpZmZlcmVuY2Ugd2l0aFxuICogQHBhcmFtIG9wdGlvbnMgT3B0aW9ucyBmb3IgZGV0ZXJtaW5pbmcgaG93IHRvIHJlc3BvbmRcbiAqXG4gKiBleGFtcGxlIDpcbiAqXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBpbXBvcnQgKiBhcyBkYXRldGltZSBmcm9tIFwiaHR0cHM6Ly9kZW5vLmxhbmQvc3RkQCRTVERfVkVSU0lPTi9kYXRldGltZS9tb2QudHNcIjtcbiAqXG4gKiBkYXRldGltZS5kaWZmZXJlbmNlKG5ldyBEYXRlKFwiMjAyMC8xLzFcIiksbmV3IERhdGUoXCIyMDIwLzIvMlwiKSx7IHVuaXRzIDogW1wiZGF5c1wiLFwibW9udGhzXCJdIH0pXG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRpZmZlcmVuY2UoXG4gIGZyb206IERhdGUsXG4gIHRvOiBEYXRlLFxuICBvcHRpb25zPzogRGlmZmVyZW5jZU9wdGlvbnMsXG4pOiBEaWZmZXJlbmNlRm9ybWF0IHtcbiAgY29uc3QgdW5pcXVlVW5pdHMgPSBvcHRpb25zPy51bml0cyA/IFsuLi5uZXcgU2V0KG9wdGlvbnM/LnVuaXRzKV0gOiBbXG4gICAgXCJtaWxsaXNlY29uZHNcIixcbiAgICBcInNlY29uZHNcIixcbiAgICBcIm1pbnV0ZXNcIixcbiAgICBcImhvdXJzXCIsXG4gICAgXCJkYXlzXCIsXG4gICAgXCJ3ZWVrc1wiLFxuICAgIFwibW9udGhzXCIsXG4gICAgXCJxdWFydGVyc1wiLFxuICAgIFwieWVhcnNcIixcbiAgXTtcblxuICBjb25zdCBiaWdnZXIgPSBNYXRoLm1heChmcm9tLmdldFRpbWUoKSwgdG8uZ2V0VGltZSgpKTtcbiAgY29uc3Qgc21hbGxlciA9IE1hdGgubWluKGZyb20uZ2V0VGltZSgpLCB0by5nZXRUaW1lKCkpO1xuICBjb25zdCBkaWZmZXJlbmNlSW5NcyA9IGJpZ2dlciAtIHNtYWxsZXI7XG5cbiAgY29uc3QgZGlmZmVyZW5jZXM6IERpZmZlcmVuY2VGb3JtYXQgPSB7fTtcblxuICBmb3IgKGNvbnN0IHVuaXF1ZVVuaXQgb2YgdW5pcXVlVW5pdHMpIHtcbiAgICBzd2l0Y2ggKHVuaXF1ZVVuaXQpIHtcbiAgICAgIGNhc2UgXCJtaWxsaXNlY29uZHNcIjpcbiAgICAgICAgZGlmZmVyZW5jZXMubWlsbGlzZWNvbmRzID0gZGlmZmVyZW5jZUluTXM7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBcInNlY29uZHNcIjpcbiAgICAgICAgZGlmZmVyZW5jZXMuc2Vjb25kcyA9IE1hdGguZmxvb3IoZGlmZmVyZW5jZUluTXMgLyBTRUNPTkQpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgXCJtaW51dGVzXCI6XG4gICAgICAgIGRpZmZlcmVuY2VzLm1pbnV0ZXMgPSBNYXRoLmZsb29yKGRpZmZlcmVuY2VJbk1zIC8gTUlOVVRFKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFwiaG91cnNcIjpcbiAgICAgICAgZGlmZmVyZW5jZXMuaG91cnMgPSBNYXRoLmZsb29yKGRpZmZlcmVuY2VJbk1zIC8gSE9VUik7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBcImRheXNcIjpcbiAgICAgICAgZGlmZmVyZW5jZXMuZGF5cyA9IE1hdGguZmxvb3IoZGlmZmVyZW5jZUluTXMgLyBEQVkpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgXCJ3ZWVrc1wiOlxuICAgICAgICBkaWZmZXJlbmNlcy53ZWVrcyA9IE1hdGguZmxvb3IoZGlmZmVyZW5jZUluTXMgLyBXRUVLKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFwibW9udGhzXCI6XG4gICAgICAgIGRpZmZlcmVuY2VzLm1vbnRocyA9IGNhbGN1bGF0ZU1vbnRoc0RpZmZlcmVuY2UoYmlnZ2VyLCBzbWFsbGVyKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFwicXVhcnRlcnNcIjpcbiAgICAgICAgZGlmZmVyZW5jZXMucXVhcnRlcnMgPSBNYXRoLmZsb29yKFxuICAgICAgICAgICh0eXBlb2YgZGlmZmVyZW5jZXMubW9udGhzICE9PSBcInVuZGVmaW5lZFwiICYmXG4gICAgICAgICAgICBkaWZmZXJlbmNlcy5tb250aHMgLyA0KSB8fFxuICAgICAgICAgICAgY2FsY3VsYXRlTW9udGhzRGlmZmVyZW5jZShiaWdnZXIsIHNtYWxsZXIpIC8gNCxcbiAgICAgICAgKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFwieWVhcnNcIjpcbiAgICAgICAgZGlmZmVyZW5jZXMueWVhcnMgPSBNYXRoLmZsb29yKFxuICAgICAgICAgICh0eXBlb2YgZGlmZmVyZW5jZXMubW9udGhzICE9PSBcInVuZGVmaW5lZFwiICYmXG4gICAgICAgICAgICBkaWZmZXJlbmNlcy5tb250aHMgLyAxMikgfHxcbiAgICAgICAgICAgIGNhbGN1bGF0ZU1vbnRoc0RpZmZlcmVuY2UoYmlnZ2VyLCBzbWFsbGVyKSAvIDEyLFxuICAgICAgICApO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZGlmZmVyZW5jZXM7XG59XG5cbmZ1bmN0aW9uIGNhbGN1bGF0ZU1vbnRoc0RpZmZlcmVuY2UoYmlnZ2VyOiBudW1iZXIsIHNtYWxsZXI6IG51bWJlcik6IG51bWJlciB7XG4gIGNvbnN0IGJpZ2dlckRhdGUgPSBuZXcgRGF0ZShiaWdnZXIpO1xuICBjb25zdCBzbWFsbGVyRGF0ZSA9IG5ldyBEYXRlKHNtYWxsZXIpO1xuICBjb25zdCB5ZWFyc0RpZmYgPSBiaWdnZXJEYXRlLmdldEZ1bGxZZWFyKCkgLSBzbWFsbGVyRGF0ZS5nZXRGdWxsWWVhcigpO1xuICBjb25zdCBtb250aHNEaWZmID0gYmlnZ2VyRGF0ZS5nZXRNb250aCgpIC0gc21hbGxlckRhdGUuZ2V0TW9udGgoKTtcbiAgY29uc3QgY2FsZW5kYXJEaWZmZXJlbmNlcyA9IE1hdGguYWJzKHllYXJzRGlmZiAqIDEyICsgbW9udGhzRGlmZik7XG4gIGNvbnN0IGNvbXBhcmVSZXN1bHQgPSBiaWdnZXJEYXRlID4gc21hbGxlckRhdGUgPyAxIDogLTE7XG4gIGJpZ2dlckRhdGUuc2V0TW9udGgoXG4gICAgYmlnZ2VyRGF0ZS5nZXRNb250aCgpIC0gY29tcGFyZVJlc3VsdCAqIGNhbGVuZGFyRGlmZmVyZW5jZXMsXG4gICk7XG4gIGNvbnN0IGlzTGFzdE1vbnRoTm90RnVsbCA9IGJpZ2dlckRhdGUgPiBzbWFsbGVyRGF0ZVxuICAgID8gMVxuICAgIDogLTEgPT09IC1jb21wYXJlUmVzdWx0XG4gICAgPyAxXG4gICAgOiAwO1xuICBjb25zdCBtb250aHMgPSBjb21wYXJlUmVzdWx0ICogKGNhbGVuZGFyRGlmZmVyZW5jZXMgLSBpc0xhc3RNb250aE5vdEZ1bGwpO1xuICByZXR1cm4gbW9udGhzID09PSAwID8gMCA6IG1vbnRocztcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFFMUU7Ozs7OztDQU1DLEdBRUQsU0FBUyxpQkFBaUIsUUFBUSxpQkFBaUI7QUFFbkQsT0FBTyxNQUFNLFNBQVMsSUFBSTtBQUMxQixPQUFPLE1BQU0sU0FBUyxTQUFTLEdBQUc7QUFDbEMsT0FBTyxNQUFNLE9BQU8sU0FBUyxHQUFHO0FBQ2hDLE9BQU8sTUFBTSxNQUFNLE9BQU8sR0FBRztBQUM3QixPQUFPLE1BQU0sT0FBTyxNQUFNLEVBQUU7QUFDNUIsTUFBTSxnQkFBZ0I7O1VBRWpCOzs7Ozs7OztHQUFBLFFBQUE7QUFVTDs7Ozs7Q0FLQyxHQUNELE9BQU8sU0FBUyxNQUFNLFVBQWtCLEVBQUUsWUFBb0I7RUFDNUQsTUFBTSxZQUFZLElBQUksa0JBQWtCO0VBQ3hDLE1BQU0sUUFBUSxVQUFVLFlBQVksQ0FBQztFQUNyQyxNQUFNLFlBQVksVUFBVSxzQkFBc0IsQ0FBQztFQUNuRCxPQUFPLFVBQVUsV0FBVyxDQUFDO0FBQy9CO0FBRUE7Ozs7O0NBS0MsR0FDRCxPQUFPLFNBQVMsT0FBTyxJQUFVLEVBQUUsWUFBb0I7RUFDckQsTUFBTSxZQUFZLElBQUksa0JBQWtCO0VBQ3hDLE9BQU8sVUFBVSxNQUFNLENBQUM7QUFDMUI7QUFFQTs7O0NBR0MsR0FDRCxPQUFPLFNBQVMsVUFBVSxJQUFVO0VBQ2xDLHdMQUF3TDtFQUN4TCxvQ0FBb0M7RUFFcEMsTUFBTSxZQUFZLElBQUksS0FBSztFQUUzQixVQUFVLGNBQWMsQ0FBQyxLQUFLLGNBQWMsSUFBSSxHQUFHO0VBQ25ELE1BQU0sT0FBTyxLQUFLLE9BQU8sS0FDdkIsVUFBVSxPQUFPO0VBRW5CLE9BQU8sS0FBSyxLQUFLLENBQUMsT0FBTztBQUMzQjtBQUNBOzs7Q0FHQyxHQUNELE9BQU8sU0FBUyxXQUFXLElBQVU7RUFDbkMsTUFBTSxjQUFjLElBQUksS0FDdEIsS0FBSyxHQUFHLENBQUMsS0FBSyxXQUFXLElBQUksS0FBSyxRQUFRLElBQUksS0FBSyxPQUFPO0VBRzVELE1BQU0sTUFBTSxZQUFZLFNBQVM7RUFFakMsTUFBTSxrQkFBa0IsWUFBWSxVQUFVLEtBQzVDLElBQUksR0FBRyxHQUNQLENBQUMsUUFBUSxJQUFJLEdBQUcsR0FBRyxnQkFBZ0IsR0FBRztFQUV4QyxZQUFZLFVBQVUsQ0FBQztFQUV2Qix3QkFBd0I7RUFDeEIsTUFBTSxZQUFZLElBQUksS0FBSyxLQUFLLEdBQUcsQ0FBQyxZQUFZLGNBQWMsSUFBSSxHQUFHO0VBRXJFLHVEQUF1RDtFQUN2RCxPQUFPLEtBQUssSUFBSSxDQUFDLENBQUMsWUFBWSxPQUFPLEtBQUssVUFBVSxPQUFPLEtBQUssR0FBRyxJQUFJO0FBQ3pFO0FBRUE7Ozs7Ozs7O0NBUUMsR0FDRCxPQUFPLFNBQVMsTUFBTSxJQUFVO0VBQzlCLFNBQVMsTUFBTSxDQUFTLEVBQUUsT0FBTyxDQUFDO0lBQ2hDLE9BQU8sRUFBRSxRQUFRLENBQUMsTUFBTTtFQUMxQjtFQUNBLE1BQU0sSUFBSSxNQUFNLEtBQUssVUFBVSxHQUFHLFFBQVE7RUFDMUMsTUFBTSxJQUFJLE1BQU0sS0FBSyxXQUFXLEdBQUcsUUFBUTtFQUMzQyxNQUFNLE1BQU0sTUFBTSxLQUFLLGFBQWEsR0FBRyxRQUFRO0VBQy9DLE1BQU0sSUFBSSxNQUFNLEtBQUssYUFBYSxHQUFHLFFBQVE7RUFDN0MsTUFBTSxJQUFJLEtBQUssY0FBYztFQUM3QixNQUFNLE9BQU87SUFBQztJQUFPO0lBQU87SUFBTztJQUFPO0lBQU87SUFBTztHQUFNO0VBQzlELE1BQU0sU0FBUztJQUNiO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtHQUNEO0VBQ0QsT0FBTyxDQUFDLEVBQUUsSUFBSSxDQUFDLEtBQUssU0FBUyxHQUFHLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUN0QyxNQUFNLENBQUMsS0FBSyxXQUFXLEdBQUcsQ0FDM0IsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDO0FBQzlCO0FBRUE7Ozs7Q0FJQyxHQUNELE9BQU8sU0FBUyxPQUFPLElBQW1CO0VBQ3hDLE1BQU0sYUFBYSxnQkFBZ0IsT0FBTyxLQUFLLFdBQVcsS0FBSztFQUMvRCxPQUNFLEFBQUMsYUFBYSxNQUFNLEtBQUssYUFBYSxRQUFRLEtBQU0sYUFBYSxRQUFRO0FBRTdFO0FBbUJBOzs7Ozs7Ozs7Ozs7O0NBYUMsR0FDRCxPQUFPLFNBQVMsV0FDZCxJQUFVLEVBQ1YsRUFBUSxFQUNSLE9BQTJCO0VBRTNCLE1BQU0sY0FBYyxTQUFTLFFBQVE7T0FBSSxJQUFJLElBQUksU0FBUztHQUFPLEdBQUc7SUFDbEU7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0dBQ0Q7RUFFRCxNQUFNLFNBQVMsS0FBSyxHQUFHLENBQUMsS0FBSyxPQUFPLElBQUksR0FBRyxPQUFPO0VBQ2xELE1BQU0sVUFBVSxLQUFLLEdBQUcsQ0FBQyxLQUFLLE9BQU8sSUFBSSxHQUFHLE9BQU87RUFDbkQsTUFBTSxpQkFBaUIsU0FBUztFQUVoQyxNQUFNLGNBQWdDLENBQUM7RUFFdkMsS0FBSyxNQUFNLGNBQWMsWUFBYTtJQUNwQyxPQUFRO01BQ04sS0FBSztRQUNILFlBQVksWUFBWSxHQUFHO1FBQzNCO01BQ0YsS0FBSztRQUNILFlBQVksT0FBTyxHQUFHLEtBQUssS0FBSyxDQUFDLGlCQUFpQjtRQUNsRDtNQUNGLEtBQUs7UUFDSCxZQUFZLE9BQU8sR0FBRyxLQUFLLEtBQUssQ0FBQyxpQkFBaUI7UUFDbEQ7TUFDRixLQUFLO1FBQ0gsWUFBWSxLQUFLLEdBQUcsS0FBSyxLQUFLLENBQUMsaUJBQWlCO1FBQ2hEO01BQ0YsS0FBSztRQUNILFlBQVksSUFBSSxHQUFHLEtBQUssS0FBSyxDQUFDLGlCQUFpQjtRQUMvQztNQUNGLEtBQUs7UUFDSCxZQUFZLEtBQUssR0FBRyxLQUFLLEtBQUssQ0FBQyxpQkFBaUI7UUFDaEQ7TUFDRixLQUFLO1FBQ0gsWUFBWSxNQUFNLEdBQUcsMEJBQTBCLFFBQVE7UUFDdkQ7TUFDRixLQUFLO1FBQ0gsWUFBWSxRQUFRLEdBQUcsS0FBSyxLQUFLLENBQy9CLEFBQUMsT0FBTyxZQUFZLE1BQU0sS0FBSyxlQUM3QixZQUFZLE1BQU0sR0FBRyxLQUNyQiwwQkFBMEIsUUFBUSxXQUFXO1FBRWpEO01BQ0YsS0FBSztRQUNILFlBQVksS0FBSyxHQUFHLEtBQUssS0FBSyxDQUM1QixBQUFDLE9BQU8sWUFBWSxNQUFNLEtBQUssZUFDN0IsWUFBWSxNQUFNLEdBQUcsTUFDckIsMEJBQTBCLFFBQVEsV0FBVztRQUVqRDtJQUNKO0VBQ0Y7RUFFQSxPQUFPO0FBQ1Q7QUFFQSxTQUFTLDBCQUEwQixNQUFjLEVBQUUsT0FBZTtFQUNoRSxNQUFNLGFBQWEsSUFBSSxLQUFLO0VBQzVCLE1BQU0sY0FBYyxJQUFJLEtBQUs7RUFDN0IsTUFBTSxZQUFZLFdBQVcsV0FBVyxLQUFLLFlBQVksV0FBVztFQUNwRSxNQUFNLGFBQWEsV0FBVyxRQUFRLEtBQUssWUFBWSxRQUFRO0VBQy9ELE1BQU0sc0JBQXNCLEtBQUssR0FBRyxDQUFDLFlBQVksS0FBSztFQUN0RCxNQUFNLGdCQUFnQixhQUFhLGNBQWMsSUFBSSxDQUFDO0VBQ3RELFdBQVcsUUFBUSxDQUNqQixXQUFXLFFBQVEsS0FBSyxnQkFBZ0I7RUFFMUMsTUFBTSxxQkFBcUIsYUFBYSxjQUNwQyxJQUNBLENBQUMsTUFBTSxDQUFDLGdCQUNSLElBQ0E7RUFDSixNQUFNLFNBQVMsZ0JBQWdCLENBQUMsc0JBQXNCLGtCQUFrQjtFQUN4RSxPQUFPLFdBQVcsSUFBSSxJQUFJO0FBQzVCIn0=