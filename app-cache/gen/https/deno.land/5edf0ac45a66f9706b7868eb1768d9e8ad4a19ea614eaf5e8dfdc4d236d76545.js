import { PoolClient } from "./client.ts";
import { createParams } from "./connection/connection_params.ts";
import { DeferredAccessStack } from "./utils/deferred.ts";
/**
 * Connection pools are a powerful resource to execute parallel queries and
 * save up time in connection initialization. It is highly recommended that all
 * applications that require concurrent access use a pool to communicate
 * with their PostgreSQL database
 *
 * ```ts
 * import { Pool } from "./pool.ts";
 *
 * const pool = new Pool({
 *   database: "database",
 *   hostname: "hostname",
 *   password: "password",
 *   port: 5432,
 *   user: "user",
 * }, 10); // Creates a pool with 10 available connections
 *
 * const client = await pool.connect();
 * await client.queryArray`SELECT 1`;
 * client.release();
 * ```
 *
 * You can also opt to not initialize all your connections at once by passing the `lazy`
 * option when instantiating your pool, this is useful to reduce startup time. In
 * addition to this, the pool won't start the connection unless there isn't any already
 * available connections in the pool
 *
 * ```ts
 * import { Pool } from "./pool.ts";
 *
 * // Creates a pool with 10 max available connections
 * // Connection with the database won't be established until the user requires it
 * const pool = new Pool({}, 10, true);
 *
 * // Connection is created here, will be available from now on
 * const client_1 = await pool.connect();
 * await client_1.queryArray`SELECT 1`;
 * client_1.release();
 *
 * // Same connection as before, will be reused instead of starting a new one
 * const client_2 = await pool.connect();
 * await client_2.queryArray`SELECT 1`;
 *
 * // New connection, since previous one is still in use
 * // There will be two open connections available from now on
 * const client_3 = await pool.connect();
 * client_2.release();
 * client_3.release();
 * ```
 */ export class Pool {
  #available_connections;
  #connection_params;
  #ended = false;
  #lazy;
  // TODO
  // Initialization should probably have a timeout
  #ready;
  #size;
  /**
   * The number of open connections available for use
   *
   * Lazily initialized pools won't have any open connections by default
   */ get available() {
    if (!this.#available_connections) {
      return 0;
    }
    return this.#available_connections.available;
  }
  /**
   * The number of total connections open in the pool
   *
   * Both available and in use connections will be counted
   */ get size() {
    if (!this.#available_connections) {
      return 0;
    }
    return this.#available_connections.size;
  }
  constructor(connection_params, size, lazy = false){
    this.#connection_params = createParams(connection_params);
    this.#lazy = lazy;
    this.#size = size;
    // This must ALWAYS be called the last
    this.#ready = this.#initialize();
  }
  // TODO
  // Rename to getClient or similar
  // The connect method should initialize the connections instead of doing it
  // in the constructor
  /**
   * This will return a new client from the available connections in
   * the pool
   *
   * In the case of lazy initialized pools, a new connection will be established
   * with the database if no other connections are available
   *
   * ```ts
   * import { Pool } from "./pool.ts";
   *
   * const pool = new Pool({}, 10);
   * const client = await pool.connect();
   * await client.queryArray`UPDATE MY_TABLE SET X = 1`;
   * client.release();
   * ```
   */ async connect() {
    // Reinitialize pool if it has been terminated
    if (this.#ended) {
      this.#ready = this.#initialize();
    }
    await this.#ready;
    return this.#available_connections.pop();
  }
  /**
   * This will close all open connections and set a terminated status in the pool
   *
   * ```ts
   * import { Pool } from "./pool.ts";
   *
   * const pool = new Pool({}, 10);
   *
   * await pool.end();
   * console.assert(pool.available === 0, "There are connections available after ending the pool");
   * await pool.end(); // An exception will be thrown, pool doesn't have any connections to close
   * ```
   *
   * However, a terminated pool can be reused by using the "connect" method, which
   * will reinitialize the connections according to the original configuration of the pool
   *
   * ```ts
   * import { Pool } from "./pool.ts";
   *
   * const pool = new Pool({}, 10);
   * await pool.end();
   * const client = await pool.connect();
   * await client.queryArray`SELECT 1`; // Works!
   * client.release();
   * ```
   */ async end() {
    if (this.#ended) {
      throw new Error("Pool connections have already been terminated");
    }
    await this.#ready;
    while(this.available > 0){
      const client = await this.#available_connections.pop();
      await client.end();
    }
    this.#available_connections = undefined;
    this.#ended = true;
  }
  /**
   * Initialization will create all pool clients instances by default
   *
   * If the pool is lazily initialized, the clients will connect when they
   * are requested by the user, otherwise they will all connect on initialization
   */ async #initialize() {
    const initialized = this.#lazy ? 0 : this.#size;
    const clients = Array.from({
      length: this.#size
    }, async (_e, index)=>{
      const client = new PoolClient(this.#connection_params, ()=>this.#available_connections.push(client));
      if (index < initialized) {
        await client.connect();
      }
      return client;
    });
    this.#available_connections = new DeferredAccessStack(await Promise.all(clients), (client)=>client.connect(), (client)=>client.connected);
    this.#ended = false;
  }
  async initialized() {
    if (!this.#available_connections) {
      return 0;
    }
    return await this.#available_connections.initialized();
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvcG9zdGdyZXNAdjAuMTcuMC9wb29sLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFBvb2xDbGllbnQgfSBmcm9tIFwiLi9jbGllbnQudHNcIjtcbmltcG9ydCB7XG4gIHR5cGUgQ2xpZW50Q29uZmlndXJhdGlvbixcbiAgdHlwZSBDbGllbnRPcHRpb25zLFxuICB0eXBlIENvbm5lY3Rpb25TdHJpbmcsXG4gIGNyZWF0ZVBhcmFtcyxcbn0gZnJvbSBcIi4vY29ubmVjdGlvbi9jb25uZWN0aW9uX3BhcmFtcy50c1wiO1xuaW1wb3J0IHsgRGVmZXJyZWRBY2Nlc3NTdGFjayB9IGZyb20gXCIuL3V0aWxzL2RlZmVycmVkLnRzXCI7XG5cbi8qKlxuICogQ29ubmVjdGlvbiBwb29scyBhcmUgYSBwb3dlcmZ1bCByZXNvdXJjZSB0byBleGVjdXRlIHBhcmFsbGVsIHF1ZXJpZXMgYW5kXG4gKiBzYXZlIHVwIHRpbWUgaW4gY29ubmVjdGlvbiBpbml0aWFsaXphdGlvbi4gSXQgaXMgaGlnaGx5IHJlY29tbWVuZGVkIHRoYXQgYWxsXG4gKiBhcHBsaWNhdGlvbnMgdGhhdCByZXF1aXJlIGNvbmN1cnJlbnQgYWNjZXNzIHVzZSBhIHBvb2wgdG8gY29tbXVuaWNhdGVcbiAqIHdpdGggdGhlaXIgUG9zdGdyZVNRTCBkYXRhYmFzZVxuICpcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBQb29sIH0gZnJvbSBcIi4vcG9vbC50c1wiO1xuICpcbiAqIGNvbnN0IHBvb2wgPSBuZXcgUG9vbCh7XG4gKiAgIGRhdGFiYXNlOiBcImRhdGFiYXNlXCIsXG4gKiAgIGhvc3RuYW1lOiBcImhvc3RuYW1lXCIsXG4gKiAgIHBhc3N3b3JkOiBcInBhc3N3b3JkXCIsXG4gKiAgIHBvcnQ6IDU0MzIsXG4gKiAgIHVzZXI6IFwidXNlclwiLFxuICogfSwgMTApOyAvLyBDcmVhdGVzIGEgcG9vbCB3aXRoIDEwIGF2YWlsYWJsZSBjb25uZWN0aW9uc1xuICpcbiAqIGNvbnN0IGNsaWVudCA9IGF3YWl0IHBvb2wuY29ubmVjdCgpO1xuICogYXdhaXQgY2xpZW50LnF1ZXJ5QXJyYXlgU0VMRUNUIDFgO1xuICogY2xpZW50LnJlbGVhc2UoKTtcbiAqIGBgYFxuICpcbiAqIFlvdSBjYW4gYWxzbyBvcHQgdG8gbm90IGluaXRpYWxpemUgYWxsIHlvdXIgY29ubmVjdGlvbnMgYXQgb25jZSBieSBwYXNzaW5nIHRoZSBgbGF6eWBcbiAqIG9wdGlvbiB3aGVuIGluc3RhbnRpYXRpbmcgeW91ciBwb29sLCB0aGlzIGlzIHVzZWZ1bCB0byByZWR1Y2Ugc3RhcnR1cCB0aW1lLiBJblxuICogYWRkaXRpb24gdG8gdGhpcywgdGhlIHBvb2wgd29uJ3Qgc3RhcnQgdGhlIGNvbm5lY3Rpb24gdW5sZXNzIHRoZXJlIGlzbid0IGFueSBhbHJlYWR5XG4gKiBhdmFpbGFibGUgY29ubmVjdGlvbnMgaW4gdGhlIHBvb2xcbiAqXG4gKiBgYGB0c1xuICogaW1wb3J0IHsgUG9vbCB9IGZyb20gXCIuL3Bvb2wudHNcIjtcbiAqXG4gKiAvLyBDcmVhdGVzIGEgcG9vbCB3aXRoIDEwIG1heCBhdmFpbGFibGUgY29ubmVjdGlvbnNcbiAqIC8vIENvbm5lY3Rpb24gd2l0aCB0aGUgZGF0YWJhc2Ugd29uJ3QgYmUgZXN0YWJsaXNoZWQgdW50aWwgdGhlIHVzZXIgcmVxdWlyZXMgaXRcbiAqIGNvbnN0IHBvb2wgPSBuZXcgUG9vbCh7fSwgMTAsIHRydWUpO1xuICpcbiAqIC8vIENvbm5lY3Rpb24gaXMgY3JlYXRlZCBoZXJlLCB3aWxsIGJlIGF2YWlsYWJsZSBmcm9tIG5vdyBvblxuICogY29uc3QgY2xpZW50XzEgPSBhd2FpdCBwb29sLmNvbm5lY3QoKTtcbiAqIGF3YWl0IGNsaWVudF8xLnF1ZXJ5QXJyYXlgU0VMRUNUIDFgO1xuICogY2xpZW50XzEucmVsZWFzZSgpO1xuICpcbiAqIC8vIFNhbWUgY29ubmVjdGlvbiBhcyBiZWZvcmUsIHdpbGwgYmUgcmV1c2VkIGluc3RlYWQgb2Ygc3RhcnRpbmcgYSBuZXcgb25lXG4gKiBjb25zdCBjbGllbnRfMiA9IGF3YWl0IHBvb2wuY29ubmVjdCgpO1xuICogYXdhaXQgY2xpZW50XzIucXVlcnlBcnJheWBTRUxFQ1QgMWA7XG4gKlxuICogLy8gTmV3IGNvbm5lY3Rpb24sIHNpbmNlIHByZXZpb3VzIG9uZSBpcyBzdGlsbCBpbiB1c2VcbiAqIC8vIFRoZXJlIHdpbGwgYmUgdHdvIG9wZW4gY29ubmVjdGlvbnMgYXZhaWxhYmxlIGZyb20gbm93IG9uXG4gKiBjb25zdCBjbGllbnRfMyA9IGF3YWl0IHBvb2wuY29ubmVjdCgpO1xuICogY2xpZW50XzIucmVsZWFzZSgpO1xuICogY2xpZW50XzMucmVsZWFzZSgpO1xuICogYGBgXG4gKi9cbmV4cG9ydCBjbGFzcyBQb29sIHtcbiAgI2F2YWlsYWJsZV9jb25uZWN0aW9ucz86IERlZmVycmVkQWNjZXNzU3RhY2s8UG9vbENsaWVudD47XG4gICNjb25uZWN0aW9uX3BhcmFtczogQ2xpZW50Q29uZmlndXJhdGlvbjtcbiAgI2VuZGVkID0gZmFsc2U7XG4gICNsYXp5OiBib29sZWFuO1xuICAvLyBUT0RPXG4gIC8vIEluaXRpYWxpemF0aW9uIHNob3VsZCBwcm9iYWJseSBoYXZlIGEgdGltZW91dFxuICAjcmVhZHk6IFByb21pc2U8dm9pZD47XG4gICNzaXplOiBudW1iZXI7XG5cbiAgLyoqXG4gICAqIFRoZSBudW1iZXIgb2Ygb3BlbiBjb25uZWN0aW9ucyBhdmFpbGFibGUgZm9yIHVzZVxuICAgKlxuICAgKiBMYXppbHkgaW5pdGlhbGl6ZWQgcG9vbHMgd29uJ3QgaGF2ZSBhbnkgb3BlbiBjb25uZWN0aW9ucyBieSBkZWZhdWx0XG4gICAqL1xuICBnZXQgYXZhaWxhYmxlKCk6IG51bWJlciB7XG4gICAgaWYgKCF0aGlzLiNhdmFpbGFibGVfY29ubmVjdGlvbnMpIHtcbiAgICAgIHJldHVybiAwO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy4jYXZhaWxhYmxlX2Nvbm5lY3Rpb25zLmF2YWlsYWJsZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUaGUgbnVtYmVyIG9mIHRvdGFsIGNvbm5lY3Rpb25zIG9wZW4gaW4gdGhlIHBvb2xcbiAgICpcbiAgICogQm90aCBhdmFpbGFibGUgYW5kIGluIHVzZSBjb25uZWN0aW9ucyB3aWxsIGJlIGNvdW50ZWRcbiAgICovXG4gIGdldCBzaXplKCk6IG51bWJlciB7XG4gICAgaWYgKCF0aGlzLiNhdmFpbGFibGVfY29ubmVjdGlvbnMpIHtcbiAgICAgIHJldHVybiAwO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy4jYXZhaWxhYmxlX2Nvbm5lY3Rpb25zLnNpemU7XG4gIH1cblxuICBjb25zdHJ1Y3RvcihcbiAgICBjb25uZWN0aW9uX3BhcmFtczogQ2xpZW50T3B0aW9ucyB8IENvbm5lY3Rpb25TdHJpbmcgfCB1bmRlZmluZWQsXG4gICAgc2l6ZTogbnVtYmVyLFxuICAgIGxhenk6IGJvb2xlYW4gPSBmYWxzZSxcbiAgKSB7XG4gICAgdGhpcy4jY29ubmVjdGlvbl9wYXJhbXMgPSBjcmVhdGVQYXJhbXMoY29ubmVjdGlvbl9wYXJhbXMpO1xuICAgIHRoaXMuI2xhenkgPSBsYXp5O1xuICAgIHRoaXMuI3NpemUgPSBzaXplO1xuXG4gICAgLy8gVGhpcyBtdXN0IEFMV0FZUyBiZSBjYWxsZWQgdGhlIGxhc3RcbiAgICB0aGlzLiNyZWFkeSA9IHRoaXMuI2luaXRpYWxpemUoKTtcbiAgfVxuXG4gIC8vIFRPRE9cbiAgLy8gUmVuYW1lIHRvIGdldENsaWVudCBvciBzaW1pbGFyXG4gIC8vIFRoZSBjb25uZWN0IG1ldGhvZCBzaG91bGQgaW5pdGlhbGl6ZSB0aGUgY29ubmVjdGlvbnMgaW5zdGVhZCBvZiBkb2luZyBpdFxuICAvLyBpbiB0aGUgY29uc3RydWN0b3JcbiAgLyoqXG4gICAqIFRoaXMgd2lsbCByZXR1cm4gYSBuZXcgY2xpZW50IGZyb20gdGhlIGF2YWlsYWJsZSBjb25uZWN0aW9ucyBpblxuICAgKiB0aGUgcG9vbFxuICAgKlxuICAgKiBJbiB0aGUgY2FzZSBvZiBsYXp5IGluaXRpYWxpemVkIHBvb2xzLCBhIG5ldyBjb25uZWN0aW9uIHdpbGwgYmUgZXN0YWJsaXNoZWRcbiAgICogd2l0aCB0aGUgZGF0YWJhc2UgaWYgbm8gb3RoZXIgY29ubmVjdGlvbnMgYXJlIGF2YWlsYWJsZVxuICAgKlxuICAgKiBgYGB0c1xuICAgKiBpbXBvcnQgeyBQb29sIH0gZnJvbSBcIi4vcG9vbC50c1wiO1xuICAgKlxuICAgKiBjb25zdCBwb29sID0gbmV3IFBvb2woe30sIDEwKTtcbiAgICogY29uc3QgY2xpZW50ID0gYXdhaXQgcG9vbC5jb25uZWN0KCk7XG4gICAqIGF3YWl0IGNsaWVudC5xdWVyeUFycmF5YFVQREFURSBNWV9UQUJMRSBTRVQgWCA9IDFgO1xuICAgKiBjbGllbnQucmVsZWFzZSgpO1xuICAgKiBgYGBcbiAgICovXG4gIGFzeW5jIGNvbm5lY3QoKTogUHJvbWlzZTxQb29sQ2xpZW50PiB7XG4gICAgLy8gUmVpbml0aWFsaXplIHBvb2wgaWYgaXQgaGFzIGJlZW4gdGVybWluYXRlZFxuICAgIGlmICh0aGlzLiNlbmRlZCkge1xuICAgICAgdGhpcy4jcmVhZHkgPSB0aGlzLiNpbml0aWFsaXplKCk7XG4gICAgfVxuXG4gICAgYXdhaXQgdGhpcy4jcmVhZHk7XG4gICAgcmV0dXJuIHRoaXMuI2F2YWlsYWJsZV9jb25uZWN0aW9ucyEucG9wKCk7XG4gIH1cblxuICAvKipcbiAgICogVGhpcyB3aWxsIGNsb3NlIGFsbCBvcGVuIGNvbm5lY3Rpb25zIGFuZCBzZXQgYSB0ZXJtaW5hdGVkIHN0YXR1cyBpbiB0aGUgcG9vbFxuICAgKlxuICAgKiBgYGB0c1xuICAgKiBpbXBvcnQgeyBQb29sIH0gZnJvbSBcIi4vcG9vbC50c1wiO1xuICAgKlxuICAgKiBjb25zdCBwb29sID0gbmV3IFBvb2woe30sIDEwKTtcbiAgICpcbiAgICogYXdhaXQgcG9vbC5lbmQoKTtcbiAgICogY29uc29sZS5hc3NlcnQocG9vbC5hdmFpbGFibGUgPT09IDAsIFwiVGhlcmUgYXJlIGNvbm5lY3Rpb25zIGF2YWlsYWJsZSBhZnRlciBlbmRpbmcgdGhlIHBvb2xcIik7XG4gICAqIGF3YWl0IHBvb2wuZW5kKCk7IC8vIEFuIGV4Y2VwdGlvbiB3aWxsIGJlIHRocm93biwgcG9vbCBkb2Vzbid0IGhhdmUgYW55IGNvbm5lY3Rpb25zIHRvIGNsb3NlXG4gICAqIGBgYFxuICAgKlxuICAgKiBIb3dldmVyLCBhIHRlcm1pbmF0ZWQgcG9vbCBjYW4gYmUgcmV1c2VkIGJ5IHVzaW5nIHRoZSBcImNvbm5lY3RcIiBtZXRob2QsIHdoaWNoXG4gICAqIHdpbGwgcmVpbml0aWFsaXplIHRoZSBjb25uZWN0aW9ucyBhY2NvcmRpbmcgdG8gdGhlIG9yaWdpbmFsIGNvbmZpZ3VyYXRpb24gb2YgdGhlIHBvb2xcbiAgICpcbiAgICogYGBgdHNcbiAgICogaW1wb3J0IHsgUG9vbCB9IGZyb20gXCIuL3Bvb2wudHNcIjtcbiAgICpcbiAgICogY29uc3QgcG9vbCA9IG5ldyBQb29sKHt9LCAxMCk7XG4gICAqIGF3YWl0IHBvb2wuZW5kKCk7XG4gICAqIGNvbnN0IGNsaWVudCA9IGF3YWl0IHBvb2wuY29ubmVjdCgpO1xuICAgKiBhd2FpdCBjbGllbnQucXVlcnlBcnJheWBTRUxFQ1QgMWA7IC8vIFdvcmtzIVxuICAgKiBjbGllbnQucmVsZWFzZSgpO1xuICAgKiBgYGBcbiAgICovXG4gIGFzeW5jIGVuZCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAodGhpcy4jZW5kZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIlBvb2wgY29ubmVjdGlvbnMgaGF2ZSBhbHJlYWR5IGJlZW4gdGVybWluYXRlZFwiKTtcbiAgICB9XG5cbiAgICBhd2FpdCB0aGlzLiNyZWFkeTtcbiAgICB3aGlsZSAodGhpcy5hdmFpbGFibGUgPiAwKSB7XG4gICAgICBjb25zdCBjbGllbnQgPSBhd2FpdCB0aGlzLiNhdmFpbGFibGVfY29ubmVjdGlvbnMhLnBvcCgpO1xuICAgICAgYXdhaXQgY2xpZW50LmVuZCgpO1xuICAgIH1cblxuICAgIHRoaXMuI2F2YWlsYWJsZV9jb25uZWN0aW9ucyA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLiNlbmRlZCA9IHRydWU7XG4gIH1cblxuICAvKipcbiAgICogSW5pdGlhbGl6YXRpb24gd2lsbCBjcmVhdGUgYWxsIHBvb2wgY2xpZW50cyBpbnN0YW5jZXMgYnkgZGVmYXVsdFxuICAgKlxuICAgKiBJZiB0aGUgcG9vbCBpcyBsYXppbHkgaW5pdGlhbGl6ZWQsIHRoZSBjbGllbnRzIHdpbGwgY29ubmVjdCB3aGVuIHRoZXlcbiAgICogYXJlIHJlcXVlc3RlZCBieSB0aGUgdXNlciwgb3RoZXJ3aXNlIHRoZXkgd2lsbCBhbGwgY29ubmVjdCBvbiBpbml0aWFsaXphdGlvblxuICAgKi9cbiAgYXN5bmMgI2luaXRpYWxpemUoKSB7XG4gICAgY29uc3QgaW5pdGlhbGl6ZWQgPSB0aGlzLiNsYXp5ID8gMCA6IHRoaXMuI3NpemU7XG4gICAgY29uc3QgY2xpZW50cyA9IEFycmF5LmZyb20oXG4gICAgICB7IGxlbmd0aDogdGhpcy4jc2l6ZSB9LFxuICAgICAgYXN5bmMgKF9lLCBpbmRleCkgPT4ge1xuICAgICAgICBjb25zdCBjbGllbnQ6IFBvb2xDbGllbnQgPSBuZXcgUG9vbENsaWVudChcbiAgICAgICAgICB0aGlzLiNjb25uZWN0aW9uX3BhcmFtcyxcbiAgICAgICAgICAoKSA9PiB0aGlzLiNhdmFpbGFibGVfY29ubmVjdGlvbnMhLnB1c2goY2xpZW50KSxcbiAgICAgICAgKTtcblxuICAgICAgICBpZiAoaW5kZXggPCBpbml0aWFsaXplZCkge1xuICAgICAgICAgIGF3YWl0IGNsaWVudC5jb25uZWN0KCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY2xpZW50O1xuICAgICAgfSxcbiAgICApO1xuXG4gICAgdGhpcy4jYXZhaWxhYmxlX2Nvbm5lY3Rpb25zID0gbmV3IERlZmVycmVkQWNjZXNzU3RhY2soXG4gICAgICBhd2FpdCBQcm9taXNlLmFsbChjbGllbnRzKSxcbiAgICAgIChjbGllbnQpID0+IGNsaWVudC5jb25uZWN0KCksXG4gICAgICAoY2xpZW50KSA9PiBjbGllbnQuY29ubmVjdGVkLFxuICAgICk7XG5cbiAgICB0aGlzLiNlbmRlZCA9IGZhbHNlO1xuICB9IC8qKlxuICAgKiBUaGlzIHdpbGwgcmV0dXJuIHRoZSBudW1iZXIgb2YgaW5pdGlhbGl6ZWQgY2xpZW50cyBpbiB0aGUgcG9vbFxuICAgKi9cblxuICBhc3luYyBpbml0aWFsaXplZCgpOiBQcm9taXNlPG51bWJlcj4ge1xuICAgIGlmICghdGhpcy4jYXZhaWxhYmxlX2Nvbm5lY3Rpb25zKSB7XG4gICAgICByZXR1cm4gMDtcbiAgICB9XG5cbiAgICByZXR1cm4gYXdhaXQgdGhpcy4jYXZhaWxhYmxlX2Nvbm5lY3Rpb25zLmluaXRpYWxpemVkKCk7XG4gIH1cbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLFVBQVUsUUFBUSxjQUFjO0FBQ3pDLFNBSUUsWUFBWSxRQUNQLG9DQUFvQztBQUMzQyxTQUFTLG1CQUFtQixRQUFRLHNCQUFzQjtBQUUxRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQWlEQyxHQUNELE9BQU8sTUFBTTtFQUNYLENBQUMscUJBQXFCLENBQW1DO0VBQ3pELENBQUMsaUJBQWlCLENBQXNCO0VBQ3hDLENBQUMsS0FBSyxHQUFHLE1BQU07RUFDZixDQUFDLElBQUksQ0FBVTtFQUNmLE9BQU87RUFDUCxnREFBZ0Q7RUFDaEQsQ0FBQyxLQUFLLENBQWdCO0VBQ3RCLENBQUMsSUFBSSxDQUFTO0VBRWQ7Ozs7R0FJQyxHQUNELElBQUksWUFBb0I7SUFDdEIsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLHFCQUFxQixFQUFFO01BQ2hDLE9BQU87SUFDVDtJQUNBLE9BQU8sSUFBSSxDQUFDLENBQUMscUJBQXFCLENBQUMsU0FBUztFQUM5QztFQUVBOzs7O0dBSUMsR0FDRCxJQUFJLE9BQWU7SUFDakIsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLHFCQUFxQixFQUFFO01BQ2hDLE9BQU87SUFDVDtJQUNBLE9BQU8sSUFBSSxDQUFDLENBQUMscUJBQXFCLENBQUMsSUFBSTtFQUN6QztFQUVBLFlBQ0UsaUJBQStELEVBQy9ELElBQVksRUFDWixPQUFnQixLQUFLLENBQ3JCO0lBQ0EsSUFBSSxDQUFDLENBQUMsaUJBQWlCLEdBQUcsYUFBYTtJQUN2QyxJQUFJLENBQUMsQ0FBQyxJQUFJLEdBQUc7SUFDYixJQUFJLENBQUMsQ0FBQyxJQUFJLEdBQUc7SUFFYixzQ0FBc0M7SUFDdEMsSUFBSSxDQUFDLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxDQUFDLFVBQVU7RUFDaEM7RUFFQSxPQUFPO0VBQ1AsaUNBQWlDO0VBQ2pDLDJFQUEyRTtFQUMzRSxxQkFBcUI7RUFDckI7Ozs7Ozs7Ozs7Ozs7OztHQWVDLEdBQ0QsTUFBTSxVQUErQjtJQUNuQyw4Q0FBOEM7SUFDOUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxLQUFLLEVBQUU7TUFDZixJQUFJLENBQUMsQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLENBQUMsVUFBVTtJQUNoQztJQUVBLE1BQU0sSUFBSSxDQUFDLENBQUMsS0FBSztJQUNqQixPQUFPLElBQUksQ0FBQyxDQUFDLHFCQUFxQixDQUFFLEdBQUc7RUFDekM7RUFFQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQXlCQyxHQUNELE1BQU0sTUFBcUI7SUFDekIsSUFBSSxJQUFJLENBQUMsQ0FBQyxLQUFLLEVBQUU7TUFDZixNQUFNLElBQUksTUFBTTtJQUNsQjtJQUVBLE1BQU0sSUFBSSxDQUFDLENBQUMsS0FBSztJQUNqQixNQUFPLElBQUksQ0FBQyxTQUFTLEdBQUcsRUFBRztNQUN6QixNQUFNLFNBQVMsTUFBTSxJQUFJLENBQUMsQ0FBQyxxQkFBcUIsQ0FBRSxHQUFHO01BQ3JELE1BQU0sT0FBTyxHQUFHO0lBQ2xCO0lBRUEsSUFBSSxDQUFDLENBQUMscUJBQXFCLEdBQUc7SUFDOUIsSUFBSSxDQUFDLENBQUMsS0FBSyxHQUFHO0VBQ2hCO0VBRUE7Ozs7O0dBS0MsR0FDRCxNQUFNLENBQUMsVUFBVTtJQUNmLE1BQU0sY0FBYyxJQUFJLENBQUMsQ0FBQyxJQUFJLEdBQUcsSUFBSSxJQUFJLENBQUMsQ0FBQyxJQUFJO0lBQy9DLE1BQU0sVUFBVSxNQUFNLElBQUksQ0FDeEI7TUFBRSxRQUFRLElBQUksQ0FBQyxDQUFDLElBQUk7SUFBQyxHQUNyQixPQUFPLElBQUk7TUFDVCxNQUFNLFNBQXFCLElBQUksV0FDN0IsSUFBSSxDQUFDLENBQUMsaUJBQWlCLEVBQ3ZCLElBQU0sSUFBSSxDQUFDLENBQUMscUJBQXFCLENBQUUsSUFBSSxDQUFDO01BRzFDLElBQUksUUFBUSxhQUFhO1FBQ3ZCLE1BQU0sT0FBTyxPQUFPO01BQ3RCO01BRUEsT0FBTztJQUNUO0lBR0YsSUFBSSxDQUFDLENBQUMscUJBQXFCLEdBQUcsSUFBSSxvQkFDaEMsTUFBTSxRQUFRLEdBQUcsQ0FBQyxVQUNsQixDQUFDLFNBQVcsT0FBTyxPQUFPLElBQzFCLENBQUMsU0FBVyxPQUFPLFNBQVM7SUFHOUIsSUFBSSxDQUFDLENBQUMsS0FBSyxHQUFHO0VBQ2hCO0VBSUEsTUFBTSxjQUErQjtJQUNuQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMscUJBQXFCLEVBQUU7TUFDaEMsT0FBTztJQUNUO0lBRUEsT0FBTyxNQUFNLElBQUksQ0FBQyxDQUFDLHFCQUFxQixDQUFDLFdBQVc7RUFDdEQ7QUFDRiJ9