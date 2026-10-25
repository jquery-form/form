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
  });

  describe("fieldValue", function () {
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
  });

  describe("ajaxSubmit", function () {
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
