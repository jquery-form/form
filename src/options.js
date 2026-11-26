import jQuery from "jquery";
import { log } from "./diagnostics.js";

// The arguments ajaxSubmit and ajaxForm accept in place of an options object.

/**
 * Turns the (url, data, dataType, success) shorthand into options. A url of false is kept as
 * the url; anything else is returned as given.
 */
export function shorthandOptions(options, data, dataType, onSuccess) {
  if (typeof options !== "string" && options !== false) {
    return options;
  }

  var result = { url: options, data: data, dataType: dataType };

  if (typeof onSuccess === "function") {
    result.success = onSuccess;
  }

  return result;
}

// A copy of options without its url, so the form action is used.
function withoutUrl(options) {
  var result = {};

  for (var key in options) {
    if (key !== "url" && Object.prototype.hasOwnProperty.call(options, key)) {
      result[key] = options[key];
    }
  }

  return result;
}

/**
 * The options ajaxSubmit starts from: a function is the success callback, the shorthand is
 * expanded, and no options at all is an empty object. A url of false or "" means the form action.
 */
export function submitOptions(options, data, dataType, onSuccess) {
  if (typeof options === "function") {
    return { success: options };
  }

  options = shorthandOptions(options, data, dataType, onSuccess);

  if (typeof options === "undefined") {
    return {};
  }

  return options.url === false || options.url === "" ? withoutUrl(options) : options;
}

/**
 * jQuery treats `context` as a flat option: after a deep merge, the settings get back the
 * caller's own object from the last source that has one, so `this` in callbacks is that object.
 */
export function keepContext(settings, sources) {
  for (var i = 0; i < sources.length; i++) {
    if (sources[i].context !== undefined) {
      settings.context = sources[i].context;
    }
  }

  return settings;
}

/**
 * The elements a selector option (target, iframeTarget) names. A string is only ever a selector,
 * looked up in the document, so jQuery never builds elements from it; a string starting with "<"
 * is HTML, not a selector, and matches nothing. Elements and jQuery objects are used as given.
 */
export function selectorOption(value, ownerDocument) {
  if (typeof value !== "string") {
    return jQuery(value);
  }

  if (/^\s*</.test(value)) {
    log("ignoring HTML given as a selector: ", value);

    return jQuery([]);
  }

  return jQuery(ownerDocument || document).find(value);
}
