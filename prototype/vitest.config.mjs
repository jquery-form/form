import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));

const ajaxFixtures = {
  name: "ajax-fixtures",
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const match = req.url.match(/\/ajax\/([\w.-]+)/);
      if (!match) return next();
      try {
        res.end(await readFile(`${repo}test/ajax/${match[1]}`));
      } catch {
        res.statusCode = 404;
        res.end("not found");
      }
    });
  },
};

export default defineConfig({
  plugins: [ajaxFixtures],
  server: { fs: { allow: [repo] } },
  test: {
    globals: true,
    include: process.env.PROBE ? ["probe/*.js"] : ["../test/test.js", "shared/*.js"],
    setupFiles: ["./vt/setup.js"],
    browser: { enabled: true, headless: true, provider: playwright(), instances: [{ browser: "chromium" }] },
    coverage: {
      provider: "v8",
      include: ["../src/jquery.form.js"],
      allowExternal: true,
      reporter: ["text-summary"],
      reportsDirectory: "./coverage-vitest",
    },
  },
});
