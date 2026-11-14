// In-page side of the published-file tests: each page loads jQuery and the packed plugin through
// one loader, then calls published.ready with the jQuery that loader handed back and the value
// the plugin's module resolved to. The smoke checks run on that jQuery. Exposed as window.published.
(function () {
  var state = null;

  // Settles with the callbacks that ran and the data the server answered.
  function settle(run) {
    return new Promise(function (resolve) {
      var result = { calls: [] };
      run({
        success: function (data) {
          result.calls.push("success");
          result.data = data;
        },
        error: function (xhr, status, error) {
          result.calls.push("error");
          result.error = String(error || status);
        },
        complete: function () {
          result.calls.push("complete");
          setTimeout(function () {
            resolve(result);
          });
        },
      });
    });
  }

  function fixture(html) {
    var container = document.getElementById("fixture");
    container.innerHTML = html;
    return container.querySelector("form");
  }

  window.published = {
    ready: function (loader, $, value) {
      state = { loader: loader, $: $, value: value };
    },

    // Which jQuery the plugin landed on, and what the loader resolved the plugin to.
    describe: function () {
      var $ = state.$;
      var names = [
        "ajaxSubmit",
        "ajaxForm",
        "ajaxFormUnbind",
        "attr2",
        "formToArray",
        "formSerialize",
        "fieldSerialize",
        "fieldValue",
        "clearForm",
        "clearFields",
        "clearInputs",
        "resetForm",
        "enable",
        "selected",
      ];
      return {
        loader: state.loader,
        jquery: $.fn.jquery,
        missing: names.filter(function (name) {
          return typeof $.fn[name] !== "function";
        }),
        staticFieldValue: typeof $.fieldValue,
        debug: $.fn.ajaxSubmit.debug,
        value: state.value === $ ? "jQuery" : typeof state.value,
        global: window.jQuery === undefined ? "none" : window.jQuery === $ ? "same" : "other",
      };
    },

    // ajaxSubmit over XHR, posting a form urlencoded.
    xhr: function (action) {
      var form = fixture(
        '<form method="post"><input name="text" value="plain ü" />' +
          '<select name="pick"><option>a</option><option selected>b</option></select></form>'
      );
      form.setAttribute("action", action);
      return settle(function (callbacks) {
        state.$(form).ajaxSubmit(state.$.extend({ dataType: "json" }, callbacks));
      });
    },

    // ajaxForm with a file, through the iframe transport, submitted by a button click.
    upload: function (action) {
      var form = fixture(
        '<form method="post" enctype="multipart/form-data"><input name="text" value="plain" />' +
          '<input type="file" name="upload" />' +
          '<button type="submit" name="go" value="clicked">Go</button></form>'
      );
      form.setAttribute("action", action);
      var transfer = new DataTransfer();
      transfer.items.add(new File(["file bytes"], "a.txt", { type: "text/plain" }));
      form.querySelector("input[type=file]").files = transfer.files;
      return settle(function (callbacks) {
        state.$(form).ajaxForm(state.$.extend({ iframe: true, dataType: "json" }, callbacks));
        form.querySelector("button").click();
      });
    },
  };
})();
