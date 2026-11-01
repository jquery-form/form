/* global scriptCount */

import { assert, describe, it } from "vitest";
import {
  resetFixture,
  submitAndSettle,
  captureAjaxOptions,
  withUserAgent,
  withDocumentUrl,
  withAjaxStub,
} from "./helpers.js";

describe("form", function () {
  resetFixture();

  describe("ajaxSubmit", function () {
    describe("non-upload options", function () {
      it("should return an empty selection without starting a request", async function () {
        let requests = 0;
        const $empty = $(".missing-form");

        await withAjaxStub(
          function () {
            requests++;
          },
          async function () {
            const result = $empty.ajaxSubmit();
            await Promise.resolve();

            assert.strictEqual(result, $empty, "returns the original selection");
            assert.strictEqual(requests, 0, "does not request");
          }
        );
      });

      it("should accept the url, data, dataType and success shorthand arguments", async function () {
        const extraData = { source: "shorthand" };
        let ajaxOptions;
        let successData;

        await withAjaxStub(
          function (options) {
            ajaxOptions = options;
            options.success("ok", "success", {});
            return {};
          },
          async function () {
            $("#form3").ajaxSubmit("ajax/shorthand.html", extraData, "text", function (data) {
              successData = data;
            });
            await Promise.resolve();

            assert.strictEqual(ajaxOptions.url, "ajax/shorthand.html", "url");
            assert.strictEqual(ajaxOptions.dataType, "text", "dataType");
            assert.ok(ajaxOptions.data.includes("source=shorthand"), "extra data");
            assert.strictEqual(successData, "ok", "success callback");
          }
        );
      });

      [
        [false, false],
        [undefined, "ajax/text.html"],
      ].forEach(function ([value, expectedUrl]) {
        it("should normalize the url when options are " + String(value), async function () {
          let ajaxOptions;

          await withAjaxStub(
            function (options) {
              ajaxOptions = options;
              return {};
            },
            async function () {
              $("#form3").ajaxSubmit(value);
              await Promise.resolve();

              if (expectedUrl === false) {
                assert.strictEqual(ajaxOptions.url, false, "explicit false url");
              } else {
                assert.ok(ajaxOptions.url.endsWith(expectedUrl), "form action");
              }
            }
          );
        });
      });

      it("should allow form-pre-serialize to veto before serialization", async function () {
        let requests = 0;
        let serialized = false;
        const $form = $("#form3");
        const formToArray = $form.formToArray;
        $form.one("form-pre-serialize", function (_event, _form, _options, veto) {
          veto.veto = true;
        });
        $form.formToArray = function () {
          serialized = true;
          return formToArray.apply(this, arguments);
        };

        try {
          await withAjaxStub(
            function () {
              requests++;
            },
            async function () {
              $form.ajaxSubmit();
              await Promise.resolve();

              assert.strictEqual(serialized, false, "does not serialize");
              assert.strictEqual(requests, 0, "does not request");
            }
          );
        } finally {
          $form.formToArray = formToArray;
          $form.off("form-pre-serialize");
        }
      });

      it("should allow beforeSerialize to veto the request", async function () {
        let requests = 0;
        let callbackForm;
        const opts = {
          beforeSerialize: function ($form) {
            callbackForm = $form;
            return false;
          },
        };

        await withAjaxStub(
          function () {
            requests++;
          },
          async function () {
            const $form = $("#form3");
            $form.ajaxSubmit(opts);
            await Promise.resolve();

            assert.strictEqual(callbackForm, $form, "callback form");
            assert.strictEqual(requests, 0, "does not request");
          }
        );
      });

      it("should allow form-submit-validate to veto the request", async function () {
        let requests = 0;
        let submittedData;
        const $form = $("#form3");
        $form.one("form-submit-validate", function (_event, data, _form, _options, veto) {
          submittedData = data;
          veto.veto = true;
        });

        try {
          await withAjaxStub(
            function () {
              requests++;
            },
            async function () {
              $form.ajaxSubmit();
              await Promise.resolve();

              assert.ok(Array.isArray(submittedData), "validation receives form data");
              assert.strictEqual(requests, 0, "does not request");
            }
          );
        } finally {
          $form.off("form-submit-validate");
        }
      });

      [
        ["object", { source: "object" }],
        [
          "function",
          function (formData) {
            assert.ok(Array.isArray(formData), "function receives form data");
            return { source: "function" };
          },
        ],
      ].forEach(function ([label, data]) {
        it("should append extra data supplied as an " + label, async function () {
          let ajaxOptions;

          await withAjaxStub(
            function (options) {
              ajaxOptions = options;
              return {};
            },
            async function () {
              $("#form3").ajaxSubmit({ data: data, type: "post" });
              await Promise.resolve();

              assert.ok(ajaxOptions.data.includes("source=" + label), "serialized extra data");
              assert.deepEqual(ajaxOptions.extraData, { source: label }, "retains extra data");
            }
          );
        });
      });

      it("should append serialized data to a GET url and clear the request body", async function () {
        let ajaxOptions;

        await withAjaxStub(
          function (options) {
            ajaxOptions = options;
            return {};
          },
          async function () {
            $("#form3").ajaxSubmit({ type: "get", url: "ajax/text.html?existing=1" });
            await Promise.resolve();

            assert.ok(ajaxOptions.url.includes("?existing=1&"), "preserves existing query");
            assert.ok(ajaxOptions.url.includes("a="), "appends form data");
            assert.strictEqual(ajaxOptions.data, null, "clears request body");
          }
        );
      });

      it("should put serialized data in the POST request body", async function () {
        let ajaxOptions;

        await withAjaxStub(
          function (options) {
            ajaxOptions = options;
            return {};
          },
          async function () {
            $("#form3").ajaxSubmit({ type: "post" });
            await Promise.resolve();

            assert.strictEqual(ajaxOptions.type, "post", "request method");
            assert.ok(ajaxOptions.data.includes("a="), "request body");
          }
        );
      });

      it("should reset and clear the form before running success", async function () {
        const $form = $("#form3");
        const $name = $form.find("[name=a]");
        const seen = [];
        $name.val("changed");

        await withAjaxStub(
          function (options) {
            options.success("ok", "success", {});
            return {};
          },
          async function () {
            $form.ajaxSubmit({
              resetForm: true,
              clearForm: true,
              success: function () {
                seen.push($name.val());
              },
            });
            await Promise.resolve();

            assert.deepEqual(seen, [""], "maintenance callbacks precede success");
          }
        );
      });

      it("should replace the target and call success with the replacement as context", async function () {
        const $target = $("#targetDiv").html("old");
        let callbackContext;

        await withAjaxStub(
          function (options) {
            options.success("<div id='replacement'>new</div>", "success", {});
            return {};
          },
          async function () {
            $("#form3").ajaxSubmit({
              target: $target,
              replaceTarget: true,
              success: function () {
                callbackContext = this;
              },
            });
            await Promise.resolve();

            assert.strictEqual($("#targetDiv").length, 0, "removes old target");
            assert.strictEqual($("#replacement").text(), "new", "inserts response");
            assert.strictEqual(callbackContext.id, "targetDiv", "original target context");
          }
        );
      });

      it("should run a success callback array with the configured context and form", async function () {
        const context = { name: "callback context" };
        const calls = [];
        const $form = $("#form3");

        await withAjaxStub(
          function (options) {
            options.success("ok", "success", {});
            return {};
          },
          async function () {
            $form.ajaxSubmit({
              context: context,
              success: [
                function (_data, _status, _xhr, callbackForm) {
                  calls.push({ context: this, form: callbackForm });
                },
                function (_data, _status, _xhr, callbackForm) {
                  calls.push({ context: this, form: callbackForm });
                },
              ],
            });
            await Promise.resolve();

            assert.strictEqual(calls.length, 2, "all success callbacks");
            assert.strictEqual(calls[0].context.name, context.name, "first context");
            assert.strictEqual(calls[1].context, calls[0].context, "shared context");
            assert.strictEqual(calls[0].form, $form, "form argument");
          }
        );
      });

      it("should wrap error and complete with context and the form argument", async function () {
        const context = { name: "callback context" };
        const xhr = { status: 500 };
        const seen = {};
        const $form = $("#form3");

        await withAjaxStub(
          function (options) {
            options.error(xhr, "error", "broken");
            options.complete(xhr, "error");
            return xhr;
          },
          async function () {
            $form.ajaxSubmit({
              context: context,
              error: function () {
                seen.error = { context: this, args: Array.from(arguments) };
              },
              complete: function () {
                seen.complete = { context: this, args: Array.from(arguments) };
              },
            });
            await Promise.resolve();

            assert.strictEqual(seen.error.context.name, context.name, "error context");
            assert.deepEqual(seen.error.args, [xhr, "error", "broken", $form], "error arguments");
            assert.strictEqual(seen.complete.context, seen.error.context, "complete context");
            assert.deepEqual(seen.complete.args, [xhr, "error", $form], "complete arguments");
          }
        );
      });

      it("should store the jqXHR and notify listeners after starting the request", async function () {
        const jqXHR = { readyState: 1 };
        let notified;
        const $form = $("#form3");
        $form.one("form-submit-notify", function (_event, form, options) {
          notified = { form: form, options: options, stored: $form.data("jqxhr") };
        });

        try {
          await withAjaxStub(
            function () {
              return jqXHR;
            },
            async function () {
              const opts = { type: "post" };
              $form.ajaxSubmit(opts);
              await Promise.resolve();

              assert.strictEqual($form.data("jqxhr"), jqXHR, "stored jqXHR");
              assert.strictEqual(notified.form, $form, "notified form");
              assert.strictEqual(notified.stored, jqXHR, "stores before notify");
              assert.strictEqual(notified.options.type, "post", "notified options");
            }
          );
        } finally {
          $form.off("form-submit-notify").removeData("jqxhr");
        }
      });
    });

    describe("target", function () {
      it("should load the response into a target given as a selector", async function () {
        $("#targetDiv").empty();
        const opts = { target: "#targetDiv" };

        const seen = await submitAndSettle(opts, () => $("#form3").ajaxSubmit(opts));

        assert.ok(seen.success, "post-callback");
        assert.ok($("#targetDiv").text().match("Lorem ipsum"), "targetDiv updated");
      });

      it("should load the response into a target given as a jQuery object", async function () {
        const $target = $("#targetDiv");
        $target.empty();
        const opts = { target: $target };

        const seen = await submitAndSettle(opts, () => $("#form2").ajaxSubmit(opts));

        assert.ok(seen.success, "post-callback");
        assert.ok($("#targetDiv").text().match("Lorem ipsum"), "targetDiv updated");
      });

      it("should load the response into a target given as a DOM element", async function () {
        $("#targetDiv").empty();
        const opts = { target: $("#targetDiv")[0] };

        const seen = await submitAndSettle(opts, () => $("#form2").ajaxSubmit(opts));

        assert.ok(seen.success, "post-callback");
        assert.ok($("#targetDiv").text().match("Lorem ipsum"), "targetDiv updated");
      });

      it("should run each script of a loaded document exactly once", async function () {
        $("#targetDiv").empty();
        const opts = {
          target: "#targetDiv",
          url: "ajax/doc-with-scripts.html?" + new Date().getTime(),
        };

        const seen = await submitAndSettle(opts, () => $("#form2").ajaxSubmit(opts));

        assert.ok(seen.success, "success-callback");
        assert.ok($("#targetDiv").text().match("Lorem ipsum"), "targetDiv updated");
        assert.ok(typeof unitTestVariable1 != "undefined", "first script block executed");
        assert.ok(typeof unitTestVariable2 != "undefined", "second script block executed");
        assert.ok(typeof scriptCount != "undefined", "third script block executed");
        assert.ok(scriptCount == 1, "scripts executed once: " + scriptCount);
      });
    });

    describe("target with a parsed response", function () {
      [
        ["a JSON array", ['<img src=x onerror="window.targetPayload=1">']],
        ["a JSON object", { html: '<img src=x onerror="window.targetPayload=1">' }],
      ].forEach(function ([label, data]) {
        it("should not insert " + label + " but still call success", async function () {
          window.targetPayload = 0;
          const $target = $('<div id="parsed-target">kept</div>').appendTo("#main");
          const $form = $('<form action="ajax/json.json"></form>').appendTo("#main");
          const successes = [];

          captureAjaxOptions(
            $form,
            { target: $target, success: (response) => successes.push(response) },
            (settings) => settings.success(data, "success", {})
          );
          await new Promise((resolve) => setTimeout(resolve, 50));

          assert.strictEqual($target.html(), "kept");
          assert.deepEqual(successes, [data]);
          assert.strictEqual(window.targetPayload, 0);
        });
      });
    });

    describe("callbacks", function () {
      it("should call beforeSubmit with the field array and the form", async function () {
        const opts = {};

        const seen = await submitAndSettle(opts, () => $("#form3").ajaxSubmit(opts));

        assert.ok(seen.beforeSubmit, "pre-submit callback");
        assert.ok(seen.beforeSubmit.data.constructor == Array, "type check array");
        assert.ok(seen.beforeSubmit.$form.jquery, "type check jQuery");
        assert.ok(
          seen.beforeSubmit.$form[0].tagName.toLowerCase() == "form",
          'jQuery arg == "form": ' + seen.beforeSubmit.$form[0].tagName.toLowerCase()
        );
      });

      it("should call success with the response text and status text", async function () {
        const opts = {};

        const seen = await submitAndSettle(opts, () => $("#form3").ajaxSubmit(opts));

        assert.ok(seen.success, "post-submit callback");
        assert.ok(seen.success[0].match("Lorem ipsum"), "responseText");
        assert.ok(seen.success[1] == "success", "statusText");
      });

      it("should treat a function argument as the success callback", async function () {
        let called = false;

        await new Promise(function (resolve) {
          $("#form3").ajaxSubmit(function () {
            called = true;
            resolve();
          });
        });

        assert.ok(called, "callback hit");
      });

      it("should call beforeSubmit with fields in document order when semantic is true", async function () {
        const testData = ["a", "b", "c", "d", "e", "f"];
        const opts = { semantic: true };

        const seen = await submitAndSettle(opts, () => $("#form2").ajaxSubmit(opts));

        assert.ok(seen.beforeSubmit, "pre-submit callback");
        assert.ok(seen.beforeSubmit.data.constructor == Array, "type check");
        assert.ok(seen.beforeSubmit.$form.jquery, "type check jQuery");
        for (let i = 0; i < seen.beforeSubmit.data.length; i++) {
          assert.ok(seen.beforeSubmit.data[i].name == testData[i], "match value at index=" + i);
        }
      });

      it("should not send the request when beforeSubmit returns false", function () {
        const seen = { beforeSubmit: null, success: false };
        const opts = {
          beforeSubmit: function (a, jq) {
            seen.beforeSubmit = { data: a, $form: jq };
            return false;
          },
          success: function () {
            seen.success = true;
          },
        };

        $("#form3").ajaxSubmit(opts);

        assert.ok(seen.beforeSubmit, "pre-submit callback");
        assert.ok(seen.beforeSubmit.data.constructor == Array, "type check");
        assert.ok(seen.beforeSubmit.$form.jquery, "type check jQuery");
        assert.ok(!seen.success, "should not hit this post-submit callback");
      });

      it("should call success when the request succeeds", async function () {
        $("#targetDiv").empty();
        const opts = {};

        const seen = await submitAndSettle(opts, () => $("#form3").ajaxSubmit(opts));

        assert.ok(seen.success, "post-callback");
      });

      it("should call error and not success when the request fails", async function () {
        $("#targetDiv").empty();
        const opts = { url: "ajax/404.html" };

        const seen = await submitAndSettle(opts, () => $("#form3").ajaxSubmit(opts));

        assert.ok(seen.error, "error-callback");
        assert.ok(!seen.success, "should not hit post-submit callback");
      });

      it("should pass status, xhr and the form to success", async function () {
        $("#targetDiv").empty();
        const opts = {};
        let $testForm;

        const seen = await submitAndSettle(opts, () => {
          $testForm = $("#form3").ajaxSubmit(opts);
        });

        assert.ok(seen.success, "success callback invoked");
        assert.ok(seen.success[1] === "success", "status === success");
        assert.ok(typeof seen.success[2] != "undefined", "third arg: " + typeof seen.success[2]);
        assert.ok(!!seen.success[2] != false, "xhr != false");
        assert.ok(seen.success[2].status, "xhr.status == " + seen.success[2].status);
        assert.ok(seen.success[3] === $testForm, "$form param is valid");
      });

      it("should call success with a success status when forceSync is true", async function () {
        $("#targetDiv").empty();
        const opts = { forceSync: true };

        const seen = await submitAndSettle(opts, () => $("#form3").ajaxSubmit(opts));

        assert.ok(seen.success, "success callback invoked");
        assert.ok(seen.success[1] === "success", "status === success");
      });
    });

    describe("dataType", function () {
      it("should parse a json response into an object", async function () {
        const opts = { url: "ajax/json.json", dataType: "json" };

        const seen = await submitAndSettle(opts, () => $("#form2").ajaxSubmit(opts));

        assert.ok(typeof seen.success[0] == "object", "json data type");
        assert.ok(seen.success[0].name == "jquery-test", "json data contents");
      });

      it("should evaluate a script response", async function () {
        const opts = {
          url: "ajax/script.txt?" + new Date().getTime(), // don't let ie cache it
          dataType: "script",
        };

        const seen = await submitAndSettle(opts, () => $("#form2").ajaxSubmit(opts));

        assert.ok(typeof formScriptTest == "function", "script evaluated");
        // jQuery 4 loads async script requests through a script tag, so no response text arrives.
        if (Number($.fn.jquery.split(".")[0]) < 4) {
          assert.ok(seen.success[0].match("formScriptTest"), "script returned");
        }
      });

      it("should parse an xml response into a document", async function () {
        const opts = { url: "ajax/test.xml", dataType: "xml" };

        const seen = await submitAndSettle(opts, () => $("#form2").ajaxSubmit(opts));

        assert.ok(typeof seen.success[0] == "object", "data type xml");
        assert.ok($("test", seen.success[0]).length == 3, "xml data query");
      });

      it("should leave a json text response for the caller to evaluate", async function () {
        const opts = { url: "ajax/json.txt" };

        const seen = await submitAndSettle(opts, () => $("#form2").ajaxSubmit(opts));

        assert.ok(seen.success, "post-callback");
        const data = eval.call(window, "(" + seen.success[0] + ")");
        assert.ok(data.name == "jquery-test", "evaled response");
      });
    });

    describe("action and url", function () {
      it("should honor query args already present in the action attribute", async function () {
        const opts = {};

        const seen = await submitAndSettle(opts, () => $("#form5").ajaxSubmit(opts));

        assert.ok(seen.success, "post callback");
      });

      it("should submit a pseudo-form using the given url and type", async function () {
        const opts = { url: "ajax/text.html", type: "post" };

        const seen = await submitAndSettle(opts, () => $("#pseudo").ajaxSubmit(opts));

        assert.ok(seen.beforeSubmit, "pre-submit callback");
        assert.ok(seen.beforeSubmit.data.constructor == Array, "type check");
        assert.ok(seen.beforeSubmit.$form.jquery, "type check jQuery");
        assert.ok(seen.beforeSubmit.$form[0].tagName.toLowerCase() == "div", 'jQuery arg == "div"');
        assert.ok(seen.success, "post-submit callback");
      });

      // Each case submits a form whose action is unusual and checks that it still reaches
      // beforeSerialize without throwing.
      [
        ["a naked hash", "#actionTest1"],
        ["a hash only", "#actionTest2"],
        ["an empty", "#actionTest3"],
        ["a missing", "#actionTest4"],
      ].forEach(function ([label, selector]) {
        it("should submit a form with " + label + " action", function () {
          let url = null;
          const opts = {
            beforeSerialize: function ($f, o) {
              url = o.url;
            },
          };

          assert.doesNotThrow(() => $(selector).ajaxSubmit(opts), "ajaxSubmit passed");

          assert.ok(url !== null, "beforeSerialize called");
        });
      });

      it("should use the page URL when a control named action shadows a missing action", function () {
        const $form = $('<form method="post"><input name="action" value="x"></form>');

        const settings = captureAjaxOptions($form.appendTo("#main"), {});

        assert.strictEqual(settings.url, window.location.href.split("#")[0]);
      });

      it("should use the page URL for a raw action attribute that is only a fragment", function () {
        const $form = $('<form method="post" action="#fragment"><input name="action"></form>');

        const settings = captureAjaxOptions($form.appendTo("#main"), {});

        assert.strictEqual(settings.url, window.location.href.split("#")[0]);
      });

      it("should build a GET url for a raw action attribute that is only a fragment", function () {
        const $form = $(
          '<form method="get" action="#fragment"><input name="action" value="x"></form>'
        );

        const settings = captureAjaxOptions($form.appendTo("#main"), {});

        assert.ok(settings.url.startsWith(window.location.href.split("#")[0]), settings.url);
        assert.match(settings.url, /[?&]action=x$/);
      });

      [
        ["ajax/text.html#frag", "ajax/text.html?a=1#frag"],
        ["ajax/text.html?b=2#frag", "ajax/text.html?b=2&a=1#frag"],
      ].forEach(function ([url, expected]) {
        it("should put the GET query before the fragment of " + url, function () {
          const $form = $('<form><input name="a" value="1"></form>').appendTo("#main");

          const settings = captureAjaxOptions($form, { type: "GET", url: url });

          assert.strictEqual(settings.url, expected);
        });
      });

      it("should use the default AJAX type when a control named method shadows the form", function () {
        const $form = $('<form action="ajax/text.html"><input name="method" value="x"></form>');

        const settings = captureAjaxOptions($form.appendTo("#main"), {});

        assert.strictEqual(settings.type, $.ajaxSettings.type);
      });

      [
        ["an empty user agent", ""],
        ["IE on a non-HTTPS page", "Mozilla/5.0 (Windows NT 10.0; Trident/7.0; rv:11.0)"],
      ].forEach(function ([label, userAgent]) {
        it("should use about:blank as the iframe source for " + label, function () {
          const $form = $('<form action="ajax/text.html"></form>').appendTo("#main");

          const settings = withUserAgent(userAgent, () => captureAjaxOptions($form, {}));

          assert.strictEqual(settings.iframeSrc, "about:blank");
        });
      });

      it("should use javascript:false as the iframe source for IE on an HTTPS page", function () {
        const $form = $('<form action="ajax/text.html"></form>').appendTo("#main");
        const userAgent = "Mozilla/5.0 (Windows NT 10.0; Trident/7.0; rv:11.0)";

        const settings = withDocumentUrl("https://example.test/form", () =>
          withUserAgent(userAgent, () => captureAjaxOptions($form, {}))
        );

        assert.strictEqual(settings.iframeSrc, "javascript:false");
      });
    });

    describe("serialization options", function () {
      it("should serialize extra data traditionally when asked", function () {
        const $form = $('<form action="ajax/text.html" method="post"></form>').appendTo("#main");

        const settings = captureAjaxOptions($form, {
          data: { list: ["a", "b"] },
          traditional: true,
        });

        assert.strictEqual(settings.data, "list=a&list=b");
      });

      it("should submit only extra data when the form has no fields", function () {
        const $form = $('<form action="ajax/text.html" method="post"></form>').appendTo("#main");

        const settings = captureAjaxOptions($form, { data: { only: "extra" } });

        assert.strictEqual(settings.data, "only=extra");
      });
    });
  });
});
