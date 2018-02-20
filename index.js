// We only use this here because we want *something* to output if we fail to
// initialize the backing logging library
let bunyan = require('bunyan');
let assume = require('assume');
let util = require('util');
let minimatch = require('minimatch');

let allowedLevels = Object.keys(bunyan.levelFromName);

/**
 * Parse a string into a mapping of logger names to levels to determine which
 * level of logging a given logging module should use.  This is done so that we
 * can optionally have Trace level for what you're working on but then only
 * have warnings and higher for the rest of the code.  This is similar in
 * concept to the debug module, but needs higher granularity because we have
 * more than one log level.  There is currently no globbing support so you will
 * have to specify all 'name' values in the variable as fully resolved.  The
 * special value '*' as a name sets the log level for all levels not mentioned.
 *
 * Example Variable: "provisioner:trace, api:info,azure-entities:error, *:fatal"
 */
function parseEnvironment(env, cfg) {
  assume(cfg).is.an('object');
  let _default = cfg.level || 'info';
  if (!env || env === '') {
    return _default;
  }
  assume(env).is.a('string');
  let modules = env.split(',').map(x => x.trim());
  for (let x of modules) {
    let tokens = x.split(':');
    if (tokens.length < 2) {
      let errStr = 'Log levels must use format name:level ' +
        'not ' + tokens.join(':');
      throw new Error(errStr);
    }
    let level = tokens.slice(tokens.length - 1)[0];
    let name = tokens.slice(0, tokens.length - 1).join(':');
    if (allowedLevels.indexOf(level) === -1) {
      let errStr = 'Invalid log level setting: ' + level;
      throw new Error(errStr);
    }
    if (minimatch(cfg.name, name)) {
      return level;
    }
  }

  return _default;
}

/**
 * Create a root logger with the name given by name.  The object returned from
 * this function is a root logger.  The design is that each service, component
 * or library will use a single root logger object that's initialised a single
 * time.
 *
 * A configuration can be passed in as the second parameter.  This object must
 * be a valid bunyan logging configuration.
 */
function setupLogger(name, cfg) {
  assume(name).is.a('string');
  if (cfg) {
    assume(cfg).is.an('object');
    assume(cfg).not.includes('name');
  } else {
    cfg = {};
  }
  cfg.name = name;

  // Sometimes, just make it easy to have everything show the file and line
  // number.  This is supposed to be quite slow, so the name is what it is to
  // make it impossible to claim you didn't know it made things slow
  if (process.env.FORCE_LOG_LINE_NUMBERS_AND_BE_SLOW === '1') {
    cfg.src = true;
  }

  // We want to be able to override whatever the library or application has
  // specified by changing only an evironment variable.
  let envLevel = parseEnvironment(process.env.LOG_LEVEL, cfg);
  let oldLevel = cfg.level;
  cfg.level = envLevel;
  let logger = bunyan.createLogger(cfg);

  // But let's make it clear that we did this by logging
  if (oldLevel) {
    if (oldLevel !== envLevel) {
      logger.warn({
        requested: oldLevel,
        used: envLevel,
      }, 'using log level from environment instead of code');
    }
  }

  assume(logger).does.not.include('debugCompat');
  logger.debugCompat = makeCompat(logger);
  return logger;
}

/**
 * We export the bunyan module as a convenience
 */
setupLogger.bunyan = bunyan;

/**
 * We export the parseEnvironment function so that unit testing 
 * can be done easily
 */
setupLogger.__parseEnv = parseEnvironment;

/**
 * In order to ease the transition from using the debug module for logging to
 * using this library, we have a function that allows the root logger to expose
 * an api similar to the debug module.  The first returned function takes a
 * name to use as the debug name and returns a function which accepts log
 * messages.  The log messages can use util.format formatting to produce
 * desired output.
 *
 * This method does not inspect the debug module's DEBUG environment variable
 * although that would be a good idea.
 */
function makeCompat(logger) {
  return function(name) {
    return function(...x) {
      assume(x).is.an('array');
      assume(x.length).greaterThan(0);
      let msg = util.format.apply(null, x);
      let level = 'warn';
      let msgObj = {
        dbgname: name,
        dbgcmpt: true,
      };
      if (msg.match(/\[alert-operator\]/)) {
        level = 'fatal';
        msgObj.alert = true;
      }
      logger[level].call(logger, msgObj, msg);
    };
  };
}

module.exports = setupLogger;
