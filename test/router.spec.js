global.AUTOBAHN_DEBUG = true;

var Router      = require('../lib/router')
    , CLogger   = require('node-clogger')
    , autobahn  = require('autobahn')
    , WebSocket = require('ws')
    , chai      = require('chai')
    , expect    = chai.expect
    , spies     = require('chai-spies')
    , promised  = require('chai-as-promised');

chai.use(spies).use(promised);

var logger = new CLogger({name: 'router-tests'});

describe('Router:constructor', function () {
    var router = null;

    beforeEach(function (done) {
        router = new Router();

        setTimeout(function() { done(); }, 500);
    });

    afterEach(function (done) {
        router.shutdown().then(function () {
            done();
        }).catch(done);
    });

    it('should instantiate', function () {
        expect(router).to.be.an.instanceof(Router);
    });
});

describe('Router:Session', function () {
    var router = null;

    beforeEach(function (done) {
        router = new Router();

        setTimeout(function() { done(); }, 500);
    });

    afterEach(function (done) {
        router.shutdown().then(done).catch(done);
    });

    it('should establish a websocket connection', function (done) {
        var ws = new WebSocket('ws://localhost:3000/nightlife');
        ws.on('open', function () {
            ws.close();
            done();
        });
    });

    it('should establish a connection', function (done) {
        this.timeout(0);
        var connection = new autobahn.Connection({url: 'ws://localhost:3000/nightlife', realm: 'inge'});
        connection.onopen = function (session) {
            expect(session).to.be.an.instanceof(autobahn.Session);
            connection.close();
        };
        connection.onclose = function (reason) {
            done(reason === 'closed' ? undefined : new Error(reason));
        };
        connection.open();
    });
});
