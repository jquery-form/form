import { afterEach, assert, describe, it } from "vitest";

// Serialization oracle: random forms from fixed seeds, serialized by the plugin and by the
// browser's own FormData. Every difference must match a named class in KNOWN_DIFFERENCES.

const SEEDS = [
  1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765, 10946, 17711,
  28657, 46368, 75025, 121393, 196418, 317811, 514229, 832040, 1346269, 2178309, 3524578, 5702887,
  9227465, 14930352, 24157817, 39088169, 63245986, 102334155, 165580141, 7, 11, 17, 19, 23, 29, 31,
  37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 97, 101, 103,
];

// mulberry32: a small seeded generator, so a failing seed replays the same form.
function prng(seed) {
  let state = seed >>> 0;

  const next = function () {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    chance: (p) => next() < p,
    int: (n) => Math.floor(next() * n),
    pick: (list) => list[Math.floor(next() * list.length)],
  };
}

const NAMES = ["a", "b", "c", "a b", "ü", "名前", "a[]", "a.b", "x=y", "&", "😀"];
// Lone surrogates: rare, since formSerialize cannot encode them (class USV-THROW).
const LONE = ["q\uD800", "lone\uDC00"];
const VALUES = [
  "",
  "1",
  "value",
  "  spaced  out ",
  "a&b=c",
  "100%",
  "1+1",
  "é",
  "日本語",
  "😀",
  "!'()*~",
  "#ff0000",
  "2024-02-29",
  "42",
  "x@example.com",
];
const LINE_VALUES = ["one\rtwo", "one\ntwo", "one\r\ntwo", "\r\n\n\r"];
const TEXT_TYPES = [
  "text",
  "hidden",
  "password",
  "search",
  "email",
  "number",
  "range",
  "date",
  "color",
];
const FILE_NAMES = ["a.txt", "b c.txt", "ü.txt", "日本.txt"];

// Builds one random form (and its outside controls) inside `container`.
function generateForm(seed, container) {
  const rand = prng(seed);
  const formId = "oracle-" + seed;
  const counters = { file: 0, dir: 0, out: 0 };
  const outsideNames = [];
  const form = document.createElement("form");
  form.id = formId;
  const other = document.createElement("form");
  other.id = formId + "-other";

  // Outside controls get their own names (out-N), so the semantic order class can find them.
  function name(outside) {
    if (outside) {
      const outsideName = "out-" + counters.out++;
      outsideNames.push(outsideName);
      return outsideName;
    }
    return rand.chance(0.02) ? rand.pick(LONE) : rand.pick(NAMES);
  }

  function value() {
    return rand.chance(0.02) ? rand.pick(LONE) : rand.pick(VALUES);
  }

  function input(type, outside) {
    const el = document.createElement("input");
    el.type = type;
    if (rand.chance(0.85)) {
      el.name = name(outside);
    }
    return el;
  }

  const makers = [
    function (outside) {
      const el = input(rand.pick(TEXT_TYPES), outside);
      if (rand.chance(0.8)) {
        el.setAttribute("value", value());
      }
      if (el.type === "hidden" && rand.chance(0.3)) {
        el.value = rand.pick(LINE_VALUES);
      }
      if ((el.type === "text" || el.type === "search") && rand.chance(0.2)) {
        el.setAttribute("dirname", "dir-" + counters.dir++);
      }
      return el;
    },
    function (outside) {
      const el = input(rand.pick(["checkbox", "radio"]), outside);
      if (rand.chance(0.6)) {
        el.setAttribute("value", value());
      }
      el.checked = rand.chance(0.6);
      return el;
    },
    function (outside) {
      const el = document.createElement("select");
      el.name = name(outside);
      el.multiple = rand.chance(0.4);
      let parent = el;
      const count = rand.int(5);
      for (let i = 0; i < count; i++) {
        if (rand.chance(0.2)) {
          parent = document.createElement("optgroup");
          parent.label = "g" + i;
          parent.disabled = rand.chance(0.5);
          el.appendChild(parent);
        }
        const option = document.createElement("option");
        option.text = rand.pick(["  one ", "two", "日本", ""]);
        if (rand.chance(0.6)) {
          option.value = value();
        }
        option.disabled = rand.chance(0.2);
        parent.appendChild(option);
        option.selected = rand.chance(0.4);
      }
      if (rand.chance(0.2)) {
        el.selectedIndex = -1;
      }
      return el;
    },
    function (outside) {
      const el = document.createElement("textarea");
      el.name = name(outside);
      el.value = rand.pick(LINE_VALUES.concat(VALUES));
      if (rand.chance(0.2)) {
        el.setAttribute("dirname", "dir-" + counters.dir++);
      }
      return el;
    },
    function (outside) {
      const el = document.createElement("input");
      el.type = "file";
      el.name = "file-" + counters.file++;
      if (outside) {
        outsideNames.push(el.name);
      }
      const count = rand.int(3);
      if (count) {
        el.multiple = count > 1;
        const transfer = new DataTransfer();
        for (let i = 0; i < count; i++) {
          transfer.items.add(new File(["x"], rand.pick(FILE_NAMES), { type: "text/plain" }));
        }
        el.files = transfer.files;
      }
      return el;
    },
    function (outside) {
      const kind = rand.pick(["submit", "image", "button", "reset", "button-element"]);
      let el;
      if (kind === "button-element") {
        el = document.createElement("button");
        el.type = rand.pick(["submit", "button", "reset", ""]);
        if (rand.chance(0.9)) {
          el.name = name(outside);
        }
      } else {
        el = input(kind, outside);
      }
      if (rand.chance(0.7)) {
        el.setAttribute("value", value());
      }
      return el;
    },
    function (outside) {
      const el = input("hidden", outside);
      if (!outside) {
        el.name = "_charset_";
      }
      el.setAttribute("value", value());
      return el;
    },
    function (outside) {
      const el = document.createElement(rand.pick(["output", "fieldset"]));
      el.setAttribute("name", name(outside));
      el.textContent = "x";
      return el;
    },
  ];

  function control(outside) {
    const el = rand.pick(makers)(outside);
    el.disabled = el.disabled || rand.chance(0.1);
    return el;
  }

  // Fills a parent with controls, sometimes nested in a fieldset with a first legend.
  function fill(parent, depth) {
    const count = 1 + rand.int(6);
    for (let i = 0; i < count; i++) {
      if (depth < 2 && rand.chance(0.15)) {
        const fieldset = document.createElement("fieldset");
        fieldset.disabled = rand.chance(0.5);
        if (rand.chance(0.6)) {
          const legend = document.createElement("legend");
          legend.appendChild(control(false));
          fieldset.appendChild(legend);
        }
        fill(fieldset, depth + 1);
        parent.appendChild(fieldset);
        continue;
      }
      const el = control(false);
      if (rand.chance(0.08)) {
        el.setAttribute("form", rand.pick([other.id, "oracle-nowhere", formId]));
      }
      parent.appendChild(el);
    }
  }

  fill(form, 0);
  if (rand.chance(0.5)) {
    form.appendChild(makers[5](false));
  }

  const before = rand.int(3);
  const after = rand.int(3);
  for (let i = 0; i < before; i++) {
    const el = control(true);
    el.setAttribute("form", formId);
    container.appendChild(el);
  }
  container.appendChild(form);
  container.appendChild(other);
  for (let i = 0; i < after; i++) {
    const el = control(true);
    el.setAttribute("form", formId);
    container.appendChild(el);
  }

  // The submitter: one of the form's submit buttons, when it has any.
  const submitters = Array.prototype.filter.call(
    document.querySelectorAll("input, button"),
    (el) => el.form === form && (el.type === "submit" || el.type === "image")
  );
  const submitter = submitters.length && rand.chance(0.85) ? rand.pick(submitters) : null;

  return { form: form, submitter: submitter, outsideNames: outsideNames };
}

