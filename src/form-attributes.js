import { callFormMethod, isElement } from "./form-members.js";
import jQuery from "jquery";

/**
 * An attribute of a form, or undefined when it is absent, as jQuery's attr returns it. The
 * subject may also be the document or a plain object, read through jQuery.
 */
export function formAttribute(form, name) {
  if (!isElement(form)) {
    return jQuery(form).attr(name);
  }

  var value = callFormMethod(form, "getAttribute", name);

  return value === null ? undefined : value;
}
