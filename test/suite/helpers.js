import { beforeAll, beforeEach } from "vitest";

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
