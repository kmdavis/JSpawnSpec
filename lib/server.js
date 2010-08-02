var sys = require("sys"),
  http = require("http"),
  url = require("url"),
  fs = require("fs"),
  mimeTypes = {
    ".css"   : "text/css",
    ".htm"   : "text/html",
    ".html"  : "text/html",
    ".js"    : "text/javascript",
    ".json"  : "application/json",
    ".txt"   : "text/plain",
    ".xhtml" : "application/xhtml+xml",
    ".xml"   : "application/xml"
  },
  routes = {},
  template = function (title, html) {
    return "<html><head><title>" + (title || "jSpawnSpec") + "</title></head><body>" + (html || "") + "</body></html>";
  },
  json_template = function (data) {
    return JSON.stringify(data);
  },
  raw = function (response, filename) {
    response.writeHead(200, {"Content-Type": mimeTypes[filename.match(/\.\w*$/)[0]]});
    response.write(fs.readFileSync(filename));
  },
  render = function (request, response, action, args) {
    try {
      var content = action.call(this, request, args);
      if (!content.raw) {
        if (content.hasOwnProperty("json")) {
          if (content.pass) {
            response.writeHead(200, {"Content-Type": "text/plain"});
          } else {
            response.writeHead(500, {"Content-Type": "text/plain"});
          }
          response.write(json_template(content.json));
        } else {
          if (content.pass) {
            response.writeHead(200, {"Content-Type": "text/html"});
          } else {
            response.writeHead(500, {"Content-Type": "text/html"});
          }
          response.write(template(content.title, content.html));
        }
      } else {
        raw(response, content.filename);
      }
    } catch(e) {
      response.writeHead(500, {"Content-Type": "text/html"});
      response.write(JSON.stringify(e));
    }
    response.close();
  },
  server = http.createServer(function (request, response) {
    var parsed_url = url.parse(request.url), route, found, parsedRoute, tokens, regex, i, rawArgs, args = {};
    /*sys.log(sys.inspect({
      method: request.method,
      url: parsed_url,
      headers: request.headers
    }));
    sys.puts("");*/
    for (route in routes) {
      parsedRoute = route.replace("/", "\\/");
      tokens = parsedRoute.match(/:\w+/g) || [];
      for (i = 0; i < tokens.length; i += 1) {
        parsedRoute = parsedRoute.replace(tokens[i], "(\\w+)");
      }
      regex = new RegExp("^" + parsedRoute + "\\/?");
      if (regex.test(parsed_url.pathname)) {
        found = true;
        rawArgs = parsed_url.pathname.match(regex);
        for (i = 1; i < rawArgs.length; i += 1) {
          if (i <= tokens.length) {
            if (/^\d+$/.test(rawArgs[i])) {
              args[tokens[i - 1].replace(":", "")] = parseInt(rawArgs[i], 10);
            } else {
              args[tokens[i - 1].replace(":", "")] = rawArgs[i];
            }
          } else {
            args[i] = rawArgs[i];
          }
        }
        render(request, response, routes[route], args);
        break;
      }
    }
    if (!found) {
      response.writeHead(404, {"Content-Type": "text/html"});
      response.write(template("", "404 Not Found"));
      response.close();
    }
  }),
  portNumber = 27182,
  i; // E = 2.7182...

for (i = 2; i < process.argv.length; i += 1) {
  if (0 === process.argv[i].indexOf("-p")) {
    portNumber = parseInt(process.argv[i].match(/\-p(\d+)/)[1], 10);
  }
}

sys.puts("Starting jSpawnSpec Server on port " + portNumber);
server.listen(portNumber);

exports["get"] = function (route, callback) {
  routes[route] = callback;
};
exports["close"] = function () {
  process.nextTick(function () {
    server.close();
    process.exit();
  });
};
process.addListener("exit", function () {
  sys.puts("Shutting down");
});
process.addListener("SIGINT", function () {
  process.exit();
});