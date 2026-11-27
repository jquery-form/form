import jQuery from "jquery";

// Debug logging, switched on by $.fn.ajaxSubmit.debug. The flag is read on every call, so it can
// be turned on after the plugin loads.
export function log() {
  if (!jQuery.fn.ajaxSubmit.debug) {
    return;
  }

  const msg = "[jquery.form] " + Array.prototype.join.call(arguments, "");

  window.console.log(msg);
}

// True for a jQuery version string older than 3.5.
export function beforeJQuery35(version) {
  const parts = String(version).split(".");
  const major = Number(parts[0]);

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
