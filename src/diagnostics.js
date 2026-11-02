import jQuery from "jquery";

// Debug logging, switched on by $.fn.ajaxSubmit.debug. The flag is read on every call, so it can
// be turned on after the plugin loads.
export function log() {
  if (!jQuery.fn.ajaxSubmit.debug) {
    return;
  }

  var msg = "[jquery.form] " + Array.prototype.join.call(arguments, "");

  window.console.log(msg);
}

var warned = {};

/**
 * A deprecation warning: console.warn, only while debug is on, once per id per page. The message
 * names the replacement; the warning adds that the feature is removed in 5.0.
 */
export function deprecate(id, message) {
  if (!jQuery.fn.ajaxSubmit.debug || warned[id]) {
    return;
  }

  warned[id] = true;
  window.console.warn("[jquery.form] " + message + " (removed in 5.0)");
}

// Forgets which deprecations have warned (for tests).
export function resetDeprecations() {
  warned = {};
}

// True for a jQuery version string older than 3.5.
export function beforeJQuery35(version) {
  var parts = String(version).split(".");
  var major = Number(parts[0]);

  return major < 3 || (major === 3 && Number(parts[1]) < 5);
}

/**
 * 5.0 needs jQuery 3.5 or later: ajaxSubmit and ajaxForm throw on an older version before any
 * event or callback. Nothing checks at load, so the plugin can still be installed on the page.
 */
export function requireJQuery35(version) {
  if (beforeJQuery35(version)) {
    throw new Error("jquery.form 5 needs jQuery 3.5 or later; this is " + version);
  }
}
