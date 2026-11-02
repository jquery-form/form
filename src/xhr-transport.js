import jQuery from "jquery";
import { keepContext } from "./options.js";
import { wellFormedData } from "./successful-controls.js";

// The XMLHttpRequest transports: $.ajax with the encoded fields, or FormData for file uploads.
const $ = jQuery;

// utility fn for deep serialization: [name, value] pairs, as $.param encodes them
export function deepSerialize(extraData, traditional) {
  const param = $.param(wellFormedData(extraData), traditional);
  const serialized = param ? param.split("&") : [];
  const len = serialized.length;
  const result = [];
  let i, part;

  for (i = 0; i < len; i++) {
    part = serialized[i].split("=");
    // #278; use array instead of object storage, favoring array serializations
    result.push([decodeURIComponent(part[0]), decodeURIComponent(part[1])]);
  }

  return result;
}

/**
 * Posts the fields and extraData as FormData, for files or a multipart form.
 * XMLHttpRequest Level 2 file uploads (big hat tip to francois2metz)
 */
export function sendFormData(submission) {
  const options = submission.options;
  const a = submission.fields;

  const formdata = new FormData();

  for (let i = 0; i < a.length; i++) {
    formdata.append(a[i].name, a[i].value);
  }

  if (options.extraData) {
    const serializedData = deepSerialize(options.extraData, submission.traditional);

    for (let i = 0; i < serializedData.length; i++) {
      formdata.append(serializedData[i][0], serializedData[i][1]);
    }
  }

  options.data = null;

  const s = $.extend(true, {}, $.ajaxSettings, options, {
    contentType: false,
    processData: false,
    cache: false,
    type: submission.method || "POST",
  });

  keepContext(s, [$.ajaxSettings, options]);

  if (options.uploadProgress) {
    // workaround because jqXHR does not expose upload property: wraps the xhr factory, the
    // caller's or jQuery's
    const createXhr = s.xhr;

    s.xhr = function () {
      const xhr = createXhr.call(this);

      if (xhr.upload) {
        xhr.upload.addEventListener(
          "progress",
          function (event) {
            let percent = 0;
            const position = event.loaded;
            const total = event.total;

            if (event.lengthComputable) {
              percent = Math.ceil((position / total) * 100);
            }

            options.uploadProgress(event, position, total, percent);
          },
          false,
        );
      }

      return xhr;
    };
  }

  s.data = null;

  const beforeSend = s.beforeSend;

  s.beforeSend = function (xhr, o) {
    // Send FormData() provided by user
    if (options.formData) {
      o.data = options.formData;
    } else {
      o.data = formdata;
    }

    // a veto (false) cancels the upload, as on the other transports
    return beforeSend ? beforeSend.call(this, xhr, o) : undefined;
  };

  return $.ajax(s);
}

/**
 * Sends the encoded fields with $.ajax.
 */
export function sendAjax(submission) {
  return $.ajax(submission.options);
}
