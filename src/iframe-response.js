import jQuery from "jquery";
import { log } from "./diagnostics.js";

// The iframe response reader: turns the frame's document into the mock xhr's text, XML, status
// and dataType, then parses it as $.ajax would (dataFilter, JSON, script).
var $ = jQuery;

/** The frame's document, or null when the same-origin policy denies access to it. */
export function getDoc(frame) {
  return frame.contentDocument;
}

/** Parses the response text or XML for the given (lowercase) dataType. */
export function httpData(xhr, type, s) {
  // mostly lifted from jq1.4.4

  var ct = xhr.getResponseHeader("content-type") || "",
    xml = (type === "xml" || !type) && ct.indexOf("xml") >= 0,
    data = xml ? xhr.responseXML : xhr.responseText;

  if (xml && data.documentElement.nodeName === "parsererror") {
    $.error("parsererror");
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
  xhr.responseXML = doc;
  if (isXml) {
    s.dataType = "xml";
  }
  xhr.getResponseHeader = function (header) {
    // the dataType in lowercase, as $.ajax reads it
    var headers = { "content-type": s.dataType && s.dataType.toLowerCase() };

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
      xhr.responseText = pre.textContent;
    } else if (b) {
      xhr.responseText = b.textContent;
    }
  }
}

/**
 * Reads and parses the response document into the mock xhr. Returns {status, data, errMsg}.
 */
export function readResponse(doc, xhr, s) {
  var status = "success",
    data,
    errMsg;

  try {
    var isXml = /^xml$/i.test(s.dataType) || $.isXMLDoc(doc);

    log("isXml=" + isXml);
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
