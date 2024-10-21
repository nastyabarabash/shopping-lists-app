import { encodeArgument } from "./encode.ts";
import { decode } from "./decode.ts";
const commandTagRegexp = /^([A-Za-z]+)(?: (\d+))?(?: (\d+))?/;
export var ResultType;
(function(ResultType) {
  ResultType[ResultType["ARRAY"] = 0] = "ARRAY";
  ResultType[ResultType["OBJECT"] = 1] = "OBJECT";
})(ResultType || (ResultType = {}));
export class RowDescription {
  columnCount;
  columns;
  constructor(columnCount, columns){
    this.columnCount = columnCount;
    this.columns = columns;
  }
}
/**
 * This function transforms template string arguments into a query
 *
 * ```ts
 * ["SELECT NAME FROM TABLE WHERE ID = ", " AND DATE < "]
 * // "SELECT NAME FROM TABLE WHERE ID = $1 AND DATE < $2"
 * ```
 */ export function templateStringToQuery(template, args, result_type) {
  const text = template.reduce((curr, next, index)=>{
    return `${curr}$${index}${next}`;
  });
  return new Query(text, result_type, args);
}
function objectQueryToQueryArgs(query, args) {
  args = normalizeObjectQueryArgs(args);
  let counter = 0;
  const clean_args = [];
  const clean_query = query.replaceAll(/(?<=\$)\w+/g, (match)=>{
    match = match.toLowerCase();
    if (match in args) {
      clean_args.push(args[match]);
    } else {
      throw new Error(`No value was provided for the query argument "${match}"`);
    }
    return String(++counter);
  });
  return [
    clean_query,
    clean_args
  ];
}
/** This function lowercases all the keys of the object passed to it and checks for collission names */ function normalizeObjectQueryArgs(args) {
  const normalized_args = Object.fromEntries(Object.entries(args).map(([key, value])=>[
      key.toLowerCase(),
      value
    ]));
  if (Object.keys(normalized_args).length !== Object.keys(args).length) {
    throw new Error("The arguments provided for the query must be unique (insensitive)");
  }
  return normalized_args;
}
export class QueryResult {
  query;
  command;
  rowCount;
  /**
   * This variable will be set after the class initialization, however it's required to be set
   * in order to handle result rows coming in
   */ #row_description;
  warnings;
  get rowDescription() {
    return this.#row_description;
  }
  set rowDescription(row_description) {
    // Prevent #row_description from being changed once set
    if (row_description && !this.#row_description) {
      this.#row_description = row_description;
    }
  }
  constructor(query){
    this.query = query;
    this.warnings = [];
  }
  /**
   * This function is required to parse each column
   * of the results
   */ loadColumnDescriptions(description) {
    this.rowDescription = description;
  }
  handleCommandComplete(commandTag) {
    const match = commandTagRegexp.exec(commandTag);
    if (match) {
      this.command = match[1];
      if (match[3]) {
        // COMMAND OID ROWS
        this.rowCount = parseInt(match[3], 10);
      } else {
        // COMMAND ROWS
        this.rowCount = parseInt(match[2], 10);
      }
    }
  }
  /**
   * Add a row to the result based on metadata provided by `rowDescription`
   * This implementation depends on row description not being modified after initialization
   *
   * This function can throw on validation, so any errors must be handled in the message loop accordingly
   */ insertRow(_row) {
    throw new Error("No implementation for insertRow is defined");
  }
}
export class QueryArrayResult extends QueryResult {
  rows = [];
  insertRow(row_data) {
    if (!this.rowDescription) {
      throw new Error("The row descriptions required to parse the result data weren't initialized");
    }
    // Row description won't be modified after initialization
    const row = row_data.map((raw_value, index)=>{
      const column = this.rowDescription.columns[index];
      if (raw_value === null) {
        return null;
      }
      return decode(raw_value, column);
    });
    this.rows.push(row);
  }
}
function findDuplicatesInArray(array) {
  return array.reduce((duplicates, item, index)=>{
    const is_duplicate = array.indexOf(item) !== index;
    if (is_duplicate && !duplicates.includes(item)) {
      duplicates.push(item);
    }
    return duplicates;
  }, []);
}
function snakecaseToCamelcase(input) {
  return input.split("_").reduce((res, word, i)=>{
    if (i !== 0) {
      word = word[0].toUpperCase() + word.slice(1);
    }
    res += word;
    return res;
  }, "");
}
export class QueryObjectResult extends QueryResult {
  /**
   * The column names will be undefined on the first run of insertRow, since
   */ columns;
  rows = [];
  insertRow(row_data) {
    if (!this.rowDescription) {
      throw new Error("The row description required to parse the result data wasn't initialized");
    }
    // This will only run on the first iteration after row descriptions have been set
    if (!this.columns) {
      if (this.query.fields) {
        if (this.rowDescription.columns.length !== this.query.fields.length) {
          throw new RangeError("The fields provided for the query don't match the ones returned as a result " + `(${this.rowDescription.columns.length} expected, ${this.query.fields.length} received)`);
        }
        this.columns = this.query.fields;
      } else {
        let column_names;
        if (this.query.camelcase) {
          column_names = this.rowDescription.columns.map((column)=>snakecaseToCamelcase(column.name));
        } else {
          column_names = this.rowDescription.columns.map((column)=>column.name);
        }
        // Check field names returned by the database are not duplicated
        const duplicates = findDuplicatesInArray(column_names);
        if (duplicates.length) {
          throw new Error(`Field names ${duplicates.map((str)=>`"${str}"`).join(", ")} are duplicated in the result of the query`);
        }
        this.columns = column_names;
      }
    }
    // It's safe to assert columns as defined from now on
    const columns = this.columns;
    if (columns.length !== row_data.length) {
      throw new RangeError("The result fields returned by the database don't match the defined structure of the result");
    }
    const row = row_data.reduce((row, raw_value, index)=>{
      const current_column = this.rowDescription.columns[index];
      if (raw_value === null) {
        row[columns[index]] = null;
      } else {
        row[columns[index]] = decode(raw_value, current_column);
      }
      return row;
    }, {});
    this.rows.push(row);
  }
}
export class Query {
  args;
  camelcase;
  /**
   * The explicitly set fields for the query result, they have been validated beforehand
   * for duplicates and invalid names
   */ fields;
  // TODO
  // Should be private
  result_type;
  // TODO
  // Document that this text is the one sent to the database, not the original one
  text;
  constructor(config_or_text, result_type, args = []){
    this.result_type = result_type;
    if (typeof config_or_text === "string") {
      if (!Array.isArray(args)) {
        [config_or_text, args] = objectQueryToQueryArgs(config_or_text, args);
      }
      this.text = config_or_text;
      this.args = args.map(encodeArgument);
    } else {
      let { args = [], camelcase, encoder = encodeArgument, fields, // deno-lint-ignore no-unused-vars
      name, text } = config_or_text;
      // Check that the fields passed are valid and can be used to map
      // the result of the query
      if (fields) {
        const fields_are_clean = fields.every((field)=>/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field));
        if (!fields_are_clean) {
          throw new TypeError("The fields provided for the query must contain only letters and underscores");
        }
        if (new Set(fields).size !== fields.length) {
          throw new TypeError("The fields provided for the query must be unique");
        }
        this.fields = fields;
      }
      this.camelcase = camelcase;
      if (!Array.isArray(args)) {
        [text, args] = objectQueryToQueryArgs(text, args);
      }
      this.args = args.map(encoder);
      this.text = text;
    }
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvcG9zdGdyZXNAdjAuMTcuMC9xdWVyeS9xdWVyeS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBlbmNvZGVBcmd1bWVudCwgdHlwZSBFbmNvZGVkQXJnIH0gZnJvbSBcIi4vZW5jb2RlLnRzXCI7XG5pbXBvcnQgeyB0eXBlIENvbHVtbiwgZGVjb2RlIH0gZnJvbSBcIi4vZGVjb2RlLnRzXCI7XG5pbXBvcnQgeyB0eXBlIE5vdGljZSB9IGZyb20gXCIuLi9jb25uZWN0aW9uL21lc3NhZ2UudHNcIjtcblxuLy8gVE9ET1xuLy8gTGltaXQgdGhlIHR5cGUgb2YgcGFyYW1ldGVycyB0aGF0IGNhbiBiZSBwYXNzZWRcbi8vIHRvIGEgcXVlcnlcbi8qKlxuICogaHR0cHM6Ly93d3cucG9zdGdyZXNxbC5vcmcvZG9jcy8xNC9zcWwtcHJlcGFyZS5odG1sXG4gKlxuICogVGhpcyBhcmd1bWVudHMgd2lsbCBiZSBhcHBlbmRlZCB0byB0aGUgcHJlcGFyZWQgc3RhdGVtZW50IHBhc3NlZFxuICogYXMgcXVlcnlcbiAqXG4gKiBUaGV5IHdpbGwgdGFrZSB0aGUgcG9zaXRpb24gYWNjb3JkaW5nIHRvIHRoZSBvcmRlciBpbiB3aGljaCB0aGV5IHdlcmUgcHJvdmlkZWRcbiAqXG4gKiBgYGB0c1xuICogaW1wb3J0IHsgQ2xpZW50IH0gZnJvbSBcIi4uL2NsaWVudC50c1wiO1xuICpcbiAqIGNvbnN0IG15X2NsaWVudCA9IG5ldyBDbGllbnQoKTtcbiAqXG4gKiBhd2FpdCBteV9jbGllbnQucXVlcnlBcnJheShcIlNFTEVDVCBJRCwgTkFNRSBGUk9NIFBFT1BMRSBXSEVSRSBBR0UgPiAkMSBBTkQgQUdFIDwgJDJcIiwgW1xuICogICAxMCwgLy8gJDFcbiAqICAgMjAsIC8vICQyXG4gKiBdKTtcbiAqIGBgYFxuICovXG5leHBvcnQgdHlwZSBRdWVyeUFyZ3VtZW50cyA9IHVua25vd25bXSB8IFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuXG5jb25zdCBjb21tYW5kVGFnUmVnZXhwID0gL14oW0EtWmEtel0rKSg/OiAoXFxkKykpPyg/OiAoXFxkKykpPy87XG5cbnR5cGUgQ29tbWFuZFR5cGUgPVxuICB8IFwiSU5TRVJUXCJcbiAgfCBcIkRFTEVURVwiXG4gIHwgXCJVUERBVEVcIlxuICB8IFwiU0VMRUNUXCJcbiAgfCBcIk1PVkVcIlxuICB8IFwiRkVUQ0hcIlxuICB8IFwiQ09QWVwiO1xuXG5leHBvcnQgZW51bSBSZXN1bHRUeXBlIHtcbiAgQVJSQVksXG4gIE9CSkVDVCxcbn1cblxuZXhwb3J0IGNsYXNzIFJvd0Rlc2NyaXB0aW9uIHtcbiAgY29uc3RydWN0b3IocHVibGljIGNvbHVtbkNvdW50OiBudW1iZXIsIHB1YmxpYyBjb2x1bW5zOiBDb2x1bW5bXSkge31cbn1cblxuLyoqXG4gKiBUaGlzIGZ1bmN0aW9uIHRyYW5zZm9ybXMgdGVtcGxhdGUgc3RyaW5nIGFyZ3VtZW50cyBpbnRvIGEgcXVlcnlcbiAqXG4gKiBgYGB0c1xuICogW1wiU0VMRUNUIE5BTUUgRlJPTSBUQUJMRSBXSEVSRSBJRCA9IFwiLCBcIiBBTkQgREFURSA8IFwiXVxuICogLy8gXCJTRUxFQ1QgTkFNRSBGUk9NIFRBQkxFIFdIRVJFIElEID0gJDEgQU5EIERBVEUgPCAkMlwiXG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRlbXBsYXRlU3RyaW5nVG9RdWVyeTxUIGV4dGVuZHMgUmVzdWx0VHlwZT4oXG4gIHRlbXBsYXRlOiBUZW1wbGF0ZVN0cmluZ3NBcnJheSxcbiAgYXJnczogdW5rbm93bltdLFxuICByZXN1bHRfdHlwZTogVCxcbik6IFF1ZXJ5PFQ+IHtcbiAgY29uc3QgdGV4dCA9IHRlbXBsYXRlLnJlZHVjZSgoY3VyciwgbmV4dCwgaW5kZXgpID0+IHtcbiAgICByZXR1cm4gYCR7Y3Vycn0kJHtpbmRleH0ke25leHR9YDtcbiAgfSk7XG5cbiAgcmV0dXJuIG5ldyBRdWVyeSh0ZXh0LCByZXN1bHRfdHlwZSwgYXJncyk7XG59XG5cbmZ1bmN0aW9uIG9iamVjdFF1ZXJ5VG9RdWVyeUFyZ3MoXG4gIHF1ZXJ5OiBzdHJpbmcsXG4gIGFyZ3M6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuKTogW3N0cmluZywgdW5rbm93bltdXSB7XG4gIGFyZ3MgPSBub3JtYWxpemVPYmplY3RRdWVyeUFyZ3MoYXJncyk7XG5cbiAgbGV0IGNvdW50ZXIgPSAwO1xuICBjb25zdCBjbGVhbl9hcmdzOiB1bmtub3duW10gPSBbXTtcbiAgY29uc3QgY2xlYW5fcXVlcnkgPSBxdWVyeS5yZXBsYWNlQWxsKC8oPzw9XFwkKVxcdysvZywgKG1hdGNoKSA9PiB7XG4gICAgbWF0Y2ggPSBtYXRjaC50b0xvd2VyQ2FzZSgpO1xuICAgIGlmIChtYXRjaCBpbiBhcmdzKSB7XG4gICAgICBjbGVhbl9hcmdzLnB1c2goYXJnc1ttYXRjaF0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIGBObyB2YWx1ZSB3YXMgcHJvdmlkZWQgZm9yIHRoZSBxdWVyeSBhcmd1bWVudCBcIiR7bWF0Y2h9XCJgLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICByZXR1cm4gU3RyaW5nKCsrY291bnRlcik7XG4gIH0pO1xuXG4gIHJldHVybiBbY2xlYW5fcXVlcnksIGNsZWFuX2FyZ3NdO1xufVxuXG4vKiogVGhpcyBmdW5jdGlvbiBsb3dlcmNhc2VzIGFsbCB0aGUga2V5cyBvZiB0aGUgb2JqZWN0IHBhc3NlZCB0byBpdCBhbmQgY2hlY2tzIGZvciBjb2xsaXNzaW9uIG5hbWVzICovXG5mdW5jdGlvbiBub3JtYWxpemVPYmplY3RRdWVyeUFyZ3MoXG4gIGFyZ3M6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICBjb25zdCBub3JtYWxpemVkX2FyZ3MgPSBPYmplY3QuZnJvbUVudHJpZXMoXG4gICAgT2JqZWN0LmVudHJpZXMoYXJncykubWFwKChcbiAgICAgIFtrZXksIHZhbHVlXSxcbiAgICApID0+IFtrZXkudG9Mb3dlckNhc2UoKSwgdmFsdWVdKSxcbiAgKTtcblxuICBpZiAoT2JqZWN0LmtleXMobm9ybWFsaXplZF9hcmdzKS5sZW5ndGggIT09IE9iamVjdC5rZXlzKGFyZ3MpLmxlbmd0aCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIFwiVGhlIGFyZ3VtZW50cyBwcm92aWRlZCBmb3IgdGhlIHF1ZXJ5IG11c3QgYmUgdW5pcXVlIChpbnNlbnNpdGl2ZSlcIixcbiAgICApO1xuICB9XG5cbiAgcmV0dXJuIG5vcm1hbGl6ZWRfYXJncztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBRdWVyeU9wdGlvbnMge1xuICBhcmdzPzogUXVlcnlBcmd1bWVudHM7XG4gIGVuY29kZXI/OiAoYXJnOiB1bmtub3duKSA9PiBFbmNvZGVkQXJnO1xuICBuYW1lPzogc3RyaW5nO1xuICAvLyBUT0RPXG4gIC8vIFJlbmFtZSB0byBxdWVyeVxuICB0ZXh0OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUXVlcnlPYmplY3RPcHRpb25zIGV4dGVuZHMgUXVlcnlPcHRpb25zIHtcbiAgLy8gVE9ET1xuICAvLyBTdXBwb3J0IG11bHRpcGxlIGNhc2Ugb3B0aW9uc1xuICAvKipcbiAgICogRW5hYmxpbmcgY2FtZWxjYXNlIHdpbGwgdHJhbnNmb3JtIGFueSBzbmFrZSBjYXNlIGZpZWxkIG5hbWVzIGNvbWluZyBmcm9tIHRoZSBkYXRhYmFzZSBpbnRvIGNhbWVsIGNhc2Ugb25lc1xuICAgKlxuICAgKiBFeDogYFNFTEVDVCAxIEFTIG15X2ZpZWxkYCB3aWxsIHJldHVybiBgeyBteUZpZWxkOiAxIH1gXG4gICAqXG4gICAqIFRoaXMgd29uJ3QgaGF2ZSBhbnkgZWZmZWN0IGlmIHlvdSBleHBsaWNpdGx5IHNldCB0aGUgZmllbGQgbmFtZXMgd2l0aCB0aGUgYGZpZWxkc2AgcGFyYW1ldGVyXG4gICAqL1xuICBjYW1lbGNhc2U/OiBib29sZWFuO1xuICAvKipcbiAgICogVGhpcyBwYXJhbWV0ZXIgc3VwZXJzZWRlcyBxdWVyeSBjb2x1bW4gbmFtZXMgY29taW5nIGZyb20gdGhlIGRhdGFiYXNlcyBpbiB0aGUgb3JkZXIgdGhleSB3ZXJlIHByb3ZpZGVkLlxuICAgKiBGaWVsZHMgbXVzdCBiZSB1bmlxdWUgYW5kIGJlIGluIHRoZSByYW5nZSBvZiAoYS16QS1aMC05XyksIG90aGVyd2lzZSB0aGUgcXVlcnkgd2lsbCB0aHJvdyBiZWZvcmUgZXhlY3V0aW9uLlxuICAgKiBBIGZpZWxkIGNhbiBub3Qgc3RhcnQgd2l0aCBhIG51bWJlciwganVzdCBsaWtlIEphdmFTY3JpcHQgdmFyaWFibGVzXG4gICAqXG4gICAqIFRoaXMgc2V0dGluZyBvdmVycmlkZXMgdGhlIGNhbWVsY2FzZSBvcHRpb25cbiAgICpcbiAgICogRXg6IGBTRUxFQ1QgJ0EnLCAnQicgQVMgbXlfZmllbGRgIHdpdGggZmllbGRzIGBbXCJmaWVsZF8xXCIsIFwiZmllbGRfMlwiXWAgd2lsbCByZXR1cm4gYHsgZmllbGRfMTogXCJBXCIsIGZpZWxkXzI6IFwiQlwiIH1gXG4gICAqL1xuICBmaWVsZHM/OiBzdHJpbmdbXTtcbn1cblxuZXhwb3J0IGNsYXNzIFF1ZXJ5UmVzdWx0IHtcbiAgcHVibGljIGNvbW1hbmQhOiBDb21tYW5kVHlwZTtcbiAgcHVibGljIHJvd0NvdW50PzogbnVtYmVyO1xuICAvKipcbiAgICogVGhpcyB2YXJpYWJsZSB3aWxsIGJlIHNldCBhZnRlciB0aGUgY2xhc3MgaW5pdGlhbGl6YXRpb24sIGhvd2V2ZXIgaXQncyByZXF1aXJlZCB0byBiZSBzZXRcbiAgICogaW4gb3JkZXIgdG8gaGFuZGxlIHJlc3VsdCByb3dzIGNvbWluZyBpblxuICAgKi9cbiAgI3Jvd19kZXNjcmlwdGlvbj86IFJvd0Rlc2NyaXB0aW9uO1xuICBwdWJsaWMgd2FybmluZ3M6IE5vdGljZVtdID0gW107XG5cbiAgZ2V0IHJvd0Rlc2NyaXB0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLiNyb3dfZGVzY3JpcHRpb247XG4gIH1cblxuICBzZXQgcm93RGVzY3JpcHRpb24ocm93X2Rlc2NyaXB0aW9uOiBSb3dEZXNjcmlwdGlvbiB8IHVuZGVmaW5lZCkge1xuICAgIC8vIFByZXZlbnQgI3Jvd19kZXNjcmlwdGlvbiBmcm9tIGJlaW5nIGNoYW5nZWQgb25jZSBzZXRcbiAgICBpZiAocm93X2Rlc2NyaXB0aW9uICYmICF0aGlzLiNyb3dfZGVzY3JpcHRpb24pIHtcbiAgICAgIHRoaXMuI3Jvd19kZXNjcmlwdGlvbiA9IHJvd19kZXNjcmlwdGlvbjtcbiAgICB9XG4gIH1cblxuICBjb25zdHJ1Y3RvcihwdWJsaWMgcXVlcnk6IFF1ZXJ5PFJlc3VsdFR5cGU+KSB7fVxuXG4gIC8qKlxuICAgKiBUaGlzIGZ1bmN0aW9uIGlzIHJlcXVpcmVkIHRvIHBhcnNlIGVhY2ggY29sdW1uXG4gICAqIG9mIHRoZSByZXN1bHRzXG4gICAqL1xuICBsb2FkQ29sdW1uRGVzY3JpcHRpb25zKGRlc2NyaXB0aW9uOiBSb3dEZXNjcmlwdGlvbikge1xuICAgIHRoaXMucm93RGVzY3JpcHRpb24gPSBkZXNjcmlwdGlvbjtcbiAgfVxuXG4gIGhhbmRsZUNvbW1hbmRDb21wbGV0ZShjb21tYW5kVGFnOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBtYXRjaCA9IGNvbW1hbmRUYWdSZWdleHAuZXhlYyhjb21tYW5kVGFnKTtcbiAgICBpZiAobWF0Y2gpIHtcbiAgICAgIHRoaXMuY29tbWFuZCA9IG1hdGNoWzFdIGFzIENvbW1hbmRUeXBlO1xuICAgICAgaWYgKG1hdGNoWzNdKSB7XG4gICAgICAgIC8vIENPTU1BTkQgT0lEIFJPV1NcbiAgICAgICAgdGhpcy5yb3dDb3VudCA9IHBhcnNlSW50KG1hdGNoWzNdLCAxMCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBDT01NQU5EIFJPV1NcbiAgICAgICAgdGhpcy5yb3dDb3VudCA9IHBhcnNlSW50KG1hdGNoWzJdLCAxMCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEFkZCBhIHJvdyB0byB0aGUgcmVzdWx0IGJhc2VkIG9uIG1ldGFkYXRhIHByb3ZpZGVkIGJ5IGByb3dEZXNjcmlwdGlvbmBcbiAgICogVGhpcyBpbXBsZW1lbnRhdGlvbiBkZXBlbmRzIG9uIHJvdyBkZXNjcmlwdGlvbiBub3QgYmVpbmcgbW9kaWZpZWQgYWZ0ZXIgaW5pdGlhbGl6YXRpb25cbiAgICpcbiAgICogVGhpcyBmdW5jdGlvbiBjYW4gdGhyb3cgb24gdmFsaWRhdGlvbiwgc28gYW55IGVycm9ycyBtdXN0IGJlIGhhbmRsZWQgaW4gdGhlIG1lc3NhZ2UgbG9vcCBhY2NvcmRpbmdseVxuICAgKi9cbiAgaW5zZXJ0Um93KF9yb3c6IFVpbnQ4QXJyYXlbXSk6IHZvaWQge1xuICAgIHRocm93IG5ldyBFcnJvcihcIk5vIGltcGxlbWVudGF0aW9uIGZvciBpbnNlcnRSb3cgaXMgZGVmaW5lZFwiKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgUXVlcnlBcnJheVJlc3VsdDxUIGV4dGVuZHMgQXJyYXk8dW5rbm93bj4gPSBBcnJheTx1bmtub3duPj5cbiAgZXh0ZW5kcyBRdWVyeVJlc3VsdCB7XG4gIHB1YmxpYyByb3dzOiBUW10gPSBbXTtcblxuICBpbnNlcnRSb3cocm93X2RhdGE6IFVpbnQ4QXJyYXlbXSkge1xuICAgIGlmICghdGhpcy5yb3dEZXNjcmlwdGlvbikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBcIlRoZSByb3cgZGVzY3JpcHRpb25zIHJlcXVpcmVkIHRvIHBhcnNlIHRoZSByZXN1bHQgZGF0YSB3ZXJlbid0IGluaXRpYWxpemVkXCIsXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIFJvdyBkZXNjcmlwdGlvbiB3b24ndCBiZSBtb2RpZmllZCBhZnRlciBpbml0aWFsaXphdGlvblxuICAgIGNvbnN0IHJvdyA9IHJvd19kYXRhLm1hcCgocmF3X3ZhbHVlLCBpbmRleCkgPT4ge1xuICAgICAgY29uc3QgY29sdW1uID0gdGhpcy5yb3dEZXNjcmlwdGlvbiEuY29sdW1uc1tpbmRleF07XG5cbiAgICAgIGlmIChyYXdfdmFsdWUgPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgICByZXR1cm4gZGVjb2RlKHJhd192YWx1ZSwgY29sdW1uKTtcbiAgICB9KSBhcyBUO1xuXG4gICAgdGhpcy5yb3dzLnB1c2gocm93KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBmaW5kRHVwbGljYXRlc0luQXJyYXkoYXJyYXk6IHN0cmluZ1tdKTogc3RyaW5nW10ge1xuICByZXR1cm4gYXJyYXkucmVkdWNlKChkdXBsaWNhdGVzLCBpdGVtLCBpbmRleCkgPT4ge1xuICAgIGNvbnN0IGlzX2R1cGxpY2F0ZSA9IGFycmF5LmluZGV4T2YoaXRlbSkgIT09IGluZGV4O1xuICAgIGlmIChpc19kdXBsaWNhdGUgJiYgIWR1cGxpY2F0ZXMuaW5jbHVkZXMoaXRlbSkpIHtcbiAgICAgIGR1cGxpY2F0ZXMucHVzaChpdGVtKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZHVwbGljYXRlcztcbiAgfSwgW10gYXMgc3RyaW5nW10pO1xufVxuXG5mdW5jdGlvbiBzbmFrZWNhc2VUb0NhbWVsY2FzZShpbnB1dDogc3RyaW5nKSB7XG4gIHJldHVybiBpbnB1dFxuICAgIC5zcGxpdChcIl9cIilcbiAgICAucmVkdWNlKFxuICAgICAgKHJlcywgd29yZCwgaSkgPT4ge1xuICAgICAgICBpZiAoaSAhPT0gMCkge1xuICAgICAgICAgIHdvcmQgPSB3b3JkWzBdLnRvVXBwZXJDYXNlKCkgKyB3b3JkLnNsaWNlKDEpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVzICs9IHdvcmQ7XG4gICAgICAgIHJldHVybiByZXM7XG4gICAgICB9LFxuICAgICAgXCJcIixcbiAgICApO1xufVxuXG5leHBvcnQgY2xhc3MgUXVlcnlPYmplY3RSZXN1bHQ8XG4gIFQgPSBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbj4gZXh0ZW5kcyBRdWVyeVJlc3VsdCB7XG4gIC8qKlxuICAgKiBUaGUgY29sdW1uIG5hbWVzIHdpbGwgYmUgdW5kZWZpbmVkIG9uIHRoZSBmaXJzdCBydW4gb2YgaW5zZXJ0Um93LCBzaW5jZVxuICAgKi9cbiAgcHVibGljIGNvbHVtbnM/OiBzdHJpbmdbXTtcbiAgcHVibGljIHJvd3M6IFRbXSA9IFtdO1xuXG4gIGluc2VydFJvdyhyb3dfZGF0YTogVWludDhBcnJheVtdKSB7XG4gICAgaWYgKCF0aGlzLnJvd0Rlc2NyaXB0aW9uKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIFwiVGhlIHJvdyBkZXNjcmlwdGlvbiByZXF1aXJlZCB0byBwYXJzZSB0aGUgcmVzdWx0IGRhdGEgd2Fzbid0IGluaXRpYWxpemVkXCIsXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIFRoaXMgd2lsbCBvbmx5IHJ1biBvbiB0aGUgZmlyc3QgaXRlcmF0aW9uIGFmdGVyIHJvdyBkZXNjcmlwdGlvbnMgaGF2ZSBiZWVuIHNldFxuICAgIGlmICghdGhpcy5jb2x1bW5zKSB7XG4gICAgICBpZiAodGhpcy5xdWVyeS5maWVsZHMpIHtcbiAgICAgICAgaWYgKHRoaXMucm93RGVzY3JpcHRpb24uY29sdW1ucy5sZW5ndGggIT09IHRoaXMucXVlcnkuZmllbGRzLmxlbmd0aCkge1xuICAgICAgICAgIHRocm93IG5ldyBSYW5nZUVycm9yKFxuICAgICAgICAgICAgXCJUaGUgZmllbGRzIHByb3ZpZGVkIGZvciB0aGUgcXVlcnkgZG9uJ3QgbWF0Y2ggdGhlIG9uZXMgcmV0dXJuZWQgYXMgYSByZXN1bHQgXCIgK1xuICAgICAgICAgICAgICBgKCR7dGhpcy5yb3dEZXNjcmlwdGlvbi5jb2x1bW5zLmxlbmd0aH0gZXhwZWN0ZWQsICR7dGhpcy5xdWVyeS5maWVsZHMubGVuZ3RofSByZWNlaXZlZClgLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmNvbHVtbnMgPSB0aGlzLnF1ZXJ5LmZpZWxkcztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxldCBjb2x1bW5fbmFtZXM6IHN0cmluZ1tdO1xuICAgICAgICBpZiAodGhpcy5xdWVyeS5jYW1lbGNhc2UpIHtcbiAgICAgICAgICBjb2x1bW5fbmFtZXMgPSB0aGlzLnJvd0Rlc2NyaXB0aW9uLmNvbHVtbnMubWFwKChjb2x1bW4pID0+XG4gICAgICAgICAgICBzbmFrZWNhc2VUb0NhbWVsY2FzZShjb2x1bW4ubmFtZSlcbiAgICAgICAgICApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbHVtbl9uYW1lcyA9IHRoaXMucm93RGVzY3JpcHRpb24uY29sdW1ucy5tYXAoKGNvbHVtbikgPT5cbiAgICAgICAgICAgIGNvbHVtbi5uYW1lXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENoZWNrIGZpZWxkIG5hbWVzIHJldHVybmVkIGJ5IHRoZSBkYXRhYmFzZSBhcmUgbm90IGR1cGxpY2F0ZWRcbiAgICAgICAgY29uc3QgZHVwbGljYXRlcyA9IGZpbmREdXBsaWNhdGVzSW5BcnJheShjb2x1bW5fbmFtZXMpO1xuICAgICAgICBpZiAoZHVwbGljYXRlcy5sZW5ndGgpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICBgRmllbGQgbmFtZXMgJHtcbiAgICAgICAgICAgICAgZHVwbGljYXRlcy5tYXAoKHN0cikgPT4gYFwiJHtzdHJ9XCJgKS5qb2luKFwiLCBcIilcbiAgICAgICAgICAgIH0gYXJlIGR1cGxpY2F0ZWQgaW4gdGhlIHJlc3VsdCBvZiB0aGUgcXVlcnlgLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmNvbHVtbnMgPSBjb2x1bW5fbmFtZXM7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gSXQncyBzYWZlIHRvIGFzc2VydCBjb2x1bW5zIGFzIGRlZmluZWQgZnJvbSBub3cgb25cbiAgICBjb25zdCBjb2x1bW5zID0gdGhpcy5jb2x1bW5zITtcblxuICAgIGlmIChjb2x1bW5zLmxlbmd0aCAhPT0gcm93X2RhdGEubGVuZ3RoKSB7XG4gICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihcbiAgICAgICAgXCJUaGUgcmVzdWx0IGZpZWxkcyByZXR1cm5lZCBieSB0aGUgZGF0YWJhc2UgZG9uJ3QgbWF0Y2ggdGhlIGRlZmluZWQgc3RydWN0dXJlIG9mIHRoZSByZXN1bHRcIixcbiAgICAgICk7XG4gICAgfVxuXG4gICAgY29uc3Qgcm93ID0gcm93X2RhdGEucmVkdWNlKFxuICAgICAgKHJvdywgcmF3X3ZhbHVlLCBpbmRleCkgPT4ge1xuICAgICAgICBjb25zdCBjdXJyZW50X2NvbHVtbiA9IHRoaXMucm93RGVzY3JpcHRpb24hLmNvbHVtbnNbaW5kZXhdO1xuXG4gICAgICAgIGlmIChyYXdfdmFsdWUgPT09IG51bGwpIHtcbiAgICAgICAgICByb3dbY29sdW1uc1tpbmRleF1dID0gbnVsbDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByb3dbY29sdW1uc1tpbmRleF1dID0gZGVjb2RlKHJhd192YWx1ZSwgY3VycmVudF9jb2x1bW4pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJvdztcbiAgICAgIH0sXG4gICAgICB7fSBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICApO1xuXG4gICAgdGhpcy5yb3dzLnB1c2gocm93IGFzIFQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBRdWVyeTxUIGV4dGVuZHMgUmVzdWx0VHlwZT4ge1xuICBwdWJsaWMgYXJnczogRW5jb2RlZEFyZ1tdO1xuICBwdWJsaWMgY2FtZWxjYXNlPzogYm9vbGVhbjtcbiAgLyoqXG4gICAqIFRoZSBleHBsaWNpdGx5IHNldCBmaWVsZHMgZm9yIHRoZSBxdWVyeSByZXN1bHQsIHRoZXkgaGF2ZSBiZWVuIHZhbGlkYXRlZCBiZWZvcmVoYW5kXG4gICAqIGZvciBkdXBsaWNhdGVzIGFuZCBpbnZhbGlkIG5hbWVzXG4gICAqL1xuICBwdWJsaWMgZmllbGRzPzogc3RyaW5nW107XG4gIC8vIFRPRE9cbiAgLy8gU2hvdWxkIGJlIHByaXZhdGVcbiAgcHVibGljIHJlc3VsdF90eXBlOiBSZXN1bHRUeXBlO1xuICAvLyBUT0RPXG4gIC8vIERvY3VtZW50IHRoYXQgdGhpcyB0ZXh0IGlzIHRoZSBvbmUgc2VudCB0byB0aGUgZGF0YWJhc2UsIG5vdCB0aGUgb3JpZ2luYWwgb25lXG4gIHB1YmxpYyB0ZXh0OiBzdHJpbmc7XG4gIGNvbnN0cnVjdG9yKGNvbmZpZzogUXVlcnlPYmplY3RPcHRpb25zLCByZXN1bHRfdHlwZTogVCk7XG4gIGNvbnN0cnVjdG9yKHRleHQ6IHN0cmluZywgcmVzdWx0X3R5cGU6IFQsIGFyZ3M/OiBRdWVyeUFyZ3VtZW50cyk7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGNvbmZpZ19vcl90ZXh0OiBzdHJpbmcgfCBRdWVyeU9iamVjdE9wdGlvbnMsXG4gICAgcmVzdWx0X3R5cGU6IFQsXG4gICAgYXJnczogUXVlcnlBcmd1bWVudHMgPSBbXSxcbiAgKSB7XG4gICAgdGhpcy5yZXN1bHRfdHlwZSA9IHJlc3VsdF90eXBlO1xuICAgIGlmICh0eXBlb2YgY29uZmlnX29yX3RleHQgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgIGlmICghQXJyYXkuaXNBcnJheShhcmdzKSkge1xuICAgICAgICBbY29uZmlnX29yX3RleHQsIGFyZ3NdID0gb2JqZWN0UXVlcnlUb1F1ZXJ5QXJncyhjb25maWdfb3JfdGV4dCwgYXJncyk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMudGV4dCA9IGNvbmZpZ19vcl90ZXh0O1xuICAgICAgdGhpcy5hcmdzID0gYXJncy5tYXAoZW5jb2RlQXJndW1lbnQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsZXQge1xuICAgICAgICBhcmdzID0gW10sXG4gICAgICAgIGNhbWVsY2FzZSxcbiAgICAgICAgZW5jb2RlciA9IGVuY29kZUFyZ3VtZW50LFxuICAgICAgICBmaWVsZHMsXG4gICAgICAgIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tdW51c2VkLXZhcnNcbiAgICAgICAgbmFtZSxcbiAgICAgICAgdGV4dCxcbiAgICAgIH0gPSBjb25maWdfb3JfdGV4dDtcblxuICAgICAgLy8gQ2hlY2sgdGhhdCB0aGUgZmllbGRzIHBhc3NlZCBhcmUgdmFsaWQgYW5kIGNhbiBiZSB1c2VkIHRvIG1hcFxuICAgICAgLy8gdGhlIHJlc3VsdCBvZiB0aGUgcXVlcnlcbiAgICAgIGlmIChmaWVsZHMpIHtcbiAgICAgICAgY29uc3QgZmllbGRzX2FyZV9jbGVhbiA9IGZpZWxkcy5ldmVyeSgoZmllbGQpID0+XG4gICAgICAgICAgL15bYS16QS1aX11bYS16QS1aMC05X10qJC8udGVzdChmaWVsZClcbiAgICAgICAgKTtcbiAgICAgICAgaWYgKCFmaWVsZHNfYXJlX2NsZWFuKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgICAgIFwiVGhlIGZpZWxkcyBwcm92aWRlZCBmb3IgdGhlIHF1ZXJ5IG11c3QgY29udGFpbiBvbmx5IGxldHRlcnMgYW5kIHVuZGVyc2NvcmVzXCIsXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChuZXcgU2V0KGZpZWxkcykuc2l6ZSAhPT0gZmllbGRzLmxlbmd0aCkge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAgICAgICBcIlRoZSBmaWVsZHMgcHJvdmlkZWQgZm9yIHRoZSBxdWVyeSBtdXN0IGJlIHVuaXF1ZVwiLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmZpZWxkcyA9IGZpZWxkcztcbiAgICAgIH1cblxuICAgICAgdGhpcy5jYW1lbGNhc2UgPSBjYW1lbGNhc2U7XG5cbiAgICAgIGlmICghQXJyYXkuaXNBcnJheShhcmdzKSkge1xuICAgICAgICBbdGV4dCwgYXJnc10gPSBvYmplY3RRdWVyeVRvUXVlcnlBcmdzKHRleHQsIGFyZ3MpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLmFyZ3MgPSBhcmdzLm1hcChlbmNvZGVyKTtcbiAgICAgIHRoaXMudGV4dCA9IHRleHQ7XG4gICAgfVxuICB9XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5n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