---
---

## API

The Form Plugin API provides several methods that allow you to easily manage form data and form submission.

### ajaxForm

Prepares a form to be submitted via AJAX by adding all of the necessary event listeners. It does **not** submit the form. Use `ajaxForm` in your document's `ready` function to prepare your form(s) for AJAX submission. `ajaxForm` takes zero or one argument. The single argument can be either a callback function or an [Options Object](options.md).  
Chainable: Yes.

**Note:** You can pass any of the standard [$.ajax settings](https://api.jquery.com/jQuery.ajax/#jQuery-ajax-settings) to ajaxForm

```javascript
$(function () {
  $("#myFormId").ajaxForm();
});
```

### ajaxFormUnbind

Removes the handlers `ajaxForm` bound on the selection, and every delegated binding (the `delegation` option) the plugin made on the document. `ajaxFormUnbind(selector)` removes only the delegated binding for that selector and leaves the selection's handlers. Calling `ajaxForm` again on a form does not remove delegated bindings.  
Chainable: Yes.

```javascript
$("#myFormId").ajaxFormUnbind();
$(document).ajaxFormUnbind("form.ajax");
```

### ajaxSubmit

Immediately submits the form via AJAX. In the most common use case this is invoked in response to the user clicking a submit button on the form. `ajaxSubmit` takes zero or one argument. The single argument can be either a callback function or an [Options Object](options.md).  
Chainable: Yes.

**Note:** You can pass any of the standard [$.ajax settings](https://api.jquery.com/jQuery.ajax/#jQuery-ajax-settings) to ajaxSubmit.

```javascript
// attach handler to form's submit event
$("#myFormId").submit(function () {
  // submit the form
  $(this).ajaxSubmit();
  // return false to prevent normal browser submit and page navigation
  return false;
});
```

### The jqXHR of a submission

`ajaxSubmit` stores the jqXHR of each submission in the form's data cache under the `jqxhr` key, so you can add callbacks or abort the request after it starts.

```javascript
var xhr = $("#myFormId").ajaxSubmit().data("jqxhr");

xhr.done(function (data) {
  // ...
});
```

### formSerialize

Serializes the form into a query string. This method will return a string in the format: `name1=value1&name2=value2`  
Chainable: No, this method returns a String.

```javascript
var queryString = $("#myFormId").formSerialize();
// the data could now be submitted using $.get, $.post, $.ajax, etc
$.post("myscript.php", queryString);
```

### fieldSerialize

Serializes field elements into a query string. This is handy when you need to serialize only part of a form. This method will return a string in the format: `name1=value1&name2=value2`  
Chainable: No, this method returns a String.

```javascript
var queryString = $("#myFormId .specialFields").fieldSerialize();
```

### fieldValue

Returns the value(s) of the element(s) in the matched set in an array. As of version .91, this method **always** returns an array. If no valid value can be determined the array will be empty, otherwise it will contain one or more values.  
Chainable: No, this method returns an array.

```javascript
// get the value of the password input
var value = $("#myFormId :password").fieldValue();
alert("The password is: " + value[0]);
```

### resetForm

Resets the form to its original state by invoking the form element's native <abbr title="Document Object Model">DOM</abbr> method.  
Chainable: Yes.

```javascript
$("#myFormId").resetForm();
```

### clearForm

Clears the form elements. This method empties all of the text inputs, password inputs and textarea elements, clears the selection in any select elements, and unchecks all radio and checkbox inputs. It does _not_ clear hidden inputs, unless you pass `true` (all hidden inputs) or a selector (the hidden inputs that match it), as in `clearForm(".special:hidden")`. `clearFields` takes the same argument.  
Chainable: Yes.

```javascript
$("#myFormId").clearForm();
```

### clearFields

Clears field elements. This is handy when you need to clear only a part of the form.  
Chainable: Yes.

```javascript
$("#myFormId .specialFields").clearFields();
```

### Deprecations

Features that 5.0 removes still work on 4.x. With debug output on (`$.fn.ajaxSubmit.debug = true`), the plugin logs a `console.warn` the first time each one is used, once per page, naming the replacement. Nothing is logged with debug off.

| Deprecated                                                                                     | Use instead                                                       |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `clearInputs`                                                                                  | `clearFields`                                                     |
| `$.fn.attr2`                                                                                   | `.prop()` or `.attr()`                                            |
| `ajaxForm` on an empty selection before the DOM is ready (queued until ready, old jQuery only) | call `ajaxForm` inside `$(fn)`, or use `delegation: "<selector>"` |
| the iframe transport chosen automatically because the browser has no `FormData`                | set `iframe: true`                                                |
| jQuery before 3.5 (warned on the first `ajaxSubmit` or `ajaxForm`)                             | jQuery 3.5 or later                                               |
| the `closeKeepAlive` option (a Safari 3/4 workaround)                                          | nothing; leave it out                                             |
| replacing `$.fieldValue` to change what is serialized                                          | jQuery `valHooks`                                                 |

`clearInputs` is now its own function that warns and then calls `clearFields`, so `$.fn.clearInputs !== $.fn.clearFields`.

A replaced `$.fieldValue` is still used on 4.x, and `formToArray`, `formSerialize`, `fieldSerialize` and `ajaxSubmit` warn when they read through one. In 5.0 they read values without it, so only a jQuery `valHooks` entry changes what they send; `$.fn.fieldValue` keeps reading through `$.fieldValue` and does not warn.

One warning does not need debug output: `delegation: true` on jQuery 3 and later binds every form on the page, because those versions have no `.selector` to scope it, so it warns on every `ajaxForm` call that uses it. Pass a selector instead, such as `delegation: "form.ajax"`.
