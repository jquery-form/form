import { assert, describe, it } from "vitest";
import {
  resetFixture,
  captureAjaxOptions,
  withAjaxStub,
  withAjaxSettings,
  selectFiles,
  submitTransport,
} from "./helpers.js";

function makeForm(html) {
  return $(html).appendTo("#main");
}

// Appends a post form with a text control and a file input holding report.txt.
function uploadForm() {
  const $form = makeForm(
    '<form action="ajax/text.html" method="post">' +
      '<input name="title" value="quarterly report">' +
      '<input type="file" name="document">' +
      "</form>"
  );
  const file = selectFiles($form.find('[type="file"]')[0], ["report.txt"])[0];

  return { $form: $form, file: file };
}

// Returns the body the upload transport sets in its beforeSend.
function uploadBody(settings) {
  const received = {};
  settings.beforeSend({}, received);

  return received.data;
}

function withAjaxStubSync(stub, run) {
  const ajax = $.ajax;
  $.ajax = stub;

  try {
    run();
  } finally {
    $.ajax = ajax;
  }
}

// Calls `start(done)` with real requests and records what reached XMLHttpRequest until `done` runs.
async function recordRequest(start) {
  const proto = XMLHttpRequest.prototype;
  const native = { open: proto.open, setRequestHeader: proto.setRequestHeader, send: proto.send };
  const request = { headers: {}, sent: 0 };
  proto.open = function (method, url) {
    request.method = method;
    request.url = url;
    return native.open.apply(this, arguments);
  };
  proto.setRequestHeader = function (name, value) {
    request.headers[name] = value;
    return native.setRequestHeader.apply(this, arguments);
  };
  proto.send = function (body) {
    request.sent++;
    request.body = body;
    return native.send.apply(this, arguments);
  };

  try {
    await new Promise(function (resolve) {
      start(function () {
        resolve();
      });
    });
  } finally {
    Object.assign(proto, native);
  }

  return request;
}

// Calls `done` once the jqXHR stored on the form settles (at once when none was stored).
function settleStored($form, done) {
  const jqxhr = $form.data("jqxhr");
  if (jqxhr && jqxhr.always) {
    jqxhr.always(function () {
      done();
    });
  } else {
    done();
  }
}

const expectedOrder = [
  "form-pre-serialize",
  "beforeSerialize",
  "beforeSubmit",
  "form-submit-validate",
  "ajaxStart",
  "beforeSend",
  "ajaxSend",
  "form-submit-notify",
  "success",
  "ajaxSuccess",
  "complete",
  "ajaxComplete",
  "ajaxStop",
];

// Submits `$form` for real and returns the order of hooks, callbacks and global ajax events.
async function recordOrder($form, options) {
  const order = [];
  const record = function (name) {
    return function () {
      order.push(name);
    };
  };
  const globals = ["ajaxStart", "ajaxSend", "ajaxSuccess", "ajaxError", "ajaxComplete", "ajaxStop"];
  globals.forEach(function (name) {
    $(document).on(name + ".xhrorder", record(name));
  });
  ["form-pre-serialize", "form-submit-validate", "form-submit-notify"].forEach(function (name) {
    $form.one(name, record(name));
  });

  try {
    await new Promise(function (resolve) {
      $form.ajaxSubmit(
        $.extend({}, options, {
          dataType: "text",
          beforeSerialize: record("beforeSerialize"),
          beforeSubmit: record("beforeSubmit"),
          beforeSend: record("beforeSend"),
          success: record("success"),
          error: record("error"),
          complete: function () {
            order.push("complete");
            setTimeout(resolve, 0);
          },
        })
      );
    });
  } finally {
    $(document).off(".xhrorder");
  }

  return order;
}

// Starts an upload with uploadProgress through a stubbed $.ajax and a fake XHR with `upload`,
// and returns the progress listener the plugin registered.
async function progressListener($form, options) {
  let listener;

  await withAjaxSettings(
    {
      xhr: function () {
        return {
          upload: {
            addEventListener: function (_name, registered) {
              listener = registered;
            },
          },
        };
      },
    },
    async function () {
      withAjaxStubSync(
        function (settings) {
          settings.xhr();
          return {};
        },
        function () {
          $form.ajaxSubmit(options);
        }
      );
    }
  );

  return listener;
}

