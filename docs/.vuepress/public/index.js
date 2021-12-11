var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __markAsModule = (target) => __defProp(target, "__esModule", { value: true });
var __export = (target, all) => {
  __markAsModule(target);
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __reExport = (target, module2, desc) => {
  if (module2 && typeof module2 === "object" || typeof module2 === "function") {
    for (let key of __getOwnPropNames(module2))
      if (!__hasOwnProp.call(target, key) && key !== "default")
        __defProp(target, key, { get: () => module2[key], enumerable: !(desc = __getOwnPropDesc(module2, key)) || desc.enumerable });
  }
  return target;
};
var __toModule = (module2) => {
  return __reExport(__markAsModule(__defProp(module2 != null ? __create(__getProtoOf(module2)) : {}, "default", module2 && module2.__esModule && "default" in module2 ? { get: () => module2.default, enumerable: true } : { value: module2, enumerable: true })), module2);
};
var __accessCheck = (obj, member, msg) => {
  if (!member.has(obj))
    throw TypeError("Cannot " + msg);
};
var __privateGet = (obj, member, getter) => {
  __accessCheck(obj, member, "read from private field");
  return getter ? getter.call(obj) : member.get(obj);
};
var __privateAdd = (obj, member, value) => {
  if (member.has(obj))
    throw TypeError("Cannot add the same private member more than once");
  member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
};
var __privateSet = (obj, member, value, setter) => {
  __accessCheck(obj, member, "write to private field");
  setter ? setter.call(obj, value) : member.set(obj, value);
  return value;
};

// src/index.ts
__export(exports, {
  AndOperator: () => AndOperator,
  ArrayType: () => ArrayType,
  AssertionOperator: () => AssertionOperator,
  AssertionOperatorWrapper: () => AssertionOperatorWrapper,
  BetweenOperator: () => BetweenOperator,
  BooleanNotNullType: () => BooleanNotNullType,
  BooleanType: () => BooleanType,
  ComputeValueGetterDefinition: () => ComputeValueGetterDefinition2,
  ComputeValueGetterDefinitionDynamicReturn: () => ComputeValueGetterDefinitionDynamicReturn2,
  ComputeProperty: () => ComputeProperty,
  ConditionOperator: () => ConditionOperator,
  DBActionRunnerBase: () => DBActionRunnerBase,
  DBMutationRunner: () => DBMutationRunner,
  DBQueryRunner: () => DBQueryRunner,
  DScalar: () => DScalar,
  DatabaseContext: () => DatabaseContext4,
  Dataset: () => Dataset2,
  DateNotNullType: () => DateNotNullType,
  DateTimeNotNullType: () => DateTimeNotNullType,
  DateTimeType: () => DateTimeType,
  DateType: () => DateType,
  DecimalNotNullType: () => DecimalNotNullType,
  DecimalType: () => DecimalType,
  DeleteStatement: () => DeleteStatement,
  DerivedDatasource: () => DerivedDatasource,
  DerivedTableSchema: () => DerivedTableSchema,
  EqualOperator: () => EqualOperator,
  ExistsOperator: () => ExistsOperator,
  ExpressionResolver: () => ExpressionResolver2,
  FieldProperty: () => FieldProperty,
  FieldPropertyType: () => FieldPropertyType,
  GreaterThanOperator: () => GreaterThanOperator,
  GreaterThanOrEqualsOperator: () => GreaterThanOrEqualsOperator,
  Hook: () => Hook2,
  InOperator: () => InOperator,
  InsertStatement: () => InsertStatement,
  IsNotNullOperator: () => IsNotNullOperator,
  IsNullOperator: () => IsNullOperator,
  LeftAndRightAssertionOperator: () => LeftAndRightAssertionOperator,
  LessThanOperator: () => LessThanOperator,
  LessThanOrEqualsOperator: () => LessThanOrEqualsOperator,
  LikeOperator: () => LikeOperator,
  Model: () => Model,
  ModelRepository: () => ModelRepository,
  NotBetweenOperator: () => NotBetweenOperator,
  NotEqualOperator: () => NotEqualOperator,
  NotInOperator: () => NotInOperator,
  NotLikeOperator: () => NotLikeOperator,
  NotOperator: () => NotOperator,
  NumberNotNullType: () => NumberNotNullType,
  NumberType: () => NumberType,
  ORM: () => ORM,
  ObjectType: () => ObjectType,
  OrOperator: () => OrOperator,
  ParsablePropertyTypeDefinition: () => ParsablePropertyTypeDefinition,
  PrimaryKeyType: () => PrimaryKeyType,
  Property: () => Property,
  PropertyType: () => PropertyType,
  Scalar: () => Scalar,
  ScalarProperty: () => ScalarProperty,
  Schema: () => Schema,
  SimpleObjectClass: () => SimpleObjectClass,
  StringNotNullType: () => StringNotNullType,
  StringType: () => StringType,
  TableDatasource: () => TableDatasource,
  TableSchema: () => TableSchema,
  UpdateStatement: () => UpdateStatement,
  camelize: () => camelize,
  constructSqlKeywords: () => constructSqlKeywords,
  expand: () => expand,
  expandRecursively: () => expandRecursively,
  isArrayOfStrings: () => isArrayOfStrings,
  isFunction: () => isFunction,
  isScalarMap: () => isScalarMap,
  makeid: () => makeid,
  notEmpty: () => notEmpty,
  parseName: () => parseName,
  quote: () => quote,
  resolveValueIntoScalar: () => resolveValueIntoScalar,
  thenResult: () => thenResult,
  thenResultArray: () => thenResultArray,
  undoExpandRecursively: () => undoExpandRecursively
});
var import_knex = __toModule(require("knex"));
var fs = __toModule(require("fs"));

// src/util.ts
function undoExpandRecursively(o) {
  return o;
}
function expandRecursively(o) {
  return o;
}
function expand(o) {
  return o;
}
var SimpleObjectClass = {}.constructor;
function notEmpty(value) {
  return value !== null && value !== void 0;
}
function thenResultArray(value, fn, errorFn) {
  if (!Array.isArray(value)) {
    throw new Error("It is not an array");
  }
  if (value.some((v) => v instanceof Promise)) {
    return Promise.all(value).then(fn, errorFn);
  }
  return fn(value);
}
function thenResult(value, fn, errorFn) {
  if (value instanceof Promise) {
    return value.then(fn, errorFn);
  }
  return fn(value);
}
var quote = (client, name) => {
  const c = client;
  if (c.startsWith("sqlite") || c.startsWith("mysql")) {
    return `\`${name.replace(/`/g, "``")}\``;
  } else if (c.startsWith("pg")) {
    return `"${name.replace(/"/g, '""')}"`;
  }
  throw new Error("Unsupport client");
};
function camelize(str) {
  return str.replace(/(?:^\w|[A-Z]|\b\w)/g, function(word, index) {
    return index === 0 ? word.toLowerCase() : word.toUpperCase();
  }).replace(/\s+/g, "");
}
function makeid(length) {
  const result = [];
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890";
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result.push(characters.charAt(Math.floor(Math.random() * charactersLength)));
  }
  return result.join("");
}
var parseName = (item) => {
  const text = item.toString().trim();
  const e = /((?<![\\])[`'"])((?:.(?!(?<![\\])\1))*.?)\1/g;
  let r = e.exec(text);
  if (r) {
    let last = r[0];
    while (r = e.exec(text)) {
      last = r[0];
    }
    return last;
  } else {
    const e2 = /\b[. ]+([a-zA-Z0-9_$]*)$/;
    const r2 = e2.exec(text);
    if (r2 && r2[1]) {
      return r2[1];
    } else {
      return text;
    }
  }
};
function isFunction(funcOrClass) {
  const propertyNames = Object.getOwnPropertyNames(funcOrClass);
  return !propertyNames.includes("prototype") || propertyNames.includes("arguments");
}
function isArrayOfStrings(arr) {
  return arr.every((item) => typeof item === "string");
}
function isScalarMap(obj) {
  if (typeof obj === "object") {
    const keys = Object.keys(obj);
    for (const key in keys) {
      if (obj[keys[key]] instanceof Scalar) {
        return true;
      }
    }
  }
  return false;
}

// src/types.ts
var nullableText = (nullable) => nullable ? "NULL" : "NOT NULL";
var autoIncrement = (client) => client.startsWith("sqlite") ? "AUTOINCREMENT" : "AUTO_INCREMENT";
var jsonArrayAgg = (client) => {
  if (client.startsWith("sqlite"))
    return "JSON_GROUP_ARRAY";
  else if (client.startsWith("mysql"))
    return "JSON_ARRAYAGG";
  else if (client.startsWith("pg"))
    return "JSON_AGG";
  else
    throw new Error("NYI");
};
var jsonArray = (client, arrayOfColNames = []) => {
  if (client.startsWith("sqlite")) {
    return `JSON_ARRAY(${arrayOfColNames.join(",")})`;
  } else if (client.startsWith("mysql")) {
    return `JSON_ARRAY(${arrayOfColNames.join(",")})`;
  } else if (client.startsWith("pg")) {
    return `JSON_BUILD_ARRAY(${arrayOfColNames.join(",")})`;
  } else
    throw new Error("NYI");
};
var PropertyType = class {
  constructor(options) {
    this.options = {};
    this.options = this.options ?? options;
  }
  get nullable() {
    return true;
  }
  async prepareForParsing(context) {
  }
  parseRaw(rawValue, context, prop) {
    return rawValue;
  }
  parseProperty(propertyvalue, context, prop) {
    return propertyvalue;
  }
  transformQuery(rawOrDataset, context, singleColumnName) {
    if (rawOrDataset instanceof Dataset2) {
      if (rawOrDataset.selectItemsAlias().length === 1) {
        return thenResult(rawOrDataset.toNativeBuilder(context), (query) => context.raw(`(${query})`));
      }
      throw new Error("Only Dataset with single column can be transformed.");
    }
    return rawOrDataset;
  }
};
var FieldPropertyType = class extends PropertyType {
  constructor(options) {
    super(options);
  }
};
var ParsablePropertyTypeDefinition = class extends PropertyType {
  constructor(options) {
    super(options);
  }
};
var PrimaryKeyType = class extends FieldPropertyType {
  constructor(options) {
    super(options);
  }
  get nullable() {
    return false;
  }
  create(propName, fieldName, context) {
    const client = context.client();
    if (client.startsWith("pg")) {
      return [
        [
          `${quote(client, fieldName)}`,
          "SERIAL",
          nullableText(false),
          "PRIMARY KEY"
        ].join(" ")
      ];
    } else {
      return [
        [
          `${quote(client, fieldName)}`,
          "INTEGER",
          nullableText(false),
          "PRIMARY KEY",
          autoIncrement(client)
        ].join(" ")
      ];
    }
  }
};
var NumberType = class extends FieldPropertyType {
  constructor(options = {}) {
    super(options);
    this.options = options;
  }
  get nullable() {
    return true;
  }
  parseRaw(rawValue) {
    if (rawValue === null)
      return null;
    return parseInt(rawValue);
  }
  create(propName, fieldName, context) {
    const client = context.client();
    return [
      [
        `${quote(client, fieldName)}`,
        "INTEGER",
        nullableText(this.nullable),
        this.options?.default !== void 0 ? `DEFAULT ${this.options?.default}` : ""
      ].join(" ")
    ];
  }
};
var NumberNotNullType = class extends FieldPropertyType {
  constructor(options = {}) {
    super(options);
    this.options = options;
  }
  get nullable() {
    return false;
  }
  parseRaw(rawValue) {
    if (rawValue === null)
      throw new Error("Cannot null");
    return parseInt(rawValue);
  }
  create(propName, fieldName, context) {
    const client = context.client();
    return [
      [
        `${quote(client, fieldName)}`,
        "INTEGER",
        nullableText(this.nullable),
        this.options?.default !== void 0 ? `DEFAULT ${this.options?.default}` : ""
      ].join(" ")
    ];
  }
};
var DecimalType = class extends FieldPropertyType {
  constructor(options = {}) {
    super();
    this.options = { ...options };
  }
  get nullable() {
    return true;
  }
  parseRaw(rawValue) {
    return rawValue === null ? null : parseFloat(rawValue);
  }
  create(propName, fieldName, context) {
    const client = context.client();
    const c = [this.options.precision, this.options.scale].filter((v) => v).join(",");
    return [
      [
        `${quote(client, fieldName)}`,
        `DECIMAL${c.length > 0 ? `(${c})` : ""}`,
        nullableText(this.nullable),
        this.options?.default !== void 0 ? `DEFAULT ${this.options?.default}` : ""
      ].join(" ")
    ];
  }
};
var DecimalNotNullType = class extends FieldPropertyType {
  constructor(options = {}) {
    super();
    this.options = { ...options };
  }
  get nullable() {
    return false;
  }
  parseRaw(rawValue) {
    if (rawValue === null) {
      throw new Error("value should not be null");
    }
    return parseFloat(rawValue);
  }
  create(propName, fieldName, context) {
    const client = context.client();
    const c = [this.options.precision, this.options.scale].filter((v) => v).join(",");
    return [
      [
        `${quote(client, fieldName)}`,
        `DECIMAL${c.length > 0 ? `(${c})` : ""}`,
        nullableText(this.nullable),
        this.options?.default !== void 0 ? `DEFAULT ${this.options?.default}` : ""
      ].join(" ")
    ];
  }
};
var BooleanType = class extends FieldPropertyType {
  constructor(options = {}) {
    super();
    this.options = { ...options };
  }
  get nullable() {
    return true;
  }
  parseRaw(rawValue, context, propName) {
    if (rawValue === null)
      return null;
    else if (rawValue === true)
      return true;
    else if (rawValue === false)
      return false;
    else if (Number.isInteger(rawValue)) {
      return parseInt(rawValue) > 0;
    }
    throw new Error("Cannot parse Raw into Boolean");
  }
  parseProperty(propertyvalue, context, propName) {
    if (propertyvalue === null && !this.nullable) {
      throw new Error(`The Property '${propName}' cannot be null.`);
    }
    if (context.client().startsWith("pg")) {
      return propertyvalue === null ? null : !!propertyvalue;
    } else {
      return propertyvalue === null ? null : propertyvalue ? "1" : "0";
    }
  }
  create(propName, fieldName, context) {
    const client = context.client();
    return [
      [
        `${quote(client, fieldName)}`,
        client.startsWith("pg") ? "BOOLEAN" : `TINYINT(1)`,
        nullableText(this.nullable),
        this.options?.default !== void 0 ? `DEFAULT ${this.options?.default}` : ""
      ].join(" ")
    ];
  }
};
var BooleanNotNullType = class extends FieldPropertyType {
  constructor(options = {}) {
    super();
    this.options = { ...options };
  }
  get nullable() {
    return true;
  }
  parseRaw(rawValue, context, propName) {
    if (rawValue === null)
      throw new Error("Not expected null");
    else if (rawValue === true)
      return true;
    else if (rawValue === false)
      return false;
    else if (Number.isInteger(rawValue)) {
      return parseInt(rawValue) > 0;
    }
    throw new Error("Cannot parse Raw into Boolean");
  }
  parseProperty(propertyvalue, context, propName) {
    if (propertyvalue === null && !this.nullable) {
      throw new Error(`The Property '${propName}' cannot be null.`);
    }
    if (context.client().startsWith("pg")) {
      return propertyvalue === null ? null : !!propertyvalue;
    } else {
      return propertyvalue === null ? null : propertyvalue ? "1" : "0";
    }
  }
  create(propName, fieldName, context) {
    const client = context.client();
    return [
      [
        `${quote(client, fieldName)}`,
        client.startsWith("pg") ? "BOOLEAN" : `TINYINT(1)`,
        nullableText(this.nullable),
        this.options?.default !== void 0 ? `DEFAULT ${this.options?.default}` : ""
      ].join(" ")
    ];
  }
};
var StringType = class extends FieldPropertyType {
  constructor(options = {}) {
    super();
    this.options = { ...options };
  }
  get nullable() {
    return true;
  }
  create(propName, fieldName, context) {
    const client = context.client();
    let length = this.options.length;
    if (client.startsWith("mysql")) {
      if (!length) {
        length = 255;
      }
    }
    const c = [length].filter((v) => v).join(",");
    return [
      [
        `${quote(client, fieldName)}`,
        `VARCHAR${c.length > 0 ? `(${c})` : ""}`,
        nullableText(this.nullable),
        this.options?.default !== void 0 ? `DEFAULT ${this.options?.default}` : ""
      ].join(" ")
    ];
  }
};
var StringNotNullType = class extends FieldPropertyType {
  constructor(options = {}) {
    super();
    this.options = { ...options };
  }
  get nullable() {
    return false;
  }
  create(propName, fieldName, context) {
    const client = context.client();
    let length = this.options.length;
    if (client.startsWith("mysql")) {
      if (!length) {
        length = 255;
      }
    }
    const c = [length].filter((v) => v).join(",");
    return [
      [
        `${quote(client, fieldName)}`,
        `VARCHAR${c.length > 0 ? `(${c})` : ""}`,
        nullableText(this.nullable),
        this.options?.default !== void 0 ? `DEFAULT ${this.options?.default}` : ""
      ].join(" ")
    ];
  }
};
var DateType = class extends FieldPropertyType {
  constructor(options = {}) {
    super();
    this.options = { ...options };
  }
  get nullable() {
    return true;
  }
  parseRaw(rawValue) {
    return rawValue === null ? null : new Date(rawValue);
  }
  parseProperty(propertyvalue, context, propName) {
    if (propertyvalue === null && !this.nullable) {
      throw new Error(`The Property '${propName}' cannot be null.`);
    }
    return propertyvalue;
  }
  create(propName, fieldName, context) {
    const client = context.client();
    return [
      [
        `${quote(client, fieldName)}`,
        `DATE`,
        nullableText(this.nullable),
        this.options?.default !== void 0 ? `DEFAULT ${this.parseProperty(this.options?.default, context)}` : ""
      ].join(" ")
    ];
  }
};
var DateNotNullType = class extends FieldPropertyType {
  constructor(options = {}) {
    super();
    this.options = { ...options };
  }
  get nullable() {
    return false;
  }
  parseRaw(rawValue) {
    if (rawValue === null) {
      throw new Error("Unexpected null value");
    }
    return new Date(rawValue);
  }
  parseProperty(propertyvalue, context, propName) {
    if (propertyvalue === null && !this.nullable) {
      throw new Error(`The Property '${propName}' cannot be null.`);
    }
    return propertyvalue;
  }
  create(propName, fieldName, context) {
    const client = context.client();
    return [
      [
        `${quote(client, fieldName)}`,
        `DATE`,
        nullableText(this.nullable),
        this.options?.default !== void 0 ? `DEFAULT ${this.parseProperty(this.options?.default, context)}` : ""
      ].join(" ")
    ];
  }
};
var DateTimeType = class extends FieldPropertyType {
  constructor(options = {}) {
    super();
    this.options = { ...options };
  }
  get nullable() {
    return true;
  }
  parseRaw(rawValue) {
    return rawValue === null ? null : new Date(rawValue);
  }
  parseProperty(propertyvalue, context, propName) {
    if (propertyvalue === null && !this.nullable) {
      throw new Error(`The Property '${propName}' cannot be null.`);
    }
    return propertyvalue;
  }
  create(propName, fieldName, context) {
    const client = context.client();
    const c = [this.options.precision].filter((v) => v).join(",");
    return [
      [
        `${quote(client, fieldName)}`,
        client.startsWith("pg") ? `TIMESTAMP${c.length > 0 ? `(${c})` : ""}` : `DATETIME${c.length > 0 ? `(${c})` : ""}`,
        nullableText(this.nullable),
        this.options?.default !== void 0 ? `DEFAULT ${this.parseProperty(this.options?.default, context, propName)}` : ""
      ].join(" ")
    ];
  }
};
var DateTimeNotNullType = class extends FieldPropertyType {
  constructor(options = {}) {
    super();
    this.options = { ...options };
  }
  get nullable() {
    return false;
  }
  parseRaw(rawValue) {
    return new Date(rawValue);
  }
  parseProperty(propertyvalue, context, propName) {
    if (propertyvalue === null && !this.nullable) {
      throw new Error(`The Property '${propName}' cannot be null.`);
    }
    return propertyvalue;
  }
  create(propName, fieldName, context) {
    const client = context.client();
    const c = [this.options.precision].filter((v) => v).join(",");
    return [
      [
        `${quote(client, fieldName)}`,
        client.startsWith("pg") ? `TIMESTAMP${c.length > 0 ? `(${c})` : ""}` : `DATETIME${c.length > 0 ? `(${c})` : ""}`,
        nullableText(this.nullable),
        this.options?.default !== void 0 ? `DEFAULT ${this.parseProperty(this.options?.default, context, propName)}` : ""
      ].join(" ")
    ];
  }
};
var ObjectType = class extends ParsablePropertyTypeDefinition {
  constructor(parsable) {
    super();
    this.parsable = parsable;
  }
  get nullable() {
    return true;
  }
  async prepareForParsing(context) {
    await super.prepareForParsing(context);
    await this.parsable.prepareForParsing(context);
  }
  transformQuery(rawOrDataset, context, singleColumnName) {
    if (!(rawOrDataset instanceof Dataset2)) {
      throw new Error("Only Dataset can be the type of 'ObjectOfEntity'");
    }
    const selectedColumns = rawOrDataset.selectItemsAlias();
    const columns = this.parsable.columnsForParsing();
    if (columns.some((col) => !selectedColumns.includes(col))) {
      throw new Error("Dataset selected column cannot be parsed. Missing Selected Items.");
    }
    return thenResult(rawOrDataset.toNativeBuilder(context), (query) => {
      const client = context.client();
      const jsonify = `SELECT ${jsonArray(client, columns.map((col) => quote(client, col)))} AS ${quote(client, "data")} FROM (${query}) AS ${quote(client, makeid(5))}`;
      return context.raw(`(${jsonify})`);
    });
  }
  parseRaw(rawValue, context, propName) {
    if (rawValue === null) {
      return rawValue;
    } else {
      let parsed = null;
      if (typeof rawValue === "string") {
        parsed = JSON.parse(rawValue);
      } else if (Array.isArray(rawValue)) {
        parsed = rawValue;
      }
      if (Array.isArray(parsed)) {
        const header = this.parsable.columnsForParsing();
        const rowData = parsed;
        const numCols = header.length;
        const parsableEntity = this.parsable;
        const record = {};
        for (let j = 0; j < numCols; j++) {
          record[header[j]] = rowData[j];
        }
        return parsableEntity.parseRaw(record, context);
      }
    }
    throw new Error("It is not supported.");
  }
  parseProperty(propertyvalue, context, propName) {
    return this.parsable.parseProperty(propertyvalue, context);
  }
};
var ArrayType = class extends ParsablePropertyTypeDefinition {
  constructor(parsable) {
    super();
    this.parsable = parsable;
  }
  get nullable() {
    return true;
  }
  async prepareForParsing(context) {
    await super.prepareForParsing(context);
    await this.parsable.prepareForParsing(context);
  }
  transformQuery(rawOrDataset, context, singleColumnName) {
    if (!(rawOrDataset instanceof Dataset2)) {
      throw new Error("Only Dataset can be the type of 'ObjectOfEntity'");
    }
    const selectedColumns = rawOrDataset.selectItemsAlias();
    const columns = this.parsable.columnsForParsing();
    if (columns.some((col) => !selectedColumns.includes(col))) {
      throw new Error("Dataset selected column cannot be parsed. Missing Selected Items.");
    }
    return thenResult(rawOrDataset.toNativeBuilder(context), (query) => {
      const client = context.client();
      const jsonify = `SELECT coalesce(${jsonArrayAgg(client)}(${jsonArray(client, columns.map((col) => quote(client, col)))}), ${jsonArray(client)}) AS ${quote(client, "data")} FROM (${query}) AS ${quote(client, makeid(5))}`;
      return context.raw(`(${jsonify})`);
    });
  }
  parseRaw(rawValue, context, propName) {
    if (rawValue === null) {
      return rawValue;
    } else {
      let parsed = null;
      if (typeof rawValue === "string") {
        parsed = JSON.parse(rawValue);
      } else if (Array.isArray(rawValue)) {
        parsed = rawValue;
      }
      if (Array.isArray(parsed)) {
        const header = this.parsable.columnsForParsing();
        const rowData = parsed;
        const numCols = header.length;
        const len = rowData.length;
        const parsableEntity = this.parsable;
        const records = new Array(len);
        for (let i = 0; i < len; i++) {
          const record = {};
          for (let j = 0; j < numCols; j++) {
            record[header[j]] = rowData[i][j];
          }
          records[i] = parsableEntity.parseRaw(record, context);
        }
        return records;
      }
    }
    throw new Error("It is not supported.");
  }
  parseProperty(propertyvalue, context, propName) {
    return this.parsable.parseProperty(propertyvalue, context);
  }
};

// src/sqlkeywords.ts
var ConditionOperator = class {
  constructor(context, resolver) {
    this.context = context;
    this.resolver = resolver;
  }
  getContext() {
    return this.context;
  }
  toSqlString(context) {
    return this.toScalar().toRaw(context ?? (this.getContext() ?? void 0)).toString();
  }
};
var AssertionOperator = class {
  toSqlString(context) {
    return this.toScalar().toRaw(context ?? (this.getContext() ?? void 0)).toString();
  }
};
var LeftAndRightAssertionOperator = class extends AssertionOperator {
  constructor(context, leftOperand, ...rightOperands) {
    super();
    this.context = context;
    this.rightOperands = rightOperands;
    this.leftOperand = leftOperand;
  }
  getContext() {
    return this.context;
  }
  toScalar() {
    return new Scalar((context) => {
      return thenResultArray(this.rightOperands.map((s) => resolveValueIntoScalar(s).toRaw(context)), (rights) => {
        return thenResult(resolveValueIntoScalar(this.leftOperand).toRaw(context), (left) => {
          return this.leftAndRightToRaw(context, left, ...rights);
        });
      });
    }, new BooleanNotNullType());
  }
};
var AndOperator = class extends ConditionOperator {
  constructor(context, resolver, ...args) {
    super(context, resolver);
    this.args = args;
  }
  toScalar() {
    return new Scalar((context) => {
      if (this.args.length === 0) {
        return context.raw("1");
      }
      const items = this.args.map((arg) => this.resolver.resolve(arg).toRaw(context));
      return thenResultArray(items, (items2) => context.raw(items2.join(" AND ")));
    }, new BooleanNotNullType());
  }
};
var OrOperator = class extends ConditionOperator {
  constructor(context, resolver, ...args) {
    super(context, resolver);
    this.args = args;
  }
  toScalar() {
    return new Scalar((context) => {
      if (this.args.length === 0) {
        return context.raw("1");
      }
      const items = this.args.map((arg) => this.resolver.resolve(arg).toRaw(context));
      return thenResultArray(items, (items2) => context.raw(items2.join(" OR ")));
    }, new BooleanNotNullType());
  }
};
var NotOperator = class extends ConditionOperator {
  constructor(context, resolver, arg) {
    super(context, resolver);
    this.arg = arg;
  }
  toScalar() {
    return new Scalar((context) => {
      return thenResult(this.resolver.resolve(this.arg).toRaw(context), (k) => context.raw(`NOT (${k.toString()})`));
    }, new BooleanNotNullType());
  }
};
var ExistsOperator = class extends ConditionOperator {
  constructor(context, resolver, arg) {
    super(context, resolver);
    this.arg = arg;
  }
  toScalar() {
    return new Scalar((context) => {
      return thenResult(this.arg.toNativeBuilder(context), (k) => context.raw(`EXISTS (${k.toString()})`));
    }, new BooleanNotNullType());
  }
};
var InOperator = class extends LeftAndRightAssertionOperator {
  leftAndRightToRaw(context, left, ...rights) {
    return context.raw(`${left} IN (${rights.map((o) => "?")})`, [...rights]);
  }
};
var NotInOperator = class extends LeftAndRightAssertionOperator {
  leftAndRightToRaw(context, left, ...rights) {
    return context.raw(`${left} NOT IN (${rights.map((o) => "?")})`, [...rights]);
  }
};
var LikeOperator = class extends LeftAndRightAssertionOperator {
  constructor(context, leftOperand, rightOperand) {
    super(context, leftOperand, rightOperand);
  }
  leftAndRightToRaw(context, left, ...rights) {
    return context.raw(`${left} LIKE ?`, [rights[0]]);
  }
};
var NotLikeOperator = class extends LeftAndRightAssertionOperator {
  constructor(context, leftOperand, rightOperand) {
    super(context, leftOperand, rightOperand);
  }
  leftAndRightToRaw(context, left, ...rights) {
    return context.raw(`${left} NOT LIKE ?`, [rights[0]]);
  }
};
var EqualOperator = class extends LeftAndRightAssertionOperator {
  constructor(context, leftOperand, rightOperand) {
    super(context, leftOperand, rightOperand);
  }
  leftAndRightToRaw(context, left, ...rights) {
    return context.raw(`${left} = ?`, [rights[0]]);
  }
};
var NotEqualOperator = class extends LeftAndRightAssertionOperator {
  constructor(context, leftOperand, rightOperand) {
    super(context, leftOperand, rightOperand);
  }
  leftAndRightToRaw(context, left, ...rights) {
    return context.raw(`${left} <> ?`, [rights[0]]);
  }
};
var IsNullOperator = class extends LeftAndRightAssertionOperator {
  constructor(context, leftOperand) {
    super(context, leftOperand);
  }
  leftAndRightToRaw(context, left) {
    return context.raw(`${left} IS NULL`);
  }
};
var IsNotNullOperator = class extends LeftAndRightAssertionOperator {
  constructor(context, leftOperand) {
    super(context, leftOperand);
  }
  leftAndRightToRaw(context, left) {
    return context.raw(`${left} IS NOT NULL`);
  }
};
var GreaterThanOperator = class extends LeftAndRightAssertionOperator {
  constructor(context, leftOperand, rightOperand) {
    super(context, leftOperand, rightOperand);
  }
  leftAndRightToRaw(context, left, ...rights) {
    return context.raw(`${left} > ?`, [rights[0]]);
  }
};
var LessThanOperator = class extends LeftAndRightAssertionOperator {
  constructor(context, leftOperand, rightOperand) {
    super(context, leftOperand, rightOperand);
  }
  leftAndRightToRaw(context, left, ...rights) {
    return context.raw(`${left} < ?`, [rights[0]]);
  }
};
var GreaterThanOrEqualsOperator = class extends LeftAndRightAssertionOperator {
  constructor(context, leftOperand, rightOperand) {
    super(context, leftOperand, rightOperand);
  }
  leftAndRightToRaw(context, left, ...rights) {
    return context.raw(`${left} >= ?`, [rights[0]]);
  }
};
var LessThanOrEqualsOperator = class extends LeftAndRightAssertionOperator {
  constructor(context, leftOperand, rightOperand) {
    super(context, leftOperand, rightOperand);
  }
  leftAndRightToRaw(context, left, ...rights) {
    return context.raw(`${left} <= ?`, [rights[0]]);
  }
};
var BetweenOperator = class extends LeftAndRightAssertionOperator {
  constructor(context, leftOperand, rightOperand1, rightOperand2) {
    super(context, leftOperand, rightOperand1, rightOperand2);
  }
  leftAndRightToRaw(context, left, ...rights) {
    return context.raw(`${left} BETWEEN ? AND ?`, [rights[0], rights[1]]);
  }
};
var NotBetweenOperator = class extends LeftAndRightAssertionOperator {
  constructor(context, leftOperand, rightOperand1, rightOperand2) {
    super(context, leftOperand, rightOperand1, rightOperand2);
  }
  leftAndRightToRaw(context, left, ...rights) {
    return context.raw(`${left} NOT BETWEEN ? AND ?`, [rights[0], rights[1]]);
  }
};
var _func;
var AssertionOperatorWrapper = class {
  constructor(func) {
    __privateAdd(this, _func, void 0);
    __privateSet(this, _func, func);
  }
  toScalar(left) {
    return __privateGet(this, _func).call(this, left).toScalar();
  }
};
_func = new WeakMap();
function constructSqlKeywords(resolver, context = null) {
  const sqlkeywords = {
    And: (...conditions) => new AndOperator(context, resolver, ...conditions).toScalar(),
    Or: (...conditions) => new OrOperator(context, resolver, ...conditions).toScalar(),
    Not: (condition) => new NotOperator(context, resolver, condition).toScalar(),
    Exists: (dataset) => new ExistsOperator(context, resolver, dataset).toScalar(),
    Like: (right) => new AssertionOperatorWrapper((left) => new LikeOperator(context, left, resolveValueIntoScalar(right))),
    NotLike: (right) => new AssertionOperatorWrapper((left) => new NotLikeOperator(context, left, resolveValueIntoScalar(right))),
    Now: () => new Scalar((context2) => {
      const client = context2.client();
      if (client.startsWith("sqlite")) {
        return { sql: `strftime('%s','now')` };
      } else {
        return { sql: "NOW()" };
      }
    }, DateTimeNotNullType),
    Case: (target, whenThens, elseValue) => new Scalar(() => {
      if (whenThens.length === 0) {
        throw new Error("There must be at least one When case");
      }
      return {
        sql: ` CASE ? ${whenThens.map((w) => `WHEN ? THEN ?`).join(" ")} ELSE ? END `,
        args: [resolver.resolve(target), ...whenThens.flatMap((w) => [resolver.resolve(w.when), resolver.resolve(w.then)]), resolver.resolve(elseValue)]
      };
    }),
    If: (onCondition, thenValue, elseValue) => new Scalar((context2) => {
      return context2.$.Case(onCondition, [
        { when: true, then: thenValue }
      ], elseValue);
    })
  };
  return sqlkeywords;
}

// src/schema.ts
var _name;
var Property = class {
  constructor() {
    __privateAdd(this, _name, void 0);
  }
  register(name) {
    if (/[.`' ]/.test(name) || name.startsWith("_") || name.endsWith("_")) {
      throw new Error(`The name '${name}' of the NamedProperty is invalid. It cannot contains "'" or startsWith/endsWith '_'.`);
    }
    __privateSet(this, _name, name);
  }
  get name() {
    if (!__privateGet(this, _name)) {
      throw new Error("Property not yet registered");
    }
    return __privateGet(this, _name);
  }
};
_name = new WeakMap();
var ComputeProperty = class extends Property {
  constructor(compute) {
    super();
    this.compute = compute;
  }
  async prepareForParsing(context) {
  }
};
var _definitionConstructor, _definition;
var FieldProperty = class extends Property {
  constructor(definition) {
    super();
    __privateAdd(this, _definitionConstructor, void 0);
    __privateAdd(this, _definition, null);
    __privateSet(this, _definitionConstructor, definition);
  }
  get definition() {
    if (!__privateGet(this, _definition)) {
      let definition = null;
      if (__privateGet(this, _definitionConstructor) instanceof PropertyType) {
        definition = __privateGet(this, _definitionConstructor);
      } else if (isFunction(__privateGet(this, _definitionConstructor))) {
        definition = __privateGet(this, _definitionConstructor).call(this);
      } else if (__privateGet(this, _definitionConstructor) instanceof Function) {
        const c = __privateGet(this, _definitionConstructor);
        definition = new c();
      }
      if (definition instanceof PropertyType) {
        __privateSet(this, _definition, definition);
      } else
        throw new Error("Invalid parameters");
    }
    return __privateGet(this, _definition);
  }
  async prepareForParsing(context) {
    await this.definition.prepareForParsing(context);
  }
  convertFieldName(propName, orm) {
    const c = orm.ormConfig.propNameTofieldName;
    return c ? c(propName) : propName;
  }
  fieldName(orm) {
    if (this._fieldName) {
      return this._fieldName;
    }
    return this.convertFieldName(this.name, orm);
  }
  setFieldName(value) {
    this._fieldName = value;
    return this;
  }
};
_definitionConstructor = new WeakMap();
_definition = new WeakMap();
var ScalarProperty = class extends Property {
  constructor(scalar) {
    super();
    this.scalar = scalar;
  }
  async prepareForParsing(context) {
    await (await this.scalar.getDefinition(context)).prepareForParsing(context);
  }
};
var Schema = class {
  constructor(props) {
    this.properties = [];
    this.propertiesMap = {};
    Object.keys(props).forEach((key) => {
      const prop = props[key];
      if (prop instanceof Property) {
        prop.register(key);
        this.propertiesMap[key] = prop;
        this.properties.push(prop);
      } else {
        throw new Error("Not expected");
      }
    });
  }
  columnsForParsing() {
    return this.properties.map((prop) => prop.name);
  }
  async prepareForParsing(context) {
    await Promise.all(this.properties.map(async (prop) => {
      await prop.prepareForParsing(context);
    }));
  }
  parseRaw(rawValue, context, prop) {
    return this.parseDataBySchema(rawValue, context);
  }
  parseProperty(propertyvalue, context, prop) {
    return propertyvalue;
  }
  parseDataBySchema(row, context) {
    const schema = this;
    const output = {};
    for (const propName in row) {
      const p = schema.propertiesMap[propName];
      if (p) {
        if (p instanceof ScalarProperty) {
          const propType = p.scalar.definitionForParsing();
          const propValue = propType.parseRaw ? propType.parseRaw(row[propName], context, propName) : row[propName];
          Object.defineProperty(output, propName, {
            configurable: true,
            enumerable: true,
            writable: true,
            value: propValue
          });
        }
      }
    }
    return output;
  }
};
var DerivedTableSchema = class extends Schema {
  constructor(dataset) {
    const selectItems = dataset.selectItems();
    if (!selectItems) {
      throw new Error("No selectItems for a schema");
    }
    const propertyMap = Object.keys(selectItems).reduce((acc, key) => {
      acc[key] = new ScalarProperty(selectItems[key]);
      return acc;
    }, {});
    super(propertyMap);
    this.dataset = dataset;
  }
  datasource(name) {
    const source = new DerivedDatasource(this.dataset, name);
    return source;
  }
};
var _entityName;
var TableSchema = class extends Schema {
  constructor(entityName, props, id) {
    super(props);
    this.hooks = [];
    __privateAdd(this, _entityName, void 0);
    __privateSet(this, _entityName, entityName);
    this.id = id;
  }
  tableName(context, options) {
    if (this.overridedTableName) {
      return this.overridedTableName;
    } else {
      let name = __privateGet(this, _entityName);
      if (context.orm.ormConfig.entityNameToTableName) {
        name = context.orm.ormConfig.entityNameToTableName(name);
      }
      if (options?.tablePrefix) {
        name = options.tablePrefix + name;
      } else if (context.config?.tablePrefix) {
        name = context.config?.tablePrefix + name;
      }
      return name;
    }
  }
  setTableName(name) {
    this.overridedTableName = name;
    return this;
  }
  createTableStmt(context, options) {
    const client = context.client();
    const tableName = this.tableName(context, options);
    const props = this.properties.filter((p) => p instanceof FieldProperty);
    return `CREATE TABLE IF NOT EXISTS ${quote(client, tableName)} (
${props.map((prop) => {
      const f = prop.definition;
      if (f instanceof FieldPropertyType) {
        return `${f.create(prop.name, prop.fieldName(context.orm), context)}`;
      }
      return ``;
    }).join(",\n")}
)`;
  }
  datasource(name, options) {
    const source = new TableDatasource(this, name, options);
    return source;
  }
};
_entityName = new WeakMap();
var DatasourceBase = class {
  constructor(schema, sourceAlias) {
    if (!Number.isInteger(sourceAlias.charAt(0)) && sourceAlias.charAt(0).toUpperCase() === sourceAlias.charAt(0)) {
      throw new Error("alias cannot start with Uppercase letter");
    }
    this._schema = schema;
    this.sourceAlias = sourceAlias;
    this.sourceAliasAndSalt = makeid(5);
    const datasource = this;
    this.$ = new Proxy(datasource, {
      get: (oTarget, sKey) => {
        if (typeof sKey === "string") {
          if (sKey === "$allFields") {
            return datasource.getAllFieldProperty();
          } else {
            const prop = oTarget._schema.propertiesMap[sKey];
            if (prop instanceof FieldProperty) {
              return datasource.getFieldProperty(sKey);
            }
            if (prop instanceof ComputeProperty) {
              return datasource.getComputeProperty(sKey);
            }
            if (prop instanceof ScalarProperty) {
              return datasource.getScalarProperty(sKey);
            }
          }
        }
      }
    });
  }
  schema() {
    return this._schema;
  }
  getAllFieldProperty() {
    return Object.keys(this._schema.propertiesMap).reduce((acc, key) => {
      if (this._schema.propertiesMap[key] instanceof FieldProperty) {
        acc[key] = this.getFieldProperty(key);
      }
      return acc;
    }, {});
  }
  getFieldProperty(name) {
    const prop = this._schema.propertiesMap[name];
    if (!(prop instanceof FieldProperty)) {
      throw new Error(`it is not field property ${name}`);
    } else {
      const fieldProp = prop;
      return new Scalar((context) => {
        const orm = context.orm;
        const client = context.client();
        const rawTxt = `${quote(client, this.sourceAliasAndSalt)}.${quote(client, fieldProp.fieldName(orm))}`;
        return context.raw(rawTxt);
      }, fieldProp.definition);
    }
  }
  getComputeProperty(name) {
    const prop = this._schema.propertiesMap[name];
    if (!(prop instanceof ComputeProperty)) {
      throw new Error(`Not field property ${name}`);
    } else {
      const cProp = prop;
      const c = (args) => {
        const subquery = cProp.compute.fn.call(cProp, this, args);
        return subquery;
      };
      return c;
    }
  }
  getScalarProperty(name) {
    const prop = this._schema.propertiesMap[name];
    if (!(prop instanceof ScalarProperty)) {
      throw new Error(`it is not field property ${name}`);
    } else {
      const fieldProp = prop;
      return new Scalar(fieldProp.scalar, null);
    }
  }
  async toRaw(context) {
    const client = context.client();
    const sql = await this.realSource(context);
    return context.raw(`${sql} AS ${quote(client, this.sourceAliasAndSalt)}`);
  }
};
var TableDatasource = class extends DatasourceBase {
  constructor(schema, sourceAlias, options) {
    super(schema, sourceAlias);
    this.options = options;
  }
  schema() {
    return this._schema;
  }
  realSource(context) {
    const finalOptions = Object.assign({}, { tablePrefix: context.tablePrefix }, this.options ?? {});
    const tableName = this.schema().tableName(context, finalOptions);
    if (!tableName) {
      throw new Error("Not yet registered");
    }
    return quote(context.client(), tableName);
  }
};
var DerivedDatasource = class extends DatasourceBase {
  constructor(dataset, sourceAlias) {
    super(dataset.schema(), sourceAlias);
    this.dataset = dataset;
  }
  async realSource(context) {
    return `(${await this.dataset.toNativeBuilder(context)})`;
  }
};

