# `.selector` and `.context` in `ajaxForm` (Phase 6 investigation)

jQuery removed the `.selector` and `.context` properties of collections in 3.0. `ajaxForm` still reads both. Checked with a probe against each jQuery build (`$sel = $("form.pd"); $sel.ajaxForm({ delegation: true })`, then submitting `form.pd` and `form.other`):

| jQuery | `$sel.selector` | Forms that reached `ajaxSubmit`                  |
| ------ | --------------- | ------------------------------------------------ |
| 1.7.2  | `"form.pd"`     | `form.pd` only (`form.other` submitted natively) |
| 3.7.1  | `undefined`     | `form.pd` and `form.other`                       |
| 4.0.0  | `undefined`     | `form.pd` and `form.other`                       |

## Delegation (`src/jquery.form.js`, `ajaxForm`)

`$(document).on("submit.form-plugin", this.selector, options, doAjaxSubmit)` receives `undefined` as the selector, so the handler binds directly to `document` and **every form on the page is hijacked**, not only the selected ones. The README example (`$('form').ajaxForm({ delegation: true })`) hides this because that selector matches every form anyway. Any narrower selector, for example `$('form.ajax')`, over-matches on jQuery 3 and later.

`docs/research/coverage-findings.md` said jQuery 3.7 removed the metadata; it was 3.0. The recorded `it.fails` test is unchanged and still fails on 3.7.1 and 4.0.0. On 1.7.2 it also fails, but only because the test builds its forms with `$("<form>")`, whose selector is empty.

## DOM-not-ready queue

`ajaxForm` on an empty selection before the DOM is ready re-runs itself with `$(o.s, o.c)` once ready. With `o.s` always `undefined` on jQuery 3 and later, the branch never runs and the call is dropped with a log line ("terminating; zero elements found by selector"). Calling `$(".x").ajaxForm()` in a script that runs before the elements exist therefore does nothing, silently. Calling it inside `$(function () { ... })` is unaffected. Two tests cover both sides (`before the DOM is ready`).

## Decision (4.x)

Document only; no code change in Phase 6.

- Nothing in 4.x can recover the selector on jQuery 3 and later; any fix is a new option or a changed default, which is an API decision.
- Candidates for later: an explicit selector option for delegation (falling back to `this.selector` on old jQuery), or removing the `.selector` and `.context` paths when 5.0 drops jQuery < 3. The queue branch goes with 5.0.
- Until then, README and `docs/options.md` should tell users that `delegation: true` is not scoped on jQuery 3 and later.