// [name, kind, value]: kind "file" holds the file name, kind "text" a string.
function pluginEntries(fields) {
  return fields.map(function (field) {
    if (field.value instanceof File) {
      return [field.name, "file", field.value.name];
    }
    if (field.type === "file") {
      return [field.name, "file", ""];
    }
    return [field.name, "text", String(field.value)];
  });
}

function nativeEntries(formData) {
  return Array.from(formData.entries()).map(function (entry) {
    return entry[1] instanceof File
      ? [entry[0], "file", entry[1].name]
      : [entry[0], "text", entry[1]];
  });
}

function toWellFormed(text) {
  return text.replace(
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
    function (match, lead) {
      return typeof lead === "string" ? lead + "\uFFFD" : "\uFFFD";
    }
  );
}

function isImage(el) {
  return !!el && el.tagName === "INPUT" && el.type === "image";
}

// Known differences between the plugin and FormData. Each has an ID; `normalize` maps
// { plugin, native } entry lists to lists where that class no longer differs.
const KNOWN_DIFFERENCES = [
  {
    id: "USV",
    description: "FormData replaces lone surrogates in names and values with U+FFFD",
    normalize: (pair) => ({
      plugin: pair.plugin.map((e) => [toWellFormed(e[0]), e[1], toWellFormed(e[2])]),
      native: pair.native,
    }),
  },
  {
    id: "CRLF",
    description: "the plugin sends line breaks as CRLF; FormData keeps them as the value has them",
    normalize: (pair) => {
      const lines = (e) => [e[0], e[1], e[1] === "text" ? e[2].replace(/\r\n|\r|\n/g, "\n") : e[2]];
      return { plugin: pair.plugin.map(lines), native: pair.native.map(lines) };
    },
  },
  {
    id: "CHARSET",
    description: "FormData sends a hidden _charset_ control's value as the document encoding",
    normalize: (pair) => ({
      plugin: pair.plugin.map((e) => (e[0] === "_charset_" ? [e[0], e[1], "UTF-8"] : e)),
      native: pair.native,
    }),
  },
  {
    id: "DIRNAME",
    description: "FormData adds a dirname field for text inputs and textareas; the plugin does not",
    normalize: (pair) => ({
      plugin: pair.plugin,
      native: pair.native.filter((e) => !/^dir-\d+$/.test(e[0])),
    }),
  },
  {
    id: "SUBMIT-LABEL",
    description:
      'FormData sends the default label of an input submitter without a value; the plugin sends ""',
    normalize: (pair, ctx) => {
      const sub = ctx.submitter;
      if (!sub || sub.tagName !== "INPUT" || sub.type !== "submit" || sub.hasAttribute("value")) {
        return pair;
      }
      return {
        plugin: pair.plugin,
        native: pair.native.map((e) =>
          e[0] === sub.name && /^Submit( Query)?$/.test(e[2]) ? [e[0], e[1], ""] : e
        ),
      };
    },
  },
  {
    id: "IMG-VALUE",
    description: "the plugin sends a clicked image button's name=value before its coordinates",
    normalize: (pair, ctx) => {
      if (!isImage(ctx.submitter) || !ctx.submitter.name) {
        return pair;
      }
      const n = ctx.submitter.name;
      return {
        plugin: pair.plugin.filter(
          (e, i) => !(e[0] === n && pair.plugin[i + 1] && pair.plugin[i + 1][0] === n + ".x")
        ),
        native: pair.native,
      };
    },
  },
  {
    id: "IMG-UNNAMED",
    description: "FormData sends x and y for an unnamed image submitter; the plugin sends nothing",
    normalize: (pair, ctx) => {
      if (!isImage(ctx.submitter) || ctx.submitter.name || ctx.submitter.disabled) {
        return pair;
      }
      return {
        plugin: pair.plugin,
        native: pair.native.filter((e) => e[0] !== "x" && e[0] !== "y"),
      };
    },
  },
  {
    id: "IMG-ORDER",
    description: "without semantic, the plugin appends the clicked image's fields last",
    normalize: (pair, ctx) => {
      if (ctx.semantic || !isImage(ctx.submitter) || !ctx.submitter.name) {
        return pair;
      }
      const n = ctx.submitter.name;
      const last = (list) => {
        const coords = list.filter((e) => e[0] === n + ".x" || e[0] === n + ".y");
        return list.filter((e) => coords.indexOf(e) < 0).concat(coords);
      };
      return { plugin: last(pair.plugin), native: last(pair.native) };
    },
  },
  {
    id: "SEM-ORDER",
    description: "with semantic, the plugin sends outside controls (form=id) after the form's own",
    normalize: (pair, ctx) => {
      if (!ctx.semantic) {
        return pair;
      }
      const outsideLast = (list) => {
        const outside = list.filter(
          (e) => ctx.outsideNames.indexOf(e[0].replace(/\.[xy]$/, "")) >= 0
        );
        return list.filter((e) => outside.indexOf(e) < 0).concat(outside);
      };
      return { plugin: pair.plugin, native: outsideLast(pair.native) };
    },
  },
];

