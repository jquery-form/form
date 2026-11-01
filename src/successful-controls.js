import { callFormMethod, formMember, isElement, tagName } from "./form-members.js";
import { formAttribute } from "./form-attributes.js";
import jQuery from "jquery";

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
export function isSuccessful(el, submitter) {
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
export function valueOf(el) {
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
export function urlencodedFields(fields) {
  return jQuery.map(fields, function (field) {
    return field.type === "file" && typeof field.value !== "string"
      ? { name: field.name, value: field.value.name }
      : field;
  });
}

/**
 * The serialization steps. `feature` holds what the entry detected at load (fileapi).
 */
export function createSuccessfulControls(feature) {
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
  function imageFields(form, input, type) {
    var n = input.name;
    var value = { name: n, value: $(input).val() };

    if (type) {
      value.type = type;
    }

    return [value, { name: n + ".x", value: form.clk_x }, { name: n + ".y", value: form.clk_y }];
  }

  // Adds one candidate control's fields, and the control when it has a value to send.
  function addCandidate(collected, form, el, semantic) {
    if (!el.name || isDisabled(el) || rUnsubmittable.test(tagName(el))) {
      return;
    }

    if (semantic && form.clk && el.type === "image") {
      // handle image inputs on the fly when semantic == true
      if (form.clk === el) {
        collected.fields.push.apply(collected.fields, imageFields(form, el, el.type));
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
    var input = form.clk && $(form.clk)[0];

    if (input && input.name && !isDisabled(input) && input.type === "image") {
      collected.fields.push.apply(collected.fields, imageFields(form, input));
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
