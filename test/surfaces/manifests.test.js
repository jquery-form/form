import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (file) => JSON.parse(readFileSync(new URL(`../../${file}`, import.meta.url), "utf8"));
const pkg = read("package.json");
const bower = read("bower.json");
const composer = read("composer.json");
const registry = read("form.jquery.json");

const distFiles = ["dist/jquery.form.js", "dist/jquery.form.mjs", "dist/jquery.form.min.js"];
const license = "(LGPL-2.1+ OR MIT)";

describe("when the package manifests are read", () => {
  it("should point every entry point at a built dist file", () => {
    const entries = [
      pkg.main,
      pkg.module,
      pkg.browser,
      bower.main,
      registry.main,
      registry.browser,
      ...composer.extra.component.scripts,
    ];

    for (const entry of entries) {
      expect(distFiles).toContain(entry);
      expect(existsSync(new URL(`../../${entry}`, import.meta.url))).toBe(true);
    }
  });

  it("should keep the classic build as main and the module build as module", () => {
    expect(pkg.main).toBe("dist/jquery.form.js");
    expect(pkg.module).toBe("dist/jquery.form.mjs");
    expect(pkg.browser).toBe("dist/jquery.form.min.js");
  });

  it("should publish the entry points through the files list", () => {
    expect(pkg.files).toContain("dist");
  });

  it("should agree on the version with the registry manifest and every dist banner", () => {
    expect(registry.version).toBe(pkg.version);
    for (const file of distFiles) {
      const banner = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8").slice(0, 400);
      expect(banner).toContain(`version: ${pkg.version}`);
    }
  });

  it("should agree on the license", () => {
    expect(pkg.license).toBe(license);
    expect(bower.license).toBe(license);
    expect(composer.license).toBe(license);
    expect(registry.licenses.map((entry) => entry.type)).toEqual(["LGPL-2.1+", "MIT"]);
  });

  it("should agree on the jQuery dependency range", () => {
    const range = pkg.dependencies.jquery;

    expect(bower.dependencies.jquery).toBe(range);
    expect(registry.dependencies.jquery).toBe(range);
    expect(composer.require["components/jquery"]).toBe(range);
  });
});

describe("when the dist files are read", () => {
  // #553: a block ESLint configuration comment in the classic build applies to code concatenated after it.
  it.fails("should not ship file-wide ESLint configuration comments", () => {
    const builds = ["dist/jquery.form.js", "dist/jquery.form.mjs"];

    const sources = builds.map((file) =>
      readFileSync(new URL(`../../${file}`, import.meta.url), "utf8")
    );

    for (const source of sources) {
      expect(source).not.toMatch(/\/\*\s*eslint\s/);
    }
  });
});
