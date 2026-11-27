---
---

## ajaxForm and ajaxSubmit Options

`ajaxForm` and `ajaxSubmit` take an options object with any of the options below. You can also pass any of the [`$.ajax` settings](https://api.jquery.com/jQuery.ajax/#jQuery-ajax-settings), such as `timeout` or `headers`; they are passed on to the request.

### beforeFormUnbind

Default: `null`  
Callback function invoked by `ajaxForm` just before it removes the form's handlers and binds them again, so it runs each time `ajaxForm` is called on the form. It provides a chance to manipulate the form before the events are bound again. It is invoked with two arguments: the jQuery object for the form, and the options object passed to `ajaxForm`. It is not called for a `delegation` binding.

```javascript
beforeFormUnbind: function ($form, options) {
  // your callback code
}
```

### beforeSerialize

Default: `null`  
Callback function to be invoked before the form is serialized. This provides an opportunity to manipulate the form before its values are read. Return `false` to cancel the submission. The `beforeSerialize` function is invoked with two arguments: the jQuery object for the form, and the options object passed to `ajaxForm` or `ajaxSubmit`.

```javascript
beforeSerialize: function ($form, options) {
  // return false to cancel submit
}
```

### beforeSubmit

Default: `null`  
Callback function to be invoked before the form is submitted, for running pre-submit logic or validating the form data. If it returns `false`, the form is not submitted. It is invoked with three arguments: the fields as an array of `{ name, value }` objects (the result of [`formToArray`](api.md#formtoarray)), the jQuery object for the form, and the options object passed to `ajaxForm` or `ajaxSubmit`.

```javascript
beforeSubmit: function (arr, $form, options) {
  // The array of form data takes the following form:
  // [ { name: 'username', value: 'jresig' }, { name: 'password', value: 'secret' } ]

  // return false to cancel submit
}
```

### clearForm

Default: `false`  
Set to `true` to clear the form's fields after a successful submission, as [`clearForm()`](api.md#clearform) does. Hidden inputs are kept unless [`includeHidden`](#includehidden) says otherwise.

### data

Default: `{}`  
An object containing extra data that should be submitted along with the form.

```javascript
data: { key1: 'value1', key2: 'value2' }
```

### dataType

Default: `null`  
The expected type of the response, which decides how it is parsed before `success` receives it. It is passed to `$.ajax` as its `dataType`, so any `$.ajax` type works, such as `"text"` or `"html"`; the iframe transport parses the response the same way. Without it, jQuery picks the type from the response's content type. The common values are:

**`"xml"`**: the response is parsed as XML, and `success` receives the XML document.

**`"json"`**: the response is parsed as JSON, and `success` receives the resulting value.

**`"script"`**: the response is run as JavaScript in the global context. Use it only with endpoints you control (see [Trusted options](#trusted-options)).

### delegation

Default: `undefined`  
A selector string, to handle forms through a binding on the document, so forms added later are handled too (`ajaxForm` only). A form is submitted through the plugin when it, or an element around it, matches the selector. The selection `ajaxForm` is called on is ignored, so any selection works, such as `$(document)`; binding the same selector again replaces its options. `ajaxFormUnbind()` removes every delegated binding; `ajaxFormUnbind(selector)` removes one.

```javascript
$(document).ajaxForm({ delegation: "form.ajax" });
```

`delegation: true`, an empty string and any other truthy value that is not a string throw `Error: jquery.form: delegation needs a selector in 5.0, e.g. delegation: "form.ajax"`, before anything is bound. `false`, `null`, `undefined` and `0` mean no delegation.

### error

Default: `null`  
Callback function to be invoked when the request fails. It is passed the following arguments:

1. `jqXHR`, object (the error response body is in `responseText`)
2. `textStatus`, string
3. `errorThrown`, string
4. `$form`, the jQuery object for the form

### filtering

Default: `null`  
Callback function that filters the fields before they are serialized. It is called with each `button`, `input`, `select` and `textarea` to serialize, in tree order (for a form, the ones it owns, including controls outside it that name it in their `form` attribute), and its index, as `jQuery.map` calls its callback: return the element to keep it, or `null` or `undefined` to leave it out.

```javascript
filtering: function (el, index) {
  if (!$(el).hasClass("ignore")) {
    return el;
  }
}
```

The [`iframe`](#iframe) transport ignores `filtering`, because the browser posts the form itself.

### forceSync

Default: `false`  
Set to `true` to remove the short delay before the form is posted with the [`iframe`](#iframe) option. The delay lets the browser render DOM updates before the native submission, such as a "Please wait…" message. **(version added: 2.38)**

### iframe

Default: `false`  
Set to `true` to post the form through a hidden iframe, as a native form submission targeting the frame, instead of `XMLHttpRequest`. The iframe transport is used only when this option is truthy. Without it, a form with a selected file or a `multipart/form-data` enctype is sent with `FormData`, and [`uploadProgress`](#uploadprogress) reports its progress.

The iframe transport is kept in 5.0 and may be removed in 6.0. If you use `iframe: true`, comment on [issue #629](https://github.com/jquery-form/form/issues/629) with your use case.

The browser posts the form's own controls, so the [`filtering`](#filtering) option and changes that [`beforeSubmit`](#beforesubmit) makes to its fields array do not change what an iframe upload sends. The [`data`](#data) option and the clicked button are added as hidden fields.

The upload's jqXHR (`$form.data("jqxhr")`) resolves `.done` and `.then` with `(data, "success", xhr)`: the parsed data that `success` receives, as `$.ajax` does. Its rejections differ from `$.ajax`:

- An abort, through `abort(status)` on the jqXHR or on the `xhr` that callbacks receive, rejects with `(xhr, "aborted", status)`, where `status` is the argument passed to `abort` (`undefined` without one). `$.ajax` rejects with `(jqXHR, "canceled", "canceled")`, or with the text passed to `abort` in place of both.
- A `beforeSend` callback that returns `false` rejects with no arguments. `$.ajax` rejects with `(jqXHR, "canceled", "canceled")`.

The response is loaded as a document in the hidden iframe, with the same origin as the page, before the plugin reads it. The server must return a response that is safe to render as HTML:

- Send JSON and text as `text/plain`, or wrap them in a `<textarea>` with the content HTML-escaped (`&lt;`, `&amp;`). The plugin reads the first `<textarea>`; without one, a `json`, `script` or `text` response is read from the first `<pre>`, then from the `<body>` text.
- The iframe cannot see the HTTP status. Set `status` and `statusText` attributes on the `<textarea>` or the `<body>` to report one; otherwise the request succeeds whatever the server answered.
- A response is read as XML when `dataType` is `"xml"` or the browser parsed the document as XML (an XML content type).
- With `dataType: "script"`, the text is evaluated even when it is a server error page, because the iframe cannot tell. Return scripts only from endpoints you control.

### iframeSrc

Default: `about:blank`  
The `src` of the hidden iframe that the [`iframe`](#iframe) option creates. It is a [trusted option](#trusted-options).

### iframeTarget

Default: `null`  
An existing iframe to post [`iframe`](#iframe) uploads to, instead of the temporary iframe the plugin creates. With this option, the plugin does not read the server's response. **(version added: 2.76)**  
The value may be a selector string, a jQuery object, or a DOM element. A string is matched in the form's document with `jQuery.find` and is never parsed as HTML.

### includeHidden

Default: `undefined`  
Used with the [`clearForm`](#clearform) option: `true` also clears every hidden input, and a selector string clears the hidden inputs that match it. It is passed to [`clearForm()`](api.md#clearform) as its argument.

### method

Default: value of form's `method` attribute (or `GET` if none found)  
The HTTP method to use for the request (e.g. 'POST', 'GET', 'PUT'). **(version added: 4.2.0)**  
The method is read after `beforeSubmit` and the `form-submit-validate` event, so a change made there is used by every transport. An iframe upload can only send `GET` or `POST`, as a native form submit does; with any other method it posts with the form's own `method`.

### replaceTarget

Default: `false`  
Used with the [`target`](#target) option. Set to `true` to replace the target element itself with the response, or leave it `false` to replace only the target's _contents_. **(version added: 2.43)**

### requestFormat

Default: `null`  
Set to `"json"` to send the form as a JSON body instead of a urlencoded one ([#545](https://github.com/jquery-form/form/issues/545)). The fields become an object, a name used more than once becomes an array of its values, and an object [`data`](#data) option is merged over them. The request is sent with `contentType: "application/json; charset=UTF-8"`, replacing any `contentType` you pass. It needs a method with a body: a `GET` method (including a form without a `method` attribute) throws an error, as do a string `data` option, a selected file, a multipart form and the [`iframe`](#iframe) option. **(version added: 4.5.0)** Based on the idea in PR [#557](https://github.com/jquery-form/form/pull/557) by zhangciwu (changwei).

### resetForm

Default: `false`  
Set to `true` to reset the form after a successful submission, as [`resetForm()`](api.md#resetform) does.

### success

Default: `null`  
Callback function to be invoked when the server's response has arrived and the request succeeded. It is passed these arguments:

1. `data`, parsed according to the [`dataType`](#datatype) option, after any `dataFilter` callback
2. `textStatus`, string
3. `jqXHR`, object
4. `$form`, the jQuery object for the form

### target

Default: `null`  
Identifies the element(s) in the page to be updated with the server response. This value may be specified as a selector string, a jQuery object, or a DOM element. A string is matched with `jQuery.find` when the response arrives and is never parsed as HTML.

The response is inserted as HTML, as `$.fn.load` does, so the endpoint must return markup you trust. To sanitize it, filter it with [`dataFilter`](https://api.jquery.com/jQuery.ajax/#jQuery-ajax-settings), which runs before the response reaches the target on both the XHR and the iframe transport:

```javascript
$("#myForm").ajaxForm({
  target: "#output",
  dataFilter: function (html) {
    return DOMPurify.sanitize(html);
  },
});
```

### type

Default: value of form's `method` attribute (or 'GET' if none found)  
The HTTP method to use for the request (e.g. 'POST', 'GET', 'PUT').  
An alias for `method` option. Overridden by the `method` value if both are present.

### uploadProgress

Default: `null`  
Callback function to be invoked as an upload proceeds. It is not called for [`iframe`](#iframe) uploads. It is passed these arguments:

1. event; the browser event
2. position (integer)
3. total (integer)
4. percentComplete (integer)

### url

Default: the form's `action`  
The URL to send the form to. It is a [trusted option](#trusted-options).

## Trusted options

These options are trusted input only: pass values your code controls, never values taken from users, the URL or a response.

- `url`, and the form's `action`
- `iframeSrc`
- `dataType: "script"`, which evaluates the response
- the keys of `data` (values may come from users)

A string in `target`, `iframeTarget` or `includeHidden` (the option, or the argument of `clearForm` and `clearFields`) is only matched as a selector and never parsed as HTML.

## Differences from a native submission

The fields the plugin sends match a native submission of the form, in the same order, apart from the [`data`](#data) option and these deliberate differences:

- **A selected file makes the request multipart.** A form with a selected file is sent as a `multipart/form-data` `FormData` upload even when it has no `enctype="multipart/form-data"`. A native submission of such a form is urlencoded and sends only the file's name.
- **A `GET` request keeps the action's query.** With the `GET` method, the fields are added to the query string of [`url`](#url) (the form's `action` by default), after any query it already has. A native `GET` submission replaces the action's query with the fields, and so does the [`iframe`](#iframe) transport, which submits the form itself.
- **A clicked `<input type="submit">` without a `value` sends an empty value.** A native submission sends the browser's default label, which is localized and cannot be read from script.

## Example

```javascript
const options = {
  target: "#divToUpdate",
  url: "/comments",
  success: () => {
    alert("Thanks for your comment!");
  },
};

$("#myForm").ajaxForm(options);
```
