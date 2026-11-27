# Security policy

## Supported versions

| Version                   | Supported   |
| ------------------------- | ----------- |
| 5.x (latest release)      | Yes         |
| 4.x (latest release)      | Best effort |
| 3.x and earlier           | No          |

Fixes land on `main` and ship in the next 5.x release. A fix for 4.x, when one is made, ships in
a 4.x release from the `release/4.x` branch, on the `v4` npm dist-tag. There is no set period for
4.x fixes, so plan to move to 5.x. Pre-releases, such as `5.0.0-beta.1`, are not supported once a
later release replaces them.

## Reporting a vulnerability

Please do not report security issues in public issues, pull requests or discussions.

Report them privately through GitHub: open the repository's **Security** tab and choose
**Report a vulnerability** (<https://github.com/jquery-form/form/security/advisories/new>).

Include the plugin and jQuery versions, the options used, and a minimal reproduction. Reporters
are credited in the advisory unless they ask not to be.
