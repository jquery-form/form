# Phase 5 coverage findings

## Delegated `ajaxForm` handlers are not selector-scoped

- Test: `ajaxForm should scope delegated handlers to the selected forms`
- Finding: jQuery 3.7 removed the collection's `.selector` metadata. With
  `{ delegation: true }`, `ajaxForm` passes `undefined` as the delegated selector, so submitting an
  unrelated form also invokes the plugin handler.
- Test treatment: `it.fails` records the intended behavior. Vitest executes the test and expects its
  assertion to fail, so the exercised source lines still count toward coverage.
- Suggested fix: accept or retain an explicit selector for delegated binding instead of reading
  `this.selector`; redesign this path as part of the planned 5.0 removal of obsolete jQuery metadata.

## Resetting a label with a matching `for` target throws

- Test: `resetForm should reset the control a label targets and its nested fields`
- Finding: the label branch calls `list.unshift(forEl[0])`, but jQuery collections have no `unshift`,
  so any label whose `for` target is found throws a `TypeError`. The target is also looked up with
  `$(el.attr("for"))`, which treats the attribute as a selector: a normal `for="id"` matches nothing,
  so only a `#`-prefixed value reaches the crash.
- Test treatment: `it.fails` (using `for="#label-target"` so the crashing line runs); its exercised
  source lines still count toward coverage.
- Suggested fix: look the target up by id (`document.getElementById`) and combine with
  `list.add(target)` instead of `unshift`.

## Iframe script responses are not evaluated

- Test: `iframe transport should evaluate script from a pre response`
- Finding: the iframe mock reports `content-type: script`, but `httpData` only evaluates strings when
  the content type contains `javascript`, so a requested script response is returned without running.
- Test treatment: `it.fails`; its exercised source lines still count toward coverage.
- Suggested fix: make explicit `dataType: "script"` authoritative, matching jQuery AJAX behavior.

## Iframe parser errors can be overwritten by an HTTP success status

- Test: `iframe transport should report malformed JSON as a parser error`
- Finding: malformed JSON sets `status` to `parsererror`, then the emulated HTTP status block rewrites
  it to `success` for a 2xx response.
- Test treatment: `it.fails`; its exercised source lines still count toward coverage.
- Suggested fix: only derive success/error from `xhr.status` when response parsing has not failed.

## Aborting an iframe upload leaves its Deferred pending

- Test: `iframe transport should reject the returned deferred when aborted`
- Finding: `abort()` invokes error and complete callbacks but never rejects the Deferred returned as
  the stored jqXHR.
- Test treatment: `it.fails`; its exercised source lines still count toward coverage.
- Suggested fix: reject the Deferred exactly once from the abort path with the same arguments used by
  the timeout and server-abort paths.
