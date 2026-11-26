# jQuery Form [![CI](https://github.com/jquery-form/form/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/jquery-form/form/actions/workflows/ci.yml)

## Overview
The jQuery Form Plugin allows you to easily and unobtrusively upgrade HTML forms to use AJAX. The main methods, ajaxForm and ajaxSubmit, gather information from the form element to determine how to manage the submit process. Both of these methods support numerous options which allow you to have full control over how the data is submitted.

No special markup is needed, just a normal form. Submitting a form with AJAX doesn't get any easier than this!

**Documentation:** [jquery-form.github.io/form](https://jquery-form.github.io/form/), with the [API](https://jquery-form.github.io/form/api/), the [options](https://jquery-form.github.io/form/options/) and [examples](https://jquery-form.github.io/form/examples/).

## Installation
```sh
npm install jquery-form
```

jQuery is a dependency of the package and is installed with it.

## Download
* **npm:** [jquery-form](https://www.npmjs.com/package/jquery-form). `dist/jquery.form.min.js` is the minified build, `dist/jquery.form.js` the readable one.
* **GitHub:** each version's built files are in the `dist` folder of its tag, such as [`v4.6.0/dist`](https://github.com/jquery-form/form/tree/v4.6.0/dist); see the [releases](https://github.com/jquery-form/form/releases). The `dist` folder on `main` holds unreleased code.

### CDN
From jsDelivr:

```html
<script src="https://cdn.jsdelivr.net/npm/jquery-form@4.6.0/dist/jquery.form.min.js" integrity="sha384-6nWaJ1CxEQhUyWbY8mCCA3pAsWr1hPIee2byhQUP4SN9ydEguzTY7hVQV/NVNgiQ" crossorigin="anonymous"></script>
```

Or from cdnjs:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery.form/4.6.0/jquery.form.min.js" integrity="sha384-6nWaJ1CxEQhUyWbY8mCCA3pAsWr1hPIee2byhQUP4SN9ydEguzTY7hVQV/NVNgiQ" crossorigin="anonymous"></script>
```

## Usage
With a script tag, load the plugin after jQuery:

```html
<script src="https://code.jquery.com/jquery-3.7.1.min.js" integrity="sha256-/JqT3SQfawRcv/BIHPThkBvs0OEvtFFmqPF/lYI/Cxo=" crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/jquery-form@4.6.0/dist/jquery.form.min.js" integrity="sha384-6nWaJ1CxEQhUyWbY8mCCA3pAsWr1hPIee2byhQUP4SN9ydEguzTY7hVQV/NVNgiQ" crossorigin="anonymous"></script>
```

With a bundler, importing the module registers the plugin on the jQuery that `import "jquery"` resolves to, so `jquery` must be importable:

```javascript
import $ from "jquery";
import "jquery-form";
```

With CommonJS, the package exports a factory that takes the window and jQuery, registers the plugin and returns jQuery:

```javascript
var $ = require("jquery");
require("jquery-form")(window, $);
```

AMD loaders get the plugin as a module that depends on `jquery`.

Then prepare a form, and it is submitted with AJAX:

```javascript
$(function () {
  $("#myForm").ajaxForm({
    target: "#output",
    success: function () {
      alert("Thank you for your comment!");
    },
  });
});
```

`ajaxForm` binds the form so that it submits with AJAX; `ajaxSubmit` submits it now, from your own submit handler. The [API](https://jquery-form.github.io/form/api/) page describes every method, and the [options](https://jquery-form.github.io/form/options/) page every option.

## File Uploads
A form with a selected file, or a `multipart/form-data` enctype, is sent with [FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData) over [XMLHttpRequest](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest), and the `uploadProgress` option reports progress as the upload proceeds. With `iframe: true`, the form is posted through a hidden iframe instead, which needs the server to return HTML-safe responses; see [`iframe`](https://jquery-form.github.io/form/options/#iframe).

## Compatibility
* Requires jQuery 1.7.2 or later. `main` is tested against jQuery 1.7.2, 3.7.1 and 4.0.0, on Chromium, Firefox and WebKit.
* jQuery 4 needs 4.4.0 or later; 4.3.0 uses APIs that jQuery 4 removed.
* With `delegation: true` on jQuery 3 and later, every form on the page is handled, not only the selected ones; use `delegation: "<selector>"` instead. ([issue #353](https://github.com/jquery-form/form/issues/353))
* **Not** compatible with the jQuery slim builds, which leave out AJAX.
* 5.0 will need jQuery 3.5 or later. With debug output on (`$.fn.ajaxSubmit.debug = true`), 4.x warns about the features 5.0 removes; see [Deprecations](https://jquery-form.github.io/form/api/#deprecations) and [issue #629](https://github.com/jquery-form/form/issues/629).

## Security
Please report security issues privately, not in public issues. See [SECURITY](SECURITY.md).

Some options must be trusted input only, and a `target` response is inserted as HTML; see [Trusted options](https://jquery-form.github.io/form/options/#trusted-options) and the [`target`](https://jquery-form.github.io/form/options/#target) sanitizing recipe. Iframe uploads need HTML-safe responses; see [`iframe`](https://jquery-form.github.io/form/options/#iframe).

## Community
Want to contribute to jQuery Form? Awesome! See [CONTRIBUTING](CONTRIBUTING.md) for more information.

### Code of Conduct
Please note that this project is released with a [Contributor Code of Conduct](CODE_OF_CONDUCT.md) to ensure that this project is a welcoming place for **everyone** to contribute to. By participating in this project you agree to abide by its terms.

## Contributors
This project has transferred from [github.com/malsup/form](https://github.com/malsup/form/), courtesy of [Mike Alsup](https://github.com/malsup).  
See [CONTRIBUTORS](CONTRIBUTORS.md) for details.

## License

This project is dual-licensed under the LGPLv2.1 (or later) or MIT licenses:

* [GNU Lesser General Public License v2.1](LICENSE)
* [MIT](LICENSE-MIT)
