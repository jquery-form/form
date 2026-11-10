import { assert, describe, it } from "vitest";
import { beforeJQuery35, deprecate, deprecateOldJQuery } from "../../src/diagnostics.js";
import { recordDeprecations, resetFixture } from "./helpers.js";

describe("form", function () {
  resetFixture();

  describe("debug logging", function () {
    function logWithDebug(globals) {
      const saved = {};
      Object.keys(globals).forEach(function (name) {
        saved[name] = Object.getOwnPropertyDescriptor(window, name);
        Object.defineProperty(window, name, {
          configurable: true,
          writable: true,
          value: globals[name],
        });
      });
      $.fn.ajaxSubmit.debug = true;

      try {
        $(".missing-form").ajaxSubmit();
      } finally {
        $.fn.ajaxSubmit.debug = false;
        Object.keys(globals).forEach(function (name) {
          if (saved[name]) {
            Object.defineProperty(window, name, saved[name]);
          } else {
            delete window[name];
          }
        });
      }
    }

    it("should write to console.log when debug is enabled", function () {
      const logged = [];

      logWithDebug({ console: { log: (text) => logged.push(text) } });

      assert.strictEqual(logged.length, 1);
    });

    it("should fall back to opera.postError without console.log", function () {
      const posted = [];

      logWithDebug({ console: {}, opera: { postError: (text) => posted.push(text) } });

      assert.strictEqual(posted.length, 1);
    });

    it("should stay silent without any logging target", function () {
      const run = () => logWithDebug({ console: undefined, opera: {} });

      assert.doesNotThrow(run);
    });

    it("should stay silent when debug is disabled", function () {
      const logged = [];
      const log = console.log;
      console.log = (text) => logged.push(text);

      try {
        $(".missing-form").ajaxSubmit();
      } finally {
        console.log = log;
      }

      assert.deepEqual(logged, []);
    });
  });

  describe("deprecations", function () {
    it("should warn once, naming clearFields, when clearInputs is called twice under debug", function () {
      const $input = $('<input type="text" value="x">');

      const warnings = recordDeprecations(true, function () {
        $input.clearInputs();
        $input.clearInputs();
      });

      assert.strictEqual(warnings.length, 1);
      assert.include(warnings[0], "clearFields");
      assert.include(warnings[0], "removed in 5.0");
    });

    it("should stay silent when clearInputs is called with debug off", function () {
      const $input = $('<input type="text" value="x">');

      const warnings = recordDeprecations(false, () => $input.clearInputs());

      assert.deepEqual(warnings, []);
    });

    it("should warn once, naming prop and attr, when attr2 is called twice under debug", function () {
      const $form = $('<form action="a.html"></form>');

      const warnings = recordDeprecations(true, function () {
        $form.attr2("action");
        $form.attr2("action");
      });

      assert.strictEqual(warnings.length, 1);
      assert.include(warnings[0], ".prop()");
    });

    it("should stay silent when attr2 is called with debug off", function () {
      const $form = $('<form action="a.html"></form>');

      const warnings = recordDeprecations(false, () => $form.attr2("action"));

      assert.deepEqual(warnings, []);
    });

    it("should not warn when clearForm clears its fields", function () {
      const $form = $('<form><input type="text" value="x"></form>');

      const warnings = recordDeprecations(true, () => $form.clearForm());

      assert.isFalse(warnings.some((text) => text.includes("clearInputs")));
    });

    it("should warn once about a jQuery older than 3.5 under debug", function () {
      const warnings = recordDeprecations(true, function () {
        deprecateOldJQuery("3.4.1");
        deprecateOldJQuery("3.4.1");
      });

      assert.strictEqual(warnings.length, 1);
      assert.include(warnings[0], "jQuery 3.4.1");
      assert.include(warnings[0], "3.5");
    });

    it("should not warn about jQuery 3.5 or later", function () {
      const warnings = recordDeprecations(true, () => deprecateOldJQuery("3.5.0"));

      assert.deepEqual(warnings, []);
    });

    it("should stay silent about an old jQuery with debug off", function () {
      const warnings = recordDeprecations(false, () => deprecateOldJQuery("1.7.2"));

      assert.deepEqual(warnings, []);
    });

    it("should tell versions before 3.5 from later ones", function () {
      const versions = ["1.7.2", "2.2.4", "3.4.1", "3.5.0", "3.7.1", "4.0.0"];

      const old = versions.map(beforeJQuery35);

      assert.deepEqual(old, [true, true, true, false, false, false]);
    });

    it("should warn about this page's jQuery on the first ajaxSubmit only when it is older than 3.5", function () {
      const $form = $('<form action="ajax/text.html"></form>').appendTo("#main");

      const warnings = recordDeprecations(true, function () {
        $form.ajaxSubmit({ beforeSubmit: () => false });
        $form.ajaxSubmit({ beforeSubmit: () => false });
        $form.ajaxForm();
      });

      assert.strictEqual(warnings.length, beforeJQuery35($.fn.jquery) ? 1 : 0);
    });

    it("should warn about an old jQuery on ajaxForm under debug", function () {
      const $form = $("<form></form>").appendTo("#main");

      const warnings = recordDeprecations(true, () => $form.ajaxForm());

      assert.strictEqual(warnings.length, beforeJQuery35($.fn.jquery) ? 1 : 0);
    });

    it("should not throw when console.warn is missing", function () {
      const warn = console.warn;

      const warnings = recordDeprecations(true, function () {
        console.warn = undefined;
        deprecate("test-missing-warn", "a message");
        console.warn = warn;
      });

      assert.deepEqual(warnings, []);
    });
  });
});
