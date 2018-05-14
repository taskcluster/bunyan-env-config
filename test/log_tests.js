let logging = require('../');
let sinon = require('sinon');
let assume = require('assume');
let assert = require('assert');
let bunyan = require('bunyan');
let http = require('http');

let MemoryStream = require('memorystream');

if (process.env.LOG_LEVEL) {
  throw new Error('Do not run tests with LOG_LEVEL set');
}

describe('logs', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('initialization', () => {
    it('should default to level INFO', () => {
      let createLogger = sandbox.spy(logging.bunyan, 'createLogger');
      let result = logging('test', {});
      let expected = {
        name: 'test',
        level: 'info',
        serializers: sinon.match.any,
      };

      sandbox.assert.calledWithExactly(createLogger, expected);
    });

    let goodEnvs = [
      ['test:info', 'test', 'info'],
      ['test:with:lots:of:colons:warn', 'test:with:lots:of:colons', 'warn'],
      ['test*:warn', 'testing', 'warn'],
      ['testing:athing*:warn', 'testing:athingwell', 'warn'],
      ['*:warn', 'a:thing', 'warn'],
      ['*test:warn', 'atest', 'warn'],
    ];

    for (let [env, name, expected] of goodEnvs) {
      it('should parse ' + env + ' from ' + name + ' to ' + expected, () => {
        let cfg = {
          name: name,
          level: 'trace',
        };
        assume(logging.__parseEnv(env, cfg)).equals(expected);
      });
    }

    let badEnvs = [
      'abcd',
      'no:level',
      'nopatternsinleves:info*',
    ];

    for (let x of badEnvs) {
      it('should throw for invalid env ' + x, () => {
        try {
          assume(logging.__parseEnv(x, {name: 'a'}));
          throw new Error('this env should raise! ' + x);
        } catch (err) {
          if (!err.message.match(/^Log levels must use format/) &&
              !err.message.match(/^Invalid log level setting/)) {
            throw err; // return or we get multiple done() calls
          }
        }
      });
    }
  });

  describe('functionality', () => {
    let log;
    let output;

    beforeEach(done => {
      output = '';
      let out = new MemoryStream();
      out.on('data', chunk => {
        output += chunk.toString();
      });

      //out.pipe(process.stdout, { end: false });
      log = logging('test', {
        stream: out,
        level: 'trace',
      });

      // We want to clear out the log messages that might have been printed
      // from initializing the logging library
      process.nextTick(() => {
        output = '';
        done();
      });

    });

    it('should have a compat function that returns a function', () => {
      assume(log.debugCompat).is.a('function');
      assume(log.debugCompat('hihihi')).is.a('function');
    });

    it('compat should write to the warning level by default', done => {
      log.debugCompat('hi')('hello %s', 'world');
      // We need to skip a turn so that the stream has a chance to
      // process the 'on -> data' handler before we try to consume
      // the thing made in that handler
      process.nextTick(() => {
        let parsed = JSON.parse(output);
        assume(parsed.level).equals(40);
        assume(parsed.dbgcmpt).equals(true);
        assume(parsed.dbgname).equals('hi');
        assume(parsed.alert).is.falsely();
        assume(parsed.msg).equals('hello world');
        done();
      });
    });

    it('compat should write to the fatal level with [alert-operator]', done => {
      log.debugCompat('hi')('[alert-operator] hi!');

      // We need to skip a turn so that the stream has a chance to
      // process the 'on -> data' handler before we try to consume
      // the thing made in that handler
      process.nextTick(() => {
        let parsed = JSON.parse(output);
        assume(parsed.level).equals(60);
        assume(parsed.alert).equals(true);
        assume(parsed.msg).equals('[alert-operator] hi!');
        done();
      });
    });

    for (let x of ['string', 123, '', {}, {a:1}, null, undefined]) {
      it(`debugCompat should work with a ${typeof x} with value ${JSON.stringify(x)}`, () => {
        log.debugCompat('hi')(x);
      });

      it(`normal logging should work with a ${typeof x} with value ${JSON.stringify(x)}`, () => {
        log.info(x);
      });
    }

    for (let level of ['trace', 'debug', 'info', 'warn', 'error', 'fatal']) {
      it(`should write to ${level} log level properly`, () => {
        log[level].call(log, level);
        let outputMsgs = output.split('\n').filter(y => y).map(y => JSON.parse(y));
        assume(outputMsgs[0].msg).equals(level);
        assume(outputMsgs[0].level).equals(bunyan.levelFromName[level]);
      });
    }

    // We're not trying to test the built-in serializers, but we do want to
    // make sure that their behaviour happens. 
    describe('serializers', () => {

      // We want to use a standard Error object...
      let err = new Error('Testing!');
      // but also attach a property to ensure it's there
      err.code = 'testing';

      it('should serialize errors passed as only structured log object', () => {
        log.error(err, 'error');
        let outputMsgs = output.split('\n').filter(y => y).map(y => JSON.parse(y));
        assume(outputMsgs).has.lengthOf(1);
        assume(outputMsgs[0]).has.property('err');
        assume(outputMsgs[0].err).has.property('message', err.message);
        assume(outputMsgs[0].err).has.property('code', err.code);
        assume(outputMsgs[0].err).has.property('name', 'Error');
        assume(outputMsgs[0].err).has.property('stack');
        // We using the precense of the filename of this file as a proxy for
        // whether or not the stack trace that was printed is valid.  No matter
        // what, if the filename of this file is not in the stack we're going
        // to need to investigate!
        assume(outputMsgs[0].err.stack).contains(__filename);
      });
      
      it('should serialize errors passed as the err property', () => {
        log.error({err}, 'error');
        let outputMsgs = output.split('\n').filter(y => y).map(y => JSON.parse(y));
        assume(outputMsgs).has.lengthOf(1);
        assume(outputMsgs[0]).has.property('err');
        assume(outputMsgs[0].err).has.property('message', err.message);
        assume(outputMsgs[0].err).has.property('code', err.code);
        assume(outputMsgs[0].err).has.property('name', 'Error');
        assume(outputMsgs[0].err).has.property('stack');
        // We using the precense of the filename of this file as a proxy for
        // whether or not the stack trace that was printed is valid.  No matter
        // what, if the filename of this file is not in the stack we're going
        // to need to investigate!
        assume(outputMsgs[0].err.stack).contains(__filename);
      });
    });
  });
});
