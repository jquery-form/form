import { afterEach, describe, expect, it } from "vitest";
import $ from "jquery";
import form from "../../dist/jquery.form.mjs";

const jquery3 = "/raw/node_modules/jquery/dist/jquery.js";
const jquery4Module = "/raw/node_modules/jquery4/dist-module/jquery.module.js";

let frame;

function loadPage(body) {
  frame = document.createElement("iframe");
  frame.srcdoc = `<!doctype html><html><body>${body}</body></html>`;

  return new Promise((resolve, reject) => {
    frame.addEventListener("load", () => {
      const started = Date.now();
      (function poll() {
        if ("result" in frame.contentWindow) {
          resolve(frame.contentWindow.result);
        } else if (Date.now() - started > 5000) {
          reject(new Error("page never set window.result"));
        } else {
          setTimeout(poll, 20);
        }
      })();
    });
    document.body.appendChild(frame);
  });
}

afterEach(() => {
  frame?.remove();
});

describe("when the classic build is loaded by a script tag", () => {
  it("should register $.fn.ajaxSubmit on the global jQuery", async () => {
    const page = `<script src="${jquery3}"></script>
      <script src="/raw/dist/jquery.form.min.js"></script>
      <script>window.result = typeof jQuery.fn.ajaxSubmit;</script>`;

    const result = await loadPage(page);

    expect(result).toBe("function");
  });
});

describe("when the classic build is loaded through AMD", () => {
  it("should register on the jquery module and define no value", async () => {
    const page = `<script src="/raw/node_modules/requirejs/require.js"></script>
      <script>
        require.config({ paths: { jquery: "${jquery3.slice(0, -3)}", form: "/raw/dist/jquery.form" } });
        require(["jquery", "form"], function ($, form) {
          window.result = { plugin: typeof $.fn.ajaxSubmit, value: form };
        });
      </script>`;

    const result = await loadPage(page);

    expect(result).toEqual({ plugin: "function", value: undefined });
  });
});

describe("when the module build is imported natively with jQuery 4", () => {
  it("should register on the imported jQuery and export it as default", async () => {
    const page = `<script type="importmap">{ "imports": { "jquery": "${jquery4Module}" } }</script>
      <script type="module">
        import $ from "jquery";
        import form from "/raw/dist/jquery.form.mjs";
        window.result = { plugin: typeof $.fn.ajaxSubmit, sameJQuery: form === $ };
      </script>`;

    const result = await loadPage(page);

    expect(result).toEqual({ plugin: "function", sameJQuery: true });
  });
});

describe("when the module build is bundled with the CommonJS jQuery 3", () => {
  it("should register on the bundled jQuery and export it as default", () => {
    const plugin = typeof $.fn.ajaxSubmit;

    expect(plugin).toBe("function");
    expect(form).toBe($);
  });
});
