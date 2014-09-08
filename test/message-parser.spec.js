var MessageParser = require('../lib/message-parser')
    , Message = require('../lib/message-types').Message
    , CLogger = require('node-clogger')
    , chai = require('chai')
    , expect = chai.expect
    , spies = require('chai-spies')
    , promised = require('chai-as-promised')
    , _ = require('lodash');

chai.use(spies).use(promised);

var logger = new CLogger({name: 'message-parser-tests'});

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

describe('Message', function () {
    it('should decode a message', function () {
        var data = [2, 43, {roles: {publisher: {}}}];
        var message = new Message(data).set('session.id').set('details').get();
        expect(message).to.be.deep.equal({type: 'WELCOME', session: {id: 43}, details: {roles: {publisher: {}}}});
    });
});

describe('MessageParser:decode', function () {
    var mp = null;

    beforeEach(function () {
        mp = new MessageParser().init();
    });

    it('should parse a message', function (done) {
        var message = JSON.stringify([1, 'com.example.inge', {roles: {publisher: {}}}]);
        mp.decode(message).then(function (message) {
            expect(message).to.be.deep.equal({type: 'HELLO', realm: 'com.example.inge', details: {roles: {publisher: {}}}});
            done();
        }).catch(done);
    });
});
