import { callFormMethod } from "./form-members.js";
import { deepSerialize } from "./xhr-transport.js";
import jQuery from "jquery";
import { submitterFields } from "./submitter.js";

// The iframe form post: the extra fields (submitter, CSRF, data), the form attributes set while
// posting and restored after, and the native submit.
var $ = jQuery;

// The form attributes an iframe upload changes while it posts.
var uploadAttributes = ["action", "target", "method", "enctype", "encoding"];

// Called through the prototype: an extraData key or a form field may be named hasOwnProperty.
var hasOwn = Object.prototype.hasOwnProperty;

function isGet(method) {
  return /^get$/i.test(method);
}

// Resolves both URLs through anchors, as jQuery does for crossDomain, so IE's anchor quirks
// apply to both sides of the comparison.
function isSameOrigin(url) {
  var origin = document.createElement("a");
  var target = document.createElement("a");

  origin.href = window.location.href;
  target.href = url;
  // IE fills in the host of a relative URL only once the resolved href is assigned back
  target.href = target.href; // eslint-disable-line no-self-assign

  return origin.protocol + "//" + origin.host === target.protocol + "//" + target.host;
}

/** Adds the clicked submitter (and an image's coordinates) to s.extraData. */
export function addSubmitterFields(s, form) {
  // add submitting element to data if we know it
  var fields = submitterFields(form);

  for (var n in fields) {
    s.extraData = s.extraData || {};
    s.extraData[n] = fields[n];
  }
}

/** Adds the page's CSRF token to s.extraData when the form is posted to the page's origin. */
export function addCsrfField(s, form, method, forms) {
  // Rails CSRF hack (thanks to Yvan Barthelemy); like jquery-ujs, only for the page's origin and
  // only when the form is posted, since a get form would put the token in the url
  var csrf_token = $("meta[name=csrf-token]").attr("content");
  var csrf_param = $("meta[name=csrf-param]").attr("content");
  var posts =
    !isGet(method) &&
    (!method || /post/i.test(method) || /post/i.test(forms.property(form, "method")));

  if (csrf_param && csrf_token && posts && isSameOrigin(s.url)) {
    s.extraData = s.extraData || {};
    s.extraData[csrf_param] = csrf_token;
  }
}

function setFormAttribute(form, name, value) {
  callFormMethod(form, "setAttribute", name, value);
}

/** The raw attributes the upload changes, null when absent, to put back exactly (#380). */
export function saveAttributes(form) {
  var saved = {};

  $.each(uploadAttributes, function (i, name) {
    saved[name] = callFormMethod(form, "hasAttribute", name)
      ? callFormMethod(form, "getAttribute", name)
      : null;
  });

  return saved;
}

/** Puts back the attributes saveAttributes recorded, removing those that were absent. */
export function restoreAttributes(form, saved) {
  $.each(uploadAttributes, function (i, name) {
    if (saved[name] === null) {
      callFormMethod(form, "removeAttribute", name);
    } else {
      setFormAttribute(form, name, saved[name]);
    }
  });
}

/** Points the form at the frame `target` with the upload's url, method and encoding. */
export function setUploadAttributes(form, target, method, s, forms) {
  var mp = "multipart/form-data";

  // update form attrs in IE friendly way
  setFormAttribute(form, "target", target);
  if (!method || /post/i.test(method)) {
    setFormAttribute(form, "method", "POST");
  } else if (isGet(method) && !isGet(forms.property(form, "method"))) {
    // a form posts natively only with GET or POST; other verbs keep the form's own method
    setFormAttribute(form, "method", "GET");
  }
  setFormAttribute(form, "action", s.url);

  // ie borks in some cases when setting encoding
  if (!s.skipEncodingOverride && (!method || /post/i.test(method))) {
    setFormAttribute(form, "encoding", mp);
    setFormAttribute(form, "enctype", mp);
  }
}

/** Appends a hidden input per extraData field to the form; each input is pushed onto `added`. */
export function addExtraInputs(form, ownerDocument, extraData, traditional, added) {
  // Builds the input with DOM properties: a name is never parsed as HTML.
  function addHiddenInput(name, value) {
    var input = ownerDocument.createElement("input");

    input.type = "hidden";
    input.name = name;
    added.push($(input).val(value).appendTo(form)[0]);
  }

  if (extraData) {
    for (var n in extraData) {
      if (hasOwn.call(extraData, n)) {
        // if using the $.param format that allows for multiple values with the same name
        if (
          $.isPlainObject(extraData[n]) &&
          hasOwn.call(extraData[n], "name") &&
          hasOwn.call(extraData[n], "value")
        ) {
          addHiddenInput(extraData[n].name, extraData[n].value);
        } else {
          // arrays and objects become one field per value, as $.param sends them (#597)
          var single = {};

          single[n] = extraData[n];
          var fields = deepSerialize(single, traditional);

          for (var f = 0; f < fields.length; f++) {
            addHiddenInput(fields[f][0], fields[f][1]);
          }
        }
      }
    }
  }
}

/** Submits the form natively, even when a control named submit hides the method. */
export function submitForm(form) {
  try {
    form.submit();
  } catch (err) {
    // just in case form has element with name/id of 'submit'
    callFormMethod(form, "submit");
  }
}
