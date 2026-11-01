import { assert, describe, it, vi } from "vitest";
import { resetFixture } from "./helpers.js";

describe("form", function () {
  resetFixture();

  describe("ajaxSubmit", function () {
    describe("iframe upload transport", function () {
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
    });
  });
});
