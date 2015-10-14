// We only use this here because we want *something* to output if we fail to
// initialize the backing logging library
let debug = require('debug')('taskcluster-logging');
let _ = require('lodash');
let bunyan = require('bunyan');
let assume = require('assume');
let util = require('util');

let allowedLevels = _.keys(bunyan.levelFromName);

function setupLogger(cfg) {
  assume(cfg).is.an('object');
  assume(cfg).includes('name');
  cfg = _.clone(cfg);

  // Sometimes, just make it easy to have everything show the file and line
  // number.  This is supposed to be quite slow, so the name is what it is to
  // make it impossible to claim you didn't know it made things slow
  if (process.env.SHOW_LOG_LINE_NUMBERS_AND_BE_SLOW === '1') {
    cfg.src = true;
  }

  let logger = bunyan.createLogger(cfg);

  if (process.env.LOG_LEVEL) {
    assume(allowedLevels).includes(process.env.LOG_LEVEL);
    logger.level(process.env.LOG_LEVEL);
  } else if (!cfg.level) {
    logger.level('info');
  }
  assume(logger).does.not.include('debugCompat');
  logger.debugCompat = makeCompat(logger);
  return logger;
}

// For unit testing!
setupLogger.bunyan = bunyan

// To support migration away from the debug module that we used to use, we have
// a compatibility function which we use to provide the same interface as the
// debug module.  We default to the WARN log level for all compatibility
// messages which do not contain the '[alert-operator]' substring.  This
// substring is a common convention in taskcluster components written with the
// debug module and should be treated as something which needs to be handled.
function makeCompat(logger) {
  return function(...x) {
    assume(x).is.an('array');
    assume(x.length).greaterThan(0);
    assume(x[0]).is.ok();
    assume(x[0]).is.a('string');
    let msg = util.format.apply(null, x);
    let level = 'warn';
    let msgObj = {
      dbgcmpt: true,
    };
    if (msg.match(/\[alert-operator\]/)) {
      level = 'fatal';
      msgObj.alert = true;
    }
    logger[level].call(logger, msgObj, msg);
  }
}

module.exports = setupLogger;
