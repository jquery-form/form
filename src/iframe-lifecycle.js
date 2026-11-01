import jQuery from "jquery";
import { log } from "./diagnostics.js";

// The iframe upload's lifecycle: the mock xhr and the Deferred, the global ajax events, the
// beforeSend veto, the timeout, abort and settling.
var $ = jQuery;

/**
 * Creates the lifecycle of one upload with the merged settings `s`. `frame.stop()` stops the
 * frame's load and `frame.release()` removes or resets the frame after the upload.
 */
export function createLifecycle(s, frame) {
  var g,
    timeoutHandle,
    callbackProcessed,
    deferred = $.Deferred();

  var xhr = {
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
      abort(status, [xhr, "aborted", status]);
    },
  };

  // #341
  deferred.abort = function (status) {
    xhr.abort(status);
  };

  function done() {
    return xhr.aborted || callbackProcessed;
  }

  // Completes an aborted upload once and rejects the Deferred with `rejection`.
  // `textStatus` replaces the default "timeout"/"aborted" text status.
  function abort(status, rejection, textStatus) {
    var e = textStatus || (status === "timeout" ? "timeout" : "aborted");

    if (done()) {
      return;
    }

    log("aborting upload... " + e);
    xhr.aborted = 1;
    frame.stop();
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

  // The global events that end every upload, cancelled ones included.
  function endGlobalEvents() {
    if (g) {
      $.event.trigger("ajaxComplete", [xhr, s]);
    }

    if (g && !--$.active) {
      $.event.trigger("ajaxStop");
    }
  }

  // The steps every finished or aborted upload ends with, in $.ajax order.
  function complete(status) {
    if (s.complete) {
      s.complete.call(s.context, xhr, status);
    }

    endGlobalEvents();
    clearTimeout(timeoutHandle);

    // clean up
    setTimeout(function () {
      frame.release();
      xhr.responseXML = null;
    }, 100);
  }

  // A beforeSend veto ends the upload as $.ajax cancels a request: no callbacks, the global
  // events end with ajaxError "canceled".
  function cancel() {
    if (done()) {
      return;
    }

    callbackProcessed = true;
    deferred.reject();
    if (g) {
      $.event.trigger("ajaxError", [xhr, s, "canceled"]);
    }
    endGlobalEvents();
  }

  // Fires the start events and beforeSend; false when the upload must not be posted.
  function start() {
    g = s.global;
    // trigger ajax global events so that activity/block indicators work like normal
    if (g && $.active++ === 0) {
      $.event.trigger("ajaxStart");
    }

    if (s.beforeSend && s.beforeSend.call(s.context, xhr, s) === false) {
      cancel();

      return false;
    }

    if (xhr.aborted) {
      // abort() in beforeSend already completed the upload
      return false;
    }

    if (g) {
      $.event.trigger("ajaxSend", [xhr, s]);
    }

    // an ajaxSend handler may abort too
    return !xhr.aborted;
  }

  // Settles the upload with the response reader's {status, data, errMsg}.
  function settle(result) {
    var status = result.status,
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
      s.success.call(s.context, result.data, "success", xhr);

      deferred.resolve(xhr.responseText, "success", xhr);

      if (g) {
        $.event.trigger("ajaxSuccess", [xhr, s, result.data]);
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

  return {
    xhr: xhr,
    deferred: deferred,
    start: start,
    done: done,
    abort: abort,
    settle: settle,
    // Runs `onTimeout` after s.timeout, when set.
    startTimer: function (onTimeout) {
      if (s.timeout) {
        timeoutHandle = setTimeout(onTimeout, s.timeout);
      }
    },
    stopTimer: function () {
      clearTimeout(timeoutHandle);
      timeoutHandle = undefined;
    },
  };
}
