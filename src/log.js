// We only use this here because we want *something* to output if we fail to
// initialize the backing logging library
let debug = require('debug')('taskcluster-logging');
let _ = require('lodash');
let bunyan = require('bunyan');
let assume = require('assume');
let util = require('util');

let allowedLevels = _.keys(bunyan.levelFromName);

/**
 * Take an environment variable, turn it into pairings
 * of name:level strings and then determine if the parameter
 * `name` has a level.  If there's a level for that name,
 * return the string associated with it, otherwise return default
 *   env has the format: a: info,b:warn,*:fatal
 * * is the default log level.  If there's not a default specified
 * and the 'name' doesn't have a setting, the info level is used
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
    let [n, l] = x.split(':');
    if (allowedLevels.indexOf(l) === -1) {
      throw new Error('Invalid log level setting "' + x + '"');
    }
    if (n === '*') {
      _default = l;
    } else if (n === cfg.name) {
      return l;
    }
  }

  return _default;
}

function setupLogger(name, cfg) {
  assume(name).is.a('string');
  assume(cfg).is.an('object');
  // negate this check
  //assume(cfg).includes('name');
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
        used: envLevel
      }, 'using log level from environment instead of code');
    }
  }

  assume(logger).does.not.include('debugCompat');
  logger.debugCompat = makeCompat(logger);
  return logger;
}

// For unit testing!
setupLogger.bunyan = bunyan
setupLogger.__parseEnv = parseEnvironment;

// To support migration away from the debug module that we used to use, we have
// a compatibility function which we use to provide the same interface as the
// debug module.  We default to the WARN log level for all compatibility
// messages which do not contain the '[alert-operator]' substring.  This
// substring is a common convention in taskcluster components written with the
// debug module and should be treated as something which needs to be handled.
function makeCompat(logger) {
  return function(name) {
    return function(...x) {
      assume(x).is.an('array');
      assume(x.length).greaterThan(0);
      assume(x[0]).is.ok();
      assume(x[0]).is.a('string');
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
    }
  }
}

module.exports = setupLogger;
