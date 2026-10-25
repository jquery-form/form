import { readFileSync } from "node:fs";
import terser from "@rollup/plugin-terser";

// Stand-in for the Phase 3 source conversion: lift the plugin factory out of the hand-written UMD wrapper.
const esmFromUmd = {
  name: "esm-from-umd",
  resolveId: (id) => (id === "virtual:jquery-form" ? id : null),
  load(id) {
    if (id !== "virtual:jquery-form") return null;
    const src = readFileSync(new URL("../src/jquery.form.js", import.meta.url), "utf8");
    const start = src.indexOf("}(function ($) {") + 2;
    const end = src.lastIndexOf("}));") + 1;
    return `import jQuery from "jquery";\n(${src.slice(start, end)})(jQuery);\nexport default jQuery;\n`;
  },
};

// Rollup's generic UMD exports jQuery to CommonJS; the published contract is a (root, jQuery) factory, so reuse the original wrapper.
const classicWrapper = {
  name: "classic-wrapper",
  renderChunk(code) {
    const src = readFileSync(new URL("../src/jquery.form.js", import.meta.url), "utf8");
    const head = src.slice(0, src.indexOf("}(function ($) {") + 1);
    const body = code.replace(/^import jQuery from 'jquery';\n/m, "").replace(/^export .*\n?/gm, "");
    return `${head}(function (jQuery) {\n${body}}));\n`;
  },
};

export default {
  external: ["jquery"],
  plugins: [esmFromUmd],
  input: "virtual:jquery-form",
  output: [
    { file: "dist/jquery.form.mjs", format: "es" },
    { file: "dist/jquery.form.js", format: "es", plugins: [classicWrapper] },
    { file: "dist/jquery.form.min.js", format: "es", plugins: [classicWrapper, terser({ module: false, format: { comments: /^!/ } })] },
  ],
};
