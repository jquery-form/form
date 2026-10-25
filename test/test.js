/* global scriptCount */

import { assert, beforeAll, beforeEach, describe, it, vi } from "vitest";

// helper method
var arrayCount = function (arr, key) {
  var count = 0;
  for (var i = 0; i < arr.length; i++) {
    if (arr[i].name === key) {
      count++;
    }
  }
  return count;
};

// helper method
var arrayValue = function (arr, key) {
  for (var i = 0; i < arr.length; i++) {
    if (arr[i].name === key) {
      return arr[i].value;
    }
  }
  return undefined;
};

var fixture;

describe("form", function () {
  beforeAll(function () {
    fixture = $("#main").html();
  });

  beforeEach(function () {
    $("#main").html(fixture);
  });

  // Starts a submit via `trigger` (which must use `opts`) and resolves once the request settles.
  // Resolves with what the callbacks saw, so the test can assert on it after the awaited act.
  function submitAndSettle(opts, trigger) {
    const seen = { beforeSubmit: null, success: null, error: null };

    return new Promise(function (resolve) {
      const userBeforeSubmit = opts.beforeSubmit;
      opts.beforeSubmit = function (data, $form) {
        seen.beforeSubmit = { data: data, $form: $form };
        return userBeforeSubmit ? userBeforeSubmit.apply(this, arguments) : undefined;
      };
      opts.success = function () {
        seen.success = Array.prototype.slice.call(arguments);
        resolve(seen);
      };
      opts.error = function () {
        seen.error = Array.prototype.slice.call(arguments);
        resolve(seen);
      };
      trigger();
    });
  }

  // Submits through a stubbed $.ajax and returns the settings it received.
  function captureAjaxOptions($form, options, respond) {
    const ajax = $.ajax;
    let settings;
    $.ajax = function (received) {
      settings = received;
      if (respond) {
        respond(received);
      }
      return {};
    };

    try {
      $form.ajaxSubmit(options);
    } finally {
      $.ajax = ajax;
    }

    return settings;
  }

  function withUserAgent(userAgent, run) {
    Object.defineProperty(navigator, "userAgent", { configurable: true, value: userAgent });

    try {
      return run();
    } finally {
      delete navigator.userAgent;
    }
  }

  async function withAjaxStub(stub, run) {
    const ajax = $.ajax;
    $.ajax = stub;

    try {
      return await run();
    } finally {
      $.ajax = ajax;
    }
  }

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

  describe("resetForm", function () {
    // jQuery collections have no unshift, so a matching for target throws a TypeError.
    it.fails("should reset the control a label targets and its nested fields", function () {
      const $target = $('<input id="label-target" value="default">').appendTo("#main");
      const $label = $('<label for="#label-target"><input value="nested"></label>').appendTo(
        "#main"
      );
      $target.val("changed");
      $label.find("input").val("changed");

      $label.resetForm();

      assert.strictEqual($target.val(), "default");
      assert.strictEqual($label.find("input").val(), "nested");
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

  describe("fieldValue", function () {
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

      assert.strictEqual(result, "choice=a%20b&choice=c");
    });
  });

  describe("debug logging", function () {
    function logWithDebug(globals) {
      const saved = {};
      Object.keys(globals).forEach(function (name) {
        saved[name] = Object.getOwnPropertyDescriptor(window, name);
        Object.defineProperty(window, name, {
          configurable: true,
          writable: true,
          value: globals[name],
        });
      });
      $.fn.ajaxSubmit.debug = true;

      try {
        $(".missing-form").ajaxSubmit();
      } finally {
        $.fn.ajaxSubmit.debug = false;
        Object.keys(globals).forEach(function (name) {
          if (saved[name]) {
            Object.defineProperty(window, name, saved[name]);
          } else {
            delete window[name];
          }
        });
      }
    }

    const message = "[jquery.form] ajaxSubmit: skipping submit process - no element selected";

    it("should write to console.log when debug is enabled", function () {
      const logged = [];

      logWithDebug({ console: { log: (text) => logged.push(text) } });

      assert.deepEqual(logged, [message]);
    });

    it("should fall back to opera.postError without console.log", function () {
      const posted = [];

      logWithDebug({ console: {}, opera: { postError: (text) => posted.push(text) } });

      assert.deepEqual(posted, [message]);
    });

    it("should stay silent without any logging target", function () {
      const run = () => logWithDebug({ console: undefined, opera: {} });

      assert.doesNotThrow(run);
    });

    it("should stay silent when debug is disabled", function () {
      const logged = [];
      const log = console.log;
      console.log = (text) => logged.push(text);

      try {
        $(".missing-form").ajaxSubmit();
      } finally {
        console.log = log;
      }

      assert.deepEqual(logged, []);
    });
  });

  describe("enable and selected", function () {
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

  describe("ajaxSubmit", function () {
    describe("FormData uploads", function () {
      function appendUploadForm(attributes) {
        const $form = $(
          '<form action="ajax/upload" method="post">' +
            '<input name="title" value="quarterly report">' +
            '<input type="file" name="document">' +
            "</form>"
        ).attr(attributes || {});
        const transfer = new DataTransfer();
        const file = new File(["upload contents"], "report.txt", { type: "text/plain" });
        transfer.items.add(file);
        $form.find('[type="file"]')[0].files = transfer.files;
        $form.appendTo("#main");

        return { $form: $form, file: file };
      }

      it("should use FormData for a real selected file and preserve request settings", async function () {
        const upload = appendUploadForm();
        const context = { source: "upload test" };
        const seen = {};

        await withAjaxStub(
          function (settings) {
            seen.settings = settings;
            const requestSettings = { data: settings.data };
            settings.beforeSend.call(context, { readyState: 0 }, requestSettings);
            seen.data = requestSettings.data;
            return { readyState: 1 };
          },
          async function () {
            upload.$form.ajaxSubmit({
              method: "put",
              data: {
                metadata: { owner: "Ada Lovelace" },
                labels: ["urgent", "external"],
              },
              beforeSend: function (xhr, settings) {
                seen.beforeSend = { context: this, xhr: xhr, settings: settings };
              },
            });
            await Promise.resolve();

            assert.strictEqual(
              seen.settings.contentType,
              false,
              "lets the browser set content type"
            );
            assert.strictEqual(seen.settings.processData, false, "does not process FormData");
            assert.strictEqual(seen.settings.cache, false, "disables request caching");
            assert.strictEqual(seen.settings.type, "put", "uses the requested method");
            assert.strictEqual(seen.settings.data, null, "does not expose an interim request body");
            assert.ok(seen.data instanceof FormData, "sends FormData");
            assert.strictEqual(
              seen.data.get("title"),
              "quarterly report",
              "includes text controls"
            );
            assert.strictEqual(
              seen.data.get("document"),
              upload.file,
              "includes the selected File"
            );
            assert.strictEqual(
              seen.data.get("metadata[owner]"),
              "Ada Lovelace",
              "deeply serializes objects"
            );
            assert.deepEqual(
              seen.data.getAll("labels[]"),
              ["urgent", "external"],
              "serializes arrays"
            );
            assert.strictEqual(seen.beforeSend.context, context, "preserves callback context");
            assert.strictEqual(
              seen.beforeSend.settings.data,
              seen.data,
              "runs after assigning FormData"
            );
          }
        );
      });

      it("should select the FormData transport for a multipart form without a file", async function () {
        const $form = $(
          '<form action="ajax/upload" method="post" enctype="multipart/form-data">' +
            '<input name="title" value="multipart only">' +
            "</form>"
        ).appendTo("#main");
        let settings;
        let body;

        await withAjaxStub(
          function (options) {
            settings = options;
            const requestSettings = {};
            options.beforeSend({}, requestSettings);
            body = requestSettings.data;
            return {};
          },
          async function () {
            $form.ajaxSubmit();
            await Promise.resolve();

            assert.strictEqual(settings.contentType, false, "selects the upload request settings");
            assert.ok(body instanceof FormData, "builds FormData");
            assert.strictEqual(body.get("title"), "multipart only", "includes form controls");
          }
        );
      });

      it("should send caller-provided FormData instead of generated form contents", async function () {
        const upload = appendUploadForm();
        const customData = new FormData();
        customData.append("replacement", "custom body");
        let body;

        await withAjaxStub(
          function (options) {
            const requestSettings = {};
            options.beforeSend({}, requestSettings);
            body = requestSettings.data;
            return {};
          },
          async function () {
            upload.$form.ajaxSubmit({ formData: customData });
            await Promise.resolve();

            assert.strictEqual(body, customData, "uses the provided object");
            assert.strictEqual(body.get("replacement"), "custom body", "preserves custom contents");
            assert.strictEqual(body.has("document"), false, "does not merge generated contents");
          }
        );
      });

      it("should report computable and noncomputable upload progress", async function () {
        const upload = appendUploadForm();
        const originalXhr = $.ajaxSettings.xhr;
        const progress = [];
        let progressListener;
        $.ajaxSettings.xhr = function () {
          return {
            upload: {
              addEventListener: function (name, listener) {
                assert.strictEqual(name, "progress", "subscribes to progress");
                progressListener = listener;
              },
            },
          };
        };

        try {
          await withAjaxStub(
            function (options) {
              options.xhr();
              return {};
            },
            async function () {
              upload.$form.ajaxSubmit({
                uploadProgress: function (event, position, total, percent) {
                  progress.push({
                    event: event,
                    position: position,
                    total: total,
                    percent: percent,
                  });
                },
              });
              await Promise.resolve();

              progressListener({ lengthComputable: true, loaded: 25, total: 40 });
              progressListener({ lengthComputable: false, loaded: 7, total: 0 });
              progressListener({ lengthComputable: true, loaded: 0, position: 3, total: 4 });

              assert.deepEqual(
                progress.map(function (entry) {
                  return [entry.position, entry.total, entry.percent];
                }),
                [
                  [25, 40, 63],
                  [7, 0, 0],
                  [3, 4, 75],
                ]
              );
              assert.strictEqual(progress[0].event.loaded, 25, "passes the native event");
            }
          );
        } finally {
          $.ajaxSettings.xhr = originalXhr;
        }
      });

      it("should return an XHR when upload progress events are unavailable", async function () {
        const upload = appendUploadForm();
        const originalXhr = $.ajaxSettings.xhr;
        const xhr = { readyState: 0 };
        let createdXhr;
        $.ajaxSettings.xhr = function () {
          return xhr;
        };

        try {
          await withAjaxStub(
            function (options) {
              createdXhr = options.xhr();
              return {};
            },
            async function () {
              upload.$form.ajaxSubmit({ uploadProgress: function () {} });
              await Promise.resolve();

              assert.strictEqual(createdXhr, xhr, "returns the configured XHR");
            }
          );
        } finally {
          $.ajaxSettings.xhr = originalXhr;
        }
      });
    });

    describe("non-upload options", function () {
      it("should return an empty selection without starting a request", async function () {
        let requests = 0;
        const $empty = $(".missing-form");

        await withAjaxStub(
          function () {
            requests++;
          },
          async function () {
            const result = $empty.ajaxSubmit();
            await Promise.resolve();

            assert.strictEqual(result, $empty, "returns the original selection");
            assert.strictEqual(requests, 0, "does not request");
          }
        );
      });

      it("should accept the url, data, dataType and success shorthand arguments", async function () {
        const extraData = { source: "shorthand" };
        let ajaxOptions;
        let successData;

        await withAjaxStub(
          function (options) {
            ajaxOptions = options;
            options.success("ok", "success", {});
            return {};
          },
          async function () {
            $("#form3").ajaxSubmit("ajax/shorthand.html", extraData, "text", function (data) {
              successData = data;
            });
            await Promise.resolve();

            assert.strictEqual(ajaxOptions.url, "ajax/shorthand.html", "url");
            assert.strictEqual(ajaxOptions.dataType, "text", "dataType");
            assert.ok(ajaxOptions.data.includes("source=shorthand"), "extra data");
            assert.strictEqual(successData, "ok", "success callback");
          }
        );
      });

      [
        [false, false],
        [undefined, "ajax/text.html"],
      ].forEach(function ([value, expectedUrl]) {
        it("should normalize the url when options are " + String(value), async function () {
          let ajaxOptions;

          await withAjaxStub(
            function (options) {
              ajaxOptions = options;
              return {};
            },
            async function () {
              $("#form3").ajaxSubmit(value);
              await Promise.resolve();

              if (expectedUrl === false) {
                assert.strictEqual(ajaxOptions.url, false, "explicit false url");
              } else {
                assert.ok(ajaxOptions.url.endsWith(expectedUrl), "form action");
              }
            }
          );
        });
      });

      it("should allow form-pre-serialize to veto before serialization", async function () {
        let requests = 0;
        let serialized = false;
        const $form = $("#form3");
        const formToArray = $form.formToArray;
        $form.one("form-pre-serialize", function (_event, _form, _options, veto) {
          veto.veto = true;
        });
        $form.formToArray = function () {
          serialized = true;
          return formToArray.apply(this, arguments);
        };

        try {
          await withAjaxStub(
            function () {
              requests++;
            },
            async function () {
              $form.ajaxSubmit();
              await Promise.resolve();

              assert.strictEqual(serialized, false, "does not serialize");
              assert.strictEqual(requests, 0, "does not request");
            }
          );
        } finally {
          $form.formToArray = formToArray;
          $form.off("form-pre-serialize");
        }
      });

      it("should allow beforeSerialize to veto the request", async function () {
        let requests = 0;
        let callbackForm;
        const opts = {
          beforeSerialize: function ($form) {
            callbackForm = $form;
            return false;
          },
        };

        await withAjaxStub(
          function () {
            requests++;
          },
          async function () {
            const $form = $("#form3");
            $form.ajaxSubmit(opts);
            await Promise.resolve();

            assert.strictEqual(callbackForm, $form, "callback form");
            assert.strictEqual(requests, 0, "does not request");
          }
        );
      });

      it("should allow form-submit-validate to veto the request", async function () {
        let requests = 0;
        let submittedData;
        const $form = $("#form3");
        $form.one("form-submit-validate", function (_event, data, _form, _options, veto) {
          submittedData = data;
          veto.veto = true;
        });

        try {
          await withAjaxStub(
            function () {
              requests++;
            },
            async function () {
              $form.ajaxSubmit();
              await Promise.resolve();

              assert.ok(Array.isArray(submittedData), "validation receives form data");
              assert.strictEqual(requests, 0, "does not request");
            }
          );
        } finally {
          $form.off("form-submit-validate");
        }
      });

      [
        ["object", { source: "object" }],
        [
          "function",
          function (formData) {
            assert.ok(Array.isArray(formData), "function receives form data");
            return { source: "function" };
          },
        ],
      ].forEach(function ([label, data]) {
        it("should append extra data supplied as an " + label, async function () {
          let ajaxOptions;

          await withAjaxStub(
            function (options) {
              ajaxOptions = options;
              return {};
            },
            async function () {
              $("#form3").ajaxSubmit({ data: data, type: "post" });
              await Promise.resolve();

              assert.ok(ajaxOptions.data.includes("source=" + label), "serialized extra data");
              assert.deepEqual(ajaxOptions.extraData, { source: label }, "retains extra data");
            }
          );
        });
      });

      it("should append serialized data to a GET url and clear the request body", async function () {
        let ajaxOptions;

        await withAjaxStub(
          function (options) {
            ajaxOptions = options;
            return {};
          },
          async function () {
            $("#form3").ajaxSubmit({ type: "get", url: "ajax/text.html?existing=1" });
            await Promise.resolve();

            assert.ok(ajaxOptions.url.includes("?existing=1&"), "preserves existing query");
            assert.ok(ajaxOptions.url.includes("a="), "appends form data");
            assert.strictEqual(ajaxOptions.data, null, "clears request body");
          }
        );
      });

      it("should put serialized data in the POST request body", async function () {
        let ajaxOptions;

        await withAjaxStub(
          function (options) {
            ajaxOptions = options;
            return {};
          },
          async function () {
            $("#form3").ajaxSubmit({ type: "post" });
            await Promise.resolve();

            assert.strictEqual(ajaxOptions.type, "post", "request method");
            assert.ok(ajaxOptions.data.includes("a="), "request body");
          }
        );
      });

      it("should reset and clear the form before running success", async function () {
        const $form = $("#form3");
        const $name = $form.find("[name=a]");
        const seen = [];
        $name.val("changed");

        await withAjaxStub(
          function (options) {
            options.success("ok", "success", {});
            return {};
          },
          async function () {
            $form.ajaxSubmit({
              resetForm: true,
              clearForm: true,
              success: function () {
                seen.push($name.val());
              },
            });
            await Promise.resolve();

            assert.deepEqual(seen, [""], "maintenance callbacks precede success");
          }
        );
      });

      it("should replace the target and call success with the replacement as context", async function () {
        const $target = $("#targetDiv").html("old");
        let callbackContext;

        await withAjaxStub(
          function (options) {
            options.success("<div id='replacement'>new</div>", "success", {});
            return {};
          },
          async function () {
            $("#form3").ajaxSubmit({
              target: $target,
              replaceTarget: true,
              success: function () {
                callbackContext = this;
              },
            });
            await Promise.resolve();

            assert.strictEqual($("#targetDiv").length, 0, "removes old target");
            assert.strictEqual($("#replacement").text(), "new", "inserts response");
            assert.strictEqual(callbackContext.id, "targetDiv", "original target context");
          }
        );
      });

      it("should run a success callback array with the configured context and form", async function () {
        const context = { name: "callback context" };
        const calls = [];
        const $form = $("#form3");

        await withAjaxStub(
          function (options) {
            options.success("ok", "success", {});
            return {};
          },
          async function () {
            $form.ajaxSubmit({
              context: context,
              success: [
                function (_data, _status, _xhr, callbackForm) {
                  calls.push({ context: this, form: callbackForm });
                },
                function (_data, _status, _xhr, callbackForm) {
                  calls.push({ context: this, form: callbackForm });
                },
              ],
            });
            await Promise.resolve();

            assert.strictEqual(calls.length, 2, "all success callbacks");
            assert.strictEqual(calls[0].context.name, context.name, "first context");
            assert.strictEqual(calls[1].context, calls[0].context, "shared context");
            assert.strictEqual(calls[0].form, $form, "form argument");
          }
        );
      });

      it("should wrap error and complete with context and the form argument", async function () {
        const context = { name: "callback context" };
        const xhr = { status: 500 };
        const seen = {};
        const $form = $("#form3");

        await withAjaxStub(
          function (options) {
            options.error(xhr, "error", "broken");
            options.complete(xhr, "error");
            return xhr;
          },
          async function () {
            $form.ajaxSubmit({
              context: context,
              error: function () {
                seen.error = { context: this, args: Array.from(arguments) };
              },
              complete: function () {
                seen.complete = { context: this, args: Array.from(arguments) };
              },
            });
            await Promise.resolve();

            assert.strictEqual(seen.error.context.name, context.name, "error context");
            assert.deepEqual(seen.error.args, [xhr, "error", "broken", $form], "error arguments");
            assert.strictEqual(seen.complete.context, seen.error.context, "complete context");
            assert.deepEqual(seen.complete.args, [xhr, "error", $form], "complete arguments");
          }
        );
      });

      it("should store the jqXHR and notify listeners after starting the request", async function () {
        const jqXHR = { readyState: 1 };
        let notified;
        const $form = $("#form3");
        $form.one("form-submit-notify", function (_event, form, options) {
          notified = { form: form, options: options, stored: $form.data("jqxhr") };
        });

        try {
          await withAjaxStub(
            function () {
              return jqXHR;
            },
            async function () {
              const opts = { type: "post" };
              $form.ajaxSubmit(opts);
              await Promise.resolve();

              assert.strictEqual($form.data("jqxhr"), jqXHR, "stored jqXHR");
              assert.strictEqual(notified.form, $form, "notified form");
              assert.strictEqual(notified.stored, jqXHR, "stores before notify");
              assert.strictEqual(notified.options.type, "post", "notified options");
            }
          );
        } finally {
          $form.off("form-submit-notify").removeData("jqxhr");
        }
      });
    });

    describe("target", function () {
      it("should load the response into a target given as a selector", async function () {
        $("#targetDiv").empty();
        const opts = { target: "#targetDiv" };

        const seen = await submitAndSettle(opts, () => $("#form3").ajaxSubmit(opts));

        assert.ok(seen.success, "post-callback");
        assert.ok($("#targetDiv").text().match("Lorem ipsum"), "targetDiv updated");
      });

      it("should load the response into a target given as a jQuery object", async function () {
        const $target = $("#targetDiv");
        $target.empty();
        const opts = { target: $target };

        const seen = await submitAndSettle(opts, () => $("#form2").ajaxSubmit(opts));

        assert.ok(seen.success, "post-callback");
        assert.ok($("#targetDiv").text().match("Lorem ipsum"), "targetDiv updated");
      });

      it("should load the response into a target given as a DOM element", async function () {
        $("#targetDiv").empty();
        const opts = { target: $("#targetDiv")[0] };

        const seen = await submitAndSettle(opts, () => $("#form2").ajaxSubmit(opts));

        assert.ok(seen.success, "post-callback");
        assert.ok($("#targetDiv").text().match("Lorem ipsum"), "targetDiv updated");
      });

      it("should run each script of a loaded document exactly once", async function () {
        $("#targetDiv").empty();
        const opts = {
          target: "#targetDiv",
          url: "ajax/doc-with-scripts.html?" + new Date().getTime(),
        };

        const seen = await submitAndSettle(opts, () => $("#form2").ajaxSubmit(opts));

        assert.ok(seen.success, "success-callback");
        assert.ok($("#targetDiv").text().match("Lorem ipsum"), "targetDiv updated");
        assert.ok(typeof unitTestVariable1 != "undefined", "first script block executed");
        assert.ok(typeof unitTestVariable2 != "undefined", "second script block executed");
        assert.ok(typeof scriptCount != "undefined", "third script block executed");
        assert.ok(scriptCount == 1, "scripts executed once: " + scriptCount);
      });
    });

    describe("callbacks", function () {
      it("should call beforeSubmit with the field array and the form", async function () {
        const opts = {};

        const seen = await submitAndSettle(opts, () => $("#form3").ajaxSubmit(opts));

        assert.ok(seen.beforeSubmit, "pre-submit callback");
        assert.ok(seen.beforeSubmit.data.constructor == Array, "type check array");
        assert.ok(seen.beforeSubmit.$form.jquery, "type check jQuery");
        assert.ok(
          seen.beforeSubmit.$form[0].tagName.toLowerCase() == "form",
          'jQuery arg == "form": ' + seen.beforeSubmit.$form[0].tagName.toLowerCase()
        );
      });

      it("should call success with the response text and status text", async function () {
        const opts = {};

        const seen = await submitAndSettle(opts, () => $("#form3").ajaxSubmit(opts));

        assert.ok(seen.success, "post-submit callback");
        assert.ok(seen.success[0].match("Lorem ipsum"), "responseText");
        assert.ok(seen.success[1] == "success", "statusText");
      });

      it("should treat a function argument as the success callback", async function () {
        let called = false;

        await new Promise(function (resolve) {
          $("#form3").ajaxSubmit(function () {
            called = true;
            resolve();
          });
        });

        assert.ok(called, "callback hit");
      });

      it("should call beforeSubmit with fields in document order when semantic is true", async function () {
        const testData = ["a", "b", "c", "d", "e", "f"];
        const opts = { semantic: true };

        const seen = await submitAndSettle(opts, () => $("#form2").ajaxSubmit(opts));

        assert.ok(seen.beforeSubmit, "pre-submit callback");
        assert.ok(seen.beforeSubmit.data.constructor == Array, "type check");
        assert.ok(seen.beforeSubmit.$form.jquery, "type check jQuery");
        for (let i = 0; i < seen.beforeSubmit.data.length; i++) {
          assert.ok(seen.beforeSubmit.data[i].name == testData[i], "match value at index=" + i);
        }
      });

      it("should not send the request when beforeSubmit returns false", function () {
        const seen = { beforeSubmit: null, success: false };
        const opts = {
          beforeSubmit: function (a, jq) {
            seen.beforeSubmit = { data: a, $form: jq };
            return false;
          },
          success: function () {
            seen.success = true;
          },
        };

        $("#form3").ajaxSubmit(opts);

        assert.ok(seen.beforeSubmit, "pre-submit callback");
        assert.ok(seen.beforeSubmit.data.constructor == Array, "type check");
        assert.ok(seen.beforeSubmit.$form.jquery, "type check jQuery");
        assert.ok(!seen.success, "should not hit this post-submit callback");
      });

      it("should call success when the request succeeds", async function () {
        $("#targetDiv").empty();
        const opts = {};

        const seen = await submitAndSettle(opts, () => $("#form3").ajaxSubmit(opts));

        assert.ok(seen.success, "post-callback");
      });

      it("should call error and not success when the request fails", async function () {
        $("#targetDiv").empty();
        const opts = { url: "ajax/404.html" };

        const seen = await submitAndSettle(opts, () => $("#form3").ajaxSubmit(opts));

        assert.ok(seen.error, "error-callback");
        assert.ok(!seen.success, "should not hit post-submit callback");
      });

      it("should pass status, xhr and the form to success", async function () {
        $("#targetDiv").empty();
        const opts = {};
        let $testForm;

        const seen = await submitAndSettle(opts, () => {
          $testForm = $("#form3").ajaxSubmit(opts);
        });

        assert.ok(seen.success, "success callback invoked");
        assert.ok(seen.success[1] === "success", "status === success");
        assert.ok(typeof seen.success[2] != "undefined", "third arg: " + typeof seen.success[2]);
        assert.ok(!!seen.success[2] != false, "xhr != false");
        assert.ok(seen.success[2].status, "xhr.status == " + seen.success[2].status);
        assert.ok(seen.success[3] === $testForm, "$form param is valid");
      });

      it("should call success with a success status when forceSync is true", async function () {
        $("#targetDiv").empty();
        const opts = { forceSync: true };

        const seen = await submitAndSettle(opts, () => $("#form3").ajaxSubmit(opts));

        assert.ok(seen.success, "success callback invoked");
        assert.ok(seen.success[1] === "success", "status === success");
      });
    });

    describe("iframe upload transport", function () {
      function createIframeForm(action) {
        return $('<form method="post"><input name="upload" value="yes"></form>')
          .attr("action", action)
          .appendTo("#main");
      }

      function submitThroughIframe($form, options) {
        return new Promise(function (resolve) {
          const result = { events: [] };
          const settings = $.extend({}, options, {
            iframe: true,
            success: function () {
              result.success = Array.from(arguments);
              result.events.push("success");
            },
            error: function () {
              result.error = Array.from(arguments);
              result.events.push("error");
            },
            complete: function () {
              result.complete = Array.from(arguments);
              result.events.push("complete");
              resolve(result);
            },
          });

          $form.ajaxSubmit(settings);
          result.xhr = $form.data("jqxhr");
        });
      }

      function inspectNativeSubmit($form, inspect) {
        const form = $form[0];
        const nativeSubmit = form.submit;
        form.submit = function () {
          inspect(form);
          delete form.submit;
          nativeSubmit.call(form);
        };
      }

      it("should submit through a generated iframe and clean it up", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");
        const initialFrames = $("iframe").length;

        const result = await submitThroughIframe($form, { forceSync: true, dataType: "text" });
        await new Promise((resolve) => setTimeout(resolve, 150));

        assert.strictEqual(result.success[0].trim(), "iframe response");
        assert.strictEqual(result.success[1], "success");
        assert.strictEqual(result.success[2].status, 201);
        assert.deepEqual(result.events, ["success", "complete"]);
        assert.strictEqual($("iframe").length, initialFrames);
      });

      it("should use and reset a supplied iframe target", async function () {
        const $target = $('<iframe name="provided-frame"></iframe>').appendTo("#main");
        const $form = createIframeForm("ajax/iframe-text.html");

        const result = await submitThroughIframe($form, {
          iframeTarget: $target,
          dataType: "text",
        });
        await new Promise((resolve) => setTimeout(resolve, 150));

        assert.strictEqual(result.success[0].trim(), "iframe response");
        assert.strictEqual($target.attr("name"), "provided-frame");
        assert.strictEqual($target.attr("src"), "about:blank");
        assert.strictEqual($target.parent().length, 1);
      });

      it("should name a supplied iframe target that has no name", function () {
        const $target = $("<iframe></iframe>").appendTo("#main");
        const $form = createIframeForm("ajax/iframe-text.html");

        $form.ajaxSubmit({
          iframe: true,
          iframeTarget: $target,
          beforeSend: function () {
            return false;
          },
        });

        assert.match($target.attr("name"), /^jqFormIO\d+$/);
      });

      it("should reject when beforeSend aborts the iframe request", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");
        let xhr;

        $form.ajaxSubmit({
          iframe: true,
          beforeSend: function (request) {
            xhr = request;
            request.abort("early");
          },
        });
        const deferred = $form.data("jqxhr");
        const rejected = await new Promise((resolve) => deferred.fail(() => resolve(true)));

        assert.strictEqual(rejected, true);
        assert.strictEqual(xhr.error, "aborted");
        assert.strictEqual(xhr.aborted, 1);
      });

      it("should submit clicked image values and coordinates as hidden inputs", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");
        const image = $('<input type="image" name="map" value="go">').appendTo($form)[0];
        const submitted = {};
        $form[0].clk = image;
        $form[0].clk_x = 12;
        $form[0].clk_y = 34;
        inspectNativeSubmit($form, function (form) {
          $(form)
            .find('input[type="hidden"]')
            .each(function () {
              submitted[this.name] = this.value;
            });
        });

        await submitThroughIframe($form, { dataType: "text" });

        assert.deepEqual(submitted, { map: "go", "map.x": "12", "map.y": "34" });
      });

      it("should submit CSRF metadata and remove its temporary input", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");
        const $token = $('<meta name="csrf-token" content="secret">').appendTo(document.head);
        const $param = $('<meta name="csrf-param" content="authenticity_token">').appendTo(
          document.head
        );
        let submittedToken;
        inspectNativeSubmit($form, function (form) {
          submittedToken = $(form).find('[name="authenticity_token"]').val();
        });

        try {
          await submitThroughIframe($form, { dataType: "text" });

          assert.strictEqual(submittedToken, "secret");
          assert.strictEqual($form.find('[name="authenticity_token"]').length, 0);
        } finally {
          $token.remove();
          $param.remove();
        }
      });

      it("should override the action during submission and then restore it", async function () {
        const $form = createIframeForm("ajax/original.html");
        let submittedAction;
        inspectNativeSubmit($form, function (form) {
          submittedAction = form.getAttribute("action");
        });

        await submitThroughIframe($form, { url: "ajax/iframe-text.html", dataType: "text" });

        assert.ok(submittedAction.endsWith("ajax/iframe-text.html"));
        assert.ok($form.attr("action").endsWith("ajax/original.html"));
      });

      it("should submit both extraData representations and remove temporary inputs", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");
        const submitted = {};
        inspectNativeSubmit($form, function (form) {
          $(form)
            .find('input[type="hidden"]')
            .each(function () {
              submitted[this.name] = this.value;
            });
        });

        await submitThroughIframe($form, {
          data: {
            plain: "value",
            aliased: { name: "actual", value: "represented" },
          },
          dataType: "text",
        });

        assert.deepEqual(submitted, { plain: "value", actual: "represented" });
        assert.strictEqual($form.find('input[type="hidden"]').length, 0);
      });

      it("should fall back to native submission when a control shadows form.submit", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");
        $('<input name="submit" value="shadow">').appendTo($form);

        const result = await submitThroughIframe($form, { dataType: "text" });

        assert.strictEqual(result.success[0].trim(), "iframe response");
      });

      it("should restore an original form target after submission", async function () {
        const $form = createIframeForm("ajax/iframe-text.html").attr("target", "original-target");

        await submitThroughIframe($form, { dataType: "text" });

        assert.strictEqual($form.attr("target"), "original-target");
      });

      it("should wait for closeKeepAlive before creating the iframe request", async function () {
        const originalGet = $.get;
        const $form = createIframeForm("ajax/iframe-text.html");
        let release;
        let resolveCompletion;
        const completed = new Promise((resolve) => {
          resolveCompletion = resolve;
        });
        $.get = function (_url, callback) {
          release = callback;
        };

        try {
          $form.ajaxSubmit({
            iframe: true,
            closeKeepAlive: "/close",
            dataType: "text",
            complete: resolveCompletion,
          });
          const beforeRelease = $form.data("jqxhr");

          release();
          await completed;

          assert.strictEqual(beforeRelease, undefined);
        } finally {
          $.get = originalGet;
        }
      });

      it("should parse textarea JSON and apply dataFilter", async function () {
        const $form = createIframeForm("ajax/iframe-json.html");
        let filtered;

        const result = await submitThroughIframe($form, {
          dataType: "json",
          textarea: true,
          dataFilter: function (data, type) {
            filtered = [data, type];
            return data;
          },
        });

        assert.deepEqual(result.success[0], { transport: "iframe" });
        assert.deepEqual(filtered, ['{"transport":"iframe"}', "json"]);
        assert.strictEqual(result.success[2].status, 202);
        assert.strictEqual(result.success[2].statusText, "accepted");
      });

      // Emulated content-type is "script", so httpData never evaluates it as JavaScript.
      it.fails("should evaluate script from a pre response", async function () {
        const $form = createIframeForm("ajax/iframe-script.html");
        delete window.iframeTransportScript;

        const result = await submitThroughIframe($form, { dataType: "script" });

        assert.strictEqual(window.iframeTransportScript, "evaluated");
        assert.ok(result.success[0].includes("iframeTransportScript"));
        delete window.iframeTransportScript;
      });

      it("should return an XML document", async function () {
        const $form = createIframeForm("ajax/iframe-xml.html");

        const result = await submitThroughIframe($form, { dataType: "xml" });

        assert.strictEqual(result.success[0].documentElement.nodeName, "response");
        assert.strictEqual(
          result.success[0].getElementsByTagName("transport")[0].textContent,
          "iframe"
        );
      });

      it("should expose the iframe mock response header methods", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");

        const result = await submitThroughIframe($form, { dataType: "text" });
        const xhr = result.success[2];

        assert.strictEqual(xhr.getResponseHeader("Content-Type"), "text");
        assert.strictEqual(xhr.getResponseHeader("Missing"), undefined);
        assert.strictEqual(xhr.getAllResponseHeaders(), undefined);
        assert.strictEqual(xhr.setRequestHeader("X-Test", "ignored"), undefined);
      });

      it("should use the legacy JSON parser fallback when jQuery does not provide one", async function () {
        const parseJSON = $.parseJSON;
        const $form = createIframeForm("ajax/iframe-json.html");
        $.parseJSON = undefined;

        try {
          const result = await submitThroughIframe($form, { dataType: "json", textarea: true });

          assert.deepEqual(result.success[0], { transport: "iframe" });
        } finally {
          $.parseJSON = parseJSON;
        }
      });

      it("should clear a pending timeout after a successful response", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");

        const result = await submitThroughIframe($form, { dataType: "text", timeout: 1000 });
        await new Promise((resolve) => setTimeout(resolve, 20));

        assert.deepEqual(result.events, ["success", "complete"]);
        assert.strictEqual(result.xhr.error, undefined);
      });

      it("should report emulated HTTP errors and complete once", async function () {
        const $form = createIframeForm("ajax/iframe-error.html");

        const result = await submitThroughIframe($form, { dataType: "text" });

        assert.strictEqual(result.error[0].status, 500);
        assert.strictEqual(result.error[1], "error");
        assert.strictEqual(result.error[2], "fixture failure");
        assert.deepEqual(result.events, ["error", "complete"]);
      });

      // A parsed status code overwrites parsererror with success.
      it.fails("should report malformed JSON as a parser error", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");

        const result = await submitThroughIframe($form, { dataType: "json" });

        assert.strictEqual(result.error[1], "parsererror");
        assert.ok(result.error[2] instanceof Error);
      });

      it("should honor a beforeSend veto without submitting or completing", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");
        let complete = false;

        $form.ajaxSubmit({
          iframe: true,
          beforeSend: function () {
            return false;
          },
          complete: function () {
            complete = true;
          },
        });
        const xhr = $form.data("jqxhr");
        const rejected = await new Promise((resolve) => xhr.fail(() => resolve(true)));

        assert.strictEqual(rejected, true);
        assert.strictEqual(complete, false);
      });

      it("should time out an iframe request and call error then complete", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");

        const result = await submitThroughIframe($form, { timeout: 1 });

        assert.strictEqual(result.error[1], "timeout");
        assert.strictEqual(result.complete[1], "timeout");
        assert.deepEqual(result.events, ["error", "complete"]);
      });

      it("should emit matching global lifecycle events", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");
        const events = [];
        const names = "ajaxStart ajaxSend ajaxSuccess ajaxComplete ajaxStop";
        const active = $.active;
        $.active = 0;
        $(document).on(names, function (event) {
          events.push(event.type);
        });

        try {
          await submitThroughIframe($form, { dataType: "text", global: true });

          assert.deepEqual(events, names.split(" "));
          assert.strictEqual($.active, 0);
        } finally {
          $(document).off(names);
          $.active = active;
        }
      });

      it("should abort from beforeSend without global events", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");
        const events = [];
        $(document).on("ajaxSend ajaxError", (event) => events.push(event.type));

        try {
          $form.ajaxSubmit({
            iframe: true,
            global: false,
            beforeSend: (request) => request.abort(),
          });
          const state = await new Promise((resolve) =>
            $form.data("jqxhr").fail(() => resolve("rejected"))
          );

          assert.strictEqual(state, "rejected");
          assert.deepEqual(events, []);
        } finally {
          $(document).off("ajaxSend ajaxError");
        }
      });

      it("should leave the active count alone when beforeSend vetoes without global events", function () {
        const $form = createIframeForm("ajax/iframe-text.html");
        const active = $.active;

        $form.ajaxSubmit({ iframe: true, global: false, beforeSend: () => false });

        assert.strictEqual($.active, active);
        assert.strictEqual($form.data("jqxhr").state(), "rejected");
      });

      [
        ["an unnamed clicked button", '<button type="submit" value="ignored">Go</button>', {}],
        [
          "a named clicked submit button",
          '<button type="submit" name="choice" value="picked">Go</button>',
          { choice: "picked" },
        ],
      ].forEach(function ([label, markup, expected]) {
        it("should submit hidden values for " + label, async function () {
          const $form = createIframeForm("ajax/iframe-text.html");
          $form[0].clk = $(markup).appendTo($form)[0];
          const submitted = {};
          inspectNativeSubmit($form, function (form) {
            $(form)
              .find('input[type="hidden"]')
              .each(function () {
                submitted[this.name] = this.value;
              });
          });

          await submitThroughIframe($form, { dataType: "text" });

          assert.deepEqual(submitted, expected);
        });
      });

      it("should keep GET method and encoding when submitting with GET", async function () {
        const $form = createIframeForm("ajax/iframe-text.html").attr("method", "get");
        let submitted;
        inspectNativeSubmit($form, function (form) {
          submitted = [form.getAttribute("method"), form.getAttribute("enctype")];
        });

        const result = await submitThroughIframe($form, { dataType: "text" });

        assert.deepEqual(submitted, ["get", null]);
        assert.strictEqual(result.success[0].trim(), "iframe response");
      });

      it("should submit only own extraData properties", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");
        const data = Object.create({ inherited: "skipped" });
        data.own = "kept";
        const submitted = {};
        inspectNativeSubmit($form, function (form) {
          $(form)
            .find('input[type="hidden"]')
            .each(function () {
              submitted[this.name] = this.value;
            });
        });

        await submitThroughIframe($form, { data: data, dataType: "text" });

        assert.deepEqual(submitted, { own: "kept" });
      });

      it("should succeed without global events", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");
        const events = [];
        $(document).on("ajaxSuccess ajaxComplete", (event) => events.push(event.type));

        try {
          const result = await submitThroughIframe($form, { dataType: "text", global: false });

          assert.deepEqual(result.events, ["success", "complete"]);
          assert.deepEqual(events, []);
        } finally {
          $(document).off("ajaxSuccess ajaxComplete");
        }
      });

      it("should reject an HTTP error without callbacks or global events", async function () {
        const $form = createIframeForm("ajax/iframe-error.html");

        $form.ajaxSubmit({ iframe: true, global: false });
        const rejection = await new Promise((resolve) =>
          $form.data("jqxhr").fail((...args) => resolve(args))
        );

        assert.strictEqual(rejection[0].status, 500);
        assert.deepEqual(rejection.slice(1), ["error", "fixture failure"]);
      });

      it("should return the response text when no dataType is given", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");

        const result = await submitThroughIframe($form, {});

        assert.strictEqual(result.success[0].trim(), "iframe response");
      });

      it("should keep the HTML when textarea extraction finds no textarea", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");

        const result = await submitThroughIframe($form, { dataType: "html", textarea: true });

        assert.strictEqual(result.success[0].trim(), "iframe response");
      });

      describe("response extraction", function () {
        it("should keep the default status for a textarea without status attributes", async function () {
          const $form = createIframeForm("ajax/iframe-textarea.html");

          const result = await submitThroughIframe($form, { dataType: "json" });

          assert.deepEqual(result.success[0], { bare: true });
          assert.strictEqual(result.success[2].status, 0);
          assert.strictEqual(result.success[2].statusText, "n/a");
        });

        [
          ["an empty pre", "ajax/iframe-empty-pre.html"],
          ["an empty body", "ajax/iframe-empty.html"],
        ].forEach(function ([label, url]) {
          it("should return empty text for " + label, async function () {
            const $form = createIframeForm(url);

            const result = await submitThroughIframe($form, { dataType: "text" });

            assert.strictEqual(result.success[0], "");
          });
        });

        it("should return null text for a response that removed its root element", async function () {
          const $form = createIframeForm("ajax/iframe-rootless.html");

          const result = await submitThroughIframe($form, { dataType: "text" });

          assert.strictEqual(result.success[0], null);
          assert.strictEqual(result.success[2].responseText, null);
        });

        it("should report parsererror when dataFilter throws without a reason", async function () {
          const $form = createIframeForm("ajax/iframe-plain.html");

          const result = await submitThroughIframe($form, {
            dataType: "json",
            dataFilter: function () {
              throw "";
            },
          });

          assert.deepEqual(result.error.slice(1, 3), ["parsererror", "parsererror"]);
          assert.strictEqual(result.xhr.state(), "rejected");
        });

        // The cb keeps running after abort, so complete fires again with a null status.
        it.fails(
          "should complete once when aborted while filtering the response",
          async function () {
            const $form = createIframeForm("ajax/iframe-plain.html");
            const completions = [];
            let request;

            $form.ajaxSubmit({
              iframe: true,
              dataType: "text",
              beforeSend: (xhr) => {
                request = xhr;
              },
              dataFilter: (data) => {
                request.abort();
                return data;
              },
              complete: (_xhr, status) => completions.push(status),
            });
            await new Promise((resolve) => setTimeout(resolve, 150));

            assert.deepEqual(completions, ["aborted"]);
          }
        );

        it("should prefer an IE XMLDocument island as the XML response", async function () {
          const $form = createIframeForm("ajax/iframe-xml-island.html");

          const result = await submitThroughIframe($form, { dataType: "xml" });

          assert.strictEqual(result.success[0].documentElement.nodeName, "island");
        });

        it("should report a parsererror document as a parser error", async function () {
          const $form = createIframeForm("ajax/iframe-parsererror.xml");

          const result = await submitThroughIframe($form, { dataType: "xml" });

          assert.strictEqual(result.error[1], "parsererror");
          assert.strictEqual(result.error[2].message, "parsererror");
        });

        it("should return a parsererror document when jQuery has no error helper", async function () {
          const error = $.error;
          const $form = createIframeForm("ajax/iframe-parsererror.xml");
          $.error = undefined;

          try {
            const result = await submitThroughIframe($form, { dataType: "xml" });

            assert.strictEqual(result.success[0].documentElement.nodeName, "parsererror");
          } finally {
            $.error = error;
          }
        });

        it("should return an XML document when jQuery has no parseXML helper", async function () {
          const parseXML = $.parseXML;
          const $form = createIframeForm("ajax/iframe-xml.html");
          $.parseXML = undefined;

          try {
            const result = await submitThroughIframe($form, { dataType: "xml" });

            assert.strictEqual(result.success[0].getElementsByTagName("transport").length, 1);
          } finally {
            $.parseXML = parseXML;
          }
        });
      });

      describe("legacy browser frames", function () {
        const realContentWindow = Object.getOwnPropertyDescriptor(
          HTMLIFrameElement.prototype,
          "contentWindow"
        ).get;
        const realContentDocument = Object.getOwnPropertyDescriptor(
          HTMLIFrameElement.prototype,
          "contentDocument"
        ).get;

        function createTarget(properties) {
          const $target = $('<iframe name="legacy-frame"></iframe>').appendTo("#main");
          Object.defineProperties($target[0], properties || {});
          return $target;
        }

        function denied() {
          throw new Error("Access is denied");
        }

        // IE fires onload for the initial blank document before the response arrives.
        function ieEvents(frame, delay) {
          const detached = [];
          return {
            detached: detached,
            properties: {
              attachEvent: {
                configurable: true,
                value: function (name, handler) {
                  if (delay === undefined) {
                    handler();
                  }
                  frame().addEventListener("load", () => setTimeout(handler, delay || 0));
                },
              },
              detachEvent: {
                configurable: true,
                value: (name) => detached.push(name),
              },
            },
          };
        }

        it("should read the document when IE8 denies contentWindow access", async function () {
          const $target = createTarget({
            contentWindow: { configurable: true, get: denied },
            contentDocument: {
              configurable: true,
              get: () => realContentDocument.call($target[0]),
            },
          });
          const $form = createIframeForm("ajax/iframe-text.html");

          const result = await submitThroughIframe($form, {
            iframeTarget: $target,
            dataType: "text",
          });

          assert.strictEqual(result.success[0].trim(), "iframe response");
        });

        [
          ["throws", { get: denied }, { timeout: 1000 }],
          ["is missing", { value: null }, {}],
        ].forEach(function ([label, contentDocument, options]) {
          it("should report a server abort when the frame document " + label, async function () {
            const $target = createTarget({
              contentWindow: { configurable: true, value: null },
              contentDocument: $.extend({ configurable: true }, contentDocument),
            });
            const $form = createIframeForm("ajax/iframe-text.html");

            const result = await submitThroughIframe(
              $form,
              $.extend({ iframeTarget: $target, dataType: "text" }, options)
            );

            assert.deepEqual(result.error.slice(1, 3), ["aborted", "server abort"]);
            assert.strictEqual(result.xhr.state(), "rejected");
          });
        });

        it("should keep polling while IE reports an uninitialized document", async function () {
          let polls = 0;
          let events;
          const $target = createTarget();
          events = ieEvents(() => $target[0], 100);
          Object.defineProperties(
            $target[0],
            $.extend(events.properties, {
              contentWindow: {
                configurable: true,
                get: function () {
                  polls++;
                  return polls <= 2
                    ? { document: { readyState: "uninitialized" } }
                    : realContentWindow.call(this);
                },
              },
            })
          );
          const $form = createIframeForm("ajax/iframe-text.html");

          const result = await submitThroughIframe($form, {
            iframeTarget: $target,
            dataType: "text",
          });

          assert.ok(polls > 4, "polled again after uninitialized");
          assert.strictEqual(result.success[0].trim(), "iframe response");
          assert.deepEqual(events.detached, ["onload"]);
        });

        it("should ignore the IE onload for the initial blank document", async function () {
          const $target = createTarget();
          const events = ieEvents(() => $target[0]);
          Object.defineProperties($target[0], events.properties);
          const $form = createIframeForm("ajax/iframe-text.html");

          const result = await submitThroughIframe($form, {
            iframeTarget: $target,
            dataType: "text",
          });

          assert.deepEqual(result.events, ["success", "complete"]);
          assert.strictEqual(result.success[0].trim(), "iframe response");
          assert.deepEqual(events.detached, ["onload"]);
        });

        it("should requeue Opera's empty DOM until its retries run out", async function () {
          const $target = createTarget();
          const $form = createIframeForm("ajax/iframe-empty.html");
          const successes = [];
          vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
          window.opera = {};

          try {
            $form.ajaxSubmit({
              iframe: true,
              iframeTarget: $target,
              forceSync: true,
              dataType: "text",
              success: (data) => successes.push(data),
            });
            await new Promise((resolve) => $target.one("load", resolve));
            const beforeRetries = successes.length;
            vi.advanceTimersByTime(250 * 50);

            assert.strictEqual(beforeRetries, 0);
            assert.deepEqual(successes, [""]);
          } finally {
            vi.useRealTimers();
            delete window.opera;
          }
        });
      });

      // abort calls callbacks but leaves the returned Deferred pending.
      it.fails("should reject the returned deferred when aborted", async function () {
        const $form = createIframeForm("ajax/iframe-text.html");
        const resultPromise = submitThroughIframe($form, {});
        const xhr = $form.data("jqxhr");

        xhr.abort("manual");
        const result = await resultPromise;

        assert.strictEqual(result.error[1], "aborted");
        assert.strictEqual(result.complete[1], "aborted");
        assert.strictEqual(xhr.state(), "rejected");
      });
    });

    describe("dataType", function () {
      it("should parse a json response into an object", async function () {
        const opts = { url: "ajax/json.json", dataType: "json" };

        const seen = await submitAndSettle(opts, () => $("#form2").ajaxSubmit(opts));

        assert.ok(typeof seen.success[0] == "object", "json data type");
        assert.ok(seen.success[0].name == "jquery-test", "json data contents");
      });

      it("should evaluate a script response", async function () {
        const opts = {
          url: "ajax/script.txt?" + new Date().getTime(), // don't let ie cache it
          dataType: "script",
        };

        const seen = await submitAndSettle(opts, () => $("#form2").ajaxSubmit(opts));

        assert.ok(typeof formScriptTest == "function", "script evaluated");
        assert.ok(seen.success[0].match("formScriptTest"), "script returned");
      });

      it("should parse an xml response into a document", async function () {
        const opts = { url: "ajax/test.xml", dataType: "xml" };

        const seen = await submitAndSettle(opts, () => $("#form2").ajaxSubmit(opts));

        assert.ok(typeof seen.success[0] == "object", "data type xml");
        assert.ok($("test", seen.success[0]).length == 3, "xml data query");
      });

      it("should leave a json text response for the caller to evaluate", async function () {
        const opts = { url: "ajax/json.txt" };

        const seen = await submitAndSettle(opts, () => $("#form2").ajaxSubmit(opts));

        assert.ok(seen.success, "post-callback");
        const data = eval.call(window, "(" + seen.success[0] + ")");
        assert.ok(data.name == "jquery-test", "evaled response");
      });
    });

    describe("action and url", function () {
      it("should honor query args already present in the action attribute", async function () {
        const opts = {};

        const seen = await submitAndSettle(opts, () => $("#form5").ajaxSubmit(opts));

        assert.ok(seen.success, "post callback");
      });

      it("should submit a pseudo-form using the given url and type", async function () {
        const opts = { url: "ajax/text.html", type: "post" };

        const seen = await submitAndSettle(opts, () => $("#pseudo").ajaxSubmit(opts));

        assert.ok(seen.beforeSubmit, "pre-submit callback");
        assert.ok(seen.beforeSubmit.data.constructor == Array, "type check");
        assert.ok(seen.beforeSubmit.$form.jquery, "type check jQuery");
        assert.ok(seen.beforeSubmit.$form[0].tagName.toLowerCase() == "div", 'jQuery arg == "div"');
        assert.ok(seen.success, "post-submit callback");
      });

      // Each case submits a form whose action is unusual and checks that it still reaches
      // beforeSerialize without throwing.
      [
        ["a naked hash", "#actionTest1"],
        ["a hash only", "#actionTest2"],
        ["an empty", "#actionTest3"],
        ["a missing", "#actionTest4"],
      ].forEach(function ([label, selector]) {
        it("should submit a form with " + label + " action", function () {
          let url = null;
          const opts = {
            beforeSerialize: function ($f, o) {
              url = o.url;
            },
          };

          assert.doesNotThrow(() => $(selector).ajaxSubmit(opts), "ajaxSubmit passed");

          assert.ok(url !== null, "beforeSerialize called");
        });
      });

      it("should use the page URL when a control named action shadows a missing action", function () {
        const $form = $('<form method="post"><input name="action" value="x"></form>');

        const settings = captureAjaxOptions($form.appendTo("#main"), {});

        assert.strictEqual(settings.url, window.location.href.split("#")[0]);
      });

      it("should drop a raw action attribute that is only a fragment", function () {
        const $form = $('<form method="post" action="#fragment"><input name="action"></form>');

        const settings = captureAjaxOptions($form.appendTo("#main"), {});

        assert.strictEqual(settings.url, undefined);
      });

      it("should use the default AJAX type when a control named method shadows the form", function () {
        const $form = $('<form action="ajax/text.html"><input name="method" value="x"></form>');

        const settings = captureAjaxOptions($form.appendTo("#main"), {});

        assert.strictEqual(settings.type, $.ajaxSettings.type);
      });

      [
        ["an empty user agent", ""],
        ["IE on a non-HTTPS page", "Mozilla/5.0 (Windows NT 10.0; Trident/7.0; rv:11.0)"],
      ].forEach(function ([label, userAgent]) {
        it("should use about:blank as the iframe source for " + label, function () {
          const $form = $('<form action="ajax/text.html"></form>').appendTo("#main");

          const settings = withUserAgent(userAgent, () => captureAjaxOptions($form, {}));

          assert.strictEqual(settings.iframeSrc, "about:blank");
        });
      });
    });

    describe("serialization options", function () {
      it("should serialize extra data traditionally when asked", function () {
        const $form = $('<form action="ajax/text.html" method="post"></form>').appendTo("#main");

        const settings = captureAjaxOptions($form, {
          data: { list: ["a", "b"] },
          traditional: true,
        });

        assert.strictEqual(settings.data, "list=a&list=b");
      });

      it("should submit only extra data when the form has no fields", function () {
        const $form = $('<form action="ajax/text.html" method="post"></form>').appendTo("#main");

        const settings = captureAjaxOptions($form, { data: { only: "extra" } });

        assert.strictEqual(settings.data, "only=extra");
      });
    });

    describe("success without a transport xhr", function () {
      it("should load the target when no success callback is given", function () {
        const $form = $('<form action="ajax/text.html"></form>').appendTo("#main");
        const $target = $("<div></div>").appendTo("#main");

        captureAjaxOptions($form, { target: $target }, function (settings) {
          settings.success("<b>loaded</b>", "success");
        });

        assert.strictEqual($target.html(), "<b>loaded</b>");
      });

      it("should pass the form in place of a missing xhr", function () {
        const $form = $('<form action="ajax/text.html"></form>').appendTo("#main");
        let received;

        captureAjaxOptions(
          $form,
          {
            success: function (_data, _status, xhr) {
              received = xhr;
            },
          },
          function (settings) {
            settings.success("ok", "success");
          }
        );

        assert.strictEqual(received, $form);
      });
    });
  });

  describe("ajaxForm", function () {
    it("should pass URL shorthand options to ajaxSubmit", function () {
      const $form = $('<form><button type="submit">Send</button></form>').appendTo("#main");
      const ajaxSubmit = $.fn.ajaxSubmit;
      const success = function () {};
      let submittedOptions;
      $.fn.ajaxSubmit = function (options) {
        submittedOptions = options;
        return this;
      };

      try {
        $form.ajaxForm("/shorthand", { source: "test" }, "json", success);
        $form.trigger("submit");

        assert.strictEqual(submittedOptions.url, "/shorthand");
        assert.deepEqual(submittedOptions.data, { source: "test" });
        assert.strictEqual(submittedOptions.dataType, "json");
        assert.strictEqual(submittedOptions.success, success);
      } finally {
        $.fn.ajaxSubmit = ajaxSubmit;
      }
    });

    it("should accept false as the shorthand URL without a success callback", function () {
      const $form = $("<form></form>").appendTo("#main");
      const ajaxSubmit = $.fn.ajaxSubmit;
      let submittedOptions;
      $.fn.ajaxSubmit = function (options) {
        submittedOptions = options;
        return this;
      };

      try {
        $form.ajaxForm(false);
        $form.trigger("submit");

        assert.strictEqual(submittedOptions.url, false);
        assert.strictEqual(submittedOptions.success, undefined);
      } finally {
        $.fn.ajaxSubmit = ajaxSubmit;
      }
    });

    it("should return an empty selection without binding handlers", function () {
      const $missing = $(".missing-ajax-form");

      const result = $missing.ajaxForm();

      assert.strictEqual(result, $missing);
      assert.strictEqual($._data(document, "events"), undefined);
    });

    describe("before the DOM is ready", function () {
      function withDomNotReady(run) {
        const isReady = $.isReady;
        $.isReady = false;

        try {
          return run();
        } finally {
          $.isReady = isReady;
        }
      }

      it("should bind once ready when old jQuery selector metadata is present", async function () {
        const $pending = $(".queued-ajax-form");
        $pending.selector = ".queued-ajax-form";

        const result = withDomNotReady(() => $pending.ajaxForm());
        const $form = $('<form class="queued-ajax-form"></form>').appendTo("#main");
        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(result, $pending);
        assert.strictEqual($._data($form[0], "events").submit.length, 1);
      });

      it("should not queue an empty selection without selector metadata", async function () {
        const $pending = $(".unqueued-ajax-form");

        const result = withDomNotReady(() => $pending.ajaxForm());
        const $form = $('<form class="unqueued-ajax-form"></form>').appendTo("#main");
        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(result, $pending);
        assert.strictEqual($._data($form[0], "events"), undefined);
      });
    });

    it("should call beforeFormUnbind before replacing form handlers", function () {
      const $form = $('<form><button type="submit">Send</button></form>').appendTo("#main");
      const order = [];
      $form.on("submit.form-plugin", function () {
        order.push("old handler");
      });

      $form.ajaxForm({
        beforeFormUnbind: function (forms, options) {
          order.push("before unbind");
          assert.strictEqual(forms, $form);
          assert.strictEqual(options.beforeFormUnbind instanceof Function, true);
          assert.strictEqual($._data($form[0], "events").submit.length, 1);
        },
      });

      assert.deepEqual(order, ["before unbind"]);
      assert.strictEqual($._data($form[0], "events").submit.length, 1);
    });

    it("should leave a canceled submit untouched", function () {
      const $form = $('<form><button type="submit">Send</button></form>').appendTo("#main");
      const ajaxSubmit = $.fn.ajaxSubmit;
      let submissions = 0;
      $.fn.ajaxSubmit = function () {
        submissions++;
        return this;
      };
      $form.on("submit", function (event) {
        event.preventDefault();
      });

      try {
        const event = $.Event("submit");
        $form.ajaxForm();
        $form.trigger(event);

        assert.strictEqual(event.isDefaultPrevented(), true);
        assert.strictEqual(submissions, 0);
      } finally {
        $.fn.ajaxSubmit = ajaxSubmit;
      }
    });

    it("should capture a submit button when nested content is clicked", function () {
      const $form = $(
        '<form><button type="submit" name="choice" value="nested"><span>Send</span></button></form>'
      ).appendTo("#main");
      const button = $form.find("button")[0];

      $form.ajaxForm();
      $form.find("span").trigger("click");

      assert.strictEqual($form[0].clk, button);
    });

    it("should ignore clicks outside submit controls", function () {
      const $form = $("<form><span>Not a submit control</span></form>").appendTo("#main");

      $form.ajaxForm();
      $form.find("span").trigger("click");

      assert.strictEqual($form[0].clk, undefined);
    });

    // jQuery 3.7 removed the selection selector needed to scope delegated handlers.
    it.fails("should scope delegated handlers to the selected forms", function () {
      const $selected = $('<form class="delegated"></form>').appendTo("#main");
      const $unselected = $("<form></form>").appendTo("#main");
      const ajaxSubmit = $.fn.ajaxSubmit;
      let submissions = 0;
      $.fn.ajaxSubmit = function () {
        submissions++;
        return this;
      };

      try {
        $selected.ajaxForm({ delegation: true });
        $unselected.trigger("submit");

        assert.strictEqual(submissions, 0);
      } finally {
        $(document).off(".form-plugin");
        $.fn.ajaxSubmit = ajaxSubmit;
      }
    });

    it("should capture image coordinates supplied by the click event", function () {
      const $form = $('<form><input type="image" name="map"></form>').appendTo("#main");
      const $image = $form.find("input");
      const event = $.Event("click");
      event.offsetX = 14;
      event.offsetY = 27;

      $form.ajaxForm();
      $image.trigger(event);

      assert.strictEqual($form[0].clk, $image[0]);
      assert.strictEqual($form[0].clk_x, 14);
      assert.strictEqual($form[0].clk_y, 27);
    });

    it("should derive image coordinates from its document offset", function () {
      const $form = $('<form><input type="image" name="map"></form>').appendTo("#main");
      const $image = $form.find("input");
      const offset = $.fn.offset;
      $.fn.offset = function () {
        return { left: 10, top: 20 };
      };
      const event = $.Event("click");
      event.pageX = 31;
      event.pageY = 58;

      try {
        $form.ajaxForm();
        $image.trigger(event);

        assert.strictEqual($form[0].clk_x, 21);
        assert.strictEqual($form[0].clk_y, 38);
      } finally {
        $.fn.offset = offset;
      }
    });

    it("should derive image coordinates from element offsets without the offset helper", function () {
      const $form = $('<form><input type="image" name="map"></form>').appendTo("#main");
      const $image = $form.find("input");
      const offset = $.fn.offset;
      $.fn.offset = undefined;
      Object.defineProperties($image[0], {
        offsetLeft: { configurable: true, value: 7 },
        offsetTop: { configurable: true, value: 9 },
      });
      const event = $.Event("click");
      event.pageX = 19;
      event.pageY = 24;

      try {
        $form.ajaxForm();
        $image.trigger(event);

        assert.strictEqual($form[0].clk_x, 12);
        assert.strictEqual($form[0].clk_y, 15);
      } finally {
        $.fn.offset = offset;
      }
    });

    it("should clear captured submit details after the click window", async function () {
      const $form = $('<form><input type="image" name="map"></form>').appendTo("#main");
      const $image = $form.find("input");
      const event = $.Event("click");
      event.offsetX = 4;
      event.offsetY = 6;
      $form.ajaxForm();
      $image.trigger(event);

      await new Promise((resolve) => setTimeout(resolve, 120));

      assert.strictEqual($form[0].clk, null);
      assert.strictEqual($form[0].clk_x, null);
      assert.strictEqual($form[0].clk_y, null);
    });

    it("should call beforeSubmit and then success when the submit button is clicked", async function () {
      const opts = {};

      const seen = await submitAndSettle(opts, () => {
        $("#form4").ajaxForm(opts);
        $("#submitForm4")[0].click();
      });

      assert.ok(seen.beforeSubmit, "pre-submit callback");
      assert.ok(seen.beforeSubmit.data.constructor == Array, "type check");
      assert.ok(seen.beforeSubmit.$form.jquery, "type check jQuery");
      assert.ok(seen.success, "post-submit callback");
    });

    it("should include the value of the clicked submit button", async function () {
      const opts = {};

      const seen = await submitAndSettle(opts, () => {
        $("#form4").ajaxForm(opts);
        $("#submitForm4withName")[0].click();
      });

      assert.ok(seen.beforeSubmit, "pre-callback");
      assert.ok(seen.beforeSubmit.data.constructor == Array, "type check");
      assert.ok(seen.beforeSubmit.$form.jquery, "type check jQuery");
      assert.ok(
        arrayValue(seen.beforeSubmit.data, "form4inputName") !== undefined,
        "submit button"
      );
    });

    it("should include the coordinates of a clicked image submit", async function () {
      const opts = {};

      const seen = await submitAndSettle(opts, () => {
        $("#form4").ajaxForm(opts);
        $("#form4imageSubmit")[0].click();
      });

      assert.ok(seen.beforeSubmit, "pre-callback");
      assert.ok(seen.beforeSubmit.data.constructor == Array, "type check");
      assert.ok(seen.beforeSubmit.$form.jquery, "type check jQuery");
      assert.ok(arrayValue(seen.beforeSubmit.data, "myImage.x") !== undefined, "x coord");
      assert.ok(arrayValue(seen.beforeSubmit.data, "myImage.y") !== undefined, "y coord");
    });

    it("should include image coordinates when semantic is true", async function () {
      const opts = { semantic: true };

      const seen = await submitAndSettle(opts, () => {
        $("#form4").ajaxForm(opts);
        $("#form4imageSubmit")[0].click();
      });

      assert.ok(seen.beforeSubmit, "pre-callback");
      assert.ok(seen.beforeSubmit.data.constructor == Array, "type check");
      assert.ok(seen.beforeSubmit.$form.jquery, "type check jQuery");
      assert.ok(arrayValue(seen.beforeSubmit.data, "myImage.x") !== undefined, "x coord");
      assert.ok(arrayValue(seen.beforeSubmit.data, "myImage.y") !== undefined, "y coord");
    });

    it("should load the response into the target div", async function () {
      $("#targetDiv").empty();
      const opts = { target: "#targetDiv" };

      const seen = await submitAndSettle(opts, () => {
        $("#form4").ajaxForm(opts);
        $("#submitForm4")[0].click();
      });

      assert.ok(seen.beforeSubmit, "pre-callback");
      assert.ok(seen.beforeSubmit.data.constructor == Array, "type check");
      assert.ok(seen.beforeSubmit.$form.jquery, "type check jQuery");
      assert.ok(seen.success, "post-callback");
      assert.ok($("#targetDiv").text().match("Lorem ipsum"), "targetDiv updated");
    });

    it("should submit once when ajaxForm is bound several times", async function () {
      $("#targetDiv").empty();
      let beforeSubmitCalls = 0;
      let successCalls = 0;
      const opts = {
        target: "#targetDiv",
        beforeSubmit: function () {
          beforeSubmitCalls++;
        },
        success: function () {
          successCalls++;
        },
      };
      const settled = new Promise((resolve) => {
        const success = opts.success;
        opts.success = function () {
          success.apply(this, arguments);
          // Let any duplicate submissions from extra bindings land before asserting.
          setTimeout(resolve, 100);
        };
      });

      $("#form8").ajaxForm(opts).ajaxForm(opts).ajaxForm(opts);
      $("#submitForm8")[0].click();
      await settled;

      assert.strictEqual(beforeSubmitCalls, 1, "pre-callback");
      assert.strictEqual(successCalls, 1, "post-callback");
    });

    it("should not submit after ajaxFormUnbind", async function () {
      $("#targetDiv").empty();
      let callbacks = 0;
      const opts = {
        target: "#targetDiv",
        beforeSubmit: function () {
          callbacks++;
        },
        success: function () {
          callbacks++;
        },
      };
      $("#form9")
        .ajaxForm(opts)
        .submit(function () {
          return false;
        });

      $("#form9").ajaxFormUnbind(opts);
      $("#submitForm9")[0].click();
      await new Promise((resolve) => setTimeout(resolve, 500));

      assert.strictEqual(callbacks, 0, "no callbacks after unbind");
    });
  });
});
