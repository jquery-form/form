import { callFormMethod, formMember, isDisabled, isElement, tagName } from "./form-members.js";
import { submitterElement, submitterOf } from "./submitter.js";
import { formAttribute } from "./form-attributes.js";
import jQuery from "jquery";

// Successful controls: which controls of a form are sent, and as which name/value fields
// (https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#constructing-the-form-data-set).

// Line breaks, sent as CRLF
const rLineBreak = /\r\n|\r|\n/g;
const rCR = /\r/g;

// Listed form elements that are never submitted.
const rUnsubmittable = /^(?:fieldset|object|output)$/;

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
    const formId = formAttribute(form, "id");
    let els = formMember(form, "elements");

    if (semantic || typeof els === "undefined") {
      // the document is not an element; it has its own getElementsByTagName
      els = isElement(form)
        ? callFormMethod(form, "getElementsByTagName", "*")
        : form.getElementsByTagName("*");
    }

    els = $.makeArray(els);

    // the subject may also be a fieldset, the document or another container
    const owner = tagName(form) === "form" ? form : null;

    if (semantic && owner) {
      els = ownedBy(els, owner);
    }

    // outside fields are already included in form.elements
    if (formId && semantic) {
      els = els.concat(outsideControls(formId, els, owner));
    }

    return els;
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

  // The clicked image's value and coordinates.
  function imageFields(sub, input, type) {
    const n = input.name;
    const value = { name: n, value: $(input).val() };

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

    const sub = semantic && el.type === "image" && submitterOf(form);

    if (sub) {
      // handle image inputs on the fly when semantic == true
      if (sub.el === el) {
        collected.fields.push.apply(collected.fields, imageFields(sub, el, el.type));
      }

      return;
    }

    const own = fieldsOf(el);

    if (own) {
      collected.controls.push(el);
      collected.fields.push.apply(collected.fields, own);
    }
  }

  // input type=='image' are not found in elements array! handle it here
  function addClickedImage(collected, form) {
    const sub = submitterOf(form);
    const input = sub && $(sub.el)[0];

    if (input && input.name && !isDisabled(input) && input.type === "image") {
      collected.fields.push.apply(collected.fields, imageFields(sub, input));
    }
  }

  /**
   * The fields of a form, as formToArray returns them, and the controls they came from.
   */
  function collect(form, semantic, filtering) {
    const collected = { fields: [], controls: [] };

    if (!form) {
      return collected;
    }

    let els = controlsOf(form, semantic);

    if (typeof filtering === "function") {
      els = $.map(els, filtering);
    }

    for (let i = 0; i < els.length; i++) {
      addCandidate(collected, form, els[i], semantic);
    }

    if (!semantic) {
      addClickedImage(collected, form);
    }

    return collected;
  }

  return {
    controlsOf,
    fieldsOf,
    collect,
  };
}
