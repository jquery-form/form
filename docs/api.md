---
---

## API

The plugin adds methods to jQuery objects for submitting forms with AJAX, and for reading, clearing and resetting their fields. The methods that return a jQuery object can be chained.

### Submitting

#### ajaxForm

Prepares a form to be submitted with AJAX: when the user submits it, the plugin sends it with [`ajaxSubmit`](#ajaxsubmit) instead of loading a new page. It does **not** submit the form itself. It also records which submit button was clicked, so that its name and value (or an image button's click coordinates) are sent, as in a normal submission.  
Takes an [options object](options.md), or a function used as the [`success`](options.md#success) callback. You can also pass any of the [`$.ajax` settings](https://api.jquery.com/jQuery.ajax/#jQuery-ajax-settings).  
Returns: the jQuery object.

```javascript
$(() => {
  $("#myForm").ajaxForm({ target: "#output" });
});
```

To handle forms that are added to the page later, bind by selector with the [`delegation`](options.md#delegation) option: `$(document).ajaxForm({ delegation: "form.ajax" })`.

#### ajaxFormUnbind

Removes the handlers `ajaxForm` bound on the selection, and every delegated binding (the `delegation` option) the plugin made on the document. `ajaxFormUnbind(selector)` removes only the delegated binding for that selector and leaves the selection's handlers. Calling `ajaxForm` again on a form does not remove delegated bindings.  
Returns: the jQuery object.

```javascript
$("#myForm").ajaxFormUnbind();
$(document).ajaxFormUnbind("form.ajax");
```

#### ajaxSubmit

Submits the form with AJAX right away. Call it from your own `submit` handler when you want to decide each time whether and how to send. It does not know which submit button was clicked; use [`ajaxForm`](#ajaxform) when the server needs it.  
Takes an [options object](options.md), or a function used as the [`success`](options.md#success) callback. You can also pass any of the [`$.ajax` settings](https://api.jquery.com/jQuery.ajax/#jQuery-ajax-settings).  
Returns: the jQuery object.

```javascript
$("#myForm").on("submit", function (event) {
  // stop the browser's own submission and page load
  event.preventDefault();

  $(this).ajaxSubmit({ target: "#output" });
});
```

#### The jqXHR of a submission

`ajaxSubmit` stores the jqXHR of each submission in the form's data cache under the `jqxhr` key, so you can add callbacks or abort the request after it starts.

```javascript
const xhr = $("#myForm").ajaxSubmit().data("jqxhr");

xhr.done((data) => {
  // ...
});
```

### Reading fields

#### formToArray

Returns the fields a submission of the form would send, as an array of `{ name, value }` objects in tree order, as a native submission orders them. This is the array the [`beforeSubmit`](options.md#beforesubmit) callback receives. A file input gives one entry per selected file, with the `File` as its value and `type: "file"`, or one entry with an empty value when no file is selected. When `ajaxForm` recorded a clicked submit button, its field is included.  
Returns: an array.

```javascript
const fields = $("#myForm").formToArray();
// [{ name: "username", value: "jresig" }, { name: "password", value: "secret" }]
```

#### formSerialize

Serializes the form into a query string, `name1=value1&name2=value2`, from the same fields as [`formToArray`](#formtoarray).  
Returns: a string.

```javascript
const queryString = $("#myForm").formSerialize();
// the data can now be sent with $.get, $.post, $.ajax, etc.
$.post("/comments", queryString);
```

#### fieldSerialize

Serializes the selected fields into a query string, `name1=value1&name2=value2`. This is handy when you need to serialize only part of a form.  
Returns: a string.

```javascript
const queryString = $("#myForm .specialFields").fieldSerialize();
```

#### fieldValue

Returns the values of the selected fields, in an array. The array is empty when no field has a value to send, such as an unchecked checkbox. By default only [successful controls](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#constructing-the-form-data-set), the ones a submission would send, are read; `fieldValue(false)` reads every selected field. The [Form Fields](form-fields.md) page has more examples.  
Returns: an array.

```javascript
const value = $("#myForm :password").fieldValue();
console.log("The password is:", value[0]);
```

`$.fieldValue(element, successful)` returns the value of a single element: a string, an array for a multiple select, or `null` when it would not be sent.

### Changing fields

#### clearForm

Clears the form's fields. It empties text inputs, password inputs and textareas, clears the selection of every select, and unchecks radio and checkbox inputs. It does _not_ clear hidden inputs, unless you pass `true` (all hidden inputs) or a selector (the hidden inputs that match it), as in `clearForm(".special:hidden")`.  
Returns: the jQuery object.

```javascript
$("#myForm").clearForm();
```

#### clearFields

Clears the selected fields, as `clearForm` does. This is handy when you need to clear only part of a form. It takes the same argument as `clearForm`.  
Returns: the jQuery object.

```javascript
$("#myForm .specialFields").clearFields();
```

#### resetForm

Resets the selection to its default values. On a form it calls the form's native `reset()`. On fields it resets each one to its default value, checked state or selection, as a form reset would. On a `label` it resets the field the label is for, and on any other element it resets the forms and fields inside it.  
Returns: the jQuery object.

```javascript
$("#myForm").resetForm();
$("#myForm .specialFields").resetForm();
```

#### enable

Enables the selected fields, or disables them with `enable(false)`, by setting their `disabled` property.  
Returns: the jQuery object.

```javascript
$("#myForm :submit").enable(false);
```

#### selected

Checks the selected checkboxes and radio buttons, and selects the selected `option` elements; `selected(false)` does the opposite. Selecting an option of a single select deselects its other options.  
Returns: the jQuery object.

```javascript
$("#myForm :checkbox").selected();
$("#mySelect option[value='two']").selected();
```

### Debug output

Set `$.fn.ajaxSubmit.debug = true` to log what the plugin does to the browser console.

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
