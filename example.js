// First let's import the logging module.
var logging = require('./lib/log');

// Now, let's create a module-level object.  The name
// parameter is mandatory and should be the name of your
// app.  The object passed in here is just a bunyan log
// config object.
var log = logging("my-example", {module: "main"});

// Now if we had the debug module before, we want to comment
// it out and replace it with a debug compatibility object
//var debug = require('debug')('my-example:main');
var debug = log.debugCompat('my-example:main');

// Now our calls to debug() will use bunyan instead
debug('this is a %s of json: %j formatting', 'test', {a: 1});

// Oh, and [alert-operator] is a special case for
// when we know that a message is really important
debug('[alert-operator] really important');

// We can also use the nice bunyan API directly.  You
// must call the logger object's level methods.  These are
// trace, debug, info, warn, error, fatal
log.trace('trace');
log.debug('debug');
log.info('info');
log.warn('warn');
log.error('error');
log.fatal('fatal');

// The main reason we're using bunyan is to get structured logging.
// Here's how we do it:
log.warn({
  http_status: 404,
  http_msg: 'resource-not-found'
}, "failed api call")

// if we have a function and we are going to have a lot of log messages
// with the same data field, we can create a child logger to 
// save us the typing
var child = log.child({api_method: '/v1/ping'});
child.info('hi');
