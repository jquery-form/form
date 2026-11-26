// End-to-end test server: serves the built plugin, jQuery and the fixture page, records every
// request under /r/ (method, url, headers, raw body and the parsed fields) and answers it with a
// named response. No framework: bodies are parsed with the platform's Request#formData().
//
// Environment: E2E_PORT (default 4310), JQUERY_FILE (classic jQuery build, default jQuery 3),
// JQUERY_FORM_DIST (directory holding jquery.form.js, default dist), JQUERY_FORM_PACK_DIR (the
// installed tarball from scripts/pack-fixture.mjs, default .pack).
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

const root = resolve(import.meta.dirname, "../..");
const port = Number(process.env.E2E_PORT || 4310);
const jqueryFile = resolve(root, process.env.JQUERY_FILE || "node_modules/jquery/dist/jquery.js");
const distDir = resolve(root, process.env.JQUERY_FORM_DIST || "dist");
const packageDir = resolve(
  root,
  process.env.JQUERY_FORM_PACK_DIR || ".pack",
  "jquery-3.7.1/node_modules/jquery-form"
);
// jQuery's own module build when it has one (jQuery 4), else a module that exports the global.
const jqueryModule = resolve(dirname(jqueryFile), "../dist-module/jquery.module.js");

const files = {
  "/jquery.js": [jqueryFile, "text/javascript"],
  "/jquery.form.js": [resolve(distDir, "jquery.form.js"), "text/javascript"],
  "/oracle-forms.js": [resolve(root, "test/shared/oracle-forms.js"), "text/javascript"],
  "/harness.js": [resolve(root, "test/e2e/harness.js"), "text/javascript"],
  "/published.js": [resolve(root, "test/e2e/published.js"), "text/javascript"],
  "/require.js": [resolve(root, "node_modules/requirejs/require.js"), "text/javascript"],
  "/jquery.module.js": [jqueryModule, "text/javascript"],
};

const page = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>jquery-form e2e</title>
    <script src="/jquery.js"></script>
    <script src="/jquery.form.js"></script>
    <script type="module" src="/harness.js"></script>
  </head>
  <body>
    <iframe name="native-sink" title="native submissions"></iframe>
    <div id="fixture"></div>
  </body>
</html>
`;

// Published-file pages: /published/<loader>[?min], loading the installed package by the entry
// points its package.json names (main, browser for the minified build, module).
async function publishedPage(loader, min) {
  const manifest = JSON.parse(await readFile(resolve(packageDir, "package.json"), "utf8"));
  const classic = "/pkg/" + (min ? manifest.jsdelivr : manifest.main);
  const hasModule = existsSync(jqueryModule);
  const loaders = {
    script: `<script src="/jquery.js"></script>
    <script src="${classic}"></script>
    <script src="/published.js"></script>
    <script>published.ready("script", jQuery, jQuery);</script>`,
    amd: `<script src="/require.js"></script>
    <script src="/published.js"></script>
    <script>
      require.config({ paths: { jquery: "/jquery", "jquery-form": "${classic.replace(/\.js$/, "")}" } });
      require(["jquery", "jquery-form"], function ($, value) {
        published.ready("amd", $, value);
      });
    </script>`,
    esm: `<script type="importmap">
      { "imports": { "jquery": "${hasModule ? "/jquery.module.js" : "/jquery-global.js"}", "jquery-form": "/pkg/${manifest.module}" } }
    </script>
    ${hasModule ? "" : '<script src="/jquery.js"></script>'}
    <script src="/published.js"></script>
    <script type="module">
      import $ from "jquery";
      import value from "jquery-form";
      published.ready("esm", $, value);
    </script>`,
  };
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>jquery-form published files</title>
    ${loaders[loader]}
  </head>
  <body>
    <div id="fixture"></div>
  </body>
</html>
`;
}

// Named responses: /r/<test id>/<name>[/...].
const responses = {
  ok: [200, "text/plain; charset=utf-8", "ok"],
  json: [200, "application/json; charset=utf-8", '{"ok":true,"text":"ü"}'],
  xml: [200, "application/xml; charset=utf-8", '<?xml version="1.0"?><root><item>ü</item></root>'],
  html: [200, "text/html; charset=utf-8", '<p id="answer">ü</p>'],
  script: [
    200,
    "text/javascript; charset=utf-8",
    "window.e2eScriptRuns = (window.e2eScriptRuns || 0) + 1;",
  ],
  text: [200, "text/plain; charset=utf-8", "plain ü"],
  "textarea-json": [200, "text/html; charset=utf-8", '<textarea>{"ok":true,"text":"ü"}</textarea>'],
  "status-404": [404, "text/plain; charset=utf-8", "missing"],
  "status-500": [500, "text/plain; charset=utf-8", "broken"],
};

// Recorded requests by test id.
const recorded = new Map();

async function parseFields(method, url, headers, body) {
  const type = headers["content-type"] || "";
  if (!/^(multipart\/form-data|application\/x-www-form-urlencoded)/i.test(type)) {
    return null;
  }
  const request = new Request(url, { method, headers: { "content-type": type }, body });
  const fields = [];
  for (const [name, value] of await request.formData()) {
    if (typeof value === "string") {
      fields.push({ name, kind: "text", value });
    } else {
      const bytes = Buffer.from(await value.arrayBuffer());
      fields.push({
        name,
        kind: "file",
        value: value.name,
        type: value.type,
        base64: bytes.toString("base64"),
      });
    }
  }
  return fields;
}

async function record(req, url, body) {
  const [, id, name] = url.pathname.split("/").slice(1);
  const entry = {
    method: req.method,
    url: url.pathname + url.search,
    headers: req.headers,
    base64: body.toString("base64"),
    query: Array.from(url.searchParams, ([n, value]) => ({ name: n, kind: "text", value })),
    fields: body.length ? await parseFields(req.method, url, req.headers, body) : null,
  };
  if (!recorded.has(id)) {
    recorded.set(id, []);
  }
  recorded.get(id).push(entry);
  return responses[name] || responses.ok;
}

function send(res, status, type, body) {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);

    if (url.pathname.startsWith("/r/")) {
      const [status, type, text] = await record(req, url, body);
      return send(res, status, type, text);
    }
    if (url.pathname === "/requests") {
      return send(
        res,
        200,
        "application/json",
        JSON.stringify(recorded.get(url.searchParams.get("id")) || [])
      );
    }
    if (url.pathname === "/" || url.pathname === "/page") {
      return send(res, 200, "text/html; charset=utf-8", page);
    }
    if (url.pathname.startsWith("/published/")) {
      const html = await publishedPage(url.pathname.slice(11), url.searchParams.has("min"));
      return send(res, 200, "text/html; charset=utf-8", html);
    }
    if (url.pathname === "/jquery-global.js") {
      return send(res, 200, "text/javascript", "export default window.jQuery;\n");
    }
    if (url.pathname.startsWith("/pkg/")) {
      const file = resolve(packageDir, url.pathname.slice(5));
      if (file.startsWith(packageDir + "/") && existsSync(file)) {
        return send(res, 200, "text/javascript", await readFile(file));
      }
    }
    if (files[url.pathname]) {
      const [file, type] = files[url.pathname];
      return send(res, 200, type, await readFile(file));
    }
    return send(res, 404, "text/plain", "not found");
  } catch (error) {
    return send(res, 500, "text/plain", String(error && error.stack));
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`e2e server on http://127.0.0.1:${port}`);
});
