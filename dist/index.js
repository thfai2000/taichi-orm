var __create = Object.create;
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, {enumerable: true, configurable: true, writable: true, value}) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __markAsModule = (target) => __defProp(target, "__esModule", {value: true});
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {get: all[name], enumerable: true});
};
var __reExport = (target, module2, desc) => {
  if (module2 && typeof module2 === "object" || typeof module2 === "function") {
    for (let key of __getOwnPropNames(module2))
      if (!__hasOwnProp.call(target, key) && key !== "default")
        __defProp(target, key, {get: () => module2[key], enumerable: !(desc = __getOwnPropDesc(module2, key)) || desc.enumerable});
  }
  return target;
};
var __toModule = (module2) => {
  return __reExport(__markAsModule(__defProp(module2 != null ? __create(__getProtoOf(module2)) : {}, "default", module2 && module2.__esModule && "default" in module2 ? {get: () => module2.default, enumerable: true} : {value: module2, enumerable: true})), module2);
};
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};
__markAsModule(exports);
__export(exports, {
  Entity: () => Entity,
  More: () => More,
  Schema: () => Schema,
  Select: () => Select,
  Types: () => Types,
  configure: () => configure
});
var import_knex = __toModule(require("knex"));
var fs = __toModule(require("fs"));
let knexOption = {client: "mysql2"};
const getKnexInstance = () => (0, import_knex.default)(knexOption);
let config = {
  modelsPath: "models/",
  dbSchemaPath: "db-schema.sql"
};
const types = {
  AutoIncrement: ["bigint", "NOT NULL", "AUTO_INCREMENT", "PRIMARY KEY"],
  String: (length, nullable) => [`varchar(${length})`],
  Number: ["integer"],
  Date: ["datetime"],
  arrayOf: function(entity) {
  }
};
const Types = types;
const More = {
  Null: "NULL",
  NotNull: "NOT NULL"
};
let schemas = {};
class Schema {
  constructor(entityName) {
    this.entityName = entityName;
    this.tableName = config.entityNameToTableName ? config.entityNameToTableName(entityName) : entityName;
    this.primaryKey = {
      name: "id",
      defination: [Types.AutoIncrement],
      computed: false
    };
    this.fields = [this.primaryKey];
  }
  createTableStmt() {
    return `CREATE TABLE \`${this.tableName}\` (
${this.fields.filter((f) => !f.computed).map((f) => `\`${f.name}\` ${f.defination.flat().join(" ")}`).join(",\n")}
)`;
  }
  prop(name, defination, options) {
    this.fields.push(__spreadProps(__spreadValues({
      name,
      defination
    }, options), {
      computed: false
    }));
  }
  computedProp(name, defination, options) {
    this.fields.push(__spreadProps(__spreadValues({
      name,
      defination
    }, options), {
      computed: true
    }));
  }
}
function makeid(length) {
  var result = [];
  var characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result.push(characters.charAt(Math.floor(Math.random() * charactersLength)));
  }
  return result.join("");
}
const configure = function(newConfig) {
  return __async(this, null, function* () {
    config = newConfig;
    let files = fs.readdirSync(config.modelsPath);
    let tables = [];
    yield Promise.all(files.map((file) => __async(this, null, function* () {
      if (file.endsWith(".js")) {
        let path2 = config.modelsPath + "/" + file;
        path2 = path2.replace(/\.js$/, "");
        console.log("load model file:", path2);
        let p = path2.split("/");
        let entityName = p[p.length - 1];
        let entityClass = require(path2);
        if (entityClass.default.register) {
          let s = new Schema(entityName);
          tables.push(s);
          entityClass.default.register(s);
          schemas[entityName] = s;
        }
      }
    })));
    let path = config.dbSchemaPath;
    fs.writeFileSync(path, tables.map((t) => t.createTableStmt()).join(";\n") + ";");
    console.log("schemas:", Object.keys(schemas));
  });
};
const Select = function(...args) {
  let alias = args.map((s) => {
    var _a;
    return ((_a = /\[\[(.*)\]\]/g.exec(s)) == null ? void 0 : _a[1]) || "";
  }).filter((s) => s.length > 0);
  let info = alias.map((a) => {
    let parts = a.split("|");
    return {
      fullName: `[[${a}]]`,
      tableName: parts[0],
      aliasName: parts[1],
      fieldName: parts[2]
    };
  });
  let distinctNames = [...new Set(info.map((i) => `${i.tableName} as ${i.aliasName}`))];
  let stmt = getKnexInstance().select(...args);
  if (distinctNames.length === 1) {
    stmt = stmt.from(distinctNames[0]);
  }
  console.log(stmt.toSQL());
  return stmt;
};
Select("[[SKU|t1|name]].name", "[[SKU|t1|abc]].abc");
class Entity {
  constructor() {
  }
  static get schema() {
    return schemas[this.name];
  }
  static get tableName() {
    return this.schema.tableName;
  }
  static belongsTo(entityClass, propName) {
    let map = this.produceNameMap();
    return getKnexInstance().from(`\`${entityClass.tableName}\` AS xxxx`).where(getKnexInstance().raw("?? = ??", [propName, entityClass.schema.primaryKey.name]));
  }
  static hasMany(entityClass, propName) {
  }
  static produceNameMap() {
    let randomName = makeid(5);
    return this.schema.fields.reduce((acc, f) => {
      acc[f.name] = `${randomName}.${f.name}`;
      return acc;
    }, {
      "_": `${this.schema.tableName} As ${randomName}`,
      "all": `${randomName}.*`
    });
  }
  static get(func) {
    return __async(this, null, function* () {
      let map = this.produceNameMap();
      let stmt = getKnexInstance().from(map._);
      stmt = func(stmt, map);
      return stmt.toString();
    });
  }
  static getOne() {
  }
  static Array() {
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Entity,
  More,
  Schema,
  Select,
  Types,
  configure
});
//# sourceMappingURL=index.js.map
