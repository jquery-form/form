---
---

## Examples

These examples need jQuery 3.5 or later. Each one shows the form markup, the JavaScript, and what the server is expected to send back. The URLs (`/comments`, `/echo`) stand for endpoints on your own server.

### ajaxForm

`ajaxForm` binds a form so that submitting it sends an AJAX request instead of loading a new page. It includes the submit button that was clicked, and the click coordinates of an `<input type="image">`. This example adds a callback before and after the request.

```html
<form id="commentForm" action="/comments" method="post">
  <input type="hidden" name="postId" value="42" />
  <label>Name: <input name="name" type="text" /></label>
  <label>Comment: <textarea name="comment" rows="3"></textarea></label>
  <button type="submit" name="action" value="save">Save</button>
  <button type="submit" name="action" value="preview">Preview</button>
</form>

<div id="commentOutput"></div>
```

```javascript
$(() => {
  $("#commentForm").ajaxForm({
    target: "#commentOutput", // element to fill with the server's HTML response
    beforeSubmit: showRequest,
    success: showResponse,

    // Other options include url, method, dataType, clearForm and resetForm;
    // $.ajax options such as timeout work too. See the Options page.
  });
});

// Called before the request; return false to cancel it.
function showRequest(formData, $form, options) {
  // formData is an array of { name, value } objects, e.g.
  // [{ name: "postId", value: "42" }, ..., { name: "action", value: "save" }]
  console.log("About to send:", $.param(formData));
  return true;
}

// Called when the request succeeds.
function showResponse(data, statusText, xhr, $form) {
  // data is the response text here; with dataType "json" or "xml" it is the
  // parsed object or document. The target has already been updated.
  console.log("Status:", statusText);
}
```

The request contains `postId`, `name`, `comment` and the clicked button's `action`, the same fields a normal submission sends. The server answers with an HTML fragment, such as `<p>Comment saved.</p>`, which replaces the contents of `#commentOutput`.

#### Forms Added Later

