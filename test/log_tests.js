let logging = require('../lib/log');
let sinon = require('sinon');
let assume = require('assume');
let assert = require('assert');

var MemoryStream = require('memorystream');

assert(!process.env.LOG_LEVEL, 'Do not run tests with LOG_LEVEL');

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
      let createLogger = sandbox.spy(logging.bunyan, "createLogger");
      let result = logging('test', {});
      let expected = {
        name: 'test',
        level: 'info',
      };
      assert(createLogger.calledWithExactly(expected));
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

    it('should write to all log levels properly', () => {
      log.trace('trace');
      log.debug('debug');
      log.info('info');
      log.warn('warn');
      log.error('error');
      log.fatal('fatal');

      let expected = [
        'trace',
        'debug',
        'info',
        'warn',
        'error',
        'fatal',
      ];
      let outputMsgs = output.split('\n').filter(y => y).map(y => JSON.parse(y));

      let num = 10;
      for (let x = 0 ; x < expected.length ; x++) {
        assume(outputMsgs[x].msg).equals(expected[x]);
        assume(outputMsgs[x].level).equals(num);
        num += 10;
      }
    });
  });
});
