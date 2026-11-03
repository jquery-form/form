# Migrating from 4.x to 5.0

This guide is for people who use jquery-form 4.x and are moving to 5.0. 5.0 has breaking changes.

4.x stays available (`npm install jquery-form@4`, dist-tag `v4`) and gets security fixes. To see warnings for most of the removed features, turn on `$.fn.ajaxSubmit.debug = true` on the latest 4.x and run your code. Feedback goes to https://github.com/jquery-form/form/issues/629.

## Summary

| Change                                                                                                                                              | Who is affected                                                                        | 4.x warning                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [jQuery 3.5 or later is required, as a peer dependency](#jquery-35-or-later-is-required-as-a-peer-dependency)                                       | Apps on jQuery before 3.5, and installs that relied on jquery-form to pull in jQuery   | "jQuery before 3.5", under debug                                                 |
| [`form.jquery.json` is removed](#formjqueryjson-is-removed)                                                                                         | Tools that read the old plugins.jquery.com manifest                                    | None                                                                             |
| [`$.fn.attr2` is removed](#fnattr2-is-removed)                                                                                                      | Code that calls `attr2`                                                                | "attr2 is deprecated", under debug                                               |
| [`ajaxForm` on an empty selection before the DOM is ready no longer waits](#ajaxform-on-an-empty-selection-before-the-dom-is-ready-no-longer-waits) | Pages on jQuery before 3 that call `ajaxForm` before their forms exist                 | "queuing ajaxForm", under debug                                                  |
| [Internet Explorer, Opera Presto and EdgeHTML are no longer supported](#internet-explorer-opera-presto-and-edgehtml-are-no-longer-supported)        | Pages that still serve Internet Explorer, Opera 12 or earlier, or Edge 18 or earlier   | None                                                                             |
| [`clearInputs` is removed](#clearinputs-is-removed)                                                                                                 | Code that calls `clearInputs`                                                          | "clearInputs is deprecated", under debug                                         |
| [`closeKeepAlive` is ignored](#closekeepalive-is-ignored)                                                                                           | Iframe uploads that pass `closeKeepAlive`                                              | "closeKeepAlive works around a Safari 3/4 bug", under debug                      |
| [`delegation: true` throws](#delegation-true-throws)                                                                                                | Code that passes `delegation: true` (or another non-string truthy value) to `ajaxForm` | "delegation: true binds every form on the page", always (even without debug)     |
| [The iframe transport is used only with `iframe: true`](#the-iframe-transport-is-used-only-with-iframe-true)                                        | Uploads in browsers without `FormData` or the File API                                 | "choosing the iframe transport automatically", under debug                       |
| [The package has an `exports` map](#the-package-has-an-exports-map)                                                                                 | Node ES module imports of jquery-form, and imports of paths outside `dist`             | None                                                                             |
| [`src` is no longer published](#src-is-no-longer-published)                                                                                         | Code that imports files from `jquery-form/src`                                         | None                                                                             |
| [Iframe `.done` and `.then` receive the parsed data](#iframe-done-and-then-receive-the-parsed-data)                                                 | `iframe: true` uploads that read the response in `.done` or `.then`                    | None                                                                             |
| [Replacing `$.fieldValue` no longer changes what is sent](#replacing-fieldvalue-no-longer-changes-what-is-sent)                                     | Pages that replace `$.fieldValue` to change the values sent                            | "replacing $.fieldValue to change what is serialized is deprecated", under debug |

Entries are added as each 5.0 change lands.

## Changes

### jQuery 3.5 or later is required, as a peer dependency

**What changed.** jquery-form 5 supports jQuery 3.5.0 and later, and is tested against 3.5.0, 3.7.1 and 4.0.0. 4.x accepted jQuery 1.7.2 and later. In `package.json`, jQuery moves from `dependencies` to `peerDependencies` (`"jquery": ">=3.5.0"`, with no upper bound), so your project provides jQuery instead of jquery-form installing its own copy. `bower.json` and `composer.json` (`components/jquery`) ask for the same range. On an older jQuery, `ajaxSubmit` and `ajaxForm` throw `Error: jquery.form 5 needs jQuery 3.5 or later; this is <version>` before any event, callback or request; 4.x ran on it. Loading the plugin does not throw, so a page that never calls them keeps working.

**Why.** jQuery before 3.5 has public security issues in how it inserts HTML (CVE-2020-11022 and CVE-2020-11023), which the `target` option relies on, and the jQuery team no longer supports it. A peer dependency keeps one copy of jQuery on the page: the one your app uses.

**Are you affected?** Check `jQuery.fn.jquery` on your pages. If it is older than 3.5, you are. With `$.fn.ajaxSubmit.debug = true`, the latest 4.x logs a `console.warn` naming your jQuery version the first time `ajaxSubmit` or `ajaxForm` runs on such a page. Also check whether your `package.json` lists `jquery` itself: if it does not, and you got jQuery only because jquery-form depended on it, add it. npm 7 and later install a missing peer dependency, but some other package managers only warn about it.

Before (4.x), on jQuery 3.4.1:

```javascript
$("#myForm").ajaxSubmit(); // sends the form
```

After (5.0), on jQuery 3.4.1:

```javascript
$("#myForm").ajaxSubmit(); // Error: jquery.form 5 needs jQuery 3.5 or later; this is 3.4.1
```

Upgrade jQuery to 3.5 or later to fix it. If your installs got jQuery through jquery-form, list it yourself.

Before (4.x):

```json
{ "dependencies": { "jquery-form": "^4.3.0" } }
```

After (5.0):

```json
{ "dependencies": { "jquery": "^3.7.1", "jquery-form": "^5.0.0" } }
```

### `form.jquery.json` is removed

**What changed.** The package no longer has `form.jquery.json`, the manifest for the plugins.jquery.com registry.

**Why.** plugins.jquery.com has been read-only since 2014, so the file was not read by anything that publishes the plugin, and it had to be kept in step with `package.json` by hand.

**Are you affected?** Only if a tool of yours reads `form.jquery.json` from the repository or the package. Read `package.json` instead: it has the same name, version, license, entry points and jQuery range. 4.x has no warning for this.

Before (4.x): `form.jquery.json` names `"main": "dist/jquery.form.js"` and `"dependencies": { "jquery": ">=1.7.2" }`.

After (5.0): `package.json` names `"main": "dist/jquery.form.js"` and `"peerDependencies": { "jquery": ">=3.5.0" }`.

### `$.fn.attr2` is removed

**What changed.** `$.fn.attr2` is gone. It returned `.prop()` when the property was a string and `.attr()` otherwise, and on jQuery before 1.6, which has no `.prop()`, it was `.attr()`.

**Why.** It existed for jQuery versions without `.prop()`, which 5.0 does not support. The plugin still reads form properties the same way internally, so a control named `action` or `method` does not hide the form's attribute.

**Are you affected?** Search your code for `attr2`. With `$.fn.ajaxSubmit.debug = true`, the latest 4.x logs `attr2 is deprecated, use .prop() or .attr()` the first time it is called.

Before (4.x):

```javascript
var action = $("#myForm").attr2("action");
```

After (5.0), with the property (resolved against the page URL) or the raw attribute. If the form has a control named `action`, `.prop("action")` returns that control, so use `.attr()`:

```javascript
var action = $("#myForm").prop("action");
var raw = $("#myForm").attr("action");
```

### `ajaxForm` on an empty selection before the DOM is ready no longer waits

**What changed.** On jQuery before 3, `ajaxForm` called before the DOM was ready on a selection that matched nothing queued itself and ran again with the same selector once the DOM was ready. 5.0 does not queue: an empty selection binds nothing and returns, whether or not the DOM is ready. On jQuery 3 and later, 4.x already did nothing, because those versions keep no selector on the selection to run again.

**Why.** The queue needed the `.selector` property that jQuery 3 removed, and every jQuery that 5.0 supports is 3.5 or later.

**Are you affected?** Only if your page called `ajaxForm` before its forms were parsed, for example in a script in the `<head>`, and relied on the queue on an old jQuery. With `$.fn.ajaxSubmit.debug = true`, the latest 4.x logs `queuing ajaxForm until the DOM is ready is deprecated` when it queues.

Before (4.x), in the `<head>`, on jQuery 1.x or 2.x:

```javascript
$("#myForm").ajaxForm(); // bound once the DOM is ready
```

After (5.0), bind when the DOM is ready, or delegate from the document:

```javascript
$(function () {
  $("#myForm").ajaxForm();
});

$(document).ajaxForm({ delegation: "#myForm" });
```

### Internet Explorer, Opera Presto and EdgeHTML are no longer supported

**What changed.** 5.0 runs on current Chrome, Edge, Firefox (and Firefox ESR) and Safari, and is written for Chrome and Edge 80, Firefox 78 and Safari 14 or later. The code that only those older browsers needed is gone:

- `attachEvent` and `detachEvent` for the iframe's load event, and `execCommand("Stop")` when an upload is aborted.
- The `javascript:false` iframe source for Internet Explorer on HTTPS pages. The `iframeSrc` default is now `about:blank` on every page. An `iframeSrc` option you pass still wins.
- The `clearFields` (and `clearForm`) clone of a file input in Internet Explorer. A file input is now cleared by setting its value to `""`, which keeps the element, its data and its handlers.
- The option-text fallback for an `<option>` whose `value` attribute Internet Explorer reported as unspecified.
- The Edge and Internet Explorer user agent check that added controls outside the form (`form="id"`) to the fields. Every supported browser lists them in `form.elements`.
- `window.opera.postError` for debug messages when there is no `console.log`, and the console existence checks: debug output and deprecation warnings always go to `console.log` and `console.warn`.
- The Opera retry that read an empty iframe response again, Internet Explorer's `XMLDocument` XML islands, the `innerText` fallback when reading a text response, and the Internet Explorer 8 ways of reaching the iframe's document (`contentWindow.document`, `frame.document`). The response document is `contentDocument`; a frame whose document the browser does not let the page read (for example a cross-origin response) still ends the upload with `"server abort"`. The poll that waited while Internet Explorer reported the frame as `"uninitialized"` is gone too.
- The walk that matched `delegation: "<selector>"` without `Element.closest`, and the fallbacks for browsers without DOM prototypes, for upload progress events without `loaded`, and for anchors that resolve relative URLs only on a second assignment.

**Why.** 5.0 supports the current browsers that its tests run in (Chromium, WebKit and Firefox). These code paths ran only in older browsers, so no test could reach them. jQuery 3.5 and 4 still run in Internet Explorer 11, but jquery-form 5 does not.

**Are you affected?** Only if your pages must work in Internet Explorer, in Opera 12 or earlier (Presto), or in Edge 18 or earlier (EdgeHTML). Stay on 4.x for those. 4.x has no warning for this. If you relied on the `javascript:false` default on HTTPS pages, pass it yourself.

Before (4.x), on an HTTPS page in Internet Explorer, the frame's `src` is `javascript:false`:

```javascript
$("#myForm").ajaxSubmit({ iframe: true });
```

After (5.0), the frame's `src` is `about:blank` unless you pass `iframeSrc`:

```javascript
$("#myForm").ajaxSubmit({ iframe: true, iframeSrc: "javascript:false" }); // only if you need it
```

### `clearInputs` is removed

**What changed.** `$.fn.clearInputs` is gone. In 4.x it warned under debug and then called `clearFields` with the same argument.

**Why.** It was an old name for `clearFields`, kept for compatibility.

**Are you affected?** Search your code for `clearInputs`. With `$.fn.ajaxSubmit.debug = true`, the latest 4.x logs `clearInputs is deprecated, use clearFields` the first time it is called.

Before (4.x):

```javascript
$("#myForm :input").clearInputs();
```

After (5.0):

```javascript
$("#myForm :input").clearFields();
```

### `closeKeepAlive` is ignored

**What changed.** The `closeKeepAlive` option is ignored, like any option `$.ajax` does not know. In 4.x, an iframe upload with `closeKeepAlive` first sent a GET request to that URL and started the upload only when it succeeded; if it failed, the upload never started and no callback ran. 5.0 starts the upload at once and sends no extra request, and `ajaxSubmit` stores the upload's jqXHR-like object in the form's `jqxhr` data, as it does without the option.

**Why.** It worked around a Safari 3 and 4 bug, where an upload could hang on a kept-alive connection.

**Are you affected?** Search your code for `closeKeepAlive`. With `$.fn.ajaxSubmit.debug = true`, the latest 4.x logs `closeKeepAlive works around a Safari 3/4 bug and is deprecated` the first time an upload uses it. Leave the option out. If your server needed that GET request for something else, send it yourself.

Before (4.x):

```javascript
$("#myForm").ajaxSubmit({ iframe: true, closeKeepAlive: "/ping" });
```

After (5.0):

```javascript
$("#myForm").ajaxSubmit({ iframe: true });
```

### `delegation: true` throws

**What changed.** `ajaxForm({ delegation: true })` throws `Error: jquery.form: delegation needs a selector in 5.0, e.g. delegation: "form.ajax"`, before it binds anything and before `beforeFormUnbind` runs. The same error is thrown for any other value that is truthy and not a string (such as `1` or an object), and for an empty string, which 4.x rejected with `jquery.form: delegation needs a selector, or true`. A non-empty string is the selector, as in 4.x. `false`, `undefined`, `null` and `0` mean no delegation. `ajaxFormUnbind()` and `ajaxFormUnbind(selector)` work as in 4.x, and with a selector the selection `ajaxForm` is called on is still ignored.

**Why.** `delegation: true` delegated from the document with the selection's `.selector` property, which jQuery 3 removed. On jQuery 3 and later it therefore handled the submit of every form on the page, not only the forms you selected.

**Are you affected?** Search your code for `delegation: true`. The latest 4.x logs `delegation: true binds every form on the page on jQuery 3 and later` with `console.warn` on every such `ajaxForm` call, even without debug.

Before (4.x):

```javascript
$("form.ajax").ajaxForm({ delegation: true });
```

After (5.0), pass the selector. Any selection works, since the selector decides which forms are handled:

```javascript
$(document).ajaxForm({ delegation: "form.ajax" });
```

### The iframe transport is used only with `iframe: true`

**What changed.** `ajaxSubmit` (and `ajaxForm`) post through the hidden iframe only when you pass a truthy `iframe` option, such as `iframe: true`. A form with a selected file or a `multipart/form-data` enctype is otherwise always sent with `FormData` over `XMLHttpRequest`. In 4.x the plugin checked at load whether the browser had the File API and `FormData`, and chose the iframe on its own when it did not. That check is gone. `iframe: false` is the default and changes nothing.

**Why.** Every browser 5.0 supports has the File API and `FormData`, so the automatic choice could no longer happen.

**Are you affected?** Only if your uploads ran in a browser without `FormData` (such as Internet Explorer 9 or earlier), which 5.0 does not support. In a supported browser, 4.x never chose the iframe automatically. With `$.fn.ajaxSubmit.debug = true`, the latest 4.x logs `choosing the iframe transport automatically without FormData is deprecated, set iframe: true` when it does. If you need the iframe, pass `iframe: true`.

Before (4.x), in a browser without `FormData`, a file upload went through the iframe:

```javascript
$("#uploadForm").ajaxSubmit();
```

After (5.0), the same call sends `FormData`. To keep the iframe:

```javascript
$("#uploadForm").ajaxSubmit({ iframe: true });
```

The iframe transport is kept in 5.0 and may be removed in 6.0. If you use `iframe: true`, comment on https://github.com/jquery-form/form/issues/629 with your use case.

### The package has an `exports` map

**What changed.** `package.json` has an `exports` map, which Node and bundlers that read it use instead of `main` and `module`:

```json
"exports": {
  ".": {
    "module": "./dist/jquery.form.mjs",
    "import": "./dist/jquery.form.mjs",
    "default": "./dist/jquery.form.js"
  },
  "./dist/*": "./dist/*",
  "./package.json": "./package.json"
}
```

In Node, `import "jquery-form"` now loads the module build, `dist/jquery.form.mjs`: it imports `jquery`, installs the plugin on it when it loads, and exports that jQuery as default. In 4.x, Node ignored `module`, so the import loaded the classic build and its default export was the CommonJS `(root, jQuery)` factory. The module build reads the DOM when it loads, so `window` and `document` must be global before the import. `require("jquery-form")` in Node still returns the factory. Bundlers that read `exports`, such as webpack, Rollup, Rolldown (Vite) and esbuild, match the `module` condition, so both `import` and `require` give them the module build, as `module` did in 4.x. `main`, `module`, `jsdelivr` and `unpkg` are unchanged, so bundlers that ignore `exports`, CDNs and script tags load the same files as before. Any path under `dist`, such as `jquery-form/dist/jquery.form.min.js`, and `jquery-form/package.json` can still be imported or required. Any other path, such as `jquery-form/src/jquery.form.js` or `jquery-form/LICENSE-MIT`, fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`.

**Why.** The map names the files the package supports, so a path outside it is not used by accident, and Node gets the module build that bundlers already use.

**Are you affected?** Only if Node code imports jquery-form as an ES module, by `import` or `import()`, or if your code or build tool imports a path outside `dist`. 4.x has no warning for this. Code that `require`s the package, and bundled code, are not affected.

A Node project that loads jquery-form with both `import` and `require` loads two copies, the module build and the classic build (the dual-package hazard). Each one installs the plugin on the jQuery it gets. When that is the same jQuery, the second one replaces the first, and settings such as `$.fn.ajaxSubmit.debug` go back to their defaults; when it is not, each jQuery has its own plugin and settings. Load it one way.

Before (4.x), in a Node ES module:

```javascript
import factory from "jquery-form";
const $ = factory(window);
```

After (5.0), with `window` and `document` global first:

```javascript
import $ from "jquery-form";
```

Or keep the factory with `require`:

```javascript
import { createRequire } from "node:module";
const $ = createRequire(import.meta.url)("jquery-form")(window);
```

### `src` is no longer published

**What changed.** The npm package no longer has the `src` directory, the ES modules that the `dist` files are built from. It holds `dist/jquery.form.js`, `dist/jquery.form.min.js` with its source map, `dist/jquery.form.mjs`, the two license files, `README.md` and `package.json`. A deep import such as `jquery-form/src/jquery.form.js` fails, and CDN URLs under `src` (for example on unpkg or jsDelivr) return not found for 5.0.

**Why.** `src` is split into internal modules whose names and layout may change in any release. `dist/jquery.form.mjs` is the same code, as written and not transpiled, in one module, and the source map of `dist/jquery.form.min.js` embeds every source file, so debuggers still show it.

**Are you affected?** Search your code, bundler configuration and CDN URLs for `jquery-form/src`. 4.x has no warning for this. Import `jquery-form`, or `jquery-form/dist/jquery.form.mjs`, instead.

Before (the latest 4.x):

```javascript
import $ from "jquery-form/src/jquery.form.js";
```

After (5.0):

```javascript
import $ from "jquery-form/dist/jquery.form.mjs";
```

### Iframe `.done` and `.then` receive the parsed data

**What changed.** With `iframe: true`, the jqXHR-like object of the upload (`$form.data("jqxhr")`) resolves with `(data, "success", xhr)`, where `data` is the response parsed for the `dataType` (an object for `json`, a document for `xml`, the text for `text` or `html`). The `success` callback, `ajaxSuccess` handlers and `$.ajax` already receive that data. In 4.x, `.done` and `.then` received `xhr.responseText`, the response text, whatever the `dataType`. Failures, aborts and the arguments of `success`, `error` and `complete` are unchanged.

**Why.** An upload's callbacks and its jqXHR received different values for the same response, and code written for `$.ajax` (or for the `FormData` transport, which uses it) got a string instead of the parsed data when it switched to `iframe: true`.

**Are you affected?** Only if you pass `iframe: true` and call `.done` or `.then` on the jqXHR in the form's `jqxhr` data. With `dataType: "text"` or `"html"`, or no `dataType` for a text response, the data is still the text. 4.x has no warning for this. To keep the text, read `xhr.responseText` from the third argument.

Before (4.x):

```javascript
$("#uploadForm").ajaxSubmit({ iframe: true, dataType: "json" });
$("#uploadForm")
  .data("jqxhr")
  .done(function (text) {
    var result = JSON.parse(text);
  });
```

After (5.0):

```javascript
$("#uploadForm").ajaxSubmit({ iframe: true, dataType: "json" });
$("#uploadForm")
  .data("jqxhr")
  .done(function (result, textStatus, xhr) {
    // result is the parsed object; xhr.responseText is still the text
  });
```

The iframe transport is kept in 5.0 and may be removed in 6.0. If you use `iframe: true`, comment on https://github.com/jquery-form/form/issues/629 with your use case.

### Replacing `$.fieldValue` no longer changes what is sent

**What changed.** `formToArray`, `formSerialize`, `fieldSerialize` and `ajaxSubmit` (and so `ajaxForm`) read each control's value with the plugin's own code, not through `$.fieldValue`. A page that assigns its own function to `$.fieldValue` no longer changes the fields they return or send. `$.fieldValue` and `$.fn.fieldValue` are still public and return the same values as in 4.x, and `$.fn.fieldValue` still reads through `$.fieldValue`, so a replacement still changes what `fieldValue()` returns. The way to change a value is a jQuery [`valHooks`](https://api.jquery.com/jQuery.valHooks/) entry, which 4.x already honored: the plugin reads an `input` (other than a file input) or a `textarea` with `.val()`. A `select`'s values are read from its selected options, so a `valHooks` entry for `select` or `option` does not change them.

**Why.** The fields sent should not depend on a global function that any script on the page can replace, and `valHooks` is jQuery's own way to change what `.val()` reads, used the same way by `.serialize()`.

**Are you affected?** Search your code for assignments to `$.fieldValue` or `jQuery.fieldValue`. With `$.fn.ajaxSubmit.debug = true`, the latest 4.x logs `replacing $.fieldValue to change what is serialized is deprecated, use jQuery valHooks` the first time `formToArray`, `formSerialize`, `fieldSerialize` or `ajaxSubmit` reads values through a replacement. A `valHooks` entry is keyed by the control's `type` (or its tag name), not its name, and it changes `.val()` everywhere on the page.

Before (4.x), commas are removed from the `price` field before it is sent:

```javascript
var fieldValue = $.fieldValue;
$.fieldValue = function (el, successful) {
  var value = fieldValue(el, successful);
  return el.name === "price" && typeof value === "string" ? value.replace(/,/g, "") : value;
};
```

After (5.0), with a `valHooks` entry for text inputs. Returning `undefined` lets jQuery read the value as usual:

```javascript
$.valHooks.text = {
  get: function (el) {
    return el.name === "price" ? el.value.replace(/,/g, "") : undefined;
  },
};
```

## What your server receives

This section will hold before and after request bodies for the serialization changes.
