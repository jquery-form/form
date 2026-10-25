/* global $, describe, it */
// Shape of every async test in test/test.js: the assertion runs after the test has returned.
describe("when an assertion fails only inside an ajax callback", function () {
  it("should still fail the run", function () {
    $.get("ajax/text.html", function () {
      throw new Error("late assertion failure");
    });
  });
});
