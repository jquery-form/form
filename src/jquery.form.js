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
import { ajaxForm, ajaxFormUnbind } from "./ajax-form.js";
import {
  clearFields,
  clearForm,
  enable,
  fieldSerialize,
  fieldValues,
  resetForm,
  selected,
} from "./field-helpers.js";
import { createSuccessfulControls, fieldValue, urlencode } from "./successful-controls.js";
import { log, requireJQuery35 } from "./diagnostics.js";
import { sendAjax, sendFormData } from "./xhr-transport.js";
import { createIframeTransport } from "./iframe-transport.js";
import { createSubmission } from "./submission.js";
import { formAttribute } from "./form-attributes.js";
import jQuery from "jquery";
import { submitOptions } from "./options.js";

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

  $.fn.fieldSerialize = fieldSerialize;
  $.fn.fieldValue = fieldValues;
  $.fn.clearForm = clearForm;
  $.fn.clearFields = clearFields;
  $.fn.resetForm = resetForm;
  $.fn.enable = enable;
  $.fn.selected = selected;

  /**
   * Returns the value of the field element.
   */
  $.fieldValue = fieldValue;

  // expose debug var
  $.fn.ajaxSubmit.debug = false;
})(jQuery);

export default jQuery;
