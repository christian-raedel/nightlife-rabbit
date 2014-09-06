var CConf             = require('node-cconf')
    , CLogger         = require('node-clogger')
    , Session         = require('./session')
    , debug           = require('debug')('wamp:router')
    , WebSocketServer = require('ws').Server
    , q               = require('q')
    , util            = require('util')
    , http            = require('http')
    , _               = require('lodash');

function Router(opts) {
    var self = this;

    var config = new CConf('nightlife-router-conf', [
    ], {
        'name'           : 'nightlife-router',
        'path'           : '/nightlife',
        'port'           : 3000,
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
    /*
    .on('close', function () {
        process.exit(2);
    })
    */
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
    self.sessions = {};
    self.realms = {};

    self.on('error', function (err) {
        self.error('WebSocketServer error: %s', err.message);
    });

    self.on('connection', function (socket) {
        self.info('Incoming socket connection...');
        self.addSession(new Session(socket, {'supported-roles': self.roles}));
    });
}

util.inherits(Router, WebSocketServer);

Router.prototype.__defineGetter__('roles', function () {
    return {
        publisher  : {},
        subscriber : {},
        caller     : {},
        callee     : {}
    };
});

Router.prototype.shutdown = function() {
    var self = this;
    var server = self.config.getValue('server');
    var defer = q.defer();

    _.forOwn(self.sessions, function (session) {
        session.close('System shutdown', 'wamp.error.system_shutdown');
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

    if (_.isString(uri)) {
        var realms = self.realms;
        if (realms[uri]) {
            return realms[uri];
        } else {
            realms[uri] = {
                sessions: {}
            };
            self.info('Realm [%s] created.', uri);
            return this;
        }
    } else {
        throw new TypeError('Wamp uri must be a string!');
    }

};

Router.prototype.addSession = function(session) {
    var self = this;

    if (session instanceof Session) {
        debug('adding session:', session.id);
        var sessions = self.sessions;
        if (!sessions[session.id]) {
            sessions[session.id] = session
            .on('message', function (message) {
                debug('received message:', message);
                self.route(session, message);
            })
            .on('attach', function (realm, opts) {
                debug('attach session to realm [%s]', realm);
                self.realm(realm).sessions[session.id] = session;
            })
            .on('error', function (err) {
                debug('session error:', err.message);
                self.error('Session error: %s', err.message);
                self.removeSession(session);
            })
            .on('close', function (code) {
                debug('session close:', code);
                self.warn('Session closed:', code);
                self.removeSession(session);
            });
        } else {
            self.error('A session with same id already exists!');
        }
    } else {
        throw new TypeError('Cannot add non-session object to router sessions!');
    }

    return self;
};

Router.prototype.removeSession = function(session) {
    var self = this;

    if (session instanceof Session) {
        debug('removing session:', session.id);
        var sessions = self.sessions;
        if (sessions[session.id]) {
            delete sessions[session.id];
        } else {
            self.error('Cannot remove non-existing session from router sessions!');
        }
    } else {
        throw new TypeError('Cannot remove non-session object from router sessions!');
    }

    return self;
};

module.exports = Router;
