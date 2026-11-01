import { assert, describe, it } from "vitest";
import { resetFixture } from "./helpers.js";

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
});