// src/builder.ts
var StatementBase = class {
  constructor(context) {
    this.context = null;
    this.context = context;
  }
  async scalarMap2RawMap(targetSchema, nameMap, context) {
    const client = context.client();
    return await Object.keys(nameMap).reduce(async (accP, k) => {
      const acc = await accP;
      const prop = targetSchema.propertiesMap[k];
      if (prop instanceof FieldProperty) {
        const scalar = nameMap[k];
        if (!scalar) {
          throw new Error(`cannot resolve field ${k}`);
        }
        const raw = await scalar.toRaw(context);
        let text = raw.toString().trim();
        if (text.includes(" ") && !(text.startsWith("(") && text.endsWith(")"))) {
          text = `(${text})`;
        }
        acc[prop.fieldName(context.orm)] = context.raw(text);
      }
      return acc;
    }, Promise.resolve({}));
  }
};
var WhereClauseBase = class extends StatementBase {
  constructor() {
    super(...arguments);
    this.fromItem = void 0;
    this.joinItems = [];
    this.whereRawItem = void 0;
  }
  getSelectorMap() {
    const sources = this.joinItems.map((item) => item.source);
    if (this.fromItem) {
      sources.push(this.fromItem);
    }
    const selectorMap = sources.reduce((acc, source) => {
      const t = source.sourceAlias;
      acc[t] = source.$;
      return acc;
    }, {});
    return selectorMap;
  }
  getFrom() {
    return this.fromItem;
  }
  getWhere() {
    return this.whereRawItem;
  }
  baseWhere(expression) {
    this.whereRawItem = expression;
    return this;
  }
  baseFrom(source) {
    this.fromItem = source;
    return this;
  }
  baseInnerJoin(source, expression) {
    this.joinItems.push({
      type: "inner",
      source,
      expression
    });
    return this;
  }
  baseLeftJoin(source, expression) {
    this.joinItems.push({
      type: "left",
      source,
      expression
    });
    return this;
  }
  baseRightJoin(source, expression) {
    this.joinItems.push({
      type: "right",
      source,
      expression
    });
    return this;
  }
  async buildWhereClause(context, nativeQB) {
    const selectorMap = this.getSelectorMap();
    const resolver = new ExpressionResolver2(selectorMap, this.fromItem, this.joinItems.map((item) => item.source));
    Object.assign(selectorMap, constructSqlKeywords(resolver, this.context));
    await this.joinItems.reduce(async (acc, item) => {
      await acc;
      const finalExpr = await resolver.resolve(item.expression).toRaw(context);
      if (item.type === "inner") {
        nativeQB.innerJoin(await item.source.toRaw(context), finalExpr);
      } else if (item.type === "left") {
        nativeQB.leftJoin(await item.source.toRaw(context), finalExpr);
      } else if (item.type === "right") {
        nativeQB.rightJoin(await item.source.toRaw(context), finalExpr);
      }
      return true;
    }, Promise.resolve(true));
    if (this.whereRawItem) {
      const where = await resolver.resolve(this.whereRawItem).toRaw(context);
      nativeQB.where(where);
    }
  }
  cloneFrom(source) {
    this.fromItem = source.fromItem;
    this.joinItems = source.joinItems;
    this.whereRawItem = source.whereRawItem;
  }
};
var _selectItems, _orderByItems, _groupByItems, _limit, _offset;
var Dataset2 = class extends WhereClauseBase {
  constructor(context) {
    super(context);
    this.datasetSchema = null;
    __privateAdd(this, _selectItems, null);
    __privateAdd(this, _orderByItems, null);
    __privateAdd(this, _groupByItems, null);
    __privateAdd(this, _limit, null);
    __privateAdd(this, _offset, null);
    this.nativeBuilderCallbacks = [];
    this.context = context ?? null;
  }
  func2ScalarMap(named) {
    let nameMap;
    const selectorMap = this.getSelectorMap();
    const resolver = new ExpressionResolver2(selectorMap, this.fromItem, this.joinItems.map((item) => item.source));
    if (named instanceof Function) {
      Object.assign(selectorMap, constructSqlKeywords(resolver, this.context));
      const map = Object.assign({}, this.getSelectorMap(), constructSqlKeywords(resolver, this.context));
      nameMap = named(map);
    } else {
      nameMap = named;
    }
    const result = Object.keys(nameMap).reduce((acc, key) => {
      acc[key] = resolver.resolve(nameMap[key]);
      return acc;
    }, {});
    return result;
  }
  func2ScalarArray(named) {
    let nameMap;
    const selectorMap = this.getSelectorMap();
    const resolver = new ExpressionResolver2(selectorMap, this.fromItem, this.joinItems.map((item) => item.source));
    if (named instanceof Function) {
      Object.assign(selectorMap, constructSqlKeywords(resolver, this.context));
      const map = Object.assign({}, this.getSelectorMap(), constructSqlKeywords(resolver, this.context));
      nameMap = named(map);
    } else {
      nameMap = named;
    }
    return nameMap;
  }
  func2OrderItemArray(named) {
    let nameMap;
    const selectorMap = this.getSelectorMap();
    const resolver = new ExpressionResolver2(selectorMap, this.fromItem, this.joinItems.map((item) => item.source));
    if (named instanceof Function) {
      Object.assign(selectorMap, constructSqlKeywords(resolver, this.context));
      const map = Object.assign({}, this.getSelectorMap(), constructSqlKeywords(resolver, this.context));
      nameMap = named(map);
    } else {
      nameMap = named;
    }
    return nameMap.map((item) => {
      if (item instanceof Scalar) {
        return {
          value: item,
          order: "asc"
        };
      } else if (typeof item === "string") {
        const p = this.propNameArray2ScalarMap([item]);
        return {
          value: Object.values(p)[0],
          order: "asc"
        };
      } else {
        const pair = item;
        if (typeof pair.value === "string") {
          const p = this.propNameToScalar(selectorMap, pair.value);
          const value = Object.values(p)[0];
          return {
            value,
            order: pair.order
          };
        } else if (pair.value instanceof Scalar) {
          return {
            value: pair.value,
            order: pair.order
          };
        } else {
          throw new Error("Not allowed");
        }
      }
    });
  }
  propNameToScalar(selectorMap, key) {
    const map = selectorMap;
    let [source, field] = key.split(".");
    let item = null;
    if (!field) {
      field = source;
      if (!this.fromItem) {
        throw new Error(`There must be a FROM`);
      }
      const from = this.fromItem.$;
      item = from[field];
    } else {
      item = map[source][field];
    }
    if (!item) {
      throw new Error(`Cannot resolve field ${key}`);
    } else if (item instanceof Scalar) {
      return { [field]: item };
    } else {
      return { [field]: item() };
    }
  }
  propNameArray2ScalarMap(properties) {
    const map = this.getSelectorMap();
    const fields = properties;
    const nameMap = fields.reduce((acc, key) => {
      const keypair = this.propNameToScalar(map, key);
      acc = Object.assign({}, acc, keypair);
      return acc;
    }, {});
    return nameMap;
  }
  async queryScalarMap2RawArray(nameMap, context, includeAlias) {
    const client = context.client();
    return await Promise.all(Object.keys(nameMap).map(async (k) => {
      const scalar = nameMap[k];
      if (!scalar) {
        throw new Error(`cannot resolve field ${k}`);
      }
      const raw = await scalar.toRaw(context);
      let text = raw.toString().trim();
      if (text.includes(" ") && !(text.startsWith("(") && text.endsWith(")"))) {
        text = `(${text})`;
      }
      const newRaw = context.raw(`${text}${includeAlias ? ` AS ${quote(client, k)}` : ""}`);
      return newRaw;
    }));
  }
  async queryScalarArray2RawArray(nameMap, context) {
    const client = context.client();
    return await Promise.all(nameMap.map(async (k) => {
      const scalar = k;
      if (!scalar) {
        throw new Error(`cannot resolve field ${k}`);
      }
      const raw = await scalar.toRaw(context);
      let text = raw.toString().trim();
      if (text.includes(" ") && !(text.startsWith("(") && text.endsWith(")"))) {
        text = `(${text})`;
      }
      const newRaw = context.raw(`${text}`);
      return newRaw;
    }));
  }
  async orderByScalarArray2RawArray(nameMap, context) {
    const client = context.client();
    return await Promise.all(nameMap.map(async (k) => {
      const pair = k;
      if (!pair) {
        throw new Error(`cannot resolve field ${k}`);
      }
      const raw = await pair.value.toRaw(context);
      let text = raw.toString().trim();
      if (text.includes(" ") && !(text.startsWith("(") && text.endsWith(")"))) {
        text = `(${text})`;
      }
      const newRaw = context.raw(`${text} ${pair.order.toLowerCase() === "desc" ? "desc" : "asc"}`);
      return newRaw;
    }));
  }
  clearSchema() {
    this.datasetSchema = null;
  }
  toDataset() {
    return this;
  }
  selectItemsAlias() {
    if (!__privateGet(this, _selectItems)) {
      return [];
    }
    const selectItems = __privateGet(this, _selectItems);
    return Object.keys(selectItems);
  }
  native(nativeBuilderCallback) {
    this.nativeBuilderCallbacks = [];
    this.addNative(nativeBuilderCallback);
    return this;
  }
  addNative(nativeBuilderCallback) {
    this.nativeBuilderCallbacks.push(nativeBuilderCallback);
    return this;
  }
  toDScalar() {
    return this.toDScalarWithArrayType();
  }
  toDScalarWithArrayType() {
    const a = new ArrayType(this.schema());
    return new DScalar(this, a, this.context);
  }
  toDScalarWithObjectType() {
    const o = new ObjectType(this.schema());
    return new DScalar(this, o, this.context);
  }
  toDScalarWithType(type) {
    if (type instanceof PropertyType) {
      return new DScalar(this, type, this.context);
    } else if (isFunction(type)) {
      return new DScalar(this, type(this), this.context);
    } else {
      return new DScalar(this, new type(), this.context);
    }
  }
  where(expression) {
    return this.baseWhere(expression);
  }
  andWhere(expression) {
    const prevWhere = this.getWhere();
    if (prevWhere === void 0) {
      return this.baseWhere(expression);
    } else {
      const prev = prevWhere;
      const newExpression = ({ And }) => And(prev, expression);
      return this.baseWhere(newExpression);
    }
  }
  from(source) {
    return this.baseFrom(source);
  }
  innerJoin(source, expression) {
    return this.baseInnerJoin(source, expression);
  }
  leftJoin(source, expression) {
    return this.baseLeftJoin(source, expression);
  }
  rightJoin(source, expression) {
    return this.baseRightJoin(source, expression);
  }
  select(...args) {
    if (args.length === 0) {
      throw new Error("select must have at least one argument");
    }
    if (args.length === 1 && (isScalarMap(args[0]) || args[0] instanceof Function)) {
      const named = args[0];
      this.clearSchema();
      const result = this.func2ScalarMap(named);
      __privateSet(this, _selectItems, result);
      return this;
    } else if (isArrayOfStrings(args)) {
      const properties = args;
      this.clearSchema();
      __privateSet(this, _selectItems, this.propNameArray2ScalarMap(properties));
      return this;
    }
    throw new Error("cannot handle unexpected arguments");
  }
  andSelect(...args) {
    if (args.length === 0) {
      throw new Error("select must have at least one argument");
    }
    if (args.length === 1 && (isScalarMap(args[0]) || args[0] instanceof Function)) {
      const named = args[0];
      this.clearSchema();
      const result = this.func2ScalarMap(named);
      __privateSet(this, _selectItems, Object.assign({}, __privateGet(this, _selectItems), result));
      return this;
    } else if (isArrayOfStrings(args)) {
      const properties = args;
      this.clearSchema();
      __privateSet(this, _selectItems, Object.assign({}, __privateGet(this, _selectItems), this.propNameArray2ScalarMap(properties)));
      return this;
    }
    throw new Error("cannot handle unexpected arguments");
  }
  groupBy(...args) {
    if (args.length === 0) {
      throw new Error("select must have at least one argument");
    }
    if (args.length === 1 && (isScalarMap(args[0]) || args[0] instanceof Function)) {
      const named = args[0];
      const result = this.func2ScalarArray(named);
      __privateSet(this, _groupByItems, result);
      return this;
    } else if (isArrayOfStrings(args)) {
      const properties = args;
      const dict = this.propNameArray2ScalarMap(properties);
      __privateSet(this, _groupByItems, Object.keys(dict).map((k) => dict[k]));
      return this;
    }
  }
  orderBy(...args) {
    if (args.length !== 1) {
      throw new Error("must be one argument");
    }
    const resolved = this.func2OrderItemArray(args[0]);
    __privateSet(this, _orderByItems, resolved);
    return this;
  }
  limit(limit) {
    __privateSet(this, _limit, limit);
    return this;
  }
  offset(offset) {
    __privateSet(this, _offset, offset);
    return this;
  }
  datasource(name) {
    return this.schema().datasource(name);
  }
  schema() {
    if (!this.datasetSchema) {
      this.datasetSchema = new DerivedTableSchema(this);
    }
    return this.datasetSchema;
  }
  selectItems() {
    return __privateGet(this, _selectItems);
  }
  async toSqlString(ctx) {
    let b = await this.toNativeBuilder(ctx);
    return b.toString();
  }
  async toNativeBuilder(ctx) {
    const context = ctx ?? this.context;
    if (!context) {
      throw new Error("There is no repository provided for dataset");
    }
    const nativeQB = context.orm.getKnexInstance().clearSelect();
    nativeQB.then = "It is overridden. Then function is removed to prevent execution when it is passing accross the async functions";
    if (!__privateGet(this, _selectItems) || Object.keys(__privateGet(this, _selectItems)).length === 0) {
      throw new Error("Not selectItems");
    }
    if (this.fromItem) {
      const from = await this.fromItem.toRaw(context);
      nativeQB.from(from);
    }
    await this.buildWhereClause(context, nativeQB);
    if (__privateGet(this, _offset)) {
      nativeQB.offset(__privateGet(this, _offset));
    }
    if (__privateGet(this, _limit)) {
      nativeQB.limit(__privateGet(this, _limit));
    }
    if (__privateGet(this, _selectItems)) {
      const selectItems = await this.queryScalarMap2RawArray(__privateGet(this, _selectItems), context, true);
      if (selectItems.length === 0 && !this.fromItem) {
        throw new Error("No SELECT and FROM are provided for Dataset");
      }
      nativeQB.select(selectItems);
    }
    if (__privateGet(this, _groupByItems)) {
      const groupByItems = await this.queryScalarArray2RawArray(__privateGet(this, _groupByItems), context);
      if (groupByItems.length === 0) {
        throw new Error("No groupByItems");
      }
      nativeQB.groupByRaw(groupByItems.map((item) => item.toString()).join(","));
    }
    if (__privateGet(this, _orderByItems)) {
      const orderByItems = await this.orderByScalarArray2RawArray(__privateGet(this, _orderByItems), context);
      if (orderByItems.length === 0) {
        throw new Error("No groupByItems");
      }
      nativeQB.orderByRaw(orderByItems.map((item) => item.toString()).join(","));
    }
    await Promise.all(this.nativeBuilderCallbacks.map(async (callback) => {
      await callback(nativeQB);
    }));
    return nativeQB;
  }
  execute(ctx) {
    const context = ctx ?? this.context;
    if (!context) {
      throw new Error("There is no repository provided.");
    }
    const current = this;
    return new DBQueryRunner(current, context, async function(executionOptions) {
      const nativeSql = await current.toNativeBuilder(this.context);
      const data = await this.context.executeStatement(nativeSql, {}, executionOptions);
      let rows;
      if (this.context.client().startsWith("mysql")) {
        rows = data[0];
      } else if (this.context.client().startsWith("sqlite")) {
        rows = data;
      } else if (this.context.client().startsWith("pg")) {
        rows = data.rows;
      } else {
        throw new Error("Unsupport client.");
      }
      if (!Array.isArray(rows)) {
        throw new Error("Unexpected.");
      }
      const len = rows.length;
      const schema = current.schema();
      await schema.prepareForParsing(this.context);
      const parsedRows = new Array(len);
      for (let i = 0; i < len; i++) {
        parsedRows[i] = schema.parseRaw(rows[i], this.context);
      }
      return parsedRows;
    });
  }
};
_selectItems = new WeakMap();
_orderByItems = new WeakMap();
_groupByItems = new WeakMap();
_limit = new WeakMap();
_offset = new WeakMap();
var _insertIntoSchema, _insertItems;
var InsertStatement = class extends StatementBase {
  constructor(insertToSchema, context) {
    super(context);
    __privateAdd(this, _insertIntoSchema, void 0);
    __privateAdd(this, _insertItems, null);
    __privateSet(this, _insertIntoSchema, insertToSchema);
  }
  values(arrayOfkeyValues) {
    let arrayOfNameMap;
    const selectorMap = {};
    const resolver = new ExpressionResolver2(selectorMap, void 0, []);
    if (arrayOfkeyValues instanceof Function) {
      Object.assign(selectorMap, this.sqlKeywords(resolver));
      const map = Object.assign({}, constructSqlKeywords(resolver, this.context));
      arrayOfNameMap = arrayOfkeyValues(map);
    } else {
      arrayOfNameMap = arrayOfkeyValues;
    }
    __privateSet(this, _insertItems, arrayOfNameMap.map((nameMap) => Object.keys(nameMap).reduce((acc, key) => {
      acc[key] = resolver.resolve(nameMap[key]);
      return acc;
    }, {})));
    return this;
  }
  async toNativeBuilder(ctx) {
    return this.toNativeBuilderWithSpecificRow(null, ctx);
  }
  async toNativeBuilderWithSpecificRow(atRowIdx, ctx) {
    const context = ctx ?? this.context;
    if (!context) {
      throw new Error("There is no repository provided.");
    }
    let nativeQB = context.orm.getKnexInstance().from(__privateGet(this, _insertIntoSchema).tableName(context));
    nativeQB.then = "It is overridden. Then function is removed to prevent execution when it is passing accross the async functions";
    if (!__privateGet(this, _insertItems)) {
      throw new Error("No insert Items");
    }
    const targetSchema = __privateGet(this, _insertIntoSchema);
    const schemaPrimaryKeyFieldName = targetSchema.id.fieldName(context.orm);
    const filteredInsertItems = atRowIdx === null ? __privateGet(this, _insertItems) : [__privateGet(this, _insertItems)[atRowIdx]];
    const insertItems = await Promise.all(filteredInsertItems.map(async (insertItem) => await this.scalarMap2RawMap(__privateGet(this, _insertIntoSchema), Object.assign({}, insertItem), context)));
    nativeQB.insert(insertItems);
    if (context.client().startsWith("pg")) {
      nativeQB = nativeQB.returning(schemaPrimaryKeyFieldName);
    }
    return nativeQB;
  }
  getInsertItems() {
    return __privateGet(this, _insertItems);
  }
  execute(context) {
    const ctx = context ?? this.context;
    if (!ctx) {
      throw new Error("There is no repository provided.");
    }
    const statement = this;
    return new DBMutationRunner(ctx, async function(executionOptions) {
      if (!statement.getInsertItems()) {
        throw new Error("Unexpected");
      }
      return await this.context.startTransaction(async (trx) => {
        executionOptions = { ...executionOptions, trx };
        const executionFuncton = async () => {
          if (!this.latestQueryAffectedFunctionArg || this.context.client().startsWith("pg")) {
            const queryBuilder = await statement.toNativeBuilder(this.context);
            const insertStmt = queryBuilder.toString();
            const r = await this.context.executeStatement(insertStmt, {}, executionOptions);
            if (this.context.client().startsWith("pg")) {
              return r.rows.map((r2) => ({ id: r2.id }));
            } else {
              return null;
            }
          } else {
            if (this.context.client().startsWith("mysql")) {
              let insertedId;
              return await Promise.all(statement.getInsertItems().map(async (item, idx) => {
                const queryBuilder = await statement.toNativeBuilderWithSpecificRow(idx, this.context);
                const insertStmt = queryBuilder.toString();
                const r = await this.context.executeStatement(insertStmt, {}, executionOptions);
                insertedId = r[0].insertId;
                return { id: insertedId };
              }));
            } else if (this.context.client().startsWith("sqlite")) {
              return await statement.getInsertItems().reduce(async (preAcc, item, idx) => {
                const acc = await preAcc;
                const queryBuilder = await statement.toNativeBuilderWithSpecificRow(idx, this.context);
                const insertStmt = queryBuilder.toString();
                await this.context.executeStatement(insertStmt, {}, executionOptions);
                const result = await this.context.executeStatement("SELECT last_insert_rowid() AS id", {}, executionOptions);
                acc.push({ id: result[0].id });
                return acc;
              }, Promise.resolve([]));
            } else {
              throw new Error("Unsupport client");
            }
          }
        };
        const insertedIds = await executionFuncton();
        if (this.latestQueryAffectedFunctionArg) {
          const queryAffectedFunctionArg = this.latestQueryAffectedFunctionArg;
          const queryAffectedFunction = async () => {
            const i = insertedIds;
            const schema = __privateGet(statement, _insertIntoSchema);
            const queryDataset = this.context.dataset().from(schema.datasource("root")).where(({ root }) => root.id.in(i.map((r) => r.id))).select(({ root }) => root.$allFields);
            const finalDs = await queryAffectedFunctionArg(queryDataset);
            const result = await finalDs.execute().withOptions(executionOptions);
            return result;
          };
          this.affectedResult = await queryAffectedFunction();
        }
        return insertedIds;
      }, executionOptions.trx);
    });
  }
};
_insertIntoSchema = new WeakMap();
_insertItems = new WeakMap();
var _updateItems;
var UpdateStatement = class extends WhereClauseBase {
  constructor(ctx) {
    super(ctx);
    __privateAdd(this, _updateItems, null);
  }
  from(source) {
    return this.baseFrom(source);
  }
  where(expression) {
    return this.baseWhere(expression);
  }
  innerJoin(source, expression) {
    return this.baseInnerJoin(source, expression);
  }
  leftJoin(source, expression) {
    return this.baseLeftJoin(source, expression);
  }
  rightJoin(source, expression) {
    return this.baseRightJoin(source, expression);
  }
  set(keyValues) {
    let nameMap;
    const selectorMap = this.getSelectorMap();
    const resolver = new ExpressionResolver2(selectorMap, this.fromItem, this.joinItems.map((item) => item.source));
    if (keyValues instanceof Function) {
      const keywords = constructSqlKeywords(resolver, this.context);
      const map = Object.assign({}, selectorMap, keywords);
      nameMap = keyValues(map);
    } else {
      nameMap = keyValues;
    }
    __privateSet(this, _updateItems, Object.keys(nameMap).reduce((acc, key) => {
      acc[key] = resolver.resolve(nameMap[key]);
      return acc;
    }, {}));
    return this;
  }
  async toNativeBuilder(ctx) {
    const context = ctx ?? this.context;
    if (!context) {
      throw new Error("There is no repository provided.");
    }
    if (!__privateGet(this, _updateItems)) {
      throw new Error("No update items");
    }
    if (!this.fromItem) {
      throw new Error("No from item");
    }
    const from = await this.fromItem.toRaw(context);
    let nativeQB = context.orm.getKnexInstance().from(from);
    nativeQB.then = "It is overridden. Then function is removed to prevent execution when it is passing accross the async functions";
    await this.buildWhereClause(context, nativeQB);
    const updateItems = await this.scalarMap2RawMap(this.fromItem.schema(), __privateGet(this, _updateItems), context);
    if (Object.keys(updateItems).length === 0 && !this.fromItem) {
      throw new Error("No UPDATE and FROM are provided for Dataset");
    }
    nativeQB.update(updateItems);
    if (context.client().startsWith("pg")) {
      const schemaPrimaryKeyFieldName = this.fromItem.schema().id.fieldName(context.orm);
      nativeQB = nativeQB.returning(schemaPrimaryKeyFieldName);
    }
    return nativeQB;
  }
  execute(context) {
    const ctx = context ?? this.context;
    if (!ctx) {
      throw new Error("There is no repository provided.");
    }
    const fromSource = this.fromItem;
    const schema = fromSource.schema();
    const statement = this;
    return new DBMutationRunner(ctx, async function(executionOptions) {
      const updatedIds = await this.context.startTransaction(async (trx) => {
        executionOptions = { ...executionOptions, trx };
        if (!this.latestPreflightFunctionArg && !this.latestQueryAffectedFunctionArg) {
          const nativeSql = await statement.toNativeBuilder(this.context);
          const result = await this.context.executeStatement(nativeSql, {}, executionOptions);
          if (this.context.client().startsWith("pg")) {
            const updatedIds2 = result.rows.map((row) => row.id);
            return updatedIds2;
          }
          return null;
        } else {
          const dataset = this.context.dataset();
          dataset.cloneFrom(statement);
          dataset.select({ ...dataset.getFrom().$.$allFields });
          const finalDataset = this.latestPreflightFunctionArg ? await this.latestPreflightFunctionArg(dataset) : dataset;
          this.preflightResult = await finalDataset.execute().withOptions(executionOptions);
          const updatedIds2 = (this.preflightResult ?? []).map((r) => r.id);
          await statement.execute().withOptions(executionOptions);
          if (this.latestQueryAffectedFunctionArg) {
            if (updatedIds2.length === 0) {
              this.affectedResult = [];
            } else {
              const queryDataset = this.context.dataset().from(schema.datasource("root")).where(({ root }) => root.id.in(...updatedIds2)).select(({ root }) => root.$allFields);
              const finalDataset2 = await this.latestQueryAffectedFunctionArg(queryDataset);
              this.affectedResult = await finalDataset2.execute().withOptions(executionOptions);
            }
          }
          return updatedIds2;
        }
      }, executionOptions.trx);
      return updatedIds;
    });
  }
};
_updateItems = new WeakMap();
var _updateItems2;
var DeleteStatement = class extends WhereClauseBase {
  constructor(ctx) {
    super(ctx);
    __privateAdd(this, _updateItems2, null);
  }
  from(source) {
    return this.baseFrom(source);
  }
  where(expression) {
    return this.baseWhere(expression);
  }
  innerJoin(source, expression) {
    return this.baseInnerJoin(source, expression);
  }
  leftJoin(source, expression) {
    return this.baseLeftJoin(source, expression);
  }
  rightJoin(source, expression) {
    return this.baseRightJoin(source, expression);
  }
  async toNativeBuilder(ctx) {
    const context = ctx ?? this.context;
    if (!context) {
      throw new Error("There is no repository provided.");
    }
    if (!this.fromItem) {
      throw new Error("No from item");
    }
    const from = await this.fromItem.toRaw(context);
    let nativeQB = context.orm.getKnexInstance().from(from);
    nativeQB.then = "It is overridden. Then function is removed to prevent execution when it is passing accross the async functions";
    await this.buildWhereClause(context, nativeQB);
    nativeQB.delete();
    if (context.client().startsWith("pg")) {
      const schemaPrimaryKeyFieldName = this.fromItem.schema().id.fieldName(context.orm);
      nativeQB = nativeQB.returning(schemaPrimaryKeyFieldName);
    }
    return nativeQB;
  }
  execute(context) {
    const ctx = context ?? this.context;
    if (!ctx) {
      throw new Error("There is no repository provided.");
    }
    const fromSource = this.fromItem;
    const schema = fromSource.schema();
    const statement = this;
    return new DBMutationRunner(ctx, async function(executionOptions) {
      const updatedIds = await this.context.startTransaction(async (trx) => {
        executionOptions = { ...executionOptions, trx };
        if (!this.latestPreflightFunctionArg && !this.latestQueryAffectedFunctionArg) {
          const nativeSql = await statement.toNativeBuilder(this.context);
          const result = await this.context.executeStatement(nativeSql, {}, executionOptions);
          if (this.context.client().startsWith("pg")) {
            const updatedIds2 = result.rows.map((row) => Object.keys(row).map((k) => row[k])[0]);
            return updatedIds2;
          }
          return null;
        } else {
          const dataset = this.context.dataset();
          dataset.cloneFrom(statement);
          dataset.select({ ...dataset.getFrom().$.$allFields });
          const finalDataset = this.latestPreflightFunctionArg ? await this.latestPreflightFunctionArg(dataset) : dataset;
          this.preflightResult = await finalDataset.execute().withOptions(executionOptions);
          const updatedIds2 = (this.preflightResult ?? []).map((r) => r.id);
          await statement.execute().withOptions(executionOptions);
          if (this.latestQueryAffectedFunctionArg) {
            const queryDataset = this.context.dataset().from(schema.datasource("root")).where(({ root }) => root.id.in(...updatedIds2)).select(({ root }) => root.$allFields);
            const finalDataset2 = await this.latestQueryAffectedFunctionArg(queryDataset);
            this.affectedResult = await finalDataset2.execute().withOptions(executionOptions);
          }
          return updatedIds2;
        }
      }, executionOptions.trx);
      return updatedIds;
    });
  }
};
_updateItems2 = new WeakMap();
function isSQLStringWithArgs(value) {
  const keys = Object.keys(value);
  if (keys.length === 1 && keys.includes("sql")) {
    return true;
  } else if (keys.length === 2 && keys.includes("sql") && keys.includes("args")) {
    return true;
  }
  return false;
}
var _calculatedDefinition, _calculatedRaw, _lastContext;
var _Scalar = class {
  constructor(expressionOrDataset, definition, context) {
    this.context = null;
    __privateAdd(this, _calculatedDefinition, null);
    __privateAdd(this, _calculatedRaw, null);
    __privateAdd(this, _lastContext, null);
    if (definition instanceof PropertyType) {
      this.declaredDefinition = definition;
    } else if (definition) {
      this.declaredDefinition = new definition();
    }
    this.expressionOrDataset = expressionOrDataset;
    this.context = context ?? null;
  }
  static value(...args) {
    if (typeof args[0] === "string" && Array.isArray(args[1])) {
      return this.value({ sql: args[0], args: args[1] }, args[2]);
    }
    return new _Scalar(args[0], args[1]);
  }
  static number(...args) {
    if (typeof args[0] === "string" && Array.isArray(args[1])) {
      return this.number({ sql: args[0], args: args[1] });
    }
    return new _Scalar(args[0], NumberNotNullType);
  }
  isNull() {
    return new IsNullOperator(this.context, this).toScalar();
  }
  isNotNull() {
    return new IsNotNullOperator(this.context, this).toScalar();
  }
  looseEquals(rightOperand) {
    if (rightOperand === null || rightOperand === void 0) {
      return this.isNull();
    } else if (rightOperand instanceof DScalar) {
      const d = rightOperand;
      return this.in(rightOperand);
    }
    return this.equals(rightOperand);
  }
  looseNotEquals(rightOperand) {
    if (rightOperand === null || rightOperand === void 0) {
      return this.isNotNull();
    } else if (rightOperand instanceof DScalar) {
      const d = rightOperand;
      return this.notIn(rightOperand);
    }
    return this.notEquals(rightOperand);
  }
  equals(rightOperand) {
    return new EqualOperator(this.context, this, resolveValueIntoScalar(rightOperand)).toScalar();
  }
  notEquals(rightOperand) {
    return new NotEqualOperator(this.context, this, resolveValueIntoScalar(rightOperand)).toScalar();
  }
  like(rightOperand) {
    return new LikeOperator(this.context, this, resolveValueIntoScalar(rightOperand)).toScalar();
  }
  notLike(rightOperand) {
    return new NotLikeOperator(this.context, this, resolveValueIntoScalar(rightOperand)).toScalar();
  }
  in(...rightOperands) {
    const rights = rightOperands.length === 1 && Array.isArray(rightOperands[0]) ? rightOperands[0] : rightOperands;
    return new InOperator(this.context, this, ...rights.map((r) => resolveValueIntoScalar(r))).toScalar();
  }
  notIn(...rightOperands) {
    const rights = rightOperands.length === 1 && Array.isArray(rightOperands[0]) ? rightOperands[0] : rightOperands;
    return new NotInOperator(this.context, this, ...rights.map((r) => resolveValueIntoScalar(r))).toScalar();
  }
  greaterThan(rightOperand) {
    return new GreaterThanOperator(this.context, this, resolveValueIntoScalar(rightOperand)).toScalar();
  }
  lessThan(rightOperand) {
    return new LessThanOperator(this.context, this, resolveValueIntoScalar(rightOperand)).toScalar();
  }
  greaterThanOrEquals(rightOperand) {
    return new GreaterThanOrEqualsOperator(this.context, this, resolveValueIntoScalar(rightOperand)).toScalar();
  }
  lessThanOrEquals(rightOperand) {
    return new LessThanOrEqualsOperator(this.context, this, resolveValueIntoScalar(rightOperand)).toScalar();
  }
  between(rightOperand1, rightOperand2) {
    return new BetweenOperator(this.context, this, resolveValueIntoScalar(rightOperand1), resolveValueIntoScalar(rightOperand2)).toScalar();
  }
  notBetween(rightOperand1, rightOperand2) {
    return new NotBetweenOperator(this.context, this, resolveValueIntoScalar(rightOperand1), resolveValueIntoScalar(rightOperand2)).toScalar();
  }
  definitionForParsing() {
    return __privateGet(this, _calculatedDefinition) ?? this.declaredDefinition ?? new PropertyType();
  }
  transform(fn) {
    const s = new _Scalar((context) => {
      const rawOrDataset = this.resolveIntoRawOrDataset(context, this.expressionOrDataset);
      return thenResult(rawOrDataset, (rawOrDataset2) => fn(rawOrDataset2, context));
    });
    return s;
  }
  async resolveDefinition(ctx, ex) {
    return thenResult(ex, (ex2) => {
      if (ex2 instanceof Dataset2) {
        return this.resolveDefinition(ctx, ex2.toDScalarWithArrayType());
      } else if (ex2 instanceof _Scalar) {
        if (ex2.declaredDefinition) {
          return ex2.declaredDefinition;
        } else {
          const raw = ex2.expressionOrDataset;
          return this.resolveDefinition(ctx, raw);
        }
      } else if (ex2 instanceof Function) {
        return this.resolveDefinition(ctx, ex2(ctx));
      } else {
        return new PropertyType();
      }
    });
  }
  async calculateDefinition(context) {
    const ctx = context ?? this.context;
    if (!ctx) {
      throw new Error("There is no repository provided");
    }
    return await this.resolveDefinition(ctx, this);
  }
  calculateRaw(context) {
    const ctx = context ?? this.context;
    if (!ctx) {
      throw new Error("There is no repository provided");
    }
    const expressionOrDataset = this.expressionOrDataset;
    const raw = thenResult(this.getDefinition(ctx), (definition) => {
      return thenResult(this.resolveIntoRawOrDataset(ctx, expressionOrDataset), (rawOrDataset) => {
        if (!(rawOrDataset instanceof Dataset2)) {
          const next = ctx.raw(rawOrDataset.toString());
          return (definition ?? new PropertyType()).transformQuery(next, ctx);
        } else {
          return (definition ?? new PropertyType()).transformQuery(rawOrDataset, ctx);
        }
      });
    });
    return raw;
  }
  resolveIntoRawOrDataset(context, raw) {
    return thenResult(raw, (ex) => {
      if (ex instanceof Dataset2) {
        return ex;
      } else if (ex instanceof _Scalar) {
        return this.resolveIntoRawOrDataset(context, ex.expressionOrDataset);
      } else if (ex instanceof Function) {
        return this.resolveIntoRawOrDataset(context, ex(context));
      } else if (typeof ex === "string") {
        return context.raw(ex);
      } else if (isSQLStringWithArgs(ex)) {
        if (!ex.args) {
          return context.raw(ex.sql);
        } else {
          const rawArgs = ex.args.map((arg) => {
            if (arg instanceof _Scalar) {
              return arg.toRaw(context);
            } else if (arg instanceof Dataset2) {
              return arg.toNativeBuilder(context);
            }
            return arg;
          });
          return thenResultArray(rawArgs, (rawArgs2) => thenResult(rawArgs2, (rawArgs3) => context.raw(ex.sql, rawArgs3)));
        }
      }
      return ex;
    });
  }
  async getDefinition(context) {
    if (context && __privateGet(this, _lastContext) !== context) {
      __privateSet(this, _calculatedRaw, null);
    }
    if (!__privateGet(this, _calculatedDefinition)) {
      __privateSet(this, _calculatedDefinition, await this.calculateDefinition(context));
      __privateSet(this, _lastContext, context ?? null);
    }
    return __privateGet(this, _calculatedDefinition);
  }
  async toRaw(context) {
    if (context && __privateGet(this, _lastContext) !== context) {
      __privateSet(this, _calculatedRaw, null);
    }
    if (!__privateGet(this, _calculatedRaw)) {
      __privateSet(this, _calculatedRaw, await this.calculateRaw(context));
      __privateSet(this, _lastContext, context ?? null);
    }
    return __privateGet(this, _calculatedRaw);
  }
  execute(context) {
    const ctx = context ?? this.context;
    if (!ctx) {
      throw new Error("There is no repository provided.");
    }
    const currentScalar = this;
    return new DBQueryRunner(currentScalar, ctx, async function(executionOptions) {
      const result = await this.context.dataset().select({
        root: currentScalar
      }).execute().withOptions(executionOptions);
      return result[0].root;
    });
  }
};
var Scalar = _Scalar;
_calculatedDefinition = new WeakMap();
_calculatedRaw = new WeakMap();
_lastContext = new WeakMap();
var DScalar = class extends Scalar {
  constructor(content, definition, context) {
    super(async (context2) => {
      let resolved;
      if (content instanceof Function) {
        resolved = await content(context2);
      } else {
        resolved = content;
      }
      if (resolved instanceof Dataset2 && !definition) {
        return resolved.toDScalarWithType((ds) => new ArrayType(ds.schema()));
      }
      return resolved;
    }, definition, context);
  }
  count() {
    return super.transform((value, ctx) => {
      if (value instanceof Dataset2) {
        return value.select(() => ({ count: new Scalar("Count(1)") })).toDScalarWithType(NumberNotNullType);
      }
      throw new Error("count is only applicable to Dataset.");
    });
  }
  exists() {
    return super.transform((value, ctx) => {
      if (value instanceof Dataset2) {
        return ctx.$.Exists(value);
      }
      throw new Error("count is only applicable to Dataset.");
    });
  }
  transform(fn) {
    const s = new DScalar((context) => {
      const rawOrDataset = this.resolveIntoRawOrDataset(context, this.expressionOrDataset);
      return thenResult(rawOrDataset, (rawOrDataset2) => fn(rawOrDataset2, context));
    });
    return s;
  }
  asArrayType() {
    return this.transform((preValue, context) => {
      return preValue.toDScalarWithType((ds) => new ArrayType(ds.schema()));
    });
  }
  asObjectType() {
    return this.transform((preValue, context) => {
      return preValue.toDScalarWithType((ds) => new ObjectType(ds.schema()));
    });
  }
};
function resolveValueIntoScalar(value) {
  if (value === null) {
    return new Scalar((context) => context.raw("?", [null]));
  } else if (typeof value === "boolean") {
    const boolValue = value;
    return new Scalar((context) => context.raw("?", [boolValue]), new BooleanType());
  } else if (typeof value === "string") {
    const stringValue = value;
    return new Scalar((context) => context.raw("?", [stringValue]), new StringType());
  } else if (typeof value === "number") {
    const numberValue = value;
    return new Scalar((context) => context.raw("?", [numberValue]), new NumberType());
  } else if (value instanceof Date) {
    const dateValue = value;
    return new Scalar((context) => context.raw("?", [dateValue]), new DateTimeType());
  } else if (value instanceof ConditionOperator) {
    return value.toScalar();
  } else if (value instanceof Dataset2) {
    return value.toDScalarWithArrayType();
  }
  return value;
}
var ExpressionResolver2 = class {
  constructor(dictionary, fromSource, sources) {
    this.dictionary = dictionary;
    this.fromSource = fromSource;
    this.sources = sources;
  }
  resolve(expression) {
    let value;
    if (expression instanceof Function) {
      value = expression(this.dictionary);
    } else {
      value = expression;
    }
    if (value === null || typeof value === "boolean" || typeof value === "string" || typeof value === "number" || value instanceof Date || value instanceof ConditionOperator || value instanceof Dataset2) {
      value = resolveValueIntoScalar(value);
    }
    if (value instanceof Scalar) {
      return value;
    } else if (Array.isArray(value)) {
      const expr = new OrOperator(null, this, ...value);
      return this.resolve(expr);
    } else if (this.fromSource && value instanceof SimpleObjectClass) {
      const dict = value;
      const scalars = Object.keys(dict).reduce((scalars2, key) => {
        let source = null;
        let [sourceName, propName] = key.split(".");
        if (!propName) {
          propName = sourceName;
          source = this.fromSource;
        } else {
          source = [this.fromSource, ...this.sources ? this.sources : []].find((s) => s && s.sourceAlias === sourceName);
        }
        if (!source) {
          throw new Error(`cannot found source (${sourceName})`);
        }
        const prop = source.schema().propertiesMap[propName];
        if (!prop) {
          throw new Error(`cannot found prop (${propName})`);
        }
        const operatorScalar = (leftOperatorEx, rightOperatorEx) => {
          const leftOperator = this.resolve(leftOperatorEx);
          let finalScalar;
          if (rightOperatorEx instanceof AssertionOperatorWrapper) {
            finalScalar = rightOperatorEx.toScalar(leftOperatorEx);
          } else if (rightOperatorEx === null) {
            finalScalar = new IsNullOperator(null, leftOperator).toScalar();
          } else {
            finalScalar = new EqualOperator(null, leftOperator, this.resolve(rightOperatorEx)).toScalar();
          }
          return finalScalar;
        };
        if (prop instanceof FieldProperty || prop instanceof ScalarProperty) {
          const converted = source.getFieldProperty(propName);
          scalars2.push(operatorScalar(converted, dict[key]));
        } else if (prop instanceof ComputeProperty) {
          const compiled = source.getComputeProperty(propName)();
          scalars2.push(operatorScalar(compiled, dict[key]));
        }
        return scalars2;
      }, []);
      const arr = new AndOperator(null, this, ...scalars);
      return this.resolve(arr);
    } else {
      throw new Error("Unsupport value");
    }
  }
};

