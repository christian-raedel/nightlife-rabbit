var CConf = require('node-cconf')
    , CLogger = require('node-clogger')
    , _ = require('lodash');

function Realm(opts) {
    var self = this;
    var config = new CConf('realm', ['name']).load(opts || {});
    config.setDefault('logger', new CLogger({name: config.getValue('name')}));
    config.getValue('logger').extend(this);

    self.config = config;
    self.procedures = {};
    self.channels = {};
}

Realm.prototype.__defineGetter__('name', function () {
    return this.config.getValue('name');
});

Realm.prototype.procedure = function(uri) {
    var self = this;

    if (_.isString(uri)) {
        var procedures = self.procedures;
        if (procedures[uri]) {
            return procedures[uri];
        } else {
            procedures[uri] = {
                callee: null,
                caller: []
            }
            self.info('Added procedure [%s] to realm [%s].', uri, self.name);
            return this;
        }
    } else {
        throw new TypeError('Wamp uri must be a string!');
    }
};

Realm.prototype.channel = function(uri) {
    var self = this;

    if (_.isString(uri)) {
        var channels = self.channels;
        if (channels[uri]) {
            return channels[uri];
        } else {
            channels[uri] = {
                sessions: []
            }
            self.info('Added channel [%s] to realm [%s].', uri, self.name);
            return this;
        }
    } else {
        throw new TypeError('Wamp uri must be a string!');
    }
};

Realm.prototype.addSession = function(session) {
    var self = this;

    if (session instanceof Session) {
        var sessions = self.sessions;
        if (!sessions[session.id]) {
            sessions[session.id] = session
            .on('message', function (message) {
                debug('received message:', message);
                self.route(session, message);
            })
            .on('error', function (err) {
                self.error('Session error: %s', err.message);
                self.removeSession(session);
            })
            .on('close', function (reason) {
                self.warn('Session closed:', reason);
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

Realm.prototype.removeSession = function(session) {
    var self = this;

    if (session instanceof Session) {
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

Realm.prototype.route = function(session, message) {
    var self = this;

    if (session instanceof Session) {
        var realms = self.realms;
        if (!session.id) {
            switch (message.type) {
                case 'HELLO':
                    if (realms[message.realm] && _.isPlainObject(message.details.roles)) {
                        var id = self.randomId;
                        session.id = id;
                        session.roles = message.details.roles;
                        realms[message.realm].sessions[id] = session;
                        session.send('welcome', {session : {id: id}, details: {roles: self.roles}})
                        .catch(self.error);
                    } else {
                        session.send('abort', {
                            details: {
                                message: 'Requested realm does not exists or featured roles not submitted!'
                            },
                            reason: 'org.nightlife.rabbit.errors.no_such_realm'
                        })
                        .catch(self.error);
                    }
                    break;
                default:
                    self.error('Requested message type is not implemented yet!');
            }
        }
    } else {
        throw new TypeError('Cannot route messages from a non-session object!');
    }
};

module.exports = Realm;
