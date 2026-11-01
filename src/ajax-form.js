import { assertRealParent, closestByTag, formMember, isElement } from "./form-members.js";
import { captureEventSubmitter, captureSubmitter } from "./submitter.js";
import jQuery from "jquery";
import { log } from "./diagnostics.js";
import { shorthandOptions } from "./options.js";

// ajaxForm binding: the submit and click handlers that send a form through ajaxSubmit. The
// handlers look up $.fn.ajaxSubmit when they run, so a replacement installed later is used.

// Sends the submit event's form with ajaxSubmit, unless an earlier handler cancelled it.
function submitWith(e, options) {
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

function doAjaxSubmit(e) {
  submitWith(e, e.data);
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

// The element itself or its nearest ancestor that matches the selector. The walk never reads a
// parentNode a control can hide (jQuery's delegated walk does, and cycles on such a form).
function closestMatch(el, selector) {
  if (!isElement(el)) {
    return null;
  }

  if (window.Element && Element.prototype.closest) {
    return Element.prototype.closest.call(el, selector);
  }

  for (var node = el; node && isElement(node); node = formMember(node, "parentNode")) {
    if (jQuery(node).is(selector)) {
      return node;
    }
  }

  return null;
}

// The document handlers bound for each delegation selector, keyed by "s" + selector.
var delegated = {};

function unbindSelector(selector) {
  var handlers = delegated["s" + selector];

  if (handlers) {
    jQuery(document)
      .off("submit.form-plugin", handlers.submit)
      .off("click.form-plugin", handlers.click);
    delete delegated["s" + selector];
  }
}

// delegation: "<selector>": one handler pair on the document, scoped to the selector.
function bindSelector($sel, selector, options) {
  if (!selector) {
    throw new Error("jquery.form: delegation needs a selector, or true");
  }

  var handlers = {
    submit: function (e) {
      if (closestMatch(e.target, selector)) {
        submitWith(e, options);
      }
    },
    click: function (e) {
      if (closestMatch(e.target, selector)) {
        captureSubmitter(e);
      }
    },
  };

  unbindSelector(selector);
  delegated["s" + selector] = handlers;
  jQuery(document)
    .on("submit.form-plugin", handlers.submit)
    .on("click.form-plugin", handlers.click);

  return $sel;
}

// Passed by ajaxForm's own rebind: unbind the selection only, never the document handlers.
var selectionOnly = {};

/**
 * ajaxForm() binds the selected forms so a submit is sent with ajaxSubmit, with the clicked
 * submit button (and image coordinates) included. The options work as for ajaxSubmit.
 */
export function ajaxForm(options, data, dataType, onSuccess) {
  options = shorthandOptions(options, data, dataType, onSuccess) || {};

  if (typeof options.delegation === "string") {
    return bindSelector(this, options.delegation, options);
  }

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

  return this.ajaxFormUnbind(selectionOnly)
    .on("submit.form-plugin", options, doAjaxSubmit)
    .on("click.form-plugin", options, captureSubmittingElement);
}

/**
 * ajaxFormUnbind() removes the handlers ajaxForm bound on the selection and every delegated
 * binding on the document. ajaxFormUnbind(selector) removes only that delegation selector.
 */
export function ajaxFormUnbind(selector) {
  if (typeof selector === "string") {
    unbindSelector(selector);

    return this;
  }

  if (selector !== selectionOnly) {
    delegated = {};
    jQuery(document).off("submit.form-plugin click.form-plugin");
  }

  return this.off("submit.form-plugin click.form-plugin");
}
