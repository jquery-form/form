import { afterEach, assert, beforeEach, describe, it } from "vitest";
import { userEvent } from "vitest/browser";
import {
  recordDeprecations,
  resetFixture,
  arrayValue,
  restoreAjaxState,
  submitAndSettle,
  withAjaxStub,
  formHidingParentNode,
} from "./helpers.js";

const jQueryMajor = Number($.fn.jquery.split(".")[0]);

// Focus, keyboard input and image clicks need rendered controls, but #main is hidden. Tests that
// need them append to #visible-fixture, which each test gets fresh.
function visibleFixture() {
  beforeEach(function () {
    $('<div id="visible-fixture"></div>').appendTo(document.body);
  });

  afterEach(function () {
    $("#visible-fixture").remove();
  });
}

// Runs `run` with $.ajax replaced by a recorder and passes it the settings of every request.
async function withAjaxCapture(run) {
  const requests = [];

  await withAjaxStub(
    function (settings) {
      requests.push(settings);
      return {};
    },
    function () {
      return run(requests);
    }
  );

  return requests;
}

// Runs `run` with a bubbling window submit listener that stops navigation after the plugin's
// handlers have run. Passes it the defaultPrevented state each submit reached the window with.
async function withNavigationStopped(run) {
  const reached = [];
  const stop = function (event) {
    reached.push(event.defaultPrevented);
    event.preventDefault();
  };
  window.addEventListener("submit", stop);

  try {
    return await run(reached);
  } finally {
    window.removeEventListener("submit", stop);
  }
}

// Runs `run` with $.fn.ajaxSubmit replaced by a recorder, so a jQuery-triggered click that falls
// through to the native click submits through the plugin without sending a request.
async function withAjaxSubmitStub(run) {
  const ajaxSubmit = $.fn.ajaxSubmit;
  const calls = [];
  $.fn.ajaxSubmit = function (options) {
    calls.push({ form: this[0], options: options, clk: this[0] ? this[0].clk : undefined });
    return this;
  };

  try {
    return await run(calls);
  } finally {
    $.fn.ajaxSubmit = ajaxSubmit;
  }
}

