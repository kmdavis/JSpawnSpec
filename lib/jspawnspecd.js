var sys = require("sys"),
  fs = require("fs"),
  server = require("./server"),
  seq = 0,
  sessions = {},
  local_browsers = {
    firefox: ["/Applications/Firefox 3.6 Beta.app", "/Applications/Firefox.app"],
    safari: ["/Applications/Safari.app"]
  },
  connections = {},
  connections_length = 0,
  clone = function(obj) {
    if (typeof obj !== "object" || obj === null) {
      return obj;
    }
    var copy = obj instanceof Array ? [] : {}, i;
    for (i in obj) {
      if (obj.hasOwnProperty(i)) {
        copy[i] = clone(obj[i]);
      }
    }
    return copy;
  };

server.get("/peek", function () {
  return {
    pass: true,
    json: {
      next_sequence: seq,
      sessions: sessions,
      connections: connections,
      connections_length: connections_length
    }
  }
});

server.get("/close", function () {
  server.close();
  return {
    pass: true,
    html: "Closing Server"
  }
});

server.get("/abort/:id", function (request, args) {
  if (sessions.hasOwnProperty(args.id)) {
    // TODO: iterate thru specs, and delete from connections
    sessions[args.id] = null;
    delete sessions[args.id];
    return {
      pass: true,
      json: {
        success: true
      }
    }
  } else {
    return {
      pass: false,
      json: {
        success: false,
        msg: "No Session Found" + args.id
      }
    }
  }
});

server.get("/launch_browsers", function () {
  var i, j, stat;
  for (i in local_browsers) {
    if (local_browsers.hasOwnProperty(i)) {
      // TODO: if i is not in connections
      for (j = 0; j < local_browsers[i].length; j += 1) {
        try {
          stat = fs.statSync(local_browsers[i][j]); // check for existence of browser
          sys.puts("Launching" + local_browsers[i][j]);
          require("child_process").spawn("open", ["-g", "-a", local_browsers[i][j], "http://localhost:27182/run?local"]);
          break;
        } catch (e) {}
      }
    }
  }

  return {
    pass: true,
    json: {
      success: true
    }
  }
});

server.get("/start", function () {
  var id = (new Date()).getTime() + seq;
  seq += 1;
  sessions[id] = {
    specs: [],
    results: []
  };
  return {
    pass: true,
    json: {
      session_id: id
    }
  }
});

server.get("/test/:id((/\\w+)+\\.js)", function (request, args) {
  if (sessions.hasOwnProperty(args.id)) {
    var filename = args[2], spec = {
      id: (new Date()).getTime() + seq,
      session_id: args.id,
      path: filename,
      results: {},
      results_received: 0,
      pass_fail: null,
      msg: ""
    }, i;
    seq += 1;
    sessions[args.id].specs.push(spec);
    for (i in connections) { // copy this spec to all connections
      if (connections.hasOwnProperty(i)) {
        connections[i].specs.push(clone(spec));
      }
    }

    return {
      pass: true,
      json: {
        session_id: args.id,
        spec_file: filename
      }
    }
  } else {
    return {
      pass: false,
      json: {
        success: false,
        msg: "No Session Found"
      }
    }
  }
});

server.get("/results/:id", function (request, args) {
  if (sessions.hasOwnProperty(args.id)) {
    var results = sessions[args.id].results;
    sessions[args.id].results = [];
    return {
      pass: true,
      json: {
        session_id: args.id,
        results: results
      }
    }
  } else {
    return {
      pass: false,
      json: {
        success: false,
        msg: "No Session Found"
      }
    }
  }
});

server.get("/run", function (request) {
  var i, j, k, dup, ckey = request.headers["user-agent"].replace(/\W/g, "");
  connections[ckey] = {
    lastTS: (new Date()).getTime(),
    agentString: request.headers["user-agent"],
    specs: [],
    results: []
  };
  for (i in sessions) { // copy all pending specs from each session
    if (sessions.hasOwnProperty(i)) {
      for (j = 0; j < sessions[i].specs.length; j += 1) {
        dup = false;
        // check for duplicates, in case this is a reconnect
        for (k = 0; k < connections[ckey].specs.length && !dup; k += 1) {
          if (connections[ckey].specs[k].id === sessions[i].specs[j].id) {
            dup = true;
          }
        }
        if (!dup) {
          connections[ckey].specs.push(clone(sessions[i].specs[j]));
        }
      }
    }
  }
  j = 0;
  for (i in connections) {
    j += 1;
  }
  connections_length = j;
  return {
    raw: true,
    filename: "/web/jspawnspec/public/runner.html"
  }
});

