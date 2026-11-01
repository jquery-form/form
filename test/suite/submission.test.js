/* global scriptCount */

import { assert, describe, it } from "vitest";
import {
  resetFixture,
  submitAndSettle,
  captureAjaxOptions,
  withUserAgent,
  withDocumentUrl,
  withAjaxStub,
  withAjaxSettings,
  selectFiles,
  formHidingParentNode,
  buildForm,
} from "./helpers.js";

function makeForm(html) {
  return $(html).appendTo("#main");
}

function absolute(path) {
  return new URL(path, window.location.href).href;
}

function pageUrl() {
  return window.location.href.split("#")[0];
}

// Returns the FormData body the upload transport sets in its beforeSend.
function uploadBody(settings) {
  const received = {};
  settings.beforeSend({}, received);

  return received.data;
}

function majorVersion() {
  return Number($.fn.jquery.split(".")[0]);
}

// Calls ajaxSubmit with `args` through a stubbed $.ajax and returns the settings it received
// (undefined when no request started). `respond` may answer the request or return the jqXHR;
// `onReturn` receives what ajaxSubmit returned.
function submitWith($form, args, respond, onReturn) {
  const ajax = $.ajax;
  let settings;
  $.ajax = function (received) {
    settings = received;
    const jqXHR = respond ? respond(received) : undefined;
    return jqXHR || {};
  };

  try {
    const result = $form.ajaxSubmit.apply($form, args);
    if (onReturn) {
      onReturn(result);
    }
  } finally {
    $.ajax = ajax;
  }

  return settings;
}

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
        [false, "ajax/text.html"],
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

              assert.ok(ajaxOptions.url.endsWith(expectedUrl), "form action");
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

    describe("argument shapes", function () {
      it("should not trigger events or call the callback when the selection is empty", function () {
        const events = [];
        let called = false;
        $(document).on("form-pre-serialize.empty form-submit-notify.empty", function (event) {
          events.push(event.type);
        });

        try {
          $(".missing-form").ajaxSubmit(function () {
            called = true;
          });
        } finally {
          $(document).off(".empty");
        }

        assert.deepEqual(events, []);
        assert.strictEqual(called, false);
      });

      it("should not throw when the selection is empty and options are null", function () {
        const run = () => $(".missing-form").ajaxSubmit(null);

        assert.doesNotThrow(run);
      });

      it("should throw a TypeError before any event when options are null", function () {
        const $form = makeForm('<form action="ajax/text.html" method="post"></form>');
        let triggered = false;
        $form.on("form-pre-serialize", function () {
          triggered = true;
        });

        const run = () => submitWith($form, [null]);

        assert.throws(run, TypeError);
        assert.strictEqual(triggered, false);
      });

      it("should keep the default success when the shorthand fourth argument is not a function", async function () {
        const $form = makeForm('<form action="ajax/text.html" method="post"></form>');
        const calls = [];
        const globalSuccess = function () {
          calls.push(arguments.length);
        };

        await withAjaxSettings({ success: globalSuccess }, function () {
          submitWith($form, ["ajax/text.html", undefined, undefined, "not a function"], (s) =>
            s.success("ok", "success", {})
          );
        });

        assert.deepEqual(calls, [4]);
      });

      it("should send no extra data when the shorthand data is undefined", function () {
        const $form = makeForm(
          '<form action="ajax/text.html" method="post"><input name="a" value="1"></form>'
        );

        const settings = submitWith($form, ["ajax/other.html"]);

        assert.strictEqual(settings.url, "ajax/other.html");
        assert.strictEqual(settings.data, "a=1");
        assert.strictEqual(settings.extraData, undefined);
      });

      [true, 5].forEach(function (value) {
        it("should treat " + value + " as default options", function () {
          const $form = makeForm(
            '<form action="ajax/text.html" method="post"><input name="a" value="1"></form>'
          );

          const settings = submitWith($form, [value]);

          assert.strictEqual(settings.url, absolute("ajax/text.html"));
          assert.strictEqual(settings.type, "post");
          assert.strictEqual(settings.data, "a=1");
        });
      });

      it("should ignore the shorthand arguments when options is an object", function () {
        const $form = makeForm(
          '<form action="ajax/text.html" method="post"><input name="a" value="1"></form>'
        );
        let called = false;
        const onSuccess = function () {
          called = true;
        };

        const settings = submitWith($form, [{}, { extra: "x" }, "json", onSuccess], (s) =>
          s.success("ok", "success", {})
        );

        assert.strictEqual(settings.data, "a=1");
        assert.strictEqual(settings.dataType, undefined);
        assert.strictEqual(called, false);
      });

      it("should throw a TypeError after the veto points when type is null", function () {
        const $form = makeForm('<form action="ajax/text.html" method="post"></form>');
        let beforeSubmitCalled = false;
        const options = {
          type: null,
          beforeSubmit: function () {
            beforeSubmitCalled = true;
          },
        };

        const run = () => submitWith($form, [options]);

        assert.throws(run, TypeError);
        assert.strictEqual(beforeSubmitCalled, true);
      });
    });

    describe("method and type", function () {
      it("should use options.method as the type on the $.ajax path", function () {
        const $form = makeForm(
          '<form action="ajax/text.html" method="post"><input name="a" value="1"></form>'
        );

        const settings = submitWith($form, [{ method: "put" }]);

        assert.strictEqual(settings.type, "put");
        assert.strictEqual(settings.method, "put");
        assert.strictEqual(settings.data, "a=1");
      });

      it("should use the lowercase form method when the method attribute is uppercase", function () {
        const $form = makeForm('<form action="ajax/text.html" method="POST"></form>');

        const settings = submitWith($form, [{}]);

        assert.strictEqual(settings.type, "post");
      });

      it("should submit with GET when the form has no method attribute, even with a global POST type", async function () {
        const $form = makeForm('<form action="ajax/text.html"><input name="a" value="1"></form>');
        let settings;

        await withAjaxSettings({ type: "POST" }, function () {
          settings = submitWith($form, [{}]);
        });

        assert.strictEqual(settings.type, "get");
        assert.strictEqual(settings.data, null);
        assert.strictEqual(settings.url, absolute("ajax/text.html") + "?a=1");
      });

      ["put", "delete"].forEach(function (method) {
        it("should submit with GET when the method attribute is " + method, function () {
          const $form = makeForm('<form action="ajax/text.html" method="' + method + '"></form>');

          const settings = submitWith($form, [{}]);

          assert.strictEqual(settings.type, "get");
        });
      });

      it("should send a body when the method attribute is dialog", function () {
        const $form = makeForm(
          '<form action="ajax/text.html" method="dialog"><input name="a" value="1"></form>'
        );

        const settings = submitWith($form, [{}]);

        assert.strictEqual(settings.type, "dialog");
        assert.strictEqual(settings.data, "a=1");
      });

      it("should use the raw method attribute when a control named method shadows the form", function () {
        const $form = makeForm(
          '<form action="ajax/text.html" method="PUT"><input name="method" value="x"></form>'
        );

        const settings = submitWith($form, [{}]);

        assert.strictEqual(settings.type, "PUT");
      });

      it("should use the default AJAX type when a pseudo-form has no type", function () {
        const $div = makeForm('<div><input name="a" value="1"></div>');

        const settings = submitWith($div, [{ url: "ajax/text.html" }]);

        assert.strictEqual(settings.type, $.ajaxSettings.type);
        assert.strictEqual(settings.url, "ajax/text.html?a=1");
      });

      ["PUT", "DELETE"].forEach(function (type) {
        it("should put the query in the body for " + type, function () {
          const $form = makeForm(
            '<form action="ajax/text.html" method="post"><input name="a" value="1"></form>'
          );

          const settings = submitWith($form, [{ type: type }]);

          assert.strictEqual(settings.url, absolute("ajax/text.html"));
          assert.strictEqual(settings.data, "a=1");
        });
      });

      it.fails("should send the method option when method and type conflict", function () {
        const $form = makeForm(
          '<form action="ajax/text.html" method="post"><input name="a" value="1"></form>'
        );

        const settings = submitWith($form, [{ method: "POST", type: "GET" }]);

        assert.strictEqual(settings.url, absolute("ajax/text.html"));
        assert.strictEqual(settings.data, "a=1");
      });
    });

    describe("url resolution", function () {
      it("should submit to the page url when the form has no action attribute", function () {
        const $form = makeForm('<form method="post"></form>');

        const settings = submitWith($form, [{}]);

        assert.strictEqual(settings.url, pageUrl());
      });

      it("should submit to the page url when the action attribute is empty", function () {
        const $form = makeForm('<form method="post" action=""></form>');

        const settings = submitWith($form, [{}]);

        assert.strictEqual(settings.url, pageUrl());
      });

      ["#", "#x"].forEach(function (action) {
        it("should submit to the page url when the action is " + action, function () {
          const $form = makeForm('<form method="post" action="' + action + '"></form>');

          const settings = submitWith($form, [{}]);

          assert.strictEqual(settings.url, pageUrl());
        });
      });

      it("should drop the fragment of the form action", function () {
        const $form = makeForm('<form method="post" action="ajax/text.html#frag"></form>');

        const settings = submitWith($form, [{}]);

        assert.strictEqual(settings.url, absolute("ajax/text.html"));
      });

      it("should append the GET query to a form action without its fragment", function () {
        const $form = makeForm(
          '<form method="get" action="ajax/text.html#frag"><input name="a" value="1"></form>'
        );

        const settings = submitWith($form, [{}]);

        assert.strictEqual(settings.url, absolute("ajax/text.html") + "?a=1");
      });

      it("should trim a raw action attribute when a control named action shadows the form", function () {
        const $form = makeForm(
          '<form method="post" action="  ajax/text.html  "><input name="action"></form>'
        );

        const settings = submitWith($form, [{}]);

        assert.strictEqual(settings.url, "ajax/text.html");
      });

      it("should pass a caller url to $.ajax unchanged when it has spaces or a fragment", function () {
        const $form = makeForm('<form method="post" action="ajax/text.html"></form>');

        const settings = submitWith($form, [{ url: " ajax/other.html#frag " }]);

        assert.strictEqual(settings.url, " ajax/other.html#frag ");
      });

      it("should submit a pseudo-form without a url to the page url", function () {
        const $div = makeForm("<div></div>");

        const settings = submitWith($div, [{ type: "post" }]);

        assert.strictEqual(settings.url, pageUrl());
      });

      it("should keep a caller iframeSrc", function () {
        const $form = makeForm('<form method="post" action="ajax/text.html"></form>');

        const settings = submitWith($form, [{ iframeSrc: "ajax/text.html" }]);

        assert.strictEqual(settings.iframeSrc, "ajax/text.html");
      });

      [
        [false, "post"],
        [false, "get"],
        ["", "post"],
        ["", "get"],
      ].forEach(function ([url, method]) {
        it(
          "should submit to the form action when the url is " +
            JSON.stringify(url) +
            " and the form uses " +
            method,
          function () {
            const $form = makeForm(
              '<form method="' + method + '" action="ajax/text.html"><input name="a"></form>'
            );

            const settings = submitWith($form, [url]);

            assert.ok(
              String(settings.url).startsWith(absolute("ajax/text.html")),
              String(settings.url)
            );
          }
        );
      });

      [false, ""].forEach(function (url) {
        it(
          "should submit to the form action when the url option is " + JSON.stringify(url),
          function () {
            const $form = makeForm('<form method="post" action="ajax/text.html"></form>');
            const options = { url: url, type: "post" };

            const settings = submitWith($form, [options]);

            assert.strictEqual(settings.url, absolute("ajax/text.html"));
            assert.strictEqual(settings.type, "post");
            assert.strictEqual(options.url, url);
          }
        );
      });
    });

    describe("options merge", function () {
      it("should leave the caller's options object unchanged after a submit", function () {
        const $form = makeForm(
          '<form method="post" action="ajax/text.html"><input name="a" value="1"></form>'
        );
        const success = function () {};
        const error = function () {};
        const complete = function () {};
        const data = { extra: "x" };
        const options = { success, error, complete, data, url: "ajax/other.html", type: "GET" };

        submitWith($form, [options]);

        assert.deepEqual(Object.keys(options), [
          "success",
          "error",
          "complete",
          "data",
          "url",
          "type",
        ]);
        assert.strictEqual(options.success, success);
        assert.strictEqual(options.error, error);
        assert.strictEqual(options.complete, complete);
        assert.strictEqual(options.data, data);
        assert.deepEqual(data, { extra: "x" });
        assert.strictEqual(options.url, "ajax/other.html");
        assert.strictEqual(options.type, "GET");
      });

      it("should copy nested plain objects but keep jQuery objects and elements by reference", function () {
        const $form = makeForm('<form method="post" action="ajax/text.html"></form>');
        const headers = { "X-Test": "1" };
        const $target = $("#targetDiv");
        const element = $target[0];

        const settings = submitWith($form, [{ headers: headers, target: $target, el: element }]);

        assert.notStrictEqual(settings.headers, headers);
        assert.deepEqual(settings.headers, headers);
        assert.strictEqual(settings.target, $target);
        assert.strictEqual(settings.el, element);
      });

      it("should not let an undefined option override a default", function () {
        const $form = makeForm('<form method="post" action="ajax/text.html"></form>');

        const settings = submitWith($form, [{ url: undefined, iframeSrc: undefined }]);

        assert.strictEqual(settings.url, absolute("ajax/text.html"));
        assert.strictEqual(settings.iframeSrc, "about:blank");
      });

      it.fails("should call callbacks with the given context object", function () {
        const $form = makeForm('<form method="post" action="ajax/text.html"></form>');
        const context = { name: "context" };
        let seen;

        submitWith(
          $form,
          [
            {
              context: context,
              success: function () {
                seen = this;
              },
            },
          ],
          (s) => s.success("ok", "success", {})
        );

        assert.strictEqual(seen, context);
      });

      it("should pass the form to a global ajaxSetup success", async function () {
        const $form = makeForm('<form method="post" action="ajax/text.html"></form>');
        let args;
        const globalSuccess = function () {
          args = Array.from(arguments);
        };

        await withAjaxSettings({ success: globalSuccess }, function () {
          submitWith($form, [{}], (s) => s.success("ok", "success", "xhr"));
        });

        assert.deepEqual(args, ["ok", "success", "xhr", $form]);
      });

      it("should not pass the form to a global ajaxSetup error", async function () {
        let settled;

        const args = await withAjaxSettings(
          {
            error: function () {
              settled(Array.from(arguments).length);
            },
          },
          function () {
            return new Promise(function (resolve) {
              settled = resolve;
              $("#form3").ajaxSubmit({ url: "ajax/404.html" });
            });
          }
        );

        assert.strictEqual(args, 3);
      });
    });

    describe("veto points and hooks", function () {
      it("should pass the selection and the merged options to form-pre-serialize handlers", function () {
        const $form = makeForm('<form method="post" action="ajax/text.html"></form>');
        let seen;
        $form.on("form-pre-serialize", function (_event, form, options, veto) {
          seen = { form, options, veto };
        });

        const settings = submitWith($form, [{}]);

        assert.strictEqual(seen.form, $form);
        assert.strictEqual(seen.options, settings);
        assert.deepEqual(seen.veto, {});
      });

      it("should return the selection and keep the stored jqXHR when form-pre-serialize vetoes", function () {
        const $form = makeForm('<form method="post" action="ajax/text.html"></form>');
        const earlier = { earlier: true };
        let beforeSerializeCalled = false;
        $form.data("jqxhr", earlier);
        $form.on("form-pre-serialize", function (_event, _form, _options, veto) {
          veto.veto = true;
        });
        const options = {
          beforeSerialize: function () {
            beforeSerializeCalled = true;
          },
        };
        let result;

        const settings = submitWith($form, [options], null, (r) => (result = r));

        assert.strictEqual(result, $form);
        assert.strictEqual(settings, undefined);
        assert.strictEqual(beforeSerializeCalled, false);
        assert.strictEqual($form.data("jqxhr"), earlier);
      });

      it("should still submit when plugin event handlers return false or prevent the default", function () {
        const $form = makeForm('<form method="post" action="ajax/text.html"></form>');
        $form.on("form-pre-serialize", function () {
          return false;
        });
        $form.on("form-submit-validate", function (event) {
          event.preventDefault();
          event.stopPropagation();
        });

        const settings = submitWith($form, [{}]);

        assert.ok(settings);
      });

      it("should deliver plugin events to document handlers", function () {
        const $form = makeForm('<form method="post" action="ajax/text.html"></form>');
        const events = [];
        $(document).on(
          "form-pre-serialize.bubble form-submit-validate.bubble form-submit-notify.bubble",
          function (event) {
            events.push(event.type);
          }
        );

        try {
          submitWith($form, [{}]);
        } finally {
          $(document).off(".bubble");
        }

        assert.deepEqual(events, [
          "form-pre-serialize",
          "form-submit-validate",
          "form-submit-notify",
        ]);
      });

      it("should submit a detached form without document handlers seeing its events", function () {
        const $form = $('<form method="post" action="ajax/text.html"></form>');
        const events = [];
        $(document).on("form-pre-serialize.detached", function (_event, _form, _options, veto) {
          events.push("seen");
          veto.veto = true;
        });
        let settings;

        try {
          settings = submitWith($form, [{}]);
        } finally {
          $(document).off(".detached");
        }

        assert.deepEqual(events, []);
        assert.ok(settings);
      });

      it("should call beforeSerialize with the merged options as this", function () {
        const $form = makeForm('<form method="post" action="ajax/text.html"></form>');
        let seen;
        const options = {
          beforeSerialize: function (_form, opts) {
            seen = { self: this, opts };
          },
        };

        const settings = submitWith($form, [options]);

        assert.strictEqual(seen.self, settings);
        assert.strictEqual(seen.opts, settings);
      });

      [0, null, "", undefined].forEach(function (value) {
        it("should continue when beforeSerialize returns " + JSON.stringify(value), function () {
          const $form = makeForm('<form method="post" action="ajax/text.html"></form>');

          const settings = submitWith($form, [{ beforeSerialize: () => value }]);

          assert.ok(settings);
        });
      });

      it("should use a url set by a form-pre-serialize handler", function () {
        const $form = makeForm('<form method="post" action="ajax/text.html"></form>');
        $form.on("form-pre-serialize", function (_event, _form, options) {
          options.url = "ajax/changed.html";
        });

        const settings = submitWith($form, [{}]);

        assert.strictEqual(settings.url, "ajax/changed.html");
      });

      it("should use a type set by beforeSerialize", function () {
        const $form = makeForm(
          '<form method="post" action="ajax/text.html"><input name="a" value="1"></form>'
        );
        const options = {
          beforeSerialize: function (_form, opts) {
            opts.type = "GET";
          },
        };

        const settings = submitWith($form, [options]);

        assert.strictEqual(settings.url, absolute("ajax/text.html") + "?a=1");
        assert.strictEqual(settings.data, null);
      });

      it("should call beforeSubmit with the merged options as this and the options argument", function () {
        const $form = makeForm('<form method="post" action="ajax/text.html"></form>');
        let seen;
        const options = {
          beforeSubmit: function (_a, _form, opts) {
            seen = { self: this, opts };
          },
        };

        const settings = submitWith($form, [options]);

        assert.strictEqual(seen.self, settings);
        assert.strictEqual(seen.opts, settings);
      });

      it("should return the selection and skip form-submit-validate when beforeSubmit returns false", function () {
        const $form = makeForm('<form method="post" action="ajax/text.html"></form>');
        let validated = false;
        $form.on("form-submit-validate", function () {
          validated = true;
        });
        let result;

        const settings = submitWith(
          $form,
          [{ beforeSubmit: () => false }],
          null,
          (r) => (result = r)
        );

        assert.strictEqual(result, $form);
        assert.strictEqual(settings, undefined);
        assert.strictEqual(validated, false);
      });

      it("should send the fields as beforeSubmit leaves them", function () {
        const $form = makeForm(
          '<form method="post" action="ajax/text.html"><input name="a" value="1"><input name="b" value="2"></form>'
        );
        const options = {
          beforeSubmit: function (a) {
            a.splice(0, 1);
            a[0].value = "changed";
            a.push({ name: "c", value: "3" });
          },
        };

        const settings = submitWith($form, [options]);

        assert.strictEqual(settings.data, "b=changed&c=3");
      });

      it("should pass the same veto object to both veto events", function () {
        const $form = makeForm('<form method="post" action="ajax/text.html"></form>');
        const seen = {};
        $form.on("form-pre-serialize", function (_event, _form, _options, veto) {
          seen.pre = veto;
        });
        $form.on("form-submit-validate", function (_event, a, form, options, veto) {
          seen.validate = { a, form, options, veto };
        });

        const settings = submitWith($form, [{}]);

        assert.strictEqual(seen.validate.veto, seen.pre);
        assert.strictEqual(seen.validate.form, $form);
        assert.strictEqual(seen.validate.options, settings);
        assert.ok(Array.isArray(seen.validate.a));
      });

      [
        [
          "form-pre-serialize vetoes",
          ($form) =>
            $form.on("form-pre-serialize", (_e, _f, _o, veto) => {
              veto.veto = true;
            }),
          {},
        ],
        ["beforeSerialize returns false", () => {}, { beforeSerialize: () => false }],
        ["beforeSubmit returns false", () => {}, { beforeSubmit: () => false }],
        [
          "form-submit-validate vetoes",
          ($form) =>
            $form.on("form-submit-validate", (_e, _a, _f, _o, veto) => {
              veto.veto = true;
            }),
          {},
        ],
      ].forEach(function ([label, arrange, options]) {
        it("should return the selection without a request when " + label, function () {
          const $form = makeForm('<form method="post" action="ajax/text.html"></form>');
          arrange($form);
          let result;

          const settings = submitWith($form, [options], null, (r) => (result = r));

          assert.strictEqual(result, $form);
          assert.strictEqual(settings, undefined);
        });
      });

      it("should run the submit steps in order", function () {
        const $form = makeForm('<form method="post" action="ajax/text.html"></form>');
        const steps = [];
        $form.on("form-pre-serialize", () => steps.push("form-pre-serialize"));
        $form.on("form-submit-validate", () => steps.push("form-submit-validate"));
        $form.on("form-submit-notify", () =>
          steps.push("form-submit-notify:" + ($form.data("jqxhr") ? "stored" : "missing"))
        );
        const options = {
          beforeSerialize: () => steps.push("beforeSerialize"),
          data: function () {
            steps.push("data");
            return {};
          },
          beforeSubmit: () => steps.push("beforeSubmit"),
        };

        submitWith($form, [options], () => steps.push("$.ajax"));

        assert.deepEqual(steps, [
          "form-pre-serialize",
          "beforeSerialize",
          "data",
          "beforeSubmit",
          "form-submit-validate",
          "$.ajax",
          "form-submit-notify:stored",
        ]);
      });
    });

    describe("extra data", function () {
      it("should call the data function with the merged options as this, even when beforeSubmit vetoes", function () {
        const $form = makeForm('<form method="post" action="ajax/text.html"></form>');
        const seen = [];
        let merged;
        const options = {
          beforeSerialize: function (_form, opts) {
            merged = opts;
          },
          data: function (a) {
            seen.push({ self: this, a });
            return {};
          },
          beforeSubmit: function (a) {
            seen.push({ a });
            return false;
          },
        };

        submitWith($form, [options]);

        assert.strictEqual(seen.length, 2);
        assert.strictEqual(seen[0].self, merged);
        assert.strictEqual(seen[0].a, seen[1].a);
      });

      [undefined, null, "", 0, false].forEach(function (value) {
        it("should keep a caller extraData when data is " + String(value), function () {
          const $form = makeForm('<form method="post" action="ajax/text.html"></form>');

          const settings = submitWith($form, [{ data: value, extraData: { kept: "1" } }]);

          assert.deepEqual(settings.extraData, { kept: "1" });
        });
      });

      it("should not send a caller extraData on the $.ajax path", function () {
        const $form = makeForm(
          '<form method="post" action="ajax/text.html"><input name="a" value="1"></form>'
        );

        const settings = submitWith($form, [{ extraData: { kept: "1" } }]);

        assert.strictEqual(settings.data, "a=1");
      });

      it("should ignore a data option changed in beforeSubmit on the $.ajax path", function () {
        const $form = makeForm(
          '<form method="post" action="ajax/text.html"><input name="a" value="1"></form>'
        );
        const options = {
          data: { x: "1" },
          beforeSubmit: function (_a, _form, opts) {
            opts.data = { y: "2" };
          },
        };

        const settings = submitWith($form, [options]);

        assert.strictEqual(settings.data, "a=1&x=1");
      });

      it("should handle a data function that returns undefined per jQuery version", function () {
        const $form = makeForm(
          '<form method="post" action="ajax/text.html"><input name="a" value="1"></form>'
        );

        const run = () => submitWith($form, [{ data: () => undefined }]);

        if (majorVersion() < 3) {
          assert.throws(run, TypeError);
        } else {
          assert.strictEqual(run().data, "a=1");
        }
      });

      it("should append an array of name/value pairs as fields", function () {
        const $form = makeForm(
          '<form method="post" action="ajax/text.html"><input name="a" value="1"></form>'
        );
        const data = [
          { name: "x", value: "1" },
          { name: "x", value: "2" },
        ];

        const settings = submitWith($form, [{ data: data }]);

        assert.strictEqual(settings.data, "a=1&x=1&x=2");
      });

      it("should serialize null extra values per jQuery version", function () {
        const $form = makeForm('<form method="post" action="ajax/text.html"></form>');

        const settings = submitWith($form, [{ data: { n: null } }]);

        if (majorVersion() < 3) {
          assert.strictEqual(settings.data, "n=null");
        } else {
          assert.strictEqual(settings.data, "n=");
        }
      });

      it("should send only the fields when data is an empty object", function () {
        const $form = makeForm(
          '<form method="post" action="ajax/text.html"><input name="a" value="1"></form>'
        );

        const settings = submitWith($form, [{ data: {} }]);

        assert.strictEqual(settings.data, "a=1");
      });

      [
        ["the global setting", true, undefined, "a=1&list=x&list=y"],
        ["traditional false over the global setting", true, false, "a=1&list%5B%5D=x&list%5B%5D=y"],
      ].forEach(function ([label, global, traditional, expected]) {
        it("should serialize extra data with " + label + " on the $.ajax path", async function () {
          const $form = makeForm(
            '<form method="post" action="ajax/text.html"><input name="a" value="1"></form>'
          );
          let settings;

          await withAjaxSettings({ traditional: global }, function () {
            settings = submitWith($form, [{ data: { list: ["x", "y"] }, traditional }]);
          });

          assert.strictEqual(settings.data, expected);
        });
      });

      it("should serialize upload extra data traditionally when the traditional option is set", function () {
        const $form = makeForm(
          '<form method="post" action="ajax/text.html"><input type="file" name="f"></form>'
        );
        selectFiles($form.find("input")[0], ["a.txt"]);

        const settings = submitWith($form, [{ data: { list: ["x", "y"] }, traditional: true }]);

        assert.deepEqual(uploadBody(settings).getAll("list"), ["x", "y"]);
      });

      it("should send null extra values on the upload transport per jQuery version", function () {
        const $form = makeForm(
          '<form method="post" action="ajax/text.html"><input type="file" name="f"></form>'
        );
        selectFiles($form.find("input")[0], ["a.txt"]);

        const settings = submitWith($form, [{ data: { n: null } }]);

        assert.strictEqual(uploadBody(settings).get("n"), majorVersion() < 3 ? "null" : "");
      });

      it("should keep a caller contentType while sending a urlencoded body", function () {
        const $form = makeForm(
          '<form method="post" action="ajax/text.html"><input name="a" value="1"></form>'
        );

        const settings = submitWith($form, [{ contentType: "application/json", data: { b: 2 } }]);

        assert.strictEqual(settings.contentType, "application/json");
        assert.strictEqual(settings.data, "a=1&b=2");
      });

      it.fails("should send a query-string data option as its own fields", function () {
        const $form = makeForm('<form method="post" action="ajax/text.html"></form>');

        const settings = submitWith($form, [{ data: "x=1" }]);

        assert.strictEqual(settings.data, "x=1");
      });
    });

    describe("request url and body", function () {
      it("should encode spaces in the request body per jQuery version", function () {
        const $form = makeForm(
          '<form method="post" action="ajax/text.html"><input name="a" value="x y"></form>'
        );

        const settings = submitWith($form, [{}]);

        assert.strictEqual(settings.data, majorVersion() < 3 ? "a=x+y" : "a=x%20y");
      });

      it("should leave a bare ? when a GET form has no fields", function () {
        const $form = makeForm('<form method="get" action="ajax/text.html"></form>');

        const settings = submitWith($form, [{}]);

        assert.strictEqual(settings.url, absolute("ajax/text.html") + "?");
      });

      it("should leave a trailing & when a GET url with a query has no fields", function () {
        const $form = makeForm('<form method="get" action="ajax/text.html"></form>');

        const settings = submitWith($form, [{ url: "ajax/text.html?b=2" }]);

        assert.strictEqual(settings.url, "ajax/text.html?b=2&");
      });

      it("should pass the GET url with the query to the FormData transport", function () {
        const $form = makeForm(
          '<form method="get" action="ajax/text.html" enctype="multipart/form-data"><input name="a" value="1"></form>'
        );

        const settings = submitWith($form, [{}]);

        assert.ok(uploadBody(settings) instanceof FormData);
        assert.strictEqual(settings.url, absolute("ajax/text.html") + "?a=1");
      });

      it("should pass headers, timeout and beforeSend through to $.ajax", function () {
        const $form = makeForm('<form method="post" action="ajax/text.html"></form>');
        const beforeSend = function () {};

        const settings = submitWith($form, [
          { headers: { "X-Test": "1" }, timeout: 1234, beforeSend: beforeSend, cache: false },
        ]);

        assert.deepEqual(settings.headers, { "X-Test": "1" });
        assert.strictEqual(settings.timeout, 1234);
        assert.strictEqual(settings.beforeSend, beforeSend);
        assert.strictEqual(settings.cache, false);
      });

      it("should pass plugin-only options through to $.ajax", function () {
        const $form = makeForm('<form method="post" action="ajax/text.html"></form>');
        const $target = $("#targetDiv");
        const options = {
          target: $target,
          resetForm: true,
          clearForm: true,
          semantic: true,
          replaceTarget: true,
          data: { x: "1" },
        };

        const settings = submitWith($form, [options]);

        assert.strictEqual(settings.target, $target);
        assert.strictEqual(settings.resetForm, true);
        assert.strictEqual(settings.clearForm, true);
        assert.strictEqual(settings.semantic, true);
        assert.strictEqual(settings.replaceTarget, true);
        assert.deepEqual(settings.extraData, { x: "1" });
        assert.strictEqual(settings.iframeSrc, "about:blank");
      });

      it("should forward the filtering option", function () {
        const $form = makeForm(
          '<form method="post" action="ajax/text.html"><input name="a" value="1"><input name="b" value="2"></form>'
        );

        const settings = submitWith($form, [{ filtering: (el) => (el.name === "b" ? el : null) }]);

        assert.strictEqual(settings.data, "b=2");
      });
    });

    describe("several selected forms", function () {
      it("should trigger events on every selected form but submit the first form's fields", function () {
        const $first = makeForm(
          '<form method="post" action="ajax/text.html"><input name="a" value="1"></form>'
        );
        const $second = makeForm(
          '<form method="post" action="ajax/other.html"><input name="b" value="2"></form>'
        );
        const $both = $first.add($second);
        const seen = [];
        $both.on("form-pre-serialize form-submit-notify", function (event) {
          seen.push(event.type + ":" + $both.index(this));
        });
        let beforeSubmitForm;

        const settings = submitWith($both, [
          { beforeSubmit: (_a, form) => (beforeSubmitForm = form) },
        ]);

        assert.strictEqual(settings.data, "a=1");
        assert.strictEqual(settings.url, absolute("ajax/text.html"));
        assert.strictEqual(beforeSubmitForm, $both);
        assert.deepEqual(seen, [
          "form-pre-serialize:0",
          "form-pre-serialize:1",
          "form-submit-notify:0",
          "form-submit-notify:1",
        ]);
      });

      it("should store the jqXHR on every selected form", function () {
        const $both = makeForm(
          '<form method="post" action="ajax/text.html"></form><form method="post" action="ajax/text.html"></form>'
        );
        const jqXHR = { readyState: 1 };

        submitWith($both, [{}], () => jqXHR);

        assert.strictEqual($both.eq(0).data("jqxhr"), jqXHR);
        assert.strictEqual($both.eq(1).data("jqxhr"), jqXHR);
      });
    });

    describe("responses", function () {
      it("should not reset the form when the request fails", function () {
        const $form = makeForm(
          '<form method="post" action="ajax/text.html"><input name="a" value="1"></form>'
        );
        $form.find("input").val("changed");

        submitWith($form, [{ resetForm: true, error: () => {} }], (s) =>
          s.error({}, "error", "broken")
        );

        assert.strictEqual($form.find("input").val(), "changed");
      });

      it("should forward includeHidden to clearForm", function () {
        const $form = makeForm(
          '<form method="post" action="ajax/text.html"><input type="hidden" name="h" value="1"></form>'
        );

        submitWith($form, [{ clearForm: true, includeHidden: true }], (s) =>
          s.success("ok", "success", {})
        );

        assert.strictEqual($form.find("input").val(), "");
      });

      it("should ignore target when a dataType is given", function () {
        const $form = makeForm('<form method="post" action="ajax/text.html"></form>');
        const $target = $("#targetDiv").html("kept");
        const context = { name: "context" };
        const calls = [];
        const options = {
          target: $target,
          dataType: "text",
          context: context,
          success: function () {
            calls.push(this.name);
          },
        };

        submitWith($form, [options], (s) => s.success("new", "success", {}));

        assert.strictEqual($target.html(), "kept");
        assert.deepEqual(calls, ["context"]);
      });

      it("should resolve a target selector when the response arrives", function () {
        const $form = makeForm('<form method="post" action="ajax/text.html"></form>');
        const settings = submitWith($form, [{ target: ".late-target" }]);
        const $late = makeForm('<div class="late-target"></div>');

        settings.success("<b>late</b>", "success", {});

        assert.strictEqual($late.html(), "<b>late</b>");
      });

      it("should not insert an XML document into the target", function () {
        const $form = makeForm('<form method="post" action="ajax/text.html"></form>');
        const $target = $("#targetDiv").html("kept");
        const xml = new DOMParser().parseFromString("<root>x</root>", "application/xml");
        const successes = [];

        submitWith($form, [{ target: $target, success: (data) => successes.push(data) }], (s) =>
          s.success(xml, "success", {})
        );

        assert.strictEqual($target.html(), "kept");
        assert.deepEqual(successes, [xml]);
      });

      it("should call success once per target element with the response arguments and without the context", function () {
        const $form = makeForm('<form method="post" action="ajax/text.html"></form>');
        const $targets = makeForm('<div class="t"></div><div class="t"></div>');
        const xhr = { status: 200 };
        const calls = [];
        const options = {
          target: ".t",
          context: { name: "context" },
          success: function () {
            calls.push({ self: this, args: Array.from(arguments) });
          },
        };

        submitWith($form, [options], (s) => s.success("x", "success", xhr));

        assert.strictEqual(calls.length, 2);
        assert.strictEqual(calls[0].self, $targets[0]);
        assert.strictEqual(calls[1].self, $targets[1]);
        assert.deepEqual(calls[0].args, ["x", "success", xhr, $form]);
      });

      it("should throw when a success array entry is not a function", function () {
        const $form = makeForm('<form method="post" action="ajax/text.html"></form>');

        const run = () =>
          submitWith($form, [{ success: [function () {}, "not a function"] }], (s) =>
            s.success("ok", "success", {})
          );

        assert.throws(run, TypeError);
      });

      it("should apply dataFilter before inserting into the target", async function () {
        const $target = $("#targetDiv").empty();

        await new Promise(function (resolve) {
          $("#form3").ajaxSubmit({
            target: $target,
            dataFilter: () => "<b>filtered</b>",
            success: resolve,
          });
        });

        assert.strictEqual($target.html(), "<b>filtered</b>");
      });

      it("should call success with jQuery's settings object as this when no context is given", async function () {
        const $form = $("#form3");
        let notified;
        $form.one("form-submit-notify", (_event, _form, options) => (notified = options));

        const self = await new Promise(function (resolve) {
          $form.ajaxSubmit({
            success: function () {
              resolve(this);
            },
          });
        });

        assert.notStrictEqual(self, notified);
        assert.strictEqual(self.url, notified.url);
      });

      it.fails("should call success when the target matches no elements", function () {
        const $form = makeForm('<form method="post" action="ajax/text.html"></form>');
        let calls = 0;

        submitWith($form, [{ target: "#no-such-target", success: () => calls++ }], (s) =>
          s.success("x", "success", {})
        );

        assert.strictEqual(calls, 1);
      });

      it("should call every success callback when target is set and success is an array", function () {
        const $form = makeForm('<form method="post" action="ajax/text.html"></form>');
        $("#targetDiv").empty();
        const calls = [];

        submitWith(
          $form,
          [{ target: "#targetDiv", success: [() => calls.push(1), () => calls.push(2)] }],
          (s) => s.success("x", "success", {})
        );

        assert.deepEqual(calls, [1, 2]);
      });

      it("should call every error callback given as an array", function () {
        const $form = makeForm('<form method="post" action="ajax/text.html"></form>');
        const calls = [];

        submitWith($form, [{ error: [() => calls.push(1), () => calls.push(2)] }], (s) =>
          s.error({}, "error", "broken")
        );

        assert.deepEqual(calls, [1, 2]);
      });

      it("should call every complete callback given as an array", function () {
        const $form = makeForm('<form method="post" action="ajax/text.html"></form>');
        const calls = [];

        submitWith($form, [{ complete: [() => calls.push(1), () => calls.push(2)] }], (s) =>
          s.complete({}, "success")
        );

        assert.deepEqual(calls, [1, 2]);
      });

      it("should give every error and complete callback in an array the form when a request fails", async function () {
        const $form = $("#form3");
        const seen = [];
        const record = (name) =>
          function () {
            seen.push([name, arguments[arguments.length - 1]]);
          };

        await new Promise(function (resolve) {
          $form.ajaxSubmit({
            url: "ajax/404.html",
            error: [record("error1"), record("error2")],
            complete: [record("complete1"), record("complete2"), () => resolve()],
          });
        });

        assert.deepEqual(
          seen.map(([name]) => name),
          ["error1", "error2", "complete1", "complete2"]
        );
        seen.forEach(([name, $last]) => assert.strictEqual($last[0], $form[0], name));
      });

      it("should call every success callback once per target element when success is an array", function () {
        const $form = makeForm('<form method="post" action="ajax/text.html"></form>');
        const $targets = $('<div class="t"></div><div class="t"></div>').appendTo("#main");
        const calls = [];

        submitWith(
          $form,
          [
            {
              target: $targets,
              success: [
                function () {
                  calls.push([1, this]);
                },
                function () {
                  calls.push([2, this]);
                },
              ],
            },
          ],
          (s) => s.success("x", "success", {})
        );

        assert.deepEqual(calls, [
          [1, $targets[0]],
          [2, $targets[0]],
          [1, $targets[1]],
          [2, $targets[1]],
        ]);
      });
    });

    describe("after the request starts", function () {
      it("should notify with the final url and body", function () {
        const $form = makeForm(
          '<form method="get" action="ajax/text.html"><input name="a" value="1"></form>'
        );
        let notified;
        $form.on("form-submit-notify", (_event, _form, options) => (notified = options));

        const settings = submitWith($form, [{}]);

        assert.strictEqual(notified, settings);
        assert.strictEqual(notified.url, absolute("ajax/text.html") + "?a=1");
        assert.strictEqual(notified.data, null);
      });

      it("should store the beforeSend result per jQuery version and still notify when beforeSend returns false", function () {
        const $form = makeForm('<form method="post" action="ajax/text.html"></form>');
        let notified = false;
        $form.on("form-submit-notify", () => (notified = true));

        $form.ajaxSubmit({ beforeSend: () => false });

        const stored = $form.data("jqxhr");
        if (majorVersion() < 3) {
          assert.strictEqual(stored, false);
        } else {
          assert.strictEqual(typeof stored.abort, "function");
          assert.strictEqual(stored.statusText, "canceled");
        }
        assert.strictEqual(notified, true);
      });
    });

    describe("controls named like form members", function () {
      // jQuery 1.7.2's selector engine calls getAttribute on the form itself, so it cannot run there.
      it.skipIf(Number($.fn.jquery.split(".")[0]) < 3)(
        "should submit when a control named getAttribute shadows the form",
        function () {
          const $form = $(
            '<form action="ajax/text.html" method="post"><input name="getAttribute" value="x"></form>'
          ).appendTo("#main");

          const settings = captureAjaxOptions($form, {});

          assert.strictEqual(settings.data, "getAttribute=x");
          assert.strictEqual(settings.type, "post");
        }
      );

      // jQuery 3's selector engine calls getElementsByTagName on the form for the file input lookup.
      it.skipIf(Number($.fn.jquery.split(".")[0]) === 3)(
        "should submit semantically when a control named getElementsByTagName shadows the form",
        function () {
          const $form = $(
            buildForm('<input name="getElementsByTagName" value="x">', "ajax/text.html")
          );

          const settings = captureAjaxOptions($form, { semantic: true });

          assert.match(settings.url, /\?getElementsByTagName=x$/);
        }
      );

      it("should throw a clear error when a control named parentNode hides the form's parent", function () {
        const $form = $(formHidingParentNode());
        let settings;

        const submit = () => {
          settings = captureAjaxOptions($form, {});
        };

        assert.throws(submit, /control named "parentNode"/);
        assert.strictEqual(settings, undefined);
      }, 2000);

      it("should reset the form after success when a control named reset shadows the method", function () {
        const $form = $(
          '<form action="ajax/text.html"><input name="reset" value="default"></form>'
        ).appendTo("#main");
        $form.find("input").val("changed");

        captureAjaxOptions($form, { resetForm: true }, (settings) => settings.success("ok"));

        assert.strictEqual($form.find("input").val(), "default");
      });
    });

    describe("debug logging", function () {
      function countLogs(run) {
        const log = console.log;
        let count = 0;
        console.log = () => count++;

        try {
          run();
        } finally {
          console.log = log;
        }

        return count;
      }

      const vetoes = [
        [
          "form-pre-serialize",
          ($form) =>
            $form.on("form-pre-serialize", (_e, _f, _o, veto) => {
              veto.veto = true;
            }),
          {},
        ],
        ["beforeSerialize", () => {}, { beforeSerialize: () => false }],
        ["beforeSubmit", () => {}, { beforeSubmit: () => false }],
        [
          "form-submit-validate",
          ($form) =>
            $form.on("form-submit-validate", (_e, _a, _f, _o, veto) => {
              veto.veto = true;
            }),
          {},
        ],
      ];

      it("should have debug off by default", function () {
        const debug = $.fn.ajaxSubmit.debug;

        assert.strictEqual(debug, false);
      });

      it("should log nothing on a full submit or a parsed target response when debug is off", function () {
        const $form = makeForm('<form method="post" action="ajax/text.html"></form>');

        const count = countLogs(() =>
          submitWith($form, [{ target: "#targetDiv" }], (s) => s.success({}, "success", {}))
        );

        assert.strictEqual(count, 0);
      });

      vetoes.forEach(function ([label, arrange, options]) {
        it("should log nothing when " + label + " vetoes and debug is off", function () {
          const $form = makeForm('<form method="post" action="ajax/text.html"></form>');
          arrange($form);

          const count = countLogs(() => submitWith($form, [options]));

          assert.strictEqual(count, 0);
        });

        it("should log once when " + label + " vetoes and debug is on", function () {
          const $form = makeForm('<form method="post" action="ajax/text.html"></form>');
          arrange($form);
          $.fn.ajaxSubmit.debug = true;
          let count;

          try {
            count = countLogs(() => submitWith($form, [options]));
          } finally {
            $.fn.ajaxSubmit.debug = false;
          }

          assert.strictEqual(count, 1);
        });
      });

      it("should log once before the transport and once for a parsed target response when debug is on", function () {
        const $form = makeForm('<form method="post" action="ajax/text.html"></form>');
        $.fn.ajaxSubmit.debug = true;
        let settings;
        let counts;

        try {
          counts = [
            countLogs(() => (settings = submitWith($form, [{ target: "#targetDiv" }]))),
            countLogs(() => settings.success({}, "success", {})),
          ];
        } finally {
          $.fn.ajaxSubmit.debug = false;
        }

        assert.deepEqual(counts, [1, 1]);
      });
    });
  });
});
