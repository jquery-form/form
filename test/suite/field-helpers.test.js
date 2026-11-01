import { assert, describe, it } from "vitest";
import { resetFixture } from "./helpers.js";

describe("form", function () {
  resetFixture();

  describe("resetForm", function () {
    it("should reset the control a label targets and its nested fields", function () {
      const $target = $('<input id="label-target" value="default">').appendTo("#main");
      const $label = $('<label for="label-target"><input value="nested"></label>').appendTo(
        "#main"
      );
      $target.val("changed");
      $label.find("input").val("changed");

      $label.resetForm();

      assert.strictEqual($target.val(), "default");
      assert.strictEqual($label.find("input").val(), "nested");
    });

    // #600: the document and text nodes have no tag name.
    it("should reset the fields of a document and skip text nodes", function () {
      const $input = $('<input value="default">').appendTo("#main").val("changed");
      const $nodes = $([document, document.createTextNode("text")]);

      const reset = () => $nodes.resetForm();

      assert.doesNotThrow(reset);
      assert.strictEqual($input.val(), "default");
    });

    [
      ["starts with markup", '<img src=x onerror="window.labelPayload=1">'],
      ["contains markup", 'x <img src=x onerror="window.labelPayload=1">'],
    ].forEach(function ([label, value]) {
      it("should not parse a for attribute that " + label + " as HTML", async function () {
        window.labelPayload = 0;
        const $label = $("<label>").attr("for", value).appendTo("#main");

        $label.resetForm();
        await new Promise((resolve) => setTimeout(resolve, 50));

        assert.strictEqual(window.labelPayload, 0);
      });
    });

    it("should ignore a for attribute that names no element", function () {
      const $label = $('<label for="no-such-control"><input value="nested"></label>').appendTo(
        "#main"
      );
      $label.find("input").val("changed");

      $label.resetForm();

      assert.strictEqual($label.find("input").val(), "nested");
    });

    it("should not reset a label again when its for attribute names an ancestor", function () {
      const $outer = $('<div id="label-owner"><label for="label-owner">L</label></div>').appendTo(
        "#main"
      );

      const reset = () => $outer.find("label").resetForm();

      assert.doesNotThrow(reset);
    });

    it("should reset nested fields of a label without a for attribute", function () {
      const $label = $('<label><input value="nested"></label>').appendTo("#main");
      $label.find("input").val("changed");

      $label.resetForm();

      assert.strictEqual($label.find("input").val(), "nested");
    });

    it("should reset the parent single select when one of its options is reset", function () {
      const $select = $(
        "<select><option>a</option><option selected>b</option><option>c</option></select>"
      ).appendTo("#main");
      $select.val("c");

      $select.find("option").eq(0).resetForm();

      assert.strictEqual($select.val(), "b");
    });

    it("should not call reset when a control named reset shadows the form method", function () {
      const $form = $('<form><input name="reset" value="default"></form>').appendTo("#main");
      $form.find("input").val("changed");

      $form.resetForm();

      assert.strictEqual($form.find("input").val(), "changed");
    });

    it("should restore a text input to its default value", function () {
      const $el = $("#form1 input[name=Name]");
      assert.ok("MyName1" == $el.val(), "beforeSubmit: " + $el.val());
      $el.val("test");
      assert.ok("test" == $el.val(), "update: " + $el.val());

      $("#form1").resetForm();

      assert.ok("MyName1" == $el.val(), "success: " + $el.val());
    });

    it("should restore a select to its default option", function () {
      const $el = $("#form1 select[name=Single]");
      assert.ok("one" == $el.val(), "beforeSubmit: " + $el.val());
      $el.val("two");
      assert.ok("two" == $el.val(), "update: " + $el.val());

      $("#form1").resetForm();

      assert.ok("one" == $el.val(), "success: " + $el.val());
    });

    it("should restore a textarea to its default text", function () {
      const $el = $("#form1 textarea");
      assert.ok("This is Form1" == $el.val(), "beforeSubmit: " + $el.val());
      $el.val("test");
      assert.ok("test" == $el.val(), "udpate: " + $el.val());

      $("#form1").resetForm();

      assert.ok("This is Form1" == $el.val(), "success: " + $el.val());
    });

    it("should re-check a checkbox that was unchecked", function () {
      const el = $("#form1 input:checkbox:checked")[0];
      assert.ok(el.checked, "beforeSubmit: " + el.checked);
      el.checked = false;
      assert.ok(!el.checked, "update: " + el.checked);

      $("#form1").resetForm();

      assert.ok(el.checked, "success: " + el.checked);
    });

    it("should re-check a radio button that was unchecked", function () {
      const el = $("#form1 input:radio:checked")[0];
      assert.ok(el.checked, "beforeSubmit: " + el.checked);
      el.checked = false;
      assert.ok(!el.checked, "update: " + el.checked);

      $("#form1").resetForm();

      assert.ok(el.checked, "success: " + el.checked);
    });

    it("should restore individual inputs and textareas to their defaults", function () {
      const $fields = $(
        '<div><input type="checkbox" checked><input value="original"><textarea>original</textarea></div>'
      ).find(":input");
      $fields.eq(0).prop("checked", false);
      $fields.eq(1).val("changed");
      $fields.eq(2).val("changed");

      $fields.resetForm();

      assert.strictEqual($fields.eq(0).prop("checked"), true);
      assert.strictEqual($fields.eq(1).val(), "original");
      assert.strictEqual($fields.eq(2).val(), "original");
    });

    it("should restore a multiple select when resetting an optgroup", function () {
      const $select = $(
        "<select multiple><optgroup><option selected>one</option><option>two</option></optgroup></select>"
      );
      const $options = $select.find("option");
      $options.eq(0).prop("selected", false);
      $options.eq(1).prop("selected", true);

      $select.find("optgroup").resetForm();

      assert.deepEqual(
        $options
          .map(function () {
            return this.selected;
          })
          .get(),
        [true, false]
      );
    });

    it("should reset form controls found inside a container", function () {
      const $container = $(
        '<div><input value="original"><select><option selected>one</option><option>two</option></select></div>'
      );
      $container.find("input").val("changed");
      $container.find("select").val("two");

      $container.resetForm();

      assert.strictEqual($container.find("input").val(), "original");
      assert.strictEqual($container.find("select").val(), "one");
    });
  });

  describe("clearForm", function () {
    it("should empty a text input", function () {
      const $el = $("#form1 input[name=Name]");
      assert.ok("MyName1" == $el.val(), "beforeSubmit: " + $el.val());

      $("#form1").clearForm();

      assert.ok("" == $el.val(), "success: " + $el.val());
    });

    it("should deselect a select", function () {
      const $el = $("#form1 select[name=Single]");
      assert.ok("one" == $el.val(), "beforeSubmit: " + $el.val());

      $("#form1").clearForm();

      assert.ok(!$el.val(), "success: " + $el.val());
    });

    it("should leave a hidden input unchanged", function () {
      const $el = $("#form1 input:hidden");
      assert.ok("hiddenValue" == $el.val(), "beforeSubmit: " + $el.val());

      $("#form1").clearForm();

      assert.ok("hiddenValue" == $el.val(), "success: " + $el.val());
    });

    it("should leave a submit input unchanged", function () {
      const $el = $("#form1 input:submit");
      assert.ok("Submit1" == $el.val(), "beforeSubmit: " + $el.val());

      $("#form1").clearForm();

      assert.ok("Submit1" == $el.val(), "success: " + $el.val());
    });

    it("should uncheck a checkbox", function () {
      const el = $("#form1 input:checkbox:checked")[0];
      assert.ok(el.checked, "beforeSubmit: " + el.checked);

      $("#form1").clearForm();

      assert.ok(!el.checked, "success: " + el.checked);
    });

    it("should uncheck a radio button", function () {
      const el = $("#form1 input:radio:checked")[0];
      assert.ok(el.checked, "beforeSubmit: " + el.checked);

      $("#form1").clearForm();

      assert.ok(!el.checked, "success: " + el.checked);
    });

    it("should clear hidden inputs only when explicitly included", function () {
      const $fields = $(
        '<div><input type="hidden" value="plain"><input type="hidden" class="special" value="special"></div>'
      ).find("input");

      $fields.clearFields(".special:hidden");

      assert.strictEqual($fields.eq(0).val(), "plain");
      assert.strictEqual($fields.eq(1).val(), "");
    });

    // #600: the document and text nodes have no tag name.
    it("should skip nodes without a tag name", function () {
      const $nodes = $([document, document.createTextNode("text")]);

      const clear = () => $nodes.clearFields();

      assert.doesNotThrow(clear);
    });

    it("should clear all hidden inputs when includeHidden is true", function () {
      const $hidden = $('<input type="hidden" value="secret">');

      $hidden.clearFields(true);

      assert.strictEqual($hidden.val(), "");
    });

    it("should clear a file input without replacing it in modern browsers", function () {
      const $file = $('<input type="file" name="upload">');
      const file = $file[0];

      const result = $file.clearFields();

      assert.strictEqual(result[0], file);
      assert.strictEqual($file.val(), "");
    });

    it("should replace a file input when simulating legacy MSIE", function () {
      const userAgent = Object.getOwnPropertyDescriptor(navigator, "userAgent");
      const $container = $('<div><input type="file" name="upload"></div>');
      const file = $container.find("input")[0];
      Object.defineProperty(navigator, "userAgent", {
        configurable: true,
        value: "MSIE 10.0",
      });

      try {
        $(file).clearFields();

        assert.notStrictEqual($container.find("input")[0], file);
        assert.strictEqual($container.find("input").attr("name"), "upload");
      } finally {
        if (userAgent) {
          Object.defineProperty(navigator, "userAgent", userAgent);
        } else {
          delete navigator.userAgent;
        }
      }
    });
  });

  describe("enable and selected", function () {
    // #600: the document and text nodes have no tag name.
    it("should skip nodes without a tag name when selecting", function () {
      const $nodes = $([document, document.createTextNode("text")]);

      const select = () => $nodes.selected();

      assert.doesNotThrow(select);
    });

    it("should leave controls that cannot be selected unchanged", function () {
      const input = $('<input type="text" value="x">')[0];

      $(input).selected(true);

      assert.strictEqual(input.checked, false);
      assert.strictEqual(input.selected, undefined);
    });

    it("should enable by default and disable when passed false", function () {
      const $input = $("<input disabled>");

      const enabled = $input.enable();
      const isEnabled = !$input.prop("disabled");
      const disabled = $input.enable(false);

      assert.strictEqual(enabled, $input);
      assert.strictEqual(isEnabled, true);
      assert.strictEqual(disabled, $input);
      assert.strictEqual($input.prop("disabled"), true);
    });

    it("should check and uncheck checkbox and radio controls", function () {
      const $controls = $('<div><input type="checkbox"><input type="radio"></div>').find("input");

      $controls.selected();
      const selected = $controls
        .map(function () {
          return this.checked;
        })
        .get();
      $controls.selected(false);

      assert.deepEqual(selected, [true, true]);
      assert.deepEqual(
        $controls
          .map(function () {
            return this.checked;
          })
          .get(),
        [false, false]
      );
    });

    it("should select one option while deselecting its single-select siblings", function () {
      const $select = $("<select><option selected>one</option><option>two</option></select>");
      const $options = $select.find("option");

      const result = $options.eq(1).selected();

      assert.strictEqual(result[0], $options[1]);
      assert.strictEqual($options.eq(0).prop("selected"), false);
      assert.strictEqual($options.eq(1).prop("selected"), true);
    });

    it("should independently select options in a multiple select", function () {
      const $options = $(
        "<select multiple><option selected>one</option><option>two</option></select>"
      ).find("option");

      $options.eq(1).selected();

      assert.deepEqual(
        $options
          .map(function () {
            return this.selected;
          })
          .get(),
        [true, true]
      );
    });
  });
});
