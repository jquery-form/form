/* global scriptCount */

import { assert, beforeAll, beforeEach, describe, it } from "vitest";

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

  describe("enable and selected", function () {
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
