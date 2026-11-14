import { expect, test } from "@playwright/test";
import {
  encoding,
  entries,
  expectSameFields,
  files,
  openPage,
  requestId,
  requests,
  sent,
} from "./helpers.mjs";

// Hand-written forms through each transport: the plugin's request must equal a native submit of
// the same form after parsing, modulo the known differences; extra data has no native counterpart.
const FORM = `<form>
  <input name="text" value="plain words" />
  <input name="unicode" value="ü 日本 😀" />
  <textarea name="lines"></textarea>
  <input type="checkbox" name="check" value="yes" checked />
  <input type="checkbox" name="unchecked" value="no" />
  <select name="pick"><option>a</option><option selected>b</option></select>
  <select name="many" multiple><option selected>x</option><option selected>y</option></select>
  <input type="file" name="upload" />
  <button type="submit" name="go" value="clicked">Go</button>
</form>`;

const BYTES = Array.from({ length: 256 }, (v, i) => i);

const TRANSPORTS = [
  { name: "a urlencoded XHR post", enctype: null, file: false, options: {} },
  { name: "a multipart XHR post", enctype: "multipart/form-data", file: true, options: {} },
  {
    name: "an iframe upload",
    enctype: "multipart/form-data",
    file: true,
    options: { iframe: true },
  },
];

async function arrange(page, id, attributes, options) {
  const settings = Object.assign({ file: false, submitter: "button[name=go]" }, options);
  await page.evaluate(
    ([html, attrs, submitter, withFile]) => {
      window.e2e.build(html, attrs, submitter);
      document.querySelector("#fixture textarea").value = "one\r\ntwo\nthree\rfour";
      if (!withFile) {
        document.querySelector("#fixture input[type=file]").remove();
      }
    },
    [
      FORM,
      Object.assign({ action: `/r/${id}/ok`, method: "post" }, attributes),
      settings.submitter,
      settings.file,
    ]
  );
  if (settings.file) {
    await page.evaluate(
      (bytes) =>
        window.e2e.setFiles("#fixture input[type=file]", [
          { name: "bytes ü.bin", type: "application/octet-stream", bytes: bytes },
        ]),
      BYTES
    );
  }
}

async function nativeSubmit(page, request, id) {
  await page.evaluate(() => window.e2e.nativeSubmit());
  return (await requests(request, id, 1))[0];
}

async function pluginSubmit(page, request, id, options, count) {
  const result = await page.evaluate((o) => window.e2e.pluginSubmit(o), options);
  expect(result.calls, result.error).toEqual(["success", "complete"]);
  return (await requests(request, id, count || 2))[(count || 2) - 1];
}

