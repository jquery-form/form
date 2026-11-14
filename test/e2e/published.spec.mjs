import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { requestId, requests } from "./helpers.mjs";

// The packed tarball (scripts/pack-fixture.mjs), loaded by the entry points its package.json
// names, through each loader. Every loader runs the same smoke checks, so the minified build
// must give the same results as the plain one.
const jqueryFile = resolve(
  import.meta.dirname,
  "../..",
  process.env.JQUERY_FILE || "node_modules/jquery/dist/jquery.js"
);
const jqueryVersion = readFileSync(jqueryFile, "utf8").match(
  /jQuery JavaScript Library v([\w.-]+)/
)[1];
const hasModuleBuild = /^[4-9]\./.test(jqueryVersion);

const LOADERS = [
  { name: "a script tag", path: "/published/script", value: "jQuery", global: "same" },
  {
    name: "a script tag, minified",
    path: "/published/script?min",
    value: "jQuery",
    global: "same",
  },
  { name: "RequireJS", path: "/published/amd", value: "undefined", global: "same" },
  { name: "RequireJS, minified", path: "/published/amd?min", value: "undefined", global: "same" },
  {
    name: "an import map",
    path: "/published/esm",
    value: "jQuery",
    // jQuery 4's module build sets no global; older versions load as a script and export it.
    global: hasModuleBuild ? "none" : "same",
  },
];

for (const loader of LOADERS) {
  test.describe(`when the packed plugin is loaded by ${loader.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(loader.path);
      await page.waitForFunction(() => window.published && window.published.describe);
      await page.waitForFunction(() => {
        try {
          return !!window.published.describe();
        } catch {
          return false;
        }
      });
    });

    test("should install the public API on the jQuery the loader returns", async ({ page }) => {
      // Arrange: the page loaded the plugin.

      // Act
      const described = await page.evaluate(() => window.published.describe());

      // Assert
      expect(described).toEqual({
        loader: loader.path.slice(11).replace("?min", ""),
        jquery: jqueryVersion,
        missing: [],
        staticFieldValue: "function",
        debug: false,
        value: loader.value,
        global: loader.global,
      });
    });

    test("should post a form over XHR with ajaxSubmit", async ({ page, request }, testInfo) => {
      // Arrange
      const id = requestId(testInfo);

      // Act
      const result = await page.evaluate((url) => window.published.xhr(url), `/r/${id}/json`);

      // Assert
      expect(result.calls, result.error).toEqual(["success", "complete"]);
      expect(result.data).toEqual({ ok: true, text: "ü" });
      const [sent] = await requests(request, id, 1);
      expect(sent.headers["x-requested-with"]).toBe("XMLHttpRequest");
      expect(sent.fields).toEqual([
        { name: "text", kind: "text", value: "plain ü" },
        { name: "pick", kind: "text", value: "b" },
      ]);
    });

    test("should upload a file through the iframe with ajaxForm", async ({
      page,
      request,
    }, testInfo) => {
      // Arrange
      const id = requestId(testInfo);

      // Act
      const result = await page.evaluate((url) => window.published.upload(url), `/r/${id}/json`);

      // Assert
      expect(result.calls, result.error).toEqual(["success", "complete"]);
      expect(result.data).toEqual({ ok: true, text: "ü" });
      const [sent] = await requests(request, id, 1);
      expect(sent.headers["x-requested-with"]).toBeUndefined();
      expect(sent.fields.map((f) => [f.name, f.kind, f.value])).toEqual([
        ["text", "text", "plain"],
        ["upload", "file", "a.txt"],
        ["go", "text", "clicked"],
      ]);
      expect(Buffer.from(sent.fields[1].base64, "base64").toString()).toBe("file bytes");
    });
  });
}
