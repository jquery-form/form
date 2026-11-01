import { assert, describe, it } from "vitest";
import { isSuccessful } from "../../src/successful-controls.js";

describe("successful controls", function () {
  describe("isSuccessful", function () {
    function control(html) {
      return $(html)[0];
    }

    function inForm(html) {
      return $("<form>" + html + "</form>").children()[0];
    }

    it("should accept a named text input", function () {
      const el = control('<input name="a">');

      const successful = isSuccessful(el, null);

      assert.strictEqual(successful, true);
    });

    it("should reject an unnamed or disabled control", function () {
      const unnamed = control("<input>");
      const disabled = control('<input name="a" disabled>');

      const results = [isSuccessful(unnamed, null), isSuccessful(disabled, null)];

      assert.deepEqual(results, [false, false]);
    });

    it("should reject reset and plain buttons", function () {
      const reset = control('<input type="reset" name="r">');
      const button = control('<button type="button" name="b">');

      const results = [isSuccessful(reset, null), isSuccessful(button, null)];

      assert.deepEqual(results, [false, false]);
    });

    it("should accept a checkbox or radio only when it is checked", function () {
      const checked = control('<input type="checkbox" name="c" checked>');
      const unchecked = control('<input type="radio" name="r">');

      const results = [isSuccessful(checked, null), isSuccessful(unchecked, null)];

      assert.deepEqual(results, [true, false]);
    });

    it("should accept a submit or image button of a form only when it is the submitter", function () {
      const submit = inForm('<input type="submit" name="s">');
      const image = inForm('<input type="image" name="i">');

      const results = [
        isSuccessful(submit, submit),
        isSuccessful(submit, null),
        isSuccessful(image, image),
        isSuccessful(image, submit),
      ];

      assert.deepEqual(results, [true, false, true, false]);
    });

    it("should accept a submit button without a form", function () {
      const submit = control('<input type="submit" name="s">');

      const successful = isSuccessful(submit, null);

      assert.strictEqual(successful, true);
    });

    it("should reject a select with nothing selected", function () {
      const select = control('<select name="s"><option>a</option></select>');
      select.selectedIndex = -1;

      const successful = isSuccessful(select, null);

      assert.strictEqual(successful, false);
    });

    it("should accept a select with a selected option", function () {
      const select = control('<select name="s"><option>a</option></select>');

      const successful = isSuccessful(select, null);

      assert.strictEqual(successful, true);
    });
  });
});
