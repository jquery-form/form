import { afterEach, assert, describe, it } from "vitest";
import {
  SEEDS,
  applyKnownDifferences,
  canonicalQuery,
  formatEntries,
  generateForm,
  isImage,
  nativeEntries,
  pluginEntries,
  supportsSubmitterArgument,
} from "../shared/oracle-forms.js";

// Serialization oracle: random forms from fixed seeds, serialized by the plugin and by the
// browser's own FormData. Every difference must match a named class in KNOWN_DIFFERENCES
// (test/shared/oracle-forms.js).

// Known exceptions: the plugin throws where FormData serializes. Each has an ID and a matcher.
const KNOWN_THROWS = [];

// Runs the plugin; an exception passes only when a known class matches it (null then).
function attempt(act, ctx) {
  try {
    return act();
  } catch (error) {
    const known = KNOWN_THROWS.filter((k) => k.matches(error, ctx));
    assert.ok(known.length, "seed " + ctx.seed + " (" + ctx.comparison + "), unlisted " + error);
    return null;
  }
}

// Applies every known class; fails with the seed and both lists when a difference remains.
function assertSameEntries(plugin, native, ctx) {
  const pair = applyKnownDifferences(plugin, native, ctx);

  assert.deepEqual(
    pair.plugin,
    pair.native,
    "seed " +
      ctx.seed +
      " (" +
      ctx.comparison +
      "), unlisted difference\nform: " +
      ctx.html +
      "\nplugin:\n  " +
      formatEntries(plugin) +
      "\nnative:\n  " +
      formatEntries(native)
  );
}

describe("serialization oracle", function () {
  let container;

  function arrange(seed) {
    container = document.createElement("div");
    document.body.appendChild(container);
    const generated = generateForm(seed, container);
    return Object.assign(generated, { seed: seed, html: container.innerHTML });
  }

  function setSubmitter(form, submitter) {
    form.clk = submitter;
    form.clk_x = isImage(submitter) ? 0 : undefined;
    form.clk_y = isImage(submitter) ? 0 : undefined;
  }

  afterEach(function () {
    container.remove();
  });

  SEEDS.forEach(function (seed) {
    describe("when the form of seed " + seed + " is serialized", function () {
      it("formToArray should send what FormData collects", function () {
        const g = arrange(seed);

        const plugin = pluginEntries($(g.form).formToArray());
        const native = nativeEntries(new FormData(g.form));

        assertSameEntries(
          plugin,
          native,
          Object.assign(g, { submitter: null, comparison: "formToArray" })
        );
      });

      it("formSerialize should send what URLSearchParams builds from FormData, files aside", function () {
        const g = arrange(seed);
        const isFileField = (e) => /^file-\d+$/.test(e[0]);

        const ctx = Object.assign(g, { submitter: null, comparison: "formSerialize" });

        const query = attempt(() => $(g.form).formSerialize(), ctx);
        if (query === null) {
          return;
        }
        const plugin = canonicalQuery(query).filter((e) => !isFileField(e));
        const native = nativeEntries(new FormData(g.form)).filter((e) => !isFileField(e));
        const reference = canonicalQuery(
          new URLSearchParams(native.map((e) => [e[0], e[2]])).toString()
        );

        assertSameEntries(plugin, reference, ctx);
      });

      it("formToArray with a submitter should send what FormData collects with it", function (ctx) {
        const g = arrange(seed);
        if (!g.submitter || !supportsSubmitterArgument()) {
          ctx.skip();
        }
        setSubmitter(g.form, g.submitter);

        const plugin = pluginEntries($(g.form).formToArray());
        const native = nativeEntries(new FormData(g.form, g.submitter));

        assertSameEntries(
          plugin,
          native,
          Object.assign(g, { comparison: "formToArray, submitter" })
        );
      });

      it("formToArray with semantic should send what FormData collects with the submitter", function () {
        const g = arrange(seed);
        const submitter = supportsSubmitterArgument() ? g.submitter : null;
        setSubmitter(g.form, submitter);

        const plugin = pluginEntries($(g.form).formToArray(true));
        const native = nativeEntries(
          submitter ? new FormData(g.form, submitter) : new FormData(g.form)
        );

        assertSameEntries(
          plugin,
          native,
          Object.assign(g, { submitter: submitter, semantic: true, comparison: "semantic" })
        );
      });
    });
  });
});
