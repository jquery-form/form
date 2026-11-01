/*!
 * jQuery Form Plugin
 * version: 4.4.0
 * Requires jQuery v1.7.2 or later
 * Project repository: https://github.com/jquery-form/form

 * Copyright 2017 Kevin Morris
 * Copyright 2006 M. Alsup

 * Dual licensed under the LGPL-2.1+ or MIT licenses
 * https://github.com/jquery-form/form#license

 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 */

(function (factory) {
	if (typeof define === 'function' && define.amd) {
		// AMD. Register as an anonymous module.
		define(['jquery'], factory);
	} else if (typeof module === 'object' && module.exports) {
		// Node/CommonJS
		module.exports = function( root, jQuery ) {
			if (typeof jQuery === 'undefined') {
				// require('jQuery') returns a factory that requires window to build a jQuery instance, we normalize how we use modules
				// that require this pattern but the window provided is a noop if it's defined (how jquery works)
				if (typeof window !== 'undefined') {
					jQuery = require('jquery');
				}
				else {
					jQuery = require('jquery')(root);
				}
			}
			factory(jQuery);
			return jQuery;
		};
	} else {
		// Browser globals
		factory(jQuery);
	}

}(function (jQuery) {
	'use strict';
// Form members: the properties and methods the plugin reads or calls on a form. A control named
// like a member (elements, setAttribute) shadows that member on the form itself, so members are
// read through the DOM prototypes, which a control cannot shadow.

// The prototype chain of a form, nearest first. Looked up on every call: old browsers have no
// DOM prototypes, and tests remove them.
var owners = ["HTMLFormElement", "HTMLElement", "Element", "Node"];

// A form no control can shadow, for methods when the DOM has no prototypes to read them from.
var plainForm = document.createElement("form");

function findDescriptor(name) {
  for (var i = 0; i < owners.length; i++) {
    var owner = window[owners[i]];
    var descriptor = owner && Object.getOwnPropertyDescriptor(owner.prototype, name);

    if (descriptor) {
      return descriptor;
    }
  }

  return null;
}

/**
 * Reads a member of a form through its prototype getter.
 * Falls back to the plain property without DOM prototypes, or on an element the getter does not
 * accept (such as a fieldset for `elements`).
 */
function formMember(form, name) {
  var descriptor = findDescriptor(name);

  try {
    return descriptor.get.call(form);
  } catch (e) {
    return form[name];
  }
}

/**
 * Calls a method of a form through its prototype, or through an unshadowed form without DOM
 * prototypes.
 */
function callFormMethod(form, name) {
  var descriptor = findDescriptor(name);
  var method = descriptor ? descriptor.value : plainForm[name];

  return method.apply(form, Array.prototype.slice.call(arguments, 2));
}

// Nodes such as the document and text nodes have no tag name (#600).
function tagName(el) {
  var name = formMember(el, "tagName");

  return typeof name === "string" ? name.toLowerCase() : "";
}

// Elements only: the subject of formToArray may also be the document or a plain object.
function isElement(node) {
  return formMember(node, "nodeType") === 1;
}

// A control named parentNode makes every parentNode walk (jQuery's trigger and closest among
// them) cycle between the form and the control.
function assertRealParent(el) {
  if (el.parentNode !== formMember(el, "parentNode")) {
    throw new Error(
      'jquery.form: a form control named "parentNode" hides the form\'s parentNode; rename the control'
    );
  }
}

// The element itself or its nearest ancestor with one of the tag names, through the real tree.
function closestByTag(el, names) {
  for (var node = el; node; node = formMember(node, "parentNode")) {
    if (names.indexOf(tagName(node)) >= 0) {
      return node;
    }
  }

  return null;
}

// The submitter: the button that submitted a form, captured from ajaxForm's clicks. It is kept in
// a private store and cleared shortly after the click. The form's clk, clk_x and clk_y properties
// are still written for pages that read them, and read when the store has none.

var storeKey = "jqFormSubmitter";

// Writes a property on the form; a control with that name makes it read-only.
function setExpando(form, name, value) {
  try {
    form[name] = value;
  } catch (ignore) {
    // the control keeps the name; the store has the submitter
  }
}

// A property the page set on the form, never a control of the form with that name.
function expando(form, name) {
  var value = form[name];
  var els = formMember(form, "elements");

  return els && value && els.namedItem(name) === value ? undefined : value;
}

// Records a submitter for a form until the click window ends.
function record(form, el, x, y) {
  jQuery.data(form, storeKey, { el: el, x: x, y: y });
  setExpando(form, "clk", el);

  if (el.type === "image") {
    setExpando(form, "clk_x", x);
    setExpando(form, "clk_y", y);
  }

  // clear form vars
  setTimeout(function () {
    jQuery.data(form, storeKey, null);
    setExpando(form, "clk", null);
    setExpando(form, "clk_x", null);
    setExpando(form, "clk_y", null);
  }, 100);
}

// The clicked point of an image button, relative to the image.
function imagePoint(e, target) {
  if (typeof e.offsetX !== "undefined") {
    return [e.offsetX, e.offsetY];
  }

  if (typeof jQuery.fn.offset === "function") {
    var offset = jQuery(target).offset();

    return [e.pageX - offset.left, e.pageY - offset.top];
  }

  return [e.pageX - target.offsetLeft, e.pageY - target.offsetTop];
}

/**
 * Records the submit or image button a click event reached, for the form it belongs to.
 */
function captureSubmitter(e) {
  // the clicked control, or the button around the clicked content (ex: a span within a button)
  var target = closestByTag(e.target, ["button", "input"]);

  // the type property, unlike the attribute, is "submit" for a button without a type (#588)
  if (!target || (target.type !== "submit" && target.type !== "image")) {
    return;
  }

  var form = target.form;

  if (!form) {
    // a submit control that belongs to no form
    return;
  }

  var point = target.type === "image" ? imagePoint(e, target) : [];

  record(form, target, point[0], point[1]);
}

/**
 * Records the submitter a submit event names (SubmitEvent.submitter), when no click was captured.
 * An image submitter gets the point 0,0, as native submission sends it without a click.
 */
function captureEventSubmitter(e, form) {
  var el = e.originalEvent && e.originalEvent.submitter;

  if (el && !submitterOf(form)) {
    record(form, el, 0, 0);
  }
}

/**
 * The form's submitter as { el, x, y } (x and y for an image button), or null.
 */
function submitterOf(form) {
  if (!form) {
    return null;
  }

  var stored = jQuery.data(form, storeKey);

  if (stored) {
    return stored;
  }

  var el = expando(form, "clk");

  return el ? { el: el, x: expando(form, "clk_x"), y: expando(form, "clk_y") } : null;
}

/**
 * The submitter's fields for a post that adds them itself (the iframe upload), as name → value.
 */
function submitterFields(form) {
  var fields = {};
  var sub = submitterOf(form);
  var el = sub && sub.el;

  if (el && el.name && !el.disabled) {
    fields[el.name] = el.value;
    if (el.type === "image") {
      fields[el.name + ".x"] = sub.x;
      fields[el.name + ".y"] = sub.y;
    }
  }

  return fields;
}

/**
 * The form's submitter element, or null.
 */
function submitterElement(form) {
  var sub = submitterOf(form);

  return sub ? sub.el : null;
}

/**
 * An attribute of a form, or undefined when it is absent, as jQuery's attr returns it. The
 * subject may also be the document or a plain object, read through jQuery.
 */
function formAttribute(form, name) {
  if (!isElement(form)) {
    return jQuery(form).attr(name);
  }

  var value = callFormMethod(form, "getAttribute", name);

  return value === null ? undefined : value;
}

// Successful controls: which controls of a form are sent, and as which name/value fields
// (https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#constructing-the-form-data-set).

// Line breaks, sent as CRLF
var rLineBreak = /\r\n|\r|\n/g;
var rCR = /\r/g;

// Listed form elements that are never submitted.
var rUnsubmittable = /^(?:fieldset|object|output)$/;

/**
 * Whether a control or option is disabled, also through a disabled fieldset or optgroup. Without
 * selector matching, only its own disabled property is read.
 */
function isDisabled(el) {
  return typeof el.matches === "function" ? el.matches(":disabled") : !!el.disabled;
}

/**
 * The successful-control rule: whether a control is sent. `submitter` is the button that
 * submitted the control's form; other submit and image buttons of a form are not sent.
 */
function isSuccessful(el, submitter) {
  var t = el.type;

  if (!el.name || isDisabled(el) || t === "reset" || t === "button") {
    return false;
  }

  if (t === "checkbox" || t === "radio") {
    return !!el.checked;
  }

  if (t === "submit" || t === "image") {
    return !el.form || submitter === el;
  }

  return tagName(el) !== "select" || el.selectedIndex !== -1;
}

// The value of a select: the selected option's value for one, a list for several.
function selectValue(el) {
  var index = el.selectedIndex;

  if (index < 0) {
    return null;
  }

  var a = [],
    ops = el.options;
  var one = el.type === "select-one";
  var max = one ? index + 1 : ops.length;

  for (var i = one ? index : 0; i < max; i++) {
    var op = ops[i];

    if (op.selected && !isDisabled(op)) {
      var v = op.value;

      if (!v) {
        // extra pain for IE...
        v =
          op.attributes && op.attributes.value && !op.attributes.value.specified
            ? op.text
            : op.value;
      }

      if (one) {
        return v;
      }

      a.push(v);
    }
  }

  return a;
}

/**
 * The value of a control, whether or not it is successful: a list for a multiple select, null
 * for a select with nothing selected, otherwise a string with CRLF line breaks (a lone CR or LF
 * included).
 */
function valueOf(el) {
  if (tagName(el) === "select") {
    return selectValue(el);
  }

  var v = jQuery(el).val();
  var raw = el.value;

  // jQuery before 4.0 drops carriage returns from .val(); read them from the value itself
  if (typeof raw === "string" && raw.replace(rCR, "") === v) {
    v = raw;
  }

  return v.replace(rLineBreak, "\r\n");
}

/**
 * The fields as a urlencoded body sends them: a selected file as its name.
 */
function urlencodedFields(fields) {
  return jQuery.map(fields, function (field) {
    return field.type === "file" && typeof field.value !== "string"
      ? { name: field.name, value: field.value.name }
      : field;
  });
}

/**
 * The serialization steps. `feature` holds what the entry detected at load (fileapi).
 */
function createSuccessfulControls(feature) {
  var $ = jQuery;

  // #386; inputs that name the form in their form attribute, other than the candidates found.
  // A form only gets the ones it owns.
  function outsideControls(formId, els, owner) {
    // hat tip @thet; the id is compared, never built into a selector
    return $(":input[form]")
      .filter(function () {
        return (
          this.getAttribute("form") === formId &&
          (!owner || this.form === owner) &&
          $.inArray(this, els) < 0
        );
      })
      .get();
  }

  // A descendant of a form is a candidate unless it is a control another form owns.
  function ownedBy(els, owner) {
    return $.grep(els, function (el) {
      return typeof el.form === "undefined" || el.form === owner;
    });
  }

  /**
   * The candidate controls of a form, in order: its elements, or every descendant it owns in
   * semantic mode, then the outside controls it owns that name it.
   */
  function controlsOf(form, semantic) {
    var formId = formAttribute(form, "id");
    var els = formMember(form, "elements");

    if (semantic || typeof els === "undefined") {
      // the document is not an element; it has its own getElementsByTagName
      els = isElement(form)
        ? callFormMethod(form, "getElementsByTagName", "*")
        : form.getElementsByTagName("*");
    }

    els = $.makeArray(els);

    // the subject may also be a fieldset, the document or another container
    var owner = tagName(form) === "form" ? form : null;

    if (semantic && owner) {
      els = ownedBy(els, owner);
    }

    // FinesseRus: in non-IE browsers outside fields are already included in form.elements.
    if (formId && (semantic || /(Edge|Trident)\//.test(navigator.userAgent))) {
      els = els.concat(outsideControls(formId, els, owner));
    }

    return els;
  }

  // The fields of a control's value, or null when the control is not sent.
  function fieldsOf(el) {
    var n = el.name;
    // read at call time, so a page that replaces $.fieldValue changes what is sent
    var v = $.fieldValue(el, true);

    if (v && v.constructor === Array) {
      return $.map(v, function (value) {
        return { name: n, value: value };
      });
    }

    if (feature.fileapi && el.type === "file") {
      var files = el.files;

      // #180: an empty field when no file is selected
      return files.length
        ? $.map(files, function (file) {
            return { name: n, value: file, type: el.type };
          })
        : [{ name: n, value: "", type: el.type }];
    }

    if (v === null || typeof v === "undefined") {
      return null;
    }

    return [{ name: n, value: v, type: el.type, required: el.required }];
  }

  // The clicked image's value and coordinates.
  function imageFields(sub, input, type) {
    var n = input.name;
    var value = { name: n, value: $(input).val() };

    if (type) {
      value.type = type;
    }

    return [value, { name: n + ".x", value: sub.x }, { name: n + ".y", value: sub.y }];
  }

  // Adds one candidate control's fields, and the control when it has a value to send.
  function addCandidate(collected, form, el, semantic) {
    if (!el.name || isDisabled(el) || rUnsubmittable.test(tagName(el))) {
      return;
    }

    var sub = semantic && el.type === "image" && submitterOf(form);

    if (sub) {
      // handle image inputs on the fly when semantic == true
      if (sub.el === el) {
        collected.fields.push.apply(collected.fields, imageFields(sub, el, el.type));
      }

      return;
    }

    var own = fieldsOf(el);

    if (own) {
      collected.controls.push(el);
      collected.fields.push.apply(collected.fields, own);
    }
  }

  // input type=='image' are not found in elements array! handle it here
  function addClickedImage(collected, form) {
    var sub = submitterOf(form);
    var input = sub && $(sub.el)[0];

    if (input && input.name && !isDisabled(input) && input.type === "image") {
      collected.fields.push.apply(collected.fields, imageFields(sub, input));
    }
  }

  /**
   * The fields of a form, as formToArray returns them, and the controls they came from.
   */
  function collect(form, semantic, filtering) {
    var collected = { fields: [], controls: [] };

    if (!form) {
      return collected;
    }

    var els = controlsOf(form, semantic);

    if (typeof filtering === "function") {
      els = $.map(els, filtering);
    }

    for (var i = 0; i < els.length; i++) {
      addCandidate(collected, form, els[i], semantic);
    }

    if (!semantic) {
      addClickedImage(collected, form);
    }

    return collected;
  }

  return {
    controlsOf: controlsOf,
    fieldsOf: fieldsOf,
    collect: collect,
  };
}

// The arguments ajaxSubmit and ajaxForm accept in place of an options object.

/**
 * Turns the (url, data, dataType, success) shorthand into options. A url of false is kept as
 * the url; anything else is returned as given.
 */
function shorthandOptions(options, data, dataType, onSuccess) {
  if (typeof options !== "string" && options !== false) {
    return options;
  }

  var result = { url: options, data: data, dataType: dataType };

  if (typeof onSuccess === "function") {
    result.success = onSuccess;
  }

  return result;
}

// A copy of options without its url, so the form action is used.
function withoutUrl(options) {
  var result = {};

  for (var key in options) {
    if (key !== "url" && Object.prototype.hasOwnProperty.call(options, key)) {
      result[key] = options[key];
    }
  }

  return result;
}

/**
 * The options ajaxSubmit starts from: a function is the success callback, the shorthand is
 * expanded, and no options at all is an empty object. A url of false or "" means the form action.
 */
function submitOptions(options, data, dataType, onSuccess) {
  if (typeof options === "function") {
    return { success: options };
  }

  options = shorthandOptions(options, data, dataType, onSuccess);

  if (typeof options === "undefined") {
    return {};
  }

  return options.url === false || options.url === "" ? withoutUrl(options) : options;
}

/**
 * jQuery treats `context` as a flat option: after a deep merge, the settings get back the
 * caller's own object from the last source that has one, so `this` in callbacks is that object.
 */
function keepContext(settings, sources) {
  for (var i = 0; i < sources.length; i++) {
    if (sources[i].context !== undefined) {
      settings.context = sources[i].context;
    }
  }

  return settings;
}

// The XMLHttpRequest transports: $.ajax with the encoded fields, or FormData for file uploads.
var $$4 = jQuery;

// utility fn for deep serialization: [name, value] pairs, as $.param encodes them
function deepSerialize(extraData, traditional) {
  var param = $$4.param(extraData, traditional);
  var serialized = param ? param.split("&") : [];
  var len = serialized.length;
  var result = [];
  var i, part;

  for (i = 0; i < len; i++) {
    // #252; undo param space replacement
    serialized[i] = serialized[i].replace(/\+/g, " ");
    part = serialized[i].split("=");
    // #278; use array instead of object storage, favoring array serializations
    result.push([decodeURIComponent(part[0]), decodeURIComponent(part[1])]);
  }

  return result;
}

/**
 * Posts the fields and extraData as FormData, for files with the File API.
 * XMLHttpRequest Level 2 file uploads (big hat tip to francois2metz)
 */
function sendFormData(submission) {
  var options = submission.options;
  var a = submission.fields;

  var formdata = new FormData();

  for (var i = 0; i < a.length; i++) {
    formdata.append(a[i].name, a[i].value);
  }

  if (options.extraData) {
    var serializedData = deepSerialize(options.extraData, submission.traditional);

    for (i = 0; i < serializedData.length; i++) {
      formdata.append(serializedData[i][0], serializedData[i][1]);
    }
  }

  options.data = null;

  var s = $$4.extend(true, {}, $$4.ajaxSettings, options, {
    contentType: false,
    processData: false,
    cache: false,
    type: submission.method || "POST",
  });

  keepContext(s, [$$4.ajaxSettings, options]);

  if (options.uploadProgress) {
    // workaround because jqXHR does not expose upload property
    s.xhr = function () {
      var xhr = $$4.ajaxSettings.xhr();

      if (xhr.upload) {
        xhr.upload.addEventListener(
          "progress",
          function (event) {
            var percent = 0;
            var position = event.loaded || event.position; /* event.position is deprecated */
            var total = event.total;

            if (event.lengthComputable) {
              percent = Math.ceil((position / total) * 100);
            }

            options.uploadProgress(event, position, total, percent);
          },
          false
        );
      }

      return xhr;
    };
  }

  s.data = null;

  var beforeSend = s.beforeSend;

  s.beforeSend = function (xhr, o) {
    // Send FormData() provided by user
    if (options.formData) {
      o.data = options.formData;
    } else {
      o.data = formdata;
    }

    if (beforeSend) {
      beforeSend.call(this, xhr, o);
    }
  };

  return $$4.ajax(s);
}

/**
 * Sends the encoded fields with $.ajax.
 */
function sendAjax(submission) {
  return $$4.ajax(submission.options);
}

// The iframe form post: the extra fields (submitter, CSRF, data), the form attributes set while
// posting and restored after, and the native submit.
var $$3 = jQuery;

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

/** Adds the clicked submitter (and an image's coordinates) to s.extraData. */
function addSubmitterFields(s, form) {
  // add submitting element to data if we know it
  var fields = submitterFields(form);

  for (var n in fields) {
    s.extraData = s.extraData || {};
    s.extraData[n] = fields[n];
  }
}

/** Adds the page's CSRF token to s.extraData when the form is posted to the page's origin. */
function addCsrfField(s, form, method, forms) {
  // Rails CSRF hack (thanks to Yvan Barthelemy); like jquery-ujs, only for the page's origin and
  // only when the form is posted, since a get form would put the token in the url
  var csrf_token = $$3("meta[name=csrf-token]").attr("content");
  var csrf_param = $$3("meta[name=csrf-param]").attr("content");
  var posts =
    !isGet(method) &&
    (!method || /post/i.test(method) || /post/i.test(forms.property(form, "method")));

  if (csrf_param && csrf_token && posts && isSameOrigin(s.url)) {
    s.extraData = s.extraData || {};
    s.extraData[csrf_param] = csrf_token;
  }
}

function setFormAttribute(form, name, value) {
  callFormMethod(form, "setAttribute", name, value);
}

/** The raw attributes the upload changes, null when absent, to put back exactly (#380). */
function saveAttributes(form) {
  var saved = {};

  $$3.each(uploadAttributes, function (i, name) {
    saved[name] = callFormMethod(form, "hasAttribute", name)
      ? callFormMethod(form, "getAttribute", name)
      : null;
  });

  return saved;
}

/** Puts back the attributes saveAttributes recorded, removing those that were absent. */
function restoreAttributes(form, saved) {
  $$3.each(uploadAttributes, function (i, name) {
    if (saved[name] === null) {
      callFormMethod(form, "removeAttribute", name);
    } else {
      setFormAttribute(form, name, saved[name]);
    }
  });
}

/** Points the form at the frame `target` with the upload's url, method and encoding. */
function setUploadAttributes(form, target, method, s, forms) {
  var mp = "multipart/form-data";

  // update form attrs in IE friendly way
  setFormAttribute(form, "target", target);
  if (!method || /post/i.test(method)) {
    setFormAttribute(form, "method", "POST");
  } else if (isGet(method) && !isGet(forms.property(form, "method"))) {
    // a form posts natively only with GET or POST; other verbs keep the form's own method
    setFormAttribute(form, "method", "GET");
  }
  setFormAttribute(form, "action", s.url);

  // ie borks in some cases when setting encoding
  if (!s.skipEncodingOverride && (!method || /post/i.test(method))) {
    setFormAttribute(form, "encoding", mp);
    setFormAttribute(form, "enctype", mp);
  }
}

/** Appends a hidden input per extraData field to the form; each input is pushed onto `added`. */
function addExtraInputs(form, ownerDocument, extraData, traditional, added) {
  // Builds the input with DOM properties: a name is never parsed as HTML.
  function addHiddenInput(name, value) {
    var input = ownerDocument.createElement("input");

    input.type = "hidden";
    input.name = name;
    added.push($$3(input).val(value).appendTo(form)[0]);
  }

  if (extraData) {
    for (var n in extraData) {
      if (hasOwn.call(extraData, n)) {
        // if using the $.param format that allows for multiple values with the same name
        if (
          $$3.isPlainObject(extraData[n]) &&
          hasOwn.call(extraData[n], "name") &&
          hasOwn.call(extraData[n], "value")
        ) {
          addHiddenInput(extraData[n].name, extraData[n].value);
        } else {
          // arrays and objects become one field per value, as $.param sends them (#597)
          var single = {};

          single[n] = extraData[n];
          var fields = deepSerialize(single, traditional);

          for (var f = 0; f < fields.length; f++) {
            addHiddenInput(fields[f][0], fields[f][1]);
          }
        }
      }
    }
  }
}

/** Submits the form natively, even when a control named submit hides the method. */
function submitForm(form) {
  try {
    form.submit();
  } catch (err) {
    // just in case form has element with name/id of 'submit'
    callFormMethod(form, "submit");
  }
}

// Debug logging, switched on by $.fn.ajaxSubmit.debug. The flag is read on every call, so it can
// be turned on after the plugin loads.
function log() {
  if (!jQuery.fn.ajaxSubmit.debug) {
    return;
  }

  var msg = "[jquery.form] " + Array.prototype.join.call(arguments, "");

  if (window.console && window.console.log) {
    window.console.log(msg);
  } else if (window.opera && window.opera.postError) {
    window.opera.postError(msg);
  }
}

// The iframe response reader: turns the frame's document into the mock xhr's text, XML, status
// and dataType, then parses it as $.ajax would (dataFilter, JSON, script).
var $$2 = jQuery;

/** The frame's document, or null when the browser denies access to it. */
function getDoc(frame) {
  /* it looks like contentWindow or contentDocument do not
   * carry the protocol property in ie8, when running under ssl
   * frame.document is the only valid response document, since
   * the protocol is know but not on the other two objects. strange?
   * "Same origin policy" http://en.wikipedia.org/wiki/Same_origin_policy
   */

  var doc = null;

  // IE8 cascading access check
  try {
    if (frame.contentWindow) {
      doc = frame.contentWindow.document;
    }
  } catch (err) {
    // IE8 access denied under ssl & missing protocol
    log("cannot get iframe.contentWindow document: " + err);
  }

  if (doc) {
    // successful getting content
    return doc;
  }

  try {
    // simply checking may throw in ie8 under ssl or mismatched protocol
    doc = frame.contentDocument ? frame.contentDocument : frame.document;
  } catch (err) {
    // last attempt
    log("cannot get iframe.contentDocument: " + err);
    doc = frame.document;
  }

  return doc;
}

/** Parses the response text or XML for the given (lowercase) dataType. */
function httpData(xhr, type, s) {
  // mostly lifted from jq1.4.4

  var ct = xhr.getResponseHeader("content-type") || "",
    xml = (type === "xml" || !type) && ct.indexOf("xml") >= 0,
    data = xml ? xhr.responseXML : xhr.responseText;

  if (xml && data.documentElement.nodeName === "parsererror") {
    if ($$2.error) {
      $$2.error("parsererror");
    }
  }
  if (s && s.dataFilter) {
    data = s.dataFilter(data, type);
  }
  if (typeof data === "string") {
    if ((type === "json" || !type) && ct.indexOf("json") >= 0) {
      data = JSON.parse(data);
    } else if (type === "script") {
      $$2.globalEval(data);
    }
  }

  return data;
}

// Copies the status and statusText attributes of an element onto the mock xhr.
function readStatus(xhr, el) {
  // support for XHR 'status' & 'statusText' emulation :
  xhr.status = Number(el.getAttribute("status")) || xhr.status;
  xhr.statusText = el.getAttribute("statusText") || xhr.statusText;
}

// Fills the mock xhr from the document itself.
function readDocument(doc, xhr, s, isXml) {
  var docRoot = doc.body ? doc.body : doc.documentElement;

  xhr.responseText = docRoot ? docRoot.innerHTML : null;
  xhr.responseXML = doc.XMLDocument ? doc.XMLDocument : doc;
  if (isXml) {
    s.dataType = "xml";
  }
  xhr.getResponseHeader = function (header) {
    // the dataType in lowercase, as $.ajax reads it
    var headers = { "content-type": s.dataType && s.dataType.toLowerCase() };

    return headers[header.toLowerCase()];
  };
  if (docRoot) {
    readStatus(xhr, docRoot);
  }
}

// A response embedded in a textarea, or text wrapped in pre or body, replaces responseText.
function readEmbedded(doc, xhr, dt, s) {
  var scr = /(json|script|text)/.test(dt);

  if (!scr && !s.textarea) {
    return;
  }
  // see if user embedded response in textarea
  var ta = doc.getElementsByTagName("textarea")[0];

  if (ta) {
    xhr.responseText = ta.value;
    readStatus(xhr, ta);
  } else if (scr) {
    // account for browsers injecting pre around json response
    var pre = doc.getElementsByTagName("pre")[0];
    var b = doc.getElementsByTagName("body")[0];

    if (pre) {
      xhr.responseText = pre.textContent ? pre.textContent : pre.innerText;
    } else if (b) {
      xhr.responseText = b.textContent ? b.textContent : b.innerText;
    }
  }
}

/**
 * Reads and parses the response document into the mock xhr. Returns {status, data, errMsg}, or
 * null when `retry()` asks to read the document again later (Opera's untraversable DOM).
 */
function readResponse(doc, xhr, s, retry) {
  var status = "success",
    data,
    errMsg;

  try {
    var isXml = /^xml$/i.test(s.dataType) || doc.XMLDocument || $$2.isXMLDoc(doc);

    log("isXml=" + isXml);

    if (!isXml && window.opera && (doc.body === null || !doc.body.innerHTML)) {
      // in some browsers (Opera) the iframe DOM is not always traversable when
      // the onload callback fires, so we loop a bit to accommodate
      if (retry()) {
        return null;
      }
      // let this fall through because server response could be an empty document
    }

    readDocument(doc, xhr, s, isXml);

    var dt = (s.dataType || "").toLowerCase();

    readEmbedded(doc, xhr, dt, s);

    try {
      data = httpData(xhr, dt, s);
    } catch (err) {
      status = "parsererror";
      xhr.error = errMsg = err || status;
    }
  } catch (err) {
    log("error caught: ", err);
    status = "error";
    xhr.error = errMsg = err;
  }

  return { status: status, data: data, errMsg: errMsg };
}

// The iframe upload's lifecycle: the mock xhr and the Deferred, the global ajax events, the
// beforeSend veto, the timeout, abort and settling.
var $$1 = jQuery;

/**
 * Creates the lifecycle of one upload with the merged settings `s`. `frame.stop()` stops the
 * frame's load and `frame.release()` removes or resets the frame after the upload.
 */
function createLifecycle(s, frame) {
  var g,
    timeoutHandle,
    callbackProcessed,
    deferred = $$1.Deferred();

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
      $$1.event.trigger("ajaxError", [xhr, s, e]);
    }

    complete(e);
  }

  // The global events that end every upload, cancelled ones included.
  function endGlobalEvents() {
    if (g) {
      $$1.event.trigger("ajaxComplete", [xhr, s]);
    }

    if (g && !--$$1.active) {
      $$1.event.trigger("ajaxStop");
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
      $$1.event.trigger("ajaxError", [xhr, s, "canceled"]);
    }
    endGlobalEvents();
  }

  // Fires the start events and beforeSend; false when the upload must not be posted.
  function start() {
    g = s.global;
    // trigger ajax global events so that activity/block indicators work like normal
    if (g && $$1.active++ === 0) {
      $$1.event.trigger("ajaxStart");
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
      $$1.event.trigger("ajaxSend", [xhr, s]);
    }

    // an ajaxSend handler may abort too
    return !xhr.aborted;
  }

  // Resolves the upload; returns {error} when the success callback threw.
  function succeed(data) {
    var failure;

    try {
      s.success.call(s.context, data, "success", xhr);
    } catch (err) {
      failure = { error: err };
    }

    deferred.resolve(xhr.responseText, "success", xhr);

    if (g) {
      $$1.event.trigger("ajaxSuccess", [xhr, s, data]);
    }

    return failure;
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
      var failure = succeed(result.data);

      complete(status);
      if (failure) {
        // the upload is settled; the success callback's exception still reaches the console
        throw failure.error;
      }

      return;
    }

    if (typeof errMsg === "undefined") {
      errMsg = xhr.statusText;
    }
    if (s.error) {
      s.error.call(s.context, xhr, status, errMsg);
    }
    deferred.reject(xhr, "error", errMsg);
    if (g) {
      $$1.event.trigger("ajaxError", [xhr, s, errMsg]);
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
    // Settles an upload that failed with an exception (ignored once aborted).
    fail: function (err) {
      settle({ status: "error", errMsg: err });
    },
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

// The iframe transport: posts the form itself into a hidden frame and reads the response from it,
// for file uploads without the File API or when the iframe option asks for it.
var $ = jQuery;

/**
 * The iframe send step. `hasProp` is what the entry detected at load; `forms.property` reads a
 * form property as attr2 does.
 */
function createIframeTransport(hasProp, forms) {
  var CLIENT_TIMEOUT_ABORT = 1;
  var SERVER_ABORT = 2;
  // tells apart the frames of uploads that start in the same millisecond
  var frameCount = 0;

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
      $io = $(s.iframeTarget, ownerDocument);
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
    var frame = createFrame(s, "jqFormIO" + new Date().getTime() + frameCount++, ownerDocument);
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

// A Submission is one ajaxSubmit call once its vetoes have passed:
// { form, $form, fields, controls, options, method, traditional }. `options` is the object the
// callbacks and events receive; later steps change it in place.

/**
 * The submission steps. `feature` holds what the entry detected at load (fileapi, formdata), and
 * `forms` reads form attributes and attr2-style properties (attribute, property), and
 * `serialization` collects the form's fields and controls.
 */
function createSubmission(feature, forms, serialization) {
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

    return $.param(optionsData, traditional);
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
      encode(options, $.param(urlencodedFields(fields), traditional), qx);
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
          $target = $(options.target);

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
    var mp = "multipart/form-data";
    var multipart =
      forms.attribute($set[0], "enctype") === mp || forms.attribute($set[0], "encoding") === mp;
    var fileAPI = feature.fileapi && feature.formdata;

    log("fileAPI :" + fileAPI);

    var shouldUseFrame = (hasFileInputs || multipart) && !fileAPI;

    var transport = (hasFileInputs || multipart) && fileAPI ? "formdata" : "ajax";

    // options.iframe allows user to force iframe mode
    // 06-NOV-09: now defaulting to iframe mode if file input is detected
    if (options.iframe !== false && (options.iframe || shouldUseFrame)) {
      transport = "iframe";
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

(function ($) {

  /*
		Usage Note:
		-----------
		Do not use both ajaxSubmit and ajaxForm on the same form. These
		functions are mutually exclusive. Use ajaxSubmit if you want
		to bind your own submit handler to the form. For example,

		$(document).ready(function() {
			$('#myForm').on('submit', function(e) {
				e.preventDefault(); // <-- important
				$(this).ajaxSubmit({
					target: '#output'
				});
			});
		});

		Use ajaxForm when you want the plugin to manage all the event binding
		for you. For example,

		$(document).ready(function() {
			$('#myForm').ajaxForm({
				target: '#output'
			});
		});

		You can also use ajaxForm with delegation (requires jQuery v1.7+), so the
		form does not have to exist when you invoke ajaxForm:

		$('#myForm').ajaxForm({
			delegation: true,
			target: '#output'
		});

		When using ajaxForm, the ajaxSubmit function will be invoked for you
		at the appropriate time.
	*/

  /**
   * Feature detection
   */
  var feature = {};

  feature.fileapi = $('<input type="file">').get(0).files !== undefined;
  feature.formdata = typeof window.FormData !== "undefined";

  var hasProp = !!$.fn.prop;
  // What attr2 returns for a form: the property when it is a string, otherwise the attribute. The
  // property is read plainly on purpose: a control named like it shadows it, and then the raw
  // attribute is used.
  function formProperty(form, name) {
    var value = hasProp ? form[name] : undefined;

    return typeof value === "string" ? value : formAttribute(form, name);
  }

  var forms = { attribute: formAttribute, property: formProperty };
  var serialization = createSuccessfulControls(feature);
  var steps = createSubmission(feature, forms, serialization);
  var transports = {
    iframe: createIframeTransport(hasProp, forms),
    formdata: sendFormData,
    ajax: sendAjax,
  };

  // attr2 uses prop when it can but checks the return type for
  // an expected string. This accounts for the case where a form
  // contains inputs with names like "action" or "method"; in those
  // cases "prop" returns the element
  $.fn.attr2 = function () {
    if (!hasProp) {
      return this.attr.apply(this, arguments);
    }

    var val = this.prop.apply(this, arguments);

    if ((val && val.jquery) || typeof val === "string") {
      return val;
    }

    return this.attr.apply(this, arguments);
  };

  /**
   * ajaxSubmit() provides a mechanism for immediately submitting
   * an HTML form using AJAX.
   *
   * @param	{object|string}	options		jquery.form.js parameters or custom url for submission
   * @param	{object}		data		extraData
   * @param	{string}		dataType	ajax dataType
   * @param	{function}		onSuccess	ajax success callback function
   */
  $.fn.ajaxSubmit = function (options, data, dataType, onSuccess) {
    // fast fail if nothing selected (http://dev.jquery.com/ticket/2752)
    if (!this.length) {
      log("ajaxSubmit: skipping submit process - no element selected");

      return this;
    }

    // #541: jQuery's slim build has no $.ajax
    if (!$.ajax) {
      throw new Error(
        "jquery.form: ajaxSubmit needs the full jQuery build; this jQuery has no $.ajax"
      );
    }

    var submission = steps.prepare(this, submitOptions(options, data, dataType, onSuccess));

    if (!submission) {
      return this;
    }

    steps.deliver(submission);

    var jqxhr = transports[steps.chooseTransport(submission)](submission);

    this.removeData("jqxhr").data("jqxhr", jqxhr);

    // clear element array
    for (var k = 0; k < submission.controls.length; k++) {
      submission.controls[k] = null;
    }

    // fire 'notify' event
    this.trigger("form-submit-notify", [this, submission.options]);

    return this;
  };

  /**
   * ajaxForm() provides a mechanism for fully automating form submission.
   *
   * The advantages of using this method instead of ajaxSubmit() are:
   *
   * 1: This method will include coordinates for <input type="image"> elements (if the element
   *	is used to submit the form).
   * 2. This method will include the submit element's name/value data (for the element that was
   *	used to submit the form).
   * 3. This method binds the submit() method to the form for you.
   *
   * The options argument for ajaxForm works exactly as it does for ajaxSubmit. ajaxForm merely
   * passes the options argument along after properly binding events for submit elements and
   * the form itself.
   */
  $.fn.ajaxForm = function (options, data, dataType, onSuccess) {
    options = shorthandOptions(options, data, dataType, onSuccess) || {};
    options.delegation = options.delegation && typeof $.fn.on === "function";

    // in jQuery 1.3+ we can fix mistakes with the ready state
    if (!options.delegation && this.length === 0) {
      var o = { s: this.selector, c: this.context };

      if (!$.isReady && o.s) {
        log("DOM not ready, queuing ajaxForm");
        $(function () {
          $(o.s, o.c).ajaxForm(options);
        });

        return this;
      }

      // is your DOM ready?  http://docs.jquery.com/Tutorials:Introducing_$(document).ready()
      log("terminating; zero elements found by selector" + ($.isReady ? "" : " (DOM not ready)"));

      return this;
    }

    if (options.delegation) {
      $(document)
        .off("submit.form-plugin", this.selector, doAjaxSubmit)
        .off("click.form-plugin", this.selector, captureSubmittingElement)
        .on("submit.form-plugin", this.selector, options, doAjaxSubmit)
        .on("click.form-plugin", this.selector, options, captureSubmittingElement);

      return this;
    }

    if (options.beforeFormUnbind) {
      options.beforeFormUnbind(this, options);
    }

    return this.ajaxFormUnbind()
      .on("submit.form-plugin", options, doAjaxSubmit)
      .on("click.form-plugin", options, captureSubmittingElement);
  };

  // private event handlers
  function doAjaxSubmit(e) {
    /* jshint validthis:true */
    var options = e.data;

    if (!e.isDefaultPrevented()) {
      // if event has been canceled, don't proceed
      e.preventDefault();
      // the form is found through the real tree: a control named nodeType misleads jQuery's closest
      var form = closestByTag(e.target, ["form"]);

      // a button outside the form (form attribute), or requestSubmit(button), sends no click here
      captureEventSubmitter(e, form);
      $(form).ajaxSubmit(options); // #365
    }
  }

  function captureSubmittingElement(e) {
    /* jshint validthis:true */
    assertRealParent(this);
    captureSubmitter(e);
  }

  // ajaxFormUnbind unbinds the event handlers that were bound by ajaxForm
  $.fn.ajaxFormUnbind = function () {
    return this.off("submit.form-plugin click.form-plugin");
  };

  /**
   * formToArray() gathers form element data into an array of objects that can
   * be passed to any of the following ajax functions: $.get, $.post, or load.
   * Each object in the array has both a 'name' and 'value' property. An example of
   * an array for a simple login form might be:
   *
   * [ { name: 'username', value: 'jresig' }, { name: 'password', value: 'secret' } ]
   *
   * It is this array that is passed to pre-submit callback functions provided to the
   * ajaxSubmit() and ajaxForm() methods.
   */
  $.fn.formToArray = function (semantic, elements, filtering) {
    var collected = serialization.collect(this[0], semantic, filtering);

    if (elements) {
      elements.push.apply(elements, collected.controls);
    }

    return collected.fields;
  };

  /**
   * Serializes form data into a 'submittable' string. This method will return a string
   * in the format: name1=value1&amp;name2=value2
   */
  $.fn.formSerialize = function (semantic) {
    // hand off to jQuery.param for proper encoding
    return $.param(urlencodedFields(this.formToArray(semantic)));
  };

  /**
   * Serializes all field elements in the jQuery object into a query string.
   * This method will return a string in the format: name1=value1&amp;name2=value2
   */
  $.fn.fieldSerialize = function (successful) {
    var a = [];

    this.each(function () {
      var n = this.name;

      // a form is not a field, though it may have a name
      if (!n || tagName(this) === "form") {
        return;
      }

      var v = $.fieldValue(this, successful);

      if (v && v.constructor === Array) {
        for (var i = 0, max = v.length; i < max; i++) {
          a.push({ name: n, value: v[i] });
        }
      } else if (v !== null && typeof v !== "undefined") {
        a.push({ name: this.name, value: v });
      }
    });

    // hand off to jQuery.param for proper encoding
    return $.param(a);
  };

  /**
   * Returns the value(s) of the element in the matched set. For example, consider the following form:
   *
   *	<form><fieldset>
   *		<input name="A" type="text">
   *		<input name="A" type="text">
   *		<input name="B" type="checkbox" value="B1">
   *		<input name="B" type="checkbox" value="B2">
   *		<input name="C" type="radio" value="C1">
   *		<input name="C" type="radio" value="C2">
   *	</fieldset></form>
   *
   *	var v = $('input[type=text]').fieldValue();
   *	// if no values are entered into the text inputs
   *	v === ['','']
   *	// if values entered into the text inputs are 'foo' and 'bar'
   *	v === ['foo','bar']
   *
   *	var v = $('input[type=checkbox]').fieldValue();
   *	// if neither checkbox is checked
   *	v === undefined
   *	// if both checkboxes are checked
   *	v === ['B1', 'B2']
   *
   *	var v = $('input[type=radio]').fieldValue();
   *	// if neither radio is checked
   *	v === undefined
   *	// if first radio is checked
   *	v === ['C1']
   *
   * The successful argument controls whether or not the field element must be 'successful'
   * (per http://www.w3.org/TR/html4/interact/forms.html#successful-controls).
   * The default value of the successful argument is true. If this value is false the value(s)
   * for each element is returned.
   *
   * Note: This method *always* returns an array. If no valid value can be determined the
   *	array will be empty, otherwise it will contain one or more values.
   */
  $.fn.fieldValue = function (successful) {
    for (var val = [], i = 0, max = this.length; i < max; i++) {
      var el = this[i];
      var v = $.fieldValue(el, successful);

      if (v === null || typeof v === "undefined" || (v.constructor === Array && !v.length)) {
        continue;
      }

      if (v.constructor === Array) {
        $.merge(val, v);
      } else {
        val.push(v);
      }
    }

    return val;
  };

  /**
   * Returns the value of the field element.
   */
  $.fieldValue = function (el, successful) {
    var required = typeof successful === "undefined" || successful;

    if (required && !isSuccessful(el, submitterElement(el.form))) {
      return null;
    }

    return valueOf(el);
  };

  /**
   * Clears the form data. Takes the following actions on the form's input fields:
   *  - input text fields will have their 'value' property set to the empty string
   *  - select elements will have their 'selectedIndex' property set to -1
   *  - checkbox and radio inputs will have their 'checked' property set to false
   *  - inputs of type submit, button, reset, and hidden will *not* be effected
   *  - button elements will *not* be effected
   */
  $.fn.clearForm = function (includeHidden) {
    return this.each(function () {
      $("input,select,textarea", this).clearFields(includeHidden);
    });
  };

  /**
   * Clears the selected form elements.
   */
  $.fn.clearFields = $.fn.clearInputs = function (includeHidden) {
    var re =
      /^(?:color|date|datetime|email|month|number|password|range|search|tel|text|time|url|week)$/i; // 'hidden' is not in this list

    return this.each(function () {
      var t = this.type,
        tag = tagName(this);

      if (re.test(t) || tag === "textarea") {
        this.value = "";
      } else if (t === "checkbox" || t === "radio") {
        this.checked = false;
      } else if (tag === "select") {
        this.selectedIndex = -1;
      } else if (t === "file") {
        if (/MSIE/.test(navigator.userAgent)) {
          $(this).replaceWith($(this).clone(true));
        } else {
          $(this).val("");
        }
      } else if (includeHidden) {
        // includeHidden can be the value true, or it can be a selector string
        // indicating a special test; for example:
        // $('#myForm').clearForm('.special:hidden')
        // the above would clean hidden inputs that have the class of 'special'
        if (
          (includeHidden === true && /hidden/.test(t)) ||
          (typeof includeHidden === "string" && $(this).is(includeHidden))
        ) {
          this.value = "";
        }
      }
    });
  };

  /**
   * Resets the form data or individual elements. Takes the following actions
   * on the selected tags:
   * - all fields within form elements will be reset to their original value
   * - input / textarea / select fields will be reset to their original value
   * - option / optgroup fields (for multi-selects) will defaulted individually
   * - non-multiple options will find the right select to default
   * - label elements will be searched against its 'for' attribute
   * - all others will be searched for appropriate children to default
   */
  $.fn.resetForm = function () {
    return this.each(function () {
      var el = $(this);
      var tag = tagName(this);

      switch (tag) {
        case "input":
          this.checked = this.defaultChecked;
        // fall through

        case "textarea":
          this.value = this.defaultValue;

          return true;

        case "option":
        case "optgroup":
          var select = el.parents("select");

          if (select.length && select[0].multiple) {
            if (tag === "option") {
              this.selected = this.defaultSelected;
            } else {
              el.find("option").resetForm();
            }
          } else {
            select.resetForm();
          }

          return true;

        case "select":
          // eslint-disable-next-line consistent-return -- jQuery .each() break semantics
          el.find("option").each(function (i) {
            this.selected = this.defaultSelected;
            if (this.defaultSelected && !el[0].multiple) {
              el[0].selectedIndex = i;

              return false;
            }
          });

          return true;

        case "label":
          // The control whose id the for attribute names, and the controls inside the label. The
          // filter keeps a for that names an ancestor from resetting the label again.
          var forEl = this.htmlFor && this.ownerDocument.getElementById(this.htmlFor);

          el.find("input,select,textarea").add(forEl).filter("input,select,textarea").resetForm();

          return true;

        case "form":
          // through the prototype: a control named reset shadows the method
          callFormMethod(this, "reset");

          return true;

        default:
          el.find("form,input,label,select,textarea").resetForm();

          return true;
      }
    });
  };

  /**
   * Enables or disables any matching elements.
   */
  $.fn.enable = function (b) {
    if (typeof b === "undefined") {
      b = true;
    }

    return this.each(function () {
      this.disabled = !b;
    });
  };

  /**
   * Checks/unchecks any matching checkboxes or radio buttons and
   * selects/deselects and matching option elements.
   */
  $.fn.selected = function (select) {
    if (typeof select === "undefined") {
      select = true;
    }

    return this.each(function () {
      var t = this.type;

      if (t === "checkbox" || t === "radio") {
        this.checked = select;
      } else if (tagName(this) === "option") {
        var $sel = $(this).parent("select");

        if (select && $sel[0] && $sel[0].type === "select-one") {
          // deselect all other options
          $sel.find("option").selected(false);
        }

        this.selected = select;
      }
    });
  };

  // expose debug var
  $.fn.ajaxSubmit.debug = false;
})(jQuery);
}));
