import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

describe("when the package is required from CommonJS", () => {
  it("should export a (root, jQuery) factory without touching the DOM", () => {
    const factory = require("../..");

    expect(typeof factory).toBe("function");
    expect(factory.length).toBe(2);
  });
});
