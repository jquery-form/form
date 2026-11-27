---
---

## Frequently Asked Questions

#### Does the plugin have any dependencies?

Only jQuery, which is a peer dependency: npm 7 and later install it with the plugin, unless your project already has jQuery 3.5 or later.

#### Which versions of jQuery does it work with?

jQuery 3.5 and later. 5.0 is tested against jQuery 3.5.0, 3.7.1 and 4.0.0. The jQuery slim builds are not supported, because they leave out AJAX. For older jQuery versions, use the latest 4.x.

#### I use 4.x. How do I upgrade to 5.0?

Read the [migration guide](migrating-to-5.md). It lists every change, who is affected and what to do, with before and after code. Its summary table shows quickly which changes affect you.

#### Does it serialize forms accurately?

Yes. It follows the HTML rules for which controls are submitted and in what order (see [Why aren't all my input values posted?](#why-arent-all-my-input-values-posted)). The test suite compares what it sends with the browser's own `FormData` on generated forms, and with what a server receives from a native submission. The [Options](options.md#differences-from-a-native-submission) page lists the few deliberate differences.

#### Is it fast and small?

The minified build is about 24 kB, or 9 kB gzipped. Apart from `iframe: true` uploads, each request is an ordinary `$.ajax` call, so it costs what any jQuery AJAX request costs.

#### What is the easiest way to use it?

Call [`ajaxForm`](api.md#ajaxform) on your form when the page is ready. It does everything needed to send the form with AJAX when the user submits it.

#### What is the difference between `ajaxForm` and `ajaxSubmit`?

1. `ajaxSubmit` submits the form, `ajaxForm` does not. When you call `ajaxSubmit`, it serializes the form and sends it to the server right away. When you call `ajaxForm`, it adds the event listeners that detect when the user submits the form, and then calls `ajaxSubmit` for you.
2. With `ajaxForm`, the request includes the name and value of the button that submitted the form (or its click coordinates, for an image button). `ajaxSubmit` called from your own code cannot know which button was clicked.

#### How can I cancel a form submission?

Return `false` from a [`beforeSubmit`](options.md#beforesubmit) callback. See the [validation examples](examples.md#validation).

#### Can I use it with a bundler or as an ES module?

Yes. `import "jquery-form"` registers the plugin on the jQuery that `import "jquery"` resolves to. The package also works with CommonJS, AMD and a plain script tag; see [Installation](index.md#installation). It does not include TypeScript type declarations.

#### Does it support file uploads?

Yes. A form with a selected file is sent with `FormData`, with no extra code. See the [file upload example](examples.md#file-upload).

#### How do I display upload progress?

Pass an [`uploadProgress`](options.md#uploadprogress) callback. It receives the progress event, the bytes sent, the total and the percentage as the upload proceeds. The iframe transport (`iframe: true`) cannot report progress.

#### Why aren't all my input values posted?

The plugin sends the same fields as a normal submission: only [successful controls](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#constructing-the-form-data-set). A control is not sent when it has no `name`, is disabled, or is an unchecked checkbox or radio button, or a submit button that did not submit the form.

#### Is there a test suite?

Yes. It runs in Chromium, Firefox and WebKit against each supported jQuery version, and end-to-end tests post forms to a real server. See [Testing](https://github.com/jquery-form/form/blob/main/CONTRIBUTING.md#testing) in the contributing guide to run it.
