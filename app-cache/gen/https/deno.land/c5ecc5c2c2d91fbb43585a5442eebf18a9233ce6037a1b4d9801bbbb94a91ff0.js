import { Query, ResultType, templateStringToQuery } from "./query.ts";
import { isTemplateString } from "../utils/utils.ts";
import { PostgresError, TransactionError } from "../client/error.ts";
export class Savepoint {
  name;
  /**
   * This is the count of the current savepoint instances in the transaction
   */ #instance_count;
  #release_callback;
  #update_callback;
  constructor(name, update_callback, release_callback){
    this.name = name;
    this.#instance_count = 0;
    this.#release_callback = release_callback;
    this.#update_callback = update_callback;
  }
  get instances() {
    return this.#instance_count;
  }
  /**
   * Releasing a savepoint will remove it's last instance in the transaction
   *
   * ```ts
   * import { Client } from "../client.ts";
   *
   * const client = new Client();
   * const transaction = client.createTransaction("transaction");
   *
   * const savepoint = await transaction.savepoint("n1");
   * await savepoint.release();
   * transaction.rollback(savepoint); // Error, can't rollback because the savepoint was released
   * ```
   *
   * It will also allow you to set the savepoint to the position it had before the last update
   *
   * ```ts
   * import { Client } from "../client.ts";
   *
   * const client = new Client();
   * const transaction = client.createTransaction("transaction");
   *
   * const savepoint = await transaction.savepoint("n1");
   * await savepoint.update();
   * await savepoint.release(); // This drops the update of the last statement
   * transaction.rollback(savepoint); // Will rollback to the first instance of the savepoint
   * ```
   *
   * This function will throw if there are no savepoint instances to drop
   */ async release() {
    if (this.#instance_count === 0) {
      throw new Error("This savepoint has no instances to release");
    }
    await this.#release_callback(this.name);
    --this.#instance_count;
  }
  /**
   * Updating a savepoint will update its position in the transaction execution
   *
   * ```ts
   * import { Client } from "../client.ts";
   *
   * const client = new Client();
   * const transaction = client.createTransaction("transaction");
   *
   * const my_value = "some value";
   *
   * const savepoint = await transaction.savepoint("n1");
   * transaction.queryArray`INSERT INTO MY_TABLE (X) VALUES (${my_value})`;
   * await savepoint.update(); // Rolling back will now return you to this point on the transaction
   * ```
   *
   * You can also undo a savepoint update by using the `release` method
   *
   * ```ts
   * import { Client } from "../client.ts";
   *
   * const client = new Client();
   * const transaction = client.createTransaction("transaction");
   *
   * const savepoint = await transaction.savepoint("n1");
   * transaction.queryArray`DELETE FROM VERY_IMPORTANT_TABLE`;
   * await savepoint.update(); // Oops, shouldn't have updated the savepoint
   * await savepoint.release(); // This will undo the last update and return the savepoint to the first instance
   * await transaction.rollback(); // Will rollback before the table was deleted
   * ```
   */ async update() {
    await this.#update_callback(this.name);
    ++this.#instance_count;
  }
}
export class Transaction {
  name;
  #client;
  #executeQuery;
  #isolation_level;
  #read_only;
  #savepoints;
  #snapshot;
  #updateClientLock;
  constructor(name, options, client, execute_query_callback, update_client_lock_callback){
    this.name = name;
    this.#savepoints = [];
    this./** Should not commit the same transaction twice. */ #committed = false;
    this.#client = client;
    this.#executeQuery = execute_query_callback;
    this.#isolation_level = options?.isolation_level ?? "read_committed";
    this.#read_only = options?.read_only ?? false;
    this.#snapshot = options?.snapshot;
    this.#updateClientLock = update_client_lock_callback;
  }
  get isolation_level() {
    return this.#isolation_level;
  }
  get savepoints() {
    return this.#savepoints;
  }
  /**
   * This method will throw if the transaction opened in the client doesn't match this one
   */ #assertTransactionOpen() {
    if (this.#client.session.current_transaction !== this.name) {
      throw new Error(`This transaction has not been started yet, make sure to use the "begin" method to do so`);
    }
  }
  #resetTransaction() {
    this.#savepoints = [];
  }
  /**
   * The begin method will officially begin the transaction, and it must be called before
   * any query or transaction operation is executed in order to lock the session
   * ```ts
   * import { Client } from "../client.ts";
   *
   * const client = new Client();
   * const transaction = client.createTransaction("transaction_name");
   *
   * await transaction.begin(); // Session is locked, transaction operations are now safe
   * // Important operations
   * await transaction.commit(); // Session is unlocked, external operations can now take place
   * ```
   * https://www.postgresql.org/docs/14/sql-begin.html
   */ async begin() {
    if (this.#client.session.current_transaction !== null) {
      if (this.#client.session.current_transaction === this.name) {
        throw new Error("This transaction is already open");
      }
      throw new Error(`This client already has an ongoing transaction "${this.#client.session.current_transaction}"`);
    }
    let isolation_level;
    switch(this.#isolation_level){
      case "read_committed":
        {
          isolation_level = "READ COMMITTED";
          break;
        }
      case "repeatable_read":
        {
          isolation_level = "REPEATABLE READ";
          break;
        }
      case "serializable":
        {
          isolation_level = "SERIALIZABLE";
          break;
        }
      default:
        throw new Error(`Unexpected isolation level "${this.#isolation_level}"`);
    }
    let permissions;
    if (this.#read_only) {
      permissions = "READ ONLY";
    } else {
      permissions = "READ WRITE";
    }
    let snapshot = "";
    if (this.#snapshot) {
      snapshot = `SET TRANSACTION SNAPSHOT '${this.#snapshot}'`;
    }
    try {
      await this.#client.queryArray(`BEGIN ${permissions} ISOLATION LEVEL ${isolation_level};${snapshot}`);
    } catch (e) {
      if (e instanceof PostgresError) {
        throw new TransactionError(this.name, e);
      } else {
        throw e;
      }
    }
    this.#updateClientLock(this.name);
  }
  #committed;
  /**
   * The commit method will make permanent all changes made to the database in the
   * current transaction and end the current transaction
   *
   * ```ts
   * import { Client } from "../client.ts";
   *
   * const client = new Client();
   * const transaction = client.createTransaction("transaction");
   *
   * await transaction.begin();
   * // Important operations
   * await transaction.commit(); // Will terminate the transaction and save all changes
   * ```
   *
   * The commit method allows you to specify a "chain" option, that allows you to both commit the current changes and
   * start a new with the same transaction parameters in a single statement
   *
   * ```ts
   * import { Client } from "../client.ts";
   *
   * const client = new Client();
   * const transaction = client.createTransaction("transaction");
   *
   * // Transaction operations I want to commit
   * await transaction.commit({ chain: true }); // All changes are saved, following statements will be executed inside a transaction
   * await transaction.queryArray`DELETE SOMETHING FROM SOMEWHERE`; // Still inside the transaction
   * await transaction.commit(); // The transaction finishes for good
   * ```
   *
   * https://www.postgresql.org/docs/14/sql-commit.html
   */ async commit(options) {
    this.#assertTransactionOpen();
    const chain = options?.chain ?? false;
    if (!this.#committed) {
      this.#committed = true;
      try {
        await this.queryArray(`COMMIT ${chain ? "AND CHAIN" : ""}`);
      } catch (e) {
        if (e instanceof PostgresError) {
          throw new TransactionError(this.name, e);
        } else {
          throw e;
        }
      }
    }
    this.#resetTransaction();
    if (!chain) {
      this.#updateClientLock(null);
    }
  }
  /**
   * This method will search for the provided savepoint name and return a
   * reference to the requested savepoint, otherwise it will return undefined
   */ getSavepoint(name) {
    return this.#savepoints.find((sv)=>sv.name === name.toLowerCase());
  }
  /**
   * This method will list you all of the active savepoints in this transaction
   */ getSavepoints() {
    return this.#savepoints.filter(({ instances })=>instances > 0).map(({ name })=>name);
  }
  /**
   * This method returns the snapshot id of the on going transaction, allowing you to share
   * the snapshot state between two transactions
   *
   * ```ts
   * import { Client } from "../client.ts";
   *
   * const client_1 = new Client();
   * const client_2 = new Client();
   * const transaction_1 = client_1.createTransaction("transaction");
   *
   * const snapshot = await transaction_1.getSnapshot();
   * const transaction_2 = client_2.createTransaction("new_transaction", { isolation_level: "repeatable_read", snapshot });
   * // transaction_2 now shares the same starting state that transaction_1 had
   * ```
   * https://www.postgresql.org/docs/14/functions-admin.html#FUNCTIONS-SNAPSHOT-SYNCHRONIZATION
   */ async getSnapshot() {
    this.#assertTransactionOpen();
    const { rows } = await this.queryObject`SELECT PG_EXPORT_SNAPSHOT() AS SNAPSHOT;`;
    return rows[0].snapshot;
  }
  async queryArray(query_template_or_config, ...args) {
    this.#assertTransactionOpen();
    let query;
    if (typeof query_template_or_config === "string") {
      query = new Query(query_template_or_config, ResultType.ARRAY, args[0]);
    } else if (isTemplateString(query_template_or_config)) {
      query = templateStringToQuery(query_template_or_config, args, ResultType.ARRAY);
    } else {
      query = new Query(query_template_or_config, ResultType.ARRAY);
    }
    try {
      return await this.#executeQuery(query);
    } catch (e) {
      if (e instanceof PostgresError) {
        await this.commit();
        throw new TransactionError(this.name, e);
      } else {
        throw e;
      }
    }
  }
  async queryObject(query_template_or_config, ...args) {
    this.#assertTransactionOpen();
    let query;
    if (typeof query_template_or_config === "string") {
      query = new Query(query_template_or_config, ResultType.OBJECT, args[0]);
    } else if (isTemplateString(query_template_or_config)) {
      query = templateStringToQuery(query_template_or_config, args, ResultType.OBJECT);
    } else {
      query = new Query(query_template_or_config, ResultType.OBJECT);
    }
    try {
      return await this.#executeQuery(query);
    } catch (e) {
      if (e instanceof PostgresError) {
        await this.commit();
        throw new TransactionError(this.name, e);
      } else {
        throw e;
      }
    }
  }
  async rollback(savepoint_or_options) {
    this.#assertTransactionOpen();
    let savepoint_option;
    if (typeof savepoint_or_options === "string" || savepoint_or_options instanceof Savepoint) {
      savepoint_option = savepoint_or_options;
    } else {
      savepoint_option = savepoint_or_options?.savepoint;
    }
    let savepoint_name;
    if (savepoint_option instanceof Savepoint) {
      savepoint_name = savepoint_option.name;
    } else if (typeof savepoint_option === "string") {
      savepoint_name = savepoint_option.toLowerCase();
    }
    let chain_option = false;
    if (typeof savepoint_or_options === "object") {
      chain_option = savepoint_or_options?.chain ?? false;
    }
    if (chain_option && savepoint_name) {
      throw new Error("The chain option can't be used alongside a savepoint on a rollback operation");
    }
    // If a savepoint is provided, rollback to that savepoint, continue the transaction
    if (typeof savepoint_option !== "undefined") {
      const ts_savepoint = this.#savepoints.find(({ name })=>name === savepoint_name);
      if (!ts_savepoint) {
        throw new Error(`There is no "${savepoint_name}" savepoint registered in this transaction`);
      }
      if (!ts_savepoint.instances) {
        throw new Error(`There are no savepoints of "${savepoint_name}" left to rollback to`);
      }
      await this.queryArray(`ROLLBACK TO ${savepoint_name}`);
      return;
    }
    // If no savepoint is provided, rollback the whole transaction and check for the chain operator
    // in order to decide whether to restart the transaction or end it
    try {
      await this.queryArray(`ROLLBACK ${chain_option ? "AND CHAIN" : ""}`);
    } catch (e) {
      if (e instanceof PostgresError) {
        await this.commit();
        throw new TransactionError(this.name, e);
      } else {
        throw e;
      }
    }
    this.#resetTransaction();
    if (!chain_option) {
      this.#updateClientLock(null);
    }
  }
  /**
   * This method will generate a savepoint, which will allow you to reset transaction states
   * to a previous point of time
   *
   * Each savepoint has a unique name used to identify it, and it must abide the following rules
   *
   * - Savepoint names must start with a letter or an underscore
   * - Savepoint names are case insensitive
   * - Savepoint names can't be longer than 63 characters
   * - Savepoint names can only have alphanumeric characters
   *
   * A savepoint can be easily created like this
   * ```ts
   * import { Client } from "../client.ts";
   *
   * const client = new Client();
   * const transaction = client.createTransaction("transaction");
   *
   * const savepoint = await transaction.savepoint("MY_savepoint"); // returns a `Savepoint` with name "my_savepoint"
   * await transaction.rollback(savepoint);
   * await savepoint.release(); // The savepoint will be removed
   * ```
   * All savepoints can have multiple positions in a transaction, and you can change or update
   * this positions by using the `update` and `release` methods
   * ```ts
   * import { Client } from "../client.ts";
   *
   * const client = new Client();
   * const transaction = client.createTransaction("transaction");
   *
   * const savepoint = await transaction.savepoint("n1");
   * await transaction.queryArray`INSERT INTO MY_TABLE VALUES (${'A'}, ${2})`;
   * await savepoint.update(); // The savepoint will continue from here
   * await transaction.queryArray`DELETE FROM MY_TABLE`;
   * await transaction.rollback(savepoint); // The transaction will rollback before the delete, but after the insert
   * await savepoint.release(); // The last savepoint will be removed, the original one will remain
   * await transaction.rollback(savepoint); // It rolls back before the insert
   * await savepoint.release(); // All savepoints are released
   * ```
   *
   * Creating a new savepoint with an already used name will return you a reference to
   * the original savepoint
   * ```ts
   * import { Client } from "../client.ts";
   *
   * const client = new Client();
   * const transaction = client.createTransaction("transaction");
   *
   * const savepoint_a = await transaction.savepoint("a");
   * await transaction.queryArray`DELETE FROM MY_TABLE`;
   * const savepoint_b = await transaction.savepoint("a"); // They will be the same savepoint, but the savepoint will be updated to this position
   * await transaction.rollback(savepoint_a); // Rolls back to savepoint_b
   * ```
   * https://www.postgresql.org/docs/14/sql-savepoint.html
   */ async savepoint(name) {
    this.#assertTransactionOpen();
    if (!/^[a-zA-Z_]{1}[\w]{0,62}$/.test(name)) {
      if (!Number.isNaN(Number(name[0]))) {
        throw new Error("The savepoint name can't begin with a number");
      }
      if (name.length > 63) {
        throw new Error("The savepoint name can't be longer than 63 characters");
      }
      throw new Error("The savepoint name can only contain alphanumeric characters");
    }
    name = name.toLowerCase();
    let savepoint = this.#savepoints.find((sv)=>sv.name === name);
    if (savepoint) {
      try {
        await savepoint.update();
      } catch (e) {
        if (e instanceof PostgresError) {
          await this.commit();
          throw new TransactionError(this.name, e);
        } else {
          throw e;
        }
      }
    } else {
      savepoint = new Savepoint(name, async (name)=>{
        await this.queryArray(`SAVEPOINT ${name}`);
      }, async (name)=>{
        await this.queryArray(`RELEASE SAVEPOINT ${name}`);
      });
      try {
        await savepoint.update();
      } catch (e) {
        if (e instanceof PostgresError) {
          await this.commit();
          throw new TransactionError(this.name, e);
        } else {
          throw e;
        }
      }
      this.#savepoints.push(savepoint);
    }
    return savepoint;
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvcG9zdGdyZXNAdjAuMTcuMC9xdWVyeS90cmFuc2FjdGlvbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyB0eXBlIFF1ZXJ5Q2xpZW50IH0gZnJvbSBcIi4uL2NsaWVudC50c1wiO1xuaW1wb3J0IHtcbiAgUXVlcnksXG4gIHR5cGUgUXVlcnlBcmd1bWVudHMsXG4gIHR5cGUgUXVlcnlBcnJheVJlc3VsdCxcbiAgdHlwZSBRdWVyeU9iamVjdE9wdGlvbnMsXG4gIHR5cGUgUXVlcnlPYmplY3RSZXN1bHQsXG4gIHR5cGUgUXVlcnlPcHRpb25zLFxuICB0eXBlIFF1ZXJ5UmVzdWx0LFxuICBSZXN1bHRUeXBlLFxuICB0ZW1wbGF0ZVN0cmluZ1RvUXVlcnksXG59IGZyb20gXCIuL3F1ZXJ5LnRzXCI7XG5pbXBvcnQgeyBpc1RlbXBsYXRlU3RyaW5nIH0gZnJvbSBcIi4uL3V0aWxzL3V0aWxzLnRzXCI7XG5pbXBvcnQgeyBQb3N0Z3Jlc0Vycm9yLCBUcmFuc2FjdGlvbkVycm9yIH0gZnJvbSBcIi4uL2NsaWVudC9lcnJvci50c1wiO1xuXG5leHBvcnQgY2xhc3MgU2F2ZXBvaW50IHtcbiAgLyoqXG4gICAqIFRoaXMgaXMgdGhlIGNvdW50IG9mIHRoZSBjdXJyZW50IHNhdmVwb2ludCBpbnN0YW5jZXMgaW4gdGhlIHRyYW5zYWN0aW9uXG4gICAqL1xuICAjaW5zdGFuY2VfY291bnQgPSAwO1xuICAjcmVsZWFzZV9jYWxsYmFjazogKG5hbWU6IHN0cmluZykgPT4gUHJvbWlzZTx2b2lkPjtcbiAgI3VwZGF0ZV9jYWxsYmFjazogKG5hbWU6IHN0cmluZykgPT4gUHJvbWlzZTx2b2lkPjtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwdWJsaWMgcmVhZG9ubHkgbmFtZTogc3RyaW5nLFxuICAgIHVwZGF0ZV9jYWxsYmFjazogKG5hbWU6IHN0cmluZykgPT4gUHJvbWlzZTx2b2lkPixcbiAgICByZWxlYXNlX2NhbGxiYWNrOiAobmFtZTogc3RyaW5nKSA9PiBQcm9taXNlPHZvaWQ+LFxuICApIHtcbiAgICB0aGlzLiNyZWxlYXNlX2NhbGxiYWNrID0gcmVsZWFzZV9jYWxsYmFjaztcbiAgICB0aGlzLiN1cGRhdGVfY2FsbGJhY2sgPSB1cGRhdGVfY2FsbGJhY2s7XG4gIH1cblxuICBnZXQgaW5zdGFuY2VzKCkge1xuICAgIHJldHVybiB0aGlzLiNpbnN0YW5jZV9jb3VudDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWxlYXNpbmcgYSBzYXZlcG9pbnQgd2lsbCByZW1vdmUgaXQncyBsYXN0IGluc3RhbmNlIGluIHRoZSB0cmFuc2FjdGlvblxuICAgKlxuICAgKiBgYGB0c1xuICAgKiBpbXBvcnQgeyBDbGllbnQgfSBmcm9tIFwiLi4vY2xpZW50LnRzXCI7XG4gICAqXG4gICAqIGNvbnN0IGNsaWVudCA9IG5ldyBDbGllbnQoKTtcbiAgICogY29uc3QgdHJhbnNhY3Rpb24gPSBjbGllbnQuY3JlYXRlVHJhbnNhY3Rpb24oXCJ0cmFuc2FjdGlvblwiKTtcbiAgICpcbiAgICogY29uc3Qgc2F2ZXBvaW50ID0gYXdhaXQgdHJhbnNhY3Rpb24uc2F2ZXBvaW50KFwibjFcIik7XG4gICAqIGF3YWl0IHNhdmVwb2ludC5yZWxlYXNlKCk7XG4gICAqIHRyYW5zYWN0aW9uLnJvbGxiYWNrKHNhdmVwb2ludCk7IC8vIEVycm9yLCBjYW4ndCByb2xsYmFjayBiZWNhdXNlIHRoZSBzYXZlcG9pbnQgd2FzIHJlbGVhc2VkXG4gICAqIGBgYFxuICAgKlxuICAgKiBJdCB3aWxsIGFsc28gYWxsb3cgeW91IHRvIHNldCB0aGUgc2F2ZXBvaW50IHRvIHRoZSBwb3NpdGlvbiBpdCBoYWQgYmVmb3JlIHRoZSBsYXN0IHVwZGF0ZVxuICAgKlxuICAgKiBgYGB0c1xuICAgKiBpbXBvcnQgeyBDbGllbnQgfSBmcm9tIFwiLi4vY2xpZW50LnRzXCI7XG4gICAqXG4gICAqIGNvbnN0IGNsaWVudCA9IG5ldyBDbGllbnQoKTtcbiAgICogY29uc3QgdHJhbnNhY3Rpb24gPSBjbGllbnQuY3JlYXRlVHJhbnNhY3Rpb24oXCJ0cmFuc2FjdGlvblwiKTtcbiAgICpcbiAgICogY29uc3Qgc2F2ZXBvaW50ID0gYXdhaXQgdHJhbnNhY3Rpb24uc2F2ZXBvaW50KFwibjFcIik7XG4gICAqIGF3YWl0IHNhdmVwb2ludC51cGRhdGUoKTtcbiAgICogYXdhaXQgc2F2ZXBvaW50LnJlbGVhc2UoKTsgLy8gVGhpcyBkcm9wcyB0aGUgdXBkYXRlIG9mIHRoZSBsYXN0IHN0YXRlbWVudFxuICAgKiB0cmFuc2FjdGlvbi5yb2xsYmFjayhzYXZlcG9pbnQpOyAvLyBXaWxsIHJvbGxiYWNrIHRvIHRoZSBmaXJzdCBpbnN0YW5jZSBvZiB0aGUgc2F2ZXBvaW50XG4gICAqIGBgYFxuICAgKlxuICAgKiBUaGlzIGZ1bmN0aW9uIHdpbGwgdGhyb3cgaWYgdGhlcmUgYXJlIG5vIHNhdmVwb2ludCBpbnN0YW5jZXMgdG8gZHJvcFxuICAgKi9cbiAgYXN5bmMgcmVsZWFzZSgpIHtcbiAgICBpZiAodGhpcy4jaW5zdGFuY2VfY291bnQgPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIlRoaXMgc2F2ZXBvaW50IGhhcyBubyBpbnN0YW5jZXMgdG8gcmVsZWFzZVwiKTtcbiAgICB9XG5cbiAgICBhd2FpdCB0aGlzLiNyZWxlYXNlX2NhbGxiYWNrKHRoaXMubmFtZSk7XG4gICAgLS10aGlzLiNpbnN0YW5jZV9jb3VudDtcbiAgfVxuXG4gIC8qKlxuICAgKiBVcGRhdGluZyBhIHNhdmVwb2ludCB3aWxsIHVwZGF0ZSBpdHMgcG9zaXRpb24gaW4gdGhlIHRyYW5zYWN0aW9uIGV4ZWN1dGlvblxuICAgKlxuICAgKiBgYGB0c1xuICAgKiBpbXBvcnQgeyBDbGllbnQgfSBmcm9tIFwiLi4vY2xpZW50LnRzXCI7XG4gICAqXG4gICAqIGNvbnN0IGNsaWVudCA9IG5ldyBDbGllbnQoKTtcbiAgICogY29uc3QgdHJhbnNhY3Rpb24gPSBjbGllbnQuY3JlYXRlVHJhbnNhY3Rpb24oXCJ0cmFuc2FjdGlvblwiKTtcbiAgICpcbiAgICogY29uc3QgbXlfdmFsdWUgPSBcInNvbWUgdmFsdWVcIjtcbiAgICpcbiAgICogY29uc3Qgc2F2ZXBvaW50ID0gYXdhaXQgdHJhbnNhY3Rpb24uc2F2ZXBvaW50KFwibjFcIik7XG4gICAqIHRyYW5zYWN0aW9uLnF1ZXJ5QXJyYXlgSU5TRVJUIElOVE8gTVlfVEFCTEUgKFgpIFZBTFVFUyAoJHtteV92YWx1ZX0pYDtcbiAgICogYXdhaXQgc2F2ZXBvaW50LnVwZGF0ZSgpOyAvLyBSb2xsaW5nIGJhY2sgd2lsbCBub3cgcmV0dXJuIHlvdSB0byB0aGlzIHBvaW50IG9uIHRoZSB0cmFuc2FjdGlvblxuICAgKiBgYGBcbiAgICpcbiAgICogWW91IGNhbiBhbHNvIHVuZG8gYSBzYXZlcG9pbnQgdXBkYXRlIGJ5IHVzaW5nIHRoZSBgcmVsZWFzZWAgbWV0aG9kXG4gICAqXG4gICAqIGBgYHRzXG4gICAqIGltcG9ydCB7IENsaWVudCB9IGZyb20gXCIuLi9jbGllbnQudHNcIjtcbiAgICpcbiAgICogY29uc3QgY2xpZW50ID0gbmV3IENsaWVudCgpO1xuICAgKiBjb25zdCB0cmFuc2FjdGlvbiA9IGNsaWVudC5jcmVhdGVUcmFuc2FjdGlvbihcInRyYW5zYWN0aW9uXCIpO1xuICAgKlxuICAgKiBjb25zdCBzYXZlcG9pbnQgPSBhd2FpdCB0cmFuc2FjdGlvbi5zYXZlcG9pbnQoXCJuMVwiKTtcbiAgICogdHJhbnNhY3Rpb24ucXVlcnlBcnJheWBERUxFVEUgRlJPTSBWRVJZX0lNUE9SVEFOVF9UQUJMRWA7XG4gICAqIGF3YWl0IHNhdmVwb2ludC51cGRhdGUoKTsgLy8gT29wcywgc2hvdWxkbid0IGhhdmUgdXBkYXRlZCB0aGUgc2F2ZXBvaW50XG4gICAqIGF3YWl0IHNhdmVwb2ludC5yZWxlYXNlKCk7IC8vIFRoaXMgd2lsbCB1bmRvIHRoZSBsYXN0IHVwZGF0ZSBhbmQgcmV0dXJuIHRoZSBzYXZlcG9pbnQgdG8gdGhlIGZpcnN0IGluc3RhbmNlXG4gICAqIGF3YWl0IHRyYW5zYWN0aW9uLnJvbGxiYWNrKCk7IC8vIFdpbGwgcm9sbGJhY2sgYmVmb3JlIHRoZSB0YWJsZSB3YXMgZGVsZXRlZFxuICAgKiBgYGBcbiAgICovXG4gIGFzeW5jIHVwZGF0ZSgpIHtcbiAgICBhd2FpdCB0aGlzLiN1cGRhdGVfY2FsbGJhY2sodGhpcy5uYW1lKTtcbiAgICArK3RoaXMuI2luc3RhbmNlX2NvdW50O1xuICB9XG59XG5cbnR5cGUgSXNvbGF0aW9uTGV2ZWwgPSBcInJlYWRfY29tbWl0dGVkXCIgfCBcInJlcGVhdGFibGVfcmVhZFwiIHwgXCJzZXJpYWxpemFibGVcIjtcblxuZXhwb3J0IHR5cGUgVHJhbnNhY3Rpb25PcHRpb25zID0ge1xuICBpc29sYXRpb25fbGV2ZWw/OiBJc29sYXRpb25MZXZlbDtcbiAgcmVhZF9vbmx5PzogYm9vbGVhbjtcbiAgc25hcHNob3Q/OiBzdHJpbmc7XG59O1xuXG5leHBvcnQgY2xhc3MgVHJhbnNhY3Rpb24ge1xuICAjY2xpZW50OiBRdWVyeUNsaWVudDtcbiAgI2V4ZWN1dGVRdWVyeTogKHF1ZXJ5OiBRdWVyeTxSZXN1bHRUeXBlPikgPT4gUHJvbWlzZTxRdWVyeVJlc3VsdD47XG4gICNpc29sYXRpb25fbGV2ZWw6IElzb2xhdGlvbkxldmVsO1xuICAjcmVhZF9vbmx5OiBib29sZWFuO1xuICAjc2F2ZXBvaW50czogU2F2ZXBvaW50W10gPSBbXTtcbiAgI3NuYXBzaG90Pzogc3RyaW5nO1xuICAjdXBkYXRlQ2xpZW50TG9jazogKG5hbWU6IHN0cmluZyB8IG51bGwpID0+IHZvaWQ7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHVibGljIG5hbWU6IHN0cmluZyxcbiAgICBvcHRpb25zOiBUcmFuc2FjdGlvbk9wdGlvbnMgfCB1bmRlZmluZWQsXG4gICAgY2xpZW50OiBRdWVyeUNsaWVudCxcbiAgICBleGVjdXRlX3F1ZXJ5X2NhbGxiYWNrOiAocXVlcnk6IFF1ZXJ5PFJlc3VsdFR5cGU+KSA9PiBQcm9taXNlPFF1ZXJ5UmVzdWx0PixcbiAgICB1cGRhdGVfY2xpZW50X2xvY2tfY2FsbGJhY2s6IChuYW1lOiBzdHJpbmcgfCBudWxsKSA9PiB2b2lkLFxuICApIHtcbiAgICB0aGlzLiNjbGllbnQgPSBjbGllbnQ7XG4gICAgdGhpcy4jZXhlY3V0ZVF1ZXJ5ID0gZXhlY3V0ZV9xdWVyeV9jYWxsYmFjaztcbiAgICB0aGlzLiNpc29sYXRpb25fbGV2ZWwgPSBvcHRpb25zPy5pc29sYXRpb25fbGV2ZWwgPz8gXCJyZWFkX2NvbW1pdHRlZFwiO1xuICAgIHRoaXMuI3JlYWRfb25seSA9IG9wdGlvbnM/LnJlYWRfb25seSA/PyBmYWxzZTtcbiAgICB0aGlzLiNzbmFwc2hvdCA9IG9wdGlvbnM/LnNuYXBzaG90O1xuICAgIHRoaXMuI3VwZGF0ZUNsaWVudExvY2sgPSB1cGRhdGVfY2xpZW50X2xvY2tfY2FsbGJhY2s7XG4gIH1cblxuICBnZXQgaXNvbGF0aW9uX2xldmVsKCkge1xuICAgIHJldHVybiB0aGlzLiNpc29sYXRpb25fbGV2ZWw7XG4gIH1cblxuICBnZXQgc2F2ZXBvaW50cygpIHtcbiAgICByZXR1cm4gdGhpcy4jc2F2ZXBvaW50cztcbiAgfVxuXG4gIC8qKlxuICAgKiBUaGlzIG1ldGhvZCB3aWxsIHRocm93IGlmIHRoZSB0cmFuc2FjdGlvbiBvcGVuZWQgaW4gdGhlIGNsaWVudCBkb2Vzbid0IG1hdGNoIHRoaXMgb25lXG4gICAqL1xuICAjYXNzZXJ0VHJhbnNhY3Rpb25PcGVuKCkge1xuICAgIGlmICh0aGlzLiNjbGllbnQuc2Vzc2lvbi5jdXJyZW50X3RyYW5zYWN0aW9uICE9PSB0aGlzLm5hbWUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYFRoaXMgdHJhbnNhY3Rpb24gaGFzIG5vdCBiZWVuIHN0YXJ0ZWQgeWV0LCBtYWtlIHN1cmUgdG8gdXNlIHRoZSBcImJlZ2luXCIgbWV0aG9kIHRvIGRvIHNvYCxcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgI3Jlc2V0VHJhbnNhY3Rpb24oKSB7XG4gICAgdGhpcy4jc2F2ZXBvaW50cyA9IFtdO1xuICB9XG5cbiAgLyoqXG4gICAqIFRoZSBiZWdpbiBtZXRob2Qgd2lsbCBvZmZpY2lhbGx5IGJlZ2luIHRoZSB0cmFuc2FjdGlvbiwgYW5kIGl0IG11c3QgYmUgY2FsbGVkIGJlZm9yZVxuICAgKiBhbnkgcXVlcnkgb3IgdHJhbnNhY3Rpb24gb3BlcmF0aW9uIGlzIGV4ZWN1dGVkIGluIG9yZGVyIHRvIGxvY2sgdGhlIHNlc3Npb25cbiAgICogYGBgdHNcbiAgICogaW1wb3J0IHsgQ2xpZW50IH0gZnJvbSBcIi4uL2NsaWVudC50c1wiO1xuICAgKlxuICAgKiBjb25zdCBjbGllbnQgPSBuZXcgQ2xpZW50KCk7XG4gICAqIGNvbnN0IHRyYW5zYWN0aW9uID0gY2xpZW50LmNyZWF0ZVRyYW5zYWN0aW9uKFwidHJhbnNhY3Rpb25fbmFtZVwiKTtcbiAgICpcbiAgICogYXdhaXQgdHJhbnNhY3Rpb24uYmVnaW4oKTsgLy8gU2Vzc2lvbiBpcyBsb2NrZWQsIHRyYW5zYWN0aW9uIG9wZXJhdGlvbnMgYXJlIG5vdyBzYWZlXG4gICAqIC8vIEltcG9ydGFudCBvcGVyYXRpb25zXG4gICAqIGF3YWl0IHRyYW5zYWN0aW9uLmNvbW1pdCgpOyAvLyBTZXNzaW9uIGlzIHVubG9ja2VkLCBleHRlcm5hbCBvcGVyYXRpb25zIGNhbiBub3cgdGFrZSBwbGFjZVxuICAgKiBgYGBcbiAgICogaHR0cHM6Ly93d3cucG9zdGdyZXNxbC5vcmcvZG9jcy8xNC9zcWwtYmVnaW4uaHRtbFxuICAgKi9cbiAgYXN5bmMgYmVnaW4oKSB7XG4gICAgaWYgKHRoaXMuI2NsaWVudC5zZXNzaW9uLmN1cnJlbnRfdHJhbnNhY3Rpb24gIT09IG51bGwpIHtcbiAgICAgIGlmICh0aGlzLiNjbGllbnQuc2Vzc2lvbi5jdXJyZW50X3RyYW5zYWN0aW9uID09PSB0aGlzLm5hbWUpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIFwiVGhpcyB0cmFuc2FjdGlvbiBpcyBhbHJlYWR5IG9wZW5cIixcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgVGhpcyBjbGllbnQgYWxyZWFkeSBoYXMgYW4gb25nb2luZyB0cmFuc2FjdGlvbiBcIiR7dGhpcy4jY2xpZW50LnNlc3Npb24uY3VycmVudF90cmFuc2FjdGlvbn1cImAsXG4gICAgICApO1xuICAgIH1cblxuICAgIGxldCBpc29sYXRpb25fbGV2ZWw7XG4gICAgc3dpdGNoICh0aGlzLiNpc29sYXRpb25fbGV2ZWwpIHtcbiAgICAgIGNhc2UgXCJyZWFkX2NvbW1pdHRlZFwiOiB7XG4gICAgICAgIGlzb2xhdGlvbl9sZXZlbCA9IFwiUkVBRCBDT01NSVRURURcIjtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFwicmVwZWF0YWJsZV9yZWFkXCI6IHtcbiAgICAgICAgaXNvbGF0aW9uX2xldmVsID0gXCJSRVBFQVRBQkxFIFJFQURcIjtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFwic2VyaWFsaXphYmxlXCI6IHtcbiAgICAgICAgaXNvbGF0aW9uX2xldmVsID0gXCJTRVJJQUxJWkFCTEVcIjtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgYFVuZXhwZWN0ZWQgaXNvbGF0aW9uIGxldmVsIFwiJHt0aGlzLiNpc29sYXRpb25fbGV2ZWx9XCJgLFxuICAgICAgICApO1xuICAgIH1cblxuICAgIGxldCBwZXJtaXNzaW9ucztcbiAgICBpZiAodGhpcy4jcmVhZF9vbmx5KSB7XG4gICAgICBwZXJtaXNzaW9ucyA9IFwiUkVBRCBPTkxZXCI7XG4gICAgfSBlbHNlIHtcbiAgICAgIHBlcm1pc3Npb25zID0gXCJSRUFEIFdSSVRFXCI7XG4gICAgfVxuXG4gICAgbGV0IHNuYXBzaG90ID0gXCJcIjtcbiAgICBpZiAodGhpcy4jc25hcHNob3QpIHtcbiAgICAgIHNuYXBzaG90ID0gYFNFVCBUUkFOU0FDVElPTiBTTkFQU0hPVCAnJHt0aGlzLiNzbmFwc2hvdH0nYDtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgYXdhaXQgdGhpcy4jY2xpZW50LnF1ZXJ5QXJyYXkoXG4gICAgICAgIGBCRUdJTiAke3Blcm1pc3Npb25zfSBJU09MQVRJT04gTEVWRUwgJHtpc29sYXRpb25fbGV2ZWx9OyR7c25hcHNob3R9YCxcbiAgICAgICk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgaWYgKGUgaW5zdGFuY2VvZiBQb3N0Z3Jlc0Vycm9yKSB7XG4gICAgICAgIHRocm93IG5ldyBUcmFuc2FjdGlvbkVycm9yKHRoaXMubmFtZSwgZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuI3VwZGF0ZUNsaWVudExvY2sodGhpcy5uYW1lKTtcbiAgfVxuXG4gIC8qKiBTaG91bGQgbm90IGNvbW1pdCB0aGUgc2FtZSB0cmFuc2FjdGlvbiB0d2ljZS4gKi9cbiAgI2NvbW1pdHRlZCA9IGZhbHNlO1xuXG4gIC8qKlxuICAgKiBUaGUgY29tbWl0IG1ldGhvZCB3aWxsIG1ha2UgcGVybWFuZW50IGFsbCBjaGFuZ2VzIG1hZGUgdG8gdGhlIGRhdGFiYXNlIGluIHRoZVxuICAgKiBjdXJyZW50IHRyYW5zYWN0aW9uIGFuZCBlbmQgdGhlIGN1cnJlbnQgdHJhbnNhY3Rpb25cbiAgICpcbiAgICogYGBgdHNcbiAgICogaW1wb3J0IHsgQ2xpZW50IH0gZnJvbSBcIi4uL2NsaWVudC50c1wiO1xuICAgKlxuICAgKiBjb25zdCBjbGllbnQgPSBuZXcgQ2xpZW50KCk7XG4gICAqIGNvbnN0IHRyYW5zYWN0aW9uID0gY2xpZW50LmNyZWF0ZVRyYW5zYWN0aW9uKFwidHJhbnNhY3Rpb25cIik7XG4gICAqXG4gICAqIGF3YWl0IHRyYW5zYWN0aW9uLmJlZ2luKCk7XG4gICAqIC8vIEltcG9ydGFudCBvcGVyYXRpb25zXG4gICAqIGF3YWl0IHRyYW5zYWN0aW9uLmNvbW1pdCgpOyAvLyBXaWxsIHRlcm1pbmF0ZSB0aGUgdHJhbnNhY3Rpb24gYW5kIHNhdmUgYWxsIGNoYW5nZXNcbiAgICogYGBgXG4gICAqXG4gICAqIFRoZSBjb21taXQgbWV0aG9kIGFsbG93cyB5b3UgdG8gc3BlY2lmeSBhIFwiY2hhaW5cIiBvcHRpb24sIHRoYXQgYWxsb3dzIHlvdSB0byBib3RoIGNvbW1pdCB0aGUgY3VycmVudCBjaGFuZ2VzIGFuZFxuICAgKiBzdGFydCBhIG5ldyB3aXRoIHRoZSBzYW1lIHRyYW5zYWN0aW9uIHBhcmFtZXRlcnMgaW4gYSBzaW5nbGUgc3RhdGVtZW50XG4gICAqXG4gICAqIGBgYHRzXG4gICAqIGltcG9ydCB7IENsaWVudCB9IGZyb20gXCIuLi9jbGllbnQudHNcIjtcbiAgICpcbiAgICogY29uc3QgY2xpZW50ID0gbmV3IENsaWVudCgpO1xuICAgKiBjb25zdCB0cmFuc2FjdGlvbiA9IGNsaWVudC5jcmVhdGVUcmFuc2FjdGlvbihcInRyYW5zYWN0aW9uXCIpO1xuICAgKlxuICAgKiAvLyBUcmFuc2FjdGlvbiBvcGVyYXRpb25zIEkgd2FudCB0byBjb21taXRcbiAgICogYXdhaXQgdHJhbnNhY3Rpb24uY29tbWl0KHsgY2hhaW46IHRydWUgfSk7IC8vIEFsbCBjaGFuZ2VzIGFyZSBzYXZlZCwgZm9sbG93aW5nIHN0YXRlbWVudHMgd2lsbCBiZSBleGVjdXRlZCBpbnNpZGUgYSB0cmFuc2FjdGlvblxuICAgKiBhd2FpdCB0cmFuc2FjdGlvbi5xdWVyeUFycmF5YERFTEVURSBTT01FVEhJTkcgRlJPTSBTT01FV0hFUkVgOyAvLyBTdGlsbCBpbnNpZGUgdGhlIHRyYW5zYWN0aW9uXG4gICAqIGF3YWl0IHRyYW5zYWN0aW9uLmNvbW1pdCgpOyAvLyBUaGUgdHJhbnNhY3Rpb24gZmluaXNoZXMgZm9yIGdvb2RcbiAgICogYGBgXG4gICAqXG4gICAqIGh0dHBzOi8vd3d3LnBvc3RncmVzcWwub3JnL2RvY3MvMTQvc3FsLWNvbW1pdC5odG1sXG4gICAqL1xuICBhc3luYyBjb21taXQob3B0aW9ucz86IHsgY2hhaW4/OiBib29sZWFuIH0pIHtcbiAgICB0aGlzLiNhc3NlcnRUcmFuc2FjdGlvbk9wZW4oKTtcblxuICAgIGNvbnN0IGNoYWluID0gb3B0aW9ucz8uY2hhaW4gPz8gZmFsc2U7XG5cbiAgICBpZiAoIXRoaXMuI2NvbW1pdHRlZCkge1xuICAgICAgdGhpcy4jY29tbWl0dGVkID0gdHJ1ZTtcbiAgICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IHRoaXMucXVlcnlBcnJheShgQ09NTUlUICR7Y2hhaW4gPyBcIkFORCBDSEFJTlwiIDogXCJcIn1gKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgaWYgKGUgaW5zdGFuY2VvZiBQb3N0Z3Jlc0Vycm9yKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFRyYW5zYWN0aW9uRXJyb3IodGhpcy5uYW1lLCBlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy4jcmVzZXRUcmFuc2FjdGlvbigpO1xuICAgIGlmICghY2hhaW4pIHtcbiAgICAgIHRoaXMuI3VwZGF0ZUNsaWVudExvY2sobnVsbCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFRoaXMgbWV0aG9kIHdpbGwgc2VhcmNoIGZvciB0aGUgcHJvdmlkZWQgc2F2ZXBvaW50IG5hbWUgYW5kIHJldHVybiBhXG4gICAqIHJlZmVyZW5jZSB0byB0aGUgcmVxdWVzdGVkIHNhdmVwb2ludCwgb3RoZXJ3aXNlIGl0IHdpbGwgcmV0dXJuIHVuZGVmaW5lZFxuICAgKi9cbiAgZ2V0U2F2ZXBvaW50KG5hbWU6IHN0cmluZyk6IFNhdmVwb2ludCB8IHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIHRoaXMuI3NhdmVwb2ludHMuZmluZCgoc3YpID0+IHN2Lm5hbWUgPT09IG5hbWUudG9Mb3dlckNhc2UoKSk7XG4gIH1cblxuICAvKipcbiAgICogVGhpcyBtZXRob2Qgd2lsbCBsaXN0IHlvdSBhbGwgb2YgdGhlIGFjdGl2ZSBzYXZlcG9pbnRzIGluIHRoaXMgdHJhbnNhY3Rpb25cbiAgICovXG4gIGdldFNhdmVwb2ludHMoKTogc3RyaW5nW10ge1xuICAgIHJldHVybiB0aGlzLiNzYXZlcG9pbnRzXG4gICAgICAuZmlsdGVyKCh7IGluc3RhbmNlcyB9KSA9PiBpbnN0YW5jZXMgPiAwKVxuICAgICAgLm1hcCgoeyBuYW1lIH0pID0+IG5hbWUpO1xuICB9XG5cbiAgLyoqXG4gICAqIFRoaXMgbWV0aG9kIHJldHVybnMgdGhlIHNuYXBzaG90IGlkIG9mIHRoZSBvbiBnb2luZyB0cmFuc2FjdGlvbiwgYWxsb3dpbmcgeW91IHRvIHNoYXJlXG4gICAqIHRoZSBzbmFwc2hvdCBzdGF0ZSBiZXR3ZWVuIHR3byB0cmFuc2FjdGlvbnNcbiAgICpcbiAgICogYGBgdHNcbiAgICogaW1wb3J0IHsgQ2xpZW50IH0gZnJvbSBcIi4uL2NsaWVudC50c1wiO1xuICAgKlxuICAgKiBjb25zdCBjbGllbnRfMSA9IG5ldyBDbGllbnQoKTtcbiAgICogY29uc3QgY2xpZW50XzIgPSBuZXcgQ2xpZW50KCk7XG4gICAqIGNvbnN0IHRyYW5zYWN0aW9uXzEgPSBjbGllbnRfMS5jcmVhdGVUcmFuc2FjdGlvbihcInRyYW5zYWN0aW9uXCIpO1xuICAgKlxuICAgKiBjb25zdCBzbmFwc2hvdCA9IGF3YWl0IHRyYW5zYWN0aW9uXzEuZ2V0U25hcHNob3QoKTtcbiAgICogY29uc3QgdHJhbnNhY3Rpb25fMiA9IGNsaWVudF8yLmNyZWF0ZVRyYW5zYWN0aW9uKFwibmV3X3RyYW5zYWN0aW9uXCIsIHsgaXNvbGF0aW9uX2xldmVsOiBcInJlcGVhdGFibGVfcmVhZFwiLCBzbmFwc2hvdCB9KTtcbiAgICogLy8gdHJhbnNhY3Rpb25fMiBub3cgc2hhcmVzIHRoZSBzYW1lIHN0YXJ0aW5nIHN0YXRlIHRoYXQgdHJhbnNhY3Rpb25fMSBoYWRcbiAgICogYGBgXG4gICAqIGh0dHBzOi8vd3d3LnBvc3RncmVzcWwub3JnL2RvY3MvMTQvZnVuY3Rpb25zLWFkbWluLmh0bWwjRlVOQ1RJT05TLVNOQVBTSE9ULVNZTkNIUk9OSVpBVElPTlxuICAgKi9cbiAgYXN5bmMgZ2V0U25hcHNob3QoKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICB0aGlzLiNhc3NlcnRUcmFuc2FjdGlvbk9wZW4oKTtcblxuICAgIGNvbnN0IHsgcm93cyB9ID0gYXdhaXQgdGhpcy5xdWVyeU9iamVjdDxcbiAgICAgIHsgc25hcHNob3Q6IHN0cmluZyB9XG4gICAgPmBTRUxFQ1QgUEdfRVhQT1JUX1NOQVBTSE9UKCkgQVMgU05BUFNIT1Q7YDtcbiAgICByZXR1cm4gcm93c1swXS5zbmFwc2hvdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBUaGlzIG1ldGhvZCBhbGxvd3MgZXhlY3V0ZWQgcXVlcmllcyB0byBiZSByZXRyaWV2ZWQgYXMgYXJyYXkgZW50cmllcy5cbiAgICogSXQgc3VwcG9ydHMgYSBnZW5lcmljIGludGVyZmFjZSBpbiBvcmRlciB0byB0eXBlIHRoZSBlbnRyaWVzIHJldHJpZXZlZCBieSB0aGUgcXVlcnlcbiAgICpcbiAgICogYGBgdHNcbiAgICogaW1wb3J0IHsgQ2xpZW50IH0gZnJvbSBcIi4uL2NsaWVudC50c1wiO1xuICAgKlxuICAgKiBjb25zdCBjbGllbnQgPSBuZXcgQ2xpZW50KCk7XG4gICAqIGNvbnN0IHRyYW5zYWN0aW9uID0gY2xpZW50LmNyZWF0ZVRyYW5zYWN0aW9uKFwidHJhbnNhY3Rpb25cIik7XG4gICAqXG4gICAqIGNvbnN0IHtyb3dzfSA9IGF3YWl0IHRyYW5zYWN0aW9uLnF1ZXJ5QXJyYXkoXG4gICAqICBcIlNFTEVDVCBJRCwgTkFNRSBGUk9NIENMSUVOVFNcIlxuICAgKiApOyAvLyBBcnJheTx1bmtub3duW10+XG4gICAqIGBgYFxuICAgKlxuICAgKiBZb3UgY2FuIHBhc3MgdHlwZSBhcmd1bWVudHMgdG8gdGhlIHF1ZXJ5IGluIG9yZGVyIHRvIGhpbnQgVHlwZVNjcmlwdCB3aGF0IHRoZSByZXR1cm4gdmFsdWUgd2lsbCBiZVxuICAgKiBgYGB0c1xuICAgKiBpbXBvcnQgeyBDbGllbnQgfSBmcm9tIFwiLi4vY2xpZW50LnRzXCI7XG4gICAqXG4gICAqIGNvbnN0IGNsaWVudCA9IG5ldyBDbGllbnQoKTtcbiAgICogY29uc3QgdHJhbnNhY3Rpb24gPSBjbGllbnQuY3JlYXRlVHJhbnNhY3Rpb24oXCJ0cmFuc2FjdGlvblwiKTtcbiAgICpcbiAgICogY29uc3QgeyByb3dzIH0gPSBhd2FpdCB0cmFuc2FjdGlvbi5xdWVyeUFycmF5PFtudW1iZXIsIHN0cmluZ10+KFxuICAgKiAgXCJTRUxFQ1QgSUQsIE5BTUUgRlJPTSBDTElFTlRTXCJcbiAgICogKTsgLy8gQXJyYXk8W251bWJlciwgc3RyaW5nXT5cbiAgICogYGBgXG4gICAqXG4gICAqIEl0IGFsc28gYWxsb3dzIHlvdSB0byBleGVjdXRlIHByZXBhcmVkIHN0YW1lbWVudHMgd2l0aCB0ZW1wbGF0ZSBzdHJpbmdzXG4gICAqXG4gICAqIGBgYHRzXG4gICAqIGltcG9ydCB7IENsaWVudCB9IGZyb20gXCIuLi9jbGllbnQudHNcIjtcbiAgICpcbiAgICogY29uc3QgY2xpZW50ID0gbmV3IENsaWVudCgpO1xuICAgKiBjb25zdCB0cmFuc2FjdGlvbiA9IGNsaWVudC5jcmVhdGVUcmFuc2FjdGlvbihcInRyYW5zYWN0aW9uXCIpO1xuICAgKlxuICAgKiBjb25zdCBpZCA9IDEyO1xuICAgKiAvLyBBcnJheTxbbnVtYmVyLCBzdHJpbmddPlxuICAgKiBjb25zdCB7IHJvd3MgfSA9IGF3YWl0IHRyYW5zYWN0aW9uLnF1ZXJ5QXJyYXk8W251bWJlciwgc3RyaW5nXT5gU0VMRUNUIElELCBOQU1FIEZST00gQ0xJRU5UUyBXSEVSRSBJRCA9ICR7aWR9YDtcbiAgICogYGBgXG4gICAqL1xuICBhc3luYyBxdWVyeUFycmF5PFQgZXh0ZW5kcyBBcnJheTx1bmtub3duPj4oXG4gICAgcXVlcnk6IHN0cmluZyxcbiAgICBhcmdzPzogUXVlcnlBcmd1bWVudHMsXG4gICk6IFByb21pc2U8UXVlcnlBcnJheVJlc3VsdDxUPj47XG4gIGFzeW5jIHF1ZXJ5QXJyYXk8VCBleHRlbmRzIEFycmF5PHVua25vd24+PihcbiAgICBjb25maWc6IFF1ZXJ5T3B0aW9ucyxcbiAgKTogUHJvbWlzZTxRdWVyeUFycmF5UmVzdWx0PFQ+PjtcbiAgYXN5bmMgcXVlcnlBcnJheTxUIGV4dGVuZHMgQXJyYXk8dW5rbm93bj4+KFxuICAgIHN0cmluZ3M6IFRlbXBsYXRlU3RyaW5nc0FycmF5LFxuICAgIC4uLmFyZ3M6IHVua25vd25bXVxuICApOiBQcm9taXNlPFF1ZXJ5QXJyYXlSZXN1bHQ8VD4+O1xuICBhc3luYyBxdWVyeUFycmF5PFQgZXh0ZW5kcyBBcnJheTx1bmtub3duPiA9IEFycmF5PHVua25vd24+PihcbiAgICBxdWVyeV90ZW1wbGF0ZV9vcl9jb25maWc6IFRlbXBsYXRlU3RyaW5nc0FycmF5IHwgc3RyaW5nIHwgUXVlcnlPcHRpb25zLFxuICAgIC4uLmFyZ3M6IHVua25vd25bXSB8IFtRdWVyeUFyZ3VtZW50cyB8IHVuZGVmaW5lZF1cbiAgKTogUHJvbWlzZTxRdWVyeUFycmF5UmVzdWx0PFQ+PiB7XG4gICAgdGhpcy4jYXNzZXJ0VHJhbnNhY3Rpb25PcGVuKCk7XG5cbiAgICBsZXQgcXVlcnk6IFF1ZXJ5PFJlc3VsdFR5cGUuQVJSQVk+O1xuICAgIGlmICh0eXBlb2YgcXVlcnlfdGVtcGxhdGVfb3JfY29uZmlnID09PSBcInN0cmluZ1wiKSB7XG4gICAgICBxdWVyeSA9IG5ldyBRdWVyeShcbiAgICAgICAgcXVlcnlfdGVtcGxhdGVfb3JfY29uZmlnLFxuICAgICAgICBSZXN1bHRUeXBlLkFSUkFZLFxuICAgICAgICBhcmdzWzBdIGFzIFF1ZXJ5QXJndW1lbnRzIHwgdW5kZWZpbmVkLFxuICAgICAgKTtcbiAgICB9IGVsc2UgaWYgKGlzVGVtcGxhdGVTdHJpbmcocXVlcnlfdGVtcGxhdGVfb3JfY29uZmlnKSkge1xuICAgICAgcXVlcnkgPSB0ZW1wbGF0ZVN0cmluZ1RvUXVlcnkoXG4gICAgICAgIHF1ZXJ5X3RlbXBsYXRlX29yX2NvbmZpZyxcbiAgICAgICAgYXJncyxcbiAgICAgICAgUmVzdWx0VHlwZS5BUlJBWSxcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHF1ZXJ5ID0gbmV3IFF1ZXJ5KHF1ZXJ5X3RlbXBsYXRlX29yX2NvbmZpZywgUmVzdWx0VHlwZS5BUlJBWSk7XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBhd2FpdCB0aGlzLiNleGVjdXRlUXVlcnkocXVlcnkpIGFzIFF1ZXJ5QXJyYXlSZXN1bHQ8VD47XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgaWYgKGUgaW5zdGFuY2VvZiBQb3N0Z3Jlc0Vycm9yKSB7XG4gICAgICAgIGF3YWl0IHRoaXMuY29tbWl0KCk7XG4gICAgICAgIHRocm93IG5ldyBUcmFuc2FjdGlvbkVycm9yKHRoaXMubmFtZSwgZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBlO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBUaGlzIG1ldGhvZCBhbGxvd3MgZXhlY3V0ZWQgcXVlcmllcyB0byBiZSByZXRyaWV2ZWQgYXMgb2JqZWN0IGVudHJpZXMuXG4gICAqIEl0IHN1cHBvcnRzIGEgZ2VuZXJpYyBpbnRlcmZhY2UgaW4gb3JkZXIgdG8gdHlwZSB0aGUgZW50cmllcyByZXRyaWV2ZWQgYnkgdGhlIHF1ZXJ5XG4gICAqXG4gICAqIGBgYHRzXG4gICAqIGltcG9ydCB7IENsaWVudCB9IGZyb20gXCIuLi9jbGllbnQudHNcIjtcbiAgICpcbiAgICogY29uc3QgY2xpZW50ID0gbmV3IENsaWVudCgpO1xuICAgKiBjb25zdCB0cmFuc2FjdGlvbiA9IGNsaWVudC5jcmVhdGVUcmFuc2FjdGlvbihcInRyYW5zYWN0aW9uXCIpO1xuICAgKlxuICAgKiB7XG4gICAqICAgY29uc3QgeyByb3dzIH0gPSBhd2FpdCB0cmFuc2FjdGlvbi5xdWVyeU9iamVjdChcbiAgICogICAgIFwiU0VMRUNUIElELCBOQU1FIEZST00gQ0xJRU5UU1wiXG4gICAqICAgKTsgLy8gUmVjb3JkPHN0cmluZywgdW5rbm93bj5cbiAgICogfVxuICAgKlxuICAgKiB7XG4gICAqICAgY29uc3QgeyByb3dzIH0gPSBhd2FpdCB0cmFuc2FjdGlvbi5xdWVyeU9iamVjdDx7aWQ6IG51bWJlciwgbmFtZTogc3RyaW5nfT4oXG4gICAqICAgICBcIlNFTEVDVCBJRCwgTkFNRSBGUk9NIENMSUVOVFNcIlxuICAgKiAgICk7IC8vIEFycmF5PHtpZDogbnVtYmVyLCBuYW1lOiBzdHJpbmd9PlxuICAgKiB9XG4gICAqIGBgYFxuICAgKlxuICAgKiBZb3UgY2FuIGFsc28gbWFwIHRoZSBleHBlY3RlZCByZXN1bHRzIHRvIG9iamVjdCBmaWVsZHMgdXNpbmcgdGhlIGNvbmZpZ3VyYXRpb24gaW50ZXJmYWNlLlxuICAgKiBUaGlzIHdpbGwgYmUgYXNzaWduZWQgaW4gdGhlIG9yZGVyIHRoZXkgd2VyZSBwcm92aWRlZFxuICAgKlxuICAgKiBgYGB0c1xuICAgKiBpbXBvcnQgeyBDbGllbnQgfSBmcm9tIFwiLi4vY2xpZW50LnRzXCI7XG4gICAqXG4gICAqIGNvbnN0IGNsaWVudCA9IG5ldyBDbGllbnQoKTtcbiAgICogY29uc3QgdHJhbnNhY3Rpb24gPSBjbGllbnQuY3JlYXRlVHJhbnNhY3Rpb24oXCJ0cmFuc2FjdGlvblwiKTtcbiAgICpcbiAgICoge1xuICAgKiAgIGNvbnN0IHsgcm93cyB9ID0gYXdhaXQgdHJhbnNhY3Rpb24ucXVlcnlPYmplY3QoXG4gICAqICAgICBcIlNFTEVDVCBJRCwgTkFNRSBGUk9NIENMSUVOVFNcIlxuICAgKiAgICk7XG4gICAqXG4gICAqICAgY29uc29sZS5sb2cocm93cyk7IC8vIFt7aWQ6IDc4LCBuYW1lOiBcIkZyYW5rXCJ9LCB7aWQ6IDE1LCBuYW1lOiBcIlNhcmFoXCJ9XVxuICAgKiB9XG4gICAqXG4gICAqIHtcbiAgICogICBjb25zdCB7IHJvd3MgfSA9IGF3YWl0IHRyYW5zYWN0aW9uLnF1ZXJ5T2JqZWN0KHtcbiAgICogICAgIHRleHQ6IFwiU0VMRUNUIElELCBOQU1FIEZST00gQ0xJRU5UU1wiLFxuICAgKiAgICAgZmllbGRzOiBbXCJwZXJzb25hbF9pZFwiLCBcImNvbXBsZXRlX25hbWVcIl0sXG4gICAqICAgfSk7XG4gICAqXG4gICAqICAgY29uc29sZS5sb2cocm93cyk7IC8vIFt7cGVyc29uYWxfaWQ6IDc4LCBjb21wbGV0ZV9uYW1lOiBcIkZyYW5rXCJ9LCB7cGVyc29uYWxfaWQ6IDE1LCBjb21wbGV0ZV9uYW1lOiBcIlNhcmFoXCJ9XVxuICAgKiB9XG4gICAqIGBgYFxuICAgKlxuICAgKiBJdCBhbHNvIGFsbG93cyB5b3UgdG8gZXhlY3V0ZSBwcmVwYXJlZCBzdGFtZW1lbnRzIHdpdGggdGVtcGxhdGUgc3RyaW5nc1xuICAgKlxuICAgKiBgYGB0c1xuICAgKiBpbXBvcnQgeyBDbGllbnQgfSBmcm9tIFwiLi4vY2xpZW50LnRzXCI7XG4gICAqXG4gICAqIGNvbnN0IGNsaWVudCA9IG5ldyBDbGllbnQoKTtcbiAgICogY29uc3QgdHJhbnNhY3Rpb24gPSBjbGllbnQuY3JlYXRlVHJhbnNhY3Rpb24oXCJ0cmFuc2FjdGlvblwiKTtcbiAgICpcbiAgICogY29uc3QgaWQgPSAxMjtcbiAgICogLy8gQXJyYXk8e2lkOiBudW1iZXIsIG5hbWU6IHN0cmluZ30+XG4gICAqIGNvbnN0IHtyb3dzfSA9IGF3YWl0IHRyYW5zYWN0aW9uLnF1ZXJ5T2JqZWN0PHtpZDogbnVtYmVyLCBuYW1lOiBzdHJpbmd9PmBTRUxFQ1QgSUQsIE5BTUUgRlJPTSBDTElFTlRTIFdIRVJFIElEID0gJHtpZH1gO1xuICAgKiBgYGBcbiAgICovXG4gIGFzeW5jIHF1ZXJ5T2JqZWN0PFQ+KFxuICAgIHF1ZXJ5OiBzdHJpbmcsXG4gICAgYXJncz86IFF1ZXJ5QXJndW1lbnRzLFxuICApOiBQcm9taXNlPFF1ZXJ5T2JqZWN0UmVzdWx0PFQ+PjtcbiAgYXN5bmMgcXVlcnlPYmplY3Q8VD4oXG4gICAgY29uZmlnOiBRdWVyeU9iamVjdE9wdGlvbnMsXG4gICk6IFByb21pc2U8UXVlcnlPYmplY3RSZXN1bHQ8VD4+O1xuICBhc3luYyBxdWVyeU9iamVjdDxUPihcbiAgICBxdWVyeTogVGVtcGxhdGVTdHJpbmdzQXJyYXksXG4gICAgLi4uYXJnczogdW5rbm93bltdXG4gICk6IFByb21pc2U8UXVlcnlPYmplY3RSZXN1bHQ8VD4+O1xuICBhc3luYyBxdWVyeU9iamVjdDxcbiAgICBUID0gUmVjb3JkPHN0cmluZywgdW5rbm93bj4sXG4gID4oXG4gICAgcXVlcnlfdGVtcGxhdGVfb3JfY29uZmlnOlxuICAgICAgfCBzdHJpbmdcbiAgICAgIHwgUXVlcnlPYmplY3RPcHRpb25zXG4gICAgICB8IFRlbXBsYXRlU3RyaW5nc0FycmF5LFxuICAgIC4uLmFyZ3M6IHVua25vd25bXSB8IFtRdWVyeUFyZ3VtZW50cyB8IHVuZGVmaW5lZF1cbiAgKTogUHJvbWlzZTxRdWVyeU9iamVjdFJlc3VsdDxUPj4ge1xuICAgIHRoaXMuI2Fzc2VydFRyYW5zYWN0aW9uT3BlbigpO1xuXG4gICAgbGV0IHF1ZXJ5OiBRdWVyeTxSZXN1bHRUeXBlLk9CSkVDVD47XG4gICAgaWYgKHR5cGVvZiBxdWVyeV90ZW1wbGF0ZV9vcl9jb25maWcgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgIHF1ZXJ5ID0gbmV3IFF1ZXJ5KFxuICAgICAgICBxdWVyeV90ZW1wbGF0ZV9vcl9jb25maWcsXG4gICAgICAgIFJlc3VsdFR5cGUuT0JKRUNULFxuICAgICAgICBhcmdzWzBdIGFzIFF1ZXJ5QXJndW1lbnRzIHwgdW5kZWZpbmVkLFxuICAgICAgKTtcbiAgICB9IGVsc2UgaWYgKGlzVGVtcGxhdGVTdHJpbmcocXVlcnlfdGVtcGxhdGVfb3JfY29uZmlnKSkge1xuICAgICAgcXVlcnkgPSB0ZW1wbGF0ZVN0cmluZ1RvUXVlcnkoXG4gICAgICAgIHF1ZXJ5X3RlbXBsYXRlX29yX2NvbmZpZyxcbiAgICAgICAgYXJncyxcbiAgICAgICAgUmVzdWx0VHlwZS5PQkpFQ1QsXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICBxdWVyeSA9IG5ldyBRdWVyeShcbiAgICAgICAgcXVlcnlfdGVtcGxhdGVfb3JfY29uZmlnIGFzIFF1ZXJ5T2JqZWN0T3B0aW9ucyxcbiAgICAgICAgUmVzdWx0VHlwZS5PQkpFQ1QsXG4gICAgICApO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICByZXR1cm4gYXdhaXQgdGhpcy4jZXhlY3V0ZVF1ZXJ5KHF1ZXJ5KSBhcyBRdWVyeU9iamVjdFJlc3VsdDxUPjtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAoZSBpbnN0YW5jZW9mIFBvc3RncmVzRXJyb3IpIHtcbiAgICAgICAgYXdhaXQgdGhpcy5jb21taXQoKTtcbiAgICAgICAgdGhyb3cgbmV3IFRyYW5zYWN0aW9uRXJyb3IodGhpcy5uYW1lLCBlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IGU7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJvbGxiYWNrcyBhcmUgYSBtZWNoYW5pc20gdG8gdW5kbyB0cmFuc2FjdGlvbiBvcGVyYXRpb25zIHdpdGhvdXQgY29tcHJvbWlzaW5nIHRoZSBkYXRhIHRoYXQgd2FzIG1vZGlmaWVkIGR1cmluZ1xuICAgKiB0aGUgdHJhbnNhY3Rpb25cbiAgICpcbiAgICogQSByb2xsYmFjayBjYW4gYmUgZXhlY3V0ZWQgdGhlIGZvbGxvd2luZyB3YXlcbiAgICogYGBgdHNcbiAgICogaW1wb3J0IHsgQ2xpZW50IH0gZnJvbSBcIi4uL2NsaWVudC50c1wiO1xuICAgKlxuICAgKiBjb25zdCBjbGllbnQgPSBuZXcgQ2xpZW50KCk7XG4gICAqIGNvbnN0IHRyYW5zYWN0aW9uID0gY2xpZW50LmNyZWF0ZVRyYW5zYWN0aW9uKFwidHJhbnNhY3Rpb25cIik7XG4gICAqXG4gICAqIC8vIFZlcnkgdmVyeSBpbXBvcnRhbnQgb3BlcmF0aW9ucyB0aGF0IHdlbnQgdmVyeSwgdmVyeSB3cm9uZ1xuICAgKiBhd2FpdCB0cmFuc2FjdGlvbi5yb2xsYmFjaygpOyAvLyBMaWtlIG5vdGhpbmcgZXZlciBoYXBwZW5lZFxuICAgKiBgYGBcbiAgICpcbiAgICogQ2FsbGluZyBhIHJvbGxiYWNrIHdpdGhvdXQgYXJndW1lbnRzIHdpbGwgdGVybWluYXRlIHRoZSBjdXJyZW50IHRyYW5zYWN0aW9uIGFuZCB1bmRvIGFsbCBjaGFuZ2VzLFxuICAgKiBidXQgaXQgY2FuIGJlIHVzZWQgaW4gY29uanVjdGlvbiB3aXRoIHRoZSBzYXZlcG9pbnQgZmVhdHVyZSB0byByb2xsYmFjayBzcGVjaWZpYyBjaGFuZ2VzIGxpa2UgdGhlIGZvbGxvd2luZ1xuICAgKlxuICAgKiBgYGB0c1xuICAgKiBpbXBvcnQgeyBDbGllbnQgfSBmcm9tIFwiLi4vY2xpZW50LnRzXCI7XG4gICAqXG4gICAqIGNvbnN0IGNsaWVudCA9IG5ldyBDbGllbnQoKTtcbiAgICogY29uc3QgdHJhbnNhY3Rpb24gPSBjbGllbnQuY3JlYXRlVHJhbnNhY3Rpb24oXCJ0cmFuc2FjdGlvblwiKTtcbiAgICpcbiAgICogLy8gSW1wb3J0YW50IG9wZXJhdGlvbnMgSSBkb24ndCB3YW50IHRvIHJvbGxiYWNrXG4gICAqIGNvbnN0IHNhdmVwb2ludCA9IGF3YWl0IHRyYW5zYWN0aW9uLnNhdmVwb2ludChcImJlZm9yZV9kaXNhc3RlclwiKTtcbiAgICogYXdhaXQgdHJhbnNhY3Rpb24ucXVlcnlBcnJheWBVUERBVEUgTVlfVEFCTEUgU0VUIFggPSAwYDsgLy8gT29wcywgdXBkYXRlIHdpdGhvdXQgd2hlcmVcbiAgICogYXdhaXQgdHJhbnNhY3Rpb24ucm9sbGJhY2soc2F2ZXBvaW50KTsgLy8gXCJiZWZvcmVfZGlzYXN0ZXJcIiB3b3VsZCB3b3JrIGFzIHdlbGxcbiAgICogLy8gRXZlcnl0aGluZyB0aGF0IGhhcHBlbmVkIGJldHdlZW4gdGhlIHNhdmVwb2ludCBhbmQgdGhlIHJvbGxiYWNrIGdldHMgdW5kb25lXG4gICAqIGF3YWl0IHRyYW5zYWN0aW9uLmNvbW1pdCgpOyAvLyBDb21taXRzIGFsbCBvdGhlciBjaGFuZ2VzXG4gICAqIGBgYFxuICAgKlxuICAgKiBUaGUgcm9sbGJhY2sgbWV0aG9kIGFsbG93cyB5b3UgdG8gc3BlY2lmeSBhIFwiY2hhaW5cIiBvcHRpb24sIHRoYXQgYWxsb3dzIHlvdSB0byBub3Qgb25seSB1bmRvIHRoZSBjdXJyZW50IHRyYW5zYWN0aW9uXG4gICAqIGJ1dCB0byByZXN0YXJ0IGl0IHdpdGggdGhlIHNhbWUgcGFyYW1ldGVycyBpbiBhIHNpbmdsZSBzdGF0ZW1lbnRcbiAgICpcbiAgICogYGBgdHNcbiAgICogaW1wb3J0IHsgQ2xpZW50IH0gZnJvbSBcIi4uL2NsaWVudC50c1wiO1xuICAgKlxuICAgKiBjb25zdCBjbGllbnQgPSBuZXcgQ2xpZW50KCk7XG4gICAqIGNvbnN0IHRyYW5zYWN0aW9uID0gY2xpZW50LmNyZWF0ZVRyYW5zYWN0aW9uKFwidHJhbnNhY3Rpb25cIik7XG4gICAqXG4gICAqIC8vIFRyYW5zYWN0aW9uIG9wZXJhdGlvbnMgSSB3YW50IHRvIHVuZG9cbiAgICogYXdhaXQgdHJhbnNhY3Rpb24ucm9sbGJhY2soeyBjaGFpbjogdHJ1ZSB9KTsgLy8gQWxsIGNoYW5nZXMgYXJlIHVuZG9uZSwgYnV0IHRoZSBmb2xsb3dpbmcgc3RhdGVtZW50cyB3aWxsIGJlIGV4ZWN1dGVkIGluc2lkZSBhIHRyYW5zYWN0aW9uIGFzIHdlbGxcbiAgICogYXdhaXQgdHJhbnNhY3Rpb24ucXVlcnlBcnJheWBERUxFVEUgU09NRVRISU5HIEZST00gU09NRVdIRVJFYDsgLy8gU3RpbGwgaW5zaWRlIHRoZSB0cmFuc2FjdGlvblxuICAgKiBhd2FpdCB0cmFuc2FjdGlvbi5jb21taXQoKTsgLy8gVGhlIHRyYW5zYWN0aW9uIGZpbmlzaGVzIGZvciBnb29kXG4gICAqIGBgYFxuICAgKlxuICAgKiBIb3dldmVyLCB0aGUgXCJjaGFpblwiIG9wdGlvbiBjYW4ndCBiZSB1c2VkIGFsb25nc2lkZSBhIHNhdmVwb2ludCwgZXZlbiB0aG91Z2ggdGhleSBhcmUgc2ltaWxhclxuICAgKlxuICAgKiBBIHNhdmVwb2ludCBpcyBtZWFudCB0byByZXNldCBwcm9ncmVzcyB1cCB0byBhIGNlcnRhaW4gcG9pbnQsIHdoaWxlIGEgY2hhaW5lZCByb2xsYmFjayBpcyBtZWFudCB0byByZXNldCBhbGwgcHJvZ3Jlc3NcbiAgICogYW5kIHN0YXJ0IGZyb20gc2NyYXRjaFxuICAgKlxuICAgKiBgYGB0c1xuICAgKiBpbXBvcnQgeyBDbGllbnQgfSBmcm9tIFwiLi4vY2xpZW50LnRzXCI7XG4gICAqXG4gICAqIGNvbnN0IGNsaWVudCA9IG5ldyBDbGllbnQoKTtcbiAgICogY29uc3QgdHJhbnNhY3Rpb24gPSBjbGllbnQuY3JlYXRlVHJhbnNhY3Rpb24oXCJ0cmFuc2FjdGlvblwiKTtcbiAgICpcbiAgICogLy8gQHRzLWV4cGVjdC1lcnJvclxuICAgKiBhd2FpdCB0cmFuc2FjdGlvbi5yb2xsYmFjayh7IGNoYWluOiB0cnVlLCBzYXZlcG9pbnQ6IFwibXlfc2F2ZXBvaW50XCIgfSk7IC8vIEVycm9yLCBjYW4ndCBib3RoIHJldHVybiB0byBzYXZlcG9pbnQgYW5kIHJlc2V0IHRyYW5zYWN0aW9uXG4gICAqIGBgYFxuICAgKiBodHRwczovL3d3dy5wb3N0Z3Jlc3FsLm9yZy9kb2NzLzE0L3NxbC1yb2xsYmFjay5odG1sXG4gICAqL1xuICBhc3luYyByb2xsYmFjayhzYXZlcG9pbnQ/OiBzdHJpbmcgfCBTYXZlcG9pbnQpOiBQcm9taXNlPHZvaWQ+O1xuICBhc3luYyByb2xsYmFjayhvcHRpb25zPzogeyBzYXZlcG9pbnQ/OiBzdHJpbmcgfCBTYXZlcG9pbnQgfSk6IFByb21pc2U8dm9pZD47XG4gIGFzeW5jIHJvbGxiYWNrKG9wdGlvbnM/OiB7IGNoYWluPzogYm9vbGVhbiB9KTogUHJvbWlzZTx2b2lkPjtcbiAgYXN5bmMgcm9sbGJhY2soXG4gICAgc2F2ZXBvaW50X29yX29wdGlvbnM/OiBzdHJpbmcgfCBTYXZlcG9pbnQgfCB7XG4gICAgICBzYXZlcG9pbnQ/OiBzdHJpbmcgfCBTYXZlcG9pbnQ7XG4gICAgfSB8IHsgY2hhaW4/OiBib29sZWFuIH0sXG4gICk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuI2Fzc2VydFRyYW5zYWN0aW9uT3BlbigpO1xuXG4gICAgbGV0IHNhdmVwb2ludF9vcHRpb246IFNhdmVwb2ludCB8IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICBpZiAoXG4gICAgICB0eXBlb2Ygc2F2ZXBvaW50X29yX29wdGlvbnMgPT09IFwic3RyaW5nXCIgfHxcbiAgICAgIHNhdmVwb2ludF9vcl9vcHRpb25zIGluc3RhbmNlb2YgU2F2ZXBvaW50XG4gICAgKSB7XG4gICAgICBzYXZlcG9pbnRfb3B0aW9uID0gc2F2ZXBvaW50X29yX29wdGlvbnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNhdmVwb2ludF9vcHRpb24gPVxuICAgICAgICAoc2F2ZXBvaW50X29yX29wdGlvbnMgYXMgeyBzYXZlcG9pbnQ/OiBzdHJpbmcgfCBTYXZlcG9pbnQgfSk/LnNhdmVwb2ludDtcbiAgICB9XG5cbiAgICBsZXQgc2F2ZXBvaW50X25hbWU6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICBpZiAoc2F2ZXBvaW50X29wdGlvbiBpbnN0YW5jZW9mIFNhdmVwb2ludCkge1xuICAgICAgc2F2ZXBvaW50X25hbWUgPSBzYXZlcG9pbnRfb3B0aW9uLm5hbWU7XG4gICAgfSBlbHNlIGlmICh0eXBlb2Ygc2F2ZXBvaW50X29wdGlvbiA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgc2F2ZXBvaW50X25hbWUgPSBzYXZlcG9pbnRfb3B0aW9uLnRvTG93ZXJDYXNlKCk7XG4gICAgfVxuXG4gICAgbGV0IGNoYWluX29wdGlvbiA9IGZhbHNlO1xuICAgIGlmICh0eXBlb2Ygc2F2ZXBvaW50X29yX29wdGlvbnMgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgIGNoYWluX29wdGlvbiA9IChzYXZlcG9pbnRfb3Jfb3B0aW9ucyBhcyB7IGNoYWluPzogYm9vbGVhbiB9KT8uY2hhaW4gPz9cbiAgICAgICAgZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKGNoYWluX29wdGlvbiAmJiBzYXZlcG9pbnRfbmFtZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBcIlRoZSBjaGFpbiBvcHRpb24gY2FuJ3QgYmUgdXNlZCBhbG9uZ3NpZGUgYSBzYXZlcG9pbnQgb24gYSByb2xsYmFjayBvcGVyYXRpb25cIixcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gSWYgYSBzYXZlcG9pbnQgaXMgcHJvdmlkZWQsIHJvbGxiYWNrIHRvIHRoYXQgc2F2ZXBvaW50LCBjb250aW51ZSB0aGUgdHJhbnNhY3Rpb25cbiAgICBpZiAodHlwZW9mIHNhdmVwb2ludF9vcHRpb24gIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgIGNvbnN0IHRzX3NhdmVwb2ludCA9IHRoaXMuI3NhdmVwb2ludHMuZmluZCgoeyBuYW1lIH0pID0+XG4gICAgICAgIG5hbWUgPT09IHNhdmVwb2ludF9uYW1lXG4gICAgICApO1xuICAgICAgaWYgKCF0c19zYXZlcG9pbnQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIGBUaGVyZSBpcyBubyBcIiR7c2F2ZXBvaW50X25hbWV9XCIgc2F2ZXBvaW50IHJlZ2lzdGVyZWQgaW4gdGhpcyB0cmFuc2FjdGlvbmAsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICBpZiAoIXRzX3NhdmVwb2ludC5pbnN0YW5jZXMpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIGBUaGVyZSBhcmUgbm8gc2F2ZXBvaW50cyBvZiBcIiR7c2F2ZXBvaW50X25hbWV9XCIgbGVmdCB0byByb2xsYmFjayB0b2AsXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMucXVlcnlBcnJheShgUk9MTEJBQ0sgVE8gJHtzYXZlcG9pbnRfbmFtZX1gKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBJZiBubyBzYXZlcG9pbnQgaXMgcHJvdmlkZWQsIHJvbGxiYWNrIHRoZSB3aG9sZSB0cmFuc2FjdGlvbiBhbmQgY2hlY2sgZm9yIHRoZSBjaGFpbiBvcGVyYXRvclxuICAgIC8vIGluIG9yZGVyIHRvIGRlY2lkZSB3aGV0aGVyIHRvIHJlc3RhcnQgdGhlIHRyYW5zYWN0aW9uIG9yIGVuZCBpdFxuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLnF1ZXJ5QXJyYXkoYFJPTExCQUNLICR7Y2hhaW5fb3B0aW9uID8gXCJBTkQgQ0hBSU5cIiA6IFwiXCJ9YCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgaWYgKGUgaW5zdGFuY2VvZiBQb3N0Z3Jlc0Vycm9yKSB7XG4gICAgICAgIGF3YWl0IHRoaXMuY29tbWl0KCk7XG4gICAgICAgIHRocm93IG5ldyBUcmFuc2FjdGlvbkVycm9yKHRoaXMubmFtZSwgZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuI3Jlc2V0VHJhbnNhY3Rpb24oKTtcbiAgICBpZiAoIWNoYWluX29wdGlvbikge1xuICAgICAgdGhpcy4jdXBkYXRlQ2xpZW50TG9jayhudWxsKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogVGhpcyBtZXRob2Qgd2lsbCBnZW5lcmF0ZSBhIHNhdmVwb2ludCwgd2hpY2ggd2lsbCBhbGxvdyB5b3UgdG8gcmVzZXQgdHJhbnNhY3Rpb24gc3RhdGVzXG4gICAqIHRvIGEgcHJldmlvdXMgcG9pbnQgb2YgdGltZVxuICAgKlxuICAgKiBFYWNoIHNhdmVwb2ludCBoYXMgYSB1bmlxdWUgbmFtZSB1c2VkIHRvIGlkZW50aWZ5IGl0LCBhbmQgaXQgbXVzdCBhYmlkZSB0aGUgZm9sbG93aW5nIHJ1bGVzXG4gICAqXG4gICAqIC0gU2F2ZXBvaW50IG5hbWVzIG11c3Qgc3RhcnQgd2l0aCBhIGxldHRlciBvciBhbiB1bmRlcnNjb3JlXG4gICAqIC0gU2F2ZXBvaW50IG5hbWVzIGFyZSBjYXNlIGluc2Vuc2l0aXZlXG4gICAqIC0gU2F2ZXBvaW50IG5hbWVzIGNhbid0IGJlIGxvbmdlciB0aGFuIDYzIGNoYXJhY3RlcnNcbiAgICogLSBTYXZlcG9pbnQgbmFtZXMgY2FuIG9ubHkgaGF2ZSBhbHBoYW51bWVyaWMgY2hhcmFjdGVyc1xuICAgKlxuICAgKiBBIHNhdmVwb2ludCBjYW4gYmUgZWFzaWx5IGNyZWF0ZWQgbGlrZSB0aGlzXG4gICAqIGBgYHRzXG4gICAqIGltcG9ydCB7IENsaWVudCB9IGZyb20gXCIuLi9jbGllbnQudHNcIjtcbiAgICpcbiAgICogY29uc3QgY2xpZW50ID0gbmV3IENsaWVudCgpO1xuICAgKiBjb25zdCB0cmFuc2FjdGlvbiA9IGNsaWVudC5jcmVhdGVUcmFuc2FjdGlvbihcInRyYW5zYWN0aW9uXCIpO1xuICAgKlxuICAgKiBjb25zdCBzYXZlcG9pbnQgPSBhd2FpdCB0cmFuc2FjdGlvbi5zYXZlcG9pbnQoXCJNWV9zYXZlcG9pbnRcIik7IC8vIHJldHVybnMgYSBgU2F2ZXBvaW50YCB3aXRoIG5hbWUgXCJteV9zYXZlcG9pbnRcIlxuICAgKiBhd2FpdCB0cmFuc2FjdGlvbi5yb2xsYmFjayhzYXZlcG9pbnQpO1xuICAgKiBhd2FpdCBzYXZlcG9pbnQucmVsZWFzZSgpOyAvLyBUaGUgc2F2ZXBvaW50IHdpbGwgYmUgcmVtb3ZlZFxuICAgKiBgYGBcbiAgICogQWxsIHNhdmVwb2ludHMgY2FuIGhhdmUgbXVsdGlwbGUgcG9zaXRpb25zIGluIGEgdHJhbnNhY3Rpb24sIGFuZCB5b3UgY2FuIGNoYW5nZSBvciB1cGRhdGVcbiAgICogdGhpcyBwb3NpdGlvbnMgYnkgdXNpbmcgdGhlIGB1cGRhdGVgIGFuZCBgcmVsZWFzZWAgbWV0aG9kc1xuICAgKiBgYGB0c1xuICAgKiBpbXBvcnQgeyBDbGllbnQgfSBmcm9tIFwiLi4vY2xpZW50LnRzXCI7XG4gICAqXG4gICAqIGNvbnN0IGNsaWVudCA9IG5ldyBDbGllbnQoKTtcbiAgICogY29uc3QgdHJhbnNhY3Rpb24gPSBjbGllbnQuY3JlYXRlVHJhbnNhY3Rpb24oXCJ0cmFuc2FjdGlvblwiKTtcbiAgICpcbiAgICogY29uc3Qgc2F2ZXBvaW50ID0gYXdhaXQgdHJhbnNhY3Rpb24uc2F2ZXBvaW50KFwibjFcIik7XG4gICAqIGF3YWl0IHRyYW5zYWN0aW9uLnF1ZXJ5QXJyYXlgSU5TRVJUIElOVE8gTVlfVEFCTEUgVkFMVUVTICgkeydBJ30sICR7Mn0pYDtcbiAgICogYXdhaXQgc2F2ZXBvaW50LnVwZGF0ZSgpOyAvLyBUaGUgc2F2ZXBvaW50IHdpbGwgY29udGludWUgZnJvbSBoZXJlXG4gICAqIGF3YWl0IHRyYW5zYWN0aW9uLnF1ZXJ5QXJyYXlgREVMRVRFIEZST00gTVlfVEFCTEVgO1xuICAgKiBhd2FpdCB0cmFuc2FjdGlvbi5yb2xsYmFjayhzYXZlcG9pbnQpOyAvLyBUaGUgdHJhbnNhY3Rpb24gd2lsbCByb2xsYmFjayBiZWZvcmUgdGhlIGRlbGV0ZSwgYnV0IGFmdGVyIHRoZSBpbnNlcnRcbiAgICogYXdhaXQgc2F2ZXBvaW50LnJlbGVhc2UoKTsgLy8gVGhlIGxhc3Qgc2F2ZXBvaW50IHdpbGwgYmUgcmVtb3ZlZCwgdGhlIG9yaWdpbmFsIG9uZSB3aWxsIHJlbWFpblxuICAgKiBhd2FpdCB0cmFuc2FjdGlvbi5yb2xsYmFjayhzYXZlcG9pbnQpOyAvLyBJdCByb2xscyBiYWNrIGJlZm9yZSB0aGUgaW5zZXJ0XG4gICAqIGF3YWl0IHNhdmVwb2ludC5yZWxlYXNlKCk7IC8vIEFsbCBzYXZlcG9pbnRzIGFyZSByZWxlYXNlZFxuICAgKiBgYGBcbiAgICpcbiAgICogQ3JlYXRpbmcgYSBuZXcgc2F2ZXBvaW50IHdpdGggYW4gYWxyZWFkeSB1c2VkIG5hbWUgd2lsbCByZXR1cm4geW91IGEgcmVmZXJlbmNlIHRvXG4gICAqIHRoZSBvcmlnaW5hbCBzYXZlcG9pbnRcbiAgICogYGBgdHNcbiAgICogaW1wb3J0IHsgQ2xpZW50IH0gZnJvbSBcIi4uL2NsaWVudC50c1wiO1xuICAgKlxuICAgKiBjb25zdCBjbGllbnQgPSBuZXcgQ2xpZW50KCk7XG4gICAqIGNvbnN0IHRyYW5zYWN0aW9uID0gY2xpZW50LmNyZWF0ZVRyYW5zYWN0aW9uKFwidHJhbnNhY3Rpb25cIik7XG4gICAqXG4gICAqIGNvbnN0IHNhdmVwb2ludF9hID0gYXdhaXQgdHJhbnNhY3Rpb24uc2F2ZXBvaW50KFwiYVwiKTtcbiAgICogYXdhaXQgdHJhbnNhY3Rpb24ucXVlcnlBcnJheWBERUxFVEUgRlJPTSBNWV9UQUJMRWA7XG4gICAqIGNvbnN0IHNhdmVwb2ludF9iID0gYXdhaXQgdHJhbnNhY3Rpb24uc2F2ZXBvaW50KFwiYVwiKTsgLy8gVGhleSB3aWxsIGJlIHRoZSBzYW1lIHNhdmVwb2ludCwgYnV0IHRoZSBzYXZlcG9pbnQgd2lsbCBiZSB1cGRhdGVkIHRvIHRoaXMgcG9zaXRpb25cbiAgICogYXdhaXQgdHJhbnNhY3Rpb24ucm9sbGJhY2soc2F2ZXBvaW50X2EpOyAvLyBSb2xscyBiYWNrIHRvIHNhdmVwb2ludF9iXG4gICAqIGBgYFxuICAgKiBodHRwczovL3d3dy5wb3N0Z3Jlc3FsLm9yZy9kb2NzLzE0L3NxbC1zYXZlcG9pbnQuaHRtbFxuICAgKi9cbiAgYXN5bmMgc2F2ZXBvaW50KG5hbWU6IHN0cmluZyk6IFByb21pc2U8U2F2ZXBvaW50PiB7XG4gICAgdGhpcy4jYXNzZXJ0VHJhbnNhY3Rpb25PcGVuKCk7XG5cbiAgICBpZiAoIS9eW2EtekEtWl9dezF9W1xcd117MCw2Mn0kLy50ZXN0KG5hbWUpKSB7XG4gICAgICBpZiAoIU51bWJlci5pc05hTihOdW1iZXIobmFtZVswXSkpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIlRoZSBzYXZlcG9pbnQgbmFtZSBjYW4ndCBiZWdpbiB3aXRoIGEgbnVtYmVyXCIpO1xuICAgICAgfVxuICAgICAgaWYgKG5hbWUubGVuZ3RoID4gNjMpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIFwiVGhlIHNhdmVwb2ludCBuYW1lIGNhbid0IGJlIGxvbmdlciB0aGFuIDYzIGNoYXJhY3RlcnNcIixcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgXCJUaGUgc2F2ZXBvaW50IG5hbWUgY2FuIG9ubHkgY29udGFpbiBhbHBoYW51bWVyaWMgY2hhcmFjdGVyc1wiLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICBuYW1lID0gbmFtZS50b0xvd2VyQ2FzZSgpO1xuXG4gICAgbGV0IHNhdmVwb2ludCA9IHRoaXMuI3NhdmVwb2ludHMuZmluZCgoc3YpID0+IHN2Lm5hbWUgPT09IG5hbWUpO1xuXG4gICAgaWYgKHNhdmVwb2ludCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgc2F2ZXBvaW50LnVwZGF0ZSgpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBpZiAoZSBpbnN0YW5jZW9mIFBvc3RncmVzRXJyb3IpIHtcbiAgICAgICAgICBhd2FpdCB0aGlzLmNvbW1pdCgpO1xuICAgICAgICAgIHRocm93IG5ldyBUcmFuc2FjdGlvbkVycm9yKHRoaXMubmFtZSwgZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBzYXZlcG9pbnQgPSBuZXcgU2F2ZXBvaW50KFxuICAgICAgICBuYW1lLFxuICAgICAgICBhc3luYyAobmFtZTogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgYXdhaXQgdGhpcy5xdWVyeUFycmF5KGBTQVZFUE9JTlQgJHtuYW1lfWApO1xuICAgICAgICB9LFxuICAgICAgICBhc3luYyAobmFtZTogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgYXdhaXQgdGhpcy5xdWVyeUFycmF5KGBSRUxFQVNFIFNBVkVQT0lOVCAke25hbWV9YCk7XG4gICAgICAgIH0sXG4gICAgICApO1xuXG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCBzYXZlcG9pbnQudXBkYXRlKCk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGlmIChlIGluc3RhbmNlb2YgUG9zdGdyZXNFcnJvcikge1xuICAgICAgICAgIGF3YWl0IHRoaXMuY29tbWl0KCk7XG4gICAgICAgICAgdGhyb3cgbmV3IFRyYW5zYWN0aW9uRXJyb3IodGhpcy5uYW1lLCBlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLiNzYXZlcG9pbnRzLnB1c2goc2F2ZXBvaW50KTtcbiAgICB9XG5cbiAgICByZXR1cm4gc2F2ZXBvaW50O1xuICB9XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0EsU0FDRSxLQUFLLEVBT0wsVUFBVSxFQUNWLHFCQUFxQixRQUNoQixhQUFhO0FBQ3BCLFNBQVMsZ0JBQWdCLFFBQVEsb0JBQW9CO0FBQ3JELFNBQVMsYUFBYSxFQUFFLGdCQUFnQixRQUFRLHFCQUFxQjtBQUVyRSxPQUFPLE1BQU07O0VBQ1g7O0dBRUMsR0FDRCxDQUFDLGNBQWMsQ0FBSztFQUNwQixDQUFDLGdCQUFnQixDQUFrQztFQUNuRCxDQUFDLGVBQWUsQ0FBa0M7RUFFbEQsWUFDRSxBQUFnQixJQUFZLEVBQzVCLGVBQWdELEVBQ2hELGdCQUFpRCxDQUNqRDtTQUhnQixPQUFBO1NBTGxCLENBQUMsY0FBYyxHQUFHO0lBU2hCLElBQUksQ0FBQyxDQUFDLGdCQUFnQixHQUFHO0lBQ3pCLElBQUksQ0FBQyxDQUFDLGVBQWUsR0FBRztFQUMxQjtFQUVBLElBQUksWUFBWTtJQUNkLE9BQU8sSUFBSSxDQUFDLENBQUMsY0FBYztFQUM3QjtFQUVBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQTZCQyxHQUNELE1BQU0sVUFBVTtJQUNkLElBQUksSUFBSSxDQUFDLENBQUMsY0FBYyxLQUFLLEdBQUc7TUFDOUIsTUFBTSxJQUFJLE1BQU07SUFDbEI7SUFFQSxNQUFNLElBQUksQ0FBQyxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxJQUFJO0lBQ3RDLEVBQUUsSUFBSSxDQUFDLENBQUMsY0FBYztFQUN4QjtFQUVBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0E4QkMsR0FD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