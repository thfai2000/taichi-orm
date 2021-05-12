var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
  Select: () => Select,
  Types: () => Types,
  configure: () => configure
});
var import_knex = __toModule(require("knex"));
var fs = __toModule(require("fs"));
let config = {
  modelsPath: "models/"
};
const configure = function(newConfig) {
  return __async(this, null, function* () {
    config = newConfig;
    let files = fs.readdirSync(config.modelsPath);
    yield Promise.all(files.map((file) => __async(this, null, function* () {
      if (file.endsWith(".js")) {
        let path = config.modelsPath + "/" + file;
        path = path.replace(/\.js$/, "");
        console.log("load model file:", path);
        let entityClass = require(path);
        entityClass.default.register();
      }
    })));
  });
};
const Types = {
  AutoIncrement: ["bigint", "AutoIncrement"],
  String: (length, nullable) => [`varchar(${length})`, nullable ? "null" : "not null"],
  StringNull: ["varchar(255)", "null"],
  StringNotNull: ["varchar(255)", "not null"],
  Number: [],
  Date: [],
  arrayOf: function(entity) {
  }
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
  let stmt = (0, import_knex.default)({client: "mysql2"}).select(...args);
  if (distinctNames.length === 1) {
    stmt = stmt.from(distinctNames[0]);
  }
  console.log(stmt.toSQL());
  return stmt;
};
Select("[[SKU|t1|name]].name", "[[SKU|t1|abc]].abc");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Select,
  Types,
  configure
});
//# sourceMappingURL=index.js.map
