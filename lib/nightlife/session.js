var util           = require('./util')
    , logger       = util.logger()
    , parser       = util.parser()
    , randomid     = util.randomid
    , inherits     = require('util').inherits
    , EventEmitter = require('events').EventEmitter
    , WebSocket    = require('ws')
    , q            = require('q')
    , _            = require('lodash');

function Session(socket, supportedRoles) {
    var self = this;

    if (!(socket instanceof WebSocket)) {
        throw new TypeError('wamp.error.invalid_socket');
    }

    if (!(_.isPlainObject(supportedRoles))) {
        throw new TypeError('wamp.error.invalid_roles');
    }

    EventEmitter.call(this);

    socket.on('open', function () {
        logger.debug('socket open');
    });

    socket.on('message', function (data) {
        logger.debug('socket message', data);
        self.parse(data);
    });

    socket.on('error', function (err) {
        logger.error('socket error', err.stack);
        self.close(null, null, false);
    });

    socket.on('close', function (code, reason) {
        logger.debug('socket close', code, reason || '');
        self.close(code, reason, code === 1000);
    });

    self.socket = socket;
    self.roles = supportedRoles;
}

inherits(Session, EventEmitter);

Session.prototype.send = function(type, opts) {
    var self = this;

    return parser.encode(type, opts)
    .then(function (message) {
        WebSocket.prototype.send.call(self.socket, message, function () {
            logger.debug('%s message sent', type, message);
        });
    });
};

Session.prototype.error = function(type, id, err) {
    var self = this;

    if (_.isString(type) && _.isNumber(id) && err instanceof Error) {
        return self.send('ERROR', {
            request: {
                type: type,
                id: id
            },
            details: {
                stack: err.stack
            },
            error: err.message
        });
    } else {
        throw new TypeError('wamp.error.invalid_argument');
    }
};

Session.prototype.close = function(code, reason, wasClean) {
    var self = this;

    if (code > 1006) {
        self.send('GOODBYE', {details: {message: 'Close connection'}, reason: reason})
        .catch(function (err) {
            logger.error('cannot send GOODBYE message!', err.stack);
        });
    }

    var defer = q.defer();
    self.emit('close', defer);
    return defer.promise;
};

Session.prototype.parse = function(data) {
    var self = this;

    parser.decode(data)
    .then(function (message) {
        logger.debug('parsing message', message);
        switch (message.type) {
            case 'HELLO':
                q.fcall(function () {
                    self.id = randomid();
                    self.realm = message.realm;

                    var defer = q.defer();
                    self.emit('attach', message.realm, defer);
                    return defer.promise;
                })
                .then(function () {
                    return self.send('WELCOME', {
                        session: {
                            id: self.id
                        },
                        details: {
                            roles: self.roles
                        }
                    });
                })
                .then(function () {
                    logger.debug('attached session to realm', message.realm);
                })
                .catch(function (err) {
                    logger.error('cannot establish session', err.stack);
                    self.send('ABORT', {
                        details: {
                            message: 'Cannot establish session!'
                        },
                        reason: err.message
                    });
                });
                break;
            case 'GOODBYE':
                self.close(1009, 'wamp.error.close_normal');
                break;
            case 'SUBSCRIBE':
                q.fcall(function () {
                    var defer = q.defer();
                    self.emit('subscribe', message.topic, defer);
                    return defer.promise;
                })
                .then(function (id) {
                    self.send('SUBSCRIBED', {subscribe: {request: {id: message.request.id}}, subscription: {id: id}});
                })
                .catch(function (err) {
                    logger.error('cannot subscribe to topic', session.realm, message.topic, err.stack);
                    self.error('SUBSCRIBE', message.request.id, err);
                });
                break;
            case 'UNSUBSCRIBE':
                q.fcall(function () {
                    var defer = q.defer();
                    self.emit('unsubscribe', message.subscribed.subscription.id, defer);
                    return defer.promise;
                })
                .then(function () {
                    self.send('UNSUBSCRIBED', {unsubscribe: {request: {id: message.request.id}}});
                })
                .catch(function (err) {
                    logger.error('cannot unsubscribe from topic', message.subscribed.subscription.id, err.stack);
                    self.error('UNSUBSCRIBE', message.request.id, err);
                });
                break;
            case 'PUBLISH':
                q.fcall(function () {
                    var defer = q.defer();
                    self.emit('publish', message.topic, defer);
                    return defer.promise;
                })
                .then(function (topic) {
                    var publicationId = randomid();

                    if (message.options && message.options.acknowledge) {
                        self.send('PUBLISHED', {
                            publish: {
                                request: {
                                    id: message.request.id
                                }
                            },
                            publication: {
                                id: publicationId
                            }
                        });
                    }

                    var queue = [];
                    _.forEach(topic.sessions, function (session) {
                        var event = session.send('EVENT', {
                            subscribed: {
                                subscription: {
                                    id: topic.id
                                }
                            },
                            published: {
                                publication: {
                                    id: publicationId
                                }
                            },
                            details: {},
                            publish: {
                                args: message.args,
                                kwargs: message.kwargs
                            }
                        });

                        queue.push(event);
                    });

                    return q.all(queue);
                })
                .then(function () {
                    logger.info('published event to topic', message.topic);
                })
                .catch(function (err) {
                    logger.error('cannot publish event to topic', message.topic, err.stack);
                    self.error('PUBLISH', message.request.id, err);
                });
                break;
            default:
                logger.error('wamp.error.not_implemented');
        }
    });
};

module.exports = Session;
