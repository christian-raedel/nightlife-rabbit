global.AUTOBAHN_DEBUG = true;

var nightlife  = require('../lib/router')
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
        router.close().then(done).catch(done).done();
    });
});

describe('Router:Session', function () {
    var router = null, connection = null, session = null;

    before(function (done) {
        router = nightlife.createRouter();

        setTimeout(function() { done(); }, 500);
    });

    after(function (done) {
        setTimeout(function () {
            router.close().then(done).catch(done).done();
        });
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
        connection.close();

        setTimeout(function () {
            router.close().then(done).catch(done).done();
        });
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
        })
        .done();
    });

    it('should publish to a topic', function (done) {
        expect(session.isOpen).to.be.true;
        session.publish('com.example.inge', ['hello inge!'], {to: 'inge'}, {acknowledge: true})
        .then(function (published) {
            expect(published).to.have.property('id');
        })
        .catch(function (err) {
            done(new Error(err.stack));
        })
        .done();

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
        })
        .done();
    });
});

describe('Router:Remote Procedures', function () {
    var router = null, connection = null, session = null, registration = null;

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
        connection.close();

        setTimeout(function () {
            router.close().then(done).catch(done).done();
        });
    });

    function onCall(args, kwargs, details) {
        expect(args).to.be.deep.equal(['hello inge!']);
        expect(kwargs).to.have.property('to');
        expect(details).to.be.ok;

        if (kwargs.to === 'world') {
            throw new autobahn.Error('com.example.inge.error', args, kwargs);
        } else {
            return 'inge';
        }
    }
    var spyCall = chai.spy(onCall);

    it('should register a remote procedure', function (done) {
        expect(session.isOpen).to.be.true;
        session.register('com.example.inge', spyCall)
        .then(function (r) {
            expect(r).to.have.property('id');
            registration = r;
            done();
        })
        .catch(function (err) {
            console.log(err.stack);
        })
        .done();
    });

    it('should call a remote procedure', function (done) {
        expect(session.isOpen).to.be.true;
        session.call('com.example.inge', ['hello inge!'], {to: 'inge'})
        .then(function (result) {
            expect(result).to.be.equal('inge');
            expect(spyCall).to.have.been.called.once;
            done();
        })
        .catch(function (err) {
            done(new Error(err));
        })
        .done();
    });

    it('should return an error, if remote procedure throws', function (done) {
        expect(session.isOpen).to.be.true;
        session.call('com.example.inge', ['hello inge!'], {to: 'world'})
        .catch(function (err) {
            expect(err).to.be.an.instanceof(autobahn.Error);
            expect(err.error).to.be.equal('com.example.inge.error');
            expect(err.args).to.be.deep.equal(['hello inge!']);
            expect(err.kwargs).to.have.property('to', 'world');
            expect(spyCall).to.have.been.called.twice;
            done();
        });
    });

    it('should unregister a remote procedure', function (done) {
        expect(session.isOpen).to.be.true;
        session.unregister(registration)
        .then(function () {
            done();
        })
        .catch(function (err) {
            done(new Error(err.stack));
        })
        .done();
    });
});
