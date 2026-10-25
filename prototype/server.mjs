import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const port = Number(process.env.PORT || 4173);
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".xml": "text/xml",
  ".txt": "text/plain",
};

const harness = async () => {
  const html = await readFile(join(root, "test/test.html"), "utf8");
  return html
    .replace(/<script src="https:\/\/code\.jquery\.com[^>]*><\/script>/, '<script src="/prototype/node_modules/jquery/dist/jquery.js"></script>')
    .replace(/\.\.\/node_modules\//g, "/prototype/node_modules/")
    .replace('<script src="test.js"></script>', '<script src="test.js"></script>\n\t<script src="/prototype/shared/iframe-upload.js"></script>')
    .replace(/mocha\.run\(\);/, "window.__mochaRunner = mocha.run();");
};

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
  try {
    if (path === "/test/harness.html") {
      res.writeHead(200, { "content-type": "text/html" });
      return res.end(await harness());
    }
    const body = await readFile(join(root, path));
    res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
}).listen(port, () => console.log(`serving ${root} on http://localhost:${port}`));