describe("form", function () {
  resetFixture();

  describe("ajaxSubmit", function () {
    describe("FormData uploads", function () {
      it("should default the upload type to POST when a control shadows the method", function () {
        const $form = $(
          '<form action="ajax/upload" enctype="multipart/form-data"><input name="method"></form>'
        ).appendTo("#main");

        const settings = captureAjaxOptions($form, {});

        assert.strictEqual(settings.type, "POST");
        assert.strictEqual(settings.contentType, false);
      });

      function appendUploadForm(attributes) {
        const $form = $(
          '<form action="ajax/upload" method="post">' +
            '<input name="title" value="quarterly report">' +
            '<input type="file" name="document">' +
            "</form>"
        ).attr(attributes || {});
        const transfer = new DataTransfer();
        const file = new File(["upload contents"], "report.txt", { type: "text/plain" });
        transfer.items.add(file);
        $form.find('[type="file"]')[0].files = transfer.files;
        $form.appendTo("#main");

        return { $form: $form, file: file };
      }

      it("should use FormData for a real selected file and preserve request settings", async function () {
        const upload = appendUploadForm();
        const context = { source: "upload test" };
        const seen = {};

        await withAjaxStub(
          function (settings) {
            seen.settings = settings;
            const requestSettings = { data: settings.data };
            settings.beforeSend.call(context, { readyState: 0 }, requestSettings);
            seen.data = requestSettings.data;
            return { readyState: 1 };
          },
          async function () {
            upload.$form.ajaxSubmit({
              method: "put",
              data: {
                metadata: { owner: "Ada Lovelace" },
                labels: ["urgent", "external"],
              },
              beforeSend: function (xhr, settings) {
                seen.beforeSend = { context: this, xhr: xhr, settings: settings };
              },
            });
            await Promise.resolve();

            assert.strictEqual(
              seen.settings.contentType,
              false,
              "lets the browser set content type"
            );
            assert.strictEqual(seen.settings.processData, false, "does not process FormData");
            assert.strictEqual(seen.settings.cache, false, "disables request caching");
            assert.strictEqual(seen.settings.type, "put", "uses the requested method");
            assert.strictEqual(seen.settings.data, null, "does not expose an interim request body");
            assert.ok(seen.data instanceof FormData, "sends FormData");
            assert.strictEqual(
              seen.data.get("title"),
              "quarterly report",
              "includes text controls"
            );
            assert.strictEqual(
              seen.data.get("document"),
              upload.file,
              "includes the selected File"
            );
            assert.strictEqual(
              seen.data.get("metadata[owner]"),
              "Ada Lovelace",
              "deeply serializes objects"
            );
            assert.deepEqual(
              seen.data.getAll("labels[]"),
              ["urgent", "external"],
              "serializes arrays"
            );
            assert.strictEqual(seen.beforeSend.context, context, "preserves callback context");
            assert.strictEqual(
              seen.beforeSend.settings.data,
              seen.data,
              "runs after assigning FormData"
            );
          }
        );
      });

      it("should select the FormData transport for a multipart form without a file", async function () {
        const $form = $(
          '<form action="ajax/upload" method="post" enctype="multipart/form-data">' +
            '<input name="title" value="multipart only">' +
            "</form>"
        ).appendTo("#main");
        let settings;
        let body;

        await withAjaxStub(
          function (options) {
            settings = options;
            const requestSettings = {};
            options.beforeSend({}, requestSettings);
            body = requestSettings.data;
            return {};
          },
          async function () {
            $form.ajaxSubmit();
            await Promise.resolve();

            assert.strictEqual(settings.contentType, false, "selects the upload request settings");
            assert.ok(body instanceof FormData, "builds FormData");
            assert.strictEqual(body.get("title"), "multipart only", "includes form controls");
          }
        );
      });

      // Submits a multipart form with one control through a stubbed $.ajax; returns the FormData.
      async function captureMultipartBody(options) {
        const $form = $(
          '<form action="ajax/upload" method="post" enctype="multipart/form-data">' +
            '<input name="title" value="t">' +
            "</form>"
        ).appendTo("#main");
        let body;

        await withAjaxStub(
          function (settings) {
            const requestSettings = {};
            settings.beforeSend({}, requestSettings);
            body = requestSettings.data;
            return {};
          },
          async function () {
            $form.ajaxSubmit(options);
            await Promise.resolve();
          }
        );

        return body;
      }

      it("should not add a field for an empty data object", async function () {
        const body = await captureMultipartBody({ data: {} });

        assert.deepEqual(Array.from(body.entries()), [["title", "t"]]);
      });

      it("should serialize extra data with the global traditional setting", async function () {
        const traditional = $.ajaxSettings.traditional;
        $.ajaxSettings.traditional = true;

        try {
          const body = await captureMultipartBody({ data: { labels: ["a", "b"] } });

          assert.deepEqual(body.getAll("labels"), ["a", "b"]);
        } finally {
          $.ajaxSettings.traditional = traditional;
        }
      });

      it("should send caller-provided FormData instead of generated form contents", async function () {
        const upload = appendUploadForm();
        const customData = new FormData();
        customData.append("replacement", "custom body");
        let body;

        await withAjaxStub(
          function (options) {
            const requestSettings = {};
            options.beforeSend({}, requestSettings);
            body = requestSettings.data;
            return {};
          },
          async function () {
            upload.$form.ajaxSubmit({ formData: customData });
            await Promise.resolve();

            assert.strictEqual(body, customData, "uses the provided object");
            assert.strictEqual(body.get("replacement"), "custom body", "preserves custom contents");
            assert.strictEqual(body.has("document"), false, "does not merge generated contents");
          }
        );
      });

      it("should report computable and noncomputable upload progress", async function () {
        const upload = appendUploadForm();
        const originalXhr = $.ajaxSettings.xhr;
        const progress = [];
        let progressListener;
        $.ajaxSettings.xhr = function () {
          return {
            upload: {
              addEventListener: function (name, listener) {
                assert.strictEqual(name, "progress", "subscribes to progress");
                progressListener = listener;
              },
            },
          };
        };

        try {
          await withAjaxStub(
            function (options) {
              options.xhr();
              return {};
            },
            async function () {
              upload.$form.ajaxSubmit({
                uploadProgress: function (event, position, total, percent) {
                  progress.push({
                    event: event,
                    position: position,
                    total: total,
                    percent: percent,
                  });
                },
              });
              await Promise.resolve();

              progressListener({ lengthComputable: true, loaded: 25, total: 40 });
              progressListener({ lengthComputable: false, loaded: 7, total: 0 });
              progressListener({ lengthComputable: true, position: 3, total: 4 });

              assert.deepEqual(
                progress.map(function (entry) {
                  return [entry.position, entry.total, entry.percent];
                }),
                [
                  [25, 40, 63],
                  [7, 0, 0],
                  [3, 4, 75],
                ]
              );
              assert.strictEqual(progress[0].event.loaded, 25, "passes the native event");
            }
          );
        } finally {
          $.ajaxSettings.xhr = originalXhr;
        }
      });

      it("should return an XHR when upload progress events are unavailable", async function () {
        const upload = appendUploadForm();
        const originalXhr = $.ajaxSettings.xhr;
        const xhr = { readyState: 0 };
        let createdXhr;
        $.ajaxSettings.xhr = function () {
          return xhr;
        };

        try {
          await withAjaxStub(
            function (options) {
              createdXhr = options.xhr();
              return {};
            },
            async function () {
              upload.$form.ajaxSubmit({ uploadProgress: function () {} });
              await Promise.resolve();

              assert.strictEqual(createdXhr, xhr, "returns the configured XHR");
            }
          );
        } finally {
          $.ajaxSettings.xhr = originalXhr;
        }
      });
    });

    describe("success without a transport xhr", function () {
      it("should load the target when no success callback is given", function () {
        const $form = $('<form action="ajax/text.html"></form>').appendTo("#main");
        const $target = $("<div></div>").appendTo("#main");

        captureAjaxOptions($form, { target: $target }, function (settings) {
          settings.success("<b>loaded</b>", "success");
        });

        assert.strictEqual($target.html(), "<b>loaded</b>");
      });

      it("should pass the form in place of a missing xhr", function () {
        const $form = $('<form action="ajax/text.html"></form>').appendTo("#main");
        let received;

        captureAjaxOptions(
          $form,
          {
            success: function (_data, _status, xhr) {
              received = xhr;
            },
          },
          function (settings) {
            settings.success("ok", "success");
          }
        );

        assert.strictEqual(received, $form);
      });
    });

    describe("transport choice", function () {
      it("should use the FormData transport when the form has only an encoding attribute of multipart/form-data", function () {
        const $form = makeForm('<form action="ajax/text.html" method="post"></form>');
        $form[0].setAttribute("encoding", "multipart/form-data");

        const result = submitTransport($form);

        assert.strictEqual(result.transport, "formdata");
      });

      it("should use the plain transport and send an empty value when the file input has no file", function () {
        const $form = makeForm(
          '<form action="ajax/text.html" method="post">' +
            '<input name="title" value="t"><input type="file" name="document">' +
            "</form>"
        );

        const result = submitTransport($form);

        assert.strictEqual(result.transport, "plain");
        assert.strictEqual(result.settings.data, "title=t&document=");
      });

      it("should use the plain transport and omit the file when the file input is disabled", function () {
        const upload = uploadForm();
        upload.$form.find('[type="file"]').prop("disabled", true);

        const result = submitTransport(upload.$form);

        assert.strictEqual(result.transport, "plain");
        assert.strictEqual(result.settings.data, $.param({ title: "quarterly report" }));
      });

      it("should use the FormData transport when a descendant file input belongs to another form", function () {
        makeForm('<form id="xhr-other-form"></form>');
        const upload = uploadForm();
        upload.$form.find('[type="file"]').attr("form", "xhr-other-form");

        const result = submitTransport(upload.$form);

        assert.strictEqual(result.transport, "formdata");
        assert.deepEqual(Array.from(uploadBody(result.settings).keys()), ["title"]);
      });

      it("should use the FormData transport when an unnamed file input has a file", function () {
        const upload = uploadForm();
        upload.$form.find('[type="file"]').removeAttr("name");

        const result = submitTransport(upload.$form);

        assert.strictEqual(result.transport, "formdata");
        assert.deepEqual(Array.from(uploadBody(result.settings).keys()), ["title"]);
      });

      it("should use the iframe transport when iframe is true and a file is selected", function () {
        const upload = uploadForm();

        const result = submitTransport(upload.$form, { iframe: true });

        assert.strictEqual(result.transport, "iframe");
      });

      it("should use the FormData transport when iframe is false and a file is selected", function () {
        const upload = uploadForm();

        const result = submitTransport(upload.$form, { iframe: false });

        assert.strictEqual(result.transport, "formdata");
      });

      [0, "", null, undefined].forEach(function (value) {
        it(
          "should choose the transport automatically when iframe is " + JSON.stringify(value),
          function () {
            const upload = uploadForm();
            const $plain = makeForm('<form action="ajax/text.html" method="post"></form>');

            const transports = [
              submitTransport(upload.$form, { iframe: value }).transport,
              submitTransport($plain, { iframe: value }).transport,
            ];

            assert.deepEqual(transports, ["formdata", "plain"]);
          }
        );
      });

      [1, "yes"].forEach(function (value) {
        it(
          "should force the iframe transport when iframe is " + JSON.stringify(value),
          function () {
            const $form = makeForm('<form action="ajax/text.html" method="post"></form>');

            const result = submitTransport($form, { iframe: value });

            assert.strictEqual(result.transport, "iframe");
          }
        );
      });

      it("should use the FormData transport when a later form in the selection has a file", function () {
        const $first = makeForm(
          '<form action="ajax/text.html" method="post"><input name="first" value="1"></form>'
        );
        const upload = uploadForm();

        const result = submitTransport($([$first[0], upload.$form[0]]));

        assert.strictEqual(result.transport, "formdata");
        assert.deepEqual(Array.from(uploadBody(result.settings).entries()), [["first", "1"]]);
      });

      it("should post a non-form element through FormData only when it contains a selected file", function () {
        const $div = $(
          '<div><input name="title" value="t"><input type="file" name="document"></div>'
        ).appendTo("#main");
        const before = submitTransport($div, { url: "ajax/text.html" });
        selectFiles($div.find('[type="file"]')[0], ["report.txt"]);

        const after = submitTransport($div, { url: "ajax/text.html" });

        assert.strictEqual(before.transport, "plain");
        assert.strictEqual(before.settings.type, $.ajaxSettings.type);
        assert.strictEqual(after.transport, "formdata");
        assert.strictEqual(after.settings.type, "POST");
        assert.strictEqual(
          after.settings.url,
          "ajax/text.html?" + $.param({ title: "t", document: "report.txt" })
        );
      });

      it("should upload a detached form through FormData", function () {
        const upload = uploadForm();
        upload.$form.detach();

        const result = submitTransport(upload.$form);

        assert.strictEqual(result.transport, "formdata");
        assert.strictEqual(uploadBody(result.settings).get("document"), upload.file);
      });

      it("should not log when debug is off and the FormData transport is chosen", function () {
        const upload = uploadForm();
        const log = console.log;
        let calls = 0;
        console.log = function () {
          calls++;
        };

        try {
          submitTransport(upload.$form);
        } finally {
          console.log = log;
        }

        assert.strictEqual(calls, 0);
      });

      it("should read the enctype attribute when controls are named enctype and encoding", function () {
        const controls = '<input name="enctype" value="x"><input name="encoding" value="y">';
        const $plain = makeForm(
          '<form action="ajax/text.html" method="post">' + controls + "</form>"
        );
        const $multipart = makeForm(
          '<form action="ajax/text.html" method="post" enctype="multipart/form-data">' +
            controls +
            "</form>"
        );

        const transports = [
          submitTransport($plain).transport,
          submitTransport($multipart).transport,
        ];

        assert.deepEqual(transports, ["plain", "formdata"]);
      });

      it("should use the FormData transport when the enctype is Multipart/Form-Data", function () {
        const $form = makeForm(
          '<form action="ajax/text.html" method="post" enctype="Multipart/Form-Data"></form>'
        );

        const result = submitTransport($form);

        assert.strictEqual(result.transport, "formdata");
      });

      it("should use the FormData transport when the enctype has surrounding spaces", function () {
        const $form = makeForm(
          '<form action="ajax/text.html" method="post" enctype=" multipart/form-data "></form>'
        );

        const result = submitTransport($form);

        assert.strictEqual(result.transport, "formdata");
      });

      it("should upload the file when the file input belongs to the form through the form attribute", function () {
        const $form = makeForm(
          '<form id="xhr-owner" action="ajax/text.html" method="post"><input name="title" value="t"></form>'
        );
        const $input = $('<input type="file" name="document" form="xhr-owner">').appendTo("#main");
        const files = selectFiles($input[0], ["report.txt"]);

        const result = submitTransport($form);

        assert.strictEqual(result.transport, "formdata");
        assert.strictEqual(uploadBody(result.settings).get("document"), files[0]);
      });

      it("should use the plain transport when the same form is submitted again after an iframe upload", async function () {
        const $form = makeForm(
          '<form action="ajax/iframe-text.html" method="post"><input name="title" value="t"></form>'
        );
        await new Promise(function (resolve) {
          $form.ajaxSubmit({
            iframe: true,
            forceSync: true,
            dataType: "text",
            complete: resolve,
          });
        });

        const result = submitTransport($form);

        assert.strictEqual(result.transport, "plain");
      });
    });

    describe("controls named like form members", function () {
      // jQuery 1.7.2's selector engine calls getAttribute on the form itself, so it cannot run there.
      it.skipIf(Number($.fn.jquery.split(".")[0]) < 3)(
        "should read a multipart enctype when a control named getAttribute shadows the form",
        function () {
          const $form = makeForm(
            '<form enctype="multipart/form-data" action="ajax/text.html" method="post"><input name="getAttribute"></form>'
          );

          const result = submitTransport($form, {});

          assert.strictEqual(result.transport, "formdata");
        }
      );
    });

    describe("plain transport", function () {
      it("should pass the options object given to beforeSubmit and form-submit-notify to $.ajax", function () {
        const $form = makeForm('<form action="ajax/text.html" method="post"></form>');
        const seen = {};
        $form.one("form-submit-notify", function (_event, _form, options) {
          seen.notify = options;
        });

        const settings = captureAjaxOptions($form, {
          beforeSubmit: function (_data, _form, options) {
            seen.beforeSubmit = options;
          },
        });

        assert.strictEqual(seen.beforeSubmit, settings);
        assert.strictEqual(seen.notify, settings);
      });

      it("should honor a type changed in beforeSubmit", function () {
        const $form = makeForm(
          '<form action="ajax/text.html" method="get"><input name="a" value="1"></form>'
        );

        const settings = captureAjaxOptions($form, {
          beforeSubmit: function (_data, _form, options) {
            options.type = "PUT";
          },
        });

        assert.strictEqual(settings.type, "PUT");
        assert.strictEqual(settings.data, "a=1");
      });

      it("should ignore formData, uploadProgress and closeKeepAlive on the plain transport", function () {
        const $form = makeForm(
          '<form action="ajax/text.html" method="post"><input name="a" value="1"></form>'
        );
        const body = new FormData();
        let progressCalls = 0;
        const calls = [];

        withAjaxStubSync(
          function (settings) {
            calls.push(settings);
            return {};
          },
          function () {
            $form.ajaxSubmit({
              formData: body,
              closeKeepAlive: "ajax/text.html?keepalive",
              uploadProgress: function () {
                progressCalls++;
              },
            });
          }
        );

        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0].data, "a=1");
        assert.strictEqual(typeof calls[0].xhr, "undefined");
        assert.strictEqual(progressCalls, 0);
      });

      it("should send jQuery's urlencoded Content-Type and X-Requested-With for a POST", async function () {
        const $form = makeForm(
          '<form action="ajax/text.html" method="post"><input name="a" value="1"></form>'
        );

        const request = await recordRequest(function (complete) {
          $form.ajaxSubmit({ complete: complete });
        });

        assert.strictEqual(
          request.headers["Content-Type"],
          "application/x-www-form-urlencoded; charset=UTF-8"
        );
        assert.strictEqual(request.headers["X-Requested-With"], "XMLHttpRequest");
        assert.strictEqual(request.body, "a=1");
      });

      it("should run hooks, callbacks and global ajax events in order on the plain transport", async function () {
        const $form = makeForm(
          '<form action="ajax/text.html" method="post"><input name="a" value="1"></form>'
        );

        const order = await recordOrder($form, {});

        assert.deepEqual(order, expectedOrder);
      });

      it("should fire no global ajax events when global is false", async function () {
        const $form = makeForm('<form action="ajax/text.html" method="post"></form>');
        const upload = uploadForm();

        const orders = [
          await recordOrder($form, { global: false }),
          await recordOrder(upload.$form, { global: false }),
        ];

        orders.forEach(function (order) {
          assert.deepEqual(
            order.filter(function (name) {
              return name.indexOf("ajax") === 0;
            }),
            []
          );
        });
      });

      it("should keep the previous jqXHR in data while $.ajax runs", function () {
        const $form = makeForm('<form action="ajax/text.html" method="post"></form>');
        const first = { request: 1 };
        const second = { request: 2 };
        let seen;
        $form.data("jqxhr", first);

        withAjaxStubSync(
          function () {
            seen = $form.data("jqxhr");
            return second;
          },
          function () {
            $form.ajaxSubmit();
          }
        );

        assert.strictEqual(seen, first);
        assert.strictEqual($form.data("jqxhr"), second);
      });
    });

    describe("callbacks on the FormData transport", function () {
      it("should call callbacks with the given context object on an upload", function () {
        const upload = uploadForm();
        const context = { name: "context" };
        let received;

        captureAjaxOptions(
          upload.$form,
          {
            context: context,
            success: function () {
              received = this;
            },
          },
          function (settings) {
            settings.success("ok", "success", {});
          }
        );

        assert.strictEqual(received, context);
      });

      it("should use the same this in beforeSend and success when context is a plain object", function () {
        const upload = uploadForm();
        const seen = {};

        captureAjaxOptions(
          upload.$form,
          {
            context: { name: "context" },
            beforeSend: function () {
              seen.beforeSend = this;
            },
            success: function () {
              seen.success = this;
            },
          },
          function (settings) {
            settings.beforeSend.call(settings.context, {}, {});
            settings.success("ok", "success", {});
          }
        );

        assert.strictEqual(seen.beforeSend, seen.success);
      });
    });

    describe("FormData request body", function () {
      it("should append an empty string when a multipart form has an empty file input", function () {
        const $form = makeForm(
          '<form action="ajax/text.html" method="post" enctype="multipart/form-data">' +
            '<input type="file" name="document">' +
            "</form>"
        );

        const body = uploadBody(captureAjaxOptions($form, {}));

        assert.deepEqual(Array.from(body.entries()), [["document", ""]]);
      });

      it("should append each file of a multiple file input", function () {
        const $form = makeForm(
          '<form action="ajax/text.html" method="post">' +
            '<input type="file" name="documents" multiple>' +
            "</form>"
        );
        const files = selectFiles($form.find("input")[0], ["a.txt", "b.txt"]);

        const body = uploadBody(captureAjaxOptions($form, {}));

        assert.deepEqual(body.getAll("documents"), files);
      });

      it("should send field array changes made in beforeSubmit", function () {
        const upload = uploadForm();

        const body = uploadBody(
          captureAjaxOptions(upload.$form, {
            beforeSubmit: function (data) {
              data.splice(0, 1);
              data.push({ name: "added", value: "x" });
            },
          })
        );

        assert.deepEqual(Array.from(body.keys()), ["document", "added"]);
      });

      it("should keep a literal plus sign in extra data", function () {
        const upload = uploadForm();

        const body = uploadBody(captureAjaxOptions(upload.$form, { data: { sum: "1+1 = 2" } }));

        assert.strictEqual(body.get("sum"), "1+1 = 2");
      });

      it("should throw a TypeError without a request when data contains a File", async function () {
        const upload = uploadForm();
        let calls = 0;
        let error;
        // $.param also calls the File's promise methods unbound; mark their rejections handled.
        const natives = {};
        ["arrayBuffer", "bytes", "text"].forEach(function (name) {
          if (Blob.prototype[name]) {
            natives[name] = Blob.prototype[name];
            Blob.prototype[name] = function () {
              const promise = natives[name].apply(this, arguments);
              promise.catch(function () {});
              return promise;
            };
          }
        });

        try {
          withAjaxStubSync(
            function () {
              calls++;
              return {};
            },
            function () {
              upload.$form.ajaxSubmit({ data: { extra: upload.file } });
            }
          );
        } catch (e) {
          error = e;
        } finally {
          Object.assign(Blob.prototype, natives);
        }

        assert.instanceOf(error, TypeError);
        assert.strictEqual(calls, 0);
      });

      it("should use the result of a data function as extra upload fields", function () {
        const upload = uploadForm();
        let received;

        const body = uploadBody(
          captureAjaxOptions(upload.$form, {
            data: function (fields) {
              received = fields.length;
              return { computed: "yes" };
            },
          })
        );

        assert.strictEqual(received, 2);
        assert.strictEqual(body.get("computed"), "yes");
      });

      it("should append an extraData option to the upload body", function () {
        const upload = uploadForm();

        const body = uploadBody(captureAjaxOptions(upload.$form, { extraData: { extra: "1" } }));

        assert.deepEqual(Array.from(body.keys()), ["title", "document", "extra"]);
      });

      it("should send inherited extra data properties on an upload", function () {
        const upload = uploadForm();
        const data = Object.create({ inherited: "yes" });
        data.own = "1";

        const body = uploadBody(captureAjaxOptions(upload.$form, { data: data }));

        assert.strictEqual(body.get("own"), "1");
        assert.strictEqual(body.get("inherited"), "yes");
      });

      it("should send a name/value extra data entry as bracketed fields on an upload", function () {
        const upload = uploadForm();

        const body = uploadBody(
          captureAjaxOptions(upload.$form, { data: { pair: { name: "n", value: "v" } } })
        );

        assert.deepEqual(Array.from(body.entries()).slice(2), [
          ["pair[name]", "n"],
          ["pair[value]", "v"],
        ]);
      });

      it("should not append extra data when formData is provided", function () {
        const upload = uploadForm();
        const custom = new FormData();
        custom.append("only", "this");

        const body = uploadBody(
          captureAjaxOptions(upload.$form, { formData: custom, data: { extra: "1" } })
        );

        assert.strictEqual(body, custom);
        assert.deepEqual(Array.from(body.keys()), ["only"]);
      });

      it("should send a copy of a plain-object formData as the body", function () {
        const upload = uploadForm();
        const custom = { only: "this" };

        const body = uploadBody(captureAjaxOptions(upload.$form, { formData: custom }));

        assert.notStrictEqual(body, custom);
        assert.deepEqual(body, custom);
      });

      it("should report null data to form-submit-notify for an upload", function () {
        const upload = uploadForm();
        let data;
        upload.$form.one("form-submit-notify", function (_event, _form, options) {
          data = options.data;
        });

        captureAjaxOptions(upload.$form, { data: { extra: "1" } });

        assert.strictEqual(data, null);
      });

      it("should send a query-string data option as its own fields on an upload", function () {
        const upload = uploadForm();

        const body = uploadBody(captureAjaxOptions(upload.$form, { data: "x=1&y=2" }));

        assert.deepEqual(Array.from(body.entries()).slice(2), [
          ["x", "1"],
          ["y", "2"],
        ]);
      });
      it("should decode each field of a query-string data option on an upload", function () {
        const upload = uploadForm();

        const body = uploadBody(
          captureAjaxOptions(upload.$form, { data: () => "a+b=c%26d&&flag&e=1=2" })
        );

        assert.deepEqual(Array.from(body.entries()).slice(2), [
          ["a b", "c&d"],
          ["flag", ""],
          ["e", "1=2"],
        ]);
      });
    });

    describe("requestFormat json with files", function () {
      it("should throw a clear error when a file is selected", function () {
        const upload = uploadForm();

        const run = () => upload.$form.ajaxSubmit({ requestFormat: "json" });

        assert.throws(
          run,
          Error,
          'jquery.form: requestFormat "json" cannot send files or use the iframe transport'
        );
      });
    });

    describe("FormData request settings", function () {
      it("should override contentType, processData and cache options for an upload", function () {
        const upload = uploadForm();

        const settings = captureAjaxOptions(upload.$form, {
          contentType: "text/plain",
          processData: true,
          cache: true,
        });

        assert.deepEqual(
          [settings.contentType, settings.processData, settings.cache],
          [false, false, false]
        );
      });

      it("should use the type option for an upload", function () {
        const upload = uploadForm();

        const settings = captureAjaxOptions(upload.$form, { type: "PUT" });

        assert.strictEqual(settings.type, "PUT");
      });

      it("should use the form method for an upload", function () {
        const upload = uploadForm();

        const settings = captureAjaxOptions(upload.$form, {});

        assert.strictEqual(settings.type, "post");
      });

      it("should upload with GET when the form has no method attribute", function () {
        const upload = uploadForm();
        upload.$form.removeAttr("method");

        const settings = captureAjaxOptions(upload.$form, {});

        assert.strictEqual(settings.type, "get");
      });

      it("should pass dataType, headers, timeout and other settings through to an upload", function () {
        const upload = uploadForm();
        const headers = { "X-Test": "1" };
        const xhrFields = { withCredentials: true };

        const settings = captureAjaxOptions(upload.$form, {
          url: "ajax/json.json",
          dataType: "json",
          headers: headers,
          timeout: 1234,
          xhrFields: xhrFields,
          global: false,
        });

        assert.deepEqual(
          [settings.url, settings.dataType, settings.headers, settings.timeout, settings.xhrFields],
          ["ajax/json.json", "json", headers, 1234, xhrFields]
        );
        assert.strictEqual(settings.global, false);
      });

      it("should let the browser set the multipart Content-Type and add no cache buster", async function () {
        const upload = uploadForm();

        const request = await recordRequest(function (complete) {
          upload.$form.ajaxSubmit({ complete: complete });
        });

        assert.strictEqual(request.method, "POST");
        assert.strictEqual(request.url.indexOf("_="), -1);
        assert.ok(request.body instanceof FormData);
        assert.notProperty(request.headers, "Content-Type");
        assert.strictEqual(request.headers["X-Requested-With"], "XMLHttpRequest");
      });

      it("should use a type changed in beforeSubmit for an upload", function () {
        const upload = uploadForm();

        const settings = captureAjaxOptions(upload.$form, {
          beforeSubmit: function (_data, _form, options) {
            options.type = "PUT";
          },
        });

        assert.strictEqual(settings.type, "PUT");
      });

      it("should send the file name instead of [object File] when uploading with GET", function () {
        const upload = uploadForm();
        upload.$form.attr("method", "get");

        const settings = captureAjaxOptions(upload.$form, {});

        assert.strictEqual(
          settings.url.split("?")[1],
          $.param({ title: "quarterly report", document: "report.txt" })
        );
      });
    });

    describe("upload progress", function () {
      it("should keep a custom xhr option when uploadProgress is absent", function () {
        const upload = uploadForm();
        const factory = function () {};

        const settings = captureAjaxOptions(upload.$form, { xhr: factory });

        assert.strictEqual(settings.xhr, factory);
      });

      it("should call uploadProgress with the options object as this", async function () {
        const upload = uploadForm();
        const seen = {};
        const listener = await progressListener(upload.$form, {
          beforeSubmit: function (_data, _form, options) {
            seen.options = options;
          },
          uploadProgress: function () {
            seen.context = this;
          },
        });

        listener({ lengthComputable: true, loaded: 1, total: 2 });

        assert.strictEqual(seen.context, seen.options);
      });

      it("should use the custom xhr option when uploadProgress is given", async function () {
        const upload = uploadForm();
        let calls = 0;

        await progressListener(upload.$form, {
          xhr: function () {
            calls++;
            return { upload: { addEventListener: function () {} } };
          },
          uploadProgress: function () {},
        });

        assert.strictEqual(calls, 1);
      });

      it("should report position 0 and percent 0 when the first progress event has loaded 0", async function () {
        const upload = uploadForm();
        let reported;
        const listener = await progressListener(upload.$form, {
          uploadProgress: function (_event, position, total, percent) {
            reported = [position, total, percent];
          },
        });

        listener({ lengthComputable: true, loaded: 0, total: 10 });

        assert.deepEqual(reported, [0, 10, 0]);
      });
    });

    describe("beforeSend and the jqXHR on uploads", function () {
      it("should call beforeSend with jQuery's settings as this on an upload", async function () {
        const upload = uploadForm();
        const seen = {};

        await recordRequest(function (complete) {
          upload.$form.ajaxSubmit({
            beforeSend: function (_xhr, settings) {
              seen.context = this;
              seen.settings = settings;
            },
            complete: complete,
          });
        });

        assert.strictEqual(seen.context, seen.settings);
        assert.ok(seen.settings.data instanceof FormData);
      });

      it("should wrap a global beforeSend setting on an upload", async function () {
        const upload = uploadForm();
        let body;

        await withAjaxSettings(
          {
            beforeSend: function (_xhr, settings) {
              body = settings.data;
            },
          },
          async function () {
            uploadBody(captureAjaxOptions(upload.$form, {}));
          }
        );

        assert.ok(body instanceof FormData);
      });

      it("should not send the upload when beforeSend aborts the jqXHR", async function () {
        const upload = uploadForm();

        const request = await recordRequest(function (complete) {
          upload.$form.ajaxSubmit({
            beforeSend: function (xhr) {
              xhr.abort();
            },
          });
          settleStored(upload.$form, complete);
        });

        assert.strictEqual(request.sent, 0);
      });

      it("should expose the FormData to ajaxSend handlers", async function () {
        const upload = uploadForm();
        let data;
        $(document).on("ajaxSend.xhrtest", function (_event, _xhr, settings) {
          data = settings.data;
        });

        try {
          await recordRequest(function (complete) {
            upload.$form.ajaxSubmit({ complete: complete });
          });
        } finally {
          $(document).off(".xhrtest");
        }

        assert.ok(data instanceof FormData);
      });

      it("should store the upload jqXHR whose done handlers get jQuery's arguments", async function () {
        const upload = uploadForm();
        let done;

        await recordRequest(function (complete) {
          upload.$form.ajaxSubmit({ dataType: "text", complete: complete });
          upload.$form.data("jqxhr").done(function () {
            done = Array.from(arguments);
          });
        });

        assert.strictEqual(done.length, 3);
        assert.strictEqual(done[2], upload.$form.data("jqxhr"));
      });

      it("should run hooks, callbacks and global ajax events in order on the FormData transport", async function () {
        const upload = uploadForm();

        const order = await recordOrder(upload.$form, {});

        assert.deepEqual(order, expectedOrder);
      });

      it("should leave the form unchanged and add no iframe after a FormData or plain submit", function () {
        const upload = uploadForm();
        const $plain = makeForm(
          '<form action="ajax/text.html" method="post"><input name="a" value="1"></form>'
        );
        const before = [upload.$form[0].outerHTML, $plain[0].outerHTML, $("iframe").length];

        captureAjaxOptions(upload.$form, {});
        captureAjaxOptions($plain, {});

        assert.deepEqual(
          [upload.$form[0].outerHTML, $plain[0].outerHTML, $("iframe").length],
          before
        );
      });

      it("should not send the upload when beforeSend returns false", async function () {
        const upload = uploadForm();

        const request = await recordRequest(function (complete) {
          upload.$form.ajaxSubmit({
            beforeSend: function () {
              return false;
            },
          });
          settleStored(upload.$form, complete);
        });

        assert.strictEqual(request.sent, 0);
      });
    });
  });
});
