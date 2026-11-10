# jQuery Form

Domain language for the jquery-form/form library and how it is released.

## Language

**main**:
The single long-lived integration branch; all active development targets it.
_Avoid_: master, develop, next (as standing integration branches), trunk (as a branch name)

**v4 line**:
The 4.x compatibility release line (legacy jQuery and shim support retained). After 5.0 ships, patches still belong to this line.
_Avoid_: old major, legacy branch (when meaning the release line rather than a git ref)

**form member**:
A property or method of a `<form>` element (such as `elements`, `ownerDocument`, `getAttribute`, `submit`, `reset`) as the DOM defines it, read or called through the DOM prototypes so that a control with the same name cannot shadow it.
_Avoid_: form property (a control named like it replaces `form.name`), form attribute (the HTML attribute is separate)
