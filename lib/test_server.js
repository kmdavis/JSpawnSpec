var server = require("./server");
server.get("/test", function () {
  return {
    pass: true,
    html: "Test Passed"
  }
});
server.get("/echo/:name", function (args) {
  return {
    pass: true,
    html: args.name
  };
});
server.get("/close", function () {
  server.close();
  return {
    pass: true,
    html: "Shutting Down"
  }
});