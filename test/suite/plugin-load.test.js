import { afterAll, assert, beforeAll, describe, it } from "vitest";
import { resetFixture } from "./helpers.js";
import classicBuild from "../../dist/jquery.form.js?raw";
import jquery3Slim from "../../node_modules/jquery/dist/jquery.slim.js?raw";
import jquery4Slim from "../../node_modules/jquery4/dist/jquery.slim.js?raw";

const pluginFields = [
  "ajaxSubmit",
  "ajaxForm",
  "ajaxFormUnbind",
  "formToArray",
  "formSerialize",
  "fieldSerialize",
  "fieldValue",
  "clearForm",
  "clearFields",
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

    it("should not install attr2 or clearInputs, which 5.0 removes", function () {
      const removed = ["attr2", "clearInputs"];

      const installed = removed.filter((name) => name in $.fn);

      assert.deepEqual(installed, []);
    });

    it("should add no nodes to the document when the plugin loads", function () {
      const before = nodesBefore;

      const after = nodesAfter;

      assert.strictEqual(after, before);
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
          "jquery.form: ajaxSubmit needs the full jQuery build; this jQuery has no $.ajax",
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
