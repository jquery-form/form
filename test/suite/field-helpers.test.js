import { assert, describe, it } from "vitest";
import pluginExport from "../../src/jquery.form.js";
import { countHtmlParsed, resetFixture, selectFiles, withAjaxStub } from "./helpers.js";

// Records the change and input events that reach `root` while `run` executes.
function recordFieldEvents(root, run) {
  const events = [];
  const record = (event) => events.push(event.type);
  root.addEventListener("change", record, true);
  root.addEventListener("input", record, true);

  try {
    run();
  } finally {
    root.removeEventListener("change", record, true);
    root.removeEventListener("input", record, true);
  }

  return events;
}

function selectedStates($options) {
  return $options
    .map(function () {
      return this.selected;
    })
    .get();
}

describe("form", function () {
  resetFixture();

  describe("plugin installation", function () {
    it("should clear fields through clearInputs as clearFields does", function () {
      const $input = $('<input type="text" value="x">');

      const result = $input.clearInputs();

      assert.strictEqual(result.val(), "");
    });

    it("should turn debug logging off when the plugin loads", function () {
      const debug = $.fn.ajaxSubmit.debug;

      assert.strictEqual(debug, false);
    });

    it("should export the jQuery it registered on when src is imported", function () {
      const exported = pluginExport;

      assert.strictEqual(exported, $);
      assert.strictEqual(typeof exported.fn.ajaxSubmit, "function");
    });

    it("should keep the FormData transport when window.FormData is removed after load", function () {
      const $form = $('<form method="post"><input type="file" name="up"></form>').appendTo("#main");
      selectFiles($form.find("input")[0], ["a.txt"]);
      const formData = window.FormData;
      const ajax = $.ajax;
      let error;
      window.FormData = undefined;
      $.ajax = () => ({});

      try {
        $form.ajaxSubmit({ url: "ajax/text.html" });
      } catch (e) {
        error = e;
      } finally {
        window.FormData = formData;
        $.ajax = ajax;
      }

      assert.instanceOf(error, TypeError);
      assert.match(error.message, /FormData/);
    });
  });

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

    it("should reset every selected element after a label or a container", function () {
      const $label = $('<label><input value="in label"></label>').appendTo("#main");
      const $div = $('<div><input value="in div"></div>').appendTo("#main");
      const $last = $('<input value="last">').appendTo("#main");
      $("#main input").val("changed");

      $label.add($div).add($last).resetForm();

      assert.deepEqual(
        [$label.find("input").val(), $div.find("input").val(), $last.val()],
        ["in label", "in div", "last"]
      );
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

        const parsed = await countHtmlParsed("window.labelPayload", async () => {
          $label.resetForm();
          await new Promise((resolve) => setTimeout(resolve, 50));
        });

        assert.strictEqual(parsed, 0);
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

    it("should reset the form when a control named reset shadows the form method", function () {
      const $form = $('<form><input name="reset" value="default"></form>').appendTo("#main");
      $form.find("input").val("changed");

      $form.resetForm();

      assert.strictEqual($form.find("input").val(), "default");
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

    it("should return the original set and ignore arguments when resetting", function () {
      const $container = $('<div><input value="original"></div>');
      $container.find("input").val("changed");

      const result = $container.resetForm("ignored");

      assert.strictEqual(result, $container);
      assert.strictEqual($container.find("input").val(), "original");
    });

    it("should leave fields unchanged and return the set when a reset handler prevents the default", function () {
      const $form = $('<form><input value="original"></form>').appendTo("#main");
      $form.on("reset", (event) => event.preventDefault());
      $form.find("input").val("changed");

      const result = $form.resetForm();

      assert.strictEqual(result, $form);
      assert.strictEqual($form.find("input").val(), "changed");
    });

    it("should restore checked and value when an input is reset directly", function () {
      const $inputs = $(
        '<div><input type="checkbox" value="a" checked><input type="radio" value="b"></div>'
      ).find("input");
      $inputs.eq(0).prop("checked", false);
      $inputs.eq(1).prop("checked", true);

      $inputs.resetForm();

      assert.strictEqual($inputs.eq(0).prop("checked"), true);
      assert.strictEqual($inputs.eq(0).val(), "a");
      assert.strictEqual($inputs.eq(1).prop("checked"), false);
      assert.strictEqual($inputs.eq(1).val(), "b");
    });

    it("should keep a checkbox's value on when the checkbox is reset outside a form", function () {
      const $container = $('<div><input type="checkbox" name="c"></div>');

      $container.resetForm();

      assert.strictEqual($container.find("input").val(), "on");
    });

    it("should keep a submit input's default label when it is reset in a container", function () {
      const $container = $('<div><input type="submit"></div>');

      $container.resetForm();

      assert.isFalse($container.find("input")[0].hasAttribute("value"));
    });

    it("should not throw when a file input with a value attribute is reset", function () {
      const $file = $('<input type="file" value="x">');

      const reset = () => $file.resetForm();

      assert.doesNotThrow(reset);
    });

    it("should empty a selected file input when it is reset", function () {
      const $file = $('<input type="file">');
      selectFiles($file[0], ["a.txt"]);

      $file.resetForm();

      assert.strictEqual($file[0].files.length, 0);
    });

    it("should leave a hidden input's scripted value when it is reset", function () {
      const $hidden = $('<input type="hidden" value="original">');
      $hidden.val("scripted");

      $hidden.resetForm();

      assert.strictEqual($hidden.val(), "scripted");
    });

    it("should restore only that option when an option of a multiple select is reset", function () {
      const $options = $(
        "<select multiple><option selected>a</option><option>b</option></select>"
      ).find("option");
      $options.eq(0).prop("selected", false);
      $options.eq(1).prop("selected", true);

      $options.eq(0).resetForm();

      assert.deepEqual(selectedStates($options), [true, true]);
    });

    it("should reset the parent single select when an optgroup is reset", function () {
      const $select = $(
        "<select><optgroup><option>a</option><option selected>b</option></optgroup><option>c</option></select>"
      );
      $select.val("c");

      $select.find("optgroup").resetForm();

      assert.strictEqual($select.val(), "b");
    });

    it("should leave an option outside any select unchanged when it is reset", function () {
      const option = $('<datalist><option value="a"></option></datalist>').find("option")[0];
      option.selected = true;

      $(option).resetForm();

      assert.strictEqual(option.selected, true);
    });

    it("should select the last default option when a single select with two default options is reset", function () {
      const $select = $(
        "<select><option selected>a</option><option selected>b</option><option>c</option></select>"
      );
      $select.val("c");

      $select.resetForm();

      assert.strictEqual($select.val(), "b");
    });

    it("should select the first option of a dropdown and none of a list box when no option is a default", function () {
      const $dropdown = $("<select><option>a</option><option>b</option></select>");
      const $listBox = $('<select size="3"><option>a</option><option>b</option></select>');
      $dropdown.val("b");
      $listBox.val("b");

      $dropdown.add($listBox).resetForm();

      assert.strictEqual($dropdown.val(), "a");
      assert.strictEqual($listBox[0].selectedIndex, -1);
    });

    it("should restore every option when a multiple select is reset directly", function () {
      const $select = $(
        "<select multiple><option selected>a</option><option>b</option><option selected>c</option></select>"
      );
      const $options = $select.find("option");
      $options.prop("selected", false);
      $options.eq(1).prop("selected", true);

      $select.resetForm();

      assert.deepEqual(selectedStates($options), [true, false, true]);
    });

    it("should leave the inputs inside a non-control named by a label's for attribute unchanged", function () {
      const $owner = $('<div id="label-div"><input value="inner"></div>').appendTo("#main");
      const $label = $('<label for="label-div"></label>').appendTo("#main");
      $owner.find("input").val("changed");

      $label.resetForm();

      assert.strictEqual($owner.find("input").val(), "changed");
    });

    it("should reset the document's control when a detached label names it", function () {
      const $target = $('<input id="detached-label-target" value="default">').appendTo("#main");
      const $label = $('<label for="detached-label-target"></label>');
      $target.val("changed");

      $label.resetForm();

      assert.strictEqual($target.val(), "default");
    });

    it("should reset a control outside the container when a label inside names it", function () {
      const $outside = $('<input id="outside-label-target" value="default">').appendTo("#main");
      const $container = $('<div><label for="outside-label-target"></label></div>').appendTo(
        "#main"
      );
      $outside.val("changed");

      $container.resetForm();

      assert.strictEqual($outside.val(), "default");
    });

    it("should reset a control associated by the form attribute when its form is reset", function () {
      $('<form id="native-owner"></form><input form="native-owner" value="default">').appendTo(
        "#main"
      );
      const $outside = $("#main input[form=native-owner]").val("changed");

      $("#native-owner").resetForm();

      assert.strictEqual($outside.val(), "default");
    });

    it("should reset the form when two controls named reset shadow the method", function () {
      const $form = $(
        '<form><input name="reset" value="a"><input name="reset" value="b"></form>'
      ).appendTo("#main");
      $form.find("input").eq(0).val("changed");

      const reset = () => $form.resetForm();

      assert.doesNotThrow(reset);
      assert.strictEqual($form.find("input").eq(0).val(), "a");
    });

    it("should reset natively when a control named tagName shadows the form's tag name", function () {
      $(
        '<form id="tag-owner"><input name="tagName"></form><input form="tag-owner" value="default">'
      ).appendTo("#main");
      const $form = $("#tag-owner");
      const $outside = $("#main input[form=tag-owner]").val("changed");
      let resets = 0;
      $form.on("reset", () => resets++);

      $form.resetForm();

      assert.strictEqual(resets, 1);
      assert.strictEqual($outside.val(), "default");
    });

    it("should reset a nested form natively when a container is reset", function () {
      const $container = $('<div><form><input value="default"></form></div>').appendTo("#main");
      let resets = 0;
      $container.find("form").on("reset", () => resets++);
      $container.find("input").val("changed");

      $container.resetForm();

      assert.strictEqual(resets, 1);
      assert.strictEqual($container.find("input").val(), "default");
    });

    it("should still reset a nested form's controls when its reset event is cancelled and a container is reset", function () {
      const $container = $('<div><form><input value="default"></form></div>').appendTo("#main");
      $container.find("form").on("reset", (event) => event.preventDefault());
      $container.find("input").val("changed");

      $container.resetForm();

      assert.strictEqual($container.find("input").val(), "default");
    });

    it("should not throw when resetting the window", function () {
      const $window = $(window);

      const reset = () => $window.resetForm();

      assert.doesNotThrow(reset);
    });

    it("should not fire change or input events when resetting fields individually", function () {
      const $container = $(
        '<div><input value="a"><input type="checkbox" checked><select><option selected>a</option><option>b</option></select><textarea>t</textarea></div>'
      ).appendTo("#main");
      $container.find("input").eq(0).val("changed");
      $container.find("input").eq(1).prop("checked", false);
      $container.find("select").val("b");
      $container.find("textarea").val("changed");

      const events = recordFieldEvents($container[0], () => $container.resetForm());

      assert.deepEqual(events, []);
      assert.strictEqual($container.find("select").val(), "a");
    });

    it("should reset disabled and readonly fields", function () {
      const $fields = $('<div><input disabled value="a"><input readonly value="b"></div>').find(
        "input"
      );
      $fields.val("changed");

      $fields.resetForm();

      assert.strictEqual($fields.eq(0).val(), "a");
      assert.strictEqual($fields.eq(1).val(), "b");
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

    it("should return the original set when clearing forms, containers, inputs or empty sets", function () {
      const sets = [$("<form><input></form>"), $("<div><input></div>"), $("<input>"), $()];

      const results = sets.map(($set) => $set.clearForm());

      results.forEach((result, i) => assert.strictEqual(result, sets[i]));
    });

    it("should clear fields inside a non-form container", function () {
      const $container = $(
        '<div><input value="text"><textarea>text</textarea><input type="checkbox" checked></div>'
      );

      $container.clearForm();

      assert.strictEqual($container.find("input").eq(0).val(), "");
      assert.strictEqual($container.find("textarea").val(), "");
      assert.strictEqual($container.find("input").eq(1).prop("checked"), false);
    });

    it("should clear hidden inputs when clearForm is passed true or a selector", function () {
      const $all = $('<form><input type="hidden" value="a"></form>');
      const $some = $(
        '<form><input type="hidden" class="special" value="b"><input type="hidden" value="c"></form>'
      );

      $all.clearForm(true);
      $some.clearForm(".special");

      assert.strictEqual($all.find("input").val(), "");
      assert.strictEqual($some.find("input").eq(0).val(), "");
      assert.strictEqual($some.find("input").eq(1).val(), "c");
    });

    it("should leave an input unchanged when clearForm is called on the input itself", function () {
      const $input = $('<input value="kept">');

      $input.clearForm();

      assert.strictEqual($input.val(), "kept");
    });

    it("should leave a control associated by the form attribute unchanged when its form is cleared", function () {
      $('<form id="clear-owner"></form><input form="clear-owner" value="outside">').appendTo(
        "#main"
      );

      $("#clear-owner").clearForm();

      assert.strictEqual($("#main input[form=clear-owner]").val(), "outside");
    });

    it("should never clear button or output elements", function () {
      const $container = $('<div><button value="b">B</button><output>o</output></div>');

      $container.clearForm("button,output");

      assert.strictEqual($container.find("button").val(), "b");
      assert.strictEqual($container.find("output")[0].value, "o");
    });

    it("should clear every field on the page when called on the document and skip the window and text nodes", function () {
      const $input = $('<input value="page">').appendTo("#main");
      const $nodes = $([document, window, document.createTextNode("text")]);

      const clear = () => $nodes.clearForm();

      assert.doesNotThrow(clear);
      assert.strictEqual($input.val(), "");
    });

    it("should pass includeHidden to clearForm when ajaxSubmit clears the form", async function () {
      const $form = $(
        '<form action="ajax/text.html"><input type="hidden" value="h"></form>'
      ).appendTo("#main");

      await withAjaxStub(
        function (options) {
          options.success("ok", "success", {});
          return {};
        },
        async function () {
          $form.ajaxSubmit({ clearForm: true, includeHidden: true });
          await Promise.resolve();
        }
      );

      assert.strictEqual($form.find("input").val(), "");
    });

    it("should return the original set when clearing fields", function () {
      const $fields = $('<input value="a">');

      const result = $fields.clearFields();

      assert.strictEqual(result, $fields);
    });

    [
      ["date", "2024-01-02"],
      ["email", "a@example.com"],
      ["month", "2024-01"],
      ["number", "5"],
      ["password", "pw"],
      ["search", "s"],
      ["tel", "1"],
      ["text", "t"],
      ["time", "10:00"],
      ["url", "https://example.com/"],
      ["week", "2024-W01"],
    ].forEach(function ([type, value]) {
      it("should empty a " + type + " input when clearing fields", function () {
        const $input = $('<input type="' + type + '">').val(value);

        $input.clearFields();

        assert.strictEqual($input.val(), "");
      });
    });

    it("should leave range at its midpoint and color at black when they are cleared", function () {
      const $range = $('<input type="range" min="0" max="100" value="80">');
      const $color = $('<input type="color" value="#ff0000">');

      $range.add($color).clearFields();

      assert.strictEqual($range.val(), "50");
      assert.strictEqual($color.val(), "#000000");
    });

    it("should clear a datetime-local input", function () {
      const $input = $('<input type="datetime-local" value="2024-01-02T10:00">');

      $input.clearFields();

      assert.strictEqual($input.val(), "");
    });

    it("should empty a textarea", function () {
      const $textarea = $("<textarea>text</textarea>");

      $textarea.clearFields();

      assert.strictEqual($textarea.val(), "");
    });

    it("should deselect every option when a multiple select is cleared", function () {
      const $select = $(
        "<select multiple><option selected>a</option><option selected>b</option></select>"
      );

      $select.clearFields();

      assert.strictEqual($select[0].selectedIndex, -1);
      assert.deepEqual($select.val(), []);
    });

    it("should clear a selected file", function () {
      const input = $('<input type="file">')[0];
      selectFiles(input, ["a.txt"]);

      $(input).clearFields();

      assert.strictEqual(input.files.length, 0);
    });

    const buttonsAndHidden =
      '<div><input type="hidden" value="h"><input type="button" value="b"><input type="reset" value="r">' +
      '<input type="image" value="i"><input type="submit" value="s"><button value="bb">x</button></div>';

    function fieldValues($fields) {
      return $fields
        .map(function () {
          return this.value;
        })
        .get();
    }

    [
      ["undefined", undefined],
      ["false", false],
      ["0", 0],
      ["an empty string", ""],
      ["null", null],
    ].forEach(function ([label, includeHidden]) {
      it(
        "should leave hidden and button inputs and button elements unchanged when includeHidden is " +
          label,
        function () {
          const $fields = $(buttonsAndHidden).find("input,button");

          $fields.clearFields(includeHidden);

          assert.deepEqual(fieldValues($fields), ["h", "b", "r", "i", "s", "bb"]);
        }
      );
    });

    it("should clear only hidden inputs when includeHidden is true", function () {
      const $fields = $(buttonsAndHidden).find("input,button");

      $fields.clearFields(true);

      assert.deepEqual(fieldValues($fields), ["", "b", "r", "i", "s", "bb"]);
    });

    it("should clear a submit input and a button that match an includeHidden selector", function () {
      const $fields = $(buttonsAndHidden).find("input,button");
      $fields.filter("[type=submit],button").addClass("special");

      $fields.clearFields(".special");

      assert.deepEqual(fieldValues($fields), ["h", "b", "r", "i", "", ""]);
    });

    [
      ["a number", () => 1],
      ["an object", () => ({})],
      ["an element", () => document.createElement("input")],
      ["a jQuery set", () => $('<input type="hidden">')],
    ].forEach(function ([label, makeValue]) {
      it("should ignore includeHidden when it is " + label, function () {
        const $hidden = $('<input type="hidden" value="h">');
        const includeHidden = makeValue();

        $hidden.clearFields(includeHidden);

        assert.strictEqual($hidden.val(), "h");
      });
    });

    it("should throw a selector syntax error when includeHidden is not a valid selector", function () {
      const $hidden = $('<input type="hidden" value="h">');

      const clear = () => $hidden.clearFields("[");

      assert.throws(clear, /unrecognized expression/);
    });

    it("should set a value expando on a non-control that matches the includeHidden selector", function () {
      const div = $("<div></div>")[0];

      $(div).clearFields("div");

      assert.strictEqual(div.value, "");
    });

    it("should not fire change or input events when clearing", function () {
      const $container = $(
        '<div><input value="a"><input type="checkbox" checked><select><option selected>a</option></select><textarea>t</textarea></div>'
      ).appendTo("#main");

      const events = recordFieldEvents($container[0], () => $container.clearForm());

      assert.deepEqual(events, []);
      assert.strictEqual($container.find("textarea").val(), "");
    });

    it("should clear disabled and readonly fields", function () {
      const $fields = $('<div><input disabled value="a"><input readonly value="b"></div>').find(
        "input"
      );

      $fields.clearFields();

      assert.deepEqual(fieldValues($fields), ["", ""]);
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

    it("should disable for null, 0 and an empty string, and enable for the string false and 1", function () {
      const $input = $("<input>");

      const disabled = [null, 0, "", "false", 1].map(function (value) {
        $input.enable(value);
        return $input[0].disabled;
      });

      assert.deepEqual(disabled, [true, true, true, false, false]);
    });

    it("should toggle the disabled attribute on controls and only set an expando on a div", function () {
      const $controls = $(
        "<div><input><fieldset></fieldset><select><optgroup><option></option></optgroup></select></div>"
      ).find("input,fieldset,optgroup,option");
      const $div = $("<div></div>");

      $controls.add($div).enable(false);
      const added = $controls
        .map(function () {
          return this.hasAttribute("disabled");
        })
        .get();
      $controls.enable();

      assert.deepEqual(added, [true, true, true, true]);
      assert.strictEqual($controls.filter("[disabled]").length, 0);
      assert.strictEqual($div[0].disabled, true);
      assert.isFalse($div[0].hasAttribute("disabled"));
    });

    it("should not fire events when enabling or disabling", function () {
      const $container = $("<div><input></div>").appendTo("#main");

      const events = recordFieldEvents($container[0], function () {
        $container.find("input").enable(false).enable();
      });

      assert.deepEqual(events, []);
    });

    it("should return the original set when selecting", function () {
      const $checkbox = $('<input type="checkbox">');

      const result = $checkbox.selected();

      assert.strictEqual(result, $checkbox);
    });

    it("should check a checkbox when passed the string false and uncheck it for 0 and null", function () {
      const $checkbox = $('<input type="checkbox">');

      const checked = ["false", 0, "x", null].map(function (value) {
        $checkbox.selected(value);
        return $checkbox[0].checked;
      });

      assert.deepEqual(checked, [true, false, true, false]);
    });

    it("should leave the last radio of a group checked when several are selected", function () {
      const $radios = $(
        '<div><input type="radio" name="fld-group"><input type="radio" name="fld-group"></div>'
      )
        .appendTo("#main")
        .find("input");

      $radios.selected();

      assert.deepEqual(
        $radios
          .map(function () {
            return this.checked;
          })
          .get(),
        [false, true]
      );
    });

    it("should leave only the chosen option selected when it is inside an optgroup of a single select", function () {
      const $options = $(
        "<select><optgroup><option selected>a</option><option>b</option></optgroup></select>"
      ).find("option");

      $options.eq(1).selected();

      assert.deepEqual(selectedStates($options), [false, true]);
    });

    it("should fall back to the first option when the selected option of a dropdown is deselected", function () {
      const $options = $("<select><option>a</option><option selected>b</option></select>").find(
        "option"
      );

      $options.eq(1).selected(false);
      const afterSecond = selectedStates($options);
      $options.eq(0).selected(false);

      assert.deepEqual(afterSecond, [true, false]);
      assert.deepEqual(selectedStates($options), [true, false]);
    });

    it("should set selected on an option that has no parent select", function () {
      const option = $('<datalist><option value="a"></option></datalist>').find("option")[0];

      $(option).selected();

      assert.strictEqual(option.selected, true);
    });

    it("should not fire change events when selecting", function () {
      const $container = $(
        '<div><input type="checkbox"><select><option>a</option><option>b</option></select></div>'
      ).appendTo("#main");

      const events = recordFieldEvents($container[0], function () {
        $container.find("input").selected();
        $container.find("option").eq(1).selected();
      });

      assert.deepEqual(events, []);
    });
  });
});
