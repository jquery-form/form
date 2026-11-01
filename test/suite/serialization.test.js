import { assert, describe, it } from "vitest";
import { resetFixture, arrayCount, arrayValue, selectFiles, buildForm } from "./helpers.js";

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

    describe("selection and subject", function () {
      it("should leave elements untouched and not call filtering when the selection is empty", function () {
        const elements = ["kept"];
        let calls = 0;

        const formData = $(".missing-form").formToArray(false, elements, function (element) {
          calls++;
          return element;
        });

        assert.deepEqual(formData, []);
        assert.deepEqual(elements, ["kept"]);
        assert.strictEqual(calls, 0);
      });

      it("should serialize only the first form when the selection holds several forms", function () {
        const $forms = $(
          '<form><input name="first" value="1"></form><form><input name="second" value="2"></form>'
        );

        const names = $forms.formToArray().map((field) => field.name);

        assert.deepEqual(names, ["first"]);
      });

      it("should return a new plain array on every call", function () {
        const $form = $('<form><input name="a" value="1"></form>');

        const first = $form.formToArray();
        const second = $form.formToArray();

        assert.isTrue(Array.isArray(first));
        assert.isUndefined(first.jquery);
        assert.notStrictEqual(first, second);
        assert.deepEqual(first, second);
      });

      it("should collect a detached form in document order when semantic is true", function () {
        const $form = $(
          '<form><div><input name="a" value="1"></div><input name="b" value="2"></form>'
        );

        const formData = $form.formToArray(true);

        assert.deepEqual(formData, [
          { name: "a", value: "1", type: "text", required: false },
          { name: "b", value: "2", type: "text", required: false },
        ]);
      });

      it("should collect named descendants of a div in document order in both modes", function () {
        const $div = $(
          '<div><input name="a" value="1"><span><select name="s"><option value="x" selected>x</option></select></span><textarea name="t">z</textarea></div>'
        );

        const plain = $div.formToArray().map((field) => [field.name, field.value]);
        const semantic = $div.formToArray(true).map((field) => [field.name, field.value]);

        const expected = [
          ["a", "1"],
          ["s", "x"],
          ["t", "z"],
        ];
        assert.deepEqual(plain, expected);
        assert.deepEqual(semantic, expected);
      });

      it("should collect fieldset descendants when semantic is true", function () {
        const $fieldset = $(
          '<fieldset><div><input name="a" value="1"></div><input name="b" value="2"></fieldset>'
        );

        const formData = $fieldset.formToArray(true);

        assert.deepEqual(formData, [
          { name: "a", value: "1", type: "text", required: false },
          { name: "b", value: "2", type: "text", required: false },
        ]);
      });

      it("should return an empty array when the subject is a single control", function () {
        const $controls = [
          $('<input name="a" value="1">'),
          $('<textarea name="t">x</textarea>'),
          $('<select name="s"><option value="o" selected>o</option></select>'),
        ];

        const results = $controls.map(($control) => $control.formToArray());

        assert.deepEqual(results, [[], [], []]);
      });

      it("should serialize the controls of every form when the subject is the document", function () {
        $('<form><input name="ser-doc-first" value="1"></form>').appendTo("#main");
        $('<form><input name="ser-doc-second" value="2"></form>').appendTo("#main");

        const names = $(document)
          .formToArray()
          .map((field) => field.name);

        const first = names.indexOf("ser-doc-first");
        const second = names.indexOf("ser-doc-second");
        assert.isAbove(first, -1);
        assert.isAbove(second, first);
      });

      it("should throw a TypeError when the subject is a text node or the window", function () {
        const $text = $(document.createTextNode("text"));
        const $window = $(window);

        const serializeText = () => $text.formToArray();
        const serializeWindow = () => $window.formToArray();

        assert.throws(serializeText, TypeError);
        assert.throws(serializeWindow, TypeError);
      });

      it("should serialize a plain object with an array-like elements list", function () {
        const controls = $('<input name="a" value="1"><input name="b" value="2">').get();

        const formData = $({ elements: controls }).formToArray();
        const empty = $({ elements: null }).formToArray();

        assert.deepEqual(formData, [
          { name: "a", value: "1", type: "text", required: false },
          { name: "b", value: "2", type: "text", required: false },
        ]);
        assert.deepEqual(empty, []);
      });

      it("should serialize only a control named elements in browsers without DOM prototype accessors", function () {
        const $form = $(
          '<form><input name="a" value="1"><input name="elements" value="e"><input name="b" value="2"></form>'
        );
        const HTMLFormElement = window.HTMLFormElement;
        window.HTMLFormElement = undefined;
        let names;

        try {
          names = $form.formToArray().map((field) => field.name);
        } finally {
          window.HTMLFormElement = HTMLFormElement;
        }

        assert.deepEqual(names, ["elements"]);
      });

      it("should not call filtering when the form has no candidate elements", function () {
        const $form = $("<form></form>");
        let calls = 0;
        const filtering = function (element) {
          calls++;
          return element;
        };

        const plain = $form.formToArray(false, undefined, filtering);
        const semantic = $form.formToArray(true, undefined, filtering);

        assert.deepEqual(plain, []);
        assert.deepEqual(semantic, []);
        assert.strictEqual(calls, 0);
      });
    });

    describe("candidate elements", function () {
      it("should keep tree order for an outside control placed before the form when semantic is false", function () {
        $('<input name="out" value="o" form="ser-order">').appendTo("#main");
        const $form = $('<form id="ser-order"><input name="a" value="1"></form>').appendTo("#main");

        const names = $form.formToArray().map((field) => field.name);

        assert.deepEqual(names, ["out", "a"]);
      });

      it("should append an outside control placed before the form after its own controls when semantic is true", function () {
        $('<input name="out" value="o" form="ser-order">').appendTo("#main");
        const $form = $('<form id="ser-order"><input name="a" value="1"></form>').appendTo("#main");

        const names = $form.formToArray(true).map((field) => field.name);

        assert.deepEqual(names, ["a", "out"]);
      });

      it("should ignore outside fieldset and output elements that use the form attribute when semantic is true", function () {
        const $form = $('<form id="ser-outside-kinds"><input name="a" value="1"></form>').appendTo(
          "#main"
        );
        $(
          '<fieldset name="fs" form="ser-outside-kinds"></fieldset><output name="o" form="ser-outside-kinds">out</output>'
        ).appendTo("#main");

        const names = $form.formToArray(true).map((field) => field.name);

        assert.deepEqual(names, ["a"]);
      });

      it("should serialize named anchors and images when semantic is true", function () {
        const $form = $(
          '<form><a name="top">x</a><img name="pic" alt=""><input name="a" value="1"></form>'
        );

        const pairs = $form.formToArray(true).map((field) => [field.name, field.value]);

        assert.deepEqual(pairs, [
          ["top", ""],
          ["pic", ""],
          ["a", "1"],
        ]);
      });

      it("should serialize a form-associated custom element from its name and value properties", function () {
        if (!customElements.get("ser-custom-field")) {
          customElements.define(
            "ser-custom-field",
            class extends HTMLElement {
              static get formAssociated() {
                return true;
              }

              constructor() {
                super();
                this.internals = this.attachInternals();
              }

              get name() {
                return this.getAttribute("name");
              }

              get value() {
                return "from-property";
              }
            }
          );
        }
        const $form = $(
          '<form><ser-custom-field name="custom"></ser-custom-field></form>'
        ).appendTo("#main");
        $form.find("ser-custom-field")[0].internals.setFormValue("from-internals");

        const formData = $form.formToArray();

        assert.deepEqual(formData, [
          { name: "custom", value: "from-property", type: undefined, required: undefined },
        ]);
      });

      it("should collect a descendant once when its form attribute names its own form", function () {
        const $form = $(
          '<form id="ser-own"><input name="a" value="1" form="ser-own"></form>'
        ).appendTo("#main");

        const names = $form.formToArray(true).map((field) => field.name);

        assert.deepEqual(names, ["a"]);
      });

      it("should skip named fieldset, output and object elements", function () {
        const $form = $(
          '<form><fieldset name="fs"><input name="a" value="1"></fieldset><output name="o">out</output><object name="obj"></object></form>'
        ).appendTo("#main");

        const names = $form.formToArray().map((field) => field.name);

        assert.deepEqual(names, ["a"]);
      });

      it("should skip named fieldset, output and object elements when semantic is true", function () {
        const $form = $(
          '<form><fieldset name="fs"><input name="a" value="1"></fieldset><output name="o">out</output><object name="obj"></object></form>'
        );

        const names = $form.formToArray(true).map((field) => field.name);

        assert.deepEqual(names, ["a"]);
      });
    });

    describe("filtering", function () {
      it("should call filtering with each candidate element and its index", function () {
        const $form = $('<form><div><input name="a" value="1"></div></form>');
        const calls = [];

        $form.formToArray(true, undefined, function (element, index) {
          calls.push([element, index]);
          return element;
        });

        assert.deepEqual(calls, [
          [$form.find("div")[0], 0],
          [$form.find("input")[0], 1],
        ]);
      });

      it("should substitute, splice and skip what filtering returns", function () {
        const $form = $(
          '<form><input name="a" value="1"><input name="b" value="2"><input name="c" value="3"></form>'
        );
        const substitute = $('<input name="x" value="9">')[0];
        const spliced = $('<input name="y" value="8">')[0];

        const names = $form
          .formToArray(false, undefined, function (element) {
            if (element.name === "a") {
              return substitute;
            }
            if (element.name === "b") {
              return [spliced, element];
            }
            return "not an element";
          })
          .map((field) => field.name);

        assert.deepEqual(names, ["x", "y", "b"]);
      });

      it("should ignore filtering when it is not a function", function () {
        const $form = $('<form><input name="a" value="1"><input name="b" value="2"></form>');

        const names = $form.formToArray(false, undefined, "a").map((field) => field.name);

        assert.deepEqual(names, ["a", "b"]);
      });
    });

    describe("skipped controls", function () {
      it("should skip controls without a name in both modes", function () {
        const $form = $(
          '<form><input value="x"><input name="" value="y"><div name="d"></div><input name="a" value="1"></form>'
        );

        const plain = $form.formToArray().map((field) => field.name);
        const semantic = $form.formToArray(true).map((field) => field.name);

        assert.deepEqual(plain, ["a"]);
        assert.deepEqual(semantic, ["a"]);
      });

      it("should skip disabled controls in both modes", function () {
        const $form = $(
          '<form><input name="a" value="1" disabled><input name="b" value="2"></form>'
        );

        const plain = $form.formToArray().map((field) => field.name);
        const semantic = $form.formToArray(true).map((field) => field.name);

        assert.deepEqual(plain, ["b"]);
        assert.deepEqual(semantic, ["b"]);
      });

      it("should skip button-type and reset-type controls", function () {
        const $form = $(
          '<form><input type="button" name="ib" value="1"><button type="button" name="bb" value="2">B</button><input type="reset" name="ir" value="3"><button type="reset" name="br" value="4">R</button><input name="a" value="1"></form>'
        );

        const plain = $form.formToArray().map((field) => field.name);
        const semantic = $form.formToArray(true).map((field) => field.name);

        assert.deepEqual(plain, ["a"]);
        assert.deepEqual(semantic, ["a"]);
      });

      it('should send "on" for a checked checkbox without a value attribute', function () {
        const $form = $('<form><input type="checkbox" name="c" checked></form>');

        const formData = $form.formToArray();

        assert.deepEqual(formData, [{ name: "c", value: "on", type: "checkbox", required: false }]);
      });

      it("should include the clicked submit input at its position in both modes", function () {
        const $form = $(
          '<form><input name="a" value="1"><input type="submit" name="go" value="Go"><input name="b" value="2"></form>'
        );
        $form[0].clk = $form.find('[type="submit"]')[0];

        const plain = $form.formToArray();
        const semantic = $form.formToArray(true);

        const expected = [
          { name: "a", value: "1", type: "text", required: false },
          { name: "go", value: "Go", type: "submit", required: false },
          { name: "b", value: "2", type: "text", required: false },
        ];
        assert.deepEqual(plain, expected);
        assert.deepEqual(semantic, expected);
      });

      it("should report required as undefined for a clicked button element", function () {
        const $form = $('<form><button name="go" value="Go">Go</button></form>');
        $form[0].clk = $form.find("button")[0];

        const formData = $form.formToArray();

        assert.deepEqual(formData, [
          { name: "go", value: "Go", type: "submit", required: undefined },
        ]);
      });

      it("should serialize a named submit button of a pseudo-form without a click", function () {
        const $div = $(
          '<div><input name="a" value="1"><input type="submit" name="go" value="Go"></div>'
        );

        const names = $div.formToArray().map((field) => field.name);

        assert.deepEqual(names, ["a", "go"]);
      });

      it.fails("should not treat a submit button named clk as clicked", function () {
        const $form = $(
          '<form><input name="a" value="1"><input type="submit" name="clk" value="go"><input type="submit" name="other" value="no"></form>'
        );

        const names = $form.formToArray().map((field) => field.name);

        assert.deepEqual(names, ["a"]);
      });

      it("should serialize unchanged when controls shadow other form members", function () {
        const shadowed = [
          "submit",
          "reset",
          "ownerDocument",
          "id",
          "name",
          "length",
          "tagName",
          "type",
          "disabled",
          "form",
        ];

        const results = shadowed.map((name) =>
          $(`<form><input name="a" value="1"><input name="${name}" value="x"></form>`)
            .formToArray()
            .map((field) => [field.name, field.value])
        );

        assert.deepEqual(
          results,
          shadowed.map((name) => [
            ["a", "1"],
            [name, "x"],
          ])
        );
      });
    });

    describe("controls named like form members", function () {
      it("should serialize when a control named getAttribute shadows the form", function () {
        const $form = $('<form id="members"><input name="getAttribute" value="x"></form>');

        const formData = $form.formToArray();

        assert.deepEqual(
          formData.map((field) => [field.name, field.value]),
          [["getAttribute", "x"]]
        );
      });

      it("should serialize semantically when a control named getElementsByTagName shadows the form", function () {
        const $form = $(buildForm('<input name="a" value="1"><input name="getElementsByTagName">'));

        const formData = $form.formToArray(true);

        assert.deepEqual(
          formData.map((field) => field.name),
          ["a", "getElementsByTagName"]
        );
      });
    });

    describe("image submitters", function () {
      it("should skip every image input when semantic is true and nothing was clicked", function () {
        const $form = $(
          '<form><input type="image" name="i1" value="a"><input name="a" value="1"></form>'
        );

        const names = $form.formToArray(true).map((field) => field.name);

        assert.deepEqual(names, ["a"]);
      });

      it("should skip images and keep the clicked button in place when semantic is true", function () {
        const $form = $(
          '<form><input type="image" name="i1" value="a"><button name="go" value="Go">Go</button><input name="a" value="1"></form>'
        );
        $form[0].clk = $form.find("button")[0];

        const names = $form.formToArray(true).map((field) => field.name);

        assert.deepEqual(names, ["go", "a"]);
      });

      it("should not append a clicked image that is disabled or unnamed when semantic is false", function () {
        const $disabled = $(
          '<form><input name="a" value="1"><input type="image" name="map" value="go" disabled></form>'
        );
        const $unnamed = $(
          '<form><input name="a" value="1"><input type="image" value="go"></form>'
        );
        $disabled[0].clk = $disabled.find('[type="image"]')[0];
        $unnamed[0].clk = $unnamed.find('[type="image"]')[0];

        const disabledNames = $disabled.formToArray().map((field) => field.name);
        const unnamedNames = $unnamed.formToArray().map((field) => field.name);

        assert.deepEqual(disabledNames, ["a"]);
        assert.deepEqual(unnamedNames, ["a"]);
      });

      it.fails(
        "should append the clicked image when it is the only control and semantic is false",
        function () {
          const $form = $('<form><input type="image" name="map" value="go"></form>');
          $form[0].clk = $form.find("input")[0];
          $form[0].clk_x = 4;
          $form[0].clk_y = 6;

          const formData = $form.formToArray();

          assert.deepEqual(formData, [
            { name: "map", value: "go" },
            { name: "map.x", value: 4 },
            { name: "map.y", value: 6 },
          ]);
        }
      );

      it("should append a clicked image from outside the form when semantic is false", function () {
        const $form = $('<form><input name="a" value="1"></form>');
        $form[0].clk = $('<input type="image" name="far" value="v">')[0];
        $form[0].clk_x = 1;
        $form[0].clk_y = 2;

        const formData = $form.formToArray();

        assert.deepEqual(formData, [
          { name: "a", value: "1", type: "text", required: false },
          { name: "far", value: "v" },
          { name: "far.x", value: 1 },
          { name: "far.y", value: 2 },
        ]);
      });

      it("should send an empty value for a clicked image without a value attribute", function () {
        const $form = $('<form><input name="a" value="1"><input type="image" name="map"></form>');
        $form[0].clk = $form.find('[type="image"]')[0];

        const plain = $form.formToArray();
        const semantic = $form.formToArray(true);

        assert.strictEqual(plain[1].value, "");
        assert.strictEqual(semantic[1].value, "");
      });

      it("should leave the clicked image out of elements in both modes", function () {
        const $form = $(
          '<form><input name="a" value="1"><input type="image" name="map" value="go"></form>'
        );
        $form[0].clk = $form.find('[type="image"]')[0];
        const plainElements = [];
        const semanticElements = [];

        $form.formToArray(false, plainElements);
        $form.formToArray(true, semanticElements);

        const text = $form.find('[name="a"]')[0];
        assert.deepEqual(plainElements, [text]);
        assert.deepEqual(semanticElements, [text]);
      });

      it("should serialize missing click coordinates as empty values", function () {
        const $form = $(
          '<form><input name="a" value="1"><input type="image" name="map" value="go"></form>'
        );
        $form[0].clk = $form.find('[type="image"]')[0];

        const serialized = $form.formSerialize();

        // jQuery before 3.0 turns undefined into "undefined" in $.param; later versions use "".
        const missing = Number($.fn.jquery.split(".")[0]) < 3 ? "undefined" : "";
        assert.strictEqual(serialized, `a=1&map=go&map.x=${missing}&map.y=${missing}`);
      });
    });

    describe("values", function () {
      it("should report the type and required state of scalar entries", function () {
        const $form = $(
          '<form><input name="r" value="1" required><textarea name="t">x</textarea><select name="s"><option value="o" selected>o</option></select></form>'
        );

        const formData = $form.formToArray();

        assert.deepEqual(formData, [
          { name: "r", value: "1", type: "text", required: true },
          { name: "t", value: "x", type: "textarea", required: false },
          { name: "s", value: "o", type: "select-one", required: false },
        ]);
      });

      it("should return name and value only for multi-select entries, across optgroups", function () {
        const $form = $(
          '<form><select name="m" multiple><optgroup label="g"><option selected>a</option></optgroup><option selected>b</option></select></form>'
        );

        const formData = $form.formToArray();

        assert.deepEqual(formData, [
          { name: "m", value: "a" },
          { name: "m", value: "b" },
        ]);
      });

      it("should send the option at selectedIndex for a select-one", function () {
        const $form = $(
          '<form><select name="s"><option value="x">x</option><option value="y">y</option></select></form>'
        );
        $form.find("select")[0].selectedIndex = 1;

        const formData = $form.formToArray();

        assert.deepEqual(formData, [
          { name: "s", value: "y", type: "select-one", required: false },
        ]);
      });

      it("should omit a select-one whose selected placeholder option is disabled but list it in elements", function () {
        const $form = $(
          '<form><select name="s"><option value="" selected disabled>Choose</option><option value="a">a</option></select></form>'
        );
        const elements = [];

        const formData = $form.formToArray(false, elements);

        assert.deepEqual(formData, []);
        assert.deepEqual(elements, [$form.find("select")[0]]);
      });

      it("should add a multi-select with only disabled selected options to elements without entries", function () {
        const $form = $(
          '<form><select name="m" multiple><option selected disabled>a</option><option>b</option></select></form>'
        );
        const elements = [];

        const formData = $form.formToArray(false, elements);

        assert.deepEqual(formData, []);
        assert.deepEqual(elements, [$form.find("select")[0]]);
      });

      it("should omit selects with no selected option and leave them out of elements", function () {
        const $form = $(
          '<form><select name="s" size="2"><option>a</option></select><select name="m" multiple><option>b</option></select></form>'
        );
        const elements = [];

        const formData = $form.formToArray(false, elements);

        assert.deepEqual(formData, []);
        assert.deepEqual(elements, []);
      });

      it("should keep line feeds in option values unchanged", function () {
        const $form = $('<form><select name="s"><option selected>x</option></select></form>');
        $form.find("option")[0].value = "a\nb";

        const formData = $form.formToArray();

        assert.strictEqual(formData[0].value, "a\nb");
      });

      it("should normalize line endings of a textarea and of a hidden input", function () {
        const $form = $(
          '<form><textarea name="t"></textarea><input type="hidden" name="lf"><input type="hidden" name="crlf"></form>'
        );
        $form.find("textarea").val("a\nb");
        $form.find('[name="lf"]')[0].value = "c\nd";
        $form.find('[name="crlf"]')[0].value = "e\r\nf";

        const values = $form.formToArray().map((field) => field.value);

        assert.deepEqual(values, ["a\r\nb", "c\r\nd", "e\r\nf"]);
      });

      it("should handle a lone carriage return per jQuery version", function () {
        const $form = $('<form><input type="hidden" name="h"></form>');
        $form.find("input")[0].value = "a\rb";

        const formData = $form.formToArray();

        // jQuery before 4.0 strips carriage returns in .val(); 4.0 keeps them.
        const expected = Number($.fn.jquery.split(".")[0]) < 4 ? "ab" : "a\rb";
        assert.strictEqual(formData[0].value, expected);
      });

      it("should send the literal value of a hidden input named _charset_ and nothing for dirname", function () {
        const $form = $(
          '<form><input type="hidden" name="_charset_" value="literal"><input name="t" value="v" dirname="t.dir"></form>'
        );

        const pairs = $form.formToArray().map((field) => [field.name, field.value]);

        assert.deepEqual(pairs, [
          ["_charset_", "literal"],
          ["t", "v"],
        ]);
      });
    });

    describe("file inputs", function () {
      it("should return one File entry per selected file in FileList order", function () {
        const $form = $('<form><input type="file" name="up" multiple></form>');
        selectFiles($form.find("input")[0], ["one.txt", "two.txt"]);

        const formData = $form.formToArray();

        assert.deepEqual(
          formData.map((field) => [field.name, field.value instanceof File, field.value.name]),
          [
            ["up", true, "one.txt"],
            ["up", true, "two.txt"],
          ]
        );
        assert.deepEqual(
          formData.map((field) => Object.keys(field)),
          [
            ["name", "value", "type"],
            ["name", "value", "type"],
          ]
        );
      });

      it("should add a file input with selected files to elements once", function () {
        const $form = $('<form><input type="file" name="up" multiple></form>');
        const input = $form.find("input")[0];
        selectFiles(input, ["one.txt", "two.txt"]);
        const elements = [];

        $form.formToArray(false, elements);

        assert.deepEqual(elements, [input]);
      });

      it("should skip a disabled or unnamed file input", function () {
        const $form = $('<form><input type="file" name="up" disabled><input type="file"></form>');
        selectFiles($form.find("input")[0], ["one.txt"]);
        selectFiles($form.find("input")[1], ["two.txt"]);
        const elements = [];

        const formData = $form.formToArray(false, elements);

        assert.deepEqual(formData, []);
        assert.deepEqual(elements, []);
      });
    });

    describe("elements list", function () {
      it("should push each contributing control once in data order and keep existing contents", function () {
        const $form = $(
          '<form><input name="t" value="1"><select name="m" multiple><option selected>a</option><option selected>b</option></select><input type="checkbox" name="c" checked><input type="checkbox" name="u"></form>'
        );
        const elements = ["kept"];

        $form.formToArray(false, elements);

        assert.deepEqual(elements, [
          "kept",
          $form.find('[name="t"]')[0],
          $form.find("select")[0],
          $form.find('[name="c"]')[0],
        ]);
      });

      it("should throw a TypeError when elements has no push method", function () {
        const $form = $('<form><input name="a" value="1"></form>');

        const serialize = () => $form.formToArray(false, {});

        assert.throws(serialize, TypeError);
      });
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

    it("should return the $.param string of the first form's fields", function () {
      const $form = $('<form><input name="a" value="1"><input name="b" value="2"></form>');

      const serialized = $form.formSerialize();

      assert.strictEqual(serialized, "a=1&b=2");
    });

    it("should return an empty string for an empty selection and serialize only the first form", function () {
      const $forms = $(
        '<form><input name="first" value="1"></form><form><input name="second" value="2"></form>'
      );

      const empty = $(".missing-form").formSerialize();
      const serialized = $forms.formSerialize();

      assert.strictEqual(empty, "");
      assert.strictEqual(serialized, "first=1");
    });

    it("should encode spaces per jQuery version", function () {
      const $form = $('<form><input name="a" value="x y"></form>');

      const serialized = $form.formSerialize();

      // jQuery before 3.0 encodes a space as "+" in $.param; later versions use "%20".
      const space = Number($.fn.jquery.split(".")[0]) < 3 ? "+" : "%20";
      assert.strictEqual(serialized, `a=x${space}y`);
    });

    it("should order the clicked image in place only when semantic is true", function () {
      const $form = $(
        '<form><input name="a" value="1"><input type="image" name="map" value="go"><input name="b" value="2"></form>'
      );
      $form[0].clk = $form.find('[type="image"]')[0];
      $form[0].clk_x = 3;
      $form[0].clk_y = 4;

      const semantic = $form.formSerialize(true);
      const plain = $form.formSerialize();

      assert.strictEqual(semantic, "a=1&map=go&map.x=3&map.y=4&b=2");
      assert.strictEqual(plain, "a=1&b=2&map=go&map.x=3&map.y=4");
    });

    it.fails("should send the file name when a file is selected", function () {
      const $form = $('<form><input name="a" value="1"><input type="file" name="up"></form>');
      selectFiles($form.find('[type="file"]')[0], ["x.txt"]);

      const serialized = $form.formSerialize();

      assert.strictEqual(serialized, "a=1&up=x.txt");
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

    it("should return an empty array for an empty selection", function () {
      const $fields = $();

      const values = $fields.fieldValue();

      assert.deepEqual(values, []);
    });

    it("should treat any falsy successful other than undefined as false", function () {
      const $checkbox = $('<input type="checkbox" name="c" value="v">');

      const values = [null, 0, ""].map((successful) => $checkbox.fieldValue(successful));

      assert.deepEqual(values, [["v"], ["v"], ["v"]]);
    });

    it("should return an empty array for a select-one whose selected option is disabled", function () {
      const select = $(
        '<select name="s"><option value="" selected disabled>Choose</option><option value="a">a</option></select>'
      )[0];

      const value = $.fieldValue(select);

      assert.deepEqual(value, []);
    });

    it("should return null for button-type controls and an unclicked image", function () {
      const $form = $(
        '<form><input type="button" name="ib" value="1"><button type="button" name="bb" value="2">B</button><input type="image" name="im" value="3"></form>'
      );

      const values = $form
        .find("input, button")
        .get()
        .map((el) => $.fieldValue(el));

      assert.deepEqual(values, [null, null, null]);
    });

    it("should return the value of unnamed and disabled controls when successful is false", function () {
      const unnamed = $('<input value="x">')[0];
      const disabled = $('<input name="d" value="y" disabled>')[0];

      const values = [$.fieldValue(unnamed, false), $.fieldValue(disabled, false)];

      assert.deepEqual(values, ["x", "y"]);
    });

    it("should return the value of the clicked submit button", function () {
      const $form = $('<form><input type="submit" name="go" value="Go"></form>');
      const submit = $form.find("input")[0];
      $form[0].clk = submit;

      const value = $.fieldValue(submit);

      assert.strictEqual(value, "Go");
    });

    it("should return null for a document and a text node by default", function () {
      const text = document.createTextNode("text");

      const values = [$.fieldValue(document), $.fieldValue(text)];

      assert.deepEqual(values, [null, null]);
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

    it("should skip unnamed fields when successful is false", function () {
      const $fields = $('<input value="x"><input name="a" value="1">');

      const result = $fields.fieldSerialize(false);

      assert.strictEqual(result, "a=1");
    });

    it("should return an empty string for an empty selection", function () {
      const $fields = $();

      const result = $fields.fieldSerialize();

      assert.strictEqual(result, "");
    });

    it("should serialize a file input's value string", function () {
      const $input = $('<input type="file" name="up">');
      selectFiles($input[0], ["x.txt"]);

      const result = $input.fieldSerialize();

      assert.strictEqual(result, "up=C%3A%5Cfakepath%5Cx.txt");
    });

    it.fails("should skip forms", function () {
      const $form = $('<form name="other"><input name="a" value="1"></form>');

      const result = $form.fieldSerialize();

      assert.strictEqual(result, "");
    });
  });
});
