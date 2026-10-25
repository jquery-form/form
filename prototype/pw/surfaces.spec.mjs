import { test, expect } from "@playwright/test";

const jq = "/prototype/node_modules/jquery/dist/jquery.js";
const registered = () => typeof window.jQuery?.fn.ajaxSubmit === "function";

test.beforeEach(async ({ page }) => {
  await page.goto("/prototype/pw/");
});

test("when loaded by script tag, it should register $.fn.ajaxSubmit on the global jQuery", async ({ page }) => {
  await page.setContent(`<script src="${jq}"></script><script src="/prototype/dist/jquery.form.min.js"></script>`);

  expect(await page.evaluate(registered)).toBe(true);
});

test("when loaded through AMD, it should register on the jquery module", async ({ page }) => {
  await page.setContent(`<script src="/prototype/node_modules/requirejs/require.js"></script>`);

  const ok = await page.evaluate(() => new Promise((resolve) => {
    window.require.config({ paths: { jquery: "/prototype/node_modules/jquery/dist/jquery", form: "/prototype/dist/jquery.form" } });
    window.require(["jquery", "form"], ($) => resolve(typeof $.fn.ajaxSubmit === "function"));
  }));

  expect(ok).toBe(true);
});

test("when imported as ESM, it should register on the imported jquery and export it", async ({ page }) => {
  await page.setContent(`<script type="importmap">{"imports":{"jquery":"/prototype/node_modules/jquery4/dist-module/jquery.module.js"}}</script>
    <script type="module">import $ from "jquery"; import form from "/prototype/dist/jquery.form.mjs";
    window.result = typeof $.fn.ajaxSubmit === "function" && form === $;</script>`);

  await page.waitForFunction(() => "result" in window);

  expect(await page.evaluate(() => window.result)).toBe(true);
});
