import { expect, test } from "@playwright/test";
import { SEEDS } from "../shared/oracle-forms.js";
import {
  encoding,
  entries,
  expectSameFields,
  openPage,
  requestId,
  sent,
  submitBoth,
} from "./helpers.mjs";

// The serialization oracle's seeded forms, posted natively and through the plugin to the server.
// The plugin's request must carry what the native one does, modulo the known differences.
const MODES = [
  { name: "a urlencoded XHR post", enctype: "application/x-www-form-urlencoded", options: {} },
  { name: "a multipart XHR post", enctype: "multipart/form-data", options: {} },
  { name: "an iframe upload", enctype: "multipart/form-data", options: { iframe: true } },
];

// Known failures: the plugin fails where the native submit posts. Each has an ID and a matcher;
// the test then pins the failure, so a fix makes it fail until the entry is removed.
const KNOWN_FAILURES = [];

test.describe("seeded forms posted end to end", () => {
  test.beforeEach(async ({ page }) => {
    await openPage(page);
  });

  for (const mode of MODES) {
    for (const seed of SEEDS) {
      test(`when the form of seed ${seed} is sent as ${mode.name}, it should reach the server as a native submit does`, async ({
        page,
        request,
      }, testInfo) => {
        const id = requestId(testInfo);
        const form = await page.evaluate(
          ([s, attributes]) => window.e2e.generate(s, attributes),
          [seed, { action: `/r/${id}/ok`, method: "post", enctype: mode.enctype }]
        );

        const { native, plugin, result } = await submitBoth(page, request, id, mode.options);

        const known = KNOWN_FAILURES.filter((k) => k.matches(result, mode));
        if (known.length) {
          testInfo.annotations.push({ type: "known failure", description: known[0].id });
          expect(plugin).toBeNull();
          expect(result.calls).toEqual(["error", "complete"]);
          return;
        }
        const context = [
          `seed ${seed}, ${mode.name}`,
          `form: ${form.html}`,
          `plugin ${plugin.headers["content-type"]}: ${JSON.stringify(entries(sent(plugin)))}`,
          `native ${native.headers["content-type"]}: ${JSON.stringify(entries(sent(native)))}`,
        ].join("\n");
        expect(result.calls, `${context}\n${result.error}`).toEqual(["success", "complete"]);
        expect(plugin.method, context).toBe("POST");
        if (mode.enctype === "multipart/form-data") {
          expect(encoding(plugin), context).toBe("multipart");
        }
        await expectSameFields(page, native, plugin, context);
      });
    }
  }
});
