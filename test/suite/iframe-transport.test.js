import { afterEach, assert, describe, it, vi } from "vitest";
import {
  recordDeprecations,
  resetFixture,
  restoreAjaxState,
  selectFiles,
  submitTransport,
  withAjaxSettings,
  withWindowErrors,
} from "./helpers.js";

describe("form", function () {
  resetFixture();

  describe("ajaxSubmit", function () {
    describe("iframe upload transport", function () {
      restoreAjaxState();

      function createIframeForm(action) {
        return $('<form method="post"><input name="upload" value="yes"></form>')
          .attr("action", action)
          .appendTo("#main");
      }

      function submitThroughIframe($form, options) {
        return new Promise(function (resolve) {
          const result = { events: [] };
          const settings = $.extend({}, options, {
            iframe: true,
            success: function () {
              result.success = Array.from(arguments);
              result.events.push("success");
            },
            error: function () {
              result.error = Array.from(arguments);
              result.events.push("error");
            },
            complete: function () {
              result.complete = Array.from(arguments);
              result.events.push("complete");
              resolve(result);
            },
          });

          $form.ajaxSubmit(settings);
          result.xhr = $form.data("jqxhr");
        });
      }

      function inspectNativeSubmit($form, inspect) {
        const form = $form[0];
        const nativeSubmit = form.submit;
        form.submit = function () {
          inspect(form);
          delete form.submit;
          nativeSubmit.call(form);
        };
      }

      it("should submit through a generated iframe and clean it up", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");
        const initialFrames = $("iframe").length;

        const result = await submitThroughIframe($form, { forceSync: true, dataType: "text" });
        await new Promise((resolve) => setTimeout(resolve, 150));

        assert.strictEqual(result.success[0].trim(), "iframe response");
        assert.strictEqual(result.success[1], "success");
        assert.strictEqual(result.success[2].status, 201);
        assert.deepEqual(result.events, ["success", "complete"]);
        assert.strictEqual($("iframe").length, initialFrames);
      });

      it("should use and reset a supplied iframe target", async function () {
        const $target = $('<iframe name="provided-frame"></iframe>').appendTo("#main");
        const $form = createIframeForm("ajax/iframe-text.html");

        const result = await submitThroughIframe($form, {
          iframeTarget: $target,
          dataType: "text",
        });
        await new Promise((resolve) => setTimeout(resolve, 150));

        assert.strictEqual(result.success[0].trim(), "iframe response");
        assert.strictEqual($target.attr("name"), "provided-frame");
        assert.strictEqual($target.attr("src"), "about:blank");
        assert.strictEqual($target.parent().length, 1);
      });

      it("should name a supplied iframe target that has no name", function () {
        const $target = $("<iframe></iframe>").appendTo("#main");
        const $form = createIframeForm("ajax/iframe-text.html");

        $form.ajaxSubmit({
          iframe: true,
          iframeTarget: $target,
          beforeSend: function () {
            return false;
          },
        });

        assert.match($target.attr("name"), /^jqFormIO\d+$/);
      });

      it("should reject when beforeSend aborts the iframe request", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");
        let xhr;

        $form.ajaxSubmit({
          iframe: true,
          beforeSend: function (request) {
            xhr = request;
            request.abort("early");
          },
        });
        const deferred = $form.data("jqxhr");
        const rejected = await new Promise((resolve) => deferred.fail(() => resolve(true)));

        assert.strictEqual(rejected, true);
        assert.strictEqual(xhr.error, "aborted");
        assert.strictEqual(xhr.aborted, 1);
      });

      it("should submit clicked image values and coordinates as hidden inputs", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");
        const image = $('<input type="image" name="map" value="go">').appendTo($form)[0];
        const submitted = {};
        $form[0].clk = image;
        $form[0].clk_x = 12;
        $form[0].clk_y = 34;
        inspectNativeSubmit($form, function (form) {
          $(form)
            .find('input[type="hidden"]')
            .each(function () {
              submitted[this.name] = this.value;
            });
        });

        await submitThroughIframe($form, { dataType: "text" });

        assert.deepEqual(submitted, { map: "go", "map.x": "12", "map.y": "34" });
      });

      it("should submit CSRF metadata and remove its temporary input", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");
        const $token = $('<meta name="csrf-token" content="secret">').appendTo(document.head);
        const $param = $('<meta name="csrf-param" content="authenticity_token">').appendTo(
          document.head
        );
        let submittedToken;
        inspectNativeSubmit($form, function (form) {
          submittedToken = $(form).find('[name="authenticity_token"]').val();
        });

        try {
          await submitThroughIframe($form, { dataType: "text" });

          assert.strictEqual(submittedToken, "secret");
          assert.strictEqual($form.find('[name="authenticity_token"]').length, 0);
        } finally {
          $token.remove();
          $param.remove();
        }
      });

      it("should not send CSRF metadata to another origin", function () {
        const $form = createIframeForm("https://upload.example.invalid/form");
        const $token = $('<meta name="csrf-token" content="secret">').appendTo(document.head);
        const $param = $('<meta name="csrf-param" content="authenticity_token">').appendTo(
          document.head
        );
        let submittedTokens;
        $form[0].submit = function () {
          submittedTokens = $(this).find('[name="authenticity_token"]').length;
        };

        try {
          $form.ajaxSubmit({ iframe: true, forceSync: true, error: function () {} });
          $form.data("jqxhr").abort();

          assert.strictEqual(submittedTokens, 0);
        } finally {
          $token.remove();
          $param.remove();
        }
      });

      for (const [label, markup] of [
        ["a get form", '<form method="get">'],
        ["a form without a method", "<form>"],
      ]) {
        it(`should not send CSRF metadata with ${label}, whose query it would join`, function () {
          const $form = $(markup + '<input name="upload" value="yes"></form>')
            .attr("action", "ajax/iframe-text.html")
            .appendTo("#main");
          const $token = $('<meta name="csrf-token" content="secret">').appendTo(document.head);
          const $param = $('<meta name="csrf-param" content="authenticity_token">').appendTo(
            document.head
          );
          let submittedTokens;
          $form[0].submit = function () {
            submittedTokens = $(this).find('[name="authenticity_token"]').length;
          };

          try {
            $form.ajaxSubmit({ iframe: true, forceSync: true, error: function () {} });
            $form.data("jqxhr").abort();

            assert.strictEqual(submittedTokens, 0);
          } finally {
            $token.remove();
            $param.remove();
          }
        });
      }

      for (const [type, method, tokens] of [
        ["GET", "get", 0],
        ["PUT", "post", 1],
      ]) {
        it(`should submit a post form with ${method} and ${tokens} CSRF field when the type option is ${type}`, function () {
          const $form = createIframeForm("ajax/iframe-text.html");
          const $metas = $(
            '<meta name="csrf-token" content="secret"><meta name="csrf-param" content="authenticity_token">'
          ).appendTo(document.head);
          let submitted;
          $form[0].submit = function () {
            submitted = [this.method, $(this).find('[name="authenticity_token"]').length];
          };

          try {
            $form.ajaxSubmit({ iframe: true, forceSync: true, type: type, error: function () {} });
            $form.data("jqxhr").abort();

            assert.deepEqual(submitted, [method, tokens]);
          } finally {
            $metas.remove();
          }
        });
      }

      it("should override the action during submission and then restore it", async function () {
        const $form = createIframeForm("ajax/original.html");
        let submittedAction;
        inspectNativeSubmit($form, function (form) {
          submittedAction = form.getAttribute("action");
        });

        await submitThroughIframe($form, { url: "ajax/iframe-text.html", dataType: "text" });

        assert.ok(submittedAction.endsWith("ajax/iframe-text.html"));
        assert.ok($form.attr("action").endsWith("ajax/original.html"));
      });

      it("should submit both extraData representations and remove temporary inputs", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");
        const submitted = {};
        inspectNativeSubmit($form, function (form) {
          $(form)
            .find('input[type="hidden"]')
            .each(function () {
              submitted[this.name] = this.value;
            });
        });

        await submitThroughIframe($form, {
          data: {
            plain: "value",
            aliased: { name: "actual", value: "represented" },
          },
          dataType: "text",
        });

        assert.deepEqual(submitted, { plain: "value", actual: "represented" });
        assert.strictEqual($form.find('input[type="hidden"]').length, 0);
      });

      it("should fall back to native submission when a control shadows form.submit", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");
        $('<input name="submit" value="shadow">').appendTo($form);

        const result = await submitThroughIframe($form, { dataType: "text" });

        assert.strictEqual(result.success[0].trim(), "iframe response");
      });

      it("should restore an original form target after submission", async function () {
        const $form = createIframeForm("ajax/iframe-text.html").attr("target", "original-target");

        await submitThroughIframe($form, { dataType: "text" });

        assert.strictEqual($form.attr("target"), "original-target");
      });

      it("should wait for closeKeepAlive before creating the iframe request", async function () {
        const originalGet = $.get;
        const $form = createIframeForm("ajax/iframe-text.html");
        let release;
        let resolveCompletion;
        const completed = new Promise((resolve) => {
          resolveCompletion = resolve;
        });
        $.get = function (_url, callback) {
          release = callback;
        };

        try {
          $form.ajaxSubmit({
            iframe: true,
            closeKeepAlive: "/close",
            dataType: "text",
            complete: resolveCompletion,
          });
          const beforeRelease = $form.data("jqxhr");

          release();
          await completed;

          assert.strictEqual(beforeRelease, undefined);
        } finally {
          $.get = originalGet;
        }
      });

      it("should insert what dataFilter returns into the target on an upload", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");
        const $target = $('<div id="iframe-filter-target">kept</div>').appendTo("#main");

        await submitThroughIframe($form, {
          target: $target,
          dataFilter: (data) => "filtered " + typeof data,
        });

        assert.strictEqual($target.text(), "filtered string");
      });

      it("should parse textarea JSON and apply dataFilter", async function () {
        const $form = createIframeForm("ajax/iframe-json.html");
        let filtered;

        const result = await submitThroughIframe($form, {
          dataType: "json",
          textarea: true,
          dataFilter: function (data, type) {
            filtered = [data, type];
            return data;
          },
        });

        assert.deepEqual(result.success[0], { transport: "iframe" });
        assert.deepEqual(filtered, ['{"transport":"iframe"}', "json"]);
        assert.strictEqual(result.success[2].status, 202);
        assert.strictEqual(result.success[2].statusText, "accepted");
      });

      it("should evaluate script from a pre response", async function () {
        const $form = createIframeForm("ajax/iframe-script.html");
        delete window.iframeTransportScript;

        const result = await submitThroughIframe($form, { dataType: "script" });

        assert.strictEqual(window.iframeTransportScript, "evaluated");
        assert.ok(result.success[0].includes("iframeTransportScript"));
        delete window.iframeTransportScript;
      });

      it("should return an XML document", async function () {
        const $form = createIframeForm("ajax/iframe-xml.html");

        const result = await submitThroughIframe($form, { dataType: "xml" });

        assert.strictEqual(result.success[0].documentElement.nodeName, "response");
        assert.strictEqual(
          result.success[0].getElementsByTagName("transport")[0].textContent,
          "iframe"
        );
      });

      it("should expose the iframe mock response header methods", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");

        const result = await submitThroughIframe($form, { dataType: "text" });
        const xhr = result.success[2];

        assert.strictEqual(xhr.getResponseHeader("Content-Type"), "text");
        assert.strictEqual(xhr.getResponseHeader("Missing"), undefined);
        assert.strictEqual(xhr.getAllResponseHeaders(), undefined);
        assert.strictEqual(xhr.setRequestHeader("X-Test", "ignored"), undefined);
      });

      it("should clear a pending timeout after a successful response", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");

        const result = await submitThroughIframe($form, { dataType: "text", timeout: 1000 });
        await new Promise((resolve) => setTimeout(resolve, 20));

        assert.deepEqual(result.events, ["success", "complete"]);
        assert.strictEqual(result.xhr.error, undefined);
      });

      it("should report emulated HTTP errors and complete once", async function () {
        const $form = createIframeForm("ajax/iframe-error.html");

        const result = await submitThroughIframe($form, { dataType: "text" });

        assert.strictEqual(result.error[0].status, 500);
        assert.strictEqual(result.error[1], "error");
        assert.strictEqual(result.error[2], "fixture failure");
        assert.deepEqual(result.events, ["error", "complete"]);
      });

      it("should report an emulated HTTP error before a parser error", async function () {
        const $form = createIframeForm("ajax/iframe-error.html");

        const result = await submitThroughIframe($form, { dataType: "json" });

        assert.strictEqual(result.error[1], "error");
        assert.deepEqual(result.events, ["error", "complete"]);
      });

      it("should report malformed JSON as a parser error despite a success status", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");

        const result = await submitThroughIframe($form, { dataType: "json" });

        assert.strictEqual(result.error[1], "parsererror");
        assert.ok(result.error[2] instanceof Error);
      });

      it("should honor a beforeSend veto without submitting or completing", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");
        let complete = false;

        $form.ajaxSubmit({
          iframe: true,
          beforeSend: function () {
            return false;
          },
          complete: function () {
            complete = true;
          },
        });
        const xhr = $form.data("jqxhr");
        const rejected = await new Promise((resolve) => xhr.fail(() => resolve(true)));

        assert.strictEqual(rejected, true);
        assert.strictEqual(complete, false);
      });

      it("should time out an iframe request and call error then complete", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");

        const result = await submitThroughIframe($form, { timeout: 1 });

        assert.strictEqual(result.error[1], "timeout");
        assert.strictEqual(result.complete[1], "timeout");
        assert.deepEqual(result.events, ["error", "complete"]);
      });

      it("should emit matching global lifecycle events", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");
        const events = [];
        const names = "ajaxStart ajaxSend ajaxSuccess ajaxComplete ajaxStop";
        const active = $.active;
        $.active = 0;
        $(document).on(names, function (event) {
          events.push(event.type);
        });

        try {
          await submitThroughIframe($form, { dataType: "text", global: true });

          assert.deepEqual(events, names.split(" "));
          assert.strictEqual($.active, 0);
        } finally {
          $(document).off(names);
          $.active = active;
        }
      });

      it("should abort from beforeSend without global events", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");
        const events = [];
        $(document).on("ajaxSend ajaxError", (event) => events.push(event.type));

        try {
          $form.ajaxSubmit({
            iframe: true,
            global: false,
            beforeSend: (request) => request.abort(),
          });
          const state = await new Promise((resolve) =>
            $form.data("jqxhr").fail(() => resolve("rejected"))
          );

          assert.strictEqual(state, "rejected");
          assert.deepEqual(events, []);
        } finally {
          $(document).off("ajaxSend ajaxError");
        }
      });

      it("should leave the active count alone when beforeSend vetoes without global events", function () {
        const $form = createIframeForm("ajax/iframe-text.html");
        const active = $.active;

        $form.ajaxSubmit({ iframe: true, global: false, beforeSend: () => false });

        assert.strictEqual($.active, active);
        assert.strictEqual($form.data("jqxhr").state(), "rejected");
      });

      [
        ["an unnamed clicked button", '<button type="submit" value="ignored">Go</button>', {}],
        [
          "a named clicked submit button",
          '<button type="submit" name="choice" value="picked">Go</button>',
          { choice: "picked" },
        ],
      ].forEach(function ([label, markup, expected]) {
        it("should submit hidden values for " + label, async function () {
          const $form = createIframeForm("ajax/iframe-text.html");
          $form[0].clk = $(markup).appendTo($form)[0];
          const submitted = {};
          inspectNativeSubmit($form, function (form) {
            $(form)
              .find('input[type="hidden"]')
              .each(function () {
                submitted[this.name] = this.value;
              });
          });

          await submitThroughIframe($form, { dataType: "text" });

          assert.deepEqual(submitted, expected);
        });
      });

      it("should keep GET method and encoding when submitting with GET", async function () {
        const $form = createIframeForm("ajax/iframe-text.html").attr("method", "get");
        let submitted;
        inspectNativeSubmit($form, function (form) {
          submitted = [form.getAttribute("method"), form.getAttribute("enctype")];
        });

        const result = await submitThroughIframe($form, { dataType: "text" });

        assert.deepEqual(submitted, ["get", null]);
        assert.strictEqual(result.success[0].trim(), "iframe response");
      });

      // #597: arrays and objects are sent as $.param sends them.
      it("should submit array extraData values as separate fields", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");
        const submitted = [];
        inspectNativeSubmit($form, function (form) {
          $(form)
            .find('input[type="hidden"]')
            .each(function () {
              submitted.push([this.name, this.value]);
            });
        });

        await submitThroughIframe($form, { data: { tags: ["a", "b"] }, dataType: "text" });

        assert.deepEqual(submitted, [
          ["tags[]", "a"],
          ["tags[]", "b"],
        ]);
      });

      it("should submit nested extraData objects as bracketed fields", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");
        const submitted = [];
        inspectNativeSubmit($form, function (form) {
          $(form)
            .find('input[type="hidden"]')
            .each(function () {
              submitted.push([this.name, this.value]);
            });
        });

        await submitThroughIframe($form, {
          data: { meta: { owner: "Ada", tags: ["x"] }, plain: "a+b c" },
          dataType: "text",
        });

        assert.deepEqual(submitted, [
          ["meta[owner]", "Ada"],
          ["meta[tags][]", "x"],
          ["plain", "a+b c"],
        ]);
      });

      // Starts an iframe upload whose native submit only records the generated hidden inputs and
      // iframe, then aborts it.
      async function submitAndAbort($form, options) {
        const seen = {};
        $form[0].submit = function () {
          seen.hidden = $(this)
            .find('input[type="hidden"]')
            .map(function () {
              return [[this.name, this.value]];
            })
            .get();
          const target = this.getAttribute("target");
          seen.iframeSrc = $("iframe")
            .filter((i, frame) => frame.name === target)
            .attr("src");
        };

        $form.ajaxSubmit($.extend({ iframe: true, forceSync: true, error: () => {} }, options));
        $form.data("jqxhr").abort();
        await new Promise((resolve) => setTimeout(resolve, 50));

        return seen;
      }

      const payload = '"><img src=x onerror="window.iframePayload=1">';

      [
        ["an extraData name", { extraData: { field: { name: payload, value: "v" } } }],
        ["an extraData key", { extraData: { [payload]: "v" } }],
      ].forEach(function ([label, options]) {
        it("should submit " + label + " as text, not HTML", async function () {
          window.iframePayload = 0;
          const $form = createIframeForm("ajax/iframe-text.html");

          const seen = await submitAndAbort($form, options);

          assert.deepEqual(seen.hidden, [[payload, "v"]]);
          assert.strictEqual(window.iframePayload, 0);
        });
      });

      it("should submit a clicked button's name as text, not HTML", async function () {
        window.iframePayload = 0;
        const $form = createIframeForm("ajax/iframe-text.html");
        const $button = $('<button type="submit" value="v">').attr("name", payload).appendTo($form);
        $form[0].clk = $button[0];

        const seen = await submitAndAbort($form, {});

        assert.deepEqual(seen.hidden, [[payload, "v"]]);
        assert.strictEqual(window.iframePayload, 0);
      });

      it("should submit the CSRF parameter name as text, not HTML", async function () {
        window.iframePayload = 0;
        const $form = createIframeForm("ajax/iframe-text.html");
        const $metas = $('<meta name="csrf-token" content="t"><meta name="csrf-param">');
        $metas.last().attr("content", payload);
        $metas.appendTo(document.head);

        try {
          const seen = await submitAndAbort($form, {});

          assert.deepEqual(seen.hidden, [[payload, "t"]]);
          assert.strictEqual(window.iframePayload, 0);
        } finally {
          $metas.remove();
        }
      });

      it("should set the iframe source as an attribute, not HTML", async function () {
        window.iframePayload = 0;
        const iframeSrc = 'about:blank"></iframe><img src=x onerror="window.iframePayload=1">';
        const $form = createIframeForm("ajax/iframe-text.html");

        const seen = await submitAndAbort($form, { iframeSrc: iframeSrc });

        assert.strictEqual(seen.iframeSrc, iframeSrc);
        assert.strictEqual(window.iframePayload, 0);
      });

      it("should submit only own extraData properties", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");
        const data = Object.create({ inherited: "skipped" });
        data.own = "kept";
        const submitted = {};
        inspectNativeSubmit($form, function (form) {
          $(form)
            .find('input[type="hidden"]')
            .each(function () {
              submitted[this.name] = this.value;
            });
        });

        await submitThroughIframe($form, { data: data, dataType: "text" });

        assert.deepEqual(submitted, { own: "kept" });
      });

      // jQuery 1.7.2's selector engine calls setAttribute on the form itself, so it cannot run there.
      it.skipIf(Number($.fn.jquery.split(".")[0]) < 3)(
        "should submit and restore a form whose controls shadow its methods",
        async function () {
          const $form = createIframeForm("ajax/iframe-text.html");
          $(
            '<input name="setAttribute" value="a"><input name="removeAttribute" value="b">'
          ).appendTo($form);

          const result = await submitThroughIframe($form, { dataType: "text" });

          assert.deepEqual(result.events, ["success", "complete"]);
          assert.match($form[0].getAttribute("action"), /ajax\/iframe-text\.html$/);
          assert.strictEqual($form[0].hasAttribute("target"), false);
        }
      );

      it("should leave a missing action attribute missing when a control is named action", async function () {
        const $form = $('<form method="post"><input name="action" value="save"></form>').appendTo(
          "#main"
        );

        const result = await submitThroughIframe($form, {
          url: "ajax/iframe-text.html",
          dataType: "text",
        });

        assert.deepEqual(result.events, ["success", "complete"]);
        assert.strictEqual($form[0].hasAttribute("action"), false);
      });

      [
        ["ownerDocument", "the form's document"],
        ["getAttribute", "the form's attributes"],
      ].forEach(function ([name, member]) {
        // jQuery 1.7.2's selector engine reads both members on the form itself.
        it.skipIf(Number($.fn.jquery.split(".")[0]) < 3)(
          `should upload when a control named ${name} shadows ${member}`,
          async function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            $(`<input name="${name}" value="x">`).appendTo($form);

            const result = await submitThroughIframe($form, { dataType: "text" });

            assert.deepEqual(result.events, ["success", "complete"]);
            assert.strictEqual(result.success[0].trim(), "iframe response");
          }
        );
      });

      it("should submit extraData keys and buttons named hasOwnProperty", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");
        const button = $('<button type="submit" name="hasOwnProperty" value="go">').appendTo($form);
        $form[0].clk = button[0];
        const submitted = {};
        inspectNativeSubmit($form, function (form) {
          $(form)
            .find('input[type="hidden"]')
            .each(function () {
              submitted[this.name] = this.value;
            });
        });

        const result = await submitThroughIframe($form, {
          data: { pair: { name: "field", value: "kept", hasOwnProperty: "shadowed" } },
          dataType: "text",
        });

        assert.deepEqual(submitted, { field: "kept", hasOwnProperty: "go" });
        assert.deepEqual(result.events, ["success", "complete"]);
      });

      it("should succeed without global events", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");
        const events = [];
        $(document).on("ajaxSuccess ajaxComplete", (event) => events.push(event.type));

        try {
          const result = await submitThroughIframe($form, { dataType: "text", global: false });

          assert.deepEqual(result.events, ["success", "complete"]);
          assert.deepEqual(events, []);
        } finally {
          $(document).off("ajaxSuccess ajaxComplete");
        }
      });

      it("should reject an HTTP error without callbacks or global events", async function () {
        const $form = createIframeForm("ajax/iframe-error.html");

        $form.ajaxSubmit({ iframe: true, global: false });
        const rejection = await new Promise((resolve) =>
          $form.data("jqxhr").fail((...args) => resolve(args))
        );

        assert.strictEqual(rejection[0].status, 500);
        assert.deepEqual(rejection.slice(1), ["error", "fixture failure"]);
      });

      it("should return the response text when no dataType is given", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");

        const result = await submitThroughIframe($form, {});

        assert.strictEqual(result.success[0].trim(), "iframe response");
      });

      it("should keep the HTML when textarea extraction finds no textarea", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");

        const result = await submitThroughIframe($form, { dataType: "html", textarea: true });

        assert.strictEqual(result.success[0].trim(), "iframe response");
      });

      describe("response extraction", function () {
        it("should keep the default status for a textarea without status attributes", async function () {
          const $form = createIframeForm("ajax/iframe-textarea.html");

          const result = await submitThroughIframe($form, { dataType: "json" });

          assert.deepEqual(result.success[0], { bare: true });
          assert.strictEqual(result.success[2].status, 0);
          assert.strictEqual(result.success[2].statusText, "n/a");
        });

        [
          ["an empty pre", "ajax/iframe-empty-pre.html"],
          ["an empty body", "ajax/iframe-empty.html"],
        ].forEach(function ([label, url]) {
          it("should return empty text for " + label, async function () {
            const $form = createIframeForm(url);

            const result = await submitThroughIframe($form, { dataType: "text" });

            assert.strictEqual(result.success[0], "");
          });
        });

        it("should return null text for a response that removed its root element", async function () {
          const $form = createIframeForm("ajax/iframe-rootless.html");

          const result = await submitThroughIframe($form, { dataType: "text" });

          assert.strictEqual(result.success[0], null);
          assert.strictEqual(result.success[2].responseText, null);
        });

        it("should report parsererror when dataFilter throws without a reason", async function () {
          const $form = createIframeForm("ajax/iframe-plain.html");

          const result = await submitThroughIframe($form, {
            dataType: "json",
            dataFilter: function () {
              throw "";
            },
          });

          assert.deepEqual(result.error.slice(1, 3), ["parsererror", "parsererror"]);
          assert.strictEqual(result.xhr.state(), "rejected");
        });

        it("should complete once when aborted while filtering the response", async function () {
          const $form = createIframeForm("ajax/iframe-plain.html");
          const completions = [];
          let request;

          $form.ajaxSubmit({
            iframe: true,
            dataType: "text",
            beforeSend: (xhr) => {
              request = xhr;
            },
            dataFilter: (data) => {
              request.abort();
              return data;
            },
            complete: (_xhr, status) => completions.push(status),
          });
          await new Promise((resolve) => setTimeout(resolve, 150));

          assert.deepEqual(completions, ["aborted"]);
        });

        it("should prefer an IE XMLDocument island as the XML response", async function () {
          const $form = createIframeForm("ajax/iframe-xml-island.html");

          const result = await submitThroughIframe($form, { dataType: "xml" });

          assert.strictEqual(result.success[0].documentElement.nodeName, "island");
        });

        it("should report a parsererror document as a parser error", async function () {
          const $form = createIframeForm("ajax/iframe-parsererror.xml");

          const result = await submitThroughIframe($form, { dataType: "xml" });

          assert.strictEqual(result.error[1], "parsererror");
          assert.strictEqual(result.error[2].message, "parsererror");
        });

        it("should return a parsererror document when jQuery has no error helper", async function () {
          const error = $.error;
          const $form = createIframeForm("ajax/iframe-parsererror.xml");
          $.error = undefined;

          try {
            const result = await submitThroughIframe($form, { dataType: "xml" });

            assert.strictEqual(result.success[0].documentElement.nodeName, "parsererror");
          } finally {
            $.error = error;
          }
        });

        it("should return an XML document when jQuery has no parseXML helper", async function () {
          const parseXML = $.parseXML;
          const $form = createIframeForm("ajax/iframe-xml.html");
          $.parseXML = undefined;

          try {
            const result = await submitThroughIframe($form, { dataType: "xml" });

            assert.strictEqual(result.success[0].getElementsByTagName("transport").length, 1);
          } finally {
            $.parseXML = parseXML;
          }
        });
      });

      describe("legacy browser frames", function () {
        const realContentWindow = Object.getOwnPropertyDescriptor(
          HTMLIFrameElement.prototype,
          "contentWindow"
        ).get;
        const realContentDocument = Object.getOwnPropertyDescriptor(
          HTMLIFrameElement.prototype,
          "contentDocument"
        ).get;

        function createTarget(properties) {
          const $target = $('<iframe name="legacy-frame"></iframe>').appendTo("#main");
          Object.defineProperties($target[0], properties || {});
          return $target;
        }

        function denied() {
          throw new Error("Access is denied");
        }

        // IE fires onload for the initial blank document before the response arrives.
        function ieEvents(frame, delay) {
          const detached = [];
          return {
            detached: detached,
            properties: {
              attachEvent: {
                configurable: true,
                value: function (name, handler) {
                  if (delay === undefined) {
                    handler();
                  }
                  frame().addEventListener("load", () => setTimeout(handler, delay || 0));
                },
              },
              detachEvent: {
                configurable: true,
                value: (name) => detached.push(name),
              },
            },
          };
        }

        it("should read the document when IE8 denies contentWindow access", async function () {
          const $target = createTarget({
            contentWindow: { configurable: true, get: denied },
            contentDocument: {
              configurable: true,
              get: () => realContentDocument.call($target[0]),
            },
          });
          const $form = createIframeForm("ajax/iframe-text.html");

          const result = await submitThroughIframe($form, {
            iframeTarget: $target,
            dataType: "text",
          });

          assert.strictEqual(result.success[0].trim(), "iframe response");
        });

        [
          ["throws", { get: denied }, { timeout: 1000 }],
          ["is missing", { value: null }, {}],
        ].forEach(function ([label, contentDocument, options]) {
          it("should report a server abort when the frame document " + label, async function () {
            const $target = createTarget({
              contentWindow: { configurable: true, value: null },
              contentDocument: $.extend({ configurable: true }, contentDocument),
            });
            const $form = createIframeForm("ajax/iframe-text.html");

            const result = await submitThroughIframe(
              $form,
              $.extend({ iframeTarget: $target, dataType: "text" }, options)
            );

            assert.deepEqual(result.error.slice(1, 3), ["aborted", "server abort"]);
            assert.strictEqual(result.xhr.state(), "rejected");
          });
        });

        it("should report an error when IE8 denies access to the response body", async function () {
          const $target = createTarget({
            contentWindow: {
              configurable: true,
              get: function () {
                const frameDocument = realContentWindow.call(this).document;
                return {
                  document: new Proxy(frameDocument, {
                    get: (target, name) => (name === "body" ? denied() : target[name]),
                  }),
                };
              },
            },
          });
          const $form = createIframeForm("ajax/iframe-text.html");

          const result = await submitThroughIframe($form, {
            iframeTarget: $target,
            dataType: "text",
          });

          assert.strictEqual(result.error[1], "error");
          assert.strictEqual(result.error[2].message, "Access is denied");
          assert.deepEqual(result.events, ["error", "complete"]);
        });

        it("should keep polling while IE reports an uninitialized document", async function () {
          let polls = 0;
          let events;
          const $target = createTarget();
          events = ieEvents(() => $target[0], 100);
          Object.defineProperties(
            $target[0],
            $.extend(events.properties, {
              contentWindow: {
                configurable: true,
                get: function () {
                  polls++;
                  return polls <= 2
                    ? { document: { readyState: "uninitialized" } }
                    : realContentWindow.call(this);
                },
              },
            })
          );
          const $form = createIframeForm("ajax/iframe-text.html");

          const result = await submitThroughIframe($form, {
            iframeTarget: $target,
            dataType: "text",
          });

          assert.ok(polls > 4, "polled again after uninitialized");
          assert.strictEqual(result.success[0].trim(), "iframe response");
          assert.deepEqual(events.detached, ["onload"]);
        });

        it("should ignore the IE onload for the initial blank document", async function () {
          const $target = createTarget();
          const events = ieEvents(() => $target[0]);
          Object.defineProperties($target[0], events.properties);
          const $form = createIframeForm("ajax/iframe-text.html");

          const result = await submitThroughIframe($form, {
            iframeTarget: $target,
            dataType: "text",
          });

          assert.deepEqual(result.events, ["success", "complete"]);
          assert.strictEqual(result.success[0].trim(), "iframe response");
          assert.deepEqual(events.detached, ["onload"]);
        });

        it("should requeue Opera's empty DOM until its retries run out", async function () {
          const $target = createTarget();
          const $form = createIframeForm("ajax/iframe-empty.html");
          const successes = [];
          vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
          window.opera = {};

          try {
            $form.ajaxSubmit({
              iframe: true,
              iframeTarget: $target,
              forceSync: true,
              dataType: "text",
              success: (data) => successes.push(data),
            });
            await new Promise((resolve) => $target.one("load", resolve));
            const beforeRetries = successes.length;
            vi.advanceTimersByTime(250 * 50);

            assert.strictEqual(beforeRetries, 0);
            assert.deepEqual(successes, [""]);
          } finally {
            vi.useRealTimers();
            delete window.opera;
          }
        });
      });

      it("should reject the returned deferred when aborted", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");
        const resultPromise = submitThroughIframe($form, {});
        const xhr = $form.data("jqxhr");

        xhr.abort("manual");
        const result = await resultPromise;

        assert.strictEqual(result.error[1], "aborted");
        assert.strictEqual(result.complete[1], "aborted");
        assert.strictEqual(xhr.state(), "rejected");
      });

      it("should reject an aborted upload with the abort status", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");
        submitThroughIframe($form, {});
        const xhr = $form.data("jqxhr");
        const rejection = new Promise((resolve) => xhr.fail((...args) => resolve(args)));

        xhr.abort("manual");
        const [rejectedXhr, status, reason] = await rejection;

        assert.strictEqual(status, "aborted");
        assert.strictEqual(reason, "manual");
        assert.strictEqual(rejectedXhr.aborted, 1);
      });

      it("should end the global events and the active count when aborted", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");
        const active = $.active;
        const events = [];
        $(document).on("ajaxError.abort ajaxComplete.abort ajaxStop.abort", (event) =>
          events.push(event.type)
        );

        try {
          const resultPromise = submitThroughIframe($form, {});
          $form.data("jqxhr").abort();
          await resultPromise;

          assert.deepEqual(events, ["ajaxError", "ajaxComplete", "ajaxStop"]);
          assert.strictEqual($.active, active);
        } finally {
          $(document).off(".abort");
        }
      });

      it("should complete once when aborted twice", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");
        const resultPromise = submitThroughIframe($form, {});
        const xhr = $form.data("jqxhr");

        xhr.abort();
        xhr.abort();
        const result = await resultPromise;
        await new Promise((resolve) => setTimeout(resolve, 20));

        assert.deepEqual(result.events, ["error", "complete"]);
      });

      it("should ignore an abort after the upload completed", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");

        const result = await submitThroughIframe($form, { dataType: "text" });
        result.xhr.abort();

        assert.deepEqual(result.events, ["success", "complete"]);
        assert.strictEqual(result.xhr.state(), "resolved");
      });

      it("should ignore an abort from the success callback", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");
        const events = [];

        await new Promise((resolve) => {
          $form.ajaxSubmit({
            iframe: true,
            dataType: "text",
            success: function (data, status, xhr) {
              events.push("success");
              xhr.abort();
            },
            error: () => events.push("error"),
            complete: () => {
              events.push("complete");
              resolve();
            },
          });
        });

        assert.deepEqual(events, ["success", "complete"]);
      });

      describe("lifecycle", function () {
        const logged = "ajaxStart ajaxSend ajaxSuccess ajaxError ajaxComplete ajaxStop"
          .split(" ")
          .map((name) => name + ".ifrlog")
          .join(" ");
        let pending = [];

        afterEach(function () {
          $(document).off(".ifrlog");
          $("meta[name=csrf-token], meta[name=csrf-param]").remove();
          pending.forEach((deferred) => deferred.abort());
          pending = [];
        });

        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const majorVersion = Number($.fn.jquery.split(".")[0]);

        // Starts an upload whose native post only runs `inspect`, so nothing is sent. The upload
        // stays open until the test aborts it, or until afterEach does.
        function startStubbedUpload($form, options, inspect) {
          $form[0].submit = function () {
            if (inspect) {
              inspect(this);
            }
          };
          $form.ajaxSubmit(
            $.extend({ iframe: true, forceSync: true, error: function () {} }, options)
          );
          const deferred = $form.data("jqxhr");
          if (deferred) {
            pending.push(deferred);
          }

          return deferred;
        }

        function hiddenFields(form) {
          return $(form)
            .find('input[type="hidden"]')
            .map(function () {
              return [[this.name, this.value]];
            })
            .get();
        }

        function recordGlobalEvents(log) {
          $(document).on(logged, function (event) {
            log.push(event.type);
          });
        }

        function addCsrfMetas(token) {
          $('<meta name="csrf-token"><meta name="csrf-param" content="authenticity_token">')
            .first()
            .attr("content", token)
            .end()
            .appendTo(document.head);
        }

        // Uploads into a supplied frame whose response body gets `attributes` before the plugin
        // reads it, to emulate status attributes the fixtures do not have.
        function submitWithBodyAttributes(attributes, options) {
          const $target = $('<iframe name="status-frame"></iframe>').appendTo("#main");
          $target.on("load", function () {
            const body = this.contentDocument && this.contentDocument.body;
            if (body) {
              $(body).attr(attributes);
            }
          });
          const $form = createIframeForm("ajax/iframe-plain.html");

          return submitThroughIframe($form, $.extend({ iframeTarget: $target }, options));
        }

        describe("settings and controls", function () {
          it("should store a Deferred with abort, not a jqXHR, as the form's jqxhr", function () {
            const $form = createIframeForm("ajax/iframe-text.html");

            const returned = $form.ajaxSubmit({ iframe: true, beforeSend: () => false });
            const stored = $form.data("jqxhr");

            assert.strictEqual(returned, $form);
            assert.strictEqual(typeof stored.abort, "function");
            assert.strictEqual(typeof stored.resolve, "function");
            assert.strictEqual(typeof stored.reject, "function");
            assert.strictEqual(stored.readyState, undefined);
            assert.strictEqual(stored.status, undefined);
            assert.strictEqual(stored.getResponseHeader, undefined);
          });

          it("should return undefined from abort", function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            const deferred = startStubbedUpload($form, {});

            const returned = deferred.abort();

            assert.strictEqual(returned, undefined);
          });

          it("should post a control disabled in beforeSubmit", function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            let disabledDuringPost;

            startStubbedUpload(
              $form,
              {
                beforeSubmit: function (a, $submitted) {
                  $submitted.find("[name=upload]").prop("disabled", true);
                },
              },
              function (form) {
                disabledDuringPost = $(form).find("[name=upload]").prop("disabled");
              }
            );

            assert.strictEqual(disabledDuringPost, false);
          });

          it("should leave a control disabled in beforeSubmit enabled when beforeSend vetoes", function () {
            const $form = createIframeForm("ajax/iframe-text.html");

            $form.ajaxSubmit({
              iframe: true,
              beforeSubmit: function (a, $submitted) {
                $submitted.find("[name=upload]").prop("disabled", true);
              },
              beforeSend: () => false,
            });

            assert.strictEqual($form.find("[name=upload]").prop("disabled"), false);
          });

          it("should not re-enable a control that was disabled before serialization", function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            $form.find("[name=upload]").prop("disabled", true);

            $form.ajaxSubmit({ iframe: true, beforeSend: () => false });

            assert.strictEqual($form.find("[name=upload]").prop("disabled"), true);
          });

          it("should apply $.ajaxSetup defaults such as timeout and global", async function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            const events = [];
            recordGlobalEvents(events);
            $form[0].submit = function () {};

            const result = await withAjaxSettings({ timeout: 1, global: false }, () =>
              submitThroughIframe($form, { forceSync: true })
            );

            assert.strictEqual(result.error[1], "timeout");
            assert.deepEqual(events, []);
          });

          it("should call beforeSend and success with the settings as this when no context is given", async function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            const seen = {};

            await new Promise(function (resolve) {
              $form.ajaxSubmit({
                iframe: true,
                dataType: "text",
                beforeSend: function (xhr, settings) {
                  seen.beforeSend = this;
                  seen.settings = settings;
                },
                success: function () {
                  seen.success = this;
                },
                complete: resolve,
              });
            });

            assert.strictEqual(seen.beforeSend, seen.settings);
            assert.strictEqual(seen.success, seen.settings);
          });

          it("should call callbacks with the given context object on an iframe upload", async function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            const context = { name: "caller" };
            const seen = {};

            await new Promise(function (resolve) {
              $form.ajaxSubmit({
                iframe: true,
                dataType: "text",
                context: context,
                beforeSend: function () {
                  seen.beforeSend = this;
                },
                success: function () {
                  seen.success = this;
                },
                complete: resolve,
              });
            });

            assert.strictEqual(seen.beforeSend, context);
            assert.strictEqual(seen.success, context);
          });

          it("should not add the clicked button to the caller's data object", function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            $form[0].clk = $('<button type="submit" name="choice" value="picked">').appendTo(
              $form
            )[0];
            const data = { plain: "value" };

            startStubbedUpload($form, { data: data });

            assert.deepEqual(data, { plain: "value" });
          });

          it("should post data and ignore extraData when both are given", function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            let fields;

            startStubbedUpload($form, { data: { a: "1" }, extraData: { b: "2" } }, function (form) {
              fields = hiddenFields(form);
            });

            assert.deepEqual(fields, [["a", "1"]]);
          });
        });

        describe("response frame", function () {
          it("should append a hidden positioned frame to the end of body only when posting", function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            const framesBefore = $("iframe").length;
            let framesAtBeforeSend;
            let posted;

            startStubbedUpload(
              $form,
              {
                beforeSend: function () {
                  framesAtBeforeSend = $("iframe").length;
                },
              },
              function (form) {
                const frame = document.body.lastElementChild;
                posted = {
                  tag: frame.tagName,
                  name: frame.name,
                  target: form.getAttribute("target"),
                  src: frame.getAttribute("src"),
                  style: [frame.style.position, frame.style.top, frame.style.left],
                };
              }
            );

            assert.strictEqual(framesAtBeforeSend, framesBefore);
            assert.strictEqual(posted.tag, "IFRAME");
            assert.match(posted.name, /^jqFormIO\d+$/);
            assert.strictEqual(posted.target, posted.name);
            assert.strictEqual(posted.src, "about:blank");
            assert.deepEqual(posted.style, ["absolute", "-1000px", "-1000px"]);
          });

          it("should name the frames apart when two uploads start in the same millisecond", function () {
            const $first = createIframeForm("ajax/iframe-text.html");
            const $second = createIframeForm("ajax/iframe-text.html");
            const targets = [];
            const recordTarget = (form) => targets.push(form.getAttribute("target"));
            const getTime = Date.prototype.getTime;
            Date.prototype.getTime = () => 42;

            try {
              startStubbedUpload($first, {}, recordTarget);
              startStubbedUpload($second, {}, recordTarget);
            } finally {
              Date.prototype.getTime = getTime;
            }

            assert.notStrictEqual(targets[0], targets[1]);
          });

          // Chromium keeps the frame's browsing context name from insertion, so a real post into
          // a frame named this late would open a new window; the post is stubbed here.
          it("should keep the generated name on an unnamed iframeTarget after the upload", async function () {
            const $target = $("<iframe></iframe>").appendTo("#main");
            const $form = createIframeForm("ajax/iframe-text.html");
            const deferred = startStubbedUpload($form, { iframeTarget: $target });

            deferred.abort();
            await wait(150);

            assert.match($target.attr("name"), /^jqFormIO\d+$/);
          });

          it("should post into an unnamed iframeTarget frame when it is already in the page", async function () {
            const $target = $("<iframe></iframe>").appendTo("#main");
            const $form = createIframeForm("ajax/iframe-text.html");
            let submittedTarget;
            let frameName;
            const deferred = startStubbedUpload($form, { iframeTarget: $target }, function (form) {
              submittedTarget = form.getAttribute("target");
              frameName = $target[0].contentWindow.name;
            });

            deferred.abort();
            await wait(150);

            assert.match(submittedTarget, /^jqFormIO\d+$/);
            assert.strictEqual(frameName, submittedTarget);
          });

          it("should name an unnamed iframeTarget whose window the page cannot rename", function () {
            const $target = $('<iframe sandbox=""></iframe>').appendTo("#main");
            const $form = createIframeForm("ajax/iframe-text.html");

            $form.ajaxSubmit({ iframe: true, iframeTarget: $target, beforeSend: () => false });

            assert.match($target.attr("name"), /^jqFormIO\d+$/);
          });

          it("should name every frame when iframeTarget matches several", function () {
            const $targets = $("<iframe></iframe><iframe></iframe>").appendTo("#main");
            const $form = createIframeForm("ajax/iframe-text.html");

            $form.ajaxSubmit({ iframe: true, iframeTarget: $targets, beforeSend: () => false });

            assert.match($targets[0].name, /^jqFormIO\d+$/);
            assert.strictEqual($targets[1].name, $targets[0].name);
          });

          it("should settle the upload and end the global events when iframeTarget matches nothing", function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            const events = [];
            recordGlobalEvents(events);
            $.active = 0;

            try {
              $form.ajaxSubmit({
                iframe: true,
                forceSync: true,
                iframeTarget: "#missing-frame",
                error: function () {},
              });
            } catch {
              // the current behavior throws here
            }

            assert.strictEqual($.active, 0);
            assert.include(events, "ajaxStop");
          });

          describe("when the frame is not in the document", function () {
            const message = "jquery.form: the upload frame is not in the document";

            // Starts an upload whose native post is only counted, so a real post never opens a window.
            function uploadWithoutFrame($form, options) {
              const result = { submits: 0, events: [], rejected: null };
              recordGlobalEvents(result.events);
              $form[0].submit = function () {
                result.submits++;
              };
              const active = $.active;
              $form.ajaxSubmit(
                $.extend(
                  {
                    iframe: true,
                    forceSync: true,
                    extraData: { extra: "1" },
                    error: function () {
                      result.error = Array.from(arguments);
                    },
                  },
                  options
                )
              );
              const deferred = $form.data("jqxhr");
              deferred.fail(function () {
                result.rejected = Array.from(arguments);
              });
              result.activeDelta = $.active - active;

              return result;
            }

            function formOutsideBody() {
              const $form = $(
                '<form method="get" action="ajax/iframe-text.html"><input name="upload" value="yes"></form>'
              );
              document.documentElement.appendChild($form[0]);

              return $form;
            }

            it("should settle with an error, not post, when a connected form is outside body", function () {
              const $form = formOutsideBody();

              try {
                const result = uploadWithoutFrame($form, { type: "POST" });

                assert.strictEqual(result.submits, 0);
                assert.deepEqual(result.error.slice(1, 3), ["error", message]);
                assert.deepEqual(result.rejected.slice(1), ["error", message]);
                assert.deepEqual(result.events, [
                  "ajaxStart",
                  "ajaxSend",
                  "ajaxError",
                  "ajaxComplete",
                  "ajaxStop",
                ]);
                assert.strictEqual(result.activeDelta, 0);
              } finally {
                $form.remove();
              }
            });

            it("should restore the form when a connected form outside body settles", function () {
              const $form = formOutsideBody();

              try {
                uploadWithoutFrame($form, { type: "POST" });

                assert.deepEqual(
                  ["method", "target", "enctype", "encoding"].map((name) =>
                    $form[0].getAttribute(name)
                  ),
                  ["get", null, null, null]
                );
                assert.strictEqual($form.find("[name=extra]").length, 0);
              } finally {
                $form.remove();
              }
            });

            it("should settle with an error, not post, when the iframeTarget is detached", function () {
              const $form = createIframeForm("ajax/iframe-text.html");

              const result = uploadWithoutFrame($form, {
                iframeTarget: $("<iframe></iframe>"),
              });

              assert.strictEqual(result.submits, 0);
              assert.deepEqual(result.error.slice(1, 3), ["error", message]);
              assert.deepEqual(result.rejected.slice(1), ["error", message]);
              assert.include(result.events, "ajaxStop");
              assert.strictEqual(result.activeDelta, 0);
              assert.strictEqual($form.attr("target"), undefined);
              assert.strictEqual($form.find("[name=extra]").length, 0);
            });
          });
        });

        describe("mock xhr", function () {
          it("should keep the default mock fields when aborted before a response", function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            let xhr;
            const deferred = startStubbedUpload($form, {
              beforeSend: function (request) {
                xhr = request;
              },
            });

            deferred.abort();

            assert.strictEqual(xhr.status, 0);
            assert.strictEqual(xhr.statusText, "n/a");
            assert.strictEqual(xhr.responseText, null);
            assert.strictEqual(xhr.responseXML, null);
            assert.strictEqual(xhr.getResponseHeader("Content-Type"), undefined);
          });

          it("should pass the mock xhr, not the stored Deferred, to beforeSend", function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            let xhr;

            const stored = startStubbedUpload($form, {
              beforeSend: function (request) {
                xhr = request;
              },
            });

            assert.notStrictEqual(xhr, stored);
            assert.strictEqual(xhr.done, undefined);
            assert.strictEqual(xhr.readyState, undefined);
          });

          it("should report xml as the content type when the response is an XML document", async function () {
            const $form = createIframeForm("ajax/test.xml");

            const result = await submitThroughIframe($form, {});

            assert.strictEqual(result.success[2].getResponseHeader("Content-Type"), "xml");
          });

          it("should report no content type when no dataType is given for an HTML response", async function () {
            const $form = createIframeForm("ajax/iframe-text.html");

            const result = await submitThroughIframe($form, {});

            assert.strictEqual(result.success[2].getResponseHeader("Content-Type"), undefined);
          });

          it("should mark the mock xhr as aborted with a timeout error when the upload times out", async function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            $form[0].submit = function () {};

            const result = await submitThroughIframe($form, { forceSync: true, timeout: 1 });

            assert.strictEqual(result.error[0].error, "timeout");
            assert.strictEqual(result.error[0].aborted, 1);
          });

          it("should mark the mock xhr as aborted when the server aborts", async function () {
            const $form = $(
              '<form method="post" action="ajax/iframe-text.html"><input name="upload" value="yes"></form>'
            );

            const result = await submitThroughIframe($form, { forceSync: true });

            assert.strictEqual(result.error[0].error, "aborted");
            assert.strictEqual(result.error[0].aborted, 1);
          });
        });

        describe("start and beforeSend", function () {
          it("should fire ajaxStart before and ajaxSend after calling beforeSend with the settings", function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            const log = [];
            const seen = {};
            recordGlobalEvents(log);
            $(document).on("ajaxSend.ifrlog", function (event, xhr, settings) {
              seen.sent = [xhr, settings];
            });
            $.active = 0;

            startStubbedUpload($form, {
              beforeSend: function (xhr, settings) {
                log.push("beforeSend");
                seen.self = this;
                seen.args = [xhr, settings];
              },
            });

            assert.deepEqual(log, ["ajaxStart", "beforeSend", "ajaxSend"]);
            assert.strictEqual(seen.self, seen.args[1]);
            assert.strictEqual(seen.sent[0], seen.args[0]);
            assert.strictEqual(seen.sent[1], seen.args[1]);
          });

          it("should skip ajaxStart when another request is active", function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            const events = [];
            recordGlobalEvents(events);
            $.active = 1;

            $form.ajaxSubmit({ iframe: true, beforeSend: () => false });

            assert.deepEqual(events, ["ajaxError", "ajaxComplete"]);
            assert.strictEqual($.active, 1);
          });

          [
            ["the upload times out", true, { timeout: 1 }],
            ["the server aborts", false, {}],
          ].forEach(function ([label, attached, options]) {
            it("should fire no global events when global is false and " + label, async function () {
              const $form = $(
                '<form method="post" action="ajax/iframe-text.html"><input name="upload" value="yes"></form>'
              );
              if (attached) {
                $form.appendTo("#main");
              }
              $form[0].submit = function () {};
              const events = [];
              recordGlobalEvents(events);
              const active = $.active;

              const result = await submitThroughIframe(
                $form,
                $.extend({ forceSync: true, global: false }, options)
              );

              assert.deepEqual(result.events, ["error", "complete"]);
              assert.deepEqual(events, []);
              assert.strictEqual($.active, active);
            });
          });

          it("should fire global events on document and not on a DOM context", function () {
            const context = $("<div></div>").appendTo("#main")[0];
            const $form = createIframeForm("ajax/iframe-text.html");
            const onContext = [];
            const onDocument = [];
            $(context).on("ajaxComplete", () => onContext.push("ajaxComplete"));
            $(document).on("ajaxComplete.ifrlog", () => onDocument.push("ajaxComplete"));

            $form.ajaxSubmit({ iframe: true, context: context, beforeSend: () => false });

            // jQuery 1.7.2 triggers a global event on every element that handles it.
            assert.deepEqual(onContext, majorVersion < 3 ? ["ajaxComplete"] : []);
            assert.deepEqual(onDocument, ["ajaxComplete"]);
          });

          it("should post to a url that beforeSend changed on the settings", function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            let action;

            startStubbedUpload(
              $form,
              {
                beforeSend: function (xhr, settings) {
                  settings.url = "ajax/iframe-plain.html";
                },
              },
              function (form) {
                action = form.getAttribute("action");
              }
            );

            assert.strictEqual(action, "ajax/iframe-plain.html");
          });

          it("should reject with no arguments, post nothing and still notify when beforeSend vetoes", function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            let posts = 0;
            let notified = 0;
            let rejectedWith;
            $form.on("form-submit-notify", () => notified++);

            startStubbedUpload($form, { beforeSend: () => false }, () => posts++);
            $form.data("jqxhr").fail(function () {
              rejectedWith = arguments.length;
            });

            assert.strictEqual(rejectedWith, 0);
            assert.strictEqual(posts, 0);
            assert.strictEqual(notified, 1);
          });

          it("should leave the form and the page untouched when beforeSend vetoes", function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            const markup = $form[0].outerHTML;
            const frames = $("iframe").length;

            $form.ajaxSubmit({ iframe: true, forceSync: true, beforeSend: () => false });

            assert.strictEqual($form[0].outerHTML, markup);
            assert.strictEqual($("iframe").length, frames);
          });

          it("should end the global events without ajaxSend when beforeSend vetoes", function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            const events = [];
            recordGlobalEvents(events);
            $.active = 0;

            $form.ajaxSubmit({ iframe: true, beforeSend: () => false });

            assert.deepEqual(events, ["ajaxStart", "ajaxError", "ajaxComplete", "ajaxStop"]);
          });

          it("should call error before the global events and complete once when beforeSend aborts", function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            const log = [];
            let completions = 0;
            recordGlobalEvents(log);
            $.active = 0;

            $form.ajaxSubmit({
              iframe: true,
              forceSync: true,
              beforeSend: (xhr) => xhr.abort(),
              error: () => log.push("error"),
              complete: () => completions++,
            });

            assert.deepEqual(log, ["ajaxStart", "error", "ajaxError", "ajaxComplete", "ajaxStop"]);
            assert.strictEqual(completions, 1);
          });

          it("should restore $.active when beforeSend aborts and returns false", function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            $.active = 0;

            $form.ajaxSubmit({
              iframe: true,
              forceSync: true,
              error: function () {},
              beforeSend: function (xhr) {
                xhr.abort();
                return false;
              },
            });

            assert.strictEqual($.active, 0);
          });

          it("should call beforeSend but not post the form when an ajaxSend handler aborts", function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            let called = false;
            let posted = false;
            $form[0].submit = function () {
              posted = true;
            };
            $(document).on("ajaxSend.ifrlog", (event, xhr) => xhr.abort());

            $form.ajaxSubmit({
              iframe: true,
              forceSync: true,
              error: function () {},
              beforeSend: function () {
                called = true;
              },
            });

            assert.strictEqual(called, true);
            assert.strictEqual(posted, false);
          });
        });

        describe("submitter and CSRF", function () {
          it("should let the clicked button override a data field with the same name", function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            $form[0].clk = $('<button type="submit" name="choice" value="picked">').appendTo(
              $form
            )[0];
            let fields;

            startStubbedUpload($form, { data: { choice: "from data" } }, function (form) {
              fields = hiddenFields(form);
            });

            assert.deepEqual(fields, [["choice", "picked"]]);
          });

          it("should not post a disabled clicked button", function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            $form[0].clk = $(
              '<button type="submit" name="choice" value="picked" disabled>'
            ).appendTo($form)[0];
            let fields;

            startStubbedUpload($form, {}, function (form) {
              fields = hiddenFields(form);
            });

            assert.deepEqual(fields, []);
          });

          it("should let the CSRF token override a data field with the param name", function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            addCsrfMetas("secret");
            let fields;

            startStubbedUpload(
              $form,
              { data: { authenticity_token: "from data" } },
              function (form) {
                fields = hiddenFields(form);
              }
            );

            assert.deepEqual(fields, [["authenticity_token", "secret"]]);
          });

          [
            ["the csrf-param meta is missing", '<meta name="csrf-token" content="secret">'],
            [
              "the csrf-token meta is missing",
              '<meta name="csrf-param" content="authenticity_token">',
            ],
            [
              "the token is empty",
              '<meta name="csrf-token" content=""><meta name="csrf-param" content="authenticity_token">',
            ],
          ].forEach(function ([label, metas]) {
            it("should not post a CSRF field when " + label, function () {
              const $form = createIframeForm("ajax/iframe-text.html");
              $(metas).appendTo(document.head);
              let fields;

              startStubbedUpload($form, {}, function (form) {
                fields = hiddenFields(form);
              });

              assert.deepEqual(fields, []);
            });
          });

          it("should post the CSRF param twice when the form already has that field", function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            $('<input name="authenticity_token" value="mine">').appendTo($form);
            addCsrfMetas("secret");
            let values;

            startStubbedUpload($form, {}, function (form) {
              values = $(form)
                .find("[name=authenticity_token]")
                .map(function () {
                  return this.value;
                })
                .get();
            });

            assert.deepEqual(values, ["mine", "secret"]);
          });
        });

        describe("form post", function () {
          it("should post before storing the jqxhr and notifying when forceSync is set", function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            const log = [];
            $form.on("form-submit-notify", () => log.push("notify"));

            startStubbedUpload($form, {}, function (form) {
              log.push($(form).data("jqxhr") === undefined ? "post without jqxhr" : "post");
            });

            assert.deepEqual(log, ["post without jqxhr", "notify"]);
          });

          it("should post after ajaxSubmit returns when forceSync is not set", async function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            const log = [];
            $form.on("form-submit-notify", () => log.push("notify"));

            startStubbedUpload($form, { forceSync: false }, () => log.push("post"));
            log.push("returned");
            await wait(30);

            assert.deepEqual(log, ["notify", "returned", "post"]);
          });

          it("should set the target, method POST and multipart encoding while posting", function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            let posted;

            startStubbedUpload($form, {}, function (form) {
              posted = {
                frame: $("iframe").filter((i, frame) => frame.name === form.target).length,
                method: form.getAttribute("method"),
                enctype: form.getAttribute("enctype"),
                encoding: form.getAttribute("encoding"),
              };
            });

            assert.deepEqual(posted, {
              frame: 1,
              method: "POST",
              enctype: "multipart/form-data",
              encoding: "multipart/form-data",
            });
          });

          it("should post with GET and no encoding when the form has no method and no type", function () {
            const $form = $(
              '<form action="ajax/iframe-text.html"><input name="upload" value="yes"></form>'
            ).appendTo("#main");
            let posted;

            startStubbedUpload($form, {}, function (form) {
              posted = [form.method, form.getAttribute("enctype"), form.getAttribute("encoding")];
            });

            assert.deepEqual(posted, ["get", null, null]);
          });

          it("should set the action to the url with the serialized query when posting with GET", function () {
            const $form = createIframeForm("ajax/iframe-text.html").attr("method", "get");
            let action;

            startStubbedUpload($form, {}, function (form) {
              action = form.getAttribute("action");
            });

            assert.match(action, /ajax\/iframe-text\.html\?upload=yes$/);
          });

          it("should leave the encoding alone while posting when skipEncodingOverride is set", function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            let posted;

            startStubbedUpload($form, { skipEncodingOverride: true }, function (form) {
              posted = [form.getAttribute("enctype"), form.getAttribute("encoding")];
            });

            assert.deepEqual(posted, [null, null]);
          });

          it("should submit with GET when the type option is GET on a post form", function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            let method;

            startStubbedUpload($form, { type: "GET" }, function (form) {
              method = form.method;
            });

            assert.strictEqual(method, "get");
          });

          it("should start the timeout only when the delayed post runs", async function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            const log = [];
            $form[0].submit = () => log.push("post");

            await new Promise(function (resolve) {
              $form.ajaxSubmit({
                iframe: true,
                timeout: 1,
                error: (xhr, status) => log.push(status),
                complete: resolve,
              });
            });

            assert.deepEqual(log, ["post", "timeout"]);
          });

          it("should append the data, the clicked button and the CSRF field at the end of the form", function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            const button = $('<button type="submit" name="choice" value="picked">').appendTo(
              $form
            )[0];
            $form[0].clk = button;
            addCsrfMetas("secret");
            let posted;

            startStubbedUpload($form, { data: { b: "2", a: "1" } }, function (form) {
              posted = {
                fields: hiddenFields(form),
                afterButton: button.nextElementSibling.name,
                last: form.lastElementChild.name,
              };
            });

            assert.deepEqual(posted, {
              fields: [
                ["b", "2"],
                ["a", "1"],
                ["choice", "picked"],
                ["authenticity_token", "secret"],
              ],
              afterButton: "b",
              last: "authenticity_token",
            });
          });

          it("should post repeated names without brackets when traditional is set", function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            let fields;

            startStubbedUpload(
              $form,
              { data: { tags: ["a", "b"] }, traditional: true },
              function (form) {
                fields = hiddenFields(form);
              }
            );

            assert.deepEqual(fields, [
              ["tags", "a"],
              ["tags", "b"],
            ]);
          });

          it("should post data values as $.param serializes them", function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            let fields;

            startStubbedUpload(
              $form,
              {
                data: {
                  empty: null,
                  computed: () => "called",
                  none: [],
                  pair: { name: "named", value: null },
                },
              },
              function (form) {
                fields = hiddenFields(form);
              }
            );

            // jQuery 1.7.2's $.param writes null as "null".
            assert.deepEqual(fields, [
              ["empty", majorVersion < 3 ? "null" : ""],
              ["computed", "called"],
              ["named", ""],
            ]);
          });

          it("should post a $.param array as one field per entry", function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            let fields;

            startStubbedUpload(
              $form,
              {
                data: [
                  { name: "a", value: "1" },
                  { name: "a", value: "2" },
                ],
              },
              function (form) {
                fields = hiddenFields(form);
              }
            );

            assert.deepEqual(fields, [
              ["a", "1"],
              ["a", "2"],
            ]);
          });

          it("should send a query-string data option as its own fields on an iframe upload", function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            let fields;

            startStubbedUpload($form, { data: "x=1" }, function (form) {
              fields = hiddenFields(form);
            });

            assert.deepEqual(fields, [["x", "1"]]);
          });

          it("should not throw when data is a string and a submitter is clicked", function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            $form[0].clk = $('<button type="submit" name="choice" value="picked">').appendTo(
              $form
            )[0];

            const start = () => startStubbedUpload($form, { data: "x=1" });

            assert.doesNotThrow(start);
          });

          it("should send a query-string data option and the submitter as fields on an iframe upload", function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            $form[0].clk = $('<button type="submit" name="choice" value="picked">').appendTo(
              $form
            )[0];
            let fields;

            startStubbedUpload($form, { data: "x=1&y=a+b" }, function (form) {
              fields = hiddenFields(form);
            });

            assert.deepEqual(fields, [
              ["x", "1"],
              ["y", "a b"],
              ["choice", "picked"],
            ]);
          });

          it("should not trigger the form's submit event when posting", async function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            let submitEvents = 0;
            $form[0].addEventListener("submit", () => submitEvents++);

            const result = await submitThroughIframe($form, { dataType: "text" });

            assert.deepEqual(result.events, ["success", "complete"]);
            assert.strictEqual(submitEvents, 0);
          });

          it("should post the form's own controls, not entries added in beforeSubmit", function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            let added;

            startStubbedUpload(
              $form,
              {
                beforeSubmit: function (a) {
                  a.push({ name: "added", value: "1" });
                },
              },
              function (form) {
                added = $(form).find("[name=added]").length;
              }
            );

            assert.strictEqual(added, 0);
          });

          it("should report a server abort when the form is not in the document", async function () {
            const $form = $(
              '<form method="post" action="ajax/iframe-text.html"><input name="upload" value="yes"></form>'
            );

            const result = await submitThroughIframe($form, { forceSync: true });

            assert.deepEqual(result.error.slice(1, 3), ["aborted", "server abort"]);
          });

          it("should settle the upload when the subject is not a form", function () {
            const $div = $('<div><input name="upload" value="yes"></div>').appendTo("#main");
            const events = [];
            recordGlobalEvents(events);
            $.active = 0;

            try {
              $div.ajaxSubmit({
                iframe: true,
                forceSync: true,
                url: "ajax/iframe-text.html",
                type: "POST",
                error: function () {},
              });
            } catch {
              // the current behavior throws here
            }

            assert.strictEqual($.active, 0);
            assert.include(events, "ajaxStop");
          });

          it("should report the exception to error and the rejection when posting throws", function () {
            const $div = $('<div><input name="upload" value="yes"></div>').appendTo("#main");
            let errorArgs;
            let rejection;

            $div.ajaxSubmit({
              iframe: true,
              forceSync: true,
              url: "ajax/iframe-text.html",
              type: "POST",
              error: (...args) => (errorArgs = args),
            });
            $div.data("jqxhr").fail((...args) => (rejection = args));

            assert.strictEqual(errorArgs[1], "error");
            assert.instanceOf(errorArgs[2], Error);
            assert.deepEqual(rejection.slice(1), ["error", errorArgs[2]]);
          });

          it("should not leave upload attributes on a non-form element", function () {
            const $div = $('<div><input name="upload" value="yes"></div>').appendTo("#main");

            try {
              $div.ajaxSubmit({
                iframe: true,
                forceSync: true,
                url: "ajax/iframe-text.html",
                type: "POST",
                error: function () {},
              });
            } catch {
              // the current behavior throws here
            }

            assert.deepEqual(
              ["method", "enctype", "encoding"].map((name) => $div[0].getAttribute(name)),
              [null, null, null]
            );
          });

          it("should not post the form when the upload is aborted before the delayed post", async function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            let posts = 0;
            const deferred = startStubbedUpload($form, { forceSync: false }, () => posts++);

            deferred.abort();
            await wait(50);

            assert.strictEqual(posts, 0);
          });
        });

        describe("response reading", function () {
          it("should take the load of a relative iframeSrc as the response", async function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            $form[0].submit = function () {};

            const result = await submitThroughIframe($form, {
              iframeSrc: "ajax/iframe-plain.html",
              dataType: "text",
            });

            assert.strictEqual(result.success[0].trim(), "plain response");
          });

          it("should keep the load listener when the upload times out", async function () {
            const $target = $('<iframe name="kept-frame"></iframe>').appendTo("#main");
            const removed = [];
            $target[0].removeEventListener = function (type) {
              removed.push(type);
              return HTMLIFrameElement.prototype.removeEventListener.apply(this, arguments);
            };
            const $form = createIframeForm("ajax/iframe-text.html");
            $form[0].submit = function () {};

            const result = await submitThroughIframe($form, {
              iframeTarget: $target,
              forceSync: true,
              timeout: 1,
            });
            await wait(30);

            assert.strictEqual(result.error[1], "timeout");
            assert.deepEqual(removed, []);
          });

          it("should return an XML document when no dataType is given and the response is XML", async function () {
            const $form = createIframeForm("ajax/test.xml");

            const result = await submitThroughIframe($form, {});

            assert.strictEqual(result.success[0].documentElement.nodeName, "root");
          });

          it("should return an XML document when dataType is json and the response is XML", async function () {
            const $form = createIframeForm("ajax/test.xml");

            const result = await submitThroughIframe($form, { dataType: "json" });

            assert.strictEqual(result.success[0].documentElement.nodeName, "root");
          });

          it("should expose the root element's markup as responseText for an XML response", async function () {
            const $form = createIframeForm("ajax/test.xml");

            const result = await submitThroughIframe($form, { dataType: "xml" });

            assert.strictEqual(
              result.success[2].responseText,
              result.success[0].documentElement.innerHTML
            );
            assert.include(result.success[2].responseText, "test");
          });

          it("should expose the HTML document as responseXML for an HTML response", async function () {
            const $form = createIframeForm("ajax/iframe-text.html");

            const result = await submitThroughIframe($form, { dataType: "text" });

            assert.strictEqual(result.success[2].responseXML.nodeType, 9);
            assert.strictEqual(
              result.success[2].responseXML.body.textContent.trim(),
              "iframe response"
            );
          });

          it("should parse JSON when dataType is JSON in capitals", async function () {
            const $form = createIframeForm("ajax/iframe-json.html");

            const result = await submitThroughIframe($form, { dataType: "JSON" });

            assert.deepEqual(result.success[0], { transport: "iframe" });
          });

          it("should read the response as XML when dataType is XML in capitals", async function () {
            const $form = createIframeForm("ajax/iframe-text.html");

            const result = await submitThroughIframe($form, { dataType: "XML" });

            assert.strictEqual(result.success[0].nodeType, 9);
          });

          it("should report parsererror when an XML response has no root element", async function () {
            const $form = createIframeForm("ajax/iframe-rootless.html");

            const result = await submitThroughIframe($form, { dataType: "xml" });

            assert.strictEqual(result.error[1], "parsererror");
          });

          it("should call dataFilter with the settings as this and the XML document", async function () {
            const $form = createIframeForm("ajax/test.xml");
            const seen = {};

            await submitThroughIframe($form, {
              dataType: "xml",
              beforeSend: function (xhr, settings) {
                seen.settings = settings;
              },
              dataFilter: function (data, type) {
                seen.self = this;
                seen.root = data.documentElement.nodeName;
                seen.type = type;
                return data;
              },
            });

            assert.strictEqual(seen.self, seen.settings);
            assert.strictEqual(seen.root, "root");
            assert.strictEqual(seen.type, "xml");
          });

          it("should return jsonp responses as unparsed text", async function () {
            const $form = createIframeForm("ajax/iframe-json.html");

            const result = await submitThroughIframe($form, { dataType: "jsonp" });

            assert.strictEqual(result.success[0], '{"transport":"iframe"}');
          });

          it("should skip JSON parsing when dataFilter returns a non-string", async function () {
            const $form = createIframeForm("ajax/iframe-json.html");

            const result = await submitThroughIframe($form, {
              dataType: "json",
              dataFilter: () => ({ filtered: true }),
            });

            assert.deepEqual(result.success[0], { filtered: true });
          });

          it("should report a script that does not parse by jQuery version", async function () {
            const $form = createIframeForm("ajax/iframe-plain.html");

            const outcome = await withWindowErrors(async function (errors) {
              const result = await submitThroughIframe($form, {
                dataType: "script",
                dataFilter: () => "}",
              });
              return { status: (result.success || result.error)[1], errors: errors.length };
            });

            // jQuery 1.7.2 evaluates with eval; later versions insert a script element, whose
            // error goes to the window instead.
            assert.deepEqual(
              outcome,
              majorVersion < 3
                ? { status: "parsererror", errors: 0 }
                : { status: "success", errors: 1 }
            );
          });

          it("should report success with status 0 when the response has no status attribute", async function () {
            const $form = createIframeForm("ajax/iframe-plain.html");

            const result = await submitThroughIframe($form, { dataType: "text" });

            assert.strictEqual(result.success[1], "success");
            assert.strictEqual(result.success[2].status, 0);
          });
        });

        describe("settling", function () {
          it("should treat an emulated 304 as success", async function () {
            const result = await submitWithBodyAttributes({ status: "304" }, { dataType: "text" });

            assert.strictEqual(result.success[1], "success");
            assert.strictEqual(result.success[2].status, 304);
          });

          it("should treat an emulated 1xx status as an error", async function () {
            const result = await submitWithBodyAttributes({ status: "102" }, { dataType: "text" });

            assert.strictEqual(result.error[1], "error");
          });

          it('should report "n/a" when an error status has no statusText', async function () {
            const result = await submitWithBodyAttributes({ status: "500" }, { dataType: "text" });

            assert.deepEqual(result.error.slice(1, 3), ["error", "n/a"]);
          });

          it("should call success and resolve the Deferred before ajaxSuccess", async function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            const log = [];
            recordGlobalEvents(log);

            await new Promise(function (resolve) {
              $form.ajaxSubmit({
                iframe: true,
                dataType: "text",
                success: () => log.push("success"),
                complete: resolve,
              });
              $form.data("jqxhr").done(() => log.push("done"));
            });

            assert.deepEqual(
              log.filter((name) => ["success", "done", "ajaxSuccess"].includes(name)),
              ["success", "done", "ajaxSuccess"]
            );
          });

          it("should call complete before ajaxComplete and ajaxStop", async function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            const log = [];
            recordGlobalEvents(log);
            $.active = 0;

            await new Promise(function (resolve) {
              $form.ajaxSubmit({
                iframe: true,
                dataType: "text",
                complete: function () {
                  log.push("complete");
                  setTimeout(resolve, 0);
                },
              });
            });

            assert.deepEqual(
              log.filter((name) => ["complete", "ajaxComplete", "ajaxStop"].includes(name)),
              ["complete", "ajaxComplete", "ajaxStop"]
            );
          });

          it("should resolve the Deferred with the response text, not the parsed data", async function () {
            const $form = createIframeForm("ajax/iframe-json.html");
            let resolvedWith;

            const resultPromise = submitThroughIframe($form, { dataType: "json" });
            $form.data("jqxhr").done((data) => (resolvedWith = data));
            const result = await resultPromise;

            assert.deepEqual(result.success[0], { transport: "iframe" });
            assert.strictEqual(resolvedWith, '{"transport":"iframe"}');
          });

          it("should pass the data to ajaxSuccess handlers", async function () {
            const $form = createIframeForm("ajax/iframe-json.html");
            let data;
            $(document).on("ajaxSuccess.ifrlog", function (event, xhr, settings, received) {
              data = received;
            });

            await submitThroughIframe($form, { dataType: "json" });

            assert.deepEqual(data, { transport: "iframe" });
          });

          it("should call error before ajaxError, ajaxComplete and ajaxStop for an error status", async function () {
            const $form = createIframeForm("ajax/iframe-error.html");
            const log = [];
            let ajaxErrorReason;
            recordGlobalEvents(log);
            $(document).on("ajaxError.ifrlog", function (event, xhr, settings, reason) {
              ajaxErrorReason = reason;
            });
            $.active = 0;

            await new Promise(function (resolve) {
              $form.ajaxSubmit({
                iframe: true,
                dataType: "text",
                error: () => log.push("error"),
                complete: resolve,
              });
            });

            assert.deepEqual(
              log.filter((name) => name !== "ajaxStart" && name !== "ajaxSend"),
              ["error", "ajaxError", "ajaxComplete", "ajaxStop"]
            );
            assert.strictEqual(ajaxErrorReason, "fixture failure");
          });

          it.fails(
            "should reject with parsererror when the response cannot be parsed",
            async function () {
              const $form = createIframeForm("ajax/iframe-text.html");

              const result = await submitThroughIframe($form, { dataType: "json" });
              const rejection = await new Promise((resolve) =>
                result.xhr.fail((...args) => resolve(args))
              );

              assert.strictEqual(rejection[1], "parsererror");
            }
          );

          it.fails(
            "should report the statusText when an error-status response also fails to parse",
            async function () {
              const $form = createIframeForm("ajax/iframe-error.html");

              const result = await submitThroughIframe($form, { dataType: "json" });

              assert.strictEqual(result.error[2], "fixture failure");
            }
          );

          it("should settle the upload and end the global events when success throws", async function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            const events = [];
            recordGlobalEvents(events);
            $.active = 0;

            const outcome = await withWindowErrors(async function (errors) {
              await new Promise(function (resolve) {
                $form.ajaxSubmit({
                  iframe: true,
                  dataType: "text",
                  success: function () {
                    setTimeout(resolve, 20);
                    throw new Error("success failed");
                  },
                });
              });
              return { errors: errors.length, state: $form.data("jqxhr").state() };
            });

            assert.deepEqual(outcome, { errors: 1, state: "resolved" });
            assert.strictEqual($.active, 0);
            assert.include(events, "ajaxStop");
          });

          it("should reject with the xhr and timeout and report timeout to ajaxError", async function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            $form[0].submit = function () {};
            let ajaxErrorReason;
            $(document).on("ajaxError.ifrlog", function (event, xhr, settings, reason) {
              ajaxErrorReason = reason;
            });

            const result = await submitThroughIframe($form, { forceSync: true, timeout: 1 });
            const rejection = await new Promise((resolve) =>
              result.xhr.fail((...args) => resolve(args))
            );

            assert.deepEqual(result.error.slice(1, 3), ["timeout", "timeout"]);
            assert.deepEqual(rejection.slice(1), ["timeout"]);
            assert.strictEqual(ajaxErrorReason, "timeout");
          });

          it("should reject with error and server abort and report aborted to ajaxError when the server aborts", async function () {
            const $form = $(
              '<form method="post" action="ajax/iframe-text.html"><input name="upload" value="yes"></form>'
            );
            let ajaxErrorReason;
            $(document).on("ajaxError.ifrlog", function (event, xhr, settings, reason) {
              ajaxErrorReason = reason;
            });

            const result = await submitThroughIframe($form, { forceSync: true });
            const rejection = await new Promise((resolve) =>
              result.xhr.fail((...args) => resolve(args))
            );

            assert.deepEqual(rejection.slice(1), ["error", "server abort"]);
            assert.strictEqual(ajaxErrorReason, "aborted");
          });

          it("should call error before ajaxError, ajaxComplete and ajaxStop when aborted", function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            const log = [];
            const deferred = startStubbedUpload($form, { error: () => log.push("error") });
            recordGlobalEvents(log);

            deferred.abort();

            assert.deepEqual(log, ["error", "ajaxError", "ajaxComplete", "ajaxStop"]);
          });

          it("should report timeout to error and complete but aborted to the rejection when aborted with timeout", function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            const seen = {};
            const deferred = startStubbedUpload($form, {
              error: (xhr, status, reason) => (seen.error = [status, reason, xhr.error]),
              complete: (xhr, status) => (seen.complete = status),
            });
            deferred.fail((xhr, status, reason) => (seen.rejection = [status, reason]));

            deferred.abort("timeout");

            assert.deepEqual(seen, {
              error: ["timeout", "timeout", "timeout"],
              rejection: ["aborted", "timeout"],
              complete: "timeout",
            });
          });

          it("should pass an undefined reason when aborted without a status", function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            const seen = {};
            const deferred = startStubbedUpload($form, {
              error: (xhr, status, reason) => (seen.error = [status, reason]),
            });
            deferred.fail((xhr, status, reason) => (seen.rejection = [status, reason]));

            deferred.abort();

            assert.deepEqual(seen, {
              error: ["aborted", undefined],
              rejection: ["aborted", undefined],
            });
          });

          it("should ignore an abort from the error and complete callbacks", function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            const calls = [];
            const deferred = startStubbedUpload($form, {
              error: function (xhr) {
                calls.push("error");
                xhr.abort();
              },
              complete: function (xhr) {
                calls.push("complete");
                xhr.abort();
              },
            });

            deferred.abort();

            assert.deepEqual(calls, ["error", "complete"]);
          });
        });

        describe("cleanup", function () {
          [
            ["after the post", false],
            ["from beforeSend", true],
          ].forEach(function ([label, inBeforeSend]) {
            it(
              "should reset a supplied frame to iframeSrc at once when aborted " + label,
              function () {
                const $target = $(
                  '<iframe name="reset-frame" src="ajax/iframe-plain.html"></iframe>'
                ).appendTo("#main");
                const $form = createIframeForm("ajax/iframe-text.html");

                const deferred = startStubbedUpload($form, {
                  iframeTarget: $target,
                  beforeSend: (xhr) => (inBeforeSend ? xhr.abort() : undefined),
                });
                deferred.abort();

                assert.strictEqual($target.attr("src"), "about:blank");
              }
            );
          });

          it("should clear responseXML but keep responseText after the cleanup delay", async function () {
            const $form = createIframeForm("ajax/iframe-text.html");

            const result = await submitThroughIframe($form, { dataType: "text" });
            const xhr = result.success[2];
            await wait(150);

            assert.strictEqual(xhr.responseXML, null);
            assert.strictEqual(xhr.responseText.trim(), "iframe response");
          });

          it("should restore the target, remove the inputs and the frame when the upload times out", async function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            let frameName;
            $form[0].submit = function () {
              frameName = this.target;
            };

            await submitThroughIframe($form, { forceSync: true, timeout: 1, data: { a: "1" } });
            await wait(150);

            assert.strictEqual($form[0].hasAttribute("target"), false);
            assert.strictEqual($form.find('input[type="hidden"]').length, 0);
            assert.strictEqual(
              $("iframe").filter((i, frame) => frame.name === frameName).length,
              0
            );
          });

          // #380: the attributes the upload changes should be put back exactly as they were.
          function uploadWithoutAttributes(options) {
            const $form = $(
              '<form action="ajax/iframe-text.html"><input name="upload" value="yes"></form>'
            ).appendTo("#main");

            startStubbedUpload($form, $.extend({ type: "POST" }, options));

            return $form[0];
          }

          it("should restore a missing method attribute after an iframe upload", function () {
            const form = uploadWithoutAttributes({});

            assert.strictEqual(form.getAttribute("method"), null);
          });

          it("should restore a relative action attribute after an iframe upload", function () {
            const form = uploadWithoutAttributes({});

            assert.strictEqual(form.getAttribute("action"), "ajax/iframe-text.html");
          });

          it("should restore a missing enctype attribute after an iframe upload", function () {
            const form = uploadWithoutAttributes({});

            assert.strictEqual(form.getAttribute("enctype"), null);
          });

          it("should restore a missing encoding attribute after an iframe upload", function () {
            const form = uploadWithoutAttributes({});

            assert.strictEqual(form.getAttribute("encoding"), null);
          });

          it("should restore the exact attributes a form had after an iframe upload", function () {
            const attributes = {
              action: "ajax/iframe-text.html",
              target: "_self",
              method: "post",
              enctype: "text/plain",
              encoding: "text/plain",
            };
            const $form = $('<form><input name="upload" value="yes"></form>')
              .attr(attributes)
              .appendTo("#main");

            startStubbedUpload($form, { type: "POST" });

            assert.deepEqual(
              Object.keys(attributes).map((name) => $form[0].getAttribute(name)),
              Object.values(attributes)
            );
          });

          it("should not add an enctype attribute when skipEncodingOverride is set", function () {
            const form = uploadWithoutAttributes({ skipEncodingOverride: true });

            assert.strictEqual(form.getAttribute("enctype"), null);
          });
        });

        describe("closeKeepAlive", function () {
          // A delayed upload cannot be aborted, so let its server-abort check run before
          // afterEach removes its frame.
          afterEach(function () {
            return wait(30);
          });

          // Replaces $.get so the keep-alive request finishes only when the test releases it.
          function holdKeepAlive(run) {
            const get = $.get;
            let release;
            $.get = function (url, callback) {
              release = callback;
            };

            try {
              return run(() => release());
            } finally {
              $.get = get;
            }
          }

          function keepAliveWarnings(debug) {
            const $form = createIframeForm("ajax/iframe-text.html");

            const warnings = recordDeprecations(debug, function () {
              holdKeepAlive(function () {
                startStubbedUpload($form, { closeKeepAlive: "ajax/text.html" });
                startStubbedUpload($form, { closeKeepAlive: "ajax/text.html" });
              });
            });

            return warnings.filter((text) => text.includes("closeKeepAlive"));
          }

          it("should warn once that closeKeepAlive is deprecated under debug", function () {
            const warnings = keepAliveWarnings(true);

            assert.strictEqual(warnings.length, 1);
            assert.include(warnings[0], "Safari");
            assert.include(warnings[0], "removed in 5.0");
          });

          it("should stay silent about closeKeepAlive with debug off", function () {
            const warnings = keepAliveWarnings(false);

            assert.deepEqual(warnings, []);
          });

          it("should leave the stored jqxhr undefined after the delayed upload starts", function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            let started = false;

            holdKeepAlive(function (release) {
              startStubbedUpload(
                $form,
                { closeKeepAlive: "ajax/text.html" },
                () => (started = true)
              );
              release();
            });

            assert.strictEqual(started, true);
            assert.strictEqual($form.data("jqxhr"), undefined);
          });

          it("should notify before the delayed upload starts", function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            const log = [];
            recordGlobalEvents(log);
            $form.on("form-submit-notify", () => log.push("notify"));
            $.active = 0;

            holdKeepAlive(function (release) {
              startStubbedUpload($form, {
                closeKeepAlive: "ajax/text.html",
                beforeSend: () => log.push("beforeSend"),
              });
              log.push("released");
              release();
            });

            assert.deepEqual(log, ["notify", "released", "ajaxStart", "beforeSend", "ajaxSend"]);
          });

          it("should wrap the upload's start in the keep-alive request's global events", async function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            const log = [];
            recordGlobalEvents(log);
            $form.on("form-submit-notify", () => log.push("notify"));
            $.active = 0;

            await new Promise(function (resolve) {
              $form.ajaxSubmit({
                iframe: true,
                dataType: "text",
                closeKeepAlive: "ajax/text.html",
                beforeSend: () => log.push("beforeSend"),
                complete: function () {
                  log.push("complete");
                  resolve();
                },
              });
            });

            assert.deepEqual(log, [
              "ajaxStart",
              "ajaxSend",
              "notify",
              "beforeSend",
              "ajaxSend",
              "ajaxSuccess",
              "ajaxComplete",
              "ajaxSuccess",
              "complete",
              "ajaxComplete",
              "ajaxStop",
            ]);
          });

          it("should never call back when the keep-alive request fails", async function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            const calls = [];

            await new Promise(function (resolve) {
              $(document).on("ajaxComplete.ifrlog", () => setTimeout(resolve, 30));
              $form.ajaxSubmit({
                iframe: true,
                closeKeepAlive: "ajax/missing-keep-alive.html",
                success: () => calls.push("success"),
                error: () => calls.push("error"),
                complete: () => calls.push("complete"),
              });
            });

            assert.deepEqual(calls, []);
            assert.strictEqual($form.data("jqxhr"), undefined);
          });

          it("should post a control disabled in beforeSubmit when closeKeepAlive delays the upload", function () {
            const $form = createIframeForm("ajax/iframe-text.html");
            let disabledDuringPost;

            holdKeepAlive(function (release) {
              startStubbedUpload(
                $form,
                {
                  closeKeepAlive: "ajax/text.html",
                  beforeSubmit: function (a, $submitted) {
                    $submitted.find("[name=upload]").prop("disabled", true);
                  },
                },
                function (form) {
                  disabledDuringPost = $(form).find("[name=upload]").prop("disabled");
                }
              );
              release();
            });

            assert.strictEqual(disabledDuringPost, false);
          });

          it("should ignore closeKeepAlive on the FormData transport", function () {
            const $form = $(
              '<form method="post" action="ajax/text.html"><input type="file" name="up"></form>'
            ).appendTo("#main");
            selectFiles($form.find("input")[0], ["a.txt"]);
            let gets = 0;
            const get = $.get;
            $.get = () => gets++;

            let result;
            try {
              result = submitTransport($form, { closeKeepAlive: "ajax/text.html" });
            } finally {
              $.get = get;
            }

            assert.strictEqual(result.transport, "formdata");
            assert.strictEqual(gets, 0);
          });
        });
      });
    });
  });
});
