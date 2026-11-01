import { closestByTag, formMember } from "./form-members.js";
import jQuery from "jquery";

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
export function captureSubmitter(e) {
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
 * The form's submitter as { el, x, y } (x and y for an image button), or null.
 */
export function submitterOf(form) {
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
export function submitterFields(form) {
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
export function submitterElement(form) {
  var sub = submitterOf(form);

  return sub ? sub.el : null;
}
