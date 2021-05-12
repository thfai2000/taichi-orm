var __defProp = Object.defineProperty;
var __markAsModule = (target) => __defProp(target, "__esModule", {value: true});
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {get: all[name], enumerable: true});
};
__markAsModule(exports);
__export(exports, {
  hello: () => hello,
  myABC: () => myABC
});
function myABC() {
  return "foo bar";
}
function hello() {
  return "xxx";
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  hello,
  myABC
});
//# sourceMappingURL=index.js.map
