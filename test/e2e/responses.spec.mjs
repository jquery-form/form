import { expect, test } from "@playwright/test";
import { openPage, requestId, requests } from "./helpers.mjs";

// Server responses through the plugin's callbacks. No native counterpart: hand-written expectations.
const FORM = `<form method="post"><input name="a" value="1" /><input type="file" name="f" /></form>`;

const TRANSPORTS = [
  { name: "an XHR post", options: {}, iframe: false },
  { name: "an iframe upload", options: { iframe: true }, iframe: true },
];

async function submit(page, request, testInfo, response, options) {
  const id = requestId(testInfo);
  await page.evaluate(
    ([html, action]) => window.e2e.build(html, { action: action }, null),
    [FORM, `/r/${id}/${response}`]
  );
  const result = await page.evaluate((o) => window.e2e.pluginSubmit(o), options);
  await requests(request, id, 1);
  return result;
}

test.describe("responses the plugin delivers", () => {
  test.beforeEach(async ({ page }) => {
    await openPage(page);
  });

  for (const transport of TRANSPORTS) {
    test.describe(`when ${transport.name} gets a response`, () => {
      test("with JSON and dataType json, it should pass the parsed object to success", async ({
        page,
        request,
      }, testInfo) => {
        const options = Object.assign({ dataType: "json" }, transport.options);

        const result = await submit(page, request, testInfo, "json", options);

        expect(result.calls).toEqual(["success", "complete"]);
        expect(result.data).toEqual({ ok: true, text: "ü" });
      });

      test("with XML and dataType xml, it should pass the XML document to success", async ({
        page,
        request,
      }, testInfo) => {
        const options = Object.assign({ dataType: "xml" }, transport.options);

        const result = await submit(page, request, testInfo, "xml", options);

        expect(result.calls).toEqual(["success", "complete"]);
        expect(result.data).toEqual({ xml: "root", text: "ü" });
      });

      test("with HTML, it should pass the markup to success", async ({
        page,
        request,
      }, testInfo) => {
        const options = Object.assign({ dataType: "html" }, transport.options);

        const result = await submit(page, request, testInfo, "html", options);

        expect(result.calls).toEqual(["success", "complete"]);
        expect(result.data).toBe('<p id="answer">ü</p>');
      });

      test("with plain text, it should pass the text to success", async ({
        page,
        request,
      }, testInfo) => {
        const options = Object.assign({ dataType: "text" }, transport.options);

        const result = await submit(page, request, testInfo, "text", options);

        expect(result.calls).toEqual(["success", "complete"]);
        expect(result.data).toBe("plain ü");
      });

      test("with a script and dataType script, it should run the script once", async ({
        page,
        request,
      }, testInfo) => {
        const options = Object.assign({ dataType: "script" }, transport.options);

        const result = await submit(page, request, testInfo, "script", options);

        expect(result.calls).toEqual(["success", "complete"]);
        expect(await page.evaluate(() => window.e2eScriptRuns)).toBe(1);
      });
    });
  }

  test.describe("when an XHR post gets an error status", () => {
    for (const status of [404, 500]) {
      test(`with ${status}, it should call error with the status and the response text`, async ({
        page,
        request,
      }, testInfo) => {
        const result = await submit(page, request, testInfo, `status-${status}`, {});

        expect(result.calls).toEqual(["error", "complete"]);
        expect(result.status).toBe("error");
        expect(result.httpStatus).toBe(status);
        expect(result.responseText).toBe(status === 404 ? "missing" : "broken");
      });
    }
  });

  test.describe("when an iframe upload gets an error status", () => {
    test("it should call success with the error page, since a frame cannot see the status", async ({
      page,
      request,
    }, testInfo) => {
      const options = { iframe: true, dataType: "text" };

      const result = await submit(page, request, testInfo, "status-500", options);

      expect(result.calls).toEqual(["success", "complete"]);
      expect(result.data).toBe("broken");
    });
  });

  test.describe("when an iframe upload gets JSON wrapped in a textarea", () => {
    test("it should pass the parsed object to success", async ({ page, request }, testInfo) => {
      const options = { iframe: true, dataType: "json" };

      const result = await submit(page, request, testInfo, "textarea-json", options);

      expect(result.calls).toEqual(["success", "complete"]);
      expect(result.data).toEqual({ ok: true, text: "ü" });
    });
  });
});
