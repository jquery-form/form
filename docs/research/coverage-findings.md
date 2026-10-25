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
