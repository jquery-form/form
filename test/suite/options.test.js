import { assert, describe, it } from "vitest";
import { selectorOption } from "../../src/options.js";
import { countHtmlParsed, resetFixture } from "./helpers.js";

describe("options", function () {
  resetFixture();

  describe("selectorOption", function () {
    it("should match nothing and parse nothing for an HTML string", async function () {
      let $matched;

      const parsed = await countHtmlParsed("data-option-html", function () {
        $matched = selectorOption('<iframe data-option-html="1"></iframe>');
      });

      assert.strictEqual($matched.length, 0);
      assert.strictEqual(parsed, 0);
    });

    it("should log that it ignored an HTML string under debug", function () {
      const logged = [];
      const consoleLog = console.log;
      console.log = (text) => logged.push(text);
      $.fn.ajaxSubmit.debug = true;

      try {
        selectorOption(" <b>x</b>");
      } finally {
        $.fn.ajaxSubmit.debug = false;
        console.log = consoleLog;
      }

      assert.deepEqual(logged, ["[jquery.form] ignoring HTML given as a selector:  <b>x</b>"]);
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
