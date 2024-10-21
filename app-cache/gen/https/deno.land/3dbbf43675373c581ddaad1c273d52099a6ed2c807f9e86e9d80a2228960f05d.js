import { bold, yellow } from "../deps.ts";
export function readInt16BE(buffer, offset) {
  offset = offset >>> 0;
  const val = buffer[offset + 1] | buffer[offset] << 8;
  return val & 0x8000 ? val | 0xffff0000 : val;
}
export function readUInt16BE(buffer, offset) {
  offset = offset >>> 0;
  return buffer[offset] | buffer[offset + 1] << 8;
}
export function readInt32BE(buffer, offset) {
  offset = offset >>> 0;
  return buffer[offset] << 24 | buffer[offset + 1] << 16 | buffer[offset + 2] << 8 | buffer[offset + 3];
}
export function readUInt32BE(buffer, offset) {
  offset = offset >>> 0;
  return buffer[offset] * 0x1000000 + (buffer[offset + 1] << 16 | buffer[offset + 2] << 8 | buffer[offset + 3]);
}
/**
 * This function parses valid connection strings according to https://www.postgresql.org/docs/14/libpq-connect.html#LIBPQ-CONNSTRING
 *
 * The only exception to this rule are multi-host connection strings
 */ export function parseConnectionUri(uri) {
  const parsed_uri = uri.match(/(?<driver>\w+):\/{2}((?<user>[^\/?#\s:]+?)?(:(?<password>[^\/?#\s]+)?)?@)?(?<full_host>[^\/?#\s]+)?(\/(?<path>[^?#\s]*))?(\?(?<params>[^#\s]+))?.*/);
  if (!parsed_uri) throw new Error("Could not parse the provided URL");
  let { driver = "", full_host = "", params = "", password = "", path = "", user = "" } = parsed_uri.groups ?? {};
  const parsed_host = full_host.match(/(?<host>(\[.+\])|(.*?))(:(?<port>[\w]*))?$/);
  if (!parsed_host) throw new Error(`Could not parse "${full_host}" host`);
  let { host = "", port = "" } = parsed_host.groups ?? {};
  try {
    if (host) {
      host = decodeURIComponent(host);
    }
  } catch (_e) {
    console.error(bold(yellow("Failed to decode URL host") + "\nDefaulting to raw host"));
  }
  if (port && Number.isNaN(Number(port))) {
    throw new Error(`The provided port "${port}" is not a valid number`);
  }
  try {
    if (password) {
      password = decodeURIComponent(password);
    }
  } catch (_e) {
    console.error(bold(yellow("Failed to decode URL password") + "\nDefaulting to raw password"));
  }
  return {
    driver,
    host,
    params: Object.fromEntries(new URLSearchParams(params).entries()),
    password,
    path,
    port,
    user
  };
}
export function isTemplateString(template) {
  if (!Array.isArray(template)) {
    return false;
  }
  return true;
}
/**
 * https://www.postgresql.org/docs/14/runtime-config-connection.html#RUNTIME-CONFIG-CONNECTION-SETTINGS
 * unix_socket_directories
 */ export const getSocketName = (port)=>`.s.PGSQL.${port}`;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvcG9zdGdyZXNAdjAuMTcuMC91dGlscy91dGlscy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBib2xkLCB5ZWxsb3cgfSBmcm9tIFwiLi4vZGVwcy50c1wiO1xuXG5leHBvcnQgZnVuY3Rpb24gcmVhZEludDE2QkUoYnVmZmVyOiBVaW50OEFycmF5LCBvZmZzZXQ6IG51bWJlcik6IG51bWJlciB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMDtcbiAgY29uc3QgdmFsID0gYnVmZmVyW29mZnNldCArIDFdIHwgKGJ1ZmZlcltvZmZzZXRdIDw8IDgpO1xuICByZXR1cm4gdmFsICYgMHg4MDAwID8gdmFsIHwgMHhmZmZmMDAwMCA6IHZhbDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRVSW50MTZCRShidWZmZXI6IFVpbnQ4QXJyYXksIG9mZnNldDogbnVtYmVyKTogbnVtYmVyIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwO1xuICByZXR1cm4gYnVmZmVyW29mZnNldF0gfCAoYnVmZmVyW29mZnNldCArIDFdIDw8IDgpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVhZEludDMyQkUoYnVmZmVyOiBVaW50OEFycmF5LCBvZmZzZXQ6IG51bWJlcik6IG51bWJlciB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMDtcblxuICByZXR1cm4gKFxuICAgIChidWZmZXJbb2Zmc2V0XSA8PCAyNCkgfFxuICAgIChidWZmZXJbb2Zmc2V0ICsgMV0gPDwgMTYpIHxcbiAgICAoYnVmZmVyW29mZnNldCArIDJdIDw8IDgpIHxcbiAgICBidWZmZXJbb2Zmc2V0ICsgM11cbiAgKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRVSW50MzJCRShidWZmZXI6IFVpbnQ4QXJyYXksIG9mZnNldDogbnVtYmVyKTogbnVtYmVyIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwO1xuXG4gIHJldHVybiAoXG4gICAgYnVmZmVyW29mZnNldF0gKiAweDEwMDAwMDAgK1xuICAgICgoYnVmZmVyW29mZnNldCArIDFdIDw8IDE2KSB8XG4gICAgICAoYnVmZmVyW29mZnNldCArIDJdIDw8IDgpIHxcbiAgICAgIGJ1ZmZlcltvZmZzZXQgKyAzXSlcbiAgKTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBVcmkge1xuICBkcml2ZXI6IHN0cmluZztcbiAgaG9zdDogc3RyaW5nO1xuICBwYXNzd29yZDogc3RyaW5nO1xuICBwYXRoOiBzdHJpbmc7XG4gIHBhcmFtczogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcbiAgcG9ydDogc3RyaW5nO1xuICB1c2VyOiBzdHJpbmc7XG59XG5cbi8qKlxuICogVGhpcyBmdW5jdGlvbiBwYXJzZXMgdmFsaWQgY29ubmVjdGlvbiBzdHJpbmdzIGFjY29yZGluZyB0byBodHRwczovL3d3dy5wb3N0Z3Jlc3FsLm9yZy9kb2NzLzE0L2xpYnBxLWNvbm5lY3QuaHRtbCNMSUJQUS1DT05OU1RSSU5HXG4gKlxuICogVGhlIG9ubHkgZXhjZXB0aW9uIHRvIHRoaXMgcnVsZSBhcmUgbXVsdGktaG9zdCBjb25uZWN0aW9uIHN0cmluZ3NcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlQ29ubmVjdGlvblVyaSh1cmk6IHN0cmluZyk6IFVyaSB7XG4gIGNvbnN0IHBhcnNlZF91cmkgPSB1cmkubWF0Y2goXG4gICAgLyg/PGRyaXZlcj5cXHcrKTpcXC97Mn0oKD88dXNlcj5bXlxcLz8jXFxzOl0rPyk/KDooPzxwYXNzd29yZD5bXlxcLz8jXFxzXSspPyk/QCk/KD88ZnVsbF9ob3N0PlteXFwvPyNcXHNdKyk/KFxcLyg/PHBhdGg+W14/I1xcc10qKSk/KFxcPyg/PHBhcmFtcz5bXiNcXHNdKykpPy4qLyxcbiAgKTtcbiAgaWYgKCFwYXJzZWRfdXJpKSB0aHJvdyBuZXcgRXJyb3IoXCJDb3VsZCBub3QgcGFyc2UgdGhlIHByb3ZpZGVkIFVSTFwiKTtcbiAgbGV0IHtcbiAgICBkcml2ZXIgPSBcIlwiLFxuICAgIGZ1bGxfaG9zdCA9IFwiXCIsXG4gICAgcGFyYW1zID0gXCJcIixcbiAgICBwYXNzd29yZCA9IFwiXCIsXG4gICAgcGF0aCA9IFwiXCIsXG4gICAgdXNlciA9IFwiXCIsXG4gIH06IHtcbiAgICBkcml2ZXI/OiBzdHJpbmc7XG4gICAgdXNlcj86IHN0cmluZztcbiAgICBwYXNzd29yZD86IHN0cmluZztcbiAgICBmdWxsX2hvc3Q/OiBzdHJpbmc7XG4gICAgcGF0aD86IHN0cmluZztcbiAgICBwYXJhbXM/OiBzdHJpbmc7XG4gIH0gPSBwYXJzZWRfdXJpLmdyb3VwcyA/PyB7fTtcblxuICBjb25zdCBwYXJzZWRfaG9zdCA9IGZ1bGxfaG9zdC5tYXRjaChcbiAgICAvKD88aG9zdD4oXFxbLitcXF0pfCguKj8pKSg6KD88cG9ydD5bXFx3XSopKT8kLyxcbiAgKTtcbiAgaWYgKCFwYXJzZWRfaG9zdCkgdGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgcGFyc2UgXCIke2Z1bGxfaG9zdH1cIiBob3N0YCk7XG4gIGxldCB7XG4gICAgaG9zdCA9IFwiXCIsXG4gICAgcG9ydCA9IFwiXCIsXG4gIH06IHtcbiAgICBob3N0Pzogc3RyaW5nO1xuICAgIHBvcnQ/OiBzdHJpbmc7XG4gIH0gPSBwYXJzZWRfaG9zdC5ncm91cHMgPz8ge307XG5cbiAgdHJ5IHtcbiAgICBpZiAoaG9zdCkge1xuICAgICAgaG9zdCA9IGRlY29kZVVSSUNvbXBvbmVudChob3N0KTtcbiAgICB9XG4gIH0gY2F0Y2ggKF9lKSB7XG4gICAgY29uc29sZS5lcnJvcihcbiAgICAgIGJvbGQoXG4gICAgICAgIHllbGxvdyhcIkZhaWxlZCB0byBkZWNvZGUgVVJMIGhvc3RcIikgKyBcIlxcbkRlZmF1bHRpbmcgdG8gcmF3IGhvc3RcIixcbiAgICAgICksXG4gICAgKTtcbiAgfVxuXG4gIGlmIChwb3J0ICYmIE51bWJlci5pc05hTihOdW1iZXIocG9ydCkpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBUaGUgcHJvdmlkZWQgcG9ydCBcIiR7cG9ydH1cIiBpcyBub3QgYSB2YWxpZCBudW1iZXJgKTtcbiAgfVxuXG4gIHRyeSB7XG4gICAgaWYgKHBhc3N3b3JkKSB7XG4gICAgICBwYXNzd29yZCA9IGRlY29kZVVSSUNvbXBvbmVudChwYXNzd29yZCk7XG4gICAgfVxuICB9IGNhdGNoIChfZSkge1xuICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICBib2xkKFxuICAgICAgICB5ZWxsb3coXCJGYWlsZWQgdG8gZGVjb2RlIFVSTCBwYXNzd29yZFwiKSArXG4gICAgICAgICAgXCJcXG5EZWZhdWx0aW5nIHRvIHJhdyBwYXNzd29yZFwiLFxuICAgICAgKSxcbiAgICApO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBkcml2ZXIsXG4gICAgaG9zdCxcbiAgICBwYXJhbXM6IE9iamVjdC5mcm9tRW50cmllcyhuZXcgVVJMU2VhcmNoUGFyYW1zKHBhcmFtcykuZW50cmllcygpKSxcbiAgICBwYXNzd29yZCxcbiAgICBwYXRoLFxuICAgIHBvcnQsXG4gICAgdXNlcixcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzVGVtcGxhdGVTdHJpbmcoXG4gIHRlbXBsYXRlOiB1bmtub3duLFxuKTogdGVtcGxhdGUgaXMgVGVtcGxhdGVTdHJpbmdzQXJyYXkge1xuICBpZiAoIUFycmF5LmlzQXJyYXkodGVtcGxhdGUpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG4vKipcbiAqIGh0dHBzOi8vd3d3LnBvc3RncmVzcWwub3JnL2RvY3MvMTQvcnVudGltZS1jb25maWctY29ubmVjdGlvbi5odG1sI1JVTlRJTUUtQ09ORklHLUNPTk5FQ1RJT04tU0VUVElOR1NcbiAqIHVuaXhfc29ja2V0X2RpcmVjdG9yaWVzXG4gKi9cbmV4cG9ydCBjb25zdCBnZXRTb2NrZXROYW1lID0gKHBvcnQ6IG51bWJlcikgPT4gYC5zLlBHU1FMLiR7cG9ydH1gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsSUFBSSxFQUFFLE1BQU0sUUFBUSxhQUFhO0FBRTFDLE9BQU8sU0FBUyxZQUFZLE1BQWtCLEVBQUUsTUFBYztFQUM1RCxTQUFTLFdBQVc7RUFDcEIsTUFBTSxNQUFNLE1BQU0sQ0FBQyxTQUFTLEVBQUUsR0FBSSxNQUFNLENBQUMsT0FBTyxJQUFJO0VBQ3BELE9BQU8sTUFBTSxTQUFTLE1BQU0sYUFBYTtBQUMzQztBQUVBLE9BQU8sU0FBUyxhQUFhLE1BQWtCLEVBQUUsTUFBYztFQUM3RCxTQUFTLFdBQVc7RUFDcEIsT0FBTyxNQUFNLENBQUMsT0FBTyxHQUFJLE1BQU0sQ0FBQyxTQUFTLEVBQUUsSUFBSTtBQUNqRDtBQUVBLE9BQU8sU0FBUyxZQUFZLE1BQWtCLEVBQUUsTUFBYztFQUM1RCxTQUFTLFdBQVc7RUFFcEIsT0FDRSxBQUFDLE1BQU0sQ0FBQyxPQUFPLElBQUksS0FDbEIsTUFBTSxDQUFDLFNBQVMsRUFBRSxJQUFJLEtBQ3RCLE1BQU0sQ0FBQyxTQUFTLEVBQUUsSUFBSSxJQUN2QixNQUFNLENBQUMsU0FBUyxFQUFFO0FBRXRCO0FBRUEsT0FBTyxTQUFTLGFBQWEsTUFBa0IsRUFBRSxNQUFjO0VBQzdELFNBQVMsV0FBVztFQUVwQixPQUNFLE1BQU0sQ0FBQyxPQUFPLEdBQUcsWUFDakIsQ0FBQyxBQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUUsSUFBSSxLQUNyQixNQUFNLENBQUMsU0FBUyxFQUFFLElBQUksSUFDdkIsTUFBTSxDQUFDLFNBQVMsRUFBRTtBQUV4QjtBQVlBOzs7O0NBSUMsR0FDRCxPQUFPLFNBQVMsbUJBQW1CLEdBQVc7RUFDNUMsTUFBTSxhQUFhLElBQUksS0FBSyxDQUMxQjtFQUVGLElBQUksQ0FBQyxZQUFZLE1BQU0sSUFBSSxNQUFNO0VBQ2pDLElBQUksRUFDRixTQUFTLEVBQUUsRUFDWCxZQUFZLEVBQUUsRUFDZCxTQUFTLEVBQUUsRUFDWCxXQUFXLEVBQUUsRUFDYixPQUFPLEVBQUUsRUFDVCxPQUFPLEVBQUUsRUFDVixHQU9HLFdBQVcsTUFBTSxJQUFJLENBQUM7RUFFMUIsTUFBTSxjQUFjLFVBQVUsS0FBSyxDQUNqQztFQUVGLElBQUksQ0FBQyxhQUFhLE1BQU0sSUFBSSxNQUFNLENBQUMsaUJBQWlCLEVBQUUsVUFBVSxNQUFNLENBQUM7RUFDdkUsSUFBSSxFQUNGLE9BQU8sRUFBRSxFQUNULE9BQU8sRUFBRSxFQUNWLEdBR0csWUFBWSxNQUFNLElBQUksQ0FBQztFQUUzQixJQUFJO0lBQ0YsSUFBSSxNQUFNO01BQ1IsT0FBTyxtQkFBbUI7SUFDNUI7RUFDRixFQUFFLE9BQU8sSUFBSTtJQUNYLFFBQVEsS0FBSyxDQUNYLEtBQ0UsT0FBTywrQkFBK0I7RUFHNUM7RUFFQSxJQUFJLFFBQVEsT0FBTyxLQUFLLENBQUMsT0FBTyxRQUFRO0lBQ3RDLE1BQU0sSUFBSSxNQUFNLENBQUMsbUJBQW1CLEVBQUUsS0FBSyx1QkFBdUIsQ0FBQztFQUNyRTtFQUVBLElBQUk7SUFDRixJQUFJLFVBQVU7TUFDWixXQUFXLG1CQUFtQjtJQUNoQztFQUNGLEVBQUUsT0FBTyxJQUFJO0lBQ1gsUUFBUSxLQUFLLENBQ1gsS0FDRSxPQUFPLG1DQUNMO0VBR1I7RUFFQSxPQUFPO0lBQ0w7SUFDQTtJQUNBLFFBQVEsT0FBTyxXQUFXLENBQUMsSUFBSSxnQkFBZ0IsUUFBUSxPQUFPO0lBQzlEO0lBQ0E7SUFDQTtJQUNBO0VBQ0Y7QUFDRjtBQUVBLE9BQU8sU0FBUyxpQkFDZCxRQUFpQjtFQUVqQixJQUFJLENBQUMsTUFBTSxPQUFPLENBQUMsV0FBVztJQUM1QixPQUFPO0VBQ1Q7RUFDQSxPQUFPO0FBQ1Q7QUFFQTs7O0NBR0MsR0FDRCxPQUFPLE1BQU0sZ0JBQWdCLENBQUMsT0FBaUIsQ0FBQyxTQUFTLEVBQUUsS0FBSyxDQUFDLENBQUMifQ==