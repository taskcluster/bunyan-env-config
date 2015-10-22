# bunyan-env-config

We want good logs.  The debug module is great, but it's a little limited for
the size of our current set of taskcluster services.  We've decided to move our
components to use something a little more powerful.  Our choice is to use the
bunyan module with a small wrapper.  The wrapper takes care of importing bunyan
and creating the root logger.  The logger returned by the setup method is a
standard bunyan root logger with the exception of a debugCompat property added.

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
'[alert-operator]' to the fatal level and all others to the warning level.  All
messages logged by debugCompat will have structured message properties of
"dbgcmpt === true" and "dbgname" set to the value that was given to the
invocation of log.debugCompat, in the preceeding example dbgname would be
'my-example:main'.  Messages with '[alert-operator]' will also have the
property "alert === true".

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
