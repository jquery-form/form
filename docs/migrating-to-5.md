# Migrating from 4.x to 5.0

This guide is for people who use jquery-form 4.x and are moving to 5.0. 5.0 has breaking changes.

4.x stays available (`npm install jquery-form@4`, dist-tag `v4`) and gets security fixes. To see warnings for most of the removed features, turn on `$.fn.ajaxSubmit.debug = true` on the latest 4.x and run your code. Feedback goes to https://github.com/jquery-form/form/issues/629.

## Summary

| Change                                                                                                        | Who is affected                                                                      | 4.x warning                      |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------- |
| [jQuery 3.5 or later is required, as a peer dependency](#jquery-35-or-later-is-required-as-a-peer-dependency) | Apps on jQuery before 3.5, and installs that relied on jquery-form to pull in jQuery | "jQuery before 3.5", under debug |
| [`form.jquery.json` is removed](#formjqueryjson-is-removed)                                                   | Tools that read the old plugins.jquery.com manifest                                  | None                             |

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

## What your server receives

This section will hold before and after request bodies for the serialization changes.
