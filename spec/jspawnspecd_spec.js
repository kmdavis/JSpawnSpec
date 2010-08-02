describe("lib/jspawnspecd.js", function (server) {
  var session_id;
  describe("session setup", function () {
    it("should start a new session", function () {
      get("http://localhost:27182/start", function (response) {
        response.should(contain, "session_id");
        session_id = JSON.parse(response).session_id;
      });
    });
    it("should add tests", function () {
      get("http://localhost:27182/test/" + session_id + "/foo/bar1.js", function (response) {
        response.should(contain, "/foo/bar1.js");
      });
      get("http://localhost:27182/test/" + session_id + "/foo/bar2.js", function (response) {
        response.should(contain, "/foo/bar2.js");
      });
      get("http://localhost:27182/test/" + session_id + "/foo/bar3.js", function (response) {
        response.should(contain, "/foo/bar3.js");
      });
    });
    it("should return no results", function () {
      get("http://localhost:27182/results/" + session_id, function (response) {
        JSON.parse(response).results.should(equal, []);
      });
    })
  });
  
  describe("client setup", function () {
    var test_ids;
    it("should get the runner", function () {
      get("http://localhost:27182/run", function (response) {
        response.should(contain, "<html>");
      });
    });
    it("should get a test", function () {
      get("http://localhost:27182/get", function (response) {
        JSON.parse(response).specs.should(be_a, Array);
        var specs = JSON.parse(response).specs;
        test_ids = [specs[0].id, specs[1].id, specs[2].id];
      });
    });
    it("should send results", function () {
      get("http://localhost:27182/done/" + test_ids[0] + "/0/0", function (response) { // fail
        response.should(contain, "success");
      });
      get("http://localhost:27182/done/" + test_ids[1] + "/1/1", function (response) { // pass
        response.should(contain, "success");
      });
      get("http://localhost:27182/done/" + test_ids[2] + "/1/0", function (response) { // fail
        response.should(contain, "success");
      });
    });
  });

  describe("results", function () {
    
  });
});