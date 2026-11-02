# Migrating from 4.x to 5.0

This guide is for people who use jquery-form 4.x and are moving to 5.0. 5.0 has breaking changes.

4.x stays available (`npm install jquery-form@4`, dist-tag `v4`) and gets security fixes. To see warnings for most of the removed features, turn on `$.fn.ajaxSubmit.debug = true` on the latest 4.x and run your code. Feedback goes to https://github.com/jquery-form/form/issues/629.

## Summary

| Change                                                                                                                                              | Who is affected                                                                      | 4.x warning                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| [jQuery 3.5 or later is required, as a peer dependency](#jquery-35-or-later-is-required-as-a-peer-dependency)                                       | Apps on jQuery before 3.5, and installs that relied on jquery-form to pull in jQuery | "jQuery before 3.5", under debug                            |
| [`form.jquery.json` is removed](#formjqueryjson-is-removed)                                                                                         | Tools that read the old plugins.jquery.com manifest                                  | None                                                        |
| [`$.fn.attr2` is removed](#fnattr2-is-removed)                                                                                                      | Code that calls `attr2`                                                              | "attr2 is deprecated", under debug                          |
| [`ajaxForm` on an empty selection before the DOM is ready no longer waits](#ajaxform-on-an-empty-selection-before-the-dom-is-ready-no-longer-waits) | Pages on jQuery before 3 that call `ajaxForm` before their forms exist               | "queuing ajaxForm", under debug                             |
| [Internet Explorer, Opera Presto and EdgeHTML are no longer supported](#internet-explorer-opera-presto-and-edgehtml-are-no-longer-supported)        | Pages that still serve Internet Explorer, Opera 12 or earlier, or Edge 18 or earlier | None                                                        |
| [`clearInputs` is removed](#clearinputs-is-removed)                                                                                                 | Code that calls `clearInputs`                                                        | "clearInputs is deprecated", under debug                    |
| [`closeKeepAlive` is ignored](#closekeepalive-is-ignored)                                                                                           | Iframe uploads that pass `closeKeepAlive`                                            | "closeKeepAlive works around a Safari 3/4 bug", under debug |

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

## What your server receives

This section will hold before and after request bodies for the serialization changes.
