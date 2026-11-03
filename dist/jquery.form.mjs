/*!
 * jQuery Form Plugin
 * version: 4.6.0
 * Requires jQuery v3.5 or later
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

import jQuery from 'jquery';
export { default } from 'jquery';

// Form members: the properties and methods the plugin reads or calls on a form. A control named
// like a member (elements, setAttribute) shadows that member on the form itself, so members are
// read through the DOM prototypes, which a control cannot shadow.

// The prototype chain of a form, nearest first, looked up on every call.
const owners = ["HTMLFormElement", "HTMLElement", "Element", "Node"];

// The descriptor on the nearest prototype that has the member, or undefined.
function findDescriptor(name) {
  let descriptor;

  for (let i = 0; i < owners.length && !descriptor; i++) {
    descriptor = Object.getOwnPropertyDescriptor(window[owners[i]].prototype, name);
  }

  return descriptor;
}

/**
 * Reads a member of a form through its prototype getter. Falls back to the plain property on an
 * element the getter does not accept (such as a fieldset for `elements`).
 */
function formMember(form, name) {
  const descriptor = findDescriptor(name);

  try {
    return descriptor.get.call(form);
  } catch (e) {
    return form[name];
  }
}

/**
 * Calls a method of a form through its prototype.
 */
function callFormMethod(form, name) {
  return findDescriptor(name).value.apply(form, Array.prototype.slice.call(arguments, 2));
}

// Nodes such as the document and text nodes have no tag name (#600).
function tagName(el) {
  const name = formMember(el, "tagName");

  return typeof name === "string" ? name.toLowerCase() : "";
}

/**
 * Whether a control or option is disabled, also through a disabled fieldset or optgroup. Without
 * selector matching, only its own disabled property is read.
 */
function isDisabled(el) {
  return typeof el.matches === "function" ? el.matches(":disabled") : !!el.disabled;
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
      'jquery.form: a form control named "parentNode" hides the form\'s parentNode; rename the control',
    );
  }
}

// The element itself or its nearest ancestor with one of the tag names, through the real tree.
function closestByTag(el, names) {
  for (let node = el; node; node = formMember(node, "parentNode")) {
    if (names.indexOf(tagName(node)) >= 0) {
      return node;
    }
  }

  return null;
}

// The submitter: the button that submitted a form, captured from ajaxForm's clicks. It is kept in
// a private store and cleared shortly after the click. The form's clk, clk_x and clk_y properties
// are still written for pages that read them, and read when the store has none.

const storeKey = "jqFormSubmitter";

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
  const value = form[name];
  const els = formMember(form, "elements");

  return els && value && els.namedItem(name) === value ? undefined : value;
}

// Records a submitter for a form until the click window ends.
function record(form, el, x, y) {
  jQuery.data(form, storeKey, { el, x, y });
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

  const offset = jQuery(target).offset();

  return [e.pageX - offset.left, e.pageY - offset.top];
}

/**
 * Records the submit or image button a click event reached, for the form it belongs to.
 */
function captureSubmitter(e) {
  // the clicked control, or the button around the clicked content (ex: a span within a button)
  const target = closestByTag(e.target, ["button", "input"]);

  // the type property, unlike the attribute, is "submit" for a button without a type (#588)
  if (!target || (target.type !== "submit" && target.type !== "image")) {
    return;
  }

  const form = target.form;

  if (!form) {
    // a submit control that belongs to no form
    return;
  }

  const point = target.type === "image" ? imagePoint(e, target) : [];

  record(form, target, point[0], point[1]);
}

/**
 * Records the submitter a submit event names (SubmitEvent.submitter), when no click was captured.
 * An image submitter gets the point 0,0, as native submission sends it without a click.
 */
function captureEventSubmitter(e, form) {
  const el = e.originalEvent && e.originalEvent.submitter;

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

  const stored = jQuery.data(form, storeKey);

  if (stored) {
    return stored;
  }

  const el = expando(form, "clk");

  return el ? { el, x: expando(form, "clk_x"), y: expando(form, "clk_y") } : null;
}

/**
 * The fields of a clicked image button, as a native submission sends them: only its coordinates,
 * named name.x and name.y, or x and y when it has no name.
 */
function imageFields(sub) {
  const prefix = sub.el.name ? sub.el.name + "." : "";

  return [
    { name: prefix + "x", value: sub.x },
    { name: prefix + "y", value: sub.y },
  ];
}

/**
 * The submitter's fields for a post that adds them itself (the iframe upload), as name → value.
 */
function submitterFields(form) {
  const fields = {};
  const sub = submitterOf(form);
  const el = sub && sub.el;

  // a disabled button is not sent, also when a disabled fieldset disables it
  if (!el || isDisabled(el)) {
    return fields;
  }

  if (el.type === "image") {
    jQuery.each(imageFields(sub), function (i, field) {
      fields[field.name] = field.value;
    });
  } else if (el.name) {
    fields[el.name] = el.value;
  }

  return fields;
}

/**
 * The form's submitter element, or null.
 */
function submitterElement(form) {
  const sub = submitterOf(form);

  return sub ? sub.el : null;
}

// Debug logging, switched on by $.fn.ajaxSubmit.debug. The flag is read on every call, so it can
// be turned on after the plugin loads.
function log() {
  if (!jQuery.fn.ajaxSubmit.debug) {
    return;
  }

  const msg = "[jquery.form] " + Array.prototype.join.call(arguments, "");

  window.console.log(msg);
}

// True for a jQuery version string older than 3.5.
function beforeJQuery35(version) {
  const parts = String(version).split(".");
  const major = Number(parts[0]);

  return major < 3 || (major === 3 && Number(parts[1]) < 5);
}

