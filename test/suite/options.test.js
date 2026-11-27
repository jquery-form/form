import { assert, describe, it } from "vitest";
import { selectorOption } from "../../src/options.js";
import { countParsedHTML, resetFixture } from "./helpers.js";

describe("options", function () {
  resetFixture();

  describe("selectorOption", function () {
    it("should throw a selector syntax error, not parse HTML, for an HTML string", async function () {
      const parsed = await countParsedHTML(() =>
        selectorOption('<iframe data-option-html="1"></iframe>'),
      );

      assert.match(parsed.error.message, /unrecognized expression/);
      assert.strictEqual(parsed.count, 0);
    });

    it("should find a selector string in the given document", function () {
      $('<iframe class="option-frame"></iframe>').appendTo("#main");

      const $matched = selectorOption(".option-frame", document);

      assert.strictEqual($matched.length, 1);
    });

    it("should look a selector up in the given document, not the page", function () {
      const other = document.implementation.createHTMLDocument("other");
      $(other.body).append('<iframe class="other-frame"></iframe>');
      $('<iframe class="other-frame"></iframe>').appendTo("#main");

      const $matched = selectorOption(".other-frame", other);

      assert.strictEqual($matched.length, 1);
      assert.strictEqual($matched[0].ownerDocument, other);
    });

    it("should wrap an element as given", function () {
      const frame = document.createElement("iframe");

      const $matched = selectorOption(frame);

      assert.strictEqual($matched[0], frame);
    });
  });
});
