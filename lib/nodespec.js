require.paths.push(__dirname);

Array.prototype.last = function () {
  return this[this.length - 1];
};

var sys = require("sys"),
  fs = require("fs"),
  url = require("url"),
  http = require("http"),

  getSpecPaths = function (prefix, paths) {
    for (var i = 0, j, tmp, list = []; i < paths.length; i += 1) {
      if (/\.js$/.test(paths[i])) {
        list.push(prefix + paths[i]);
      } else if(!/\.\w+$/.test(paths[i])) {
        list.push.apply(list, getSpecPaths(prefix + paths[i] + "/", fs.readdirSync(prefix + paths[i])));
      }
    }
    return list;
  },
  specsToRun = getSpecPaths(__dirname.replace("/lib", "") + "/", process.argv.slice(2)),

  isEqualReturn = isEqualReturn=function(a,b,d){return d&&!a?b:a},
  isEqual = function(a,b,d){var c;if("number"===typeof a&&b instanceof Number||"number"===typeof b&&a instanceof Number||"string"===typeof a&&b instanceof String||"string"===typeof b&&a instanceof String||"boolean"===typeof a&&b instanceof Boolean||"boolean"===typeof b&&a instanceof Boolean)return isEqualReturn(a.toString()===b.toString(),"are of equivalent type but are not equal",d);if(typeof a!==typeof b)return isEqualReturn(false,"are not of the same type", d);if("object"===typeof a&&null!==a){if(a instanceof Array&&b instanceof Array){if(a.length!==b.length)return isEqualReturn(false,"are different length arrays",d);for(c=0;c<a.length;c+=1)if(!isEqual(a[c],b[c]))return isEqualReturn(false,"element "+c+" of these arrays is different",d);return isEqualReturn(true,"are identical arrays",d)}if(a instanceof Array||b instanceof Array)return isEqualReturn(false,"one is an array, the other is not",d);for(c in a)if(a.hasOwnProperty(c)){if(!b.hasOwnProperty(c))return isEqualReturn(false, "A has a property "+c+" that B does not",d);if(!isEqual(a[c],b[c]))return isEqualReturn(false,"property "+c+" of these arrays is different",d)}for(c in b)if(b.hasOwnProperty(c))if(!a.hasOwnProperty(c))return isEqualReturn(false,"B has a property "+c+" that A does not",d);if(a.toString instanceof Function){if(b.toString instanceof Function)return isEqualReturn(a.toString()===b.toString(),"they are functions that have different string representations",d);return isEqualReturn(false,"A is a function, but B is not", d)}return isEqualReturn(true,"they are identical objects",d)}return isEqualReturn(a===b,"they are of the same type, but are not equal",d)},

