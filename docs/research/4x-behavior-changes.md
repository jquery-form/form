# Behavior changes on the 4.x line (for release notes)

Collected as the modernization proceeds. Each entry is a change a consumer could notice.

## Phase 6

- **JSON responses are parsed with `JSON.parse`.** The `eval` fallback used when `$.parseJSON` was missing is gone (jQuery 4 removed `$.parseJSON`, which would have left `eval` live on every JSON response). JSON that only `eval` accepted, such as single-quoted strings or unquoted keys, now throws a parse error instead of being evaluated.
- **jQuery 4 compatibility.** `$.trim`, `$.isFunction` and `$.isArray`, which jQuery 4 removed, are replaced with `String.prototype.trim` (applied only to string actions), `typeof x === "function"` and `Array.isArray`. Behavior on jQuery 1.7.2 and later is unchanged.
- **`package.json` has a `files` list** (`dist`, `src`). The published tarball no longer carries tests, docs, CI config or the other repository files. `main`, `module` and `browser` still point at `dist/`.
- **`form.jquery.json` no longer lists the old Grunt, Mocha and Chai `devDependencies`.**

## Phase 9

- **Iframe uploads with `dataType: "script"` now run the response.** The iframe transport returned the script text without evaluating it; it now evaluates it with `$.globalEval`, as `$.ajax` does. Only an explicit `dataType: "script"` does this. Other data types are unchanged.

## Phase 10

