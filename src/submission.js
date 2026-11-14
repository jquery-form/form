import { deprecate, log } from "./diagnostics.js";
import { keepContext, selectorOption } from "./options.js";
import { urlencode, wellFormedData } from "./successful-controls.js";
import { assertRealParent } from "./form-members.js";
import jQuery from "jquery";

// A Submission is one ajaxSubmit call once its vetoes have passed:
// { form, $form, fields, controls, options, method, traditional }. `options` is the object the
// callbacks and events receive; later steps change it in place.

/**
 * The submission steps. `feature` holds what the entry detected at load (fileapi, formdata), and
 * `forms` reads form attributes and attr2-style properties (attribute, property), and
 * `serialization` collects the form's fields and controls.
 */
export function createSubmission(feature, forms, serialization) {
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

    var merged = $.extend(
      true,
      {
        url: url,
        success: $.ajaxSettings.success,
        type: method || $.ajaxSettings.type,
        iframeSrc: iframeSrc,
      },
      options
    );

    return keepContext(merged, [options]);
  }

  /**
   * The one method every transport sends, read after the hooks: `method` wins over `type`, and
   * `type` is set to it. Undefined when only the ajax default applies, so each transport keeps
   * its own default.
   */
  function resolveMethod(options, defaultType) {
    var resolved = options.method || options.type;

    options.type = resolved;

    return resolved === defaultType && !options.method ? undefined : resolved;
  }

  // The data option, kept as extraData and encoded, or undefined without one.
  function extraQuery(fields, options, traditional) {
    if (!options.data) {
      return undefined;
    }

    var optionsData = typeof options.data === "function" ? options.data(fields) : options.data;

    if (typeof optionsData === "string") {
      if (options.requestFormat === "json") {
        throw new Error(
          'jquery.form: requestFormat "json" needs object data; a string data option is a query string'
        );
      }

      // a query string: sent as-is when urlencoded, as its own fields otherwise
      options.extraData = queryPairs(optionsData);

      return optionsData;
    }

    options.extraData = optionsData;

    return $.param(wellFormedData(optionsData), traditional);
  }

  // Sets a key as an own data property, so a name like __proto__ is an ordinary key.
  function defineKey(object, key, value) {
    Object.defineProperty(object, key, {
      value: value,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }

  /**
   * requestFormat "json" (#545): the fields as an object (a repeated name gives an array), merged
   * with object data, sent as a JSON body. Based on the idea in PR #557 by zhangciwu.
   */
  function jsonBody(options, fields) {
    if (/^get$/i.test(options.type)) {
      throw new Error('jquery.form: requestFormat "json" needs a method with a body, such as POST');
    }

    var body = {};
    var own = Object.prototype.hasOwnProperty;

    for (var i = 0; i < fields.length; i++) {
      var name = fields[i].name;

      if (!own.call(body, name)) {
        defineKey(body, name, fields[i].value);
      } else if (Array.isArray(body[name])) {
        body[name].push(fields[i].value);
      } else {
        defineKey(body, name, [body[name], fields[i].value]);
      }
    }

    var extra = options.extraData;

    for (var key in extra) {
      if (own.call(extra, key)) {
        defineKey(body, key, extra[key]);
      }
    }

    options.data = JSON.stringify(body);
    options.contentType = "application/json; charset=UTF-8";
  }

  // The fields of a query string, as the { name, value } list $.param takes.
  function queryPairs(query) {
    var pairs = [];
    var parts = query.split("&");

    for (var i = 0; i < parts.length; i++) {
      if (parts[i]) {
        var at = parts[i].indexOf("=");
        var name = at < 0 ? parts[i] : parts[i].slice(0, at);
        var value = at < 0 ? "" : parts[i].slice(at + 1);

        pairs.push({ name: decodeQuery(name), value: decodeQuery(value) });
      }
    }

    return pairs;
  }

  function decodeQuery(text) {
    return decodeURIComponent(text.replace(/\+/g, " "));
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

    // the ajax default type, when neither the caller nor the form gave a method
    var defaultType = method ? undefined : options.type;

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

    var collected = serialization.collect($set[0], options.semantic, options.filtering);
    var fields = collected.fields;
    var controls = collected.controls;
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

    method = resolveMethod(options, defaultType);

    if (options.requestFormat === "json") {
      jsonBody(options, fields);
    } else {
      encode(options, urlencode(fields, traditional), qx);
    }

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
          $target = selectorOption(options.target);

        // Only a string response is inserted. jQuery has already parsed a JSON or XML response,
        // and inserting it would parse each of its strings as HTML.
        if (typeof data === "string") {
          $target[fn](data);
        } else {
          log("target: the response was parsed by jQuery, so it is not inserted");
        }

        if (!$target.length) {
          // nothing to fill: success still runs once, with the normal context
          callEach(successes, this, successArguments);
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
    // and the file inputs outside the form that belong to it through their form attribute
    var fileInputs = $("input[type=file]:enabled", $set)
      .add($(submission.controls).filter("input[type=file]"))
      .filter(function () {
        return $(this).val() !== "";
      });
    var hasFileInputs = fileInputs.length > 0;
    // compared as the browser does: ASCII case-insensitive, without surrounding whitespace
    var mp = /^[\t\n\f\r ]*multipart\/form-data[\t\n\f\r ]*$/i;
    var multipart =
      mp.test(forms.attribute($set[0], "enctype")) || mp.test(forms.attribute($set[0], "encoding"));
    var fileAPI = feature.fileapi && feature.formdata;

    log("fileAPI :" + fileAPI);

    var shouldUseFrame = (hasFileInputs || multipart) && !fileAPI;

    var transport = (hasFileInputs || multipart) && fileAPI ? "formdata" : "ajax";

    // options.iframe allows user to force iframe mode
    // 06-NOV-09: now defaulting to iframe mode if file input is detected
    if (options.iframe !== false && (options.iframe || shouldUseFrame)) {
      transport = "iframe";
    }

    if (transport === "iframe" && !options.iframe) {
      deprecate(
        "iframe",
        "choosing the iframe transport automatically without FormData is deprecated, set iframe: true"
      );
    }

    if (transport !== "ajax" && options.requestFormat === "json") {
      throw new Error(
        'jquery.form: requestFormat "json" cannot send files or use the iframe transport'
      );
    }

    return transport;
  }

  return { prepare: prepare, deliver: deliver, chooseTransport: chooseTransport };
}
