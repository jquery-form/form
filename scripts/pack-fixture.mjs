// Packs the package as npm would publish it and installs the tarball into fixture projects, one
// per jQuery version, so the published-file tests load it by its package name.
// Usage: [JQUERY_FORM_TARBALL=path.tgz] node scripts/pack-fixture.mjs
// Without a tarball it runs `npm pack` on the current checkout (build dist first). Fixtures go to
// JQUERY_FORM_PACK_DIR (default .pack): <dir>/jquery-<version>/node_modules/jquery-form.
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const packDir = resolve(root, process.env.JQUERY_FORM_PACK_DIR || ".pack");
const jqueryVersions = ["3.7.1", "4.0.0"];

function npm(args, cwd) {
  return execFileSync("npm", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
}

rmSync(packDir, { recursive: true, force: true });
mkdirSync(packDir, { recursive: true });

let tarball = process.env.JQUERY_FORM_TARBALL && resolve(process.env.JQUERY_FORM_TARBALL);
if (!tarball) {
  const [packed] = JSON.parse(npm(["pack", "--json", "--pack-destination", packDir], root));
  tarball = resolve(packDir, packed.filename);
}

for (const version of jqueryVersions) {
  const fixture = resolve(packDir, `jquery-${version}`);
  mkdirSync(fixture);
  writeFileSync(
    resolve(fixture, "package.json"),
    JSON.stringify({ name: `fixture-jquery-${version}`, private: true }, null, 2) + "\n"
  );
  npm(
    [
      "install",
      "--prefer-offline",
      "--no-audit",
      "--no-fund",
      "--no-package-lock",
      tarball,
      `jquery@${version}`,
    ],
    fixture
  );
}
console.log(`installed ${tarball} into ${packDir}`);
