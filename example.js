// First let's import the logging module
var logging = require('./lib/log') || require('./lib/log');

// Now let's create a root logger.  This can either be done using a shared
// module so that all parts of the application use the same root logger or you
// can create one per source file.  Properties in the object passed in are
// normal bunyan configuration properties.  If a property doesn't control a
// bunyan option, it'll be set as a property on all descendent loggers.
var log = logging("my-example", {});

// If we had the debug module before, we want to comment it out and replace it
// with a debug compatibility object

//var debug = require('debug')('my-example:main');
var debug = log.debugCompat('my-example:main');

// Now our calls to debug() will use bunyan instead
debug('this is a %s of json: %j formatting', 'test', {a: 1});

// Oh, and [alert-operator] is a special case for
// when we know that a message is really important
debug('[alert-operator] really important');


// That's enough about debug compatibilty, the following is about using native
// bunyan logging!

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

// This will print a message that is at the Warning level which contains the
// message as a string but also the http status as 404 and http_msg properly
// The reason we do this is so that we can parse logged messages and get useful
// information from them

// if we have a function and we are going to have a lot of log messages
// with the same data field, we can create a child logger to
// save us the typing
var child = log.child({api_method: '/v1/ping'});
child.info('hi');

// In this case, we'll see that we have a message with 'hi' and a property of
// 'api_method' that evaluates to '/v1/ping'

// An example of where child loggers are useful is in loops.  Take this example:

['us-west-1', 'us-east-1'].forEach(function(region) {
  rLog = log.child({region: region});
  ['r3-xlarge', 'r3-large'].forEach(function(type) {
    tLog = rLog.child({type: type});
    try {
      killAllInstances(region, type);
      log.info('Killed all instances');
    } catch (e) {
      log.error({err: e}, 'Error killing all instances');
    }
  });
});

// helper function for child example above, ignore
function killAllInstances(r,t) { console.log('FAKE KILLING: ' + t + ' in ' + r) }








