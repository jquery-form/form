// Node side of the published-file tests (node --test): the packed tarball, installed into the
// fixture projects by scripts/pack-fixture.mjs, loaded by package name from CommonJS and from an
// ES module, with jsdom as the window. Each case runs in its own process, so globals and module
// caches never leak between cases.
import { after, before, describe, it } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, "../..");
const packDir = resolve(root, process.env.JQUERY_FORM_PACK_DIR || ".pack");
const jqueryFile = resolve(root, process.env.JQUERY_FILE || "node_modules/jquery/dist/jquery.js");
const jqueryVersion = readFileSync(jqueryFile, "utf8").match(
  /jQuery JavaScript Library v([\w.-]+)/
)[1];
const FIXTURE_VERSIONS = ["3.7.1", "4.0.0"];

let server;
let origin;

// Answers every request with the urlencoded body it received, as JSON.
before(async () => {
  server = createServer((req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ method: req.method, body: Buffer.concat(chunks).toString() }));
    });
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

// Code shared by every case: a jsdom window on the test server's origin, and the smoke checks.
const PRELUDE = `
const { JSDOM } = require(process.env.JSDOM_PATH);
const dom = new JSDOM('<form method="post" action="/echo"><input name="text" value="plain ü" />' +
  '<select name="pick"><option>a</option><option selected>b</option></select></form>',
  { url: process.env.ORIGIN + "/", runScripts: "outside-only" });
// jsdom keeps the process alive, so a case exits once it reports its result.
function report(result) {
  console.log(JSON.stringify(result));
  process.exit(0);
}
function smoke($, value) {
  const form = dom.window.document.querySelector("form");
  return new Promise((done) => {
    $(form).ajaxSubmit({
      dataType: "json",
      success: (data) => done({ data }),
      error: (xhr, status, error) => done({ error: String(error || status) }),
    });
  }).then((result) => ({
    jquery: $.fn.jquery,
    ownWindow: $(form)[0].ownerDocument === dom.window.document,
    api: ["ajaxSubmit", "ajaxForm", "formSerialize", "fieldValue", "resetForm"].every(
      (name) => typeof $.fn[name] === "function"),
    value: value === $ ? "jQuery" : typeof value,
    serialized: $(form).formSerialize(),
    ...result,
  }));
}
`;

// Runs a case in a fresh Node process in `cwd`; resolves the JSON it prints last. Asynchronous,
// so this process keeps answering the case's requests.
async function run(cwd, code, type = "commonjs") {
  const source =
    type === "module"
      ? `import { createRequire } from "node:module";
         const require = createRequire(process.cwd() + "/");
         ${PRELUDE}
         ${code}`
      : `${PRELUDE}\n(async () => { ${code} })();`;
  const { stdout } = await promisify(execFile)(
    process.execPath,
    [`--input-type=${type}`, "-e", source],
    {
      cwd,
      encoding: "utf8",
      timeout: 20000,
      env: { ...process.env, JSDOM_PATH: require.resolve("jsdom"), ORIGIN: origin },
    }
  );
  return JSON.parse(stdout.trim().split("\n").pop());
}

function expected(version, value) {
  return {
    jquery: version,
    ownWindow: true,
    api: true,
    value,
    // jQuery 1's $.param writes spaces as "+", later versions as "%20".
    serialized: `text=plain${/^1\./.test(version) ? "+" : "%20"}%C3%BC&pick=b`,
    data: { method: "POST", body: "text=plain+%C3%BC&pick=b" },
  };
}

describe("when the packed package is installed", () => {
  const installed = resolve(packDir, "jquery-3.7.1/node_modules/jquery-form");

  it("should ship every file its package.json points at", () => {
    // Arrange
    const manifest = JSON.parse(readFileSync(resolve(installed, "package.json"), "utf8"));

    // Act
    const entries = [manifest.main, manifest.module, manifest.jsdelivr, manifest.unpkg];

    // Assert
    assert.deepEqual(
      entries.filter((entry) => !existsSync(resolve(installed, entry))),
      []
    );
  });
});

