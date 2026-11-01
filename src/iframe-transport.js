import { callFormMethod, closestByTag, formMember } from "./form-members.js";
import { getDoc, readResponse } from "./iframe-response.js";
import { deepSerialize } from "./xhr-transport.js";
import jQuery from "jquery";
import { keepContext } from "./options.js";
import { log } from "./diagnostics.js";

// The iframe transport: posts the form itself into a hidden frame and reads the response from it,
// for file uploads without the File API or when the iframe option asks for it.
var $ = jQuery;

// The form attributes an iframe upload changes while it posts.
var uploadAttributes = ["action", "target", "method", "enctype", "encoding"];

// Called through the prototype: an extraData key or a form field may be named hasOwnProperty.
var hasOwn = Object.prototype.hasOwnProperty;

function isGet(method) {
  return /^get$/i.test(method);
}

// Resolves both URLs through anchors, as jQuery does for crossDomain, so IE's anchor quirks
// apply to both sides of the comparison.
function isSameOrigin(url) {
  var origin = document.createElement("a");
  var target = document.createElement("a");

  origin.href = window.location.href;
  target.href = url;
  // IE fills in the host of a relative URL only once the resolved href is assigned back
  target.href = target.href; // eslint-disable-line no-self-assign

  return origin.protocol + "//" + origin.host === target.protocol + "//" + target.host;
}

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
      sub,
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

    // add submitting element to data if we know it
    sub = form.clk;
    if (sub) {
      n = sub.name;
      if (n && !sub.disabled) {
        s.extraData = s.extraData || {};
        s.extraData[n] = sub.value;
        if (sub.type === "image") {
          s.extraData[n + ".x"] = form.clk_x;
          s.extraData[n + ".y"] = form.clk_y;
        }
      }
    }

    var CLIENT_TIMEOUT_ABORT = 1;
    var SERVER_ABORT = 2;

    // Rails CSRF hack (thanks to Yvan Barthelemy); like jquery-ujs, only for the page's origin and
    // only when the form is posted, since a get form would put the token in the url
    var csrf_token = $("meta[name=csrf-token]").attr("content");
    var csrf_param = $("meta[name=csrf-param]").attr("content");
    var posts =
      !isGet(method) &&
      (!method || /post/i.test(method) || /post/i.test(forms.property(form, "method")));

    if (csrf_param && csrf_token && posts && isSameOrigin(s.url)) {
      s.extraData = s.extraData || {};
      s.extraData[csrf_param] = csrf_token;
    }

    function setFormAttribute(name, value) {
      callFormMethod(form, "setAttribute", name, value);
    }

    // take a breath so that pending repaints get some cpu time before the upload starts
    function doSubmit() {
      var mp = "multipart/form-data";
      // the raw attributes the upload changes, null when absent, to put back exactly (#380)
      var saved = {};

      $.each(uploadAttributes, function (i, name) {
        saved[name] = callFormMethod(form, "hasAttribute", name)
          ? callFormMethod(form, "getAttribute", name)
          : null;
      });

      // update form attrs in IE friendly way
      setFormAttribute("target", id);
      if (!method || /post/i.test(method)) {
        setFormAttribute("method", "POST");
      } else if (isGet(method) && !isGet(forms.property(form, "method"))) {
        // a form posts natively only with GET or POST; other verbs keep the form's own method
        setFormAttribute("method", "GET");
      }
      setFormAttribute("action", s.url);

      // ie borks in some cases when setting encoding
      if (!s.skipEncodingOverride && (!method || /post/i.test(method))) {
        setFormAttribute("encoding", mp);
        setFormAttribute("enctype", mp);
      }

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

      // Builds the input with DOM properties: a name is never parsed as HTML.
      function addHiddenInput(name, value) {
        var input = ownerDocument.createElement("input");

        input.type = "hidden";
        input.name = name;
        extraInputs.push($(input).val(value).appendTo(form)[0]);
      }

      try {
        if (s.extraData) {
          for (var n in s.extraData) {
            if (hasOwn.call(s.extraData, n)) {
              // if using the $.param format that allows for multiple values with the same name
              if (
                $.isPlainObject(s.extraData[n]) &&
                hasOwn.call(s.extraData[n], "name") &&
                hasOwn.call(s.extraData[n], "value")
              ) {
                addHiddenInput(s.extraData[n].name, s.extraData[n].value);
              } else {
                // arrays and objects become one field per value, as $.param sends them (#597)
                var single = {};

                single[n] = s.extraData[n];
                var fields = deepSerialize(single, traditional);

                for (var f = 0; f < fields.length; f++) {
                  addHiddenInput(fields[f][0], fields[f][1]);
                }
              }
            }
          }
        }

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

        try {
          form.submit();
        } catch (err) {
          // just in case form has element with name/id of 'submit'
          callFormMethod(form, "submit");
        }
      } finally {
        // reset attrs and remove "extra" input elements
        $.each(uploadAttributes, function (i, name) {
          if (saved[name] === null) {
            callFormMethod(form, "removeAttribute", name);
          } else {
            setFormAttribute(name, saved[name]);
          }
        });
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
