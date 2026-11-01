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
  // private function for handling file uploads (hat tip to YAHOO!)
  function fileUploadIframe(submission) {
    var elements = submission.controls,
      options = submission.options,
      method = submission.method,
      traditional = submission.traditional;
    var form = submission.form,
      el,
      i,
      s,
      g,
      id,
      $io,
      io,
      xhr,
      n,
      timeoutHandle,
      callbackProcessed;
    var deferred = $.Deferred();

    // #341
    deferred.abort = function (status) {
      xhr.abort(status);
    };

    // ensure that every serialized input is still enabled
    for (i = 0; i < elements.length; i++) {
      el = $(elements[i]);
      if (hasProp) {
        el.prop("disabled", false);
      } else {
        el.removeAttr("disabled");
      }
    }

    s = keepContext($.extend(true, {}, $.ajaxSettings, options), [$.ajaxSettings, options]);
    s.context = s.context || s;
    id = "jqFormIO" + new Date().getTime();
    var ownerDocument = formMember(form, "ownerDocument");
    var $body = $(closestByTag(form, ["body"]));

    if (s.iframeTarget) {
      $io = $(s.iframeTarget, ownerDocument);
      n = $io.attr("name");
      if (!n) {
        $io.attr("name", id);
      } else {
        id = n;
      }
    } else {
      io = ownerDocument.createElement("iframe");
      io.setAttribute("name", id);
      io.setAttribute("src", s.iframeSrc);
      $io = $(io);
      $io.css({ position: "absolute", top: "-1000px", left: "-1000px" });
    }
    io = $io[0];

    xhr = {
      // mock object
      aborted: 0,
      responseText: null,
      responseXML: null,
      status: 0,
      statusText: "n/a",
      getAllResponseHeaders: function () {},
      getResponseHeader: function () {},
      setRequestHeader: function () {},
      abort: function (status) {
        abortUpload(status, [xhr, "aborted", status]);
      },
    };

    // Completes an aborted upload once and rejects the Deferred with `rejection`.
    // `textStatus` replaces the default "timeout"/"aborted" text status.
    function abortUpload(status, rejection, textStatus) {
      var e = textStatus || (status === "timeout" ? "timeout" : "aborted");

      if (xhr.aborted || callbackProcessed) {
        return;
      }

      log("aborting upload... " + e);
      xhr.aborted = 1;

      try {
        // #214, #257
        if (io.contentWindow.document.execCommand) {
          io.contentWindow.document.execCommand("Stop");
        }
      } catch (ignore) {}

      $io.attr("src", s.iframeSrc); // abort op in progress
      xhr.error = e;
      if (s.error) {
        s.error.call(s.context, xhr, e, status);
      }
      deferred.reject.apply(deferred, rejection);

      if (g) {
        $.event.trigger("ajaxError", [xhr, s, e]);
      }

      complete(e);
    }

    // The steps every finished or aborted upload ends with, in $.ajax order.
    function complete(status) {
      if (g) {
        $.event.trigger("ajaxComplete", [xhr, s]);
      }

      if (g && !--$.active) {
        $.event.trigger("ajaxStop");
      }

      if (s.complete) {
        s.complete.call(s.context, xhr, status);
      }

      if (s.timeout) {
        clearTimeout(timeoutHandle);
      }

      // clean up
      setTimeout(function () {
        if (!s.iframeTarget) {
          $io.remove();
        } else {
          // adding else to clean up existing iframe response.
          $io.attr("src", s.iframeSrc);
        }
        xhr.responseXML = null;
      }, 100);
    }

    g = s.global;
    // trigger ajax global events so that activity/block indicators work like normal
    if (g && $.active++ === 0) {
      $.event.trigger("ajaxStart");
    }
    if (g) {
      $.event.trigger("ajaxSend", [xhr, s]);
    }

    if (s.beforeSend && s.beforeSend.call(s.context, xhr, s) === false) {
      if (s.global) {
        $.active--;
      }
      deferred.reject();

      return deferred;
    }

    if (xhr.aborted) {
      // abort() in beforeSend already rejected the Deferred
      return deferred;
    }

    addSubmitterFields(s, form);

    var CLIENT_TIMEOUT_ABORT = 1;
    var SERVER_ABORT = 2;

    addCsrfField(s, form, method, forms);

    // take a breath so that pending repaints get some cpu time before the upload starts
    function doSubmit() {
      var saved = saveAttributes(form);

      setUploadAttributes(form, id, method, s, forms);

      // support timout
      if (s.timeout) {
        timeoutHandle = setTimeout(function () {
          cb(CLIENT_TIMEOUT_ABORT);
        }, s.timeout);
      }

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
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
          }
          timeoutHandle = undefined;
        }
      }

      // add "extra" data to form if provided in options
      var extraInputs = [];

      try {
        addExtraInputs(form, ownerDocument, s.extraData, traditional, extraInputs);

        if (!s.iframeTarget) {
          // add iframe to doc and submit the form
          $io.appendTo($body);
        }

        // A connected form posting into a frame outside the document opens a new window.
        var root = ownerDocument.documentElement;

        if (io && $.contains(root, form) && !$.contains(root, io)) {
          var notInDocument = "jquery.form: the upload frame is not in the document";

          abortUpload(notInDocument, [xhr, "error", notInDocument], "error");

          return;
        }

        if (io.attachEvent) {
          io.attachEvent("onload", cb);
        } else {
          io.addEventListener("load", cb, false);
        }

        setTimeout(checkState, 15);

        submitForm(form);
      } finally {
        // reset attrs and remove "extra" input elements
        restoreAttributes(form, saved);
        $(extraInputs).remove();
      }
    }

    if (s.forceSync) {
      doSubmit();
    } else {
      setTimeout(doSubmit, 10); // this lets dom updates render
    }

    var doc,
      domCheckCount = 50;

    function cb(e) {
      if (xhr.aborted || callbackProcessed) {
        return;
      }

      doc = getDoc(io);
      if (!doc) {
        log("cannot access response document");
        e = SERVER_ABORT;
      }
      if (e === CLIENT_TIMEOUT_ABORT && xhr) {
        abortUpload("timeout", [xhr, "timeout"]);

        return;
      }
      if (e === SERVER_ABORT && xhr) {
        abortUpload("server abort", [xhr, "error", "server abort"]);

        return;
      }

      if (doc.location.href === s.iframeSrc) {
        // response not received yet
        return;
      }

      if (io.detachEvent) {
        io.detachEvent("onload", cb);
      } else {
        io.removeEventListener("load", cb, false);
      }

      var result = readResponse(doc, xhr, s, function () {
        if (--domCheckCount) {
          log("requeing onLoad callback, DOM not available");
          setTimeout(cb, 250);

          return true;
        }

        return false;
      });

      if (!result) {
        return;
      }

      var status = result.status,
        data = result.data,
        errMsg = result.errMsg;

      if (xhr.aborted) {
        // abort() completed the upload while its response was processed
        log("upload aborted");

        return;
      }

      // an emulated HTTP error status wins, as in $.ajax; a parse error is kept otherwise
      if (xhr.status && !((xhr.status >= 200 && xhr.status < 300) || xhr.status === 304)) {
        status = "error";
      }

      callbackProcessed = true;

      // ordering of these callbacks/triggers is odd, but that's how $.ajax does it
      if (status === "success") {
        s.success.call(s.context, data, "success", xhr);

        deferred.resolve(xhr.responseText, "success", xhr);

        if (g) {
          $.event.trigger("ajaxSuccess", [xhr, s]);
        }
      } else {
        if (typeof errMsg === "undefined") {
          errMsg = xhr.statusText;
        }
        if (s.error) {
          s.error.call(s.context, xhr, status, errMsg);
        }
        deferred.reject(xhr, "error", errMsg);
        if (g) {
          $.event.trigger("ajaxError", [xhr, s, errMsg]);
        }
      }

      complete(status);
    }

    return deferred;
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
