var MessageParser = require('../lib/message-parser')
    , CLogger = require('node-clogger')
    , chai = require('chai')
    , expect = chai.expect
    , spies = require('chai-spies')
    , promised = require('chai-as-promised')
    , _ = require('lodash');

chai.use(spies).use(promised);

var logger = new CLogger({name: 'message-parser-tests'});

/**
 * memwatch --------------------------------------------------------
 */
var memwatch = require('memwatch');
var inspect = require('util').inspect;

var heapdiff = new memwatch.HeapDiff();
memwatch.on('leak', function (info) {
    logger.warn('memory leak:\n%s', inspect(info));
    var diff = heapdiff.end();
    logger.warn('heapdiff:\n%s', inspect(diff));
    heapdiff = new memwatch.HeapDiff();
});
memwatch.on('stats', function (stats) {
    logger.info('memory stats:\n%s', inspect(stats));
});
/**
 * memwatch --------------------------------------------------------
 */

describe('MessageParser:constructor', function () {
    it('should instantiate', function () {
        var mp = new MessageParser();
        expect(mp).to.be.an.instanceof(MessageParser);
    });
});

describe('MessageParser:encode', function () {
    var mp = null;

    beforeEach(function () {
        mp = new MessageParser().init();
    });

    it('should encode "HELLO" message', function (done) {
        mp.encode('hello', {realm: 'com.example.app', details: {'_keyA': 43, '_keyB': 27}})
        .then(function (str) {
            logger.debug('str = %j', str);
            expect(JSON.parse(str)).to.be.deep.equal([1, 'com.example.app', {'_keyA': 43, '_keyB': 27}]);
            done();
        })
        .catch(done);
    });

    it('should encode "WELCOME" message', function (done) {
        mp.encode('welcome', {session: null, details: {}})
        .then(function (str) {
            logger.debug('str = %j', str);
            var message = JSON.parse(str);
            expect(message[0]).to.be.equal(2);
            expect(message[1]).to.be.a('number');
            expect(message[2]).to.be.deep.equal({});
            done();
        })
        .catch(done);
    });

    it('should encode "ERROR" message', function (done) {
        mp.encode('error', {request: {type: 'welcome', id: 43}, details: {}, error: 'com.example.error', args: [], kwargs: {}})
        .then(function (str) {
            logger.debug('str = %j', str);
            expect(JSON.parse(str)).to.be.deep.equal([8, 2, 43, {}, 'com.example.error']);
            done();
        })
        .catch(done);
    });
});

describe('MessageParser:decode', function () {
    var mp = null;

    beforeEach(function () {
        mp = new MessageParser().init();
    });

    it('should parse a message', function (done) {
        var message = JSON.stringify([2]);
        mp.decode(message, function (message) {
            expect(message.type).to.be.equal('WELCOME');
            return true;
        }).then(function (parsed) {
            expect(parsed, 'parsed').to.be.true;
            done();
        }).catch(done);
    });
});