describe("form", function () {
  resetFixture();
  visibleFixture();

  describe("ajaxForm", function () {
    it("should pass URL shorthand options to ajaxSubmit", function () {
      const $form = $('<form><button type="submit">Send</button></form>').appendTo("#main");
      const ajaxSubmit = $.fn.ajaxSubmit;
      const success = function () {};
      let submittedOptions;
      $.fn.ajaxSubmit = function (options) {
        submittedOptions = options;
        return this;
      };

      try {
        $form.ajaxForm("/shorthand", { source: "test" }, "json", success);
        $form.trigger("submit");

        assert.strictEqual(submittedOptions.url, "/shorthand");
        assert.deepEqual(submittedOptions.data, { source: "test" });
        assert.strictEqual(submittedOptions.dataType, "json");
        assert.strictEqual(submittedOptions.success, success);
      } finally {
        $.fn.ajaxSubmit = ajaxSubmit;
      }
    });

    it("should accept false as the shorthand URL without a success callback", function () {
      const $form = $("<form></form>").appendTo("#main");
      const ajaxSubmit = $.fn.ajaxSubmit;
      let submittedOptions;
      $.fn.ajaxSubmit = function (options) {
        submittedOptions = options;
        return this;
      };

      try {
        $form.ajaxForm(false);
        $form.trigger("submit");

        assert.strictEqual(submittedOptions.url, false);
        assert.strictEqual(submittedOptions.success, undefined);
      } finally {
        $.fn.ajaxSubmit = ajaxSubmit;
      }
    });

    it("should return an empty selection without binding handlers", function () {
      const $missing = $(".missing-ajax-form");

      const result = $missing.ajaxForm();

      assert.strictEqual(result, $missing);
      assert.strictEqual($._data(document, "events"), undefined);
    });

    describe("before the DOM is ready", function () {
      // These tests fake `$.isReady`. jQuery 1.7.2 then re-fires its ready handlers, which closes
      // the test page, so they only run where the collection has no native selector metadata.
      const it = globalThis.it.skipIf(Number($.fn.jquery.split(".")[0]) < 3);

      function withDomNotReady(run) {
        const isReady = $.isReady;
        $.isReady = false;

        try {
          return run();
        } finally {
          $.isReady = isReady;
        }
      }

      it("should bind once ready when old jQuery selector metadata is present", async function () {
        const $pending = $(".queued-ajax-form");
        $pending.selector = ".queued-ajax-form";

        const result = withDomNotReady(() => $pending.ajaxForm());
        const $form = $('<form class="queued-ajax-form"></form>').appendTo("#main");
        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(result, $pending);
        assert.strictEqual($._data($form[0], "events").submit.length, 1);
      });

      it("should warn once under debug when ajaxForm is queued until the DOM is ready", function () {
        const $pending = $(".warned-queue-form");
        $pending.selector = ".warned-queue-form";

        const warnings = recordDeprecations(true, function () {
          withDomNotReady(() => $pending.ajaxForm());
          withDomNotReady(() => $pending.ajaxForm());
        });

        assert.strictEqual(warnings.filter((text) => text.includes("delegation")).length, 1);
      });

      it("should not warn about the queue with debug off", function () {
        const $pending = $(".silent-queue-form");
        $pending.selector = ".silent-queue-form";

        const warnings = recordDeprecations(false, () =>
          withDomNotReady(() => $pending.ajaxForm())
        );

        assert.deepEqual(warnings, []);
      });

      it("should not queue an empty selection without selector metadata", async function () {
        const $pending = $(".unqueued-ajax-form");

        const result = withDomNotReady(() => $pending.ajaxForm());
        const $form = $('<form class="unqueued-ajax-form"></form>').appendTo("#main");
        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(result, $pending);
        assert.strictEqual($._data($form[0], "events"), undefined);
      });

      it("should bind on a later macrotask, not synchronously, when queued", async function () {
        const $pending = $(".later-ajax-form");
        $pending.selector = ".later-ajax-form";
        const $form = $('<form class="later-ajax-form"></form>').appendTo("#main");

        withDomNotReady(() => $pending.ajaxForm());
        const boundAtOnce = $._data($form[0], "events");
        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(boundAtOnce, undefined);
        assert.strictEqual($._data($form[0], "events").submit.length, 1);
      });

      it("should bind the queued call with the same options object", async function () {
        const $pending = $(".same-options-ajax-form");
        $pending.selector = ".same-options-ajax-form";
        const options = { url: "ajax/text.html" };
        withDomNotReady(() => $pending.ajaxForm(options));
        const $form = $('<form class="same-options-ajax-form"></form>').appendTo("#main");
        await new Promise((resolve) => setTimeout(resolve, 0));

        const calls = await withAjaxSubmitStub(async function (calls) {
          $form.trigger("submit");
          return calls;
        });

        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0].options, options);
      });

      it("should call beforeFormUnbind only when the queued call runs", async function () {
        const $pending = $(".unbind-later-ajax-form");
        $pending.selector = ".unbind-later-ajax-form";
        let calls = 0;
        const options = {
          beforeFormUnbind: function () {
            calls++;
          },
        };

        withDomNotReady(() => $pending.ajaxForm(options));
        const callsAtOnce = calls;
        $('<form class="unbind-later-ajax-form"></form>').appendTo("#main");
        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(callsAtOnce, 0);
        assert.strictEqual(calls, 1);
      });

      it("should not queue again when the queued call still finds nothing", async function () {
        const $pending = $(".never-ajax-form");
        $pending.selector = ".never-ajax-form";

        withDomNotReady(() => $pending.ajaxForm());
        await new Promise((resolve) => setTimeout(resolve, 0));
        const $form = $('<form class="never-ajax-form"></form>').appendTo("#main");
        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual($._data($form[0], "events"), undefined);
      });

      it("should query the queued selector in the original context", async function () {
        const $context = $("<div></div>").appendTo("#main");
        const $pending = $(".context-ajax-form");
        $pending.selector = ".context-ajax-form";
        $pending.context = $context[0];

        withDomNotReady(() => $pending.ajaxForm());
        const $inside = $('<form class="context-ajax-form"></form>').appendTo($context);
        const $outside = $('<form class="context-ajax-form"></form>').appendTo("#main");
        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual($._data($inside[0], "events").submit.length, 1);
        assert.strictEqual($._data($outside[0], "events"), undefined);
      });
    });

    it("should call beforeFormUnbind before replacing form handlers", function () {
      const $form = $('<form><button type="submit">Send</button></form>').appendTo("#main");
      const order = [];
      $form.on("submit.form-plugin", function () {
        order.push("old handler");
      });

      $form.ajaxForm({
        beforeFormUnbind: function (forms, options) {
          order.push("before unbind");
          assert.strictEqual(forms, $form);
          assert.strictEqual(options.beforeFormUnbind instanceof Function, true);
          assert.strictEqual($._data($form[0], "events").submit.length, 1);
        },
      });

      assert.deepEqual(order, ["before unbind"]);
      assert.strictEqual($._data($form[0], "events").submit.length, 1);
    });

    it("should leave a canceled submit untouched", function () {
      const $form = $('<form><button type="submit">Send</button></form>').appendTo("#main");
      const ajaxSubmit = $.fn.ajaxSubmit;
      let submissions = 0;
      $.fn.ajaxSubmit = function () {
        submissions++;
        return this;
      };
      $form.on("submit", function (event) {
        event.preventDefault();
      });

      try {
        const event = $.Event("submit");
        $form.ajaxForm();
        $form.trigger(event);

        assert.strictEqual(event.isDefaultPrevented(), true);
        assert.strictEqual(submissions, 0);
      } finally {
        $.fn.ajaxSubmit = ajaxSubmit;
      }
    });

    it("should capture a submit button when nested content is clicked", async function () {
      await withAjaxSubmitStub(async function () {
        const $form = $(
          '<form><button type="submit" name="choice" value="nested"><span>Send</span></button></form>'
        ).appendTo("#main");
        const button = $form.find("button")[0];

        $form.ajaxForm();
        $form.find("span").trigger("click");

        assert.strictEqual($form[0].clk, button);
      });
    });

    // #588: a button without a type attribute is a submit button.
    it("should capture a button without a type attribute", async function () {
      await withAjaxSubmitStub(async function () {
        const $form = $(
          '<form><button name="choice" value="untyped"><span>Send</span></button></form>'
        ).appendTo("#main");
        const button = $form.find("button")[0];

        $form.ajaxForm();
        $form.find("span").trigger("click");

        assert.strictEqual($form[0].clk, button);
      });
    });

    it("should ignore clicks outside submit controls", function () {
      const $form = $("<form><span>Not a submit control</span></form>").appendTo("#main");

      $form.ajaxForm();
      $form.find("span").trigger("click");

      assert.strictEqual($form[0].clk, undefined);
    });

    [
      ["a text input", '<input name="q">'],
      ["an element with a submit type attribute", '<span type="submit">Send</span>'],
      [
        "a submit button that belongs to no form",
        '<button type="submit" form="no-such-form">Send</button>',
      ],
    ].forEach(function ([label, html]) {
      it("should ignore clicks on " + label, function () {
        const $form = $("<form></form>").append(html).appendTo("#main");
        $form.ajaxForm();

        const click = () => $form.children().trigger("click");

        assert.doesNotThrow(click);
        assert.strictEqual($form[0].clk, undefined);
      });
    });

    // jQuery 3.0 removed the selection selector, so the scope is given as delegation: "<selector>".
    it("should scope delegated handlers to the selected forms", function () {
      const $selected = $('<form class="delegated"></form>').appendTo("#main");
      const $unselected = $("<form></form>").appendTo("#main").on("submit", false);
      const ajaxSubmit = $.fn.ajaxSubmit;
      let submissions = 0;
      $.fn.ajaxSubmit = function () {
        submissions++;
        return this;
      };

      try {
        $selected.ajaxForm({ delegation: ".delegated" });
        $unselected.trigger("submit");

        assert.strictEqual(submissions, 0);
      } finally {
        $(document).off(".form-plugin");
        $.fn.ajaxSubmit = ajaxSubmit;
      }
    });

    it("should capture image coordinates supplied by the click event", async function () {
      await withAjaxSubmitStub(async function () {
        const $form = $('<form><input type="image" name="map"></form>').appendTo("#main");
        const $image = $form.find("input");
        const event = $.Event("click");
        event.offsetX = 14;
        event.offsetY = 27;

        $form.ajaxForm();
        $image.trigger(event);

        assert.strictEqual($form[0].clk, $image[0]);
        assert.strictEqual($form[0].clk_x, 14);
        assert.strictEqual($form[0].clk_y, 27);
      });
    });

    it("should derive image coordinates from its document offset", async function () {
      await withAjaxSubmitStub(async function () {
        const $form = $('<form><input type="image" name="map"></form>').appendTo("#main");
        const $image = $form.find("input");
        const offset = $.fn.offset;
        $.fn.offset = function () {
          return { left: 10, top: 20 };
        };
        const event = $.Event("click");
        event.pageX = 31;
        event.pageY = 58;

        try {
          $form.ajaxForm();
          $image.trigger(event);

          assert.strictEqual($form[0].clk_x, 21);
          assert.strictEqual($form[0].clk_y, 38);
        } finally {
          $.fn.offset = offset;
        }
      });
    });

    it("should derive image coordinates from element offsets without the offset helper", async function () {
      await withAjaxSubmitStub(async function () {
        const $form = $('<form><input type="image" name="map"></form>').appendTo("#main");
        const $image = $form.find("input");
        const offset = $.fn.offset;
        $.fn.offset = undefined;
        Object.defineProperties($image[0], {
          offsetLeft: { configurable: true, value: 7 },
          offsetTop: { configurable: true, value: 9 },
        });
        const event = $.Event("click");
        event.pageX = 19;
        event.pageY = 24;

        try {
          $form.ajaxForm();
          $image.trigger(event);

          assert.strictEqual($form[0].clk_x, 12);
          assert.strictEqual($form[0].clk_y, 15);
        } finally {
          $.fn.offset = offset;
        }
      });
    });

    it("should clear captured submit details after the click window", async function () {
      await withAjaxSubmitStub(async function () {
        const $form = $('<form><input type="image" name="map"></form>').appendTo("#main");
        const $image = $form.find("input");
        const event = $.Event("click");
        event.offsetX = 4;
        event.offsetY = 6;
        $form.ajaxForm();
        $image.trigger(event);

        await new Promise((resolve) => setTimeout(resolve, 120));

        assert.strictEqual($form[0].clk, null);
        assert.strictEqual($form[0].clk_x, null);
        assert.strictEqual($form[0].clk_y, null);
      });
    });

    it("should call beforeSubmit and then success when the submit button is clicked", async function () {
      const opts = {};

      const seen = await submitAndSettle(opts, () => {
        $("#form4").ajaxForm(opts);
        $("#submitForm4")[0].click();
      });

      assert.ok(seen.beforeSubmit, "pre-submit callback");
      assert.ok(seen.beforeSubmit.data.constructor == Array, "type check");
      assert.ok(seen.beforeSubmit.$form.jquery, "type check jQuery");
      assert.ok(seen.success, "post-submit callback");
    });

    it("should include the value of the clicked submit button", async function () {
      const opts = {};

      const seen = await submitAndSettle(opts, () => {
        $("#form4").ajaxForm(opts);
        $("#submitForm4withName")[0].click();
      });

      assert.ok(seen.beforeSubmit, "pre-callback");
      assert.ok(seen.beforeSubmit.data.constructor == Array, "type check");
      assert.ok(seen.beforeSubmit.$form.jquery, "type check jQuery");
      assert.ok(
        arrayValue(seen.beforeSubmit.data, "form4inputName") !== undefined,
        "submit button"
      );
    });

    it("should include the coordinates of a clicked image submit", async function () {
      const opts = {};

      const seen = await submitAndSettle(opts, () => {
        $("#form4").ajaxForm(opts);
        $("#form4imageSubmit")[0].click();
      });

      assert.ok(seen.beforeSubmit, "pre-callback");
      assert.ok(seen.beforeSubmit.data.constructor == Array, "type check");
      assert.ok(seen.beforeSubmit.$form.jquery, "type check jQuery");
      assert.ok(arrayValue(seen.beforeSubmit.data, "myImage.x") !== undefined, "x coord");
      assert.ok(arrayValue(seen.beforeSubmit.data, "myImage.y") !== undefined, "y coord");
    });

    it("should include image coordinates when semantic is true", async function () {
      const opts = { semantic: true };

      const seen = await submitAndSettle(opts, () => {
        $("#form4").ajaxForm(opts);
        $("#form4imageSubmit")[0].click();
      });

      assert.ok(seen.beforeSubmit, "pre-callback");
      assert.ok(seen.beforeSubmit.data.constructor == Array, "type check");
      assert.ok(seen.beforeSubmit.$form.jquery, "type check jQuery");
      assert.ok(arrayValue(seen.beforeSubmit.data, "myImage.x") !== undefined, "x coord");
      assert.ok(arrayValue(seen.beforeSubmit.data, "myImage.y") !== undefined, "y coord");
    });

    it("should load the response into the target div", async function () {
      $("#targetDiv").empty();
      const opts = { target: "#targetDiv" };

      const seen = await submitAndSettle(opts, () => {
        $("#form4").ajaxForm(opts);
        $("#submitForm4")[0].click();
      });

      assert.ok(seen.beforeSubmit, "pre-callback");
      assert.ok(seen.beforeSubmit.data.constructor == Array, "type check");
      assert.ok(seen.beforeSubmit.$form.jquery, "type check jQuery");
      assert.ok(seen.success, "post-callback");
      assert.ok($("#targetDiv").text().match("Lorem ipsum"), "targetDiv updated");
    });

    it("should submit once when ajaxForm is bound several times", async function () {
      $("#targetDiv").empty();
      let beforeSubmitCalls = 0;
      let successCalls = 0;
      const opts = {
        target: "#targetDiv",
        beforeSubmit: function () {
          beforeSubmitCalls++;
        },
        success: function () {
          successCalls++;
        },
      };
      const settled = new Promise((resolve) => {
        const success = opts.success;
        opts.success = function () {
          success.apply(this, arguments);
          // Let any duplicate submissions from extra bindings land before asserting.
          setTimeout(resolve, 100);
        };
      });

      $("#form8").ajaxForm(opts).ajaxForm(opts).ajaxForm(opts);
      $("#submitForm8")[0].click();
      await settled;

      assert.strictEqual(beforeSubmitCalls, 1, "pre-callback");
      assert.strictEqual(successCalls, 1, "post-callback");
    });

    it("should not submit after ajaxFormUnbind", async function () {
      $("#targetDiv").empty();
      let callbacks = 0;
      const opts = {
        target: "#targetDiv",
        beforeSubmit: function () {
          callbacks++;
        },
        success: function () {
          callbacks++;
        },
      };
      $("#form9")
        .ajaxForm(opts)
        .submit(function () {
          return false;
        });

      $("#form9").ajaxFormUnbind(opts);
      $("#submitForm9")[0].click();
      await new Promise((resolve) => setTimeout(resolve, 500));

      assert.strictEqual(callbacks, 0, "no callbacks after unbind");
    });

    describe("options", function () {
      it("should not set success when the shorthand callback is not a function", async function () {
        const $form = $("<form></form>").appendTo("#main");

        const calls = await withAjaxSubmitStub(async function (calls) {
          $form.ajaxForm("/shorthand", null, null, "not a function");
          $form.trigger("submit");
          return calls;
        });

        assert.strictEqual(
          Object.prototype.hasOwnProperty.call(calls[0].options, "success"),
          false
        );
      });

      [null, 0].forEach(function (value) {
        it("should start from fresh empty options when called with " + value, async function () {
          const $first = $("<form></form>").appendTo("#main");
          const $second = $("<form></form>").appendTo("#main");

          const calls = await withAjaxSubmitStub(async function (calls) {
            $first.ajaxForm(value);
            $second.ajaxForm(value);
            $first.trigger("submit");
            $second.trigger("submit");
            return calls;
          });

          assert.deepEqual(Object.keys(calls[0].options), ["delegation"]);
          assert.notStrictEqual(calls[0].options, calls[1].options);
        });
      });

      it("should use a function passed as options as the options object", async function () {
        const $form = $("<form></form>").appendTo("#main");
        const callback = function () {};

        const calls = await withAjaxSubmitStub(async function (calls) {
          $form.ajaxForm(callback);
          $form.trigger("submit");
          return calls;
        });

        assert.strictEqual(calls[0].options, callback);
        assert.strictEqual(Object.prototype.hasOwnProperty.call(callback, "delegation"), true);
      });

      it("should call a function passed as options as the success callback", async function () {
        const $form = $('<form method="post" action="ajax/text.html"></form>').appendTo("#main");
        const received = [];

        await withAjaxStub(
          function (settings) {
            settings.success("response", "success", {});
            return {};
          },
          function () {
            $form.ajaxForm(function (data) {
              received.push(data);
            });
            $form.trigger("submit");
          }
        );

        assert.deepEqual(received, ["response"]);
      });

      [true, 1].forEach(function (value) {
        it("should throw a TypeError without binding when the options are " + value, function () {
          const $form = $("<form></form>").appendTo("#main");

          const bind = () => $form.ajaxForm(value);

          assert.throws(bind, TypeError);
          assert.strictEqual($._data($form[0], "events"), undefined);
        });
      });

      it("should throw a TypeError when the options object is frozen", function () {
        const $form = $("<form></form>").appendTo("#main");

        const bind = () => $form.ajaxForm(Object.freeze({}));

        assert.throws(bind, TypeError);
      });

      it("should add a delegation property to the options object when it had none", function () {
        const $form = $("<form></form>").appendTo("#main");
        const options = {};

        $form.ajaxForm(options);

        assert.strictEqual(Object.prototype.hasOwnProperty.call(options, "delegation"), true);
        assert.strictEqual(options.delegation, undefined);
      });

      [1].forEach(function (value) {
        it(
          "should rewrite a delegation value of " + JSON.stringify(value) + " to true",
          function () {
            const $form = $('<form class="selected-ajax-form"></form>').appendTo("#main");
            const options = { delegation: value };

            try {
              $form.ajaxForm(options);

              assert.strictEqual(options.delegation, true);
            } finally {
              $(document).off(".form-plugin");
            }
          }
        );
      });

      it("should keep a delegation selector in the options object", function () {
        const options = { delegation: ".selected-ajax-form" };

        try {
          $(".selected-ajax-form").ajaxForm(options);

          assert.strictEqual(options.delegation, ".selected-ajax-form");
        } finally {
          $(document).off(".form-plugin");
        }
      });

      it("should throw a clear error without binding when delegation is an empty string", function () {
        const $form = $("<form></form>").appendTo("#main");

        const bind = () => $form.ajaxForm({ delegation: "" });

        assert.throws(bind, /delegation/);
        assert.strictEqual($._data($form[0], "events"), undefined);
        const events = $._data(document, "events");
        assert.strictEqual(events && events.submit, undefined);
      });

      [false, 0, null].forEach(function (value) {
        it("should keep a falsy delegation value of " + JSON.stringify(value), function () {
          const $form = $("<form></form>").appendTo("#main");
          const options = { delegation: value };

          $form.ajaxForm(options);

          assert.strictEqual(options.delegation, value);
        });
      });

      it("should set delegation to false and throw when $.fn.on is missing", function () {
        const $form = $("<form></form>").appendTo("#main");
        const options = { delegation: true };
        const on = $.fn.on;
        $.fn.on = undefined;
        let bind;

        try {
          bind = () => $form.ajaxForm(options);

          assert.throws(bind, TypeError);
        } finally {
          $.fn.on = on;
        }

        assert.strictEqual(options.delegation, false);
      });

      it("should use options changed after binding on the next submit", async function () {
        const $form = $("<form></form>").appendTo("#main");
        const options = { url: "ajax/first.html" };
        $form.ajaxForm(options);

        const calls = await withAjaxSubmitStub(async function (calls) {
          options.url = "ajax/second.html";
          $form.trigger("submit");
          return calls;
        });

        assert.strictEqual(calls[0].options, options);
        assert.strictEqual(calls[0].options.url, "ajax/second.html");
      });

      it("should not keep changes a callback makes to its options argument", async function () {
        const $form = $('<form method="post" action="ajax/text.html"></form>').appendTo("#main");
        const seen = [];
        const options = {
          beforeSubmit: function (data, $submitted, submittedOptions) {
            seen.push(submittedOptions.custom);
            submittedOptions.custom = "changed";
          },
        };
        $form.ajaxForm(options);

        await withAjaxCapture(function () {
          $form.trigger("submit");
          $form.trigger("submit");
        });

        assert.deepEqual(seen, [undefined, undefined]);
        assert.strictEqual(options.custom, undefined);
      });

      it("should submit each form with the shared options when one call binds several forms", async function () {
        const $first = $("<form></form>").appendTo("#main");
        const $second = $("<form></form>").appendTo("#main");
        const options = {};

        const calls = await withAjaxSubmitStub(async function (calls) {
          $first.add($second).ajaxForm(options);
          $second.trigger("submit");
          return calls;
        });

        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0].form, $second[0]);
        assert.strictEqual(calls[0].options, options);
      });
    });

    describe("an empty selection", function () {
      it("should not log when debug is off", function () {
        const logged = [];
        const log = console.log;
        console.log = (text) => logged.push(text);

        try {
          $(".missing-ajax-form").ajaxForm();
        } finally {
          console.log = log;
        }

        assert.deepEqual(logged, []);
      });

      it("should not call beforeFormUnbind", function () {
        let calls = 0;

        $(".missing-ajax-form").ajaxForm({
          beforeFormUnbind: function () {
            calls++;
          },
        });

        assert.strictEqual(calls, 0);
      });

      it("should bind delegated handlers on the document when delegation is true", function () {
        try {
          $(".missing-ajax-form").ajaxForm({ delegation: true });

          const events = $._data(document, "events");
          assert.strictEqual(events.submit.length, 1);
          assert.strictEqual(events.click.length, 1);
        } finally {
          $(document).off(".form-plugin");
        }
      });
    });

    describe("with delegation", function () {
      describe("on a selection without selector metadata", function () {
        let warn;
        let warnings;

        beforeEach(function () {
          warn = console.warn;
          warnings = [];
          console.warn = function (message) {
            warnings.push(message);
          };
        });

        afterEach(function () {
          console.warn = warn;
          $(document).off(".form-plugin");
        });

        it("should warn once per call that every form on the page is bound, with debug off", function () {
          const $form = $("<form></form>").appendTo("#main");

          $form.ajaxForm({ delegation: true });

          const expected = $form.selector === undefined ? 1 : 0;
          assert.strictEqual($.fn.ajaxSubmit.debug, false);
          assert.strictEqual(warnings.length, expected);
          assert.strictEqual(
            warnings.every((message) => /every form on the page/.test(message)),
            true
          );
        });

        it("should not warn when delegation is a selector", function () {
          $().ajaxForm({ delegation: ".scoped-ajax-form" });

          assert.strictEqual(warnings.length, 0);
        });

        it("should not warn when the selection keeps old jQuery selector metadata", function () {
          const $form = $("<form></form>").appendTo("#main");
          $form.selector = "form";

          $form.ajaxForm({ delegation: true });

          assert.strictEqual(warnings.length, 0);
        });

        it("should bind without warning when there is no console", function () {
          const $form = $("<form></form>").appendTo("#main");
          const console = window.console;
          window.console = undefined;

          try {
            $form.ajaxForm({ delegation: true });
          } finally {
            window.console = console;
          }

          assert.strictEqual($._data(document, "events").submit.length, 1);
        });

        it("should bind without warning when the console has no warn", function () {
          const $form = $("<form></form>").appendTo("#main");
          console.warn = undefined;

          $form.ajaxForm({ delegation: true });

          assert.strictEqual($._data(document, "events").submit.length, 1);
        });
      });

      it("should return the selection", function () {
        const $form = $("<form></form>").appendTo("#main");

        try {
          const result = $form.ajaxForm({ delegation: true });

          assert.strictEqual(result, $form);
        } finally {
          $(document).off(".form-plugin");
        }
      });

      it("should not call beforeFormUnbind", function () {
        const $form = $("<form></form>").appendTo("#main");
        let calls = 0;

        try {
          $form.ajaxForm({
            delegation: true,
            beforeFormUnbind: function () {
              calls++;
            },
          });

          assert.strictEqual(calls, 0);
        } finally {
          $(document).off(".form-plugin");
        }
      });

      it("should submit once when a form has both direct and delegated bindings", async function () {
        const $form = $("<form></form>").appendTo("#main");

        try {
          const calls = await withAjaxSubmitStub(async function (calls) {
            $form.ajaxForm();
            $form.ajaxForm({ delegation: true });
            $form.trigger("submit");
            return calls;
          });

          assert.strictEqual(calls.length, 1);
        } finally {
          $(document).off(".form-plugin");
        }
      });

      // jQuery 1.7.2 delegates clicks with the selection's selector, which the button does not match.
      it("should capture a submit button outside the form that names it", async function () {
        const $form = $('<form id="delegated-owner"></form>').appendTo("#main");
        const $button = $('<button type="submit" form="delegated-owner">Send</button>').appendTo(
          "#main"
        );

        try {
          await withAjaxSubmitStub(async function () {
            $("#delegated-owner").ajaxForm({ delegation: true });
            $button.trigger("click");
          });

          // jQuery 1.7.2 misses the click; the submit event names the button where browsers can
          const named = jQueryMajor >= 3 || "submitter" in SubmitEvent.prototype;
          assert.strictEqual($form[0].clk, named ? $button[0] : undefined);
        } finally {
          $(document).off(".form-plugin");
        }
      });
    });

    describe("with a delegation selector", function () {
      afterEach(function () {
        $(document).off(".form-plugin");
      });

      it("should return the selection", function () {
        const $form = $("<form></form>").appendTo("#main");

        const result = $form.ajaxForm({ delegation: ".scoped-ajax-form" });

        assert.strictEqual(result, $form);
      });

      it("should submit a matching form added after binding through the plugin", async function () {
        $().ajaxForm({ delegation: ".scoped-ajax-form" });
        const $form = $('<form class="scoped-ajax-form"></form>').appendTo("#main");

        const calls = await withAjaxSubmitStub(async function (calls) {
          $form.trigger("submit");
          return calls;
        });

        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0].form, $form[0]);
      });

      it("should use the selector and ignore the selection", async function () {
        const $selected = $("<form></form>").appendTo("#main").on("submit", false);
        const $matching = $('<form class="scoped-ajax-form"></form>').appendTo("#main");

        const calls = await withAjaxSubmitStub(async function (calls) {
          $selected.ajaxForm({ delegation: ".scoped-ajax-form" });
          $selected.trigger("submit");
          $matching.trigger("submit");
          return calls;
        });

        assert.deepEqual(
          calls.map((call) => call.form),
          [$matching[0]]
        );
        assert.strictEqual($._data($selected[0], "events").submit.length, 1);
      });

      it("should not call beforeFormUnbind", function () {
        const $form = $("<form></form>").appendTo("#main");
        let calls = 0;

        $form.ajaxForm({
          delegation: ".scoped-ajax-form",
          beforeFormUnbind: function () {
            calls++;
          },
        });

        assert.strictEqual(calls, 0);
      });

      it("should leave a submit that does not match to the browser", function () {
        const $form = $("<form></form>").appendTo("#main");
        $().ajaxForm({ delegation: ".scoped-ajax-form" });
        const event = $.Event("submit", { target: $form[0] });

        $(document).triggerHandler(event);

        assert.strictEqual(event.isDefaultPrevented(), false);
      });

      it("should ignore a submit triggered on the document itself", async function () {
        $().ajaxForm({ delegation: ".scoped-ajax-form" });

        const calls = await withAjaxSubmitStub(async function (calls) {
          $(document).triggerHandler("submit");
          return calls;
        });

        assert.strictEqual(calls.length, 0);
      });

      it("should submit the form inside a matching container", async function () {
        const $form = $('<div class="scoped-ajax-container"><form></form></div>')
          .appendTo("#main")
          .find("form");

        const calls = await withAjaxSubmitStub(async function (calls) {
          $().ajaxForm({ delegation: ".scoped-ajax-container" });
          $form.trigger("submit");
          return calls;
        });

        assert.strictEqual(calls[0].form, $form[0]);
      });

      it("should not submit when an earlier handler prevented the submit", async function () {
        const $form = $('<form class="scoped-ajax-form"></form>').appendTo("#main");
        $form.on("submit", false);

        const calls = await withAjaxSubmitStub(async function (calls) {
          $().ajaxForm({ delegation: ".scoped-ajax-form" });
          $form.trigger("submit");
          return calls;
        });

        assert.strictEqual(calls.length, 0);
      });

      it("should capture the clicked submit button of a matching form", async function () {
        const $form = $(
          '<form class="scoped-ajax-form"><button type="submit">Send</button></form>'
        ).appendTo("#main");
        const button = $form.find("button")[0];

        await withAjaxSubmitStub(async function () {
          $().ajaxForm({ delegation: ".scoped-ajax-form" });
          $form.on("submit", false);
          $(button).trigger("click");
        });

        assert.strictEqual($form[0].clk, button);
      });

      it("should not capture clicks in a form that does not match", async function () {
        const $form = $('<form><button type="submit">Send</button></form>').appendTo("#main");
        $form.on("submit", false);

        await withAjaxSubmitStub(async function () {
          $().ajaxForm({ delegation: ".scoped-ajax-form" });
          $form.find("button").trigger("click");
        });

        assert.strictEqual($form[0].clk, undefined);
      });

      it("should use the latest options when the same selector is bound twice", async function () {
        const $form = $('<form class="scoped-ajax-form"></form>').appendTo("#main");
        const first = { url: "ajax/first.html", delegation: ".scoped-ajax-form" };
        const second = { url: "ajax/second.html", delegation: ".scoped-ajax-form" };

        const calls = await withAjaxSubmitStub(async function (calls) {
          $().ajaxForm(first);
          $().ajaxForm(second);
          $form.trigger("submit");
          return calls;
        });

        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0].options, second);
      });

      it("should keep each selector's own options", async function () {
        const $first = $('<form class="first-ajax-form"></form>').appendTo("#main");
        const $second = $('<form class="second-ajax-form"></form>').appendTo("#main");
        const first = { delegation: ".first-ajax-form" };
        const second = { delegation: ".second-ajax-form" };

        const calls = await withAjaxSubmitStub(async function (calls) {
          $().ajaxForm(first);
          $().ajaxForm(second);
          $first.trigger("submit");
          $second.trigger("submit");
          return calls;
        });

        assert.deepEqual(
          calls.map((call) => call.options),
          [first, second]
        );
      });

      describe("without Element.prototype.closest", function () {
        let closest;

        beforeEach(function () {
          closest = Element.prototype.closest;
          delete Element.prototype.closest;
        });

        afterEach(function () {
          Element.prototype.closest = closest;
        });

        it("should submit a form inside a matching container", async function () {
          const $form = $('<div class="scoped-ajax-container"><form></form></div>')
            .appendTo("#main")
            .find("form");

          const calls = await withAjaxSubmitStub(async function (calls) {
            $().ajaxForm({ delegation: ".scoped-ajax-container" });
            $form.trigger("submit");
            return calls;
          });

          assert.strictEqual(calls[0].form, $form[0]);
        });

        it("should not submit a detached form that does not match", async function () {
          const form = document.createElement("form");

          const calls = await withAjaxSubmitStub(async function (calls) {
            $().ajaxForm({ delegation: ".scoped-ajax-form" });
            $(document).triggerHandler($.Event("submit", { target: form }));
            return calls;
          });

          assert.strictEqual(calls.length, 0);
        });

        it("should not submit an attached form that does not match", async function () {
          const $form = $("<form></form>").appendTo("#main");
          $form.on("submit", false);

          const calls = await withAjaxSubmitStub(async function (calls) {
            $().ajaxForm({ delegation: ".scoped-ajax-form" });
            $form.trigger("submit");
            return calls;
          });

          assert.strictEqual(calls.length, 0);
        });
      });
    });

    describe("binding", function () {
      it("should call beforeFormUnbind with the options as this and ignore its return value", function () {
        const $form = $("<form></form>").appendTo("#main");
        let context;
        const options = {
          beforeFormUnbind: function () {
            context = this;
            return false;
          },
        };

        $form.ajaxForm(options);

        assert.strictEqual(context, options);
        assert.strictEqual($._data($form[0], "events").submit.length, 1);
      });

      it("should leave the previous handlers bound when beforeFormUnbind throws", async function () {
        const $form = $("<form></form>").appendTo("#main");
        const first = {};
        $form.ajaxForm(first);
        const rebind = () =>
          $form.ajaxForm({
            beforeFormUnbind: function () {
              throw new Error("unbind refused");
            },
          });

        const calls = await withAjaxSubmitStub(async function (calls) {
          assert.throws(rebind, /unbind refused/);
          $form.trigger("submit");
          return calls;
        });

        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0].options, first);
      });

      it("should remove user click handlers in the form-plugin namespace when binding", function () {
        const $form = $("<form><span>Text</span></form>").appendTo("#main");
        let userClicks = 0;
        $form.on("click.form-plugin", function () {
          userClicks++;
        });

        $form.ajaxForm();
        $form.find("span").trigger("click");

        assert.strictEqual(userClicks, 0);
        assert.strictEqual($._data($form[0], "events").click.length, 1);
      });

      it("should leave handlers of other namespaces bound when binding and unbinding", function () {
        const $form = $("<form></form>").appendTo("#main");
        $form.on("submit", function () {});
        $form.on("submit.mine", function () {});
        $form.on("click.mine", function () {});

        $form.ajaxForm().ajaxFormUnbind();

        const events = $._data($form[0], "events");
        assert.strictEqual(events.submit.length, 2);
        assert.strictEqual(events.click.length, 1);
      });

      it("should bind one submit and one click handler and return the same selection", function () {
        const $form = $("<form></form>").appendTo("#main");

        const result = $form.ajaxForm();

        const events = $._data($form[0], "events");
        assert.strictEqual(result, $form);
        assert.strictEqual(events.submit.length, 1);
        assert.strictEqual(events.click.length, 1);
      });

      it("should use the latest options when ajaxForm is called twice", async function () {
        const $form = $("<form></form>").appendTo("#main");
        const latest = {};

        const calls = await withAjaxSubmitStub(async function (calls) {
          $form.ajaxForm({});
          $form.ajaxForm(latest);
          $form.trigger("submit");
          return calls;
        });

        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0].options, latest);
      });

      it("should run the plugin after user handlers bound between two ajaxForm calls", async function () {
        const $form = $("<form></form>").appendTo("#main");
        let preventedBeforeUser;
        $form.ajaxForm();
        $form.on("submit", function (event) {
          preventedBeforeUser = event.isDefaultPrevented();
        });

        await withAjaxSubmitStub(async function () {
          $form.ajaxForm();
          $form.trigger("submit");
        });

        assert.strictEqual(preventedBeforeUser, false);
      });

      it("should submit the descendant form when ajaxForm is bound on a container", async function () {
        const $container = $(
          '<div><form><button type="submit" name="choice" value="inner">Send</button></form></div>'
        ).appendTo("#main");
        const $form = $container.find("form");

        const calls = await withAjaxSubmitStub(async function (calls) {
          $container.ajaxForm();
          $form.find("button").trigger("click");
          return calls;
        });

        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0].form, $form[0]);
        assert.strictEqual(calls[0].clk, $form.find("button")[0]);
      });

      it("should submit a detached form when submit is triggered", async function () {
        const $form = $("<form></form>");

        const calls = await withAjaxSubmitStub(async function (calls) {
          $form.ajaxForm();
          $form.trigger("submit");
          return calls;
        });

        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0].form, $form[0]);
      });

      it("should not change the form or start a request when binding", function () {
        const $form = $('<form action="ajax/text.html"><input name="q" value="1"></form>').appendTo(
          "#main"
        );
        const html = $form[0].outerHTML;
        const active = $.active;
        const ownKeys = Object.keys($form[0]).filter((key) => key.indexOf("jQuery") !== 0);

        $form.ajaxForm();

        assert.strictEqual($form[0].outerHTML, html);
        assert.strictEqual($.active, active);
        assert.deepEqual(
          Object.keys($form[0]).filter((key) => key.indexOf("jQuery") !== 0),
          ownKeys
        );
      });

      it("should call the current $.fn.ajaxFormUnbind on the selection", function () {
        const $form = $("<form></form>").appendTo("#main");
        const ajaxFormUnbind = $.fn.ajaxFormUnbind;
        const unbound = [];
        $.fn.ajaxFormUnbind = function () {
          unbound.push(this);
          return ajaxFormUnbind.apply(this, arguments);
        };

        try {
          $form.ajaxForm();
        } finally {
          $.fn.ajaxFormUnbind = ajaxFormUnbind;
        }

        assert.deepEqual(unbound, [$form]);
      });
    });

    describe("the submit handler", function () {
      it("should not submit when an earlier submit handler returns false", async function () {
        const $form = $("<form></form>").appendTo("#main");
        $form.on("submit", function () {
          return false;
        });

        const calls = await withAjaxSubmitStub(async function (calls) {
          $form.ajaxForm();
          $form.trigger("submit");
          return calls;
        });

        assert.strictEqual(calls.length, 0);
      });

      it("should not run when an earlier submit handler stops immediate propagation", async function () {
        const $form = $("<form></form>").appendTo("#main");
        const event = $.Event("submit");
        $form.on("submit", function (submitEvent) {
          submitEvent.stopImmediatePropagation();
        });
        $form[0].submit = function () {};

        const calls = await withAjaxSubmitStub(async function (calls) {
          $form.ajaxForm();
          $form.trigger(event);
          return calls;
        });

        assert.strictEqual(calls.length, 0);
        assert.strictEqual(event.isDefaultPrevented(), false);
      });

      it("should submit even when a later submit handler prevents default", async function () {
        const $form = $("<form></form>").appendTo("#main");
        let preventedBefore;

        const calls = await withAjaxSubmitStub(async function (calls) {
          $form.ajaxForm();
          $form.on("submit", function (event) {
            preventedBefore = event.isDefaultPrevented();
            return false;
          });
          $form.trigger("submit");
          return calls;
        });

        assert.strictEqual(calls.length, 1);
        assert.strictEqual(preventedBefore, true);
      });

      it("should prevent the default action and let the submit event propagate", async function () {
        const $form = $("<form></form>").appendTo("#main");
        const event = $.Event("submit");
        let reachedParent = false;
        $("#main").on("submit.ajax-form-test", function () {
          reachedParent = true;
        });

        try {
          await withAjaxSubmitStub(async function () {
            $form.ajaxForm();
            $form.trigger(event);
          });
        } finally {
          $("#main").off("submit.ajax-form-test");
        }

        assert.strictEqual(event.isDefaultPrevented(), true);
        assert.strictEqual(reachedParent, true);
      });

      it("should call a replacement ajaxSubmit installed after binding", async function () {
        const $form = $("<form></form>").appendTo("#main");
        $form.ajaxForm();

        const calls = await withAjaxSubmitStub(async function (calls) {
          $form.trigger("submit");
          return calls;
        });

        assert.strictEqual(calls.length, 1);
      });

      it("should prevent default without sending when the submit target is not in a form", async function () {
        const $container = $("<div><span>Not a form</span></div>").appendTo("#main");
        const event = $.Event("submit");
        $container.ajaxForm();

        const requests = await withAjaxCapture(function () {
          $container.find("span").trigger(event);
        });

        assert.strictEqual(event.isDefaultPrevented(), true);
        assert.strictEqual(requests.length, 0);
      });

      it("should rethrow ajaxSubmit errors from trigger after preventing default", function () {
        const $form = $("<form></form>").appendTo("#main");
        const event = $.Event("submit");
        const ajaxSubmit = $.fn.ajaxSubmit;
        $.fn.ajaxSubmit = function () {
          throw new Error("submit failed");
        };
        $form.ajaxForm();

        try {
          const submit = () => $form.trigger(event);

          assert.throws(submit, /submit failed/);
          assert.strictEqual(event.isDefaultPrevented(), true);
        } finally {
          $.fn.ajaxSubmit = ajaxSubmit;
        }
      });

      it("should not capture a submitter or call native submit when submit is triggered", async function () {
        const $form = $('<form><button type="submit" name="choice">Send</button></form>').appendTo(
          "#main"
        );
        let nativeSubmits = 0;
        $form[0].submit = function () {
          nativeSubmits++;
        };

        const calls = await withAjaxSubmitStub(async function (calls) {
          $form.ajaxForm();
          $form.trigger("submit");
          return calls;
        });

        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0].clk, undefined);
        assert.strictEqual(nativeSubmits, 0);
      });

      it("should store the jqXHR on the form", async function () {
        const $form = $('<form method="post" action="ajax/text.html"></form>').appendTo("#main");
        const jqXHR = { readyState: 1 };

        await withAjaxStub(
          function () {
            return jqXHR;
          },
          async function () {
            $form.ajaxForm();
            $form.trigger("submit");
            await Promise.resolve();
          }
        );

        assert.strictEqual($form.data("jqxhr"), jqXHR);
      });

      [
        ["false", false, "get"],
        ["false", false, "post"],
        ["empty", "", "get"],
        ["empty", "", "post"],
      ].forEach(function ([label, url, method]) {
        it(
          "should submit a " + method + " form to its action when the shorthand url is " + label,
          async function () {
            const $form = $(
              '<form method="' +
                method +
                '" action="ajax/text.html"><input name="q" value="1"></form>'
            ).appendTo("#main");
            $form.ajaxForm(url);

            const requests = await withAjaxCapture(function () {
              $form.trigger("submit");
            });

            assert.match(String(requests[0].url), /ajax\/text\.html/);
          }
        );
      });

      // jQuery 3 and 4 would read the control in place of the form's nodeType inside closest("form").
      it("should submit the form when a control is named nodeType", async function () {
        const $form = $('<form><input name="nodeType" value="1"></form>').appendTo("#main");

        const calls = await withAjaxSubmitStub(async function (calls) {
          $form.ajaxForm();
          $form.trigger("submit");
          return calls;
        });

        assert.strictEqual(calls[0].form, $form[0]);
      });
    });

    describe("native submission", function () {
      it("should submit through the plugin when requestSubmit is called", async function () {
        const $form = $('<form method="post" action="ajax/text.html"></form>').appendTo("#main");
        $form.ajaxForm();

        let reached;
        const requests = await withNavigationStopped(function (submits) {
          reached = submits;
          return withAjaxCapture(function () {
            $form[0].requestSubmit();
          });
        });

        assert.strictEqual(requests.length, 1);
        assert.deepEqual(reached, [true]);
      });

      it("should not submit when requestSubmit finds the form invalid", async function () {
        const $form = $(
          '<form method="post" action="ajax/text.html"><input name="q" required></form>'
        ).appendTo("#main");
        $form.ajaxForm();

        const requests = await withNavigationStopped(function () {
          return withAjaxCapture(function () {
            $form[0].requestSubmit();
          });
        });

        assert.strictEqual(requests.length, 0);
      });

      it("should include the submitter passed to requestSubmit", async function () {
        const $form = $(
          '<form method="post" action="ajax/text.html"><button name="choice" value="passed">Send</button></form>'
        ).appendTo("#main");
        $form.ajaxForm();

        const requests = await withNavigationStopped(function () {
          return withAjaxCapture(function () {
            $form[0].requestSubmit($form.find("button")[0]);
          });
        });

        if ("submitter" in SubmitEvent.prototype) {
          assert.match(requests[0].data, /choice=passed/);
        } else {
          assert.notMatch(requests[0].data, /choice=passed/);
        }
      });

      it("should send the point 0,0 for an image passed to requestSubmit", async function () {
        const $form = $(
          '<form method="post" action="ajax/text.html"><input name="a" value="1"><input type="image" name="im" src="data:,"></form>'
        ).appendTo("#main");
        $form.ajaxForm();

        const requests = await withNavigationStopped(function () {
          return withAjaxCapture(function () {
            $form[0].requestSubmit($form.find("[name=im]")[0]);
          });
        });

        if ("submitter" in SubmitEvent.prototype) {
          assert.strictEqual(requests[0].data, "a=1&im=&im.x=0&im.y=0");
        } else {
          assert.strictEqual(requests[0].data, "a=1");
        }
      });

      it("should prefer a captured click over the submitter passed to requestSubmit", async function () {
        const $form = $(
          '<form method="post" action="ajax/text.html"><button name="choice" value="clicked">A</button><button name="choice" value="passed">B</button></form>'
        ).appendTo("#main");
        $form
          .find("button")
          .first()
          .on("click", function (event) {
            event.preventDefault();
          });
        $form.ajaxForm();

        const requests = await withNavigationStopped(function () {
          return withAjaxCapture(function () {
            $form.find("button").first().trigger("click");
            $form[0].requestSubmit($form.find("button")[1]);
          });
        });

        assert.strictEqual(requests[0].data, "choice=clicked");
      });

      it("should include the default button when the form is submitted with Enter", async function () {
        const $form = $(
          '<form method="post" action="ajax/text.html"><input name="q" value="1"><button name="choice" value="default">Send</button></form>'
        ).appendTo("#visible-fixture");
        $form.ajaxForm();

        const requests = await withNavigationStopped(function () {
          return withAjaxCapture(async function () {
            $form.find("input")[0].focus();
            await userEvent.keyboard("{Enter}");
            await new Promise((resolve) => setTimeout(resolve, 0));
          });
        });

        assert.strictEqual(requests.length, 1);
        assert.match(requests[0].data, /choice=default/);
      });

      it("should include no submitter when a form without a button is submitted with Enter", async function () {
        const $form = $(
          '<form method="post" action="ajax/text.html"><input name="q" value="1"></form>'
        ).appendTo("#visible-fixture");
        $form.ajaxForm();

        const requests = await withNavigationStopped(function () {
          return withAjaxCapture(async function () {
            $form.find("input")[0].focus();
            await userEvent.keyboard("{Enter}");
            await new Promise((resolve) => setTimeout(resolve, 0));
          });
        });

        assert.strictEqual(requests.length, 1);
        assert.strictEqual(requests[0].data, "q=1");
      });

      it("should include a submit button associated by the form attribute from outside the form", async function () {
        const $form = $(
          '<form id="outside-owner" method="post" action="ajax/text.html"><input name="q" value="1"></form>'
        ).appendTo("#main");
        const $button = $(
          '<button type="submit" form="outside-owner" name="choice" value="outside">Send</button>'
        ).appendTo("#main");
        $form.ajaxForm();

        const requests = await withNavigationStopped(function () {
          return withAjaxCapture(function () {
            $button[0].click();
          });
        });

        if ("submitter" in SubmitEvent.prototype) {
          assert.match(requests[0].data, /choice=outside/);
        } else {
          assert.notMatch(requests[0].data, /choice=outside/);
        }
      });

      it("should let a native submit through after ajaxFormUnbind", async function () {
        const $form = $('<form method="post" action="ajax/text.html"></form>').appendTo("#main");
        $form.ajaxForm().ajaxFormUnbind();

        let reached;
        const requests = await withNavigationStopped(function (submits) {
          reached = submits;
          return withAjaxCapture(function () {
            $form[0].requestSubmit();
          });
        });

        assert.strictEqual(requests.length, 0);
        assert.deepEqual(reached, [false]);
      });
    });

    describe("click capture", function () {
      [
        ["a button-typed button", '<button type="button">Go</button>'],
        ["a reset button", '<button type="reset">Go</button>'],
        ["a reset input", '<input type="reset">'],
        ["a button input", '<input type="button" value="Go">'],
        ["a checkbox", '<input type="checkbox" name="c">'],
        ["a radio button", '<input type="radio" name="r">'],
      ].forEach(function ([label, html]) {
        it("should ignore clicks on " + label, function () {
          const $form = $("<form></form>").append(html).appendTo("#main");
          $form.ajaxForm();

          $form.children().trigger("click");

          assert.strictEqual($form[0].clk, undefined);
        });
      });

      [
        ["a button with an invalid type", '<button type="bogus">Go</button>'],
        ["an input with an upper-case submit type", '<input type="SUBMIT">'],
      ].forEach(function ([label, html]) {
        it("should capture " + label, async function () {
          const $form = $("<form></form>").append(html).appendTo("#main");

          await withAjaxSubmitStub(async function () {
            $form.ajaxForm();
            $form.children().trigger("click");
          });

          assert.strictEqual($form[0].clk, $form.children()[0]);
        });
      });

      it("should set clk on the form named by the button's form attribute when clicked inside another form", async function () {
        const $bound = $(
          '<form><button type="submit" form="named-owner">Send</button></form>'
        ).appendTo("#main");
        const $owner = $('<form id="named-owner"></form>').appendTo("#main");
        $owner.on("submit", false);

        await withAjaxSubmitStub(async function () {
          $bound.ajaxForm();
          $bound.find("button").trigger("click");
        });

        assert.strictEqual($owner[0].clk, $bound.find("button")[0]);
        assert.strictEqual($bound[0].clk, undefined);
      });

      it("should submit through the plugin when a submit button click is triggered", async function () {
        const $form = $('<form><button type="submit" name="choice">Send</button></form>').appendTo(
          "#main"
        );
        const options = {};

        const calls = await withAjaxSubmitStub(async function (calls) {
          $form.ajaxForm(options);
          $form.find("button").trigger("click");
          return calls;
        });

        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0].form, $form[0]);
        assert.strictEqual(calls[0].options, options);
        assert.strictEqual(calls[0].clk, $form.find("button")[0]);
      });

      it("should leave existing coordinates when a non-image submit is clicked", async function () {
        const $form = $('<form><button type="submit">Send</button></form>').appendTo("#main");
        $form[0].clk_x = 5;
        $form[0].clk_y = 6;

        await withAjaxSubmitStub(async function () {
          $form.ajaxForm();
          $form.find("button").trigger("click");
        });

        assert.strictEqual($form[0].clk_x, 5);
        assert.strictEqual($form[0].clk_y, 6);
      });

      it("should set clk, clk_x and clk_y to null after the click window for a non-image submit", async function () {
        const $form = $('<form><button type="submit">Send</button></form>').appendTo("#main");

        await withAjaxSubmitStub(async function () {
          $form.ajaxForm();
          $form.find("button").trigger("click");
          await new Promise((resolve) => setTimeout(resolve, 120));
        });

        assert.strictEqual($form[0].clk, null);
        assert.strictEqual($form[0].clk_x, null);
        assert.strictEqual($form[0].clk_y, null);
      });

      it("should clear a second click's submitter when the first click's window ends", async function () {
        const $form = $(
          '<form><button type="submit" name="a">A</button><button type="submit" name="b">B</button></form>'
        ).appendTo("#main");
        const clears = [];
        const setTimeoutBefore = window.setTimeout;

        await withAjaxSubmitStub(async function () {
          $form.ajaxForm();
          window.setTimeout = function (callback) {
            clears.push(callback);
            return 0;
          };
          try {
            $form.find("[name=a]").trigger("click");
            $form.find("[name=b]").trigger("click");
          } finally {
            window.setTimeout = setTimeoutBefore;
          }
        });
        const secondCapture = $form[0].clk;
        clears[0]();

        assert.strictEqual(secondCapture, $form.find("[name=b]")[0]);
        assert.strictEqual($form[0].clk, null);
      });

      it("should capture a submitter whose click default was prevented", async function () {
        const $form = $('<form><button type="submit">Send</button></form>').appendTo("#main");
        $form.find("button").on("click", function (event) {
          event.preventDefault();
        });

        const calls = await withAjaxSubmitStub(async function (calls) {
          $form.ajaxForm();
          $form.find("button").trigger("click");
          return calls;
        });

        assert.strictEqual($form[0].clk, $form.find("button")[0]);
        assert.strictEqual(calls.length, 0);
      });

      it("should capture a disabled submit button when its click is triggered", async function () {
        const $form = $('<form><button type="submit" disabled>Send</button></form>').appendTo(
          "#main"
        );

        await withAjaxSubmitStub(async function () {
          $form.ajaxForm();
          $form.find("button").trigger("click");
        });

        assert.strictEqual($form[0].clk, $form.find("button")[0]);
      });

      it("should send the clicked button when a control named clk is in the form", async function () {
        const $form = $(
          '<form method="post" action="ajax/text.html"><input name="clk" value="1"><button type="submit" name="choice" value="go">Send</button></form>'
        ).appendTo("#main");
        $form.ajaxForm();

        const requests = await withAjaxCapture(function () {
          $form.find("button").trigger("click");
        });

        assert.strictEqual(requests[0].data, "clk=1&choice=go");
      });

      it("should send the clicked image's coordinates when controls named clk_x and clk_y are in the form", async function () {
        const $form = $(
          '<form method="post" action="ajax/text.html"><input name="clk_x" value="1"><input name="clk_y" value="2"><input type="image" name="im" src="data:,"></form>'
        ).appendTo("#visible-fixture");
        $form.ajaxForm();

        const requests = await withAjaxCapture(function () {
          $form.find("[name=im]").trigger($.Event("click", { offsetX: 3, offsetY: 4 }));
        });

        assert.strictEqual(requests[0].data, "clk_x=1&clk_y=2&im=&im.x=3&im.y=4");
      });

      it("should send NaN image coordinates when the click is triggered without coordinates", async function () {
        const $form = $(
          '<form method="post" action="ajax/text.html"><input name="a" value="1"><input type="image" name="im" src="data:,"></form>'
        ).appendTo("#visible-fixture");
        $form.ajaxForm();

        const requests = await withAjaxCapture(function () {
          $form.find("[name=im]").trigger("click");
        });

        assert.match(requests[0].data, /im\.x=NaN&im\.y=NaN/);
      });

      describe("with an iframe upload", function () {
        restoreAjaxState();

        it("should post form.clk again when it was not cleared before an iframe upload", async function () {
          const $form = $(
            '<form method="post" action="ajax/iframe-text.html"><button type="submit" name="choice" value="stale">Send</button></form>'
          ).appendTo("#main");
          const posted = [];
          $form[0].submit = function () {
            posted.push($(this).find('input[type="hidden"][name="choice"]').val());
          };
          $form[0].clk = $form.find("button")[0];

          for (let upload = 0; upload < 2; upload++) {
            $form.ajaxSubmit({ iframe: true, forceSync: true, error: function () {} });
            $form.data("jqxhr").abort();
          }
          await new Promise((resolve) => setTimeout(resolve, 50));

          assert.deepEqual(posted, ["stale", "stale"]);
        });
      });
    });

    describe("controls named like form members", function () {
      it("should throw a clear error on a click when a control named parentNode hides the form's parent", function () {
        const form = formHidingParentNode("<span>content</span>");
        const $form = $(form).ajaxForm();
        const click = $.Event("click", { target: form.querySelector("span") });

        const capture = () => $form.triggerHandler(click);

        assert.throws(capture, /control named "parentNode"/);
      }, 2000);

      it("should capture the button around the clicked content through the real tree when delegating", function () {
        const form = formHidingParentNode('<button type="submit"><span>Go</span></button>');
        const click = $.Event("click", { target: form.querySelector("span") });

        try {
          $(form).ajaxForm({ delegation: true });
          $(document).triggerHandler(click);

          assert.strictEqual(form.clk, form.querySelector("button"));
        } finally {
          $(document).off(".form-plugin");
        }
      }, 2000);
      it("should capture the button around the clicked content when delegating to a selector", function () {
        const form = formHidingParentNode('<button type="submit"><span>Go</span></button>');
        form.className = "scoped-ajax-form";
        const click = $.Event("click", { target: form.querySelector("span") });

        try {
          $().ajaxForm({ delegation: ".scoped-ajax-form" });
          $(document).triggerHandler(click);

          assert.strictEqual(form.clk, form.querySelector("button"));
        } finally {
          $(document).off(".form-plugin");
        }
      }, 2000);
    });

    describe("ajaxFormUnbind", function () {
      it("should not capture clicks after ajaxFormUnbind", function () {
        const $form = $('<form><button type="submit">Send</button></form>').appendTo("#main");
        $form.on("submit", false);
        $form.ajaxForm().ajaxFormUnbind();

        $form.find("button").trigger("click");

        assert.strictEqual($form[0].clk, undefined);
      });

      it("should return the selection and ignore its arguments", function () {
        const $form = $("<form></form>").appendTo("#main");
        $form.ajaxForm();

        const result = $form.ajaxFormUnbind({ delegation: true });

        assert.strictEqual(result, $form);
        assert.strictEqual($._data($form[0], "events"), undefined);
      });

      it("should leave other form-plugin events and the captured submitter in place", function () {
        const $form = $('<form><button type="submit">Send</button></form>').appendTo("#main");
        const button = $form.find("button")[0];
        $form.on("form-pre-serialize.form-plugin", function () {});
        $form.ajaxForm();
        $form[0].clk = button;

        $form.ajaxFormUnbind();

        assert.strictEqual($._data($form[0], "events")["form-pre-serialize"].length, 1);
        assert.strictEqual($form[0].clk, button);
      });

      describe("with delegated bindings", function () {
        afterEach(function () {
          $(document).off(".form-plugin");
        });

        it("should keep a delegation selector working when another form is bound directly", async function () {
          const $scoped = $('<form class="scoped-ajax-form"></form>').appendTo("#main");
          const $direct = $("<form></form>").appendTo("#main");
          $().ajaxForm({ delegation: ".scoped-ajax-form" });

          const calls = await withAjaxSubmitStub(async function (calls) {
            $direct.ajaxForm();
            $scoped.trigger("submit");
            return calls;
          });

          assert.deepEqual(
            calls.map((call) => call.form),
            [$scoped[0]]
          );
        });

        it("should remove every delegated binding when called without arguments", function () {
          $().ajaxForm({ delegation: ".first-ajax-form" });
          $(".missing-ajax-form").ajaxForm({ delegation: true });

          $().ajaxFormUnbind();

          const events = $._data(document, "events");
          assert.strictEqual(events && events.submit, undefined);
          assert.strictEqual(events && events.click, undefined);
        });

        it("should remove only the given selector's delegated binding", async function () {
          const $first = $('<form class="first-ajax-form"></form>').appendTo("#main");
          const $second = $('<form class="second-ajax-form"></form>').appendTo("#main");
          $().ajaxForm({ delegation: ".first-ajax-form" });
          $().ajaxForm({ delegation: ".second-ajax-form" });

          const calls = await withAjaxSubmitStub(async function (calls) {
            $().ajaxFormUnbind(".first-ajax-form");
            $(document).triggerHandler($.Event("submit", { target: $first[0] }));
            $(document).triggerHandler($.Event("submit", { target: $second[0] }));
            return calls;
          });

          assert.deepEqual(
            calls.map((call) => call.form),
            [$second[0]]
          );
        });

        it("should leave the selection's own handlers when given a selector", function () {
          const $form = $("<form></form>").appendTo("#main");
          $form.ajaxForm();

          $form.ajaxFormUnbind(".first-ajax-form");

          assert.strictEqual($._data($form[0], "events").submit.length, 1);
        });

        it("should ignore a selector that was never bound", function () {
          $().ajaxForm({ delegation: ".first-ajax-form" });

          $().ajaxFormUnbind(".other-ajax-form");

          assert.strictEqual($._data(document, "events").submit.length, 1);
        });
      });

      it("should return an empty selection unchanged", function () {
        const $missing = $(".missing-ajax-form");

        const result = $missing.ajaxFormUnbind();

        assert.strictEqual(result, $missing);
      });
    });
  });
});
