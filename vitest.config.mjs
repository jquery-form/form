import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

function serveFiles(name, pattern, toPath, headers = {}) {
  return {
    name,
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const match = req.url.match(pattern);
        if (!match) {
          return next();
        }
        try {
          const body = await readFile(new URL(toPath(match[1]), import.meta.url));
          for (const [header, value] of Object.entries(headers)) {
            res.setHeader(header, value);
          }
          res.end(body);
        } catch {
          res.statusCode = 404;
          res.end("not found");
        }
      });
    },
  };
}

// test/test.js requests fixtures by several relative paths (ajax/x, test/ajax/x).
const ajaxFixtures = serveFiles(
  "ajax-fixtures",
  /\/ajax\/([\w.-]+)/,
  (file) => `test/ajax/${file}`
);

// Iframe documents are only parsed as XML when served with an XML content type.
const ajaxXmlFixtures = serveFiles(
  "ajax-xml-fixtures",
  /\/ajax\/([\w.-]+\.xml)$/,
  (file) => `test/ajax/${file}`,
  { "Content-Type": "application/xml" }
);

// A real server labels HTML (iframe fixtures stay unlabeled so the browser sniffs them); without it jQuery 1.7.2 hands back an XMLDocument for the response.
const ajaxHtmlFixtures = serveFiles(
  "ajax-html-fixtures",
  /\/ajax\/((?!iframe-)[\w.-]+\.html)(\?.*)?$/,
  (file) => `test/ajax/${file}`,
  { "Content-Type": "text/html" }
);

// Surface pages must load files as consumers would, without Vite rewriting bare imports.
const rawFiles = serveFiles(
  "raw-files",
  /^\/raw\/((?:dist|node_modules)\/[\w./@-]+\.m?js)$/,
  (file) => file,
  { "Content-Type": "text/javascript" }
);

const jqueryEsm = new URL("./test/jquery-esm.js", import.meta.url);

// The matrix points JQUERY_FILE at another classic jQuery build (see scripts/fetch-jquery.sh).
const jqueryFile = fileURLToPath(
  new URL(
    process.env.JQUERY_FILE || "./node_modules/jquery/dist/jquery.js",
    `file://${process.cwd()}/`
  )
);

// jQuery builds are classic scripts that set window.jQuery. Appending an export gives the suite a
// default import without Vite's CommonJS interop, for every version in the matrix.
const jqueryAsModule = {
  name: "jquery-as-module",
  enforce: "pre",
  transform(code, id) {
    if (id.split("?")[0] === jqueryFile) {
      return { code: `${code}\nexport default window.jQuery;\n`, map: null };
    }
  },
};

const browser = () => ({
  enabled: true,
  headless: true,
  provider: playwright(),
  instances: [{ browser: "chromium" }],
});

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.js"],
      reporter: ["text-summary", "html"],
      // Below 100% only for the source branches listed in docs/research/coverage-gaps.md.
      thresholds: {
        lines: 98.14,
        branches: 96.41,
        functions: 98.27,
        statements: 98.17,
      },
    },
    projects: [
      {
        plugins: [jqueryAsModule, ajaxXmlFixtures, ajaxHtmlFixtures, ajaxFixtures],
        test: {
          name: "suite",
          // Keeps Vite's CommonJS interop wrapper out of the plugin's coverage.
          alias: [
            { find: /^jquery$/, replacement: fileURLToPath(jqueryEsm) },
            { find: /^jquery\/dist\/jquery\.js$/, replacement: jqueryFile },
          ],
          globals: true,
          include: ["test/test.js"],
          setupFiles: ["test/setup.js"],
          browser: browser(),
        },
      },
      {
        plugins: [rawFiles],
        test: {
          name: "surfaces",
          include: ["test/surfaces/browser.test.js"],
          browser: browser(),
        },
      },
      {
        test: {
          name: "commonjs",
          include: ["test/surfaces/commonjs.test.js", "test/surfaces/manifests.test.js"],
          environment: "node",
        },
      },
    ],
  },
});
