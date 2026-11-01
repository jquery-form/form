import jQuery from "jquery";
import { log } from "./diagnostics.js";

// The iframe response reader: turns the frame's document into the mock xhr's text, XML, status
// and dataType, then parses it as $.ajax would (dataFilter, JSON, script).
var $ = jQuery;

/** The frame's document, or null when the browser denies access to it. */
export function getDoc(frame) {
  /* it looks like contentWindow or contentDocument do not
   * carry the protocol property in ie8, when running under ssl
   * frame.document is the only valid response document, since
   * the protocol is know but not on the other two objects. strange?
   * "Same origin policy" http://en.wikipedia.org/wiki/Same_origin_policy
   */

  var doc = null;

  // IE8 cascading access check
  try {
    if (frame.contentWindow) {
      doc = frame.contentWindow.document;
    }
  } catch (err) {
    // IE8 access denied under ssl & missing protocol
    log("cannot get iframe.contentWindow document: " + err);
  }

  if (doc) {
    // successful getting content
    return doc;
  }

  try {
    // simply checking may throw in ie8 under ssl or mismatched protocol
    doc = frame.contentDocument ? frame.contentDocument : frame.document;
  } catch (err) {
    // last attempt
    log("cannot get iframe.contentDocument: " + err);
    doc = frame.document;
  }

  return doc;
}

/** Parses the response text or XML for the given (lowercase) dataType. */
export function httpData(xhr, type, s) {
  // mostly lifted from jq1.4.4

  var ct = xhr.getResponseHeader("content-type") || "",
    xml = (type === "xml" || !type) && ct.indexOf("xml") >= 0,
    data = xml ? xhr.responseXML : xhr.responseText;

  if (xml && data.documentElement.nodeName === "parsererror") {
    if ($.error) {
      $.error("parsererror");
    }
  }
  if (s && s.dataFilter) {
    data = s.dataFilter(data, type);
  }
  if (typeof data === "string") {
    if ((type === "json" || !type) && ct.indexOf("json") >= 0) {
      data = JSON.parse(data);
    } else if (type === "script") {
      $.globalEval(data);
    }
  }

  return data;
}

// Copies the status and statusText attributes of an element onto the mock xhr.
function readStatus(xhr, el) {
  // support for XHR 'status' & 'statusText' emulation :
  xhr.status = Number(el.getAttribute("status")) || xhr.status;
  xhr.statusText = el.getAttribute("statusText") || xhr.statusText;
}

// Fills the mock xhr from the document itself.
function readDocument(doc, xhr, s, isXml) {
  var docRoot = doc.body ? doc.body : doc.documentElement;

  xhr.responseText = docRoot ? docRoot.innerHTML : null;
  xhr.responseXML = doc.XMLDocument ? doc.XMLDocument : doc;
  if (isXml) {
    s.dataType = "xml";
  }
  xhr.getResponseHeader = function (header) {
    var headers = { "content-type": s.dataType };

    return headers[header.toLowerCase()];
  };
  if (docRoot) {
    readStatus(xhr, docRoot);
  }
}

// A response embedded in a textarea, or text wrapped in pre or body, replaces responseText.
function readEmbedded(doc, xhr, dt, s) {
  var scr = /(json|script|text)/.test(dt);

  if (!scr && !s.textarea) {
    return;
  }
  // see if user embedded response in textarea
  var ta = doc.getElementsByTagName("textarea")[0];

  if (ta) {
    xhr.responseText = ta.value;
    readStatus(xhr, ta);
  } else if (scr) {
    // account for browsers injecting pre around json response
    var pre = doc.getElementsByTagName("pre")[0];
    var b = doc.getElementsByTagName("body")[0];

    if (pre) {
      xhr.responseText = pre.textContent ? pre.textContent : pre.innerText;
    } else if (b) {
      xhr.responseText = b.textContent ? b.textContent : b.innerText;
    }
  }
}

/**
 * Reads and parses the response document into the mock xhr. Returns {status, data, errMsg}, or
 * null when `retry()` asks to read the document again later (Opera's untraversable DOM).
 */
export function readResponse(doc, xhr, s, retry) {
  var status = "success",
    data,
    errMsg;

  try {
    var isXml = s.dataType === "xml" || doc.XMLDocument || $.isXMLDoc(doc);

    log("isXml=" + isXml);

    if (!isXml && window.opera && (doc.body === null || !doc.body.innerHTML)) {
      // in some browsers (Opera) the iframe DOM is not always traversable when
      // the onload callback fires, so we loop a bit to accommodate
      if (retry()) {
        return null;
      }
      // let this fall through because server response could be an empty document
    }

    readDocument(doc, xhr, s, isXml);

    var dt = (s.dataType || "").toLowerCase();

    readEmbedded(doc, xhr, dt, s);

    try {
      data = httpData(xhr, dt, s);
    } catch (err) {
      status = "parsererror";
      xhr.error = errMsg = err || status;
    }
  } catch (err) {
    log("error caught: ", err);
    status = "error";
    xhr.error = errMsg = err;
  }

  return { status: status, data: data, errMsg: errMsg };
}
