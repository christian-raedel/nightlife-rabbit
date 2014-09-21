var nightlife  = require('../lib/router')
    , autobahn = require('autobahn')
    , CLogger  = require('node-clogger')
    , chai     = require('chai')
    , expect   = chai.expect
    , promised = require('chai-as-promised')
    , spies    = require('chai-spies');

chai.use(promised).use(spies);

var logger = new CLogger({name: 'advanced-tests'});

describe('Advanced Router:Black-/Whitelisting', function () {
    function onevent(args, kwargs, details) {
        expect(args).to.be.ok;
        expect(kwargs).to.be.ok;
        expect(details).to.be.ok;
        logger.warn('sender:', args[0]);
    }
    var spy = chai.spy(onevent);

    var router = null
        , clientA = null, sessionA = null
        , clientB = null, sessionB = null;

    before(function (done) {
        router = nightlife.createRouter();

        setTimeout(function () {
            clientA = new autobahn.Connection({
                url: 'ws://localhost:3000/nightlife',
                realm: 'com.to.inge.world'
            });

            clientA.onopen = function (s) {
                sessionA = s;

                sessionA.subscribe('com.example.inge', spy)
                .then(function () {
                    clientB = new autobahn.Connection({
                        url: 'ws://localhost:3000/nightlife',
                        realm: 'com.to.inge.world'
                    });

                    clientB.onopen = function (s) {
                        sessionB = s;

                        sessionB.subscribe('com.example.inge', spy)
                        .then(function () {
                            done();
                        })
                        .catch(function (err) {
                            done(new Error(err));
                        })
                        .done();
                    };

                    clientB.open();
                })
                .catch(function (err) {
                    done(new Error(err));
                })
                .done();
            };

            clientA.open();
        }, 500);
    });

    after(function (done) {
        setTimeout(function () {
            router.close().then(done).catch(done);
        }, 500);
    });

    it('should blacklist a subscriber', function (done) {
        sessionA.publish('com.example.inge', ['blacklist'], {}, {exclude: [sessionB.id]});

        setTimeout(function () {
            expect(spy).to.not.have.been.called;
            done();
        }, 500);
    });

    it('should whitelist a subscriber', function (done) {
        sessionA.publish('com.example.inge', ['whitelist'], {}, {eligible: [sessionB.id]});

        setTimeout(function () {
            expect(spy).to.have.been.called.once;
            done();
        }, 500);
    });

    it('should use higher priority on blacklist', function (done) {
        sessionA.publish('com.example.inge', ['blackwhitelist'], {}, {exclude: [sessionB.id], eligible: [sessionB.id]});

        setTimeout(function () {
            expect(spy).to.have.been.called.once;
            done();
        }, 500);
    });

    it('should exclude publisher from event defaulted', function (done) {
        sessionA.publish('com.example.inge', ['default'], {}, {});

        setTimeout(function () {
            expect(spy).to.have.been.called.twice;
            done();
        }, 500);
    });

    it('should include publisher into event explicit', function (done) {
        sessionA.publish('com.example.inge', ['exclude_me'], {}, {exclude_me: false});

        setTimeout(function () {
            expect(spy).to.have.been.called.exactly(3);
            done();
        }, 500);
    });
});
