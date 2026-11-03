// In-page side of the end-to-end tests: builds forms, submits them natively and through the
// plugin, and applies the known differences (test/shared/oracle-forms.js). Exposed as window.e2e.
import { applyKnownDifferences, generateForm, isImage } from "/oracle-forms.js";

const $ = window.jQuery;
let current = null;

function fixture() {
  const container = document.getElementById("fixture");
  container.textContent = "";
  return container;
}

// Sets the form's attributes; a null value removes one.
function setAttributes(form, attributes) {
  Object.keys(attributes || {}).forEach(function (name) {
    if (attributes[name] === null) {
      form.removeAttribute(name);
    } else {
      form.setAttribute(name, attributes[name]);
    }
  });
}

function describeData(data) {
  if (data && typeof data === "object" && data.nodeType === 9) {
    return { xml: data.documentElement.nodeName, text: data.documentElement.textContent };
  }
  return data === undefined ? { undefined: true } : data;
}

// Differences that only show on the wire. `ctx.transport` is what the plugin sent:
// { plugin: "urlencoded" | "multipart", native: same, iframe: boolean }.
const E2E_DIFFERENCES = [
  {
    id: "FILES-MULTIPART",
    description:
      "a file input makes the plugin post multipart where a urlencoded form posts file names",
    normalize: (pair, ctx) => {
      if (ctx.transport.plugin !== "multipart" || ctx.transport.native !== "urlencoded") {
        return pair;
      }
      return {
        plugin: pair.plugin.map((e) => (e[1] === "file" ? [e[0], "text", e[2]] : e)),
        native: pair.native,
      };
    },
  },
];

window.e2e = {
  // A seeded form from the serialization oracle.
  generate(seed, attributes) {
    current = generateForm(seed, fixture());
    setAttributes(current.form, attributes);
    return {
      html: document.getElementById("fixture").innerHTML,
      hasFiles: !!document.querySelector("#fixture input[type=file]"),
      submitter: current.submitter ? current.submitter.outerHTML : null,
    };
  },

  // A hand-written form: `html` holds one form, `submitter` selects its submitter.
  build(html, attributes, submitter) {
    const container = fixture();
    container.innerHTML = html;
    const form = container.querySelector("form");
    setAttributes(form, attributes);
    current = {
      form: form,
      submitter: submitter ? container.querySelector(submitter) : null,
      outsideNames: [],
    };
  },

  // Adds files to a file input: [{ name, type, bytes }] with bytes as numbers.
  setFiles(selector, files) {
    const transfer = new DataTransfer();
    files.forEach(function (file) {
      transfer.items.add(new File([new Uint8Array(file.bytes)], file.name, { type: file.type }));
    });
    document.querySelector(selector).files = transfer.files;
  },

  // Submits the form natively into the named frame, with its submitter when it has one.
  nativeSubmit() {
    const form = current.form;
    const target = form.getAttribute("target");
    form.noValidate = true;
    form.setAttribute("target", "native-sink");
    if (current.submitter) {
      form.requestSubmit(current.submitter);
    } else {
      form.submit();
    }
    if (target === null) {
      form.removeAttribute("target");
    } else {
      form.setAttribute("target", target);
    }
  },

  // Submits the form with ajaxSubmit; resolves with the callbacks that ran and their arguments.
  pluginSubmit(options) {
    const form = current.form;
    const submitter = current.submitter;
    form.clk = submitter || undefined;
    form.clk_x = isImage(submitter) ? 0 : undefined;
    form.clk_y = isImage(submitter) ? 0 : undefined;
    return new Promise(function (resolve) {
      const result = { calls: [] };
      $(form).ajaxSubmit(
        $.extend({}, options, {
          success: function (data, status) {
            result.calls.push("success");
            result.data = describeData(data);
            result.status = status;
          },
          error: function (xhr, status, error) {
            result.calls.push("error");
            result.error = String(error);
            result.status = status;
            result.httpStatus = xhr.status;
            result.responseText = xhr.responseText;
          },
          complete: function () {
            result.calls.push("complete");
            setTimeout(function () {
              resolve(result);
            });
          },
        }),
      );
    });
  },

  // Applies the known differences to [name, kind, value] lists of the current form: the
  // end-to-end classes first, then the serialization oracle's.
  normalize(plugin, native, transport) {
    const ctx = {
      submitter: current.submitter,
      outsideNames: current.outsideNames,
      transport: transport,
    };
    let pair = { plugin: plugin, native: native };
    E2E_DIFFERENCES.forEach(function (known) {
      pair = known.normalize(pair, ctx);
    });
    return applyKnownDifferences(pair.plugin, pair.native, ctx);
  },
};
