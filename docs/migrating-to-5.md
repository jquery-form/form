# Migrating from 4.x to 5.0

This guide is for people who use jquery-form 4.x and are moving to 5.0. 5.0 has breaking changes.

4.x stays available (`npm install jquery-form@4`, dist-tag `v4`) and gets security fixes. To see warnings for most of the removed features, turn on `$.fn.ajaxSubmit.debug = true` on the latest 4.x and run your code. Feedback goes to https://github.com/jquery-form/form/issues/629.

## Summary

| Change                                                                                                                                              | Who is affected                                                                                                     | 4.x warning                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [jQuery 3.5 or later is required, as a peer dependency](#jquery-35-or-later-is-required-as-a-peer-dependency)                                       | Apps on jQuery before 3.5, and installs that relied on jquery-form to pull in jQuery                                | "jQuery before 3.5", under debug                                                 |
| [`form.jquery.json` is removed](#formjqueryjson-is-removed)                                                                                         | Tools that read the old plugins.jquery.com manifest                                                                 | None                                                                             |
| [`$.fn.attr2` is removed](#fnattr2-is-removed)                                                                                                      | Code that calls `attr2`                                                                                             | "attr2 is deprecated", under debug                                               |
| [`ajaxForm` on an empty selection before the DOM is ready no longer waits](#ajaxform-on-an-empty-selection-before-the-dom-is-ready-no-longer-waits) | Pages on jQuery before 3 that call `ajaxForm` before their forms exist                                              | "queuing ajaxForm", under debug                                                  |
| [Internet Explorer, Opera Presto and EdgeHTML are no longer supported](#internet-explorer-opera-presto-and-edgehtml-are-no-longer-supported)        | Pages that still serve Internet Explorer, Opera 12 or earlier, or Edge 18 or earlier                                | None                                                                             |
| [`clearInputs` is removed](#clearinputs-is-removed)                                                                                                 | Code that calls `clearInputs`                                                                                       | "clearInputs is deprecated", under debug                                         |
| [`closeKeepAlive` is ignored](#closekeepalive-is-ignored)                                                                                           | Iframe uploads that pass `closeKeepAlive`                                                                           | "closeKeepAlive works around a Safari 3/4 bug", under debug                      |
| [`delegation: true` throws](#delegation-true-throws)                                                                                                | Code that passes `delegation: true` (or another non-string truthy value) to `ajaxForm`                              | "delegation: true binds every form on the page", always (even without debug)     |
| [The iframe transport is used only with `iframe: true`](#the-iframe-transport-is-used-only-with-iframe-true)                                        | Uploads in browsers without `FormData` or the File API                                                              | "choosing the iframe transport automatically", under debug                       |
| [The package has an `exports` map](#the-package-has-an-exports-map)                                                                                 | Node ES module imports of jquery-form, and imports of paths outside `dist`                                          | None                                                                             |
| [`src` is no longer published](#src-is-no-longer-published)                                                                                         | Code that imports files from `jquery-form/src`                                                                      | None                                                                             |
| [Iframe `.done` and `.then` receive the parsed data](#iframe-done-and-then-receive-the-parsed-data)                                                 | `iframe: true` uploads that read the response in `.done` or `.then`                                                 | None                                                                             |
| [Replacing `$.fieldValue` no longer changes what is sent](#replacing-fieldvalue-no-longer-changes-what-is-sent)                                     | Pages that replace `$.fieldValue` to change the values sent                                                         | "replacing $.fieldValue to change what is serialized is deprecated", under debug |
| [Selector options are never parsed as HTML](#selector-options-are-never-parsed-as-html)                                                             | Code that passes markup in `target` or `iframeTarget`, or a positional pseudo-class in `includeHidden`              | None                                                                             |
| [Fields are sent in tree order](#fields-are-sent-in-tree-order)                                                                                     | Servers that depend on field order, with an image button or a control outside the form (`form="id"`)                | None                                                                             |
| [Only buttons, inputs, selects and textareas are sent](#only-buttons-inputs-selects-and-textareas-are-sent)                                         | Forms with form-associated custom elements, and `filtering` callbacks that count or see other elements              | None                                                                             |
| [`semantic` is ignored](#semantic-is-ignored)                                                                                                       | Code that passes `semantic: true`, or a first argument to `formToArray` or `formSerialize`                          | None                                                                             |
| [A clicked image button sends only its coordinates](#a-clicked-image-button-sends-only-its-coordinates)                                             | Servers that read the `name=value` of an image button to tell which button was clicked                              | None                                                                             |
| [A clicked image button without a name sends `x` and `y`](#a-clicked-image-button-without-a-name-sends-x-and-y)                                     | Forms with an unnamed image button, and servers that have a field named `x` or `y`                                  | None                                                                             |
| [Controls with `dirname` send their direction](#controls-with-dirname-send-their-direction)                                                         | Forms with a `dirname` attribute on an input or a textarea                                                          | None                                                                             |
| [A hidden `_charset_` input sends `UTF-8`](#a-hidden-_charset_-input-sends-utf-8)                                                                   | Forms with `<input type="hidden" name="_charset_">`                                                                 | None                                                                             |
| [An empty file input is sent as an empty file in uploads](#an-empty-file-input-is-sent-as-an-empty-file-in-uploads)                                 | `FormData` uploads with a file input left empty, and servers that read it as a text field                           | None                                                                             |
| [Iframe uploads send the submitter at its place](#iframe-uploads-send-the-submitter-at-its-place)                                                   | `iframe: true` uploads whose server depends on field order, or whose `data` has a key named like the clicked button | None                                                                             |

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

### Selector options are never parsed as HTML

**What changed.** A string in the `target` or `iframeTarget` option, or the `includeHidden` argument of `clearForm` and `clearFields` (and the `includeHidden` option that `clearForm: true` passes on), is only a selector. 4.x passed `target` and `iframeTarget` to `$()`, which creates elements from a string that starts with `<`, and tested `includeHidden` with `.is()`, which does the same when the string also has a positional pseudo-class such as `:first`. 5.0 matches them with `jQuery.find` and `jQuery.filter`, which never parse HTML:

- A string `target` is found in the document with `jQuery.find(target)`, when the response arrives, as before.
- A string `iframeTarget` is found in the form's document with `jQuery.find(iframeTarget, document)`.
- A string `includeHidden` is tested on each element alone with `jQuery.filter(includeHidden, [element])`.

An element or a jQuery object in `target` or `iframeTarget` is used as before. A string that starts with `<` is never a valid selector, so it throws `Error: Syntax error, unrecognized expression: <the string>` on every supported jQuery: in `target`, when the response arrives, before the `success` callbacks run; in `iframeTarget`, from `ajaxSubmit`, after `beforeSubmit` and before `beforeSend`, any global ajax event or the post. 4.x created the elements, detached from the page: a `target` was filled out of sight, and an `iframeTarget` upload ended with the error `jquery.form: the upload frame is not in the document`.

A positional pseudo-class in `includeHidden` (`:first`, `:last`, `:eq()`, `:even`, `:odd`, `:lt()`, `:gt()`) now tests each element alone, as if it were the only one: `:first`, `:last`, `:eq(0)` and `:even` match every element, and `:eq(1)` and `:odd` match none. In 4.x they counted the matches in the whole document. A string with markup and a positional pseudo-class now throws the same syntax error; 4.x parsed the markup and matched nothing. Other selectors match as before.

**Why.** Creating elements from an option's string runs the markup's inline event handlers (such as an `<img onerror>`), so a selector option built from untrusted input could run script (`docs/research/security-review.md` finding 11, and the `iframeTarget` lookup that CodeQL alert 7 reports). Testing each element alone is what an element filter means, and does not depend on the rest of the page.

**Are you affected?** Only if you pass markup in `target` or `iframeTarget`, which never filled or used a frame in the page, or use a positional pseudo-class in `includeHidden`. 4.x has no warning for this. Pass a selector, an element or a jQuery object, and give the controls to clear a class instead of picking them by position.

Before (4.x), the first hidden input with the class `token` in the document is cleared:

```javascript
$("#myForm").clearForm(".token:first");
```

After (5.0), `:first` matches every `.token` input, so mark the one to clear:

```javascript
$("#myForm").clearForm(".token.clear-me");
```

Before (4.x), an HTML string creates a detached `<div>`, which receives the response:

```javascript
$("#myForm").ajaxSubmit({ target: "<div></div>" }); // the response is not shown
```

After (5.0), the same option throws a syntax error when the response arrives. Pass the element to fill:

```javascript
$("#myForm").ajaxSubmit({ target: "#output" });
```

### Fields are sent in tree order

**What changed.** `formToArray`, `formSerialize` and `ajaxSubmit` (and so `ajaxForm`) return and send a form's fields in tree order, the order a native submission and `new FormData(form)` use, whatever options you pass. Two kinds of field move:

- A control outside the form that names it in its `form` attribute (`<input form="myForm">`) is sent at its place in the document. With `semantic: true`, 4.x sent it after the form's own controls; without it, 4.x already sent it in place.
- A clicked image button's fields are sent at the image's place. Without `semantic: true`, 4.x sent them after every other field of the form.

The `data` option and `extraData` are still sent after the form's fields. The iframe transport posts the form itself, so the form's own fields were already in tree order there.

**Why.** A server that reads fields in order, for example one that pairs repeated names by position, gets the order of a native submission, and the order no longer depends on an option.

**Are you affected?** Only if a form has an image button or a control outside it with a `form` attribute, and your server or a `beforeSubmit` callback depends on the order of the fields. 4.x has no warning for this.

Before (4.x), with the image button `map` clicked at 3,4 and no `semantic` option:

```html
<form id="myForm">
  <input name="a" value="1" />
  <input type="image" name="map" value="go" src="map.png" />
  <input name="b" value="2" />
</form>
```

```text
a=1&b=2&map=go&map.x=3&map.y=4
```

After (5.0), where `map=go` is also gone (see [A clicked image button sends only its coordinates](#a-clicked-image-button-sends-only-its-coordinates)):

```text
a=1&map.x=3&map.y=4&b=2
```

### Only buttons, inputs, selects and textareas are sent

**What changed.** The fields come from submittable elements only: `button`, `input`, `select` and `textarea`. A form sends the ones it owns, as the HTML spec defines it: its descendants that are not owned by another form, and the controls elsewhere in its document (or shadow root) that name it in their `form` attribute. A fieldset, a `div`, the document or another container passed to `formToArray` sends its submittable descendants in tree order, but no controls outside it. Compared with 4.x:

- A form-associated custom element (a custom element with `static formAssociated = true`) is not sent. 4.x sent its `name` and `value` properties.
- 4.x also sent other named descendants, such as `<a name>` and `<img name>`, with an empty value: always for a `div` or the document, and for a form with `semantic: true`. With `semantic: true`, a container with an `id` also sent the outside controls that named that `id`.
- A clicked image button that the form does not own (a `clk` property the page set to another form's image) is not sent; 4.x sent it after the other fields.
- The `filtering` option and the third argument of `formToArray` receive only these candidates, so the `index` they get counts only them. In 4.x they also received fieldsets, outputs, objects and custom elements, and with `semantic: true` every descendant of the form.

**Why.** These are the elements a native submission reads. A custom element's form value is set with `ElementInternals.setFormValue()`, which script cannot read back, so its `value` property was not what a native submission sends.

**Are you affected?** Only if a form holds form-associated custom elements, a `filtering` callback relies on its `index` or on seeing other elements, or you set a form's `clk` yourself. 4.x has no warning for this. To send a custom element's value, copy it into a hidden input or pass it in the `data` option.

Before (4.x), where `<my-rating>` is a form-associated custom element whose `value` property is `"4"`:

```html
<form id="myForm">
  <my-rating name="rating"></my-rating>
  <input name="a" value="1" />
</form>
```

```text
rating=4&a=1
```

After (5.0):

```text
a=1
```

### `semantic` is ignored

**What changed.** The `semantic` option and the first argument of `formToArray` and `formSerialize` are ignored, like any option `$.ajax` does not know, and passing them throws no error. 5.0 always serializes in native tree order, which `semantic: true` approximated. `formToArray` keeps its arguments in place, so the elements list and `filtering` are still its second and third arguments.

**Why.** `semantic: true` read every descendant of the form instead of `form.elements`, which leaves out image buttons, so that a clicked image's fields were sent at its place; it then sent outside controls last. 5.0 reads the form's own controls in tree order in every case, so there is nothing left for the option to choose.

**Are you affected?** Search your code for `semantic` and for `formToArray(true` or `formSerialize(true`. With `semantic: true`, outside controls (`form="id"`) are now sent at their place in the document, as described in [Fields are sent in tree order](#fields-are-sent-in-tree-order). 4.x has no warning for this. Leave the option out.

Before (4.x):

```javascript
$("#myForm").ajaxSubmit({ semantic: true });
var fields = $("#myForm").formToArray(true, elements);
```

After (5.0):

```javascript
$("#myForm").ajaxSubmit();
var fields = $("#myForm").formToArray(false, elements);
```

With `semantic: true` and `<input name="out" value="o" form="myForm" />` placed before `<form id="myForm"><input name="a" value="1" /></form>`, 4.x sends:

```text
a=1&out=o
```

5.0 sends:

```text
out=o&a=1
```

### A clicked image button sends only its coordinates

**What changed.** When an image button (`<input type="image">`) submits the form, `formToArray`, `formSerialize` and `ajaxSubmit`, on every transport, send only its coordinates, `name.x` and `name.y`. 4.x also sent `name=value` before them.

**Why.** A native submission never sends an image button's value, only the point that was clicked, so 4.x sent a field the server would not get from the same form without the plugin.

**Are you affected?** Only if your server reads the image button's own name (for example `$_POST["map"]` in PHP) to know that it was clicked, or reads its value. 4.x has no warning for this. Check for `name.x` instead, which a native submission sends too (PHP turns the dot into an underscore: `$_POST["map_x"]`). To tell several image buttons apart, give them different names.

Before (4.x), with `<input type="image" name="map" value="go" src="map.png" />` clicked at 3,4:

```text
map=go&map.x=3&map.y=4
```

```php
if (isset($_POST["map"])) { /* the map was clicked */ }
```

After (5.0):

```text
map.x=3&map.y=4
```

```php
if (isset($_POST["map_x"])) { /* the map was clicked */ }
```

### A clicked image button without a name sends `x` and `y`

**What changed.** An image button without a `name` that submits the form sends its coordinates as `x` and `y`, at its place among the fields, on every transport. 4.x sent nothing for it.

**Why.** A native submission sends `x` and `y` for an unnamed image button.

**Are you affected?** Only if a form has an image button without a `name`. Your server now receives `x` and `y`; if the form also has controls named `x` or `y`, the server receives both. 4.x has no warning for this.

Before (4.x), with `<input type="image" src="go.png" />` after `<input name="a" value="1" />`, clicked at 3,4:

```text
a=1
```

After (5.0):

```text
a=1&x=3&y=4
```

### Controls with `dirname` send their direction

**What changed.** An `input` or `textarea` with a non-empty `dirname` attribute sends an extra field, named by that attribute, with the value `ltr` or `rtl`, right after its own field, as a native submission does. The direction comes from `el.matches(":dir(rtl)")`, or from `getComputedStyle(el).direction` in a browser without `:dir()` (before Chrome and Edge 120 and Safari 16.4), where a control outside the document counts as `ltr`. As in the HTML spec, this applies to a `textarea` and to an `input` of type `text`, `search`, `tel`, `url`, `email`, `password` or `hidden`, and to a clicked `submit` input; only a control that is itself sent adds the field. 4.x ignored `dirname`. `fieldSerialize` and `fieldValue` read single controls and do not add it.

**Why.** A server that asked for the direction with `dirname` got it from a native submission but not from the plugin.

**Are you affected?** Only if a form has a `dirname` attribute. Your server now receives the field; if the form also has a control with that name, it receives both. 4.x has no warning for this.

Before (4.x), with `<input name="comment" value="hi" dirname="comment.dir" />`:

```text
comment=hi
```

After (5.0):

```text
comment=hi&comment.dir=ltr
```

### A hidden `_charset_` input sends `UTF-8`

**What changed.** An `<input type="hidden">` whose name is `_charset_` (in any ASCII case) sends `UTF-8`, the encoding of the request, instead of its value, whatever its `value` is. This is the HTML spec's rule for a native submission and `FormData`. `formToArray`, `formSerialize` and the `FormData` and urlencoded transports always encode as UTF-8; the iframe transport posts the form itself, so the browser fills in the form's own encoding there, as in 4.x. A `_charset_` control of another type sends its value as before. 4.x sent the value of the hidden input, or an empty string without one.

**Why.** A server that reads `_charset_` to learn the encoding of the request got whatever the page put in the input, which could say an encoding the plugin did not use.

**Are you affected?** Only if a form has a hidden input named `_charset_` and your server reads its value for something other than the encoding. 4.x has no warning for this. Rename the input to keep its value.

Before (4.x), with `<input type="hidden" name="_charset_" value="ISO-8859-1" />`:

```text
_charset_=ISO-8859-1
```

After (5.0):

```text
_charset_=UTF-8
```

### An empty file input is sent as an empty file in uploads

**What changed.** When `ajaxSubmit` (and so `ajaxForm`) sends a `FormData` upload, a file input without a selected file is sent as an empty file: a part with an empty file name, the type `application/octet-stream` and no bytes, as a native multipart submission sends it. 4.x sent it as an empty text field. `formToArray` still returns `{ name, value: "", type: "file" }` for it, and `formSerialize` and urlencoded requests still send `name=`. The iframe transport posts the form itself, so it already sent an empty file.

**Why.** A server sees an empty file input the same way whether the form was posted natively or through the plugin.

**Are you affected?** Only if your uploads can leave a file input empty and your server reads that input as a text field. PHP now puts it in `$_FILES` with `"error" => UPLOAD_ERR_NO_FILE` (4) instead of setting `$_POST["name"]` to `""`; other frameworks report a missing or empty file the same way. 4.x has no warning for this. Check for the empty upload, not for the text field.

Before (4.x), with an empty `<input type="file" name="avatar" />` in an upload:

```text
Content-Disposition: form-data; name="avatar"

```

```php
if ($_POST["avatar"] === "") { /* no file */ }
```

After (5.0):

```text
Content-Disposition: form-data; name="avatar"; filename=""
Content-Type: application/octet-stream

```

```php
if ($_FILES["avatar"]["error"] === UPLOAD_ERR_NO_FILE) { /* no file */ }
```

### Iframe uploads send the submitter at its place

**What changed.** With `iframe: true`, the field of the clicked submit button (or an image button's coordinates) is a temporary hidden input placed right after the button, so the upload sends it at the button's place among the fields, as a native submission does. A button outside the form passes its `form` attribute on to the input. A button that is in no document sends nothing, as on the other transports. The input is removed after the post, like the other temporary inputs. In 4.x the submitter was added to the extra fields and posted at the end of the form, after the form's own controls and the `data` fields. Two more things follow:

- A key of the `data` (or `extraData`) option named like the clicked button is now sent as well, after the button's field, as the `FormData` and urlencoded transports already send it. 4.x replaced that key's value with the button's and sent one field.
- `extraData` in the settings that `ajaxSuccess`, `ajaxError` and `ajaxComplete` handlers receive, and on `this` in the callbacks, no longer holds the submitter's field. It holds only the `data` fields and the CSRF field.

**Why.** The iframe transport posts the form itself, so every other field was already in native order; the submitter was the one field out of place, and the one place where the iframe and the other transports sent different fields for the same `data`.

**Are you affected?** Only if you pass `iframe: true` and your server depends on where the submitter's field comes, your `data` has a key named like a submit button, or a callback reads the submitter from `extraData`. 4.x has no warning for this. Read the button from the request, or from `$form[0].clk`, instead of from `extraData`.

Before (4.x), with `iframe: true`, `data: { note: "x" }` and the button `go` clicked:

```html
<form id="myForm">
  <button type="submit" name="go" value="send">Send</button>
  <input name="a" value="1" />
</form>
```

```text
a=1&note=x&go=send
```

After (5.0):

```text
go=send&a=1&note=x
```

With `data: { go: "from data" }` instead, 4.x sends `a=1&go=send`, and 5.0 sends `go=send&a=1&go=from+data`.

## What your server receives

These changes alter the fields the plugin sends. The table shows the request body for each entry's example form, urlencoded unless the entry is about uploads; a multipart body carries the same fields in the same order. Each entry above has the details.

| Change                                                                                                              | Example                                                                                                              | 4.x body                         | 5.0 body                                   |
| ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------ |
| [Fields are sent in tree order](#fields-are-sent-in-tree-order)                                                     | the image button `map` clicked at 3,4, between `a` and `b`                                                           | `a=1&b=2&map=go&map.x=3&map.y=4` | `a=1&map.x=3&map.y=4&b=2`                  |
| [Only buttons, inputs, selects and textareas are sent](#only-buttons-inputs-selects-and-textareas-are-sent)         | a form-associated custom element `rating` before `a`                                                                 | `rating=4&a=1`                   | `a=1`                                      |
| [`semantic` is ignored](#semantic-is-ignored)                                                                       | `semantic: true`, with `out` outside and before the form                                                             | `a=1&out=o`                      | `out=o&a=1`                                |
| [A clicked image button sends only its coordinates](#a-clicked-image-button-sends-only-its-coordinates)             | the image button `map`, value `go`, clicked at 3,4                                                                   | `map=go&map.x=3&map.y=4`         | `map.x=3&map.y=4`                          |
| [A clicked image button without a name sends `x` and `y`](#a-clicked-image-button-without-a-name-sends-x-and-y)     | an unnamed image button after `a`, clicked at 3,4                                                                    | `a=1`                            | `a=1&x=3&y=4`                              |
| [Controls with `dirname` send their direction](#controls-with-dirname-send-their-direction)                         | `comment` with `dirname="comment.dir"`                                                                               | `comment=hi`                     | `comment=hi&comment.dir=ltr`               |
| [A hidden `_charset_` input sends `UTF-8`](#a-hidden-_charset_-input-sends-utf-8)                                   | a hidden `_charset_` with the value `ISO-8859-1`                                                                     | `_charset_=ISO-8859-1`           | `_charset_=UTF-8`                          |
| [An empty file input is sent as an empty file in uploads](#an-empty-file-input-is-sent-as-an-empty-file-in-uploads) | an empty file input `avatar` in a `FormData` upload                                                                  | the text part `name="avatar"`    | the file part `name="avatar"; filename=""` |
| [Iframe uploads send the submitter at its place](#iframe-uploads-send-the-submitter-at-its-place)                   | `iframe: true`, the button `go` before `a`, `data: { go: "from data" }`; `extraData` in callbacks no longer has `go` | `a=1&go=send`                    | `go=send&a=1&go=from+data`                 |
