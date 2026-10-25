const assert = require("node:assert");

const current = require("../src/jquery.form.js");
const built = require("./dist/jquery.form.js");

assert.strictEqual(typeof built, typeof current, "CommonJS export type matches src");
assert.strictEqual(built.length, current.length, "CommonJS factory arity matches src");
console.log(`CommonJS contract preserved: factory(${built.length} args)`);
