import { assertRealParent, closestByTag } from "./form-members.js";
import { captureEventSubmitter, captureSubmitter } from "./submitter.js";
import jQuery from "jquery";
import { log } from "./diagnostics.js";
import { shorthandOptions } from "./options.js";

// ajaxForm binding: the submit and click handlers that send a form through ajaxSubmit. The
// handlers look up $.fn.ajaxSubmit when they run, so a replacement installed later is used.

function doAjaxSubmit(e) {
  var options = e.data;

  if (!e.isDefaultPrevented()) {
    // if event has been canceled, don't proceed
    e.preventDefault();
    // the form is found through the real tree: a control named nodeType misleads jQuery's closest
    var form = closestByTag(e.target, ["form"]);

    // a button outside the form (form attribute), or requestSubmit(button), sends no click here
    captureEventSubmitter(e, form);
    jQuery(form).ajaxSubmit(options); // #365
  }
}

function captureSubmittingElement(e) {
  /* jshint validthis:true */
  assertRealParent(this);
  captureSubmitter(e);
}

// An empty selection: queued until the DOM is ready (old jQuery keeps the selector), or dropped.
function bindLater($sel, options) {
  var o = { s: $sel.selector, c: $sel.context };

  if (!jQuery.isReady && o.s) {
    log("DOM not ready, queuing ajaxForm");
    jQuery(function () {
      jQuery(o.s, o.c).ajaxForm(options);
    });

    return $sel;
  }

  // is your DOM ready?  http://docs.jquery.com/Tutorials:Introducing_$(document).ready()
  log("terminating; zero elements found by selector" + (jQuery.isReady ? "" : " (DOM not ready)"));

  return $sel;
}

function bindDelegated($sel, options) {
  jQuery(document)
    .off("submit.form-plugin", $sel.selector, doAjaxSubmit)
    .off("click.form-plugin", $sel.selector, captureSubmittingElement)
    .on("submit.form-plugin", $sel.selector, options, doAjaxSubmit)
    .on("click.form-plugin", $sel.selector, options, captureSubmittingElement);

  return $sel;
}

/**
 * ajaxForm() binds the selected forms so a submit is sent with ajaxSubmit, with the clicked
 * submit button (and image coordinates) included. The options work as for ajaxSubmit.
 */
export function ajaxForm(options, data, dataType, onSuccess) {
  options = shorthandOptions(options, data, dataType, onSuccess) || {};
  options.delegation = options.delegation && typeof jQuery.fn.on === "function";

  if (!options.delegation && this.length === 0) {
    return bindLater(this, options);
  }

  if (options.delegation) {
    return bindDelegated(this, options);
  }

  if (options.beforeFormUnbind) {
    options.beforeFormUnbind(this, options);
  }

  return this.ajaxFormUnbind()
    .on("submit.form-plugin", options, doAjaxSubmit)
    .on("click.form-plugin", options, captureSubmittingElement);
}

/**
 * ajaxFormUnbind() removes the handlers ajaxForm bound on the selection.
 */
export function ajaxFormUnbind() {
  return this.off("submit.form-plugin click.form-plugin");
}
