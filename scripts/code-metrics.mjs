// Prints size and complexity metrics for the plugin source, for the before-and-after columns in
// docs/metrics.md. Build size is measured separately (`gzip -c | wc -c`).
//
//   npm run metrics                 src/jquery.form.js in the working tree
//   npm run metrics -- v4.3.0       src/jquery.form.js at a git ref
//   npm run metrics -- path/to.js   any one file
//
// The source is formatted with the repo's Prettier config before counting, so line counts do not
// depend on how a given version was formatted.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { Linter } from "eslint";
import prettier from "prettier";

const SOURCE = "src/jquery.form.js";

function load(arg) {
  if (!arg) {
    return { label: SOURCE, source: readFileSync(SOURCE, "utf8") };
  }
  if (existsSync(arg)) {
    return { label: arg, source: readFileSync(arg, "utf8") };
  }
  const source = execFileSync("git", ["show", `${arg}:${SOURCE}`], { encoding: "utf8" });
  return { label: `${SOURCE} at ${arg}`, source };
}

function lintMessages(code) {
  const linter = new Linter();
  const config = {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: /^\s*(import|export)\s/m.test(code) ? "module" : "script",
    },
    rules: { complexity: ["warn", 0], "max-depth": ["warn", 0] },
  };
  // Older sources carry `/* eslint-disable */`; it must not hide the measurements.
  const messages = linter.verify(code, config, { allowInlineConfig: false });
  const fatal = messages.find((m) => m.fatal);
  if (fatal) {
    throw new Error(`cannot parse source: ${fatal.message} (line ${fatal.line})`);
  }
  return { messages, sourceCode: linter.getSourceCode() };
}

function countLines(sourceCode) {
  const lineSet = (nodes) => {
    const lines = new Set();
    for (const node of nodes) {
      for (let line = node.loc.start.line; line <= node.loc.end.line; line++) {
        lines.add(line);
      }
    }
    return lines;
  };
  const code = lineSet(sourceCode.ast.tokens);
  const comment = [...lineSet(sourceCode.getAllComments())].filter((line) => !code.has(line));
  return { physical: sourceCode.lines.length, code: code.size, comment: comment.length };
}

function ruleValues(messages, ruleId, pattern) {
  return messages
    .filter((m) => m.ruleId === ruleId)
    .map((m) => ({ value: Number(m.message.match(pattern)[1]), line: m.line }));
}

function publicMembers(code) {
  const fn = new Set([...code.matchAll(/\$\.fn\.(\w+)\s*=(?!=)/g)].map((m) => m[1]));
  const statics = new Set(
    [...code.matchAll(/\$\.(?!fn\b)(\w+)\s*=(?!=)/g)].map((m) => m[1]).filter((n) => n !== "active")
  );
  return { fn: [...fn].sort(), statics: [...statics].sort() };
}

const { label, source } = load(process.argv[2]);
const config = await prettier.resolveConfig(SOURCE);
const formatted = await prettier.format(source, { ...config, filepath: SOURCE });
const { messages, sourceCode } = lintMessages(formatted);
const lines = countLines(sourceCode);
const complexity = ruleValues(messages, "complexity", /complexity of (\d+)/);
const depth = ruleValues(messages, "max-depth", /too deeply \((\d+)\)/);
const values = complexity.map((c) => c.value);
const total = values.reduce((sum, n) => sum + n, 0);
const largest = [...complexity].sort((a, b) => b.value - a.value).slice(0, 5);
const members = publicMembers(formatted);

const rows = [
  ["Source", label],
  ["Lines (physical, after Prettier)", lines.physical],
  ["Code lines", lines.code],
  ["Comment-only lines", lines.comment],
  ["Functions", complexity.length],
  ["Cyclomatic complexity, total", total],
  ["Cyclomatic complexity, mean", (total / complexity.length).toFixed(2)],
  ["Cyclomatic complexity, max", Math.max(...values)],
  ["Functions with complexity > 10", values.filter((n) => n > 10).length],
  ["Largest (complexity at line)", largest.map((c) => `${c.value} at ${c.line}`).join(", ")],
  ["Max block nesting depth", Math.max(0, ...depth.map((d) => d.value))],
  [`$.fn members (${members.fn.length})`, members.fn.join(", ")],
  [`$ members (${members.statics.length})`, members.statics.join(", ")],
];
const width = Math.max(...rows.map(([name]) => name.length));
for (const [name, value] of rows) {
  console.log(`${name.padEnd(width)}  ${value}`);
}