- **A `<button>` without a `type` attribute is captured as the submitter (#588).** Its name and value are sent, as in a native submit. Clicks on other elements that only carry a `type="submit"` attribute, and on submit controls that belong to no form, are ignored instead of throwing.
- **`resetForm`, `clearFields`, `fieldValue` and `selected` accept nodes without a tag name (#600).** `resetForm` on the document resets the fields inside it. Text nodes are skipped.
- **The Rails CSRF token is added only to same-origin iframe uploads.** An upload whose `url` or action points to another origin no longer receives the `<meta name="csrf-token">` value. `jquery-ujs` behaves the same way.
- **The Rails CSRF token is sent only with iframe uploads that post the form.** A GET iframe upload used to add the token to the query string.
- **An aborted iframe upload rejects its Deferred and finishes its global events.** `abort()` rejects the returned jqXHR with `(xhr, "aborted", status)`, fires `ajaxComplete` and `ajaxStop`, decrements `$.active` and removes the iframe. Timeouts and server aborts do the same, and their rejection arguments are unchanged. A second `abort()`, an abort after the upload completed, or one from the `success` callback does nothing. An abort while the response is processed (for example from `dataFilter`) completes the upload once.
- **Iframe responses that fail to parse report `parsererror`.** An emulated 2xx status (the `status` attribute on the response body or textarea) used to turn a parse error into `success` with no data. An emulated error status still reports `error`.
- **FormData uploads serialize `data` with the global `$.ajaxSettings.traditional`,** as the other transports already did. `data: {}` no longer adds a field with an empty name.
- **GET urls keep the form data when the `url` option has a fragment.** The query now goes before the fragment; jQuery used to drop it with the fragment. An action that is only a fragment, read raw because a control is named `action`, now submits to the current page instead of throwing on GET or posting to `undefined`.
- **Controls named like form members no longer break serialization or uploads.** A control named `elements` no longer hides the other fields from `formToArray`. Controls named `setAttribute` or `removeAttribute` no longer break the iframe transport, except on jQuery 1.7.2, whose selector engine fails on them first. After an iframe upload, a form with a control named `action` and no `action` attribute keeps having none.
- **An extra field named `hasOwnProperty` no longer breaks iframe uploads,** whether it comes from `data`, `extraData` or the submit button's name.
- **`dist/` files no longer contain `/* eslint */` or `/* global */` comments (#553),** which applied to code concatenated after the plugin.

### Security fixes (4.4.0)

- **The iframe transport builds its hidden inputs and iframe with DOM APIs (GHSA-x8mc-9vpg-2rc8).** Field names, the clicked button's name, the `csrf-param` meta content and `iframeSrc` are no longer parsed as HTML. Array and object `data`/`extraData` values are sent as separate fields, as `$.param` sends them (#597).
- **`resetForm` on a `<label>` resets the control whose id its `for` attribute names (GHSA-8395-7m7x-q7q2).** It used to pass `for` to `$()` as a selector, which matched nothing for a plain id and threw when it matched.
- **`formToArray` with `semantic: true` matches `form="…"` controls by comparing the attribute (GHSA-g7mw-rwc2-4h3g),** so a form id with quotes or brackets no longer throws or adds unrelated fields.
- **`target` inserts only string responses (GHSA-4w39-46xw-8jm2).** If jQuery has parsed the response (JSON or XML), the target is left unchanged, a `debug` message is logged, and `success` is still called.

## Phase 12

- **Controls named like more form members no longer break the plugin.** Controls named `getAttribute`, `getElementsByTagName`, `ownerDocument`, `tagName` or `nodeType` no longer make `formToArray`, `ajaxSubmit`, iframe uploads, `resetForm` or `ajaxForm`'s submit handler throw or skip the form. jQuery 1.7.2's selector engine (and jQuery 3's, for `getElementsByTagName` with `semantic`) still fails on some of them first. The `method`, `action` and `target` values used for the request are unchanged: the property, or the raw attribute when a control shadows it.
- **A control named `parentNode` throws a clear error instead of hanging the page.** `ajaxSubmit` and `ajaxForm`'s click capture throw `jquery.form: a form control named "parentNode" hides the form's parentNode; rename the control`. The plugin's own tree walks use the real parent.
- **An iframe upload puts the form's attributes back exactly (#380).** `action`, `target`, `method`, `enctype` and `encoding` are restored to their raw values, or removed when they were absent, also with `skipEncodingOverride` and when the subject is not a form. The `action` no longer becomes absolute, no `encoding` attribute is left behind, and a later submit of the same form without files no longer picks the multipart transport.
- **`resetForm` resets a form whose controls are named `reset`.** One or more controls named `reset` used to make it do nothing or throw; the `resetForm` option of `ajaxSubmit` follows.
- **The classic build runs its whole factory in strict mode.** The `'use strict'` directive moved to the top of the UMD factory (the same three `dist` files, ADR-0001).
- **An iframe upload whose frame is not in the document fails instead of opening a new window.** When a connected form sits outside `<body>`, or `iframeTarget` is a frame not in the document, the native submit is no longer called (it posted the form into a new top-level window and reported `aborted`/`server abort`). The upload settles once with `error` and `jquery.form: the upload frame is not in the document`: the `error` callback, a rejected Deferred, and `ajaxError`/`ajaxComplete`/`ajaxStop`. A form not in the document still reports a server abort.
- **`false` or `""` as the url submits to the form action.** `ajaxSubmit(false)`, `ajaxSubmit("")`, `ajaxForm(false)` and a `url` option of `false` or `""` used to throw on a GET form or post to the page URL (or `/false`); they now use the form's `action`, like no url at all.
- **`error` and `complete` accept arrays of functions, as in `$.ajax`.** Each function runs in order and also receives the form. An array used to throw (`apply is not a function`) and no callback ran. With `target`, every function of a `success` array now runs for each target element; none ran before, and `complete` was skipped.
- **`success` runs when `target` matches nothing.** It runs once, with the usual `this` (`context`, or jQuery's settings). It used to be skipped silently. With matches, it still runs once per target element with `this` set to that element.
- **`this` in callbacks is the `context` object itself.** A plain-object `context` used to be deep-copied while the options were merged, so `beforeSend`, `success`, `error` and `complete` ran with a copy (two different copies on uploads). They now run with the caller's object on every transport, as with `$.ajax`. Code that relied on changing the copy now changes the original.
- **One request method, used by every transport.** The method is resolved after `beforeSubmit` and `form-submit-validate`, and the `method` option wins over `type`. `{method: "POST", type: "GET"}` used to build a GET (query in the url) that jQuery 3 and 4 then sent as a POST with no body, and `{method: "GET", type: "POST"}` posted a body on jQuery 1.7.2. A `type` changed in `beforeSubmit` is now used by FormData uploads too. An iframe upload with a `GET` method on a `method="post"` form now submits with GET and sends no CSRF field; methods other than `GET` and `POST` still post with the form's own method. A form without a `method` attribute, or with `method="put"`, still submits with GET.
- **A string `data` option is a query string.** It is appended as-is to a urlencoded body or GET url, and split into its own fields for FormData and iframe uploads. It used to be sent one character at a time (`0=x&1=%3D&2=1`), and an iframe upload with a clicked submitter or the CSRF metas threw.
- **`ajaxSubmit` on jQuery's slim build throws a clear error (#541).** The slim builds have no `$.ajax`. `ajaxSubmit` now throws `jquery.form: ajaxSubmit needs the full jQuery build; this jQuery has no $.ajax` before any event or callback, instead of a `TypeError` about `success`. An empty selection still returns silently.
- **New option `requestFormat: "json"` (#545).** It sends the fields (repeated names as arrays) merged with object `data` as a JSON body with `contentType: "application/json; charset=UTF-8"`. It throws a clear error on a GET method, with string `data`, with files or a multipart form, and with the iframe transport. Based on the idea in PR #557 by zhangciwu.
- **The iframe upload fires its events in `$.ajax` order.** `ajaxSend` now fires after `beforeSend`, and not at all when `beforeSend` returns `false` or aborts. A `beforeSend` veto rejects the Deferred and fires `ajaxError` (`"canceled"`), `ajaxComplete` and `ajaxStop`, so `$.active` drops back and global spinners stop; it used to fire `ajaxSend` and leave the global events open. The `complete` callback runs before `ajaxComplete` and `ajaxStop` (it ran after them), and `ajaxSuccess` handlers receive the parsed data as their fourth argument. Unchanged until 5.0: `.done` receives the response text, and a parse error rejects with `"error"`.

- **Every iframe upload settles once, also when it fails with an exception.** An `iframeTarget` that matches nothing, or a subject that is not a form, used to throw and leave `$.active` raised with no `ajaxStop`. The upload now settles with `"error"` and the exception: the `error` callback, a rejected Deferred, `ajaxError`, `complete`, `ajaxComplete` and `ajaxStop`. A `success` callback that throws no longer leaves the Deferred pending and the global events open; its exception still reaches the console, after the upload settled. `beforeSend` that aborts and returns `false` no longer decrements `$.active` twice.

- **`abort()` before the delayed iframe post cancels it.** Without `forceSync`, the form is posted about 10 ms after `ajaxSubmit` returns. An `abort()` in that window reported `aborted` and still posted the form; the form is no longer posted.

- **Iframe uploads that start in the same millisecond use different frames.** The generated frame name (`jqFormIO` and digits) now ends with a per-page counter. Two uploads started in the same millisecond shared one name: only the second was posted, the first reported its response, and the second never completed.

- **Iframe uploads read `dataType` without regard to case, as `$.ajax` does.** `dataType: "JSON"` used to deliver the unparsed text, and `"XML"` did not read the response as XML. An XML response is still read as XML whatever the `dataType`.

- **An unnamed `iframeTarget` already in the page receives the upload.** The plugin named the frame only through its `name` attribute, which Chromium does not apply to a frame already inserted: the form was posted to a new window and the upload never settled. The frame's window is now named too, when the page may rename it.

- **A control inside a form whose `form` attribute names that same form is sent once.** With `semantic: true` such a control was collected twice, as a descendant and again as an outside control.

- **Named `fieldset`, `output` and `object` elements are no longer sent.** `formToArray` (and so `ajaxSubmit` and `formSerialize`) sent them as fields, `output` with its text; native submission never includes them.

- **A clicked image button is sent when it is the form's only control.** With `semantic` off, `formToArray` returned no fields when the form had no other listed control, so the image's name, value and coordinates were dropped.

- **Selected files are sent by name, never as `[object File]`, and outside file inputs are uploaded (D-03).** `formSerialize` now gives a selected file's name, as native urlencoded submission does. A file input outside the form that belongs to it through `form="id"` now makes `ajaxSubmit` choose the FormData upload; it used to be ignored and the file was sent as `[object File]`.

- **`fieldSerialize` skips forms (D-28).** A named `<form>` in the set used to be sent as an empty field (`other=`).

- **Controls in a disabled `<fieldset>` and options in a disabled `<optgroup>` are no longer sent.** This aligns `formToArray`, `ajaxSubmit`, `formSerialize` and `$.fieldValue` with the HTML spec, native submission and jQuery 3's `serializeArray`: a control is disabled also through a disabled ancestor (controls in the fieldset's first `<legend>` stay enabled). Servers receive fewer fields from such forms. Browsers without `Element.matches` read only the control's own `disabled`.

- **`semantic: true` sends only the controls the form owns.** This aligns semantic mode with the HTML spec's form owner: a descendant whose `form` attribute names another form, or names no form in the page, is no longer sent; an outside control naming the form's id is sent only to the form that owns it (the first form with that id in the document), so a second form with the same id or a detached form no longer collects it. Subjects that are not forms (a fieldset, the document) are unchanged.

- **A lone carriage return is sent as CRLF on every jQuery version (D-26).** `formToArray`, `formSerialize`, `fieldValue` and `ajaxSubmit` used to drop it on jQuery before 4.0 (`.val()` strips carriage returns) and send it bare on 4.0. A value a jQuery `valHook` returns is still used as-is, apart from line breaks.

- **Controls named `clk`, `clk_x` or `clk_y` no longer break the clicked submitter.** `ajaxForm` keeps the clicked button in a private store; a click on such a form used to throw, and `formToArray` sent a submit button named `clk` as if it had been clicked. The form's `clk`, `clk_x` and `clk_y` properties are still set when they can be, and a submitter a page sets there is still sent when no click was captured.

- **`ajaxForm` sends the submitter the browser names when no click was captured (D-05).** A submit button outside the form (`form="id"`) and the button passed to `requestSubmit()` are now sent, from `SubmitEvent.submitter` where the browser has it; an image submitter sends the point `0,0`, as native submission does. A captured click still wins.

- **A file upload with a GET method puts the file name in the url, never `[object File]` (D-03).** `ajaxSubmit` builds the query string of a GET upload (and of a container that is not a form, before FormData posts it) from the file names, as `formSerialize` does.

- **New: `delegation: "<selector>"` scopes `ajaxForm` delegation.** The plugin binds one submit and one click handler on the document for that selector, used as given, and the selection is ignored. A form submits through the plugin only when it or an ancestor matches. Binding the same selector again replaces its options. An empty string throws `jquery.form: delegation needs a selector, or true`; it used to mean no delegation. The string stays in the options object (it was rewritten to `true`). `delegation: true` is unchanged.

- **`ajaxFormUnbind()` also removes delegated bindings; `ajaxFormUnbind(selector)` removes one.** Called without a string, it removes the selection's handlers and every `delegation` binding the plugin made on the document (`true` and selectors); delegated handlers used to stay until `$(document).off(".form-plugin")`. With a selector string it removes only that selector's binding and leaves the selection alone. `ajaxForm`'s own rebind of a selection still leaves the document handlers in place.

- **`delegation: true` warns on jQuery 3 and later.** When the selection has no `.selector` (jQuery 3.0 removed it), each such `ajaxForm` call logs one `console.warn`, even with `debug` off: the binding covers every form on the page, so its options (`data`, `headers`) go with any form's submission. Pass a selector instead. Nothing is logged on jQuery 1.7.2 or without `console.warn`; the binding itself is unchanged.

- **`resetForm` no longer rewrites the value of checkboxes, radios, hidden inputs and buttons (D-12).** Resetting such an input one by one (a container, a `<div>`, or the input itself) wrote its default value into the `value` attribute, so a checkbox without `value` was sent as `c=` instead of `c=on`, and a submit button without `value` lost its default label. These types now keep their value, as in a native form reset.

- **`resetForm` empties file inputs instead of throwing (D-12).** A file input with a `value` attribute, reset one by one, threw `InvalidStateError`; it is now emptied, as in a native form reset.

- **`resetForm` selects the last default option of a single select (D-12).** With two `selected` options in a single select, `resetForm` on the select or a container picked the first; the native reset and the page's initial parse pick the last.

- **`clearForm` and `clearFields` clear `datetime-local` inputs (D-13).** They kept their value, while `date` and `time` were cleared. The obsolete `datetime` type stays in the list until 5.0.

- **A multipart `enctype` is recognized without regard to case or surrounding spaces (D-25).** `enctype="Multipart/Form-Data"` sent the form urlencoded; it now chooses the FormData upload, as the browser does.

- **`uploadProgress` keeps a custom `xhr` factory (D-15).** With `uploadProgress`, an `xhr` option (or `$.ajaxSetup({xhr})`) was replaced by jQuery's default factory and never called. The plugin now wraps the factory in use and adds its progress listener to the object it returns.

- **`uploadProgress` reports position 0 and 0 percent for the first event (D-15).** An event with `loaded: 0` reported the deprecated `position` property instead (`undefined`, so the percent was `NaN`). `position` is now read only when the event has no `loaded`.

- **`beforeSend` returning `false` cancels a FormData upload.** The plugin's wrapper dropped the return value, so the upload was sent anyway; a `false` from the `beforeSend` option or from `$.ajaxSetup` now cancels it, as it already did for plain requests and iframe uploads.

## Known behavior, not changed

- **`dataType: "script"` on jQuery 4** delivers `undefined` to `success`; jQuery 4 loads async script requests through a script tag. The script still runs. This comes from jQuery, not the plugin.
- **`delegation: true` is not selector-scoped on jQuery 3 and later** (use `delegation: "<selector>"`; it warns), and `ajaxForm` called on an empty selection before DOM ready is dropped. See `selector-context-delegation.md`.
- **No `exports` map** on 4.x so deep paths keep resolving; planned for 5.0.
