import jQuery from "jquery";
import { keepContext } from "./options.js";

// The XMLHttpRequest transports: $.ajax with the encoded fields, or FormData for file uploads.
var $ = jQuery;

// utility fn for deep serialization: [name, value] pairs, as $.param encodes them
export function deepSerialize(extraData, traditional) {
  var param = $.param(extraData, traditional);
  var serialized = param ? param.split("&") : [];
  var len = serialized.length;
  var result = [];
  var i, part;

  for (i = 0; i < len; i++) {
    // #252; undo param space replacement
    serialized[i] = serialized[i].replace(/\+/g, " ");
    part = serialized[i].split("=");
    // #278; use array instead of object storage, favoring array serializations
    result.push([decodeURIComponent(part[0]), decodeURIComponent(part[1])]);
  }

  return result;
}

/**
 * Posts the fields and extraData as FormData, for files with the File API.
 * XMLHttpRequest Level 2 file uploads (big hat tip to francois2metz)
 */
export function sendFormData(submission) {
  var options = submission.options;
  var a = submission.fields;

  var formdata = new FormData();

  for (var i = 0; i < a.length; i++) {
    formdata.append(a[i].name, a[i].value);
  }

  if (options.extraData) {
    var serializedData = deepSerialize(options.extraData, submission.traditional);

    for (i = 0; i < serializedData.length; i++) {
      formdata.append(serializedData[i][0], serializedData[i][1]);
    }
  }

  options.data = null;

  var s = $.extend(true, {}, $.ajaxSettings, options, {
    contentType: false,
    processData: false,
    cache: false,
    type: submission.method || "POST",
  });

  keepContext(s, [$.ajaxSettings, options]);

  if (options.uploadProgress) {
    // workaround because jqXHR does not expose upload property: wraps the xhr factory, the
    // caller's or jQuery's
    var createXhr = s.xhr;

    s.xhr = function () {
      var xhr = createXhr.call(this);

      if (xhr.upload) {
        xhr.upload.addEventListener(
          "progress",
          function (event) {
            var percent = 0;
            // event.position is the deprecated name, read only when loaded is missing
            var position = event.loaded !== undefined ? event.loaded : event.position;
            var total = event.total;

            if (event.lengthComputable) {
              percent = Math.ceil((position / total) * 100);
            }

            options.uploadProgress(event, position, total, percent);
          },
          false
        );
      }

      return xhr;
    };
  }

  s.data = null;

  var beforeSend = s.beforeSend;

  s.beforeSend = function (xhr, o) {
    // Send FormData() provided by user
    if (options.formData) {
      o.data = options.formData;
    } else {
      o.data = formdata;
    }

    if (beforeSend) {
      beforeSend.call(this, xhr, o);
    }
  };

  return $.ajax(s);
}

/**
 * Sends the encoded fields with $.ajax.
 */
export function sendAjax(submission) {
  return $.ajax(submission.options);
}
