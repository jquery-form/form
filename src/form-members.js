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
export function formMember(form, name) {
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
export function callFormMethod(form, name) {
  var descriptor = findDescriptor(name);
  var method = descriptor ? descriptor.value : plainForm[name];

  return method.apply(form, Array.prototype.slice.call(arguments, 2));
}

// Nodes such as the document and text nodes have no tag name (#600).
export function tagName(el) {
  var name = formMember(el, "tagName");

  return typeof name === "string" ? name.toLowerCase() : "";
}

/**
 * Whether a control or option is disabled, also through a disabled fieldset or optgroup. Without
 * selector matching, only its own disabled property is read.
 */
export function isDisabled(el) {
  return typeof el.matches === "function" ? el.matches(":disabled") : !!el.disabled;
}

// Elements only: the subject of formToArray may also be the document or a plain object.
export function isElement(node) {
  return formMember(node, "nodeType") === 1;
}

// A control named parentNode makes every parentNode walk (jQuery's trigger and closest among
// them) cycle between the form and the control.
export function assertRealParent(el) {
  if (el.parentNode !== formMember(el, "parentNode")) {
    throw new Error(
      'jquery.form: a form control named "parentNode" hides the form\'s parentNode; rename the control'
    );
  }
}

// The element itself or its nearest ancestor with one of the tag names, through the real tree.
export function closestByTag(el, names) {
  for (var node = el; node; node = formMember(node, "parentNode")) {
    if (names.indexOf(tagName(node)) >= 0) {
      return node;
    }
  }

  return null;
}
