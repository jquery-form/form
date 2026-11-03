import { callFormMethod, formMember, isDisabled, tagName } from "./form-members.js";
import { imageFields, submitterElement, submitterOf } from "./submitter.js";
import jQuery from "jquery";

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
export function isSuccessful(el, submitter) {
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
export function valueOf(el) {
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
export function fieldValue(el, successful) {
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

export function wellFormed(value) {
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
export function wellFormedData(data) {
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
export function urlencode(fields, traditional) {
  return jQuery.param(urlencodedFields(fields), traditional).replace(/%20/g, "+");
}

export function urlencodedFields(fields) {
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
export function createSuccessfulControls() {
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

    return [{ name: n, value: v, type: el.type, required: el.required }];
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
