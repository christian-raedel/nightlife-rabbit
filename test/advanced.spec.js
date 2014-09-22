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

    it('should exclude publisher from event per default', function (done) {
        sessionA.publish('com.example.inge', ['default'], {}, {});

        setTimeout(function () {
            expect(spy).to.have.been.called.twice;
            done();
        }, 500);
    });

    it('should include publisher explicit into event', function (done) {
        sessionA.publish('com.example.inge', ['exclude_me'], {}, {exclude_me: false});

        setTimeout(function () {
            expect(spy).to.have.been.called.exactly(4);
            done();
        }, 500);
    });
});

describe('Advanced Router:Publisher Identification', function () {
    var router = null, connection = null, session = null;

    function onevent(args, kwargs, details) {
        expect(args).to.be.ok;
        expect(kwargs).to.be.ok;
        expect(details).to.be.ok;
        expect(details).to.have.property('publisher');
    }

    var spy = chai.spy(onevent);

    before(function (done) {
        router = nightlife.createRouter();

        setTimeout(function () {
            connection = new autobahn.Connection({
                url: 'ws://localhost:3000/nightlife',
                realm: 'com.example.inge'
            });

            connection.onopen = function (s) {
                session = s;

                session.subscribe('com.example.inge', spy)
                .then(function () {
                    done();
                })
                .catch(function (err) {
                    done(new Error(err));
                })
                .done();
            };

            connection.open();
        }, 500);
    });

    after(function (done) {
        router.close().then(done).catch(done);
    });

    it('should identify publisher', function (done) {
        session.publish('com.example.inge', [], {}, {disclose_me: true, exclude_me: false});

        setTimeout(function () {
            expect(spy).to.have.been.called.once;
            done();
        }, 800);
    });

    it('should be able to forbid publisher identifying', function (done) {
        function onevent(args, kwargs, details) {
            throw new Error('this shouldn\'t happen! ;)');
        }
        var spy = chai.spy(onevent);

        session.subscribe('com.example.anon', spy, {disallow_disclose_me: true})
        .then(function () {
            session.publish('com.example.anon', [], {}, {disclose_me: true, exclude_me: false});

            setTimeout(function () {
                expect(spy).to.not.have.been.called;
                done();
            }, 500);
        })
        .catch(function (err) {
            done(new Error(err));
        })
        .done();
    });

    it('should be able to automatically identify a publisher', function (done) {
        function onevent(args, kwargs, details) {
            expect(details).to.have.property('publisher');
        }
        var spy = chai.spy(onevent);

        session.subscribe('com.example.auto_disclose', spy, {auto_disclose: true})
        .then(function () {
            session.publish('com.example.auto_disclose', [], {}, {exclude_me: false});

            setTimeout(function () {
                expect(spy).to.have.been.called.once;
                done();
            }, 500);
        })
        .catch(function (err) {
            done(new Error(err));
        })
        .done();
    });
});
