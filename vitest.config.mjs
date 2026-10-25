import { readFile } from "node:fs/promises";
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

// Surface pages must load files as consumers would, without Vite rewriting bare imports.
const rawFiles = serveFiles(
  "raw-files",
  /^\/raw\/((?:dist|node_modules)\/[\w./@-]+\.m?js)$/,
  (file) => file,
  { "Content-Type": "text/javascript" }
);

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
    },
    projects: [
      {
        plugins: [ajaxXmlFixtures, ajaxFixtures],
        test: {
          name: "suite",
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
          include: ["test/surfaces/commonjs.test.js"],
          environment: "node",
        },
      },
    ],
  },
});
