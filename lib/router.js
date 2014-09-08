var CConf             = require('node-cconf')
    , CLogger         = require('node-clogger')
    , Session         = require('./session')
    , MessageParser   = require('./message-parser')
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
    self.realms = {};
    self.mp = new MessageParser().init();

    self.on('error', function (err) {
        self.error('WebSocketServer error: %s', err.message);
    });

    self.on('connection', function (socket) {
        self.info('incoming socket connection...');
        var session = new Session(socket, {
            'supported-roles': self.roles,
            'message-parser': self.mp
        });

        session.on('attach', function () {
            self.realm(session.realm).sessions[session.id] = session;
            session.open = true;
            self.debug('session attached to realm:', session.realm);
        });

        session.on('subscribe', function (topicUri, subscription) {
            var topic = self.topic(session.realm, topicUri);
            topic.sessions[session.id] = session;
            subscription.resolve(topic.id);
        });

        session.on('unsubscribe', function (id, unsubscription) {
            var topic = self.topic(session.realm, id);
            delete topic.sessions[session.id];
            unsubscription.resolve();
        });

        session.on('close', function () {
            if (session.realm) {
                delete self.realm(session.realm).sessions[session.id];
            }
            self.debug('session closed');
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

    if (_.isString(uri)) {
        var realms = self.realms;
        if (!realms[uri]) {
            realms[uri] = {
                sessions: {},
                topics: {}
            };
            self.info('Realm [%s] created.', uri);
        }
        return realms[uri];
    } else {
        throw new TypeError('Realm must be a valid wamp uri string!');
    }

};

Router.prototype.topic = function(realmUri, topicUri) {
    var self = this;

    if (_.isString(realmUri) && _.isString(topicUri)) {
        var realm = self.realm(realmUri);
        if (!realm.topics[topicUri]) {
            realm.topics[topicUri] = {
                id: self.randomid,
                sessions: {}
            };
            self.info('topic [%s] for realm [%s] created.', topicUri, realmUri);
        }
        return realm.topics[topicUri];
    } else if (_.isString(realmUri) && _.isNumber(topicUri)) {
        var realm = self.realm(realmUri);
        var topic = _.find(realm.topics, function (topic) {
            return topic.id === topicUri;
        });
        if (topic) {
            return topic;
        } else {
            throw new Error('Cannot find topic with id [' + topicUri + '] on realm [' + realmUri + ']');
        }
    } else {
        throw new TypeError('Realm and topic must be valid wamp uri strings!');
    }
};

module.exports = Router;
