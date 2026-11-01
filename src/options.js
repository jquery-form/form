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

/**
 * The options ajaxSubmit starts from: a function is the success callback, the shorthand is
 * expanded, and no options at all is an empty object.
 */
export function submitOptions(options, data, dataType, onSuccess) {
  if (typeof options === "function") {
    return { success: options };
  }

  options = shorthandOptions(options, data, dataType, onSuccess);

  return typeof options === "undefined" ? {} : options;
}