server.get("/get", function (request) {
  var specsToSend = [], i, ckey = request.headers["user-agent"].replace(/\W/g, "");
  if (connections.hasOwnProperty(ckey)) {
    connections[ckey].lastTS = (new Date()).getTime();
    for (i = 0; i < Math.min(5, connections[ckey].specs.length); i += 1) {
      specsToSend.push(connections[ckey].specs[i]);
    }
    return {
      pass: true,
      json: {
        specs: specsToSend
      }
    }
  } else {
    return {
      pass: false,
      json: {
        success: false,
        msg: "No Connection Found"
      }
    }
  }
});

server.get("/done/:id(/(\\d))+(/([\\w\\s\\.\\%]+))*", function (request, args) {
  var i, j, k, l, m, max, found = false, pass = true, results = [], msg = "", ckey = request.headers["user-agent"].replace(/\W/g, "");
  if (connections.hasOwnProperty(ckey)) {
    connections[ckey].lastTS = (new Date()).getTime();
    for (i = 0; i < connections[ckey].specs.length && !found; i += 1) {
      if (connections[ckey].specs[i].id === args.id) {
        for (j in args) {
          if ("id" !== j && args.hasOwnProperty(j) && undefined !== args[j] && "/" !== args[j][0]) {
            if (1 === args[j].length) {
              results.push("1" === args[j]);
              if (pass && "1" !== args[j]) {
                pass = false;
              }
            } else {
              msg += args[j];
            }
          }
        }
        sys.puts("RESULTS: " + sys.inspect(results));
        connections[ckey].specs[i].results = results;
        connections[ckey].specs[i].msg = msg;
        connections[ckey].specs[i].pass_fail = pass;
        connections[ckey].results.push(connections[ckey].specs.splice(i, 1)[0]);

        found = true;
      }
    }
    if (!found) {
      return {
        pass: false,
        json: {
          success: false,
          msg: "No Test Found"
        }
      }
    }
    found = false;
    for (j in sessions) {
      if (sessions.hasOwnProperty(j)) {
        for (i = 0; i < sessions[j].specs.length && !found; i += 1) {
          if (sessions[j].specs[i].id === args.id) {
            sessions[j].specs[i].results[ckey] = results;
            sessions[j].specs[i].msg += msg;
            sessions[j].specs[i].results_received += 1;
            if (sessions[j].specs[i].results_received === connections_length) {
              results = [];
              sessions[j].specs[i].pass_fail = true;
              //sys.puts(sys.inspect(sessions[j].specs[i].results[ckey])); // was [true]
              max = sessions[j].specs[i].results[ckey].length;
              for (l in sessions[j].specs[i].results) { // more expensive operation, so don't repeat it
                if (sessions[j].specs[i].results.hasOwnProperty(l)) {
                  m = true;
                  for (k = 0; k < max; k += 1) {
                    m = m && sessions[j].specs[i].results[l][k];
                    if (undefined == results[k]) {
                      results[k] = sessions[j].specs[i].results[l][k]
                    } else {
                      results[k] = results[k] && sessions[j].specs[i].results[l][k]
                    }
                  }
                  sessions[j].specs[i].pass_fail = sessions[j].specs[i].pass_fail || m;
                }
              }
              //sys.puts(sys.inspect(results)); // was []
              sessions[j].specs[i].results = results; // combined results
              sessions[j].results.push(sessions[j].specs.splice(i, 1)[0]);
            }
            found = true;
          }
        }
        if (found) {
          break;
        }
      }
    }
    return {
      pass: true,
      json: {
        success: true
      }
    }
  } else {
    return {
      pass: false,
      json: {
        success: false,
        msg: "No Connection Found"
      }
    }
  }
});