/**
 * 5.0 needs jQuery 3.5 or later: ajaxSubmit and ajaxForm throw on an older version before any
 * event or callback. Nothing checks at load, so the plugin can still be installed on the page.
 */
function requireJQuery35(version) {
  if (beforeJQuery35(version)) {
    throw new Error("jquery.form 5 needs jQuery 3.5 or later; this is " + version);
  }
}

// The arguments ajaxSubmit and ajaxForm accept in place of an options object, and the options
// that name elements.

/**
 * Turns the (url, data, dataType, success) shorthand into options. A url of false is kept as
 * the url; anything else is returned as given.
 */
function shorthandOptions(options, data, dataType, onSuccess) {
  if (typeof options !== "string" && options !== false) {
    return options;
  }

  const result = { url: options, data, dataType };

  if (typeof onSuccess === "function") {
    result.success = onSuccess;
  }

  return result;
}

// A copy of options without its url, so the form action is used.
function withoutUrl(options) {
  const result = {};

  for (const key in options) {
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
  for (let i = 0; i < sources.length; i++) {
    if (sources[i].context !== undefined) {
      settings.context = sources[i].context;
    }
  }

  return settings;
}

/**
 * A selector option (target, iframeTarget) as a jQuery set. A string is only a selector, matched
 * in `context` (the document when it is missing) and never parsed as HTML; an element or a jQuery
 * set passes through.
 */
function selectorOption(value, context) {
  return typeof value === "string" ? jQuery(jQuery.find(value, context)) : jQuery(value);
}

// ajaxForm binding: the submit and click handlers that send a form through ajaxSubmit. The
// handlers look up $.fn.ajaxSubmit when they run, so a replacement installed later is used.

// Sends the submit event's form with ajaxSubmit, unless an earlier handler cancelled it.
function submitWith(e, options) {
  if (!e.isDefaultPrevented()) {
    // if event has been canceled, don't proceed
    e.preventDefault();
    // the form is found through the real tree: a control named nodeType misleads jQuery's closest
    const form = closestByTag(e.target, ["form"]);

    // a button outside the form (form attribute), or requestSubmit(button), sends no click here
    captureEventSubmitter(e, form);
    jQuery(form).ajaxSubmit(options); // #365
  }
}

function doAjaxSubmit(e) {
  submitWith(e, e.data);
}

function captureSubmittingElement(e) {
  /* jshint validthis:true */
  assertRealParent(this);
  captureSubmitter(e);
}

// An empty selection binds nothing. A page that runs ajaxForm before the forms exist calls it
// inside $(fn), or uses a delegation selector.
function bindNothing($sel) {
  // is your DOM ready?  http://docs.jquery.com/Tutorials:Introducing_$(document).ready()
  log("terminating; zero elements found by selector" + (jQuery.isReady ? "" : " (DOM not ready)"));

  return $sel;
}

// The element itself or its nearest ancestor that matches the selector. Element.closest never
// reads a parentNode a control can hide (jQuery's delegated walk does, and cycles on such a form).
function closestMatch(el, selector) {
  if (!isElement(el)) {
    return null;
  }

  return Element.prototype.closest.call(el, selector);
}

// The document handlers bound for each delegation selector, keyed by "s" + selector.
let delegated = {};

function unbindSelector(selector) {
  const handlers = delegated["s" + selector];

  if (handlers) {
    jQuery(document)
      .off("submit.form-plugin", handlers.submit)
      .off("click.form-plugin", handlers.click);
    delete delegated["s" + selector];
  }
}

// delegation: "<selector>": one handler pair on the document, scoped to the selector.
function bindSelector($sel, selector, options) {
  const handlers = {
    submit(e) {
      if (closestMatch(e.target, selector)) {
        submitWith(e, options);
      }
    },
    click(e) {
      if (closestMatch(e.target, selector)) {
        captureSubmitter(e);
      }
    },
  };

  unbindSelector(selector);
  delegated["s" + selector] = handlers;
  jQuery(document)
    .on("submit.form-plugin", handlers.submit)
    .on("click.form-plugin", handlers.click);

  return $sel;
}

// Passed by ajaxForm's own rebind: unbind the selection only, never the document handlers.
const selectionOnly = {};

/**
 * ajaxForm() binds the selected forms so a submit is sent with ajaxSubmit, with the clicked
 * submit button (and image coordinates) included. The options work as for ajaxSubmit.
 */
function ajaxForm(options, data, dataType, onSuccess) {
  requireJQuery35(jQuery.fn.jquery);
  options = shorthandOptions(options, data, dataType, onSuccess) || {};

  const delegation = options.delegation;

  if (typeof delegation === "string" && delegation) {
    return bindSelector(this, delegation, options);
  }

  // delegation: true scoped to the selection's selector, which jQuery 3 removed; 5.0 needs one
  if (delegation || delegation === "") {
    throw new Error(
      'jquery.form: delegation needs a selector in 5.0, e.g. delegation: "form.ajax"',
    );
  }

  // written back as in 4.x, so options that cannot take a property (true, a frozen object) throw
  options.delegation = delegation;

  if (this.length === 0) {
    return bindNothing(this);
  }

  if (options.beforeFormUnbind) {
    options.beforeFormUnbind(this, options);
  }

  return this.ajaxFormUnbind(selectionOnly)
    .on("submit.form-plugin", options, doAjaxSubmit)
    .on("click.form-plugin", options, captureSubmittingElement);
}

/**
 * ajaxFormUnbind() removes the handlers ajaxForm bound on the selection and every delegated
 * binding on the document. ajaxFormUnbind(selector) removes only that delegation selector.
 */
function ajaxFormUnbind(selector) {
  if (typeof selector === "string") {
    unbindSelector(selector);

    return this;
  }

  if (selector !== selectionOnly) {
    delegated = {};
    jQuery(document).off("submit.form-plugin click.form-plugin");
  }

  return this.off("submit.form-plugin click.form-plugin");
}

// Successful controls: which controls of a form are sent, and as which name/value fields
// (https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#constructing-the-form-data-set).

// Line breaks, sent as CRLF
const rLineBreak = /\r\n|\r|\n/g;
const rCR = /\r/g;

// The submittable elements: the only ones a form submission sends.
const submittable = "button, input, select, textarea";
const rSubmittable = /^(?:button|input|select|textarea)$/;

function isSubmittable(el) {
  return rSubmittable.test(tagName(el));
}

// The name of the hidden control that sends the encoding, matched ASCII case-insensitively.
const rCharset = /^_charset_$/i;

// The input types that, with textarea, send a dirname field (the auto-directionality
// form-associated elements).
const rDirnameTypes = /^(?:hidden|text|search|tel|url|email|password|submit|reset|button)$/;

// The dirname field of a control, or null: dirname=ltr or dirname=rtl, from its directionality.
function dirnameField(el) {
  const tag = tagName(el);
  const dirname = el.getAttribute("dirname");
  const applies = tag === "textarea" || (tag === "input" && rDirnameTypes.test(el.type));

  if (!dirname || !applies) {
    return null;
  }

  let rtl;

  try {
    rtl = el.matches(":dir(rtl)");
  } catch (e) {
    // a browser without :dir() (before Chrome 120 and Safari 16.4); a detached control has no
    // computed direction and counts as ltr
    rtl = getComputedStyle(el).direction === "rtl";
  }

  return { name: dirname, value: rtl ? "rtl" : "ltr" };
}

/**
 * The successful-control rule: whether a control is sent. `submitter` is the button that
 * submitted the control's form; other submit and image buttons of a form are not sent.
 */
function isSuccessful(el, submitter) {
  const t = el.type;

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
  const index = el.selectedIndex;

  if (index < 0) {
    return null;
  }

  const a = [],
    ops = el.options;
  const one = el.type === "select-one";
  const max = one ? index + 1 : ops.length;

  for (let i = one ? index : 0; i < max; i++) {
    const op = ops[i];

    if (op.selected && !isDisabled(op)) {
      const v = op.value;

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

  let v = jQuery(el).val();
  const raw = el.value;

  // jQuery before 4.0 drops carriage returns from .val(); read them from the value itself
  if (typeof raw === "string" && raw.replace(rCR, "") === v) {
    v = raw;
  }

  return v.replace(rLineBreak, "\r\n");
}

/**
 * The plugin's own $.fieldValue: the value of a control, or null when `successful` is true or
 * missing and the control is not sent.
 */
function fieldValue(el, successful) {
  const required = typeof successful === "undefined" || successful;

  if (required && !isSuccessful(el, submitterElement(el.form))) {
    return null;
  }

  return valueOf(el);
}

/**
 * The fields as a urlencoded body sends them: a selected file as its name.
 */
// A lone surrogate becomes U+FFFD, as in a native submission; jQuery.param would throw.
const loneSurrogate = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|([^\uD800-\uDBFF]|^)([\uDC00-\uDFFF])/g;

function wellFormed(value) {
  return typeof value === "string"
    ? value.replace(loneSurrogate, function (match, before) {
        return (before || "") + "\uFFFD";
      })
    : value;
}

// Sets an own enumerable key, so a key like __proto__ stays an ordinary key.
function setKey(object, key, value) {
  Object.defineProperty(object, key, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });
}

/**
 * Data for $.param (the data option or extraData) with lone surrogates in its keys and string
 * values made well formed. Arrays and objects are walked as $.param walks them, inherited keys
 * included; they are copied only when something changes.
 */
function wellFormedData(data) {
  const isArray = Array.isArray(data);

  if (!isArray && Object.prototype.toString.call(data) !== "[object Object]") {
    return wellFormed(data);
  }

  const copy = isArray ? [] : {};
  let changed = false;

  if (isArray) {
    for (let i = 0; i < data.length; i++) {
      copy[i] = wellFormedData(data[i]);
      changed = changed || copy[i] !== data[i];
    }
  } else {
    for (const key in data) {
      const name = wellFormed(key);
      const value = wellFormedData(data[key]);

      changed = changed || name !== key || value !== data[key];
      setKey(copy, name, value);
    }
  }

  return changed ? copy : data;
}

// jQuery 3 dropped $.param's "+" for a space; a native submission still sends "+". Only a space
// encodes as %20, since a literal % encodes as %25.
function urlencode(fields, traditional) {
  return jQuery.param(urlencodedFields(fields), traditional).replace(/%20/g, "+");
}

function urlencodedFields(fields) {
  return jQuery.map(fields, function (field) {
    let value =
      field.type === "file" && typeof field.value !== "string" ? field.value.name : field.value;
    const name = wellFormed(field.name);
    value = wellFormed(value);

    return name === field.name && value === field.value ? field : { name, value };
  });
}

/**
 * The serialization steps.
 */
function createSuccessfulControls() {
  const $ = jQuery;

  // The submittable elements below a root (a document, a shadow root or an element), in tree
  // order. Read through the root's prototype, since a control can shadow a form's or the
  // document's querySelectorAll.
  const rootOwners = { 9: Document, 11: DocumentFragment };

  function submittableIn(root) {
    const owner = rootOwners[formMember(root, "nodeType")] || Element;

    return owner.prototype.querySelectorAll.call(root, submittable);
  }

  /**
   * The candidate controls of a subject, in tree order: for a form, the submittable elements it
   * owns, outside controls (form=id) and image buttons included; for a fieldset, the document or
   * another container, its submittable descendants; for a plain object, its elements list.
   */
  function controlsOf(form) {
    if (tagName(form) === "form") {
      // #386: the form's tree holds every control it owns, also those outside it
      return $.grep(submittableIn(callFormMethod(form, "getRootNode")), function (el) {
        return el.form === form;
      });
    }

    const type = formMember(form, "nodeType");

    if (type === 1 || type === 9) {
      return $.makeArray(submittableIn(form));
    }

    // a plain object with an elements list; a text node or the window throws a TypeError
    const listed = form.elements;

    return $.grep(
      $.makeArray(typeof listed === "undefined" ? form.querySelectorAll(submittable) : listed),
      isSubmittable,
    );
  }

  // The fields of a control's value, or null when the control is not sent.
  function fieldsOf(el) {
    const n = el.name;
    // the plugin's own reader: a page that replaces $.fieldValue does not change what is sent
    const v = fieldValue(el, true);

    if (v && v.constructor === Array) {
      return $.map(v, function (value) {
        return { name: n, value };
      });
    }

    if (el.type === "file") {
      const files = el.files;

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

    // a hidden _charset_ sends the request's encoding, which is always UTF-8 here
    const value = el.type === "hidden" && rCharset.test(n) ? "UTF-8" : v;

    return [{ name: n, value, type: el.type, required: el.required }];
  }

  // Adds one candidate control's fields, and the control when it has a value to send.
  function addCandidate(collected, form, el) {
    if (isDisabled(el) || !isSubmittable(el)) {
      return;
    }

    const sub = el.type === "image" && submitterOf(form);

    if (sub) {
      // the clicked image at its place in tree order; other image buttons are not sent
      if (sub.el === el) {
        collected.fields.push.apply(collected.fields, imageFields(sub));
      }

      return;
    }

    if (!el.name) {
      return;
    }

    const own = fieldsOf(el);

    if (own) {
      const dir = dirnameField(el);

      collected.controls.push(el);
      collected.fields.push.apply(collected.fields, own);

      // right after the control's own field, as a native submission sends it
      if (dir) {
        collected.fields.push(dir);
      }
    }
  }

  /**
   * The fields of a form, as formToArray returns them, and the controls they came from.
   */
  function collect(form, filtering) {
    const collected = { fields: [], controls: [] };

    if (!form) {
      return collected;
    }

    let els = controlsOf(form);

    if (typeof filtering === "function") {
      els = $.map(els, filtering);
    }

    for (let i = 0; i < els.length; i++) {
      addCandidate(collected, form, els[i]);
    }

    return collected;
  }

  return {
    controlsOf,
    fieldsOf,
    collect,
  };
}

// The XMLHttpRequest transports: $.ajax with the encoded fields, or FormData for file uploads.
const $$4 = jQuery;

// utility fn for deep serialization: [name, value] pairs, as $.param encodes them
function deepSerialize(extraData, traditional) {
  const param = $$4.param(wellFormedData(extraData), traditional);
  const serialized = param ? param.split("&") : [];
  const len = serialized.length;
  const result = [];
  let i, part;

  for (i = 0; i < len; i++) {
    part = serialized[i].split("=");
    // #278; use array instead of object storage, favoring array serializations
    result.push([decodeURIComponent(part[0]), decodeURIComponent(part[1])]);
  }

  return result;
}

/**
 * Posts the fields and extraData as FormData, for files or a multipart form.
 * XMLHttpRequest Level 2 file uploads (big hat tip to francois2metz)
 */
function sendFormData(submission) {
  const options = submission.options;
  const a = submission.fields;

  const formdata = new FormData();

  for (let i = 0; i < a.length; i++) {
    // a file input without a file: an empty file, as a native multipart submission sends it
    const empty = a[i].type === "file" && a[i].value === "";

    formdata.append(
      a[i].name,
      empty ? new File([], "", { type: "application/octet-stream" }) : a[i].value,
    );
  }

  if (options.extraData) {
    const serializedData = deepSerialize(options.extraData, submission.traditional);

    for (let i = 0; i < serializedData.length; i++) {
      formdata.append(serializedData[i][0], serializedData[i][1]);
    }
  }

  options.data = null;

  const s = $$4.extend(true, {}, $$4.ajaxSettings, options, {
    contentType: false,
    processData: false,
    cache: false,
    type: submission.method || "POST",
  });

  keepContext(s, [$$4.ajaxSettings, options]);

  if (options.uploadProgress) {
    // workaround because jqXHR does not expose upload property: wraps the xhr factory, the
    // caller's or jQuery's
    const createXhr = s.xhr;

    s.xhr = function () {
      const xhr = createXhr.call(this);

      if (xhr.upload) {
        xhr.upload.addEventListener(
          "progress",
          function (event) {
            let percent = 0;
            const position = event.loaded;
            const total = event.total;

            if (event.lengthComputable) {
              percent = Math.ceil((position / total) * 100);
            }

            options.uploadProgress(event, position, total, percent);
          },
          false,
        );
      }

      return xhr;
    };
  }

  s.data = null;

  const beforeSend = s.beforeSend;

  s.beforeSend = function (xhr, o) {
    // Send FormData() provided by user
    if (options.formData) {
      o.data = options.formData;
    } else {
      o.data = formdata;
    }

    // a veto (false) cancels the upload, as on the other transports
    return beforeSend ? beforeSend.call(this, xhr, o) : undefined;
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
const $$3 = jQuery;

// The form attributes an iframe upload changes while it posts.
const uploadAttributes = ["action", "target", "method", "enctype", "encoding"];

// Called through the prototype: an extraData key or a form field may be named hasOwnProperty.
const hasOwn = Object.prototype.hasOwnProperty;

function isGet(method) {
  return /^get$/i.test(method);
}

// Resolves both URLs through anchors, as jQuery does for crossDomain.
function isSameOrigin(url) {
  const origin = document.createElement("a");
  const target = document.createElement("a");

  origin.href = window.location.href;
  target.href = url;

  return origin.protocol + "//" + origin.host === target.protocol + "//" + target.host;
}

/** Adds the clicked submitter (and an image's coordinates) to s.extraData. */
function addSubmitterFields(s, form) {
  // add submitting element to data if we know it
  const fields = submitterFields(form);

  for (const n in fields) {
    s.extraData = s.extraData || {};
    s.extraData[wellFormed(n)] = wellFormed(fields[n]);
  }
}

/** Adds the page's CSRF token to s.extraData when the form is posted to the page's origin. */
function addCsrfField(s, form, method, forms) {
  // Rails CSRF hack (thanks to Yvan Barthelemy); like jquery-ujs, only for the page's origin and
  // only when the form is posted, since a get form would put the token in the url
  const csrf_token = $$3("meta[name=csrf-token]").attr("content");
  const csrf_param = $$3("meta[name=csrf-param]").attr("content");
  const posts =
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
  const saved = {};

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
  const mp = "multipart/form-data";

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
    const input = ownerDocument.createElement("input");

    input.type = "hidden";
    input.name = name;
    added.push($$3(input).val(value).appendTo(form)[0]);
  }

  if (extraData) {
    for (const n in extraData) {
      if (hasOwn.call(extraData, n)) {
        // if using the $.param format that allows for multiple values with the same name
        if (
          $$3.isPlainObject(extraData[n]) &&
          hasOwn.call(extraData[n], "name") &&
          hasOwn.call(extraData[n], "value")
        ) {
          addHiddenInput(wellFormed(extraData[n].name), wellFormed(extraData[n].value));
        } else {
          // arrays and objects become one field per value, as $.param sends them (#597)
          const single = {};

          single[n] = extraData[n];
          const fields = deepSerialize(single, traditional);

          for (let f = 0; f < fields.length; f++) {
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

// The iframe response reader: turns the frame's document into the mock xhr's text, XML, status
// and dataType, then parses it as $.ajax would (dataFilter, JSON, script).
const $$2 = jQuery;

/** The frame's document, or null when the same-origin policy denies access to it. */
function getDoc(frame) {
  return frame.contentDocument;
}

/** Parses the response text or XML for the given (lowercase) dataType. */
function httpData(xhr, type, s) {
  // mostly lifted from jq1.4.4

  const ct = xhr.getResponseHeader("content-type") || "";
  const xml = (type === "xml" || !type) && ct.indexOf("xml") >= 0;
  let data = xml ? xhr.responseXML : xhr.responseText;

  if (xml && data.documentElement.nodeName === "parsererror") {
    $$2.error("parsererror");
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
  const docRoot = doc.body ? doc.body : doc.documentElement;

  xhr.responseText = docRoot ? docRoot.innerHTML : null;
  xhr.responseXML = doc;
  if (isXml) {
    s.dataType = "xml";
  }
  xhr.getResponseHeader = function (header) {
    // the dataType in lowercase, as $.ajax reads it
    const headers = { "content-type": s.dataType && s.dataType.toLowerCase() };

    return headers[header.toLowerCase()];
  };
  if (docRoot) {
    readStatus(xhr, docRoot);
  }
}

// A response embedded in a textarea, or text wrapped in pre or body, replaces responseText.
function readEmbedded(doc, xhr, dt, s) {
  const scr = /(json|script|text)/.test(dt);

  if (!scr && !s.textarea) {
    return;
  }
  // see if user embedded response in textarea
  const ta = doc.getElementsByTagName("textarea")[0];

  if (ta) {
    xhr.responseText = ta.value;
    readStatus(xhr, ta);
  } else if (scr) {
    // account for browsers injecting pre around json response
    const pre = doc.getElementsByTagName("pre")[0];
    const b = doc.getElementsByTagName("body")[0];

    if (pre) {
      xhr.responseText = pre.textContent;
    } else if (b) {
      xhr.responseText = b.textContent;
    }
  }
}

/**
 * Reads and parses the response document into the mock xhr. Returns {status, data, errMsg}.
 */
function readResponse(doc, xhr, s) {
  let status = "success",
    data,
    errMsg;

  try {
    const isXml = /^xml$/i.test(s.dataType) || $$2.isXMLDoc(doc);

    log("isXml=" + isXml);
    readDocument(doc, xhr, s, isXml);

    const dt = (s.dataType || "").toLowerCase();

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

  return { status, data, errMsg };
}

// The iframe upload's lifecycle: the mock xhr and the Deferred, the global ajax events, the
// beforeSend veto, the timeout, abort and settling.
const $$1 = jQuery;

/**
 * Creates the lifecycle of one upload with the merged settings `s`. `frame.stop()` stops the
 * frame's load and `frame.release()` removes or resets the frame after the upload.
 */
function createLifecycle(s, frame) {
  let g;
  let timeoutHandle;
  let callbackProcessed;
  const deferred = $$1.Deferred();

  const xhr = {
    // mock object
    aborted: 0,
    responseText: null,
    responseXML: null,
    status: 0,
    statusText: "n/a",
    getAllResponseHeaders() {},
    getResponseHeader() {},
    setRequestHeader() {},
    abort(status) {
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
    const e = textStatus || (status === "timeout" ? "timeout" : "aborted");

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

  // Resolves the upload with the parsed data, as $.ajax does; returns {error} when the success
  // callback threw.
  function succeed(data) {
    let failure;

    try {
      s.success.call(s.context, data, "success", xhr);
    } catch (err) {
      failure = { error: err };
    }

    deferred.resolve(data, "success", xhr);

    if (g) {
      $$1.event.trigger("ajaxSuccess", [xhr, s, data]);
    }

    return failure;
  }

  // Settles the upload with the response reader's {status, data, errMsg}.
  function settle(result) {
    let status = result.status,
      errMsg = result.errMsg;

    if (xhr.aborted) {
      // abort() completed the upload while its response was processed
      log("upload aborted");

      return;
    }

    // an emulated HTTP error status wins with the statusText, as in $.ajax; a parse error is
    // kept otherwise
    if (xhr.status && !((xhr.status >= 200 && xhr.status < 300) || xhr.status === 304)) {
      if (status === "parsererror") {
        errMsg = undefined;
      }
      status = "error";
    }

    callbackProcessed = true;

    // ordering of these callbacks/triggers is odd, but that's how $.ajax does it
    if (status === "success") {
      const failure = succeed(result.data);

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
    deferred.reject(xhr, status, errMsg);
    if (g) {
      $$1.event.trigger("ajaxError", [xhr, s, errMsg]);
    }

    complete(status);
  }

  return {
    xhr,
    deferred,
    start,
    done,
    abort,
    settle,
    // Settles an upload that failed with an exception (ignored once aborted).
    fail(err) {
      settle({ status: "error", errMsg: err });
    },
    // Runs `onTimeout` after s.timeout, when set.
    startTimer(onTimeout) {
      if (s.timeout) {
        timeoutHandle = setTimeout(onTimeout, s.timeout);
      }
    },
    stopTimer() {
      clearTimeout(timeoutHandle);
      timeoutHandle = undefined;
    },
  };
}

// The iframe transport: posts the form itself into a hidden frame and reads the response from it,
// when the iframe option asks for it.
const $ = jQuery;

/**
 * The iframe send step. `forms.property` reads a form property, or the attribute when a control
 * shadows it.
 */
function createIframeTransport(forms) {
  const CLIENT_TIMEOUT_ABORT = 1;
  const SERVER_ABORT = 2;
  // tells apart the frames of uploads that start in the same millisecond
  let frameCount = 0;

  // ensure that every serialized input is still enabled
  function enableControls(elements) {
    for (let i = 0; i < elements.length; i++) {
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
    let $io, n;

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
      const io = ownerDocument.createElement("iframe");

      io.setAttribute("name", id);
      io.setAttribute("src", s.iframeSrc);
      $io = $(io);
      $io.css({ position: "absolute", top: "-1000px", left: "-1000px" });
    }

    return { $io, id };
  }

  // The frame hooks the lifecycle calls: stop a load in progress, and release after the upload.
  function frameHooks(s, $io) {
    return {
      stop() {
        $io.attr("src", s.iframeSrc); // abort op in progress
      },
      release() {
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
    const form = submission.form,
      method = submission.method;

    enableControls(submission.controls);

    const s = keepContext($.extend(true, {}, $.ajaxSettings, submission.options), [
      $.ajaxSettings,
      submission.options,
    ]);

    s.context = s.context || s;
    const ownerDocument = formMember(form, "ownerDocument");
    const $body = $(closestByTag(form, ["body"]));
    const frame = createFrame(s, "jqFormIO" + new Date().getTime() + frameCount++, ownerDocument);
    const $io = frame.$io,
      io = $io[0];
    const life = createLifecycle(s, frameHooks(s, $io));

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
      const saved = saveAttributes(form);

      setUploadAttributes(form, frame.id, method, s, forms);

      // support timout
      life.startTimer(function () {
        cb(CLIENT_TIMEOUT_ABORT);
      });

      // add "extra" data to form if provided in options
      const extraInputs = [];

      try {
        addExtraInputs(form, ownerDocument, s.extraData, submission.traditional, extraInputs);

        if (!s.iframeTarget) {
          // add iframe to doc and submit the form
          $io.appendTo($body);
        }

        // A connected form posting into a frame outside the document opens a new window.
        const root = ownerDocument.documentElement;

        if (io && $.contains(root, form) && !$.contains(root, io)) {
          const notInDocument = "jquery.form: the upload frame is not in the document";

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

      const doc = getDoc(io);

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

// A Submission is one ajaxSubmit call once its vetoes have passed:
// { form, $form, fields, controls, options, method, traditional }. `options` is the object the
// callbacks and events receive; later steps change it in place.

/**
 * The submission steps. `forms` reads form attributes and string properties (attribute,
 * property), and `serialization` collects the form's fields and controls.
 */
function createSubmission(forms, serialization) {
  const $ = jQuery;

  function refuse(message) {
    log(message);

    return null;
  }

  // The options merged over the form's action, the method, and the ajax defaults.
  function withDefaults(form, options, method) {
    const action = options.url || forms.property(form, "action");
    let url = typeof action === "string" ? action.trim() : "";

    // clean url (don't include hash value); an action that is only a fragment means this page
    url = url.split("#")[0] || window.location.href.split("#")[0];

    const merged = $.extend(
      true,
      {
        url,
        success: $.ajaxSettings.success,
        type: method || $.ajaxSettings.type,
        iframeSrc: "about:blank",
      },
      options,
    );

    return keepContext(merged, [options]);
  }

  /**
   * The one method every transport sends, read after the hooks: `method` wins over `type`, and
   * `type` is set to it. Undefined when only the ajax default applies, so each transport keeps
   * its own default.
   */
  function resolveMethod(options, defaultType) {
    const resolved = options.method || options.type;

    options.type = resolved;

    return resolved === defaultType && !options.method ? undefined : resolved;
  }

  // The data option, kept as extraData and encoded, or undefined without one.
  function extraQuery(fields, options, traditional) {
    if (!options.data) {
      return undefined;
    }

    const optionsData = typeof options.data === "function" ? options.data(fields) : options.data;

    if (typeof optionsData === "string") {
      if (options.requestFormat === "json") {
        throw new Error(
          'jquery.form: requestFormat "json" needs object data; a string data option is a query string',
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
      value,
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

    const body = {};
    const own = Object.prototype.hasOwnProperty;

    for (let i = 0; i < fields.length; i++) {
      const name = fields[i].name;

      if (!own.call(body, name)) {
        defineKey(body, name, fields[i].value);
      } else if (Array.isArray(body[name])) {
        body[name].push(fields[i].value);
      } else {
        defineKey(body, name, [body[name], fields[i].value]);
      }
    }

    const extra = options.extraData;

    for (const key in extra) {
      if (own.call(extra, key)) {
        defineKey(body, key, extra[key]);
      }
    }

    options.data = JSON.stringify(body);
    options.contentType = "application/json; charset=UTF-8";
  }

  // The fields of a query string, as the { name, value } list $.param takes.
  function queryPairs(query) {
    const pairs = [];
    const parts = query.split("&");

    for (let i = 0; i < parts.length; i++) {
      if (parts[i]) {
        const at = parts[i].indexOf("=");
        const name = at < 0 ? parts[i] : parts[i].slice(0, at);
        const value = at < 0 ? "" : parts[i].slice(at + 1);

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
      const hashAt = options.url.indexOf("#");
      const base = hashAt < 0 ? options.url : options.url.slice(0, hashAt);

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
    for (let i = 0; i < callbacks.length; i++) {
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

    const form = $set[0];
    let method = options.method || options.type || forms.property(form, "method");

    options = withDefaults(form, options, method);

    // the ajax default type, when neither the caller nor the form gave a method
    const defaultType = method ? undefined : options.type;

    // hook for manipulating the form data before it is extracted;
    // convenient for use with rich editors like tinyMCE or FCKEditor
    const veto = {};

    $set.trigger("form-pre-serialize", [$set, options, veto]);
    if (veto.veto) {
      return refuse("ajaxSubmit: submit vetoed via form-pre-serialize trigger");
    }

    // provide opportunity to alter form data before it is serialized
    if (options.beforeSerialize && options.beforeSerialize($set, options) === false) {
      return refuse("ajaxSubmit: submit aborted via beforeSerialize callback");
    }

    let traditional = options.traditional;

    if (typeof traditional === "undefined") {
      traditional = $.ajaxSettings.traditional;
    }

    const collected = serialization.collect($set[0], options.filtering);
    const fields = collected.fields;
    const controls = collected.controls;
    const qx = extraQuery(fields, options, traditional);

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
      form,
      $form: $set,
      fields,
      controls,
      options,
      method,
      traditional,
    };
  }

  /**
   * Wraps success, error and complete (a function or an array of them, as $.ajax takes) so each
   * also receives the form, and adds the resetForm,
   * clearForm and target steps before the success callbacks.
   */
  function deliver(submission) {
    const $set = submission.$form;
    const options = submission.options;
    const callbacks = [];

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
      const successes = callbackList(options.success);

      callbacks.push(function (data, textStatus, jqXHR) {
        const successArguments = arguments,
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
      const context = options.context || this; // jQuery 1.4+ supports scope context

      for (let i = 0, max = callbacks.length; i < max; i++) {
        callbacks[i].apply(context, [data, status, xhr || $set, $set]);
      }
    };

    if (options.error) {
      const errors = callbackList(options.error);

      options.error = function (xhr, status, error) {
        callEach(errors, options.context || this, [xhr, status, error, $set]);
      };
    }

    if (options.complete) {
      const completes = callbackList(options.complete);

      options.complete = function (xhr, status) {
        callEach(completes, options.context || this, [xhr, status, $set]);
      };
    }
  }

  /**
   * The transport for a submission: "iframe" only when the iframe option asks for it, "formdata"
   * for files or a multipart form, "ajax" otherwise.
   */
  function chooseTransport(submission) {
    const $set = submission.$form;
    const options = submission.options;

    // [value] (issue #113), also see comment:
    // https://github.com/malsup/form/commit/588306aedba1de01388032d5f42a60159eea9228#commitcomment-2180219
    // and the file inputs outside the form that belong to it through their form attribute
    const fileInputs = $("input[type=file]:enabled", $set)
      .add($(submission.controls).filter("input[type=file]"))
      .filter(function () {
        return $(this).val() !== "";
      });
    const hasFileInputs = fileInputs.length > 0;
    // compared as the browser does: ASCII case-insensitive, without surrounding whitespace
    const mp = /^[\t\n\f\r ]*multipart\/form-data[\t\n\f\r ]*$/i;
    const multipart =
      mp.test(forms.attribute($set[0], "enctype")) || mp.test(forms.attribute($set[0], "encoding"));
    let transport = hasFileInputs || multipart ? "formdata" : "ajax";

    // a truthy iframe option asks for the iframe transport
    if (options.iframe) {
      transport = "iframe";
    }

    if (transport !== "ajax" && options.requestFormat === "json") {
      throw new Error(
        'jquery.form: requestFormat "json" cannot send files or use the iframe transport',
      );
    }

    return transport;
  }

  return { prepare, deliver, chooseTransport };
}

/**
 * An attribute of a form, or undefined when it is absent, as jQuery's attr returns it. The
 * subject may also be the document or a plain object, read through jQuery.
 */
function formAttribute(form, name) {
  if (!isElement(form)) {
    return jQuery(form).attr(name);
  }

  const value = callFormMethod(form, "getAttribute", name);

  return value === null ? undefined : value;
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

		You can also use ajaxForm with delegation, so the
		form does not have to exist when you invoke ajaxForm:

		$(document).ajaxForm({
			delegation: '#myForm',
			target: '#output'
		});

		When using ajaxForm, the ajaxSubmit function will be invoked for you
		at the appropriate time.
	*/

  // A form property when it is a string, otherwise the attribute. The property is read plainly on
  // purpose: a control named like it shadows it, and then the raw attribute is used.
  function formProperty(form, name) {
    const value = form[name];

    return typeof value === "string" ? value : formAttribute(form, name);
  }

  const forms = { attribute: formAttribute, property: formProperty };
  const serialization = createSuccessfulControls();
  const steps = createSubmission(forms, serialization);
  const transports = {
    iframe: createIframeTransport(forms),
    formdata: sendFormData,
    ajax: sendAjax,
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
    requireJQuery35($.fn.jquery);

    // fast fail if nothing selected (http://dev.jquery.com/ticket/2752)
    if (!this.length) {
      log("ajaxSubmit: skipping submit process - no element selected");

      return this;
    }

    // #541: jQuery's slim build has no $.ajax
    if (!$.ajax) {
      throw new Error(
        "jquery.form: ajaxSubmit needs the full jQuery build; this jQuery has no $.ajax",
      );
    }

    const submission = steps.prepare(this, submitOptions(options, data, dataType, onSuccess));

    if (!submission) {
      return this;
    }

    steps.deliver(submission);

    const jqxhr = transports[steps.chooseTransport(submission)](submission);

    this.removeData("jqxhr").data("jqxhr", jqxhr);

    // clear element array
    for (let k = 0; k < submission.controls.length; k++) {
      submission.controls[k] = null;
    }

    // fire 'notify' event
    this.trigger("form-submit-notify", [this, submission.options]);

    return this;
  };

  $.fn.ajaxForm = ajaxForm;
  $.fn.ajaxFormUnbind = ajaxFormUnbind;

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
   *
   * The fields are in tree order, as a native submission sends them. The first argument (the
   * semantic flag before 5.0) is ignored.
   */
  $.fn.formToArray = function (ignored, elements, filtering) {
    const collected = serialization.collect(this[0], filtering);

    if (elements) {
      elements.push.apply(elements, collected.controls);
    }

    return collected.fields;
  };

  /**
   * Serializes form data into a 'submittable' string. This method will return a string
   * in the format: name1=value1&amp;name2=value2
   */
  $.fn.formSerialize = function () {
    // hand off to jQuery.param for proper encoding
    return urlencode(this.formToArray());
  };

  /**
   * Serializes all field elements in the jQuery object into a query string.
   * This method will return a string in the format: name1=value1&amp;name2=value2
   */
  $.fn.fieldSerialize = function (successful) {
    const a = [];

    this.each(function () {
      const n = this.name;

      // a form is not a field, though it may have a name
      if (!n || tagName(this) === "form") {
        return;
      }

      // the plugin's own reader, not a replaced $.fieldValue
      const v = fieldValue(this, successful);

      if (v && v.constructor === Array) {
        for (let i = 0, max = v.length; i < max; i++) {
          a.push({ name: n, value: v[i] });
        }
      } else if (v !== null && typeof v !== "undefined") {
        a.push({ name: this.name, value: v });
      }
    });

    // hand off to jQuery.param for proper encoding
    return urlencode(a);
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
    const val = [];

    for (let i = 0, max = this.length; i < max; i++) {
      const el = this[i];
      const v = $.fieldValue(el, successful);

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
  $.fieldValue = fieldValue;

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
  $.fn.clearFields = function (includeHidden) {
    const re =
      /^(?:color|date|datetime-local|email|month|number|password|range|search|tel|text|time|url|week)$/i; // 'hidden' is not in this list

    return this.each(function () {
      const t = this.type,
        tag = tagName(this);

      if (re.test(t) || tag === "textarea") {
        this.value = "";
      } else if (t === "checkbox" || t === "radio") {
        this.checked = false;
      } else if (tag === "select") {
        this.selectedIndex = -1;
      } else if (t === "file") {
        $(this).val("");
      } else if (includeHidden) {
        // includeHidden can be the value true, or it can be a selector string
        // indicating a special test; for example:
        // $('#myForm').clearForm('.special:hidden')
        // the above would clean hidden inputs that have the class of 'special'.
        // The selector tests the element alone and is never parsed as HTML.
        if (
          (includeHidden === true && /hidden/.test(t)) ||
          (typeof includeHidden === "string" && $.filter(includeHidden, [this]).length)
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
      const el = $(this);
      const tag = tagName(this);

      switch (tag) {
        case "input":
          this.checked = this.defaultChecked;

          // as the native reset: types whose value is the value attribute keep it
          if (this.type === "file") {
            // a file input cannot take its value attribute; the native reset empties it
            this.value = "";
          } else if (!/^(?:checkbox|radio|hidden|submit|reset|button|image)$/.test(this.type)) {
            this.value = this.defaultValue;
          }

          return true;

        case "textarea":
          this.value = this.defaultValue;

          return true;

        case "option":
        case "optgroup": {
          const select = el.parents("select");

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
        }

        case "select":
          // in order, as the native reset: of several default options, a single select keeps the last
          el.find("option").each(function () {
            this.selected = this.defaultSelected;
          });

          return true;

        case "label": {
          // The control whose id the for attribute names, and the controls inside the label. The
          // filter keeps a for that names an ancestor from resetting the label again.
          const forEl = this.htmlFor && this.ownerDocument.getElementById(this.htmlFor);

          el.find("input,select,textarea").add(forEl).filter("input,select,textarea").resetForm();

          return true;
        }

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
      const t = this.type;

      if (t === "checkbox" || t === "radio") {
        this.checked = select;
      } else if (tagName(this) === "option") {
        const $sel = $(this).parent("select");

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
