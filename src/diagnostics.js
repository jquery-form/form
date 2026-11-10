import jQuery from "jquery";

// Debug logging, switched on by $.fn.ajaxSubmit.debug. The flag is read on every call, so it can
// be turned on after the plugin loads.
export function log() {
  if (!jQuery.fn.ajaxSubmit.debug) {
    return;
  }

  var msg = "[jquery.form] " + Array.prototype.join.call(arguments, "");

  if (window.console && window.console.log) {
    window.console.log(msg);
  } else if (window.opera && window.opera.postError) {
    window.opera.postError(msg);
  }
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

  if (window.console && typeof window.console.warn === "function") {
    window.console.warn("[jquery.form] " + message + " (removed in 5.0)");
  }
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

// 5.0 needs jQuery 3.5 or later: warned on the first ajaxSubmit or ajaxForm, given jQuery's version.
export function deprecateOldJQuery(version) {
  if (beforeJQuery35(version)) {
    deprecate(
      "jquery",
      "support for jQuery " + version + " is deprecated, 5.0 needs jQuery 3.5 or later"
    );
  }
}
