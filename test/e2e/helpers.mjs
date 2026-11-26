import { expect } from "@playwright/test";

let counter = 0;

// A fresh request id per submission pair, so parallel tests never read each other's requests.
export function requestId(testInfo) {
  counter += 1;
  return `${testInfo.workerIndex}-${testInfo.testId}-${counter}`;
}

// Waits until the server recorded `count` requests for `id`, and returns them.
export async function requests(request, id, count) {
  let list = [];
  await expect
    .poll(
      async () => {
        list = await (await request.get(`/requests?id=${encodeURIComponent(id)}`)).json();
        return list.length;
      },
      { timeout: 10000 }
    )
    .toBeGreaterThanOrEqual(count);
  return list;
}

// [name, kind, value] triples, as the shared known differences expect them (files by name).
export function entries(fields) {
  return (fields || []).map((f) => [f.name, f.kind, f.value]);
}

// Files with their type and bytes.
export function files(fields) {
  return (fields || []).filter((f) => f.kind === "file").map((f) => [f.name, f.value, f.base64]);
}

// "multipart", "urlencoded", or "none" for a request without a form body.
export function encoding(recorded) {
  const type = recorded.headers["content-type"] || "";
  if (/^multipart\/form-data/i.test(type)) {
    return "multipart";
  }
  return /^application\/x-www-form-urlencoded/i.test(type) ? "urlencoded" : "none";
}

// The fields a request carries: the parsed body, or the query string for GET.
export function sent(recorded) {
  return recorded.method === "GET" ? recorded.query : recorded.fields;
}

// Submits the current form natively, then through the plugin; returns both recorded requests and
// the plugin's callbacks.
export async function submitBoth(page, request, id, options) {
  await page.evaluate(() => window.e2e.nativeSubmit());
  await requests(request, id, 1);
  const result = await page.evaluate((o) => window.e2e.pluginSubmit(o), options || {});
  // An upload that throws before it posts sends nothing.
  if (/Error/.test(result.error || "")) {
    return { native: (await requests(request, id, 1))[0], plugin: null, result };
  }
  const [native, plugin] = await requests(request, id, 2);
  return { native, plugin, result };
}

// Compares the plugin's request with the native one after the shared known differences.
export async function expectSameFields(page, native, plugin, context) {
  const transport = {
    plugin: encoding(plugin),
    native: encoding(native),
    iframe: !plugin.headers["x-requested-with"],
  };
  const pair = await page.evaluate(
    ([p, n, t]) => window.e2e.normalize(p, n, t),
    [entries(sent(plugin)), entries(sent(native)), transport]
  );
  const normalized = `normalized plugin: ${JSON.stringify(pair.plugin)}\nnormalized native: ${JSON.stringify(pair.native)}`;
  expect(pair.plugin, `unlisted difference\n${context}\n${normalized}`).toEqual(pair.native);
}

export async function openPage(page) {
  await page.goto("/page");
  await page.waitForFunction(() => window.e2e && window.jQuery && window.jQuery.fn.ajaxSubmit);
}
