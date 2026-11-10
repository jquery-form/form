// Prints size and complexity metrics for the plugin source, for the before-and-after columns in
// docs/metrics.md. Build size is measured separately (`gzip -c | wc -c`).
//
//   npm run metrics                 every src/*.js in the working tree
//   npm run metrics -- v4.3.0       every src/*.js at a git ref (older refs have one file)
//   npm run metrics -- path/to.js   any one file
//
// Several files are summed (lines, functions, complexity); hot spots are labeled file:line and
// public members are the union. The source is formatted with the repo's Prettier config before
// counting, so line counts do not depend on how a given version was formatted.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { Linter } from "eslint";
import prettier from "prettier";

const SOURCE = "src/jquery.form.js";

function load(arg) {
  if (!arg) {
    const files = readdirSync("src")
      .filter((name) => name.endsWith(".js"))
      .sort()
      .map((name) => `src/${name}`);
    return { label: "src/*.js", files: files.map((file) => [file, readFileSync(file, "utf8")]) };
  }
  if (existsSync(arg)) {
    return { label: arg, files: [[arg, readFileSync(arg, "utf8")]] };
  }
  const listed = execFileSync("git", ["ls-tree", "--name-only", arg, "src/"], { encoding: "utf8" })
    .split("\n")
    .filter((file) => file.endsWith(".js"))
    .sort();
  const files = listed.length ? listed : [SOURCE];
  return {
    label: `${files.length > 1 ? "src/*.js" : files[0]} at ${arg}`,
    files: files.map((file) => [
      file,
      execFileSync("git", ["show", `${arg}:${file}`], { encoding: "utf8" }),
    ]),
  };
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

const { label, files } = load(process.argv[2]);
const config = await prettier.resolveConfig(SOURCE);
const lines = { physical: 0, code: 0, comment: 0 };
const complexity = [];
const depth = [];
const members = { fn: new Set(), statics: new Set() };

for (const [file, source] of files) {
  const formatted = await prettier.format(source, { ...config, filepath: SOURCE });
  const { messages, sourceCode } = lintMessages(formatted);
  const counted = countLines(sourceCode);
  const at = (m) => ({ ...m, line: files.length > 1 ? `${file}:${m.line}` : m.line });
  for (const key of Object.keys(lines)) {
    lines[key] += counted[key];
  }
  complexity.push(...ruleValues(messages, "complexity", /complexity of (\d+)/).map(at));
  depth.push(...ruleValues(messages, "max-depth", /too deeply \((\d+)\)/));
  const found = publicMembers(formatted);
  found.fn.forEach((name) => members.fn.add(name));
  found.statics.forEach((name) => members.statics.add(name));
}
members.fn = [...members.fn].sort();
members.statics = [...members.statics].sort();
const values = complexity.map((c) => c.value);
const total = values.reduce((sum, n) => sum + n, 0);
const largest = [...complexity].sort((a, b) => b.value - a.value).slice(0, 5);

const rows = [
  ["Source", `${label} (${files.length} file${files.length > 1 ? "s" : ""})`],
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
