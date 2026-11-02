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
import { keepContext, selectorOption } from "./options.js";
import { createLifecycle } from "./iframe-lifecycle.js";
import jQuery from "jquery";
import { log } from "./diagnostics.js";

// The iframe transport: posts the form itself into a hidden frame and reads the response from it,
// when the iframe option asks for it.
var $ = jQuery;

/**
 * The iframe send step. `forms.property` reads a form property, or the attribute when a control
 * shadows it.
 */
export function createIframeTransport(forms) {
  var CLIENT_TIMEOUT_ABORT = 1;
  var SERVER_ABORT = 2;
  // tells apart the frames of uploads that start in the same millisecond
  var frameCount = 0;

  // ensure that every serialized input is still enabled
  function enableControls(elements) {
    for (var i = 0; i < elements.length; i++) {
      $(elements[i]).prop("disabled", false);
    }
  }

  // Names the frame's window, when the page may: a cross-origin or sandboxed frame refuses.
  function nameWindow(frame, name) {
    try {
      if (frame.contentWindow) {
        frame.contentWindow.name = name;
      }
    } catch (ignore) {}
  }

  // The frame the form posts into: the iframeTarget, named `id` when it has no name, or a new
  // hidden frame named `id`. Returns the frame and the name the form targets.
  function createFrame(s, id, ownerDocument) {
    var $io, n;

    if (s.iframeTarget) {
      $io = selectorOption(s.iframeTarget, ownerDocument);
      n = $io.attr("name");
      if (!n) {
        $io.attr("name", id);
        // a frame already in the page keeps the browsing context name it was inserted with
        $io.each(function () {
          nameWindow(this, id);
        });
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
    var frame = createFrame(s, "jqFormIO" + new Date().getTime() + frameCount++, ownerDocument);
    var $io = frame.$io,
      io = $io[0];
    var life = createLifecycle(s, frameHooks(s, $io));

    if (!life.start()) {
      return life.deferred;
    }

    addSubmitterFields(s, form);
    addCsrfField(s, form, method, forms);

    // look for server aborts
    function checkState() {
      try {
        log("state = " + getDoc(io).readyState);
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

        io.addEventListener("load", cb, false);
        setTimeout(checkState, 15);
        submitForm(form);
      } finally {
        // reset attrs and remove "extra" input elements
        restoreAttributes(form, saved);
        $(extraInputs).remove();
      }
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

      io.removeEventListener("load", cb, false);
      life.settle(readResponse(doc, life.xhr, s));
    }

    // An exception while posting settles the upload with "error" and the exception.
    function post() {
      if (life.done()) {
        // aborted before the delayed post
        return;
      }

      try {
        doSubmit();
      } catch (err) {
        log("upload failed: ", err);
        life.fail(err);
      }
    }

    if (s.forceSync) {
      post();
    } else {
      setTimeout(post, 10); // this lets dom updates render
    }

    return life.deferred;
  }

  return fileUploadIframe;
}