// src/model.ts
var _entityName2, _repository, _schema;
var Model = class {
  constructor(repository, entityName) {
    __privateAdd(this, _entityName2, void 0);
    __privateAdd(this, _repository, void 0);
    __privateAdd(this, _schema, null);
    __privateSet(this, _repository, repository);
    __privateSet(this, _entityName2, entityName);
  }
  get modelName() {
    return __privateGet(this, _entityName2);
  }
  field(definition) {
    if (definition instanceof FieldPropertyType) {
      return new FieldProperty(definition);
    }
    return new FieldProperty(new definition());
  }
  static compute(...args) {
    return new ComputeProperty(new ComputeValueGetterDefinition2(args[0]));
  }
  static computeModelObject(compute) {
    return new ComputeProperty(new ComputeValueGetterDefinition2(compute));
  }
  hook(newHook) {
  }
  schema() {
    if (!__privateGet(this, _schema)) {
      const props = {};
      for (const field in this) {
        if (this[field] instanceof Property) {
          props[field] = this[field];
        }
      }
      const z = Object.getOwnPropertyDescriptors(this.constructor.prototype);
      for (const field in z) {
        if (z[field] instanceof Property) {
          props[field] = z[field];
        }
      }
      const schema = new TableSchema(__privateGet(this, _entityName2), props, this.id);
      __privateSet(this, _schema, schema);
    }
    return __privateGet(this, _schema);
  }
  datasource(name, options) {
    return this.schema().datasource(name, options);
  }
  static hasMany(relatedModelType, relatedBy, parentKey = "id") {
    return this.compute((parent, args) => {
      return new DScalar((context) => {
        const relatedModel = context.getRepository(relatedModelType);
        const parentColumn = parent.getFieldProperty(parentKey);
        const dataset = relatedModel.dataset(args);
        dataset.andWhere(({ root }) => parentColumn.equals(root.$allFields[relatedBy]));
        return dataset;
      });
    });
  }
  static belongsTo(relatedModelType, parentKey, relatedBy = "id") {
    return this.compute((parent, args) => {
      return new DScalar((context) => {
        const relatedModel = context.getRepository(relatedModelType);
        const parentColumn = parent.getFieldProperty(parentKey);
        const dataset = relatedModel.dataset(args);
        dataset.andWhere(({ root }) => parentColumn.equals(root.$allFields[relatedBy]));
        return dataset;
      }).asObjectType();
    });
  }
  static hasManyThrough(throughModelType, relatedModelType, relatedBy, throughRelatedBy, throughParentKey, parentKey = "id") {
    return this.compute((parent, args) => {
      return new DScalar((context) => {
        const relatedModel = context.getRepository(relatedModelType);
        const parentColumn = parent.getFieldProperty(parentKey);
        const throughModel = context.getRepository(throughModelType);
        const throughDatasource = throughModel.datasource("through");
        const dataset = relatedModel.dataset((map) => {
          let resolved;
          if (args instanceof Function) {
            args = args({ through: throughDatasource.$, ...map });
          } else {
            resolved = args;
          }
          const newResolved = { ...resolved };
          if (newResolved?.where instanceof Function) {
            const oldWhere = newResolved.where;
            newResolved.where = (map2) => {
              return oldWhere({ ...map2, through: throughDatasource.$ });
            };
          }
          return newResolved;
        });
        dataset.innerJoin(throughDatasource, ({ And, through, root }) => And(through.$allFields[throughRelatedBy].equals(root.$allFields[relatedBy]), through.$allFields[throughParentKey].equals(parentColumn)));
        return dataset;
      });
    });
  }
};
_entityName2 = new WeakMap();
_repository = new WeakMap();
_schema = new WeakMap();
var _model, _modelClass, _context;
var ModelRepository = class {
  constructor(context, modelClass, modelName) {
    __privateAdd(this, _model, void 0);
    __privateAdd(this, _modelClass, void 0);
    __privateAdd(this, _context, void 0);
    __privateSet(this, _context, context);
    __privateSet(this, _modelClass, modelClass);
    __privateSet(this, _model, new modelClass(this, modelName));
  }
  get model() {
    return __privateGet(this, _model);
  }
  get modelClass() {
    return __privateGet(this, _modelClass);
  }
  get context() {
    return __privateGet(this, _context);
  }
  datasource(name, options) {
    return __privateGet(this, _model).datasource(name, options);
  }
  schema() {
    return __privateGet(this, _model).schema();
  }
  createOne(data) {
    return this.context.insert(__privateGet(this, _model).schema()).values([data]).execute().getAffectedOne();
  }
  createEach(arrayOfData) {
    return this.context.insert(__privateGet(this, _model).schema()).values(arrayOfData).execute().getAffected();
  }
  findOne(findOptions) {
    return this.dataset(findOptions).execute().getOne();
  }
  findOneOrNull(findOptions) {
    return this.dataset(findOptions).execute().getOneOrNull();
  }
  find(findOptions) {
    return this.dataset(findOptions).execute();
  }
  update(data, args) {
    return this.context.update().set(data).from(__privateGet(this, _model).schema().datasource("root")).where(args ?? {}).execute().getAffected();
  }
  updateOne(data, args) {
    return this.context.update().set(data).from(__privateGet(this, _model).schema().datasource("root")).where(args ?? {}).execute().getAffectedOne();
  }
  dataset(args) {
    const source = this.model.datasource("root");
    const dataset = this.context.dataset().from(source);
    const props = source.getAllFieldProperty();
    let resolvedArgs;
    if (args) {
      if (args instanceof Function) {
        resolvedArgs = args({ root: source.$, ...this.context.$ });
      } else {
        resolvedArgs = args;
      }
    }
    if (resolvedArgs?.where) {
      dataset.where(resolvedArgs.where);
    }
    if (resolvedArgs?.selectProps) {
      dataset.select(...resolvedArgs.selectProps);
    }
    if (resolvedArgs?.select) {
      const computed = resolvedArgs.select;
      const computedValues = Object.keys(computed).map((key) => {
        const arg = computed[key];
        return { [key]: source.getComputeProperty(key)(arg) };
      }).reduce((acc, v) => Object.assign(acc, v), {});
      dataset.andSelect(Object.assign(props, computedValues));
    } else {
      dataset.andSelect(props);
    }
    if (resolvedArgs?.orderBy) {
      dataset.orderBy(resolvedArgs.orderBy);
    }
    if (resolvedArgs?.offset) {
      dataset.offset(resolvedArgs.offset);
    }
    if (resolvedArgs?.limit) {
      dataset.limit(resolvedArgs.limit);
    }
    return dataset;
  }
  delete(args) {
    return this.context.del().from(__privateGet(this, _model).schema().datasource("root")).where(args ?? {}).execute().getPreflight();
  }
  deleteOne(args) {
    return this.context.del().from(__privateGet(this, _model).schema().datasource("root")).where(args ?? {}).execute().getPreflightOne();
  }
};
_model = new WeakMap();
_modelClass = new WeakMap();
_context = new WeakMap();

