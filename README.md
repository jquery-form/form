# jQuery Form [![CI](https://github.com/jquery-form/form/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/jquery-form/form/actions/workflows/ci.yml)

## Overview
The jQuery Form Plugin sends an ordinary HTML form with AJAX. `ajaxForm` and `ajaxSubmit` read the form's action, method and fields, including file uploads and the button that was clicked, and send the same fields a normal submission would. Options control everything else, from where the response goes to how it is parsed.

No special markup is needed, just a normal form.

**Documentation:** [jquery-form.github.io/form](https://jquery-form.github.io/form/), with the [API](https://jquery-form.github.io/form/api/), the [options](https://jquery-form.github.io/form/options/) and [examples](https://jquery-form.github.io/form/examples/).

## New in 5.0
* **jQuery 3.5 or later**, as a peer dependency, and current browsers only. The builds are ES2020, with no transpiling.
* **Fields are sent as the browser sends them**: in tree order, with image buttons, `dirname` and `_charset_` handled as in a native submission.
* **Selector options are never parsed as HTML**, so a string in `target`, `iframeTarget` or `includeHidden` can't create elements.
* **The iframe transport is used only with `iframe: true`.** Uploads use `FormData` otherwise.
* **An `exports` map**: Node's `import` gets the ES module build, and `require` the classic one.
* `clearInputs`, `attr2`, `closeKeepAlive` and `semantic` are gone, and `delegation` takes a selector, such as `delegation: "form.ajax"`.

Upgrading from 4.x? The [migration guide](https://jquery-form.github.io/form/migrating-to-5/) lists every change, who it affects, and what to do.

## Installation
```sh
npm install jquery-form
```

jQuery is a peer dependency: npm 7 and later install it with the plugin, unless your project already has jQuery 3.5 or later.

## Download
* **npm:** [jquery-form](https://www.npmjs.com/package/jquery-form). `dist/jquery.form.min.js` is the minified build, `dist/jquery.form.js` the readable one, and `dist/jquery.form.mjs` the ES module.
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

With a bundler or ES modules, importing the package registers the plugin on the jQuery that `import "jquery"` resolves to, so `jquery` must be importable:

```javascript
import $ from "jquery";
import "jquery-form";
```

With CommonJS, the package exports a factory that takes the window and jQuery, registers the plugin and returns jQuery:

```javascript
const $ = require("jquery");
require("jquery-form")(window, $);
```

AMD loaders get the plugin as a module that depends on `jquery`.

Then bind a form, and it is sent with AJAX when the user submits it:

```javascript
$(() => {
  $("#myForm").ajaxForm({
    target: "#output", // put the server's HTML response here
    success: () => {
      alert("Thank you for your comment!");
    },
  });
});
```

`ajaxForm` binds the form, so every submission goes through the plugin; `ajaxSubmit` sends it once, from your own submit handler. The [API](https://jquery-form.github.io/form/api/) page describes every method, and the [options](https://jquery-form.github.io/form/options/) page every option.

## File Uploads
A form with a selected file, or a `multipart/form-data` enctype, is sent with [FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData) over [XMLHttpRequest](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest), and the `uploadProgress` option reports progress as the upload proceeds. The hidden-iframe transport is used only with `iframe: true`, and needs the server to return HTML-safe responses; see [`iframe`](https://jquery-form.github.io/form/options/#iframe).

## Compatibility
* Requires jQuery 3.5 or later. 5.0 is tested against jQuery 3.5.0, 3.7.1 and 4.0.0, on Chromium, Firefox and WebKit.
* Runs in current Chrome, Edge, Firefox (and Firefox ESR) and Safari. The builds use ES2020 syntax, so they need Chrome or Edge 80, Firefox 78 or Safari 14 or later.
* **Not** compatible with the jQuery slim builds, which leave out AJAX.
* For jQuery before 3.5, Internet Explorer, Opera 12 and earlier, or Edge 18 and earlier, use 4.x (`npm install jquery-form@4`). With jQuery 4, 4.x needs 4.4.0 or later; 4.3.0 and earlier use APIs that jQuery 4 removed.

## Security
Please report security issues privately, not in public issues. See [SECURITY](SECURITY.md), which also describes which versions get fixes.

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