// Known exceptions: the plugin throws where FormData serializes. Each has an ID and a matcher.
const KNOWN_THROWS = [
  {
    id: "USV-THROW",
    description: "formSerialize throws URIError on a lone surrogate (jQuery.param encodes it)",
    matches: (error, ctx) =>
      error instanceof URIError &&
      pluginEntries($(ctx.form).formToArray()).some(
        (e) => toWellFormed(e[0] + e[2]) !== e[0] + e[2]
      ),
  },
];

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

function formatEntries(list) {
  return list.map((e) => JSON.stringify(e)).join("\n  ");
}

// Applies every known class; fails with the seed and both lists when a difference remains.
function assertSameEntries(plugin, native, ctx) {
  let pair = { plugin: plugin, native: native };
  KNOWN_DIFFERENCES.forEach(function (known) {
    pair = known.normalize(pair, ctx);
  });

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

function canonicalQuery(query) {
  if (!query) {
    return [];
  }
  return query.split("&").map(function (pair) {
    const parts = pair.split("=");
    const decode = (part) => decodeURIComponent((part || "").replace(/\+/g, " "));
    return [decode(parts[0]), "text", decode(parts.slice(1).join("="))];
  });
}

let submitterArgumentSupported = null;

// FormData(form, submitter) arrived after FormData(form); older engines ignore the argument.
function supportsSubmitterArgument() {
  if (submitterArgumentSupported === null) {
    const form = document.createElement("form");
    const button = document.createElement("button");
    button.name = "probe";
    form.appendChild(button);
    try {
      submitterArgumentSupported = new FormData(form, button).has("probe");
    } catch {
      submitterArgumentSupported = false;
    }
  }
  return submitterArgumentSupported;
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
