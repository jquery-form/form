import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (file) => JSON.parse(readFileSync(new URL(`../../${file}`, import.meta.url), "utf8"));
const pkg = read("package.json");
const bower = read("bower.json");
const composer = read("composer.json");

const distFiles = ["dist/jquery.form.js", "dist/jquery.form.mjs", "dist/jquery.form.min.js"];
const license = "(LGPL-2.1-or-later OR MIT)";

describe("when the package manifests are read", () => {
  it("should point every entry point at a built dist file", () => {
    const entries = [
      pkg.main,
      pkg.module,
      pkg.jsdelivr,
      pkg.unpkg,
      bower.main,
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
  });

  it("should leave bundlers on module and main and serve the minified build from CDNs", () => {
    expect(pkg).not.toHaveProperty("browser");
    expect(pkg.jsdelivr).toBe("dist/jquery.form.min.js");
    expect(pkg.unpkg).toBe("dist/jquery.form.min.js");
  });

  it("should export the module build to import, the classic build otherwise, and only dist and package.json by path", () => {
    expect(pkg.exports).toEqual({
      ".": { import: "./dist/jquery.form.mjs", default: "./dist/jquery.form.js" },
      "./dist/*": "./dist/*",
      "./package.json": "./package.json",
    });
  });

  it("should point every exports target at a path the package publishes", () => {
    // A "./dist/*" target is checked as the directory its pattern matches in.
    const targets = Object.values(pkg.exports).flatMap((target) =>
      typeof target === "string" ? [target] : Object.values(target),
    );

    const paths = targets.map((target) => target.replace(/^\.\//, "").replace(/\/\*$/, ""));

    // npm always publishes package.json; every other path must be under the files list.
    for (const path of paths) {
      expect(existsSync(new URL(`../../${path}`, import.meta.url)), path).toBe(true);
      expect(path === "package.json" || pkg.files.includes(path.split("/")[0]), path).toBe(true);
    }
  });

  it("should publish the entry points through the files list", () => {
    expect(pkg.files).toContain("dist");
  });

  it("should publish both licenses of the dual license", () => {
    expect(pkg.files).toContain("LICENSE-MIT");
  });

  it("should agree on the version with every dist banner", () => {
    for (const file of distFiles) {
      const banner = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8").slice(0, 400);
      expect(banner).toContain(`version: ${pkg.version}`);
    }
  });

  it("should agree on the license", () => {
    expect(pkg.license).toBe(license);
    expect(bower.license).toBe(license);
    expect(composer.license).toBe(license);
  });

  it("should declare jQuery 3.5.0 or later as a peer dependency only", () => {
    expect(pkg.peerDependencies).toEqual({ jquery: ">=3.5.0" });
    expect(pkg).not.toHaveProperty("dependencies");
  });

  it("should agree on the jQuery dependency range", () => {
    const range = pkg.peerDependencies.jquery;

    expect(bower.dependencies.jquery).toBe(range);
    expect(composer.require["components/jquery"]).toBe(range);
  });

  it("should leave out the old plugins.jquery.com manifest", () => {
    expect(existsSync(new URL("../../form.jquery.json", import.meta.url))).toBe(false);
  });
});

describe("when the dist files are read", () => {
  // #553: a block ESLint configuration comment in the classic build applies to code concatenated after it.
  it("should not ship file-wide ESLint configuration comments", () => {
    const builds = ["dist/jquery.form.js", "dist/jquery.form.mjs"];

    const sources = builds.map((file) =>
      readFileSync(new URL(`../../${file}`, import.meta.url), "utf8"),
    );

    for (const source of sources) {
      expect(source).not.toMatch(/\/\*\s*eslint\s/);
    }
  });
});
