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
});
