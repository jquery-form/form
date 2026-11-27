---
---

## Getting Started

### Overview

The jQuery Form Plugin sends an ordinary HTML form with AJAX. Its main methods, `ajaxForm` and `ajaxSubmit`, read the form's action, method and fields, including file uploads and the button that was clicked, and send the same fields a normal submission would. [Options](options.md) control everything else, from where the response goes to how it is parsed.

5.0 needs jQuery 3.5 or later and a current browser. Upgrading from 4.x? See the [migration guide](migrating-to-5.md).

### Quick Start Guide

1. Add a form to your page. Just a normal form, no special markup required:

   ```html
   <form id="myForm" action="/comments" method="post">
     <label>Name: <input type="text" name="name" /></label>
     <label>Comment: <textarea name="comment"></textarea></label>
     <button type="submit">Submit Comment</button>
   </form>
   ```

2. Load jQuery and the plugin, then bind the form when the page is ready. The scripts below load from a CDN; to bundle the plugin instead, see [Installation](#installation).

   ```html
   <script
     src="https://code.jquery.com/jquery-3.7.1.min.js"
     integrity="sha256-/JqT3SQfawRcv/BIHPThkBvs0OEvtFFmqPF/lYI/Cxo="
     crossorigin="anonymous"
   ></script>
   <script
     src="https://cdn.jsdelivr.net/npm/jquery-form@4.6.0/dist/jquery.form.min.js"
     integrity="sha384-6nWaJ1CxEQhUyWbY8mCCA3pAsWr1hPIee2byhQUP4SN9ydEguzTY7hVQV/NVNgiQ"
     crossorigin="anonymous"
   ></script>
   <script>
     $(() => {
       // send #myForm with AJAX, and thank the user when it succeeds
       $("#myForm").ajaxForm(() => {
         alert("Thank you for your comment!");
       });
     });
   </script>
   ```

**That's it!**

When the form is submitted, its _name_ and _comment_ fields are posted to `/comments` and the page stays where it is. If the server returns a success status, the user sees a "Thank you" message.

### Installation

Install the plugin from npm:

```sh
npm install jquery-form
```

jQuery is a peer dependency: npm 7 and later install it with the plugin, unless your project already has jQuery 3.5 or later.

With a bundler or ES modules, importing the package registers the plugin on the jQuery that `import "jquery"` resolves to:

```javascript
import $ from "jquery";
import "jquery-form";
```

With CommonJS, the package exports a factory that takes the window and jQuery, registers the plugin and returns jQuery:

```javascript
const $ = require("jquery");
require("jquery-form")(window, $);
```

AMD loaders get the plugin as a module that depends on `jquery`. Without a bundler, load `dist/jquery.form.min.js` with a script tag after jQuery, as in the Quick Start above.

### Next Steps

- The [API](api.md) describes every method, and [Options](options.md) every option.
- The [Examples](examples.md) cover callbacks, validation, JSON, XML and HTML responses, and file uploads.
- [Form Fields](form-fields.md) shows how to read single fields with `fieldValue` and `fieldSerialize`.

*[AJAX]: Asynchronous JavaScript and XML
