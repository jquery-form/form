import { closestByTag, formMember, isDisabled } from "./form-members.js";
import jQuery from "jquery";

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
export function captureSubmitter(e) {
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
export function captureEventSubmitter(e, form) {
  const el = e.originalEvent && e.originalEvent.submitter;

  if (el && !submitterOf(form)) {
    record(form, el, 0, 0);
  }
}

/**
 * The form's submitter as { el, x, y } (x and y for an image button), or null.
 */
export function submitterOf(form) {
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
export function imageFields(sub) {
  const prefix = sub.el.name ? sub.el.name + "." : "";

  return [
    { name: prefix + "x", value: sub.x },
    { name: prefix + "y", value: sub.y },
  ];
}

/**
 * The submitter and its fields for a post that adds them itself (the iframe upload), as
 * { el, fields: [{ name, value }] }, or null when no submitter is sent.
 */
export function submitterFields(form) {
  const sub = submitterOf(form);
  const el = sub && sub.el;

  // a disabled button is not sent, also when a disabled fieldset disables it
  if (!el || isDisabled(el)) {
    return null;
  }

  if (el.type === "image") {
    return { el, fields: imageFields(sub) };
  }

  return el.name ? { el, fields: [{ name: el.name, value: el.value }] } : null;
}

/**
 * The form's submitter element, or null.
 */
export function submitterElement(form) {
  const sub = submitterOf(form);

  return sub ? sub.el : null;
}
