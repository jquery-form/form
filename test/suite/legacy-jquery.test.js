import { afterAll, assert, beforeAll, describe, it } from "vitest";
import { resetFixture, selectFiles } from "./helpers.js";

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
});
