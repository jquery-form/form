---
---

## Frequently Asked Questions

#### Does jQuery Form Plugin have any dependencies?

The only dependency is jQuery itself.

#### Which versions of jQuery is jQuery Form Plugin compatible with?

jQuery Form Plugin is compatible with jQuery v1.7.2 and later. `main` is tested against jQuery 1.7.2, 3.7.1 and 4.0.0; jQuery 4 needs 4.4.0 or later. The jQuery slim builds are not supported because they leave out AJAX.

#### Is jQuery Form Plugin fast? Does it serialize forms accurately?

Yes. It follows the HTML rules for which controls are submitted (see [Why aren't all my input values posted?](#why-arent-all-my-input-values-posted)), and the test suite compares what it sends with the browser's own `FormData` on generated forms and with what a server receives from a native submit.

#### What is the easiet way to use jQuery Form Plugin?

The `ajaxForm` method provides the simplest way to enable your HTML form to use AJAX. It's the one-stop-shopping method for preparing forms.

#### What is the difference between `ajaxForm` and `ajaxSubmit`?

There are two main differences between these methods:

1. `ajaxSubmit` submits the form, `ajaxForm` does not. When you invoke `ajaxSubmit` it immediately serializes the form data and sends it to the server. When you invoke `ajaxForm` it adds the necessary event listeners to the form so that it can detect when the form is submitted by the user. When this occurs `ajaxSubmit` is called for you.
2. When using `ajaxForm` the submitted data will include the name and value of the submitting element (or its click coordinates if the submitting element is an image).

#### How can I cancel a form submit?

You can prevent a form from being submitted by adding a 'beforeSubmit' callback function and returning false from that function. See the [validation examples](examples.md#validation).

#### Is there a unit test suite for jQuery Form Plugin?

Yes! jQuery Form Plugin has an extensive set of tests that are used to validate its functionality.  
See [Testing](https://github.com/jquery-form/form/blob/main/CONTRIBUTING.md#testing) in the contributing guide to run them.

#### Does jQuery Form Plugin support file uploads?

Yes!

#### Why aren't all my input values posted?

jQuery Form serialization adheres closely to the HTML spec. Only [successful controls](https://www.w3.org/TR/html5/forms.html#constructing-form-data-set) are valid for submission.

#### How do I display upload progress information?

Pass an [`uploadProgress`](options.md#uploadprogress) callback. It receives the progress event, the bytes sent, the total and the percentage, as the upload proceeds. The iframe transport (`iframe: true`) cannot report progress.