test.describe("requests the plugin sends", () => {
  test.beforeEach(async ({ page }) => {
    await openPage(page);
  });

  for (const transport of TRANSPORTS) {
    test.describe(`when a form is sent as ${transport.name}`, () => {
      test("it should send the fields, unicode, line breaks and submitter as a native submit does", async ({
        page,
        request,
      }, testInfo) => {
        const id = requestId(testInfo);
        await arrange(page, id, { enctype: transport.enctype }, { file: transport.file });

        const native = await nativeSubmit(page, request, id);
        const plugin = await pluginSubmit(page, request, id, transport.options);

        expect(plugin.method).toBe("POST");
        expect(encoding(plugin)).toBe(transport.file ? "multipart" : "urlencoded");
        await expectSameFields(page, native, plugin, transport.name);
      });

      test("it should send the form without a submitter as a native submit does", async ({
        page,
        request,
      }, testInfo) => {
        const id = requestId(testInfo);
        await arrange(
          page,
          id,
          { enctype: transport.enctype },
          { file: transport.file, submitter: null }
        );

        const native = await nativeSubmit(page, request, id);
        const plugin = await pluginSubmit(page, request, id, transport.options);

        expect(entries(sent(plugin)).map((e) => e[0])).not.toContain("go");
        await expectSameFields(page, native, plugin, transport.name);
      });

      test("it should send extraData after the form's fields", async ({
        page,
        request,
      }, testInfo) => {
        const id = requestId(testInfo);
        await arrange(page, id, { enctype: transport.enctype }, { file: transport.file });
        const options = Object.assign({}, transport.options, {
          data: { extra: "x ü\r\ny", list: ["1", "2"] },
        });

        const native = await nativeSubmit(page, request, id);
        const plugin = await pluginSubmit(page, request, id, options);

        const pluginEntries = entries(sent(plugin));
        const nativeCount = entries(sent(native)).length;
        expect(pluginEntries.length).toBe(nativeCount + 3);
        const extra = transport.options.iframe
          ? pluginEntries.filter((e) => e[0] === "extra" || e[0] === "list[]")
          : pluginEntries.slice(nativeCount);
        expect(extra).toEqual([
          ["extra", "text", "x ü\r\ny"],
          ["list[]", "text", "1"],
          ["list[]", "text", "2"],
        ]);
      });
    });
  }

  test.describe("when a file is uploaded", () => {
    for (const transport of TRANSPORTS.filter((t) => t.file)) {
      test(`as ${transport.name}, it should send the file's name, type and bytes as a native submit does`, async ({
        page,
        request,
      }, testInfo) => {
        const id = requestId(testInfo);
        await arrange(page, id, { enctype: transport.enctype }, { file: true });

        const native = await nativeSubmit(page, request, id);
        const plugin = await pluginSubmit(page, request, id, transport.options);

        expect(files(plugin.fields)).toEqual(files(native.fields));
        expect(plugin.fields.filter((f) => f.kind === "file")[0].type).toBe(
          "application/octet-stream"
        );
        expect(Buffer.from(files(plugin.fields)[0][2], "base64")).toEqual(Buffer.from(BYTES));
      });
    }
  });

  test.describe("when a form is sent urlencoded", () => {
    test("it should send the native body byte for byte", async ({ page, request }, testInfo) => {
      const id = requestId(testInfo);
      await arrange(page, id, {});

      const native = await nativeSubmit(page, request, id);
      const plugin = await pluginSubmit(page, request, id, {});

      expect(Buffer.from(plugin.base64, "base64").toString("latin1")).toBe(
        Buffer.from(native.base64, "base64").toString("latin1")
      );
      expect(plugin.headers["content-type"]).toBe(
        "application/x-www-form-urlencoded; charset=UTF-8"
      );
    });

    test("it should append string data as given", async ({ page, request }, testInfo) => {
      const id = requestId(testInfo);
      await arrange(page, id, {}, { submitter: null });

      const native = await nativeSubmit(page, request, id);
      const plugin = await pluginSubmit(page, request, id, { data: "a=1&b=%C3%BC" });

      const body = Buffer.from(plugin.base64, "base64").toString("latin1");
      expect(body).toBe(Buffer.from(native.base64, "base64").toString("latin1") + "&a=1&b=%C3%BC");
    });
  });

  test.describe("when the method is GET", () => {
    for (const transport of [TRANSPORTS[0], TRANSPORTS[2]]) {
      test(`as ${transport.name}, it should send the fields in the query string as a native submit does`, async ({
        page,
        request,
      }, testInfo) => {
        const id = requestId(testInfo);
        await arrange(page, id, { method: "get", enctype: transport.enctype });

        const native = await nativeSubmit(page, request, id);
        const plugin = await pluginSubmit(page, request, id, transport.options);

        expect(native.method).toBe("GET");
        expect(plugin.method).toBe("GET");
        expect(plugin.base64).toBe("");
        await expectSameFields(page, native, plugin, transport.name);
      });
    }

    test("with an action that has a query, it should keep the action's query, unlike a native submit", async ({
      page,
      request,
    }, testInfo) => {
      const id = requestId(testInfo);
      await arrange(page, id, { method: "get", action: `/r/${id}/ok?keep=1` }, { submitter: null });

      const native = await nativeSubmit(page, request, id);
      const plugin = await pluginSubmit(page, request, id, {});

      expect(native.query.map((f) => f.name)).not.toContain("keep");
      expect(plugin.query[0]).toEqual({ name: "keep", kind: "text", value: "1" });
      expect(plugin.query.slice(1)).toEqual(native.query);
    });
  });

  test.describe("when options override the form's method and action", () => {
    for (const transport of TRANSPORTS) {
      test(`as ${transport.name}, the method option should win over the form's method`, async ({
        page,
        request,
      }, testInfo) => {
        const id = requestId(testInfo);
        await arrange(page, id, { enctype: transport.enctype }, { file: transport.file });
        const native = await nativeSubmit(page, request, id);
        await page.evaluate(() =>
          document.querySelector("#fixture form").setAttribute("method", "get")
        );

        const plugin = await pluginSubmit(
          page,
          request,
          id,
          Object.assign({ method: "POST" }, transport.options)
        );

        expect(plugin.method).toBe("POST");
        await expectSameFields(page, native, plugin, transport.name);
      });

      test(`as ${transport.name}, the url option should win over the form's action`, async ({
        page,
        request,
      }, testInfo) => {
        const id = requestId(testInfo);
        await arrange(page, id, { enctype: transport.enctype }, { file: transport.file });
        const native = await nativeSubmit(page, request, id);
        await page.evaluate(
          (i) =>
            document.querySelector("#fixture form").setAttribute("action", `/r/${i}-unused/ok`),
          id
        );

        const plugin = await pluginSubmit(
          page,
          request,
          id,
          Object.assign({ url: `/r/${id}/ok` }, transport.options)
        );

        expect(plugin.url.split("?")[0]).toBe(native.url);
        await expectSameFields(page, native, plugin, transport.name);
      });
    }
  });
});
