import { callFormMethod, tagName } from "./form-members.js";
import { fieldValue, urlencode } from "./successful-controls.js";
import jQuery from "jquery";

// The field helpers: $.fn methods that read, clear, reset, enable or select single fields. They
// are registered on $.fn by the entry, and call each other through $.fn, so a replaced method
// is used.
const $ = jQuery;

/**
 * Serializes all field elements in the jQuery object into a query string.
 * This method will return a string in the format: name1=value1&amp;name2=value2
 */
export function fieldSerialize(successful) {
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
}

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
export function fieldValues(successful) {
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
}

/**
 * Clears the form data. Takes the following actions on the form's input fields:
 *  - input text fields will have their 'value' property set to the empty string
 *  - select elements will have their 'selectedIndex' property set to -1
 *  - checkbox and radio inputs will have their 'checked' property set to false
 *  - inputs of type submit, button, reset, and hidden will *not* be effected
 *  - button elements will *not* be effected
 */
export function clearForm(includeHidden) {
  return this.each(function () {
    $("input,select,textarea", this).clearFields(includeHidden);
  });
}

/**
 * Clears the selected form elements.
 */
export function clearFields(includeHidden) {
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
}

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
export function resetForm() {
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
}

/**
 * Enables or disables any matching elements.
 */
export function enable(b) {
  if (typeof b === "undefined") {
    b = true;
  }

  return this.each(function () {
    this.disabled = !b;
  });
}

/**
 * Checks/unchecks any matching checkboxes or radio buttons and
 * selects/deselects and matching option elements.
 */
export function selected(select) {
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
}
