global.AUTOBAHN_DEBUG = true;

var nightlife  = require('../../lib/nightlife/router')
    , autobahn = require('autobahn')
    , chai     = require('chai')
    , expect   = chai.expect
    , promised = require('chai-as-promised')
    , spies    = require('chai-spies');

chai.use(spies).use(promised);

describe('Router#constructor', function () {
    it('should instantiate', function (done) {
        var router = nightlife.createRouter();
        expect(router).to.be.an.instanceof(nightlife.Router);
        expect(router.roles).to.have.property('broker');
        expect(router.roles).to.have.property('dealer');
        router.close().then(done).catch(done);
    });
});

describe('Router:Session', function () {
    var router = null, connection = null, session = null;

    before(function (done) {
        router = nightlife.createRouter();

        setTimeout(function() { done(); }, 500);
    });

    after(function (done) {
        router.close().then(done).catch(done);
    });

    it('should establish a new session', function (done) {
        router.createRealm('com.to.inge.world');

        connection = new autobahn.Connection({
            realm: 'com.to.inge.world',
            url: 'ws://localhost:3000/nightlife'
        });

        connection.onopen = function (s) {
            expect(s).to.be.an.instanceof(autobahn.Session);
            expect(s.isOpen).to.be.true;
            session = s;
            done();
        };

        connection.open();
    });

    it('should close a session', function (done) {
        expect(connection).to.be.an.instanceof(autobahn.Connection);

        connection.onclose = function (reason) {
            expect(reason).to.be.equal('closed');
            done();
        };

        connection.close();
    });
});

describe('Router:Publish/Subscribe', function () {
    var router = null, connection = null, session = null, subscription = null;

    before(function (done) {
        router = nightlife.createRouter();

        setTimeout(function() {
            connection = new autobahn.Connection({
                realm: 'com.to.inge.world',
                url: 'ws://localhost:3000/nightlife'
            });

            connection.onopen = function (s) {
                session = s;
                done();
            };

            connection.open();
        }, 500);
    });

    after(function (done) {
        router.close().then(done).catch(done);
    });

    function onevent(args, kwargs, details) {
        expect(args).to.be.ok;
        expect(kwargs).to.be.ok;
        expect(details).to.be.ok;
    }
    var spyEvent = chai.spy(onevent);

    it('should subscribe to a topic', function (done) {
        expect(session.isOpen).to.be.true;
        session.subscribe('com.example.inge', spyEvent)
        .then(function (s) {
            subscription = s;
            done();
        })
        .catch(function (err) {
            done(new TypeError(err.stack));
        });
    });

    it('should publish to a topic', function (done) {
        expect(session.isOpen).to.be.true;
        session.publish('com.example.inge', ['hello inge!'], {to: 'inge'}, {acknowledge: true})
        .then(function (published) {
            expect(published).to.have.property('id');
        })
        .catch(function (err) {
            done(new Error(err.stack));
        });

        setTimeout(function () {
            expect(spyEvent).to.have.been.called.once;
            done();
        }, 500);
    });

    it('should unsubscribe from a topic', function (done) {
        expect(session.isOpen).to.be.true;
        session.unsubscribe(subscription)
        .then(function () {
            done();
        })
        .catch(function (err) {
            done(new Error(err.stack));
        });
    });
});
