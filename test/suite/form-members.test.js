import { assert, describe, it } from "vitest";
import { callFormMethod, formMember } from "../../src/form-members.js";
import { formAttribute } from "../../src/form-attributes.js";

describe("form members", function () {
  describe("formMember", function () {
    it("should read the prototype value when a control shadows the member", function () {
      const form = $('<form><input name="elements"><input name="a"></form>')[0];

      const elements = formMember(form, "elements");

      assert.strictEqual(elements.length, 2);
    });

    it("should read a member inherited from a prototype further up the chain", function () {
      const form = $('<form><input name="ownerDocument"></form>')[0];

      const ownerDocument = formMember(form, "ownerDocument");

      assert.strictEqual(ownerDocument, document);
    });

    it("should read the plain property when the getter does not accept the element", function () {
      const fieldset = $('<fieldset><input name="a"></fieldset>')[0];

      const elements = formMember(fieldset, "elements");

      assert.strictEqual(elements, fieldset.elements);
    });
  });

  describe("callFormMethod", function () {
    it("should call the prototype method when a control shadows it", function () {
      const form = $('<form><input name="setAttribute"></form>')[0];

      callFormMethod(form, "setAttribute", "action", "ajax/text.html");

      assert.strictEqual(form.getAttribute("action"), "ajax/text.html");
    });

    it("should return the method's result", function () {
      const form = $('<form id="members"><input name="getAttribute"></form>')[0];

      const id = callFormMethod(form, "getAttribute", "id");

      assert.strictEqual(id, "members");
    });
  });

  describe("formAttribute", function () {
    it("should return undefined for an absent attribute, as jQuery's attr does", function () {
      const form = $('<form><input name="id"></form>')[0];

      const value = formAttribute(form, "id");

      assert.strictEqual(value, undefined);
    });
  });
});
