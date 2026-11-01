import {
  addCsrfField,
  addExtraInputs,
  addSubmitterFields,
  restoreAttributes,
  saveAttributes,
  setUploadAttributes,
  submitForm,
} from "./iframe-post.js";
import { closestByTag, formMember } from "./form-members.js";
import { getDoc, readResponse } from "./iframe-response.js";
import { createLifecycle } from "./iframe-lifecycle.js";
import jQuery from "jquery";
import { keepContext } from "./options.js";
import { log } from "./diagnostics.js";

// The iframe transport: posts the form itself into a hidden frame and reads the response from it,
// for file uploads without the File API or when the iframe option asks for it.
var $ = jQuery;

/**
 * The iframe send step. `hasProp` is what the entry detected at load; `forms.property` reads a
 * form property as attr2 does.
 */
export function createIframeTransport(hasProp, forms) {
  var CLIENT_TIMEOUT_ABORT = 1;
  var SERVER_ABORT = 2;

  // ensure that every serialized input is still enabled
  function enableControls(elements) {
    for (var i = 0; i < elements.length; i++) {
      var el = $(elements[i]);

      if (hasProp) {
        el.prop("disabled", false);
      } else {
        el.removeAttr("disabled");
      }
    }
  }

  // The frame the form posts into: the iframeTarget, named `id` when it has no name, or a new
  // hidden frame named `id`. Returns the frame and the name the form targets.
  function createFrame(s, id, ownerDocument) {
    var $io, n;

    if (s.iframeTarget) {
      $io = $(s.iframeTarget, ownerDocument);
      n = $io.attr("name");
      if (!n) {
        $io.attr("name", id);
      } else {
        id = n;
      }
    } else {
      var io = ownerDocument.createElement("iframe");

      io.setAttribute("name", id);
      io.setAttribute("src", s.iframeSrc);
      $io = $(io);
      $io.css({ position: "absolute", top: "-1000px", left: "-1000px" });
    }

    return { $io: $io, id: id };
  }

  // The frame hooks the lifecycle calls: stop a load in progress, and release after the upload.
  function frameHooks(s, $io) {
    return {
      stop: function () {
        try {
          // #214, #257
          if ($io[0].contentWindow.document.execCommand) {
            $io[0].contentWindow.document.execCommand("Stop");
          }
        } catch (ignore) {}

        $io.attr("src", s.iframeSrc); // abort op in progress
      },
      release: function () {
        if (!s.iframeTarget) {
          $io.remove();
        } else {
          // adding else to clean up existing iframe response.
          $io.attr("src", s.iframeSrc);
        }
      },
    };
  }

  function listen(io, cb) {
    if (io.attachEvent) {
      io.attachEvent("onload", cb);
    } else {
      io.addEventListener("load", cb, false);
    }
  }

  function unlisten(io, cb) {
    if (io.detachEvent) {
      io.detachEvent("onload", cb);
    } else {
      io.removeEventListener("load", cb, false);
    }
  }

  // private function for handling file uploads (hat tip to YAHOO!)
  function fileUploadIframe(submission) {
    var form = submission.form,
      method = submission.method;

    enableControls(submission.controls);

    var s = keepContext($.extend(true, {}, $.ajaxSettings, submission.options), [
      $.ajaxSettings,
      submission.options,
    ]);

    s.context = s.context || s;
    var ownerDocument = formMember(form, "ownerDocument");
    var $body = $(closestByTag(form, ["body"]));
    var frame = createFrame(s, "jqFormIO" + new Date().getTime(), ownerDocument);
    var $io = frame.$io,
      io = $io[0];
    var life = createLifecycle(s, frameHooks(s, $io));
    var domCheckCount = 50;

    if (!life.start()) {
      return life.deferred;
    }

    addSubmitterFields(s, form);
    addCsrfField(s, form, method, forms);

    // look for server aborts
    function checkState() {
      try {
        var state = getDoc(io).readyState;

        log("state = " + state);
        if (state && state.toLowerCase() === "uninitialized") {
          setTimeout(checkState, 50);
        }
      } catch (e) {
        log("Server abort: ", e, " (", e.name, ")");
        cb(SERVER_ABORT);
        life.stopTimer();
      }
    }

    // take a breath so that pending repaints get some cpu time before the upload starts
    function doSubmit() {
      var saved = saveAttributes(form);

      setUploadAttributes(form, frame.id, method, s, forms);

      // support timout
      life.startTimer(function () {
        cb(CLIENT_TIMEOUT_ABORT);
      });

      // add "extra" data to form if provided in options
      var extraInputs = [];

      try {
        addExtraInputs(form, ownerDocument, s.extraData, submission.traditional, extraInputs);

        if (!s.iframeTarget) {
          // add iframe to doc and submit the form
          $io.appendTo($body);
        }

        // A connected form posting into a frame outside the document opens a new window.
        var root = ownerDocument.documentElement;

        if (io && $.contains(root, form) && !$.contains(root, io)) {
          var notInDocument = "jquery.form: the upload frame is not in the document";

          life.abort(notInDocument, [life.xhr, "error", notInDocument], "error");

          return;
        }

        listen(io, cb);
        setTimeout(checkState, 15);
        submitForm(form);
      } finally {
        // reset attrs and remove "extra" input elements
        restoreAttributes(form, saved);
        $(extraInputs).remove();
      }
    }

    // Reads the next document by Opera's rules: false once the retries are used up.
    function retry() {
      if (--domCheckCount) {
        log("requeing onLoad callback, DOM not available");
        setTimeout(cb, 250);

        return true;
      }

      return false;
    }

    function cb(e) {
      if (life.done()) {
        return;
      }

      var doc = getDoc(io);

      if (!doc) {
        log("cannot access response document");
        e = SERVER_ABORT;
      }
      if (e === CLIENT_TIMEOUT_ABORT) {
        life.abort("timeout", [life.xhr, "timeout"]);

        return;
      }
      if (e === SERVER_ABORT) {
        life.abort("server abort", [life.xhr, "error", "server abort"]);

        return;
      }

      if (doc.location.href === s.iframeSrc) {
        // response not received yet
        return;
      }

      unlisten(io, cb);

      var result = readResponse(doc, life.xhr, s, retry);

      if (result) {
        life.settle(result);
      }
    }

    if (s.forceSync) {
      doSubmit();
    } else {
      setTimeout(doSubmit, 10); // this lets dom updates render
    }

    return life.deferred;
  }

  return function sendIframe(submission) {
    var jqxhr;

    // hack to fix Safari hang (thanks to Tim Molendijk for this)
    // see: http://groups.google.com/group/jquery-dev/browse_thread/thread/36395b7ab510dd5d
    if (submission.options.closeKeepAlive) {
      $.get(submission.options.closeKeepAlive, function () {
        jqxhr = fileUploadIframe(submission);
      });
    } else {
      jqxhr = fileUploadIframe(submission);
    }

    return jqxhr;
  };
}
