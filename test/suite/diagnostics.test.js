import { assert, describe, it } from "vitest";
import { beforeJQuery35, deprecate, log, requireJQuery35 } from "../../src/diagnostics.js";
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

    it("should prefix the message and join its parts without a separator", function () {
      const logged = [];
      const consoleLog = console.log;
      console.log = (text) => logged.push(text);
      $.fn.ajaxSubmit.debug = true;

      try {
        log("state = ", "complete", 1);
      } finally {
        $.fn.ajaxSubmit.debug = false;
        console.log = consoleLog;
      }

      assert.deepEqual(logged, ["[jquery.form] state = complete1"]);
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
    it("should tell versions before 3.5 from later ones", function () {
      const versions = ["1.7.2", "2.2.4", "3.4.1", "3.5.0", "3.7.1", "3.10.0", "4.0.0"];

      const old = versions.map(beforeJQuery35);

      assert.deepEqual(old, [true, true, true, false, false, false, false]);
    });

    it("should prefix a deprecation warning with the plugin name", function () {
      const warnings = recordDeprecations(true, () => deprecate("test-prefix", "a message"));

      assert.deepEqual(warnings, ["[jquery.form] a message (removed in 5.0)"]);
    });

    describe("when a page replaces $.fieldValue", function () {
      function withReplacedFieldValue(run) {
        const saved = $.fieldValue;
        $.fieldValue = () => "over";

        try {
          return run();
        } finally {
          $.fieldValue = saved;
        }
      }

      function aboutFieldValue(warnings) {
        return warnings.filter((text) => text.includes("$.fieldValue"));
      }

      it("should warn once, naming valHooks, when formToArray serializes under debug, and still use the replacement", function () {
        const $form = $('<form><input name="a" value="1"><input name="b" value="2"></form>');
        let fields;

        const warnings = recordDeprecations(true, function () {
          withReplacedFieldValue(function () {
            fields = $form.formToArray();
          });
        });

        assert.deepEqual(warnings, [
          "[jquery.form] replacing $.fieldValue to change what is serialized is deprecated, " +
            "use jQuery valHooks (removed in 5.0)",
        ]);
        assert.deepEqual(
          fields.map((field) => field.value),
          ["over", "over"]
        );
      });

      it("should stay silent when formToArray serializes with debug off", function () {
        const $form = $('<form><input name="a" value="1"></form>');

        const warnings = recordDeprecations(false, function () {
          withReplacedFieldValue(() => $form.formToArray());
        });

        assert.deepEqual(warnings, []);
      });

      it("should not warn while $.fieldValue is the plugin's own", function () {
        const $form = $('<form action="ajax/text.html"><input name="a" value="1"></form>');
        $form.appendTo("#main");

        const warnings = recordDeprecations(true, function () {
          $form.formToArray();
          $form.formSerialize();
          $form.find("input").fieldSerialize();
          $form.ajaxSubmit({ beforeSubmit: () => false });
        });

        assert.deepEqual(aboutFieldValue(warnings), []);
      });

      it("should warn only once per page across repeated serializations", function () {
        const $form = $('<form action="ajax/text.html"><input name="a" value="1"></form>');
        $form.appendTo("#main");

        const warnings = recordDeprecations(true, function () {
          withReplacedFieldValue(function () {
            $form.formToArray();
            $form.formToArray();
            $form.formSerialize();
            $form.find("input").fieldSerialize();
            $form.ajaxSubmit({ beforeSubmit: () => false });
          });
        });

        assert.strictEqual(aboutFieldValue(warnings).length, 1);
      });

      it("should warn when formSerialize serializes under debug", function () {
        const $form = $('<form><input name="a" value="1"></form>');
        let serialized;

        const warnings = recordDeprecations(true, function () {
          withReplacedFieldValue(function () {
            serialized = $form.formSerialize();
          });
        });

        assert.strictEqual(aboutFieldValue(warnings).length, 1);
        assert.strictEqual(serialized, "a=over");
      });

      it("should warn when fieldSerialize serializes under debug", function () {
        const $input = $('<input name="a" value="1">');
        let serialized;

        const warnings = recordDeprecations(true, function () {
          withReplacedFieldValue(function () {
            serialized = $input.fieldSerialize();
          });
        });

        assert.strictEqual(aboutFieldValue(warnings).length, 1);
        assert.strictEqual(serialized, "a=over");
      });

      it("should warn when ajaxSubmit serializes under debug", function () {
        const $form = $('<form action="ajax/text.html"><input name="a" value="1"></form>');
        $form.appendTo("#main");
        let fields;

        const warnings = recordDeprecations(true, function () {
          withReplacedFieldValue(function () {
            $form.ajaxSubmit({
              beforeSubmit: function (sent) {
                fields = sent;
                return false;
              },
            });
          });
        });

        assert.strictEqual(aboutFieldValue(warnings).length, 1);
        assert.strictEqual(fields[0].value, "over");
      });

      it("should not warn when fieldValue reads through the replacement", function () {
        const $input = $('<input name="a" value="1">');
        let values;

        const warnings = recordDeprecations(true, function () {
          withReplacedFieldValue(function () {
            values = $input.fieldValue();
          });
        });

        assert.deepEqual(warnings, []);
        assert.deepEqual(values, ["over"]);
      });
    });
  });

  describe("on a page whose jQuery is older than 3.5", function () {
    const versionError = "jquery.form 5 needs jQuery 3.5 or later; this is 3.4.1";

    function withJQueryVersion(version, run) {
      const actual = $.fn.jquery;
      $.fn.jquery = version;

      try {
        return run();
      } finally {
        $.fn.jquery = actual;
      }
    }

    function thrownBy(run) {
      try {
        run();
      } catch (error) {
        return error;
      }
    }

    function documentHandlers() {
      const events = $._data(document, "events") || {};

      return (
        ((events.submit && events.submit.length) || 0) +
        ((events.click && events.click.length) || 0)
      );
    }

    it("should reject 2.2.4 and 3.4.1 with an error that names the version", function () {
      const versions = ["2.2.4", "3.4.1"];

      const messages = versions.map((version) => thrownBy(() => requireJQuery35(version)).message);

      assert.deepEqual(messages, [
        "jquery.form 5 needs jQuery 3.5 or later; this is 2.2.4",
        "jquery.form 5 needs jQuery 3.5 or later; this is 3.4.1",
      ]);
    });

    it("should accept 3.5.0, 3.7.1, 3.10.0 and 4.0.0", function () {
      const versions = ["3.5.0", "3.7.1", "3.10.0", "4.0.0"];

      const errors = versions.map((version) => thrownBy(() => requireJQuery35(version)));

      assert.deepEqual(errors, [undefined, undefined, undefined, undefined]);
    });

    it("should throw from ajaxSubmit before any event, callback or request", function () {
      const $form = $(
        '<form method="post" action="ajax/text.html"><input name="a" value="1"></form>'
      ).appendTo("#main");
      const calls = [];
      $form.on("form-pre-serialize form-submit-validate form-submit-notify", (event) =>
        calls.push(event.type)
      );
      const ajax = $.ajax;
      $.ajax = () => calls.push("request");
      const options = {
        beforeSerialize: () => calls.push("beforeSerialize"),
        beforeSubmit: () => calls.push("beforeSubmit"),
        beforeSend: () => calls.push("beforeSend"),
      };

      let error;
      try {
        error = withJQueryVersion("3.4.1", () => thrownBy(() => $form.ajaxSubmit(options)));
      } finally {
        $.ajax = ajax;
      }

      assert.strictEqual(error.message, versionError);
      assert.deepEqual(calls, []);
    });

    it("should throw from ajaxSubmit on an empty selection too", function () {
      const $empty = $(".missing-form");

      const error = withJQueryVersion("3.4.1", () => thrownBy(() => $empty.ajaxSubmit()));

      assert.strictEqual(error.message, versionError);
    });

    it("should throw from ajaxForm before calling beforeFormUnbind or binding the form", function () {
      const $form = $('<form action="ajax/text.html"></form>').appendTo("#main");
      const calls = [];

      const error = withJQueryVersion("3.4.1", () =>
        thrownBy(() => $form.ajaxForm({ beforeFormUnbind: () => calls.push("beforeFormUnbind") }))
      );

      assert.strictEqual(error.message, versionError);
      assert.deepEqual(calls, []);
      assert.isUndefined($._data($form[0], "events"));
    });

    it("should throw from ajaxForm on an empty selection and with a delegation selector", function () {
      const before = documentHandlers();

      const errors = withJQueryVersion("3.4.1", () => [
        thrownBy(() => $(".missing-form").ajaxForm()),
        thrownBy(() => $(document).ajaxForm({ delegation: "form.old-jquery" })),
      ]);

      assert.deepEqual(
        errors.map((error) => error.message),
        [versionError, versionError]
      );
      assert.strictEqual(documentHandlers(), before);
    });

    it("should still load the plugin without throwing", async function () {
      const saved = { fn: Object.assign({}, $.fn), fieldValue: $.fieldValue };
      const actual = $.fn.jquery;
      let error;

      $.fn.jquery = "3.4.1";
      try {
        await import("../../src/jquery.form.js?old-jquery");
      } catch (thrown) {
        error = thrown;
      } finally {
        $.fn.jquery = actual;
        Object.assign($.fn, saved.fn);
        $.fieldValue = saved.fieldValue;
      }

      assert.isUndefined(error);
    });
  });

  describe("on this page's jQuery", function () {
    it("should run ajaxSubmit and ajaxForm without a version error or warning", function () {
      const $form = $('<form action="ajax/text.html"></form>').appendTo("#main");
      let error;

      const warnings = recordDeprecations(true, function () {
        try {
          $form.ajaxSubmit({ beforeSubmit: () => false });
          $form.ajaxForm();
          $form.ajaxFormUnbind();
        } catch (thrown) {
          error = thrown;
        }
      });

      assert.isFalse(beforeJQuery35($.fn.jquery));
      assert.isUndefined(error);
      assert.deepEqual(warnings, []);
    });
  });
});
