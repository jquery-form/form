import { test, expect } from "@playwright/test";
import MCR from "monocart-coverage-reports";

test("existing Mocha suite passes unchanged in Chromium", async ({ page }) => {
  await page.coverage.startJSCoverage({ resetOnNavigation: false });
  await page.goto("/test/harness.html");

  const result = await page.waitForFunction(() => {
    const r = window.__mochaRunner;
    if (!r || !r.stats || !r.stats.end) return null;
    const failures = [];
    document.querySelectorAll("#mocha .test.fail").forEach((el) => failures.push(el.querySelector("h2").textContent));
    return { passes: r.stats.passes, failures, tests: r.stats.tests };
  }, null, { timeout: 30000 });
  const stats = await result.jsonValue();

  const coverage = await page.coverage.stopJSCoverage();
  const mcr = MCR({
    name: "playwright prototype",
    outputDir: "./coverage-playwright",
    reports: ["text-summary", "html"],
    entryFilter: (entry) => entry.url.includes("/src/jquery.form.js"),
  });
  await mcr.add(coverage);
  await mcr.generate();

  console.log(JSON.stringify(stats));
  expect(stats.failures).toEqual([]);
});
