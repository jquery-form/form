---
---

## ajaxForm and ajaxSubmit Options

Both `ajaxForm` and `ajaxSubmit` support numerous options which can be provided using plain JavaScript `options` object containing any of the options below:  
**Note:** Aside from the options listed below, you can also pass any of the standard [$.ajax settings](https://api.jquery.com/jQuery.ajax/#jQuery-ajax-settings) to ajaxForm and ajaxSubmit.

### beforeFormUnbind

Default: `null`  
Callback function invoked by `ajaxForm` just before it removes the form's handlers and binds them again, so it runs each time `ajaxForm` is called on the form. It provides a chance to manipulate the form before the events are bound again. It is invoked with two arguments: the jQuery object for the form, and the Options Object passed into `ajaxForm`. It is not called for a `delegation` binding.

```javascript
beforeFormUnbind: function($form, options) {
  // your callback code
}
```

### beforeSerialize

Default: `null`  
Callback function to be invoked before the form is serialized. This provides an opportunity to manipulate the form before it's values are retrieved. The `beforeSerialize` function is invoked with two arguments: the jQuery object for the form, and the Options Object passed into ajaxForm/ajaxSubmit.

```javascript
beforeSerialize: function($form, options) {
  // return false to cancel submit
}
```

### beforeSubmit

Default: `null`  
Callback function to be invoked before the form is submitted. The 'beforeSubmit' callback can be provided as a hook for running pre-submit logic or for validating the form data. If the 'beforeSubmit' callback returns false then the form will not be submitted. The 'beforeSubmit' callback is invoked with three arguments: the form data in array format, the jQuery object for the form, and the Options Object passed into ajaxForm/ajaxSubmit.

```javascript
beforeSubmit: function(arr, $form, options) {
  // The array of form data takes the following form:
  // [ { name: 'username', value: 'jresig' }, { name: 'password', value: 'secret' } ]

  // return false to cancel submit
}
```

### clearForm

Default: `null`  
Boolean flag indicating whether the form should be cleared if the submit is successful

### data

Default: `{}`  
An object containing extra data that should be submitted along with the form.

```javascript
data: { key1: 'value1', key2: 'value2' }
```

### dataType

Default: `null`  
Expected data type of the response. One of: null, 'xml', 'script', or 'json'. The `dataType` option provides a means for specifying how the server response should be handled. It is passed to `$.ajax` as its `dataType`; the iframe transport parses the response the same way. The following values are supported:

**'xml'**: if dataType == 'xml' the server response is treated as XML and the 'success' callback method, if specified, will be passed the responseXML value

**'json'**: if dataType == 'json' the server response will be evaluted and passed to the 'success' callback, if specified

**'script'**: if dataType == 'script' the server response is evaluated in the global context

### delegation

Default: `undefined`  
A selector string, or `true`, to handle forms through a binding on the document, so forms added later are handled too (`ajaxForm` only; requires jQuery 1.7+). With a selector, a form is submitted through the plugin when it, or an element around it, matches the selector; the selection is ignored, and binding the same selector again replaces its options. An empty string throws an error. `ajaxFormUnbind()` removes every delegated binding; `ajaxFormUnbind(selector)` removes one.

```javascript
$(document).ajaxForm({ delegation: "form.ajax" });
```

**Warning:** `delegation: true` binds **every form on the page** on jQuery 3 and later (jQuery 3.0 removed the selector it relied on), so the options (`data`, `headers`) go with any form's submission. The plugin logs a `console.warn` for each such call, even with `debug` off. Use a selector.

### error

Callback function to be invoked upon error. It is passed the following arguments:

1. `jqXHR`, object (the error response body is in `responseText`)
2. `textStatus`, string
3. `errorThrown`, string
4. `$form` jQuery object containing form element

### filtering

Default: `null`  
Callback function that filters the fields before they are serialized. It is called with each field element and its index, as `jQuery.map` calls its callback: return the element to keep it, or `null` or `undefined` to leave it out.

```javascript
filtering: function(el, index) {
  if (!$(el).hasClass("ignore")) {
    return el;
  }
}
```

### forceSync

Default: `false`  
Boolean value. Set to true to remove short delay before posting form when uploading files (or using the iframe option). The delay is used to allow the browser to render DOM updates prior to performing a native form submit. This improves usability when displaying notifications to the user, such as "Please Wait…" **(version added: 2.38)**

### iframe

Default: `false`  
Boolean flag indicating whether the form should always target the server response to an iframe. This is useful in conjuction with file uploads. See the [file upload example](examples.md#file-upload).

Without `FormData`, a form with a selected file or a multipart `enctype` also uses the iframe. Choosing it automatically is deprecated (a `debug` warning); 5.0 uses the iframe only when `iframe: true` is set.

The response is loaded as a document in the hidden iframe, with the same origin as the page, before the plugin reads it. The server must return a response that is safe to render as HTML:

- Send JSON and text as `text/plain`, or wrap them in a `<textarea>` with the content HTML-escaped (`&lt;`, `&amp;`). The plugin reads the first `<textarea>`; without one, a `json`, `script` or `text` response is read from the first `<pre>`, then from the `<body>` text.
- The iframe cannot see the HTTP status. Set `status` and `statusText` attributes on the `<textarea>` or the `<body>` to report one; otherwise the request succeeds whatever the server answered.
- A response is read as XML when `dataType` is `"xml"` or the browser parsed the document as XML (an XML content type).
- With `dataType: "script"`, the text is evaluated even when it is a server error page, because the iframe cannot tell. Return scripts only from endpoints you control.

### iframeSrc

Default: `about:blank`  
Default value for HTTPS pages: `javascript:false`  
String value that should be used for the iframe's src attribute when/if an iframe is used.

### iframeTarget

Default: `null`  
Identifies the iframe element to be used as the response target for file uploads. By default, the plugin will create a temporary iframe element to capture the response when uploading files. This options allows you to use an existing iframe if you wish. When using this option the plugin will make no attempt at handling the response from the server. **(version added: 2.76)**  
A string is only ever a selector, never parsed as HTML: one that starts with `<` matches nothing. **(since 4.6.0)**

### method

Default: value of form's `method` attribute (or `GET` if none found)  
The HTTP method to use for the request (e.g. 'POST', 'GET', 'PUT'). **(version added: 4.2.0)**  
The method is read after `beforeSubmit` and the `form-submit-validate` event, so a change made there is used by every transport. An iframe upload can only send `GET` or `POST`, as a native form submit does; with any other method it posts with the form's own `method`.

### replaceTarget

Default: `false`  
Optionally used along with the the [`target`](#target) option. Set to `true` if the target should be replaced or `false` if only the target _contents_ should be replaced. **(version added: 2.43)**

### requestFormat

Default: `null`  
Set to `"json"` to send the form as a JSON body instead of a urlencoded one ([#545](https://github.com/jquery-form/form/issues/545)). The fields become an object, a name used more than once becomes an array of its values, and an object [`data`](#data) option is merged over them. The request is sent with `contentType: "application/json; charset=UTF-8"`, replacing any `contentType` you pass. It needs a method with a body: a `GET` method (including a form without a `method` attribute) throws an error, as do a string `data` option, a selected file, a multipart form and the [`iframe`](#iframe) option. **(version added: 4.5.0)** Based on the idea in PR [#557](https://github.com/jquery-form/form/pull/557) by zhangciwu (changwei).

### resetForm

Default: `null`  
Boolean flag indicating whether the form should be reset if the submit is successful

### semantic

Default: `false`  
Boolean flag indicating whether data must be submitted in strict semantic order (slower). Note that the normal form serialization is done in semantic order with the exception of input elements of `type="image"`.  
**Note:** You should _only_ set the `semantic` option to `true` if your server has strict semantic requirements **and** your form contains an input element of `type="image"`.

### success

Default: `null`  
Callback function to be invoked after the form has been submitted. If a 'success' callback function is provided it is invoked after the response has been returned from the server. It is passed the following standard jQuery arguments:

1. `data`, formatted according to the dataType parameter or the dataFilter callback function, if specified
2. `textStatus`, string
3. `jqXHR`, object
4. `$form` jQuery object containing form element

### target

Default: `null`  
Identifies the element(s) in the page to be updated with the server response. This value may be specified as a jQuery selection string, a jQuery object, or a DOM element. A string is only ever a selector, never parsed as HTML: one that starts with `<` matches nothing. **(since 4.6.0)**

The response is inserted as HTML, as `$.fn.load` does, so the endpoint must return markup you trust. To sanitize it, filter it with [`dataFilter`](https://api.jquery.com/jQuery.ajax/#jQuery-ajax-settings), which runs before the response reaches the target on both the XHR and the iframe transport:

```javascript
$("#myForm").ajaxForm({
  target: "#output",
  dataFilter: function (html) {
    return DOMPurify.sanitize(html);
  },
});
```

Sanitizing needs jQuery 3.5 or later: older versions rewrite some markup when it is inserted, after the sanitizer has run.

### type

Default: value of form's `method` attribute (or 'GET' if none found)  
The HTTP method to use for the request (e.g. 'POST', 'GET', 'PUT').  
An alias for `method` option. Overridden by the `method` value if both are present.

### uploadProgress

Default: `null`  
Callback function to be invoked with upload progress information (if supported by the browser). The callback is passed the following arguments:

1. event; the browser event
2. position (integer)
3. total (integer)
4. percentComplete (integer)

### url

Default: value of form's `action` attribute  
URL to which the form data will be submitted.

## Trusted options

These options are trusted input only: pass values your code controls, never values taken from users, the URL or a response.

- `url`, and the form's `action`
- `target` and `replaceTarget`
- `iframeSrc` and `iframeTarget`
- `closeKeepAlive`, which is deprecated: it works around a Safari 3/4 bug, warns under `debug` and is removed in 5.0
- `dataType: "script"`, which evaluates the response
- the keys of `data` and `extraData` (values may come from users)
- the `includeHidden` selector of `clearForm` and `clearFields`

## Example

```javascript
// prepare Options Object
var options = {
  target: "#divToUpdate",
  url: "comment.php",
  success: function () {
    alert("Thanks for your comment!");
  },
};

// pass options to ajaxForm
$("#myForm").ajaxForm(options);
```
