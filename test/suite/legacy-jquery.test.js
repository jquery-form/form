import { afterAll, assert, beforeAll, describe, it } from "vitest";
import { resetFixture, selectFiles, submitTransport } from "./helpers.js";
import classicBuild from "../../dist/jquery.form.js?raw";
import jquery3Slim from "../../node_modules/jquery/dist/jquery.slim.js?raw";
import jquery4Slim from "../../node_modules/jquery4/dist/jquery.slim.js?raw";

const pluginFields = [
  "attr2",
  "ajaxSubmit",
  "ajaxForm",
  "ajaxFormUnbind",
  "formToArray",
  "formSerialize",
  "fieldSerialize",
  "fieldValue",
  "clearForm",
  "clearFields",
  "clearInputs",
  "resetForm",
  "enable",
  "selected",
];

// Runs source as a classic script in the page, as a script tag would.
function runClassicScript(source) {
  const script = document.createElement("script");
  script.textContent = source;
  document.head.appendChild(script);
  script.remove();
}

describe("form", function () {
  resetFixture();

  describe("with jQuery older than 1.6", function () {
    let saved;

    // The plugin detects prop support once at load, so reload it while prop is missing.
    beforeAll(async function () {
      saved = { fn: {}, fieldValue: $.fieldValue, prop: $.fn.prop };
      pluginFields.forEach((name) => {
        saved.fn[name] = $.fn[name];
      });
      delete $.fn.prop;

      try {
        await import("../../src/jquery.form.js?without-prop");
      } finally {
        $.fn.prop = saved.prop;
      }
    });

    afterAll(function () {
      Object.assign($.fn, saved.fn);
      $.fieldValue = saved.fieldValue;
    });

    it("should read raw attributes through attr2", function () {
      const $form = $('<form action="relative.html"></form>');

      const action = $form.attr2("action");

      assert.strictEqual(action, "relative.html");
    });

    it("should pass getters and setters through to attr even after prop is restored", function () {
      const $form = $('<form action="relative.html" method="PUT"><input name="action"></form>');

      const values = [$form.attr2("action"), $form.attr2("method"), $form.attr2("target")];
      const result = $form.attr2("data-y", "v");

      assert.deepEqual(values, ["relative.html", "PUT", undefined]);
      assert.strictEqual(result, $form);
      assert.strictEqual($form[0].getAttribute("data-y"), "v");
    });

    it("should re-enable controls disabled before an iframe upload", async function () {
      const $form = $('<form action="ajax/iframe-text.html" method="post"></form>').appendTo(
        "#main"
      );
      const $input = $('<input name="field" value="sent">').appendTo($form);
      let disabledAtSubmit;
      const nativeSubmit = $form[0].submit;
      $form[0].submit = function () {
        disabledAtSubmit = $input[0].disabled;
        nativeSubmit.call(this);
      };

      await new Promise((resolve) =>
        $form.ajaxSubmit({
          iframe: true,
          dataType: "text",
          beforeSubmit: () => $input.attr("disabled", "disabled"),
          complete: resolve,
        })
      );
      await new Promise((resolve) => setTimeout(resolve, 150));

      assert.strictEqual(disabledAtSubmit, false);
    });
  });

  describe("when the plugin loads again", function () {
    let saved;
    let otherEnable;
    let added;
    let nodesBefore;
    let nodesAfter;

    // Removes the plugin's members (and puts another plugin's enable in place) before reloading.
    beforeAll(async function () {
      saved = { fn: {}, fieldValue: $.fieldValue };
      pluginFields.forEach((name) => {
        saved.fn[name] = $.fn[name];
        delete $.fn[name];
      });
      delete $.fieldValue;
      otherEnable = function () {};
      $.fn.enable = otherEnable;
      const fnBefore = Object.keys($.fn);
      const staticBefore = Object.keys($);
      nodesBefore = document.getElementsByTagName("*").length;

      try {
        await import("../../src/jquery.form.js?reload");
      } finally {
        nodesAfter = document.getElementsByTagName("*").length;
        added = {
          fn: Object.keys($.fn).filter((name) => !fnBefore.includes(name)),
          static: Object.keys($).filter((name) => !staticBefore.includes(name)),
        };
      }
    });

    afterAll(function () {
      Object.assign($.fn, saved.fn);
      $.fieldValue = saved.fieldValue;
    });

    it("should install every helper on $.fn and $.fieldValue, replacing an existing enable, with debug off", function () {
      const enable = $.fn.enable;

      const expected = pluginFields.filter((name) => name !== "enable");

      assert.sameMembers(added.fn, expected);
      assert.deepEqual(added.static, ["fieldValue"]);
      assert.notStrictEqual(enable, otherEnable);
      assert.strictEqual(typeof enable, "function");
      assert.strictEqual($.fn.ajaxSubmit.debug, false);
    });

    it("should add no nodes to the document when the plugin loads", function () {
      const before = nodesBefore;

      const after = nodesAfter;

      assert.strictEqual(after, before);
    });
  });

  describe("without the File API", function () {
    let saved;

    // The plugin detects the File API once at load, so reload it while input.files is missing.
    beforeAll(async function () {
      saved = { fn: {}, fieldValue: $.fieldValue };
      pluginFields.forEach((name) => {
        saved.fn[name] = $.fn[name];
      });
      const files = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "files");
      Object.defineProperty(HTMLInputElement.prototype, "files", {
        configurable: true,
        get: () => undefined,
      });

      try {
        await import("../../src/jquery.form.js?without-fileapi");
      } finally {
        Object.defineProperty(HTMLInputElement.prototype, "files", files);
      }
    });

    afterAll(function () {
      Object.assign($.fn, saved.fn);
      $.fieldValue = saved.fieldValue;
    });

    it("should send file input values as strings even after the File API returns", function () {
      const $form = $('<form><input type="file" name="up"><input type="file" name="empty"></form>');
      selectFiles($form.find("input")[0], ["x.txt"]);

      const formData = $form.formToArray();

      assert.deepEqual(formData, [
        { name: "up", value: "C:\\fakepath\\x.txt", type: "file", required: false },
        { name: "empty", value: "", type: "file", required: false },
      ]);
    });
  });

  describe("without FormData", function () {
    let saved;

    // The plugin detects FormData once at load, so reload it while window.FormData is missing.
    beforeAll(async function () {
      saved = { fn: {}, fieldValue: $.fieldValue };
      pluginFields.forEach((name) => {
        saved.fn[name] = $.fn[name];
      });
      const formData = Object.getOwnPropertyDescriptor(window, "FormData");
      Object.defineProperty(window, "FormData", { configurable: true, value: undefined });

      try {
        await import("../../src/jquery.form.js?without-formdata");
      } finally {
        Object.defineProperty(window, "FormData", formData);
      }
    });

    afterAll(function () {
      Object.assign($.fn, saved.fn);
      $.fieldValue = saved.fieldValue;
    });

    it("should use the iframe transport when a file is selected even after FormData returns", function () {
      const $form = $(
        '<form action="ajax/text.html" method="post"><input type="file" name="up"></form>'
      ).appendTo("#main");
      selectFiles($form.find("input")[0], ["x.txt"]);

      const result = submitTransport($form);

      assert.strictEqual(result.transport, "iframe");
    });

    it("should use the iframe transport when the form is multipart and has no file", function () {
      const $form = $(
        '<form action="ajax/text.html" method="post" enctype="multipart/form-data"></form>'
      ).appendTo("#main");

      const result = submitTransport($form);

      assert.strictEqual(result.transport, "iframe");
    });
  });
  // #541: the slim builds leave out $.ajax. Each slim build runs as a classic script, the classic
  // dist build registers on it, and then the page's jQuery and $ are given back.
  [
    ["3.7.1", jquery3Slim],
    ["4.0.0", jquery4Slim],
  ].forEach(function ([version, slimSource]) {
    describe("with the jQuery " + version + " slim build", function () {
      let slim;
      let globals;

      beforeAll(function () {
        globals = [window.jQuery, window.$];

        try {
          runClassicScript(slimSource);
          slim = window.jQuery;
          runClassicScript(classicBuild);
        } finally {
          window.jQuery = globals[0];
          window.$ = globals[1];
        }
      });

      it("should leave the page's jQuery and $ in place", function () {
        assert.deepEqual([window.jQuery, window.$], globals);
        assert.notStrictEqual(slim, window.jQuery);
        assert.strictEqual(slim.ajax, undefined);
        assert.strictEqual(typeof slim.fn.ajaxSubmit, "function");
      });

      it("should throw a clear error from ajaxSubmit before any event", function () {
        const $form = slim('<form action="ajax/text.html"><input name="a" value="1"></form>');
        const events = [];
        $form.on("form-pre-serialize form-submit-validate", (event) => events.push(event.type));

        const run = () => $form.ajaxSubmit({ beforeSerialize: () => events.push("hook") });

        assert.throws(
          run,
          Error,
          "jquery.form: ajaxSubmit needs the full jQuery build; this jQuery has no $.ajax"
        );
        assert.deepEqual(events, []);
      });

      it("should skip an empty selection silently", function () {
        const $empty = slim("#no-such-form");

        const result = $empty.ajaxSubmit();

        assert.strictEqual(result, $empty);
      });
    });
  });
});
