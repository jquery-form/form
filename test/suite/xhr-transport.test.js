import { assert, describe, it } from "vitest";
import { resetFixture, captureAjaxOptions, withAjaxStub } from "./helpers.js";

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
              progressListener({ lengthComputable: true, loaded: 0, position: 3, total: 4 });

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
  });
});
