# Contributing to jQuery Form

Want to contribute to jQuery Form? That's great! Contributions are most welcome!
Here are a couple of guidelines that will help you contribute. Before we get started: Please note that this project is released with a [Contributor Code of Conduct](CODE_OF_CONDUCT.md) to ensure that this project is a welcoming place for **everyone** to contribute to. By participating in this project you agree to abide by its terms.

## Overview

* [Contribution workflow](#contribution-workflow)
* [Branching and releases](#branching-and-releases)
* [Testing](#testing)
* [Reporting a bug](#reporting-a-bug)
* [Contributing to an existing issue](#contributing-to-an-existing-issue)
* [Feature Requests](#feature-requests)
* [Additional info](#additional-info)

## Contribution workflow

1. Fork the repository in GitHub with the `Fork` button.
2. Branch from **`main`** into a short-lived topic branch (e.g. `new-feature`):

   ```shell
   git checkout -b new-feature
   ```

3. Make your feature addition or bug fix.
4. After setting up your [testing environment](#testing), run the tests:

   ```shell
   npm test
   ```

   If the tests all pass, move on to step 5.

5. Open a pull request **against `main`**. Topic branches only—do not PR into long-lived integration branches that no longer exist (`develop`, etc.).
   * Please make sure all of your commits are atomic (one feature per commit).
   * Use sensible commit messages.
     * Always write a clear log message for your commits. One-line messages are fine for small changes, but bigger changes should look like this:

       ```shell
       git commit -m "A brief summary of the commit" -m "A paragraph describing what changed and its impact."
       ```

   * If your PR fixes a separate issue number, include it in the commit message.

### Things to keep in mind

* Smaller PRs are likely to be merged more quickly than bigger changes.
* Every merge needs maintainer review.
* This project is using [Semantic Versioning 2.0.0](https://semver.org/)

## Branching and releases

Full rationale: [ADR-0002](docs/adr/0002-branching-and-release.md).

* **`main`** is the only trunk. Work in short-lived branches; open PRs into `main`.
* **4.x then 5.0** are sequential on `main` (no standing `next` branch). After 5.0, rare 4.x patches use an on-demand `release/4.x` branch cut from the last v4 tag.
* **npm:** `latest` tracks the current major; after 5.0, 4.x publishes use the `v4` dist-tag.
* **Releases:** maintainers bump the version, tag `vX.Y.Z`, and publish to npm manually. CI verifies; it does not publish.

## Testing

jQuery Form uses [Node.js](https://nodejs.org/), [Rollup](https://rollupjs.org/), [ESLint](https://eslint.org/), [Prettier](https://prettier.io/), and [Vitest](https://vitest.dev/) browser mode to build and validate the source. Here is how to set that up:

1. Install the [Node.js](https://nodejs.org/) version in `.nvmrc` (with nvm: `nvm use`).
2. Install dependencies and the test browser:

   ```shell
   npm ci
   npx playwright install chromium
   ```

3. Run lint, the build, and the tests:

   ```shell
   npm test
   ```

Edit `src/jquery.form.js` (an ES module), never `dist/`. `npm test` rebuilds `dist/`; commit the rebuilt files with your change, since CI fails if they differ from the build.

### End-to-end tests

`npm run test:e2e` runs [Playwright Test](https://playwright.dev/) against the built `dist/jquery.form.js` (run `npm run build` first) on Chromium and WebKit. A small Node server (`test/e2e/server.mjs`) serves the fixture page and records every request the plugin sends, through each transport (urlencoded and FormData XHR, the iframe upload). Each test submits the same form natively and through the plugin, and the two requests must match after parsing, apart from the known differences listed in `test/shared/oracle-forms.js` and `test/e2e/harness.js`. `npm test` does not run them.

It first tests the package as npm would publish it: `scripts/pack-fixture.mjs` runs `npm pack` and installs the tarball into fixture projects under `.pack/` (one per jQuery version, installed from the registry or npm's cache). `test/e2e/published-node.test.mjs` (`node --test`) loads it by name from CommonJS and ES modules in Node, with jsdom as the window, and `test/e2e/published.spec.mjs` loads it in the browser by script tag (plain and minified), RequireJS and an import map, then posts a form over XHR and uploads a file through the iframe. Set `JQUERY_FORM_TARBALL` to test a tarball you packed elsewhere.

Set `JQUERY_FILE` to test another jQuery build, as for the suite. `npm run test:e2e:docker` runs them in Docker on all three browsers, including Firefox.

### Running tests in Docker

Playwright's Firefox build does not start on some macOS versions, and `npm test` covers only Chromium and WebKit. To run the suite on Firefox (or on all three browsers under Linux), use Docker. The scripts use the Playwright image that matches the `playwright` version in `package.json` and leave your local `node_modules` untouched:

```shell
npm run test:firefox   # the suite on Firefox
npm run test:docker    # the suite on Chromium, WebKit and Firefox
```

`scripts/test-docker.sh` passes any arguments on to `vitest run` (or to `playwright test` after `--e2e`). To test another jQuery build, set `JQUERY_FILE`, e.g. `JQUERY_FILE=.jquery/jquery-1.7.2.js npm run test:firefox` (fetch it first with `scripts/fetch-jquery.sh 1.7.2`).

Node and `node_modules` are cached in Docker volumes (`jquery-form-node`, and `jquery-form-node-modules-<hash>` for each `package-lock.json`). To clear them:

```shell
docker volume rm jquery-form-node $(docker volume ls -q --filter name=jquery-form-node-modules-)
```

### Git blame

Repo-wide formatting commits are listed in [`.git-blame-ignore-revs`](.git-blame-ignore-revs). To skip them in `git blame`:

```shell
git config blame.ignoreRevsFile .git-blame-ignore-revs
```

## Reporting a bug

So you've found a bug, and want to help us fix it? Before filing a bug report, please double-check the bug hasn't already been reported. You can do so [on our issue tracker](https://github.com/jquery-form/form/issues?q=is%3Aopen+is%3Aissue). If something hasn't been raised, you can go ahead and create a new issue with the following information:

* Which version of the plugin are you using?
* Which version of the jQuery library are you using?
* What browsers (and versions) have you tested in?
* How can the error be reproduced?
* If possible, include a link to a [JSFiddle](https://jsfiddle.net/) or [CodePen](https://codepen.io/) example of the error.

If you want to be really thorough, there is a great overview on Stack Overflow of [what you should consider when reporting a bug](https://stackoverflow.com/questions/240323/how-to-report-bugs-the-smart-way).

It goes without saying that you're welcome to help investigate further and/or find a fix for the bug. If you want to do so, just mention it in your bug report and offer your help!

## Contributing to an existing issue

### Finding an issue to work on

We've got a few open issues and are always glad to get help on that front. You can view the list of issues [here](https://github.com/jquery-form/form/issues). (Here's [a good article](https://medium.freecodecamp.com/finding-your-first-open-source-project-or-bug-to-work-on-1712f651e5ba) on how to find your first bug to fix).

Before getting to work, take a look at the issue and at the conversation around it. Has someone already offered to work on the issue? Has someone been assigned to the issue? If so, you might want to check with them to see whether they're still actively working on it.

If the issue is a few months old, it might be a good idea to write a short comment to double-check that the issue or feature is still a valid one to jump on.

Feel free to ask for more detail on what is expected: are there any more details or specifications you need to know?
And if at any point you get stuck: don't hesitate to ask for help.

### Making your contribution

We've outlined the contribution workflow [here](#contribution-workflow). If you're a first-timer, don't worry! GitHub has a ton of guides to help you through your first pull request: You can find out more about pull requests [here](https://help.github.com/articles/about-pull-requests/) and about creating a pull request [here](https://help.github.com/articles/creating-a-pull-request/).

## Feature Requests

* You can _request_ a new feature by [submitting an issue](https://github.com/jquery-form/form/issues).
* If you would like to _implement_ a new feature:
  * For a **Major Feature**, first open an issue and outline your proposal so that it can be discussed. This will also allow us to better coordinate our efforts, prevent duplication of work, and help you to craft the change so that it is successfully accepted into the project.
  * **Small Features** can be crafted and directly [submitted as a Pull Request](#contribution-workflow).

## Additional info

Especially if you're a newcomer to Open Source and you've found some little bumps along the way while contributing, we recommend you write about them. [Here](https://medium.freecodecamp.com/new-contributors-to-open-source-please-blog-more-920af14cffd)'s a great article about why writing about your experience is important; this will encourage other beginners to try their luck at Open Source, too!
