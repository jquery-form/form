import { afterEach, beforeAll, beforeEach } from "vitest";
import { resetDeprecations } from "../../src/diagnostics.js";

// helper method
export var arrayCount = function (arr, key) {
  var count = 0;
  for (var i = 0; i < arr.length; i++) {
    if (arr[i].name === key) {
      count++;
    }
  }
  return count;
};

// helper method
export var arrayValue = function (arr, key) {
  for (var i = 0; i < arr.length; i++) {
    if (arr[i].name === key) {
      return arr[i].value;
    }
  }
  return undefined;
};

// Selects new text files named `names` in a file input and returns them.
export function selectFiles(input, names) {
  const transfer = new DataTransfer();
  names.forEach(function (name) {
    transfer.items.add(new File(["contents of " + name], name, { type: "text/plain" }));
  });
  input.files = transfer.files;

  return Array.prototype.slice.call(input.files);
}

var fixture;

// Restores the #main fixture before each test.
export function resetFixture() {
  beforeAll(function () {
    fixture = $("#main").html();
  });

  beforeEach(function () {
    $("#main").html(fixture);
  });
}

// Starts a submit via `trigger` (which must use `opts`) and resolves once the request settles.
// Resolves with what the callbacks saw, so the test can assert on it after the awaited act.
export function submitAndSettle(opts, trigger) {
  const seen = { beforeSubmit: null, success: null, error: null };

  return new Promise(function (resolve) {
    const userBeforeSubmit = opts.beforeSubmit;
    opts.beforeSubmit = function (data, $form) {
      seen.beforeSubmit = { data: data, $form: $form };
      return userBeforeSubmit ? userBeforeSubmit.apply(this, arguments) : undefined;
    };
    opts.success = function () {
      seen.success = Array.prototype.slice.call(arguments);
      resolve(seen);
    };
    opts.error = function () {
      seen.error = Array.prototype.slice.call(arguments);
      resolve(seen);
    };
    trigger();
  });
}

// Submits through a stubbed $.ajax and returns the settings it received.
export function captureAjaxOptions($form, options, respond) {
  const ajax = $.ajax;
  let settings;
  $.ajax = function (received) {
    settings = received;
    if (respond) {
      respond(received);
    }
    return {};
  };

  try {
    $form.ajaxSubmit(options);
  } finally {
    $.ajax = ajax;
  }

  return settings;
}

export function withUserAgent(userAgent, run) {
  Object.defineProperty(navigator, "userAgent", { configurable: true, value: userAgent });

  try {
    return run();
  } finally {
    delete navigator.userAgent;
  }
}

export function withDocumentUrl(url, run) {
  Object.defineProperty(document, "URL", { configurable: true, value: url });

  try {
    return run();
  } finally {
    delete document.URL;
  }
}

export async function withAjaxStub(stub, run) {
  const ajax = $.ajax;
  $.ajax = stub;

  try {
    return await run();
  } finally {
    $.ajax = ajax;
  }
}

// Runs `run` with `overrides` merged into $.ajaxSettings, then restores each key (or removes it).
export async function withAjaxSettings(overrides, run) {
  const saved = {};
  Object.keys(overrides).forEach(function (key) {
    saved[key] = Object.prototype.hasOwnProperty.call($.ajaxSettings, key)
      ? { value: $.ajaxSettings[key] }
      : null;
    $.ajaxSettings[key] = overrides[key];
  });

  try {
    return await run();
  } finally {
    Object.keys(saved).forEach(function (key) {
      if (saved[key]) {
        $.ajaxSettings[key] = saved[key].value;
      } else {
        delete $.ajaxSettings[key];
      }
    });
  }
}

// Submits through a stubbed $.ajax and names the transport ajaxSubmit chose: "formdata" or
// "plain" for the $.ajax paths, "iframe" when the plugin itself calls beforeSend (vetoed here, so
// nothing is posted), or "none". Returns { transport, settings }.
export function submitTransport($form, options) {
  const ajax = $.ajax;
  const result = { transport: "none", settings: undefined };
  $.ajax = function (settings) {
    result.settings = settings;
    result.transport =
      settings.contentType === false && settings.processData === false ? "formdata" : "plain";
    return {};
  };

  try {
    $form.ajaxSubmit(
      $.extend({ global: false }, options, {
        beforeSend: function () {
          result.transport = "iframe";
          return false;
        },
      })
    );
  } finally {
    $.ajax = ajax;
  }

  return result;
}

// Builds a form without jQuery's HTML parsing, which calls getElementsByTagName on the form and
// so cannot build one whose control shadows that method.
export function buildForm(innerHtml, action) {
  const form = document.createElement("form");
  form.innerHTML = innerHtml;
  if (action) {
    form.setAttribute("action", action);
  }

  return form;
}

// Builds a form whose control named parentNode hides the form's parentNode, without passing it
// through jQuery: jQuery's own parentNode walks would cycle between the form and the control.
export function formHidingParentNode(innerHtml) {
  const form = document.createElement("form");
  form.innerHTML = '<select name="parentNode"></select>' + (innerHtml || "");

  return form;
}

// Restores $.active and removes generated upload frames after each test, since some iframe exit
// paths never settle and would leak into the next test.
export function restoreAjaxState() {
  let active;

  beforeEach(function () {
    active = $.active;
  });

  afterEach(function () {
    $.active = active;
    $("iframe[name^=jqFormIO]").remove();
  });
}

// Runs `run` while recording uncaught window errors instead of failing the run with them. Resolves
// with what `run` returned; the errors array is passed to `run` so it can assert on them.
export async function withWindowErrors(run) {
  const errors = [];
  const record = function (event) {
    event.preventDefault();
    errors.push(event.error);
  };
  window.addEventListener("error", record);

  try {
    return await run(errors);
  } finally {
    window.removeEventListener("error", record);
  }
}

// Runs `run` with debug set as given and console.warn recorded; returns the warnings. The
// once-per-page record of deprecations is cleared before and after.
export function recordDeprecations(debug, run) {
  const warnings = [];
  const warn = console.warn;
  const log = console.log;
  console.warn = (text) => warnings.push(text);
  console.log = () => {};
  resetDeprecations();
  $.fn.ajaxSubmit.debug = debug;

  try {
    run();
  } finally {
    $.fn.ajaxSubmit.debug = false;
    console.warn = warn;
    console.log = log;
    resetDeprecations();
  }

  return warnings;
}