To handle forms that are added to the page after it loads, bind by selector with the [`delegation`](options.md#delegation) option. The binding is on the document, so the selection `ajaxForm` is called on does not matter:

```javascript
$(document).ajaxForm({ delegation: "form.ajax", target: "#commentOutput" });
```

---

### ajaxSubmit

`ajaxSubmit` sends the form once, right away. Call it from your own submit handler when you want to decide each time whether and how to send:

```javascript
$(() => {
  $("#commentForm").on("submit", function (event) {
    // Stop the browser's own submission and page load
    event.preventDefault();

    $(this).ajaxSubmit({
      target: "#commentOutput",
      beforeSubmit: showRequest,
      success: showResponse,
    });
  });
});
```

`ajaxSubmit` does not know which button was clicked; only `ajaxForm` records it. If the server needs the button's value, use `ajaxForm`, or add the value with the [`data`](options.md#data) option.

---

### Validation

The [`beforeSubmit`](options.md#beforesubmit) callback runs before the request is sent. If it returns `false`, nothing is sent. The examples below each check that both fields of this login form are filled in:

```html
<form id="loginForm" action="/login" method="post">
  <label>Username: <input type="text" name="username" /></label>
  <label>Password: <input type="password" name="password" /></label>
  <button type="submit">Log in</button>
</form>
```

```javascript
$(() => {
  $("#loginForm").ajaxForm({ beforeSubmit: validate });
});
```

#### Validate Using the `formData` Argument

```javascript
function validate(formData, $form, options) {
  // formData holds every field that will be sent:
  // [{ name: "username", value: "..." }, { name: "password", value: "..." }]
  const empty = formData.some((field) => !field.value);
  if (empty) {
    alert("Please enter a username and a password.");
    return false;
  }
}
```

#### Validate Using the `$form` Argument

```javascript
function validate(formData, $form, options) {
  // $form is a jQuery object wrapping the form element
  const form = $form[0];
  if (!form.username.value || !form.password.value) {
    alert("Please enter a username and a password.");
    return false;
  }
}
```

#### Validate Using the `fieldValue` Method

```javascript
function validate(formData, $form, options) {
  // fieldValue returns an array of the values each control would send
  const username = $form.find("input[name=username]").fieldValue();
  const password = $form.find("input[name=password]").fieldValue();
  if (!username[0] || !password[0]) {
    alert("Please enter a username and a password.");
    return false;
  }
}
```

#### Browser Validation

Attributes such as `required`, `pattern` and `type="email"` work with `ajaxForm`. When a user submits a form whose fields are not valid, the browser shows its own messages and does not fire the `submit` event, so no request is sent. `ajaxSubmit` called from your own code does not check them; call `form.reportValidity()` first if you need to.

---

### JSON

With `dataType: "json"`, the response is parsed and `success` receives the resulting object.

```html
<form id="jsonForm" action="/echo" method="post">
  <label>Message: <input type="text" name="message" value="Hello JSON" /></label>
  <button type="submit">Echo as JSON</button>
</form>
```

```javascript
$(() => {
  $("#jsonForm").ajaxForm({
    dataType: "json",
    success: (data) => {
      alert(data.message);
    },
  });
});
```

The server sends `{"message": "Hello JSON"}` with the content type `application/json`. In PHP, `json_encode` takes care of quoting and escaping:

```php
<?php
header('Content-Type: application/json');
echo json_encode(['message' => $_POST['message'] ?? '']);
```

---

### XML

With `dataType: "xml"`, `success` receives the parsed XML document.

```javascript
$(() => {
  $("#xmlForm").ajaxForm({
    dataType: "xml",
    success: (responseXML) => {
      const message = $("message", responseXML).text();
      alert(message);
    },
  });
});
```

The server sends `<root><message>Hello XML</message></root>` with an XML content type, and escapes the text it puts in the document:

```php
<?php
header('Content-Type: text/xml');
echo '<root><message>' . htmlspecialchars($_POST['message'] ?? '', ENT_XML1) . '</message></root>';
```

---

### HTML

With the [`target`](options.md#target) option, the HTML response is inserted into the target element, here `#htmlOutput`:

```javascript
$(() => {
  $("#htmlForm").ajaxForm({
    target: "#htmlOutput",
    success: () => {
      $("#htmlOutput").fadeIn("slow");
    },
  });
});
```

The response is inserted as HTML, as `$.fn.load` does, and its scripts run. It must come from your own server, and the server must escape anything a user typed:

```php
<?php
echo '<p class="echo">' . htmlspecialchars($_POST['message'] ?? '') . '</p>';
```

---

### File Upload

Forms with file inputs need no special code. Files are sent with [FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData) over `XMLHttpRequest`, and the [`uploadProgress`](options.md#uploadprogress) callback reports progress as the upload proceeds:

```html
<form id="uploadForm" action="/upload" method="post" enctype="multipart/form-data">
  <label>File: <input type="file" name="file" /></label>
  <button type="submit">Upload</button>
</form>
<div id="uploadOutput"></div>
```

```javascript
$(() => {
  $("#uploadForm").ajaxForm({
    uploadProgress: (event, position, total, percentComplete) => {
      $("#uploadOutput").text(percentComplete + "%");
    },
    success: () => {
      $("#uploadOutput").text("Done");
    },
  });
});
```

#### Uploading Through an Iframe

With the [`iframe: true`](options.md#iframe) option, the plugin instead posts the form to a hidden iframe, as a normal form submission. It cannot report progress, and the server's response is loaded as a page in the iframe before the plugin reads it. Send a JSON or script response as `text/plain`, or HTML-escaped inside a `<textarea>`, so that it survives being loaded as a page. The iframe transport is kept in 5.0 and may be removed in 6.0. If you use it, comment on [issue #629](https://github.com/jquery-form/form/issues/629) with your use case.

Iframe uploads do not send the `X-Requested-With: XMLHttpRequest` header that jQuery adds to its own same-origin requests. A server that answers both kinds can use the header to decide whether to wrap its response:

```php
<?php
$json = json_encode(['saved' => true]);
if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') === 'XMLHttpRequest') {
  header('Content-Type: application/json');
  echo $json;
} else {
  echo '<textarea>' . htmlspecialchars($json) . '</textarea>';
}
```
