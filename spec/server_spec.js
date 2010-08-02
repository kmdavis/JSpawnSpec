describe("lib/test_server.js", function (server) {
  after(function () {
    get("http://localhost:27182/close");
  });
  it("should get a page", function () {
    get("http://localhost:27182/test", function (response) {
      response.should(contain, "Test Passed");
      response.should_not(contain, "Test Failed");
    });
  });
  it("should parse args", function () {
    get("http://localhost:27182/echo/foo", function (response) {
      response.should(contain, "foo");
    });
  });
});