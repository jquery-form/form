import { assertRealParent } from "./form-members.js";
import jQuery from "jquery";
import { log } from "./diagnostics.js";

// A Submission is one ajaxSubmit call once its vetoes have passed:
// { form, $form, fields, controls, options, method, traditional }. `options` is the object the
// callbacks and events receive; later steps change it in place.

/**
 * The submission steps. `feature` holds what the entry detected at load (fileapi, formdata), and
 * `forms` reads form attributes and attr2-style properties (attribute, property).
 */
export function createSubmission(feature, forms) {
  var $ = jQuery;

  function refuse(message) {
    log(message);

    return null;
  }

  // The options merged over the form's action, the method, and the ajax defaults.
  function withDefaults(form, options, method) {
    var action = options.url || forms.property(form, "action");
    var url = typeof action === "string" ? action.trim() : "";

    // clean url (don't include hash value); an action that is only a fragment means this page
    url = url.split("#")[0] || window.location.href.split("#")[0];
    // IE requires javascript:false in https, but this breaks chrome >83 and goes against spec.
    // Instead of using javascript:false always, let's only apply it for IE.
    var isMsie = /(MSIE|Trident)/.test(navigator.userAgent || "");
    var iframeSrc = isMsie && /^https/i.test(document.URL) ? "javascript:false" : "about:blank"; // eslint-disable-line no-script-url

    return $.extend(
      true,
      {
        url: url,
        success: $.ajaxSettings.success,
        type: method || $.ajaxSettings.type,
        iframeSrc: iframeSrc,
      },
      options
    );
  }

  // The data option, kept as extraData and encoded, or undefined without one.
  function extraQuery(fields, options, traditional) {
    if (!options.data) {
      return undefined;
    }

    var optionsData = typeof options.data === "function" ? options.data(fields) : options.data;

    options.extraData = optionsData;

    return $.param(optionsData, traditional);
  }

  // Puts the encoded fields in the url for a get, and in the data otherwise.
  function encode(options, q, qx) {
    if (qx) {
      q = q ? q + "&" + qx : qx;
    }

    if (options.type.toUpperCase() === "GET") {
      // the query goes before any fragment in the url option
      var hashAt = options.url.indexOf("#");
      var base = hashAt < 0 ? options.url : options.url.slice(0, hashAt);

      options.url =
        base + (base.indexOf("?") >= 0 ? "&" : "?") + q + options.url.slice(base.length);
      options.data = null; // data is null for 'get'
    } else {
      options.data = q; // data is the query string for 'post'
    }
  }

  // A callback option as a list: an array as given, one function, or none.
  function callbackList(callback) {
    if (Array.isArray(callback)) {
      return callback;
    }

    return callback ? [callback] : [];
  }

  // Calls each callback in order with the same this and arguments.
  function callEach(callbacks, context, args) {
    for (var i = 0; i < callbacks.length; i++) {
      callbacks[i].apply(context, args);
    }
  }

  /**
   * Resolves the options, serializes the form, and runs the vetoes: the Submission, or null when
   * an event or callback stopped it.
   */
  function prepare($set, options) {
    $set.each(function () {
      assertRealParent(this);
    });

    var form = $set[0];
    var method = options.method || options.type || forms.property(form, "method");

    options = withDefaults(form, options, method);

    // hook for manipulating the form data before it is extracted;
    // convenient for use with rich editors like tinyMCE or FCKEditor
    var veto = {};

    $set.trigger("form-pre-serialize", [$set, options, veto]);
    if (veto.veto) {
      return refuse("ajaxSubmit: submit vetoed via form-pre-serialize trigger");
    }

    // provide opportunity to alter form data before it is serialized
    if (options.beforeSerialize && options.beforeSerialize($set, options) === false) {
      return refuse("ajaxSubmit: submit aborted via beforeSerialize callback");
    }

    var traditional = options.traditional;

    if (typeof traditional === "undefined") {
      traditional = $.ajaxSettings.traditional;
    }

    var controls = [];
    var fields = $set.formToArray(options.semantic, controls, options.filtering);
    var qx = extraQuery(fields, options, traditional);

    // give pre-submit callback an opportunity to abort the submit
    if (options.beforeSubmit && options.beforeSubmit(fields, $set, options) === false) {
      return refuse("ajaxSubmit: submit aborted via beforeSubmit callback");
    }

    // fire vetoable 'validate' event
    $set.trigger("form-submit-validate", [fields, $set, options, veto]);
    if (veto.veto) {
      return refuse("ajaxSubmit: submit vetoed via form-submit-validate trigger");
    }

    encode(options, $.param(fields, traditional), qx);

    return {
      form: form,
      $form: $set,
      fields: fields,
      controls: controls,
      options: options,
      method: method,
      traditional: traditional,
    };
  }

  /**
   * Wraps success, error and complete (a function or an array of them, as $.ajax takes) so each
   * also receives the form, and adds the resetForm,
   * clearForm and target steps before the success callbacks.
   */
  function deliver(submission) {
    var $set = submission.$form;
    var options = submission.options;
    var callbacks = [];

    if (options.resetForm) {
      callbacks.push(function () {
        $set.resetForm();
      });
    }

    if (options.clearForm) {
      callbacks.push(function () {
        $set.clearForm(options.includeHidden);
      });
    }

    // perform a load on the target only if dataType is not provided
    if (!options.dataType && options.target) {
      var successes = callbackList(options.success);

      callbacks.push(function (data, textStatus, jqXHR) {
        var successArguments = arguments,
          fn = options.replaceTarget ? "replaceWith" : "html",
          $target = $(options.target);

        // Only a string response is inserted. jQuery has already parsed a JSON or XML response,
        // and inserting it would parse each of its strings as HTML.
        if (typeof data === "string") {
          $target[fn](data);
        } else {
          log("target: the response was parsed by jQuery, so it is not inserted");
        }

        $target.each(function () {
          callEach(successes, this, successArguments);
        });
      });
    } else {
      $.merge(callbacks, callbackList(options.success));
    }

    options.success = function (data, status, xhr) {
      // jQuery 1.4+ passes xhr as 3rd arg
      var context = options.context || this; // jQuery 1.4+ supports scope context

      for (var i = 0, max = callbacks.length; i < max; i++) {
        callbacks[i].apply(context, [data, status, xhr || $set, $set]);
      }
    };

    if (options.error) {
      var errors = callbackList(options.error);

      options.error = function (xhr, status, error) {
        callEach(errors, options.context || this, [xhr, status, error, $set]);
      };
    }

    if (options.complete) {
      var completes = callbackList(options.complete);

      options.complete = function (xhr, status) {
        callEach(completes, options.context || this, [xhr, status, $set]);
      };
    }
  }

  /**
   * The transport for a submission: "iframe" for files without the File API or when forced,
   * "formdata" for files with it, "ajax" otherwise.
   */
  function chooseTransport(submission) {
    var $set = submission.$form;
    var options = submission.options;

    // [value] (issue #113), also see comment:
    // https://github.com/malsup/form/commit/588306aedba1de01388032d5f42a60159eea9228#commitcomment-2180219
    var fileInputs = $("input[type=file]:enabled", $set).filter(function () {
      return $(this).val() !== "";
    });
    var hasFileInputs = fileInputs.length > 0;
    var mp = "multipart/form-data";
    var multipart =
      forms.attribute($set[0], "enctype") === mp || forms.attribute($set[0], "encoding") === mp;
    var fileAPI = feature.fileapi && feature.formdata;

    log("fileAPI :" + fileAPI);

    var shouldUseFrame = (hasFileInputs || multipart) && !fileAPI;

    // options.iframe allows user to force iframe mode
    // 06-NOV-09: now defaulting to iframe mode if file input is detected
    if (options.iframe !== false && (options.iframe || shouldUseFrame)) {
      return "iframe";
    }

    return (hasFileInputs || multipart) && fileAPI ? "formdata" : "ajax";
  }

  return { prepare: prepare, deliver: deliver, chooseTransport: chooseTransport };
}
