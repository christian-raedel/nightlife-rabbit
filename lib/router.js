var CConf             = require('node-cconf')
    , CLogger         = require('node-clogger')
    , Session         = require('./session')
    , Realm           = require('./realm')
    , MessageParser   = require('./message-parser')
    , debug           = require('debug')('wamp:router')
    , WebSocketServer = require('ws').Server
    , q               = require('q')
    , util            = require('util')
    , http            = require('http')
    , _               = require('lodash');

function Router(opts) {
    var self = this;

    var config = new CConf('nightlife-router', [
    ], {
        'name'           : 'nightlife-router',
        'session-name'   : 'nightlife-session',
        'realm-name'     : 'nightlife-realm',
        'path'           : '/nightlife',
        'port'           : 3000,
        'auto-create-realms': true,
        'verifyClient'   : null,
        'disableHixie'   : false,
        'clientTracking' : true
    })
    .load(opts || {});

    config.setDefault('logger', new CLogger({name: config.getValue('name')}));
    config.getValue('logger').extend(self);

    var port = config.getValue('port');
    var server = http.Server(function (req, res) {
        res.writeHead(404);
        res.end();
    })
    .on('error', function (err) {
        self.error('HttpServer error: %s', err.message);
    })
    .listen(port, function() {
        self.info('bound and listen at %d', port);
    });

    config.setDefault('server', server);

    WebSocketServer.call(self, config.getObject([
        'path',
        'server',
        'verifyClient',
        'disableHixie',
        'clientTracking'
    ]));

    self.config = config;
    self.realms = {};
    self.mp = new MessageParser().init();

    self.on('error', function (err) {
        self.error('WebSocketServer error: %s', err.message);
    });

    self.on('connection', function (socket) {
        self.info('incoming socket connection...');
        var session = new Session(socket, {
            'supported-roles': self.roles,
            'message-parser': self.mp,
            'logger': new CLogger({name: config.getValue('session-name')})
        });

        session.on('attach', function (realm, defer) {
            try {
                self.realm(realm).addSession(session);
                defer.resolve();
            } catch (err) {
                defer.reject(err);
            }
        });

        session.on('subscribe', function (uri, defer) {
            try {
                defer.resolve(self.realm(session.realm).topic(uri).addSession(session).id);
            } catch (err) {
                defer.reject(err);
            }
        });

        session.on('unsubscribe', function (id, defer) {
            try {
                self.realm(session.realm).topic(id).removeSession(session);
                defer.resolve();
            } catch (err) {
                defer.reject(err);
            }
        });

        session.on('publish', function (uri, defer) {
            try {
                defer.resolve(self.realm(session.realm).topic(uri));
            } catch (err) {
                defer.reject(err);
            }
        });

        session.on('register', function (uri, defer) {
            try {
                defer.resolve(self.realm(session.realm).procedure(uri, session).id);
            } catch (err) {
                defer.reject(err);
            }
        });

        session.on('unregister', function (id, defer) {
            try {
                self.realm(session.realm).procedure(id, session).callee = null;
                defer.resolve();
            } catch (err) {
                defer.reject(err);
            }
        });

        session.on('call', function (uri, defer) {
            try {
                defer.resolve(self.realm(session.realm).procedure(uri));
            } catch (err) {
                defer.reject(err);
            }
        });

        session.on('yield', function (id, defer) {
            try {
                defer.resolve(self.realm(session.realm).findInvocation(id));
            } catch (err) {
                defer.reject(err);
            }
        });

        session.on('close', function () {
            if (session.realm) {
                self.realm(session.realm).removeSession(session);
            }
        });
    });
}

util.inherits(Router, WebSocketServer);

Router.prototype.__defineGetter__('roles', function () {
    return {
        //publisher  : {},
        //subscriber : {},
        //caller     : {},
        //callee     : {},
        broker     : {},
        dealer     : {}
    };
});

Router.prototype.__defineGetter__('randomid', function () {
    return Math.floor(Math.random() * Math.pow(2, 53));
});

Router.prototype.shutdown = function() {
    var self = this;
    var server = self.config.getValue('server');
    var defer = q.defer();

    _.forOwn(self.realms, function (realm) {
        _.forOwn(realm.sessions, function (session) {
            session.close();
        });
    });

    server.on('close', function () {
        self.info('Closed.');
        defer.resolve();
    });
    server.close();

    setTimeout(function () {
        defer.reject(new Error('Cannot close router!'));
    }, 2000);

    return defer.promise;
};

Router.prototype.realm = function(uri) {
    var self = this;

    if (self.mp.isUri(uri)) {
        var realms = self.realms;
        var config = self.config;
        if (!realms[uri]) {
            if (config.getValue('auto-create-realms')) {
                realms[uri] = new Realm({
                    'realm-name': config.getValue('realm-name'),
                    'message-parser': self.mp
                });
                self.info('realm [%s] created.', uri);
            } else {
                throw new Error('wamp.error.no_such_realm');
            }
        }
        return realms[uri];
    } else {
        throw new TypeError('wamp.error.invalid_uri');
    }
};

module.exports = Router;
