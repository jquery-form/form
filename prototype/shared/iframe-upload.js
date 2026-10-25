/* global $, describe, it */
// Runner-agnostic: plain describe/it globals and promise returns, so Mocha and Vitest both run it.
describe("when a form with a file input is submitted through the iframe transport", function () {
  it("should deliver the fixture response to the success callback", function () {
    var $form = $('<form action="/test/ajax/text.html" method="post" enctype="multipart/form-data">' +
      '<input type="file" name="upload"><input type="text" name="note" value="hi"></form>').appendTo("body");

    var result = new Promise(function (resolve, reject) {
      $form.ajaxSubmit({ iframe: true, success: resolve, error: function (xhr, status, err) { reject(err || status); } });
    });

    return result.then(function (data) {
      $form.remove();
      if (String(data).indexOf("Lorem ipsum") < 0) throw new Error("expected fixture text, got: " + data);
    });
  });

  it("should use FormData with XHR when iframe is not forced", function () {
    var $form = $('<form action="/test/ajax/json.json" method="post" enctype="multipart/form-data">' +
      '<input type="file" name="upload"></form>').appendTo("body");
    var transfer = new DataTransfer();
    transfer.items.add(new File(["hello"], "hello.txt", { type: "text/plain" }));
    $form.find("input")[0].files = transfer.files;
    var progressSeen = false;

    var result = new Promise(function (resolve, reject) {
      $form.ajaxSubmit({
        dataType: "json",
        uploadProgress: function () { progressSeen = true; },
        success: resolve,
        error: function (xhr, status, err) { reject(err || status); },
      });
    });

    return result.then(function (data) {
      $form.remove();
      if (!data || data.name !== "jquery-test") throw new Error("expected JSON fixture, got: " + JSON.stringify(data));
      if (!progressSeen) throw new Error("expected uploadProgress to fire");
    });
  });
});
