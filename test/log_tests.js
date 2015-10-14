let logging = require('../src/log.js');
let sinon = require('sinon');
let assume = require('assume');
let assert = require('assert');
let slugid = require('slugid');

var MemoryStream = require('memorystream');

describe('logs', () => {
  let sandbox;
  let realLogName = process.env.LOG_NAME;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    process.env.LOG_NAME = slugid.v4();
  });

  afterEach(() => {
    sandbox.restore();
    process.env.LOG_NAME = realLogName;
  });

  describe('initialization', () => {
    it('should default to level INFO', () => {
      let createLogger = sandbox.spy(logging.bunyan, "createLogger");
      let result = logging({name: 'test'});
      let expected = {
        name: process.env.LOG_NAME,
      };
      assert(createLogger.calledWithExactly(expected));
      assume(result.level()).equals(logging.bunyan.INFO);
    });
  });

  describe('compat functionality', () => {
    let log;
    let output;

    beforeEach(() => {
      output = '';
      let out = new MemoryStream();
      out.on('data', chunk => {
        output += chunk.toString();
      });

      //out.pipe(process.stdout, { end: false });
      log = logging({
        name: 'test',
        stream: out,
        level: 'trace',
      });

    });

    it('should have a compat function', () => {
      assume(log.debugCompat).is.a('function');
    });

    it('should write to the warning level by default', done => {
      log.debugCompat('hello %s', 'world');

      // We need to skip a turn so that the stream has a chance to
      // process the 'on -> data' handler before we try to consume
      // the thing made in that handler
      process.nextTick(() => {
        let parsed = JSON.parse(output);
        console.dir(parsed);
        assume(parsed.level).equals(40);
        assume(parsed.dbgcmpt).equals(true);
        assume(parsed.alert).is.falsely();
        assume(parsed.msg).equals('hello world');
        done();
      });
    });

    it('should write to the fatal level with [alert-operator]', done => {
      log.debugCompat('[alert-operator] hi!');

      // We need to skip a turn so that the stream has a chance to
      // process the 'on -> data' handler before we try to consume
      // the thing made in that handler
      process.nextTick(() => {
        let parsed = JSON.parse(output);
        console.dir(parsed);
        assume(parsed.level).equals(60);
        assume(parsed.dbgcmpt).equals(true);
        assume(parsed.alert).equals(true);
        assume(parsed.msg).equals('[alert-operator] hi!');
        done();
      });
    });
  });
});