// SPEC RUNNER
  descriptions = [],
  startTime = new Date(),
  pendingSpecs = [],
  pendingExpects = 0,
  expectations = 0,
  failures = [],
  currentItDescription = "",
  debug_mode = false,

  error = function (desc, msg, error) {
    failures.push(desc + msg + (error || "").toString());
  },

  callOrEnqueue = function (callback, args) {
    if (0 === pendingExpects) {
      callback.apply(this, args || []);
    } else {
      pendingSpecs.push(function () {
        callback.apply(this, args || []);
      });
    }
  },
  dequeue = function () {
    if (0 === pendingExpects && pendingSpecs.length) {
      pendingSpecs.shift()();
    }
  },

  oncomplete = function () {
    sys.puts("");
    if (0 !== failures.length) {
      for (var i = 0; i < failures.length; i += 1) {
        sys.puts((i + 1) + ") \u001B[31m" + failures[i] + "\u001B[0m");
      }
    }
    sys.puts(expectations + " test(s), " + failures.length + " failure(s)");
    sys.puts( (((new Date).getTime() - startTime.getTime()) / 1000) + " seconds elapsed");
    process.exit();
  },

  noop = function () {},
  describe = function (text, callback) {
    callOrEnqueue(function () {
      descriptions.push({
        description: text,
        beforeEach: [],
        afterEach: [],
        after: []
      });
      var context = null;
      if (1 === descriptions.length) {
        descriptions.last().after.push(oncomplete);
        if (-1 !== text.indexOf(".js")) {
          context = require("child_process").spawn("node", [__dirname.replace("/lib", "/") + text]);
        } else if (/^\.?\/?(\w+\/)*\w+$/.test(text)) {
          context = require(__dirname.replace("/lib", "/") + text); // TODO: this part hasn't been tested yet
        }
      }
      callback(context);
      callOrEnqueue(function () {
        var afters = descriptions.pop().after, i;
        for (i = 0; i < afters.length; i += 1) {
          afters[i]();
        }
        dequeue();
      }, null);
    }, null);
  },
  before = function (callback) {
    callback();
  },
  beforeEach = function (callback) {
    descriptions.last().beforeEach.push(callback);
  },
  afterEach = function (callback) {
    descriptions.last().afterEach.push(callback);
  },
  after = function (callback) {
    descriptions.last().after.push(callback);
  },

  descString = function () {
    var result = "", i;
    for (i = descriptions.length - 1; i >= 0; i -= 1) {
      result += descriptions[i].description + " ";
    }
    return result + currentItDescription + " ";
  },

  it = function (text, callback) {
    callOrEnqueue(function () {
      var afters = [], i, j, desc, timeout;
      for (i = 0; i < descriptions.length; i += 1) {
        for (j = 0; j < descriptions[i].beforeEach.length; j += 1) {
          descriptions[i].beforeEach[j]();
        }
        for (j = 0; j < descriptions[i].afterEach.length; j += 1) {
          afters.push(descriptions[i].afterEach[j]);
        }
      }
      desc = descString();
      currentItDescription = text;
      pendingExpects = callback ? (callback.toString().replace(/\n|\r/g, "").match(/[\{\};]\s*expect\s*\(|\.\s*should\s*\(|\.\s*should_not\s*\(/g) || []).length : 0;
      if (0 === pendingExpects) {
        sys.print("\u001B[33m.\u001B[0m");
      } else {
        try {
          callback();
        } catch (err) {
          error(desc, " error: ", err);
        }
        if (0 !== pendingExpects) {
          timeout = setTimeout(function () {
            expectations += pendingExpects;
            error(desc, "timed out");
            for (var i = 0; i < pendingExpects; i += 1) {
              sys.print("\u001B[31m.\u001B[0m");
            }
            pendingExpects = 0;
            dequeue();
          }, 5000);
        }
        callOrEnqueue(function () {
          clearTimeout(timeout);
          for (i = 0; i < afters.length; i += 1) {
            afters[i]();
          }
          dequeue();
        }, null);
      }
    }, null);
  },
  matchers = {
    equal: function (actual, expected) {
      if (isEqual(actual, expected)) {
        return {
          pass: true,
          desc: JSON.stringify(actual) + " === " + JSON.stringify(expected)
        }
      } else {
        return {
          pass: false,
          desc: JSON.stringify(actual) + " !== " + JSON.stringify(expected)
        }
      }
    },
    contain: function (actual, expected) {
      if (actual instanceof Array) {
        for (var i = 0; i < actual.length; i += 1) {
          if (isEqual(actual[i], expected)) {
            return {
              pass: true,
              desc: JSON.stringify(actual) + " contains " + JSON.stringify(expected)
            }
          }
        }
      } else if (actual instanceof String || "string" === typeof actual) {
        if (-1 !== actual.indexOf(expected)) {
          return {
            pass: true,
              desc: JSON.stringify(actual) + " contains " + JSON.stringify(expected)
          }
        }
      } else if (actual instanceof Object) {
        if (actual.hasOwnProperty(expected)) {
          return {
            pass: true,
              desc: JSON.stringify(actual) + " contains " + JSON.stringify(expected)
          }
        }
      }
      return {
        pass: false,
        desc: JSON.stringify(actual) + " did not contain " + JSON.stringify(expected)
      }
    },
    be_a: function (actual, expected) {
      if (("string" === typeof(expected) && expected === typeof(actual)) || ("function" === typeof(expected) && actual instanceof expected)) {
        return {
          pass: true,
          desc: JSON.stringify(actual) + " is a " + ("string" === typeof expected ? expected : expected.name || typeof expected)
        }
      }
      return {
        pass: false,
        desc: JSON.stringify(actual) + " is not a " + ("string" === typeof expected ? expected : expected.name || typeof expected)
      }
    }
  },
  expect = function (actual) {
    expectations += 1;
    var desc = descString();
    if (0 < pendingExpects) {
      pendingExpects -= 1;
      return {
        to: function (op, expected) {
          var result = op(actual, expected);
          if (!result.pass) {
            sys.print("\u001B[31m.\u001B[0m");
            error(desc, result.desc);
          } else {
            sys.print("\u001B[32m.\u001B[0m");
          }
          dequeue();
        },
        not_to: function (op, expected) {
          var result = op(actual, expected);
          if (result.pass) {
            sys.print("\u001B[31m.\u001B[0m");
            error(desc, result.desc);
          } else {
            sys.print("\u001B[32m.\u001B[0m");
          }
          dequeue();
        }
      };
    } else {
      return {
        to: function () {
          dequeue();
        },
        not_to: function () {
          dequeue();
        }
      };
    }
  },
  xexpect = function () {
    return {
      to: noop,
      not_to: noop
    };
  },
  get = function (uri, callback) {
    var parsedUrl = url.parse(uri);
    http.createClient(parsedUrl.port, parsedUrl.hostname)
      .request("GET", parsedUrl.pathname + (parsedUrl.search || ""), { host: parsedUrl.hostname })
      .addListener("response", function (response) {
        response.addListener("data", function (body) {
          callback(body.toString());
        });
      }).close();
  };

Object.prototype.should = function (op, expected) {
  if (0 < pendingExpects) {
    expectations += 1;
    pendingExpects -= 1;
    var result = op(this, expected), desc = descString();
    if (!result.pass) {
      sys.print("\u001B[31m.\u001B[0m");
      error(desc, result.desc);
    } else {
      sys.print("\u001B[32m.\u001B[0m");
    }
    dequeue();
  }
};
Object.prototype.should_not = function (op, expected) {
  if (0 < pendingExpects) {
    expectations += 1;
    pendingExpects -= 1;
    var result = op(this, expected), desc = descString();
    if (result.pass) {
      sys.print("\u001B[31m.\u001B[0m");
      error(desc, result.desc);
    } else {
      sys.print("\u001B[32m.\u001B[0m");
    }
    dequeue();
  }
};

GLOBAL["describe"] = describe;
GLOBAL["context"] = describe;
GLOBAL["it"] = it;
GLOBAL["expect"] = expect;

GLOBAL["xdescribe"] = noop;
GLOBAL["xcontext"] = noop;
GLOBAL["xit"] = noop;
GLOBAL["xexpect"] = xexpect;

GLOBAL["before"] = before;
GLOBAL["beforeEach"] = beforeEach;
GLOBAL["afterEach"] = afterEach;
GLOBAL["after"] = after;


GLOBAL["get"] = get;

for (var i in matchers) {
  GLOBAL[i] = matchers[i];
}

sys.puts("(in " + __dirname.replace("/lib", "") + ")");

for (i = 0; i < specsToRun.length; i += 1) {
  require(specsToRun[i].replace(".js", ""));
}
