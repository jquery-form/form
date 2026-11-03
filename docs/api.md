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

### Removed in 5.0

5.0 removes or changes the features below. The latest 4.x still supports them, and with debug output on (`$.fn.ajaxSubmit.debug = true`) it logs a `console.warn` for most of them, naming the replacement. 5.0 logs no deprecation warnings. The [migration guide](migrating-to-5.md) describes each change, with before and after code.

| Removed or changed                                                    | Use instead                                                       |
| --------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `clearInputs`                                                         | `clearFields`                                                     |
| `$.fn.attr2`                                                          | `.prop()` or `.attr()`                                            |
| `ajaxForm` on an empty selection before the DOM is ready (no queue)   | call `ajaxForm` inside `$(fn)`, or use `delegation: "<selector>"` |
| `delegation: true` (throws)                                           | `delegation: "<selector>"`                                        |
| the iframe transport chosen automatically without `iframe: true`      | set `iframe: true`                                                |
| the `closeKeepAlive` option (ignored)                                 | nothing; leave it out                                             |
| the `semantic` option (ignored; fields are always sent in tree order) | nothing; leave it out                                             |
| replacing `$.fieldValue` to change what is serialized                 | jQuery `valHooks`                                                 |
| jQuery before 3.5 (`ajaxSubmit` and `ajaxForm` throw)                 | jQuery 3.5 or later                                               |

`$.fieldValue` and `$.fn.fieldValue` are still public and return the same values. `formToArray`, `formSerialize`, `fieldSerialize` and `ajaxSubmit` read values without `$.fieldValue`, so only a jQuery `valHooks` entry changes what they send; `$.fn.fieldValue` keeps reading through `$.fieldValue`.
