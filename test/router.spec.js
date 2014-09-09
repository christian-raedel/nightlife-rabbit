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
            var message = [1, 'inge', {roles: {caller: {}, callee: {}, publisher: {}, subscriber: {}}}];
            ws.send(JSON.stringify(message));
        });

        function onmessage(data) {
            logger.debug('onmessage data:', data);
            var message = JSON.parse(data);
            expect(message[0]).to.be.equal(2);
            expect(message[1]).to.be.a('number');
            expect(message[2]).to.be.deep.equal({roles: router.roles});
            ws.close();
        }
        var mSpy = chai.spy(onmessage);
        ws.on('message', mSpy);

        ws.on('error', function (err) {
            done(err);
        });

        setTimeout(function () {
            expect(mSpy).to.have.been.called.once;
            done();
        }, 500);
    });

    it('should establish a connection', function (done) {
        //this.timeout(0);
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

describe('Router:Session:Publish/Subscribe', function () {
    this.timeout(3000);
    var router = null, connection = null, session = null;

    beforeEach(function (done) {
        router = new Router();

        setTimeout(function () {
            connection = new autobahn.Connection({url: 'ws://localhost:3000/nightlife', realm: 'inge'});
            connection.onopen = function (_session) {
                session = _session;
                done();
            };
            connection.open();
        }, 2000);
    });

    afterEach(function (done) {
        connection.onclose = function (reason) {
            router.shutdown().then(done).catch(done);
        };
        connection.close();
    });

    it('should subscribe to a topic', function (done) {
        session.subscribe('com.example.inge', function () {})
        .then(function (subscription) {
            expect(subscription).to.be.an.instanceof(autobahn.Subscription);
            done();
        })
        .catch(function (reason) {
            done(new Error(reason));
        });
    });

    it('should unsubscribe from a topic', function (done) {
        session.subscribe('com.example.inge', function () {})
        .then(function (subscription) {
            expect(session.isOpen).to.be.true;
            session.unsubscribe(subscription)
            .then(function (unsubscribed) {
                expect(unsubscribed).to.be.true;
                done();
            });
        })
        .catch(function (reason) {
            done(new Error(reason));
        });
    });

    it('should publish to a topic', function (done) {
        function onevent(args, kwargs, details) {
            expect(args).to.be.deep.equal(['hello inge!']);
            expect(kwargs).to.have.property('to', 'inge');
            expect(details).to.be.ok;
        }
        var spy = chai.spy(onevent);

        session.subscribe('com.example.inge', spy)
        .then(function () {
            session.publish('com.example.inge', ['hello inge!'], {to: 'inge'}, {acknowledge: true})
            .then(function (published) {
                expect(published).to.have.property('id');
            });
        })
        .catch(function (reason) {
            done(new Error(reason));
        });

        setTimeout(function () {
            expect(spy).to.have.been.called.once;
            done();
        }, 2000);
    });

    it('should register a remote procedure', function (done) {
        session.register('com.example.rest', function () {})
        .then(function (registration) {
            expect(registration).to.be.an.instanceof(autobahn.Registration);
            done();
        })
        .catch(function (reason) {
            done(new Error(reason));
        });
    });

    it('should unregister a remote procedure', function (done) {
        session.register('com.example.rest', function () {})
        .then(function (registration) {
            expect(session.isOpen).to.be.true;
            session.unregister(registration).then(done)
            .catch(function (reason) {
                done(new Error(reason));
            });
        });
    });
});
