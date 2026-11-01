import { assert, describe, it } from "vitest";
import { resetFixture, arrayCount, arrayValue } from "./helpers.js";

describe("form", function () {
  resetFixture();

  describe("form fixture", function () {
    it("should expose the action and method attributes of form1", function () {
      const $form = $("#form1");

      const action = $form.attr("action");
      const method = $form.attr("method");

      assert.strictEqual(action, "ajax/text.html", 'form "action"');
      assert.strictEqual(method, "get", 'form "method"');
    });
  });

  describe("formToArray", function () {
    it("should include controls associated by the form attribute in semantic mode", function () {
      const $form = $('<form id="external-owner"><input name="inside" value="1"></form>');
      $form.appendTo("#main");
      $('<input name="outside" form="external-owner" value="2">').appendTo("#main");

      const data = $form.formToArray(true);

      assert.deepEqual(
        data.map((field) => field.name),
        ["inside", "outside"]
      );
    });

    it("should skip image inputs that were not clicked in semantic mode", function () {
      const $form = $(
        '<form><input type="image" name="first" value="a"><input type="image" name="second" value="b"></form>'
      ).appendTo("#main");
      const form = $form[0];
      form.clk = $form.find('[name="second"]')[0];
      form.clk_x = 3;
      form.clk_y = 4;

      const data = $form.formToArray(true);

      assert.deepEqual(
        data.map((field) => [field.name, field.value]),
        [
          ["second", "b"],
          ["second.x", 3],
          ["second.y", 4],
        ]
      );
    });

    it("should collect multi-value controls into the elements list", function () {
      const $form = $(
        '<form><select name="many" multiple><option selected>a</option><option selected>b</option></select></form>'
      ).appendTo("#main");
      const elements = [];

      const data = $form.formToArray(false, elements);

      assert.deepEqual(
        data.map((field) => field.value),
        ["a", "b"]
      );
      assert.deepEqual(elements, [$form.find("select")[0]]);
    });

    it("should report an empty file input without an elements list", function () {
      const $form = $('<form><input type="file" name="upload"></form>').appendTo("#main");

      const data = $form.formToArray();

      assert.deepEqual(data, [{ name: "upload", value: "", type: "file" }]);
    });

    it("should return one entry per selected option of a multi-select", function () {
      const $form = $("#form1");

      const a = $form.formToArray();

      assert.strictEqual(a.constructor, Array, "type check");
      assert.strictEqual(a.length, 13, "array length");
      assert.strictEqual(arrayCount(a, "Multiple"), 3, "multi-select");
    });

    it('should read fields named "action" and "method" as plain inputs', function () {
      const $form = $("#form1");

      const a = $form.formToArray();

      assert.strictEqual(a.constructor, Array, "type check");
      assert.strictEqual(arrayValue(a, "action"), "1", "input name=action");
      assert.strictEqual(arrayValue(a, "method"), "2", "input name=method");
    });

    it("should return fields in document order when semantic is true", function () {
      const $form = $("#form2");
      const testData = ["a", "b", "c", "d", "e", "f"];

      const formData = $form.formToArray(true);

      for (let i = 0; i < 6; i++) {
        assert.strictEqual(formData[i].name, testData[i], "match value at index=" + i);
      }
    });

    it("should promote option text when an option has no value attribute", function () {
      const $form = $("#form6");
      const expected = [
        { name: "A", value: "" },
        { name: "B", value: "MISSING_ATTR" },
        { name: "C", value: "" },
        { name: "C", value: "MISSING_ATTR" },
      ];

      const a = $form.formToArray(true);

      for (let i = 0; i < a.length; i++) {
        assert.strictEqual(
          a[i].name,
          expected[i].name,
          "Name: " + a[i].name + " = " + expected[i].name
        );
        assert.strictEqual(
          a[i].value,
          expected[i].value,
          "Value: " + a[i].value + " = " + expected[i].value
        );
      }
    });

    it("should include fields outside the form that use the form attribute", function () {
      const $form = $("#form10");

      const formData = $form.formToArray();

      assert.strictEqual(formData.length, 2, 'There are two "successful" elements of the form');
    });

    it("should return an empty array for an empty selection", function () {
      const $form = $(".missing-form");

      const formData = $form.formToArray();

      assert.deepEqual(formData, []);
    });

    it("should filter controls before collecting their values", function () {
      const $form = $('<form><input name="keep" value="yes"><input name="drop" value="no"></form>');
      const elements = [];

      const formData = $form.formToArray(false, elements, function (element) {
        return element.name === "keep" ? element : null;
      });

      assert.deepEqual(formData, [{ name: "keep", value: "yes", type: "text", required: false }]);
      assert.deepEqual(elements, [$form[0].elements[0]]);
    });

    it("should include the clicked image value and coordinates in semantic order", function () {
      const $form = $('<form><input type="image" name="map" value="go"></form>').appendTo("#main");
      const image = $form.find("input")[0];
      $form[0].clk = image;
      $form[0].clk_x = 12;
      $form[0].clk_y = 34;

      const formData = $form.formToArray(true);

      assert.deepEqual(formData, [
        { name: "map", value: "go", type: "image" },
        { name: "map.x", value: 12 },
        { name: "map.y", value: 34 },
      ]);
    });

    it("should include the clicked image value and coordinates in non-semantic mode", function () {
      const $form = $(
        '<form><input type="hidden" name="token" value="abc"><input type="image" name="map" value="go"></form>'
      ).appendTo("#main");
      const image = $form.find('[type="image"]')[0];
      $form[0].clk = image;
      $form[0].clk_x = 5;
      $form[0].clk_y = 8;

      const formData = $form.formToArray();

      assert.deepEqual(formData, [
        { name: "token", value: "abc", type: "hidden", required: false },
        { name: "map", value: "go" },
        { name: "map.x", value: 5 },
        { name: "map.y", value: 8 },
      ]);
    });

    it("should represent an empty file input as an empty file value", function () {
      const $form = $('<form><input type="file" name="upload"></form>');
      const elements = [];

      const formData = $form.formToArray(false, elements);

      assert.deepEqual(formData, [{ name: "upload", value: "", type: "file" }]);
      assert.deepEqual(elements, [$form[0].elements[0]]);
    });

    it("should match form attributes to an id that contains selector syntax", function () {
      const id = 'owner"],[name=password';
      const $form = $('<form><input name="inside" value="1"></form>').attr("id", id);
      $form.appendTo("#main");
      $('<input name="password" value="secret">').appendTo("#main");
      $('<input name="outside" value="2">').attr("form", id).appendTo("#main");

      const names = $form.formToArray(true).map((field) => field.name);

      assert.deepEqual(names, ["inside", "outside"]);
    });

    it("should not parse a form id as HTML", async function () {
      window.formIdPayload = 0;
      const $form = $('<form><input name="a" value="1"></form>')
        .attr("id", 'x"]<img src=x onerror="window.formIdPayload=1">')
        .appendTo("#main");

      const formData = $form.formToArray(true);
      await new Promise((resolve) => setTimeout(resolve, 50));

      assert.deepEqual(formData.length, 1);
      assert.strictEqual(window.formIdPayload, 0);
    });

    it("should collect every control when one is named elements", function () {
      const $form = $('<form><input name="a" value="1"><input name="elements" value="2"></form>');

      const names = $form.formToArray().map((field) => field.name);

      assert.deepEqual(names, ["a", "elements"]);
    });

    it("should collect the controls of a fieldset", function () {
      const $fieldset = $('<fieldset><input name="a" value="1"></fieldset>');

      const formData = $fieldset.formToArray();

      assert.deepEqual(formData, [{ name: "a", value: "1", type: "text", required: false }]);
    });

    it("should read form.elements in browsers without DOM prototype accessors", function () {
      const $form = $('<form><input name="a" value="1"></form>');
      const HTMLFormElement = window.HTMLFormElement;
      window.HTMLFormElement = undefined;

      try {
        const formData = $form.formToArray();

        assert.deepEqual(formData, [{ name: "a", value: "1", type: "text", required: false }]);
      } finally {
        window.HTMLFormElement = HTMLFormElement;
      }
    });
  });

  describe("formSerialize", function () {
    it("should produce one query-string pair per successful field", function () {
      const $form = $("#form1");

      const s = $form.formSerialize();

      assert.ok(s.constructor == String, "type check");
      assert.ok(s.split("&").length == 13, "string array length");
    });

    it("should serialize input elements that are not inside a form", function () {
      const $fields = $("#pseudo *");

      const s = $fields.fieldSerialize();

      assert.ok(s.constructor == String, "type check");
      assert.ok(s.split("&").length == 3, "string array length");
    });
  });

  describe("fieldValue", function () {
    // #600: the document and text nodes have no tag name.
    it("should return no values for nodes without a tag name", function () {
      const $nodes = $([document, document.createTextNode("text")]);

      const values = $nodes.fieldValue(false);

      assert.deepEqual(values, ["", ""]);
    });

    it("should return null for an unselected select when success is not required", function () {
      const select = $('<select name="choice"><option>a</option></select>')[0];
      select.selectedIndex = -1;

      const value = $.fieldValue(select, false);

      assert.strictEqual(value, null);
    });

    it("should use option text when an empty value attribute is unspecified", function () {
      const select = $('<select name="choice"><option value="">Label</option></select>')[0];
      Object.defineProperty(select.options[0], "attributes", {
        configurable: true,
        value: { value: { specified: false } },
      });

      const value = $.fieldValue(select);

      assert.strictEqual(value, "Label");
    });

    it("should omit unsuccessful controls by default", function () {
      const $fields = $(
        '<div><input value="unnamed"><input name="disabled" value="x" disabled><input type="reset" name="reset" value="x"><select name="empty"><option>one</option></select></div>'
      ).find(":input");
      $fields.filter("select")[0].selectedIndex = -1;

      const values = $fields.fieldValue();

      assert.deepEqual(values, []);
    });

    it("should normalize line endings in scalar values", function () {
      const $textarea = $('<textarea name="message">first\nsecond</textarea>');

      const values = $textarea.fieldValue();

      assert.deepEqual(values, ["first\r\nsecond"]);
    });

    it("should return only successful values when successful is true", function () {
      const expectedCheckbox = ["8", "10"];
      const expectedMultiple = ["3", "4"];

      const input = $("#fieldTest input").fieldValue(true);
      const anyField = $("#fieldTest :input").fieldValue(true);
      const hidden = $("#fieldTest input:hidden").fieldValue(true);
      const password = $("#fieldTest :password").fieldValue(true);
      const radio = $("#fieldTest :radio").fieldValue(true);
      const select = $("#fieldTest select").fieldValue(true);
      const checkbox = $("#fieldTest :checkbox").fieldValue(true);
      const multiple = $("#fieldTest [name=B]").fieldValue(true);

      assert.ok("5" == input[0], "input");
      assert.ok("1" == anyField[0], ":input");
      assert.ok("5" == hidden[0], ":hidden");
      assert.ok("14" == password[0], ":password");
      assert.ok("12" == radio[0], ":radio");
      assert.ok("1" == select[0], "select");
      assert.ok(
        checkbox.length == expectedCheckbox.length,
        "result size check (checkbox): " + checkbox.length + "=" + expectedCheckbox.length
      );
      for (let i = 0; i < checkbox.length; i++) {
        assert.ok(checkbox[i] == expectedCheckbox[i], expectedCheckbox[i]);
      }
      assert.ok(
        multiple.length == expectedMultiple.length,
        "result size check (select-multiple): " + multiple.length + "=" + expectedMultiple.length
      );
      for (let i = 0; i < multiple.length; i++) {
        assert.ok(multiple[i] == expectedMultiple[i], expectedMultiple[i]);
      }
    });

    it("should return every value when successful is false", function () {
      const expectedCheckbox = ["8", "9", "10"];
      const expectedRadio = ["11", "12", "13"];
      const expectedMultiple = ["3", "4"];

      const input = $("#fieldTest input").fieldValue(false);
      const anyField = $("#fieldTest :input").fieldValue(false);
      const hidden = $("#fieldTest input:hidden").fieldValue(false);
      const password = $("#fieldTest :password").fieldValue(false);
      const select = $("#fieldTest select").fieldValue(false);
      const checkbox = $("#fieldTest :checkbox").fieldValue(false);
      const radio = $("#fieldTest :radio").fieldValue(false);
      const multiple = $("#fieldTest [name=B]").fieldValue(false);

      assert.ok("5" == input[0], "input");
      assert.ok("1" == anyField[0], ":input");
      assert.ok("5" == hidden[0], ":hidden");
      assert.ok("14" == password[0], ":password");
      assert.ok("1" == select[0], "select");
      assert.ok(
        checkbox.length == expectedCheckbox.length,
        "result size check (checkbox): " + checkbox.length + "=" + expectedCheckbox.length
      );
      for (let i = 0; i < checkbox.length; i++) {
        assert.ok(checkbox[i] == expectedCheckbox[i], expectedCheckbox[i]);
      }
      assert.ok(
        radio.length == expectedRadio.length,
        "result size check (radio): " + radio.length + "=" + expectedRadio.length
      );
      for (let i = 0; i < radio.length; i++) {
        assert.ok(radio[i] == expectedRadio[i], expectedRadio[i]);
      }
      assert.ok(
        multiple.length == expectedMultiple.length,
        "result size check (select-multiple): " + multiple.length + "=" + expectedMultiple.length
      );
      for (let i = 0; i < multiple.length; i++) {
        assert.ok(multiple[i] == expectedMultiple[i], expectedMultiple[i]);
      }
    });
  });

  describe("fieldSerialize", function () {
    // Shared Assert step: the serialized pairs match `expected`, in order.
    function assertPairs(serialized, expected) {
      const result = serialized.split("&");

      assert.ok(
        result.length == expected.length,
        "result size check: " + result.length + "=" + expected.length
      );
      for (let i = 0; i < result.length; i++) {
        assert.ok(result[i] == expected[i], expected[i] + " = " + result[i]);
      }
    }

    it("should serialize only successful inputs when successful is true", function () {
      const expected = ["C=5", "D=6", "F=8", "F=10", "G=12", "H=14"];

      const result = $("#fieldTest input").fieldSerialize(true);

      assertPairs(result, expected);
    });

    it("should serialize only successful fields of every kind when successful is true", function () {
      const expected = ["A=1", "B=3", "B=4", "C=5", "D=6", "E=7", "F=8", "F=10", "G=12", "H=14"];

      const result = $("#fieldTest :input").fieldSerialize(true);

      assertPairs(result, expected);
    });

    it("should serialize every field when successful is false", function () {
      const expected = [
        "A=1",
        "B=3",
        "B=4",
        "C=5",
        "D=6",
        "E=7",
        "F=8",
        "F=9",
        "F=10",
        "G=11",
        "G=12",
        "G=13",
        "H=14",
        "I=15",
        "J=16",
      ];

      const result = $("#fieldTest :input").fieldSerialize(false);

      assertPairs(result, expected);
    });

    it("should serialize the selected options of a select-multiple", function () {
      const expected = ["B=3", "B=4"];

      const result = $("#fieldTest [name=B]").fieldSerialize(true);

      assertPairs(result, expected);
    });

    it("should serialize only checked checkboxes when successful is true", function () {
      const expected = ["F=8", "F=10"];

      const result = $("#fieldTest :checkbox").fieldSerialize(true);

      assertPairs(result, expected);
    });

    it("should serialize every checkbox when successful is false", function () {
      const expected = ["F=8", "F=9", "F=10"];

      const result = $("#fieldTest :checkbox").fieldSerialize(false);

      assertPairs(result, expected);
    });

    it("should serialize only the checked radio when successful is true", function () {
      const expected = ["G=12"];

      const result = $("#fieldTest :radio").fieldSerialize(true);

      assertPairs(result, expected);
    });

    it("should serialize every radio when successful is false", function () {
      const expected = ["G=11", "G=12", "G=13"];

      const result = $("#fieldTest :radio").fieldSerialize(false);

      assertPairs(result, expected);
    });

    it("should ignore unnamed fields and encode repeated select values", function () {
      const $fields = $(
        '<div><input value="ignored"><select name="choice" multiple><option selected value="a b">A</option><option selected value="c">C</option></select></div>'
      ).find(":input");

      const result = $fields.fieldSerialize();

      // jQuery before 3.0 encodes a space as "+" in $.param; later versions use "%20".
      const space = Number($.fn.jquery.split(".")[0]) < 3 ? "+" : "%20";
      assert.strictEqual(result, `choice=a${space}b&choice=c`);
    });
  });
});
