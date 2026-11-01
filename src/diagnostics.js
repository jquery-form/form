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
