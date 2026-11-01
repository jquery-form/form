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
import { assertRealParent, callFormMethod, closestByTag, tagName } from "./form-members.js";
import {
  createSuccessfulControls,
  isSuccessful,
  urlencodedFields,
  valueOf,
} from "./successful-controls.js";
import { sendAjax, sendFormData } from "./xhr-transport.js";
import { shorthandOptions, submitOptions } from "./options.js";
import { createIframeTransport } from "./iframe-transport.js";
import { createSubmission } from "./submission.js";
import { formAttribute } from "./form-attributes.js";
import jQuery from "jquery";
import { log } from "./diagnostics.js";

(function ($) {
  "use strict";

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
      $(closestByTag(e.target, ["form"])).ajaxSubmit(options); // #365
    }
  }

  function captureSubmittingElement(e) {
    /* jshint validthis:true */
    assertRealParent(this);

    // the clicked control, or the button around the clicked content (ex: a span within a button)
    var target = closestByTag(e.target, ["button", "input"]);
    var $el = $(target);

    // the type property, unlike the attribute, is "submit" for a button without a type (#588)
    if (!target || (target.type !== "submit" && target.type !== "image")) {
      return;
    }

    var form = target.form;

    if (!form) {
      // a submit control that belongs to no form
      return;
    }

    form.clk = target;

    if (target.type === "image") {
      if (typeof e.offsetX !== "undefined") {
        form.clk_x = e.offsetX;
        form.clk_y = e.offsetY;
      } else if (typeof $.fn.offset === "function") {
        var offset = $el.offset();

        form.clk_x = e.pageX - offset.left;
        form.clk_y = e.pageY - offset.top;
      } else {
        form.clk_x = e.pageX - target.offsetLeft;
        form.clk_y = e.pageY - target.offsetTop;
      }
    }
    // clear form vars
    setTimeout(function () {
      form.clk = form.clk_x = form.clk_y = null;
    }, 100);
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

    if (required && !isSuccessful(el, el.form && el.form.clk)) {
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

export default jQuery;
