import { assert, describe, it } from "vitest";
import { getDoc, httpData, readResponse } from "../../src/iframe-response.js";

describe("iframe response reader", function () {
  function parse(markup, type) {
    return new DOMParser().parseFromString(markup, type || "text/html");
  }

  function mockXhr() {
    return { status: 0, statusText: "n/a", responseText: null, responseXML: null };
  }

  describe("getDoc", function () {
    it("should return the frame's content document", function () {
      const doc = parse("<p>hi</p>");

      const result = getDoc({ contentDocument: doc });

      assert.strictEqual(result, doc);
    });
  });

  describe("readResponse", function () {
    it("should read the body markup and the emulated status of an HTML document", function () {
      const doc = parse('<body status="201" statusText="Created"><b>ok</b></body>');
      const xhr = mockXhr();

      const result = readResponse(doc, xhr, {});

      assert.deepEqual(result, { status: "success", data: "<b>ok</b>", errMsg: undefined });
      assert.strictEqual(xhr.status, 201);
      assert.strictEqual(xhr.statusText, "Created");
      assert.strictEqual(xhr.responseXML, doc);
    });

    it("should detect an XML document and return it as the data", function () {
      const doc = parse("<root><item>1</item></root>", "application/xml");
      const xhr = mockXhr();
      const s = {};

      const result = readResponse(doc, xhr, s);

      assert.strictEqual(result.data, doc);
      assert.strictEqual(s.dataType, "xml");
      assert.strictEqual(xhr.getResponseHeader("Content-Type"), "xml");
    });

    it("should keep the markup of an HTML response that contains a textarea", function () {
      const doc = parse("<body><textarea>inner</textarea></body>");
      const xhr = mockXhr();

      const result = readResponse(doc, xhr, { dataType: "html" });

      assert.strictEqual(result.data, "<textarea>inner</textarea>");
    });

    it("should keep the body markup with the textarea option when no textarea is found", function () {
      const doc = parse("<body><b>bold</b></body>");
      const xhr = mockXhr();

      const result = readResponse(doc, xhr, { dataType: "html", textarea: true });

      assert.strictEqual(result.data, "<b>bold</b>");
    });

    it("should parse JSON from the body text when there is no pre or textarea", function () {
      const doc = parse('<body>{"a":"x &amp; y"}</body>');
      const xhr = mockXhr();

      const result = readResponse(doc, xhr, { dataType: "json" });

      assert.deepEqual(result.data, { a: "x & y" });
    });

    it("should parse JSON embedded in a textarea", function () {
      const doc = parse('<textarea status="202">{"a":1}</textarea>');
      const xhr = mockXhr();

      const result = readResponse(doc, xhr, { dataType: "json" });

      assert.strictEqual(xhr.responseText, '{"a":1}');
      assert.strictEqual(xhr.status, 202);
      assert.strictEqual(result.status, "success");
    });

    it("should read JSON text wrapped in a pre element", function () {
      const doc = parse('<pre>{"a":1}</pre>');
      const xhr = mockXhr();

      readResponse(doc, xhr, { dataType: "json" });

      assert.strictEqual(xhr.responseText, '{"a":1}');
    });

    it("should report a parsererror when dataFilter throws", function () {
      const doc = parse("<p>x</p>");
      const xhr = mockXhr();
      const failure = new Error("bad");
      const s = {
        dataFilter: function () {
          throw failure;
        },
      };

      const result = readResponse(doc, xhr, s);

      assert.strictEqual(result.status, "parsererror");
      assert.strictEqual(result.errMsg, failure);
      assert.strictEqual(xhr.error, failure);
    });

    it("should report an error when reading the document throws", function () {
      const failure = new Error("unreadable");
      const doc = new Proxy(parse("<p>x</p>"), {
        get: (target, name) => {
          if (name === "body") {
            throw failure;
          }
          const value = Reflect.get(target, name);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
      const xhr = mockXhr();

      const result = readResponse(doc, xhr, { dataType: "text" });

      assert.deepEqual(result, { status: "error", data: undefined, errMsg: failure });
      assert.strictEqual(xhr.error, failure);
    });
  });

  describe("httpData", function () {
    it("should parse JSON text when no dataType is given and the content type is json", function () {
      const xhr = {
        responseText: '{"a":1}',
        getResponseHeader: function () {
          return "application/json";
        },
      };

      const data = httpData(xhr, "", null);

      assert.deepEqual(data, { a: 1 });
    });
  });
});
