import { assert, describe, it } from "vitest";
import { resetFixture, arrayValue, submitAndSettle } from "./helpers.js";

describe("form", function () {
  resetFixture();

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

      it("should not queue an empty selection without selector metadata", async function () {
        const $pending = $(".unqueued-ajax-form");

        const result = withDomNotReady(() => $pending.ajaxForm());
        const $form = $('<form class="unqueued-ajax-form"></form>').appendTo("#main");
        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(result, $pending);
        assert.strictEqual($._data($form[0], "events"), undefined);
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

    it("should capture a submit button when nested content is clicked", function () {
      const $form = $(
        '<form><button type="submit" name="choice" value="nested"><span>Send</span></button></form>'
      ).appendTo("#main");
      const button = $form.find("button")[0];

      $form.ajaxForm();
      $form.find("span").trigger("click");

      assert.strictEqual($form[0].clk, button);
    });

    // #588: a button without a type attribute is a submit button.
    it("should capture a button without a type attribute", function () {
      const $form = $(
        '<form><button name="choice" value="untyped"><span>Send</span></button></form>'
      ).appendTo("#main");
      const button = $form.find("button")[0];

      $form.ajaxForm();
      $form.find("span").trigger("click");

      assert.strictEqual($form[0].clk, button);
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

    // jQuery 3.7 removed the selection selector needed to scope delegated handlers.
    it.fails("should scope delegated handlers to the selected forms", function () {
      const $selected = $('<form class="delegated"></form>').appendTo("#main");
      const $unselected = $("<form></form>").appendTo("#main");
      const ajaxSubmit = $.fn.ajaxSubmit;
      let submissions = 0;
      $.fn.ajaxSubmit = function () {
        submissions++;
        return this;
      };

      try {
        $selected.ajaxForm({ delegation: true });
        $unselected.trigger("submit");

        assert.strictEqual(submissions, 0);
      } finally {
        $(document).off(".form-plugin");
        $.fn.ajaxSubmit = ajaxSubmit;
      }
    });

    it("should capture image coordinates supplied by the click event", function () {
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

    it("should derive image coordinates from its document offset", function () {
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

    it("should derive image coordinates from element offsets without the offset helper", function () {
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

    it("should clear captured submit details after the click window", async function () {
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
  });
});
