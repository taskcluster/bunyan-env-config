# bunyan-env-config

A small configuration wrapper around Bunyan logging.  This module's main
purpose is to contain all the taskcluster boiler plate and configuration logic
around logging with Bunyan.

We want to use Bunyan logging in our applications so that our logs are easy to
parse and obtain insights from.  When we use bunyan, we can start putting lots
of things in our logs easily and use those to monitor our systems.  We can also
submit things to security monitoring systems a lot easier if we can combine the
logging messages with the security forwarding.

One of the complexities of using bunyan is that it's a very configurable library.
Our usage is currently limited to printing to standard output and forwarding
that output to a log aggregator.

## Log Level Configuration
write this when we finalise the format

## Api
The logging object returned by this module is just a bunyan object with a
debugCompat property on the root logger.  All bunyan APIs after the initial
configuration continue to apply.  When reading bunyan docs, this library
replaced only the bunyan.createLogger call.

## Usage
The intention is for each application to only call the function exported by
this module once.  In a single js-file library, just do that in your code
directly.  In larger applications, the suggested method is to create a small
file (`lib/log.js`) file which sets up the logging for your whole application.
Since `require()` will cache that module, you'll be sharing the same root
logger in all of your code.

This library targets applications which run on systems like Heroku which
capture stdio streams and forward them onto a log aggregator.

Right now, we're relying on applications to figure out for themselves how
they'd like to figure out what object to pass into logging function.  One idea
would be to have a file like:
```javascript
module.exports = require('bunyan-env-config')('my-app', {});
```

## Example code
There is a short [example file](example.js) that demonstrates the minimal
amount of code to start logging messages using the supported methods

If you'd like pretty printed output, try running:
```
node example.js | ./node_modules/.bin/bunyan
```

## Debug Module Compatibility
In order to ease the transition from our usage of the debug module, we have a
compatibility interface.  This interface requires a configured root logger and
is exposed as the debugCompat property on the root logger.  We only worry about
the part of the API that does log message generation, not the part that deals
with controlling output of debug.

Here are the changes required to switch from the old
```javascript
// First we want to comment out or remove the old debug module
// var debug = require('debug')('my-example:main');

// We need to initialise the logging library
var log = logging("my-example", {});

// We treat the log.debugCompat function as if it were the value
// returned by 'require("debug")'
var debug = log.debugCompat('my-example:main');

// Now our calls to debug() will use bunyan instead
debug('this is a %s of json: %j formatting', 'test', {a: 1});
```

In the debugCompat module we log messages that contain the string
`[alert-operator]` to the fatal level and all others to the warning level.  All
messages logged by debugCompat will have structured message properties of
`dbgcmpt === true` and `dbgname` set to the value that was given to the
invocation of `og.debugCompat` in the preceeding example dbgname would be
'my-example:main'.  Messages with `[alert-operator]` will also have the
property `alert === true`.