// Makes the jsdom window global, as a test environment such as jest-environment-jsdom does.
const GLOBALS = `globalThis.window = dom.window; globalThis.document = dom.window.document;`;
// Runs the jQuery build under test inside the jsdom window.
const EVAL_JQUERY = `dom.window.eval(require("node:fs").readFileSync(${JSON.stringify(jqueryFile)}, "utf8"));`;
// What the plugin throws when it reads a global the root it was given does not replace.
const MISSING_GLOBAL = /^(window|document) is not defined$/;
// Reports what a case threw instead of its smoke result.
const settle = (code) => `try { ${code} } catch (error) { report({ thrown: error.message }); }`;

describe("when the packed package is required from CommonJS", () => {
  const fixture = resolve(packDir, "jquery-3.7.1");

  it("should export a (root, jQuery) factory without touching a DOM", async () => {
    // Arrange
    const code = `const factory = require("jquery-form");`;

    // Act
    const result = await run(
      fixture,
      `${code} report({ type: typeof factory, length: factory.length });`
    );

    // Assert
    assert.deepEqual(result, { type: "function", length: 2 });
  });

  it(`should install on the jQuery ${jqueryVersion} it is given when a window is global`, async () => {
    // Arrange
    const code = `${GLOBALS} ${EVAL_JQUERY}
      const $ = dom.window.jQuery;
      const value = require("jquery-form")(dom.window, $);`;

    // Act
    const result = await run(fixture, `${code} report(await smoke($, value));`);

    // Assert
    assert.deepEqual(result, expected(jqueryVersion, "jQuery"));
  });

  it(`should fail on the jQuery ${jqueryVersion} it is given when no window is global`, async () => {
    // Arrange
    const code = `${EVAL_JQUERY}
      const $ = dom.window.jQuery;
      const value = require("jquery-form")(dom.window, $);`;

    // Act
    const result = await run(fixture, settle(`${code} report(await smoke($, value));`));

    // Assert: known failure, the plugin reads the global window or document (which one depends
    // on the version) instead of the root it is given.
    assert.match(result.thrown, MISSING_GLOBAL);
  });

  for (const version of FIXTURE_VERSIONS) {
    it(`should use the installed jQuery ${version} when a window is global`, async () => {
      // Arrange
      const code = `${GLOBALS} const $ = require("jquery-form")(dom.window);`;

      // Act
      const result = await run(
        resolve(packDir, `jquery-${version}`),
        `${code} report(await smoke($, $));`
      );

      // Assert
      assert.deepEqual(result, expected(version, "jQuery"));
    });

    it(`should fail to build the installed jQuery ${version} on a window that is not global`, async () => {
      // Arrange
      const code = `const $ = require("jquery-form")(dom.window);`;

      // Act
      const result = await run(
        resolve(packDir, `jquery-${version}`),
        settle(`${code} report(await smoke($, $));`)
      );

      // Assert: known failures. jQuery 3 builds on the root, then the plugin reads the global
      // document; jQuery 4 throws when required without a global window instead of returning a
      // factory, so require('jquery')(root) never runs.
      assert.match(
        result.thrown,
        version === "3.7.1" ? MISSING_GLOBAL : /^jQuery requires a window with a document$/
      );
    });
  }
});

describe("when the packed package is imported as an ES module", () => {
  for (const version of FIXTURE_VERSIONS) {
    it(`should resolve its name to the CommonJS factory (jQuery ${version})`, async () => {
      // Arrange: Node ignores the "module" field, and the package has no "exports" map.
      const code = `${GLOBALS}
        const { default: factory } = await import("jquery-form");
        const { default: $ } = await import("jquery");`;

      // Act
      const result = await run(
        resolve(packDir, `jquery-${version}`),
        `${code} const value = factory(dom.window); report(await smoke($, value));`,
        "module"
      );

      // Assert
      assert.deepEqual(result, expected(version, "jQuery"));
    });

    it(`should install the module build on the installed jQuery ${version} and export it`, async () => {
      // Arrange: the module build reads the DOM at import time, so the window must be global.
      const code = `${GLOBALS}
        const { default: value } = await import("jquery-form/dist/jquery.form.mjs");
        const { default: $ } = await import("jquery");`;

      // Act
      const result = await run(
        resolve(packDir, `jquery-${version}`),
        `${code} report(await smoke($, value));`,
        "module"
      );

      // Assert
      assert.deepEqual(result, expected(version, "jQuery"));
    });
  }
});