// src/index.ts
var ComputeValueGetterDefinition2 = class {
  constructor(fn) {
    this.fn = fn;
  }
};
var ComputeValueGetterDefinitionDynamicReturn2 = class extends ComputeValueGetterDefinition2 {
  constructor(fn) {
    super(fn);
    this.mode = "dynamic";
  }
};
var _globalKnexInstance, _contextMap, _ormConfig, _modelMap;
var ORM = class {
  constructor(newConfig) {
    __privateAdd(this, _globalKnexInstance, null);
    __privateAdd(this, _contextMap, new Map());
    this.defaultORMConfig = {
      models: {},
      knexConfig: {
        client: "mysql"
      }
    };
    __privateAdd(this, _ormConfig, void 0);
    __privateAdd(this, _modelMap, {});
    const newOrmConfig = Object.assign({}, this.defaultORMConfig, newConfig);
    __privateSet(this, _ormConfig, newOrmConfig);
    this.register();
  }
  get ormConfig() {
    return Object.assign({}, __privateGet(this, _ormConfig));
  }
  get modelMap() {
    return __privateGet(this, _modelMap);
  }
  register() {
    if (__privateGet(this, _ormConfig).models) {
      const models = __privateGet(this, _ormConfig).models;
      Object.keys(models).forEach((key) => {
        __privateGet(this, _modelMap)[key] = models[key];
      });
    }
    if (__privateGet(this, _ormConfig).modelsPath) {
      const files = fs.readdirSync(__privateGet(this, _ormConfig).modelsPath);
      files.forEach((file) => {
        if (file.endsWith(".js")) {
          let path = __privateGet(this, _ormConfig).modelsPath + "/" + file;
          path = path.replace(/\.js$/, "");
          const p = path.split("/");
          const entityName = p[p.length - 1];
          const entityClass = require(path);
          const camelCase = camelize(entityName);
          const finalName = camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
          __privateGet(this, _modelMap)[finalName] = entityClass.default;
        }
      });
    }
  }
  getContext(config) {
    const key = JSON.stringify(config);
    let repo = __privateGet(this, _contextMap).get(key);
    if (!repo) {
      repo = new DatabaseContext4(this, config);
      __privateGet(this, _contextMap).set(key, repo);
    }
    return repo;
  }
  getKnexInstance() {
    if (__privateGet(this, _globalKnexInstance)) {
      return __privateGet(this, _globalKnexInstance);
    }
    const newKnexConfig = Object.assign({
      useNullAsDefault: true
    }, __privateGet(this, _ormConfig).knexConfig);
    if (newKnexConfig.connection !== void 0 && typeof newKnexConfig.connection !== "object") {
      throw new Error("Configuration connection only accept object.");
    }
    if (typeof newKnexConfig.client !== "string") {
      throw new Error("Configuration client only accept string");
    }
    newKnexConfig.connection = Object.assign({}, newKnexConfig.connection, { multipleStatements: true });
    __privateSet(this, _globalKnexInstance, (0, import_knex.default)(newKnexConfig));
    return __privateGet(this, _globalKnexInstance);
  }
  async shutdown() {
    return this.getKnexInstance().destroy();
  }
};
_globalKnexInstance = new WeakMap();
_contextMap = new WeakMap();
_ormConfig = new WeakMap();
_modelMap = new WeakMap();
var _config;
var DatabaseContext4 = class {
  constructor(orm, config) {
    __privateAdd(this, _config, null);
    this.schemaSqls = () => {
      const m = this.repos;
      const sqls = Object.keys(m).map((k) => m[k].model).map((s) => s.schema().createTableStmt(this, { tablePrefix: this.tablePrefix })).filter(notEmpty);
      return sqls;
    };
    this.outputSchema = (path) => {
      fs.writeFileSync(path, this.schemaSqls().join(";\n") + ";");
    };
    this.createModels = async () => {
      await Promise.all(this.schemaSqls().map(async (sql) => {
        await this.orm.getKnexInstance().raw(sql);
      }));
    };
    this.executeStatement = async (stmt, variables, executionOptions) => {
      const sql = stmt.toString();
      if (executionOptions?.onSqlRun) {
        executionOptions.onSqlRun(sql);
      }
      const KnexStmt = this.orm.getKnexInstance().raw(sql, variables);
      if (executionOptions?.trx) {
        KnexStmt.transacting(executionOptions.trx);
      }
      let result = null;
      result = await KnexStmt;
      return result;
    };
    this.dataset = () => {
      return new Dataset2(this);
    };
    this.raw = (sql, args) => {
      const r = this.orm.getKnexInstance().raw(sql, args ?? []);
      r.then = "It is overridden. 'Then' function is removed to prevent execution when it is passing across any async function(s).";
      return r;
    };
    this.update = () => {
      return new UpdateStatement(this);
    };
    this.del = () => {
      return new DeleteStatement(this);
    };
    this.insert = (into) => {
      return new InsertStatement(into, this);
    };
    this.client = () => this.orm.ormConfig.knexConfig.client.toString();
    this.orm = orm;
    __privateSet(this, _config, config ?? {});
    this.repos = Object.keys(orm.modelMap).reduce((acc, key) => {
      const modelClass = orm.modelMap[key];
      acc[key] = new ModelRepository(this, modelClass, key);
      return acc;
    }, {});
  }
  get config() {
    return __privateGet(this, _config);
  }
  get tablePrefix() {
    return __privateGet(this, _config)?.tablePrefix ?? "";
  }
  getRepository(nameOrClass) {
    if (typeof nameOrClass === "string") {
      return this.repos[nameOrClass];
    } else {
      const foundKey = Object.keys(this.repos).find((key) => this.repos[key].modelClass === nameOrClass);
      if (!foundKey) {
        console.log("cannot find model", nameOrClass);
        throw new Error("Cannot find model");
      }
      return this.repos[foundKey];
    }
  }
  scalar(...args) {
    if (typeof args[0] === "string" && Array.isArray(args[1])) {
      return new Scalar({ sql: args[0], args: args[1] }, args[2], this);
    }
    return new Scalar(args[0], args[1], this);
  }
  get $() {
    const o = {};
    const f = new ExpressionResolver2(o);
    return Object.assign(o, constructSqlKeywords(f, this));
  }
  async startTransaction(func, existingTrx) {
    const knex2 = this.orm.getKnexInstance();
    const useTrx = (trx, isExistingTrx) => {
      return thenResult(func(trx), async (result) => {
        if (!isExistingTrx) {
          await trx.commit();
        }
        return result;
      }, async (error) => {
        if (!isExistingTrx) {
          await trx.rollback();
        }
        throw error;
      });
    };
    if (existingTrx) {
      return useTrx(existingTrx, true);
    } else {
      const trx = await knex2.transaction();
      return await useTrx(trx, false);
    }
  }
};
_config = new WeakMap();
var DBActionRunnerBase = class {
  constructor(context, action) {
    this.options = {};
    this.context = context;
    this.execOptions = {};
    this.action = action;
  }
  async execAction(execOptions) {
    return await this.action.call(this, execOptions ?? this.execOptions, this.options);
  }
  async then(onfulfilled, onrejected) {
    try {
      const result = await this.execAction();
      if (onfulfilled) {
        return onfulfilled(expandRecursively(result));
      } else {
        return this.then(onfulfilled, onrejected);
      }
    } catch (error) {
      if (onrejected) {
        return onrejected(error);
      } else {
        throw error;
      }
    }
  }
  async exec() {
    const result = await this.execAction();
    return result;
  }
  usingConnection(trx) {
    if (!trx) {
      throw new Error("No transaction given.");
    }
    this.execOptions.trx = trx;
    return this;
  }
  usingConnectionIfAny(trx) {
    if (trx) {
      this.execOptions.trx = trx;
    }
    return this;
  }
  onSqlRun(callback) {
    this.execOptions.onSqlRun = callback;
    return this;
  }
  withOptions(execOptions) {
    this.execOptions = execOptions;
    return this;
  }
  getOptions() {
    return this.execOptions;
  }
};
var DBQueryRunner = class extends DBActionRunnerBase {
  constructor(source, context, action, args) {
    super(context, action);
    this.parent = null;
    this.parent = args?.parent ?? null;
    this.source = source;
  }
  get ancestor() {
    let parent = this;
    while (parent && parent.parent) {
      parent = parent.parent;
    }
    if (!parent) {
      return this;
    }
    return parent;
  }
  getOne() {
    const m = new DBQueryRunner(this.source, this.context, async function(executionOptions, options) {
      return await this.context.startTransaction(async (trx) => {
        executionOptions = { ...executionOptions, trx };
        const result = await this.ancestor.action.call(this, executionOptions, options);
        if (Array.isArray(result)) {
          if (result.length !== 1) {
            throw new Error("getFirstOne finds Zero or Many Rows");
          }
          return result[0];
        }
        throw new Error("Only array is allowed to use getFirstRow");
      }, executionOptions.trx);
    }, {
      parent: this
    });
    return m;
  }
  getOneOrNull() {
    const m = new DBQueryRunner(this.source, this.context, async function(executionOptions, options) {
      return await this.context.startTransaction(async (trx) => {
        executionOptions = { ...executionOptions, trx };
        const result = await this.ancestor.action.call(this, executionOptions, options);
        if (Array.isArray(result)) {
          if (result.length > 1) {
            throw new Error("getFirstOne finds Many Rows");
          }
          return result[0] ?? null;
        }
        throw new Error("Only array is allowed to use getFirstRow");
      }, executionOptions.trx);
    }, {
      parent: this
    });
    return m;
  }
  getBuilder() {
    return this.source;
  }
};
var DBMutationRunner = class extends DBActionRunnerBase {
  constructor(context, action, args) {
    super(context, action);
    this.preflightFunctionArg = null;
    this.queryAffectedFunctionArg = null;
    this.preflightResult = null;
    this.affectedResult = null;
    this.parent = null;
    this.parent = args?.parent ?? null;
    this.preflightFunctionArg = args?.preflightFunctionArg ?? null;
    this.queryAffectedFunctionArg = args?.queryAffectedFunctionArg ?? null;
  }
  get ancestor() {
    let parent = this;
    while (parent && parent.parent) {
      parent = parent.parent;
    }
    if (!parent) {
      return this;
    }
    return parent;
  }
  get latestPreflightFunctionArg() {
    let target = this;
    while (target && !target.preflightFunctionArg) {
      target = target.parent;
    }
    return target?.preflightFunctionArg ?? null;
  }
  get latestQueryAffectedFunctionArg() {
    let target = this;
    while (target && !target.queryAffectedFunctionArg) {
      target = target.parent;
    }
    return target?.queryAffectedFunctionArg ?? null;
  }
  async execAction(execOptions) {
    return await super.execAction(execOptions);
  }
  withOptions(execOptions) {
    super.withOptions(execOptions);
    return this;
  }
  getOptions() {
    return this.execOptions;
  }
  getAffected(...args) {
    const onQuery = args[0] ?? ((dataset) => dataset);
    return new DBMutationRunner(this.context, async function(executionOptions, options) {
      await this.ancestor.action.call(this, executionOptions, options);
      return this.affectedResult;
    }, {
      parent: this,
      queryAffectedFunctionArg: onQuery
    });
  }
  getAffectedOne(...args) {
    const onQuery = args[0] ?? ((dataset) => dataset);
    return new DBMutationRunner(this.context, async function(executionOptions, options) {
      return await this.context.startTransaction(async (trx) => {
        executionOptions = { ...executionOptions, trx };
        await this.ancestor.action.call(this, executionOptions, options);
        if (Array.isArray(this.affectedResult)) {
          if (this.affectedResult.length !== 1) {
            throw new Error("getAffectedOne finds Zero or Many Rows");
          }
          return this.affectedResult[0];
        }
        throw new Error("Only array is allowed to use getAffectedOne");
      }, executionOptions.trx);
    }, {
      parent: this,
      queryAffectedFunctionArg: onQuery
    });
  }
  withAffected(...args) {
    const onQuery = args[0] ?? ((dataset) => dataset);
    const m = new DBMutationRunner(this.context, async function(executionOptions, options) {
      const result = await this.ancestor.action.call(this, executionOptions, options);
      return {
        result,
        preflight: this.preflightResult,
        affected: this.affectedResult
      };
    }, {
      parent: this,
      queryAffectedFunctionArg: onQuery
    });
    return m;
  }
  getPreflight(onQuery) {
    return new DBMutationRunner(this.context, async function(executionOptions, options) {
      await this.ancestor.action.call(this, executionOptions, options);
      return this.preflightResult;
    }, {
      parent: this,
      preflightFunctionArg: onQuery ?? ((dataset) => dataset)
    });
  }
  getPreflightOne(onQuery) {
    return new DBMutationRunner(this.context, async function(executionOptions, options) {
      return await this.context.startTransaction(async (trx) => {
        executionOptions = { ...executionOptions, trx };
        await this.ancestor.action.call(this, executionOptions, options);
        if (Array.isArray(this.preflightResult)) {
          if (this.preflightResult.length !== 1) {
            throw new Error("getPreflightOne finds Zero or Many Rows");
          }
          return this.preflightResult[0];
        }
        throw new Error("Only array is allowed to use getPreflightOne");
      }, executionOptions.trx);
    }, {
      parent: this,
      preflightFunctionArg: onQuery ?? ((dataset) => dataset)
    });
  }
  withPreflight(onQuery) {
    const m = new DBMutationRunner(this.context, async function(executionOptions, options) {
      const result = await this.ancestor.action.call(this, executionOptions, options);
      return {
        result,
        preflight: this.preflightResult,
        affected: this.affectedResult
      };
    }, {
      parent: this,
      preflightFunctionArg: onQuery ?? ((dataset) => dataset)
    });
    return m;
  }
};
var Hook2 = class {
  constructor(name, action) {
    this.name = name;
    this.action = action;
  }
  onPropertyChange(propName) {
    this.propName = propName;
    return this;
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AndOperator,
  ArrayType,
  AssertionOperator,
  AssertionOperatorWrapper,
  BetweenOperator,
  BooleanNotNullType,
  BooleanType,
  ComputeValueGetterDefinition,
  ComputeValueGetterDefinitionDynamicReturn,
  ComputeProperty,
  ConditionOperator,
  DBActionRunnerBase,
  DBMutationRunner,
  DBQueryRunner,
  DScalar,
  DatabaseContext,
  Dataset,
  DateNotNullType,
  DateTimeNotNullType,
  DateTimeType,
  DateType,
  DecimalNotNullType,
  DecimalType,
  DeleteStatement,
  DerivedDatasource,
  DerivedTableSchema,
  EqualOperator,
  ExistsOperator,
  ExpressionResolver,
  FieldProperty,
  FieldPropertyType,
  GreaterThanOperator,
  GreaterThanOrEqualsOperator,
  Hook,
  InOperator,
  InsertStatement,
  IsNotNullOperator,
  IsNullOperator,
  LeftAndRightAssertionOperator,
  LessThanOperator,
  LessThanOrEqualsOperator,
  LikeOperator,
  Model,
  ModelRepository,
  NotBetweenOperator,
  NotEqualOperator,
  NotInOperator,
  NotLikeOperator,
  NotOperator,
  NumberNotNullType,
  NumberType,
  ORM,
  ObjectType,
  OrOperator,
  ParsablePropertyTypeDefinition,
  PrimaryKeyType,
  Property,
  PropertyType,
  Scalar,
  ScalarProperty,
  Schema,
  SimpleObjectClass,
  StringNotNullType,
  StringType,
  TableDatasource,
  TableSchema,
  UpdateStatement,
  camelize,
  constructSqlKeywords,
  expand,
  expandRecursively,
  isArrayOfStrings,
  isFunction,
  isScalarMap,
  makeid,
  notEmpty,
  parseName,
  quote,
  resolveValueIntoScalar,
  thenResult,
  thenResultArray,
  undoExpandRecursively
});
//!!!important: lazy load, don't always return new object
//# sourceMappingURL=index.js.map
