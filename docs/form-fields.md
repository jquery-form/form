---
---

## Form Fields

The `fieldValue` and `fieldSerialize` methods read the values of single fields, or of any part of a form. Both follow the HTML rules for which controls a submission sends.

### fieldValue

`fieldValue` returns the values of the selected fields, in an array. For example, to read the password field of a form with the id `myForm`:

```javascript
const password = $("#myForm [type=password]").fieldValue()[0];
```

It _always_ returns an array: empty when no selected field has a value to send, with one value per field otherwise, and with every selected option of a multiple select.

### fieldSerialize

`fieldSerialize` serializes the selected fields into a query string. This is useful when you need to send only some of a form's fields. For example, to serialize only the text inputs:

```javascript
const queryString = $("#myForm [type=text]").fieldSerialize();
```

### What They Return

For this form:

```html
<form id="myForm" action="/profile" method="post">
  <input type="hidden" name="token" value="abc123" />
  <input type="text" name="name" value="Ada" />
  <input type="password" name="password" />
  <select name="colors" multiple>
    <option value="red" selected>Red</option>
    <option value="blue" selected>Blue</option>
    <option value="green">Green</option>
  </select>
  <input type="checkbox" name="news" value="yes" checked />
  <input type="checkbox" name="terms" value="agree" />
  <input type="radio" name="size" value="s" />
  <input type="radio" name="size" value="m" checked />
  <textarea name="bio"></textarea>
  <button type="submit" name="save" value="1">Save</button>
</form>
```

| Call                                                                  | Result                                                                          |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `$("#myForm [name=name]").fieldValue()`                               | `["Ada"]`                                                                       |
| `$("#myForm [type=password]").fieldValue()`                           | `[""]`: an empty text field is still sent                                       |
| `$("#myForm select").fieldValue()`                                    | `["red", "blue"]`                                                               |
| `$("#myForm [type=checkbox]").fieldValue()`                           | `["yes"]`: the unchecked box is not sent                                        |
| `$("#myForm [type=radio]").fieldValue()`                              | `["m"]`                                                                         |
| `$("#myForm button").fieldValue()`                                    | `[]`: a submit button is sent only when it submits the form                     |
| `$("#myForm [type=checkbox], #myForm [type=radio]").fieldSerialize()` | `"news=yes&size=m"`                                                             |
| `$("#myForm").formSerialize()`                                        | `"token=abc123&name=Ada&password=&colors=red&colors=blue&news=yes&size=m&bio="` |

### Successful Controls

By default, `fieldValue` and `fieldSerialize` read only [successful controls](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#constructing-the-form-data-set), the ones a submission would send. That is why an unchecked checkbox gives an empty array:

```javascript
// an empty array when the checkbox is not checked
const value = $("#myUncheckedCheckbox").fieldValue();
// value.length === 0
```

To read a field's value whether or not it would be sent, pass `false`:

```javascript
// the checkbox's value, even when it is not checked
const value = $("#myUncheckedCheckbox").fieldValue(false);
// value.length === 1
```

With `false`, the checkboxes of the form above give `["yes", "agree"]`, and its radio buttons `["s", "m"]`.
