var CConf        = require('node-cconf')
    , CLogger      = require('node-clogger')
    , util         = require('util')
    , EventEmitter = require('events').EventEmitter
    , WebSocket    = require('ws')
    , q            = require('q')
    , _            = require('lodash');

function Session(socket, opts) {
    var self = this;

    if (!(socket instanceof WebSocket)) {
        throw new TypeError('Session socket must be a WebSocket!');
    }

    var config = new CConf('session', ['supported-roles', 'message-parser'], {
        logger: new CLogger({name: 'session'})
    }).load(opts || {});

    config.getValue('logger').extend(this);

    EventEmitter.call(this);

    self.config = config;
    self.open = false;

    socket.on('open', function () {
        self.debug('socket open');
    });

    socket.on('message', function (data) {
        self.debug('socket message', data);
        self.parse(data);
    });

    socket.on('close', function (code, reason) {
        self.debug('socket close:', code, reason || '');
        self.close();
    });

    socket.on('error', function (err) {
        self.debug('socket error:', err);
        self.close();
    });

    self.socket = socket;
}

util.inherits(Session, EventEmitter);

Session.prototype.__defineGetter__('randomid', function () {
    return Math.floor(Math.random() * Math.pow(2, 53));
});

Session.prototype.parse = function(data) {
    var self = this;
    var mp = self.config.getValue('message-parser');

    mp.decode(data)
    .then(function (message) {
        switch (message.type) {
            case 'HELLO':
                q.fcall(function () {
                    self.id = self.randomid;
                    self.realm = message.realm;

                    var defer = q.defer();
                    self.emit('attach', message.realm, defer);
                    return defer.promise;
                })
                .then(function () {
                    return self.send('WELCOME', {session: self, details: {roles: self.config.getValue('supported-roles')}});
                })
                .then(function () {
                    self.debug('attached session to realm:', message.realm);
                    self.open = true;
                })
                .catch(function (err) {
                    self.error('cannot establish session!', err);
                    self.send('ABORT', {details: {message: 'Internal server error!'}, reason: 'wamp.error.session_error'});
                });
                break;
            case 'GOODBYE':
                self.close();
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
                    self.error('Cannot subscribe to topic:', message.topic, err);
                    self.send('ERROR', {request: {type: 'SUBSCRIBE', id: message.request.id}, details: {}, error: 'wamp.error.subscribe_error', args: [], kwargs: {}});
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
                    self.error('Cannot unsubscribe from topic:', message.subscription.id, err);
                    self.send('ERROR', {request: {type: 'UNSUBSCRIBE', id: message.request.id}, details: {}, error: 'wamp.error.unsubscribe_error', args: [], kwargs: {}});
                });
                break;
            case 'PUBLISH':
                q.fcall(function () {
                    var defer = q.defer();
                    self.emit('publish', message.topic, defer);
                    return defer.promise;
                })
                .then(function (topic) {
                    var publication = self.randomid;
                    if (message.options && message.options.acknowledge) {
                        self.send('PUBLISHED', {publish: {request: {id: message.request.id}}, publication: {id: publication}});
                    }
                    var queue = [];
                    _.forEach(topic.get, function (session) {
                        var event = session.send('EVENT', {subscribed: {subscription: {id: topic.id}}, published: {publication: {id: publication}}, details: {}, publish: {args: message.args, kwargs: message.kwargs}});
                        queue.push(event);
                    });
                    return q.all(queue);
                })
                .then(function () {
                    self.info('published event to topic:', message.topic);
                })
                .catch(function (err) {
                    self.error('cannot publish event to topic:', message.topic, err);
                    self.send('ERROR', {request: {type: 'PUBLISH', id: message.request.id}, details: {}, error: 'wamp.error.publish_error', args: [], kwargs: {}});
                });
                break;
            case 'REGISTER':
                q.fcall(function () {
                    var defer = q.defer();
                    self.emit('register', message.procedure, defer);
                    return defer.promise;
                })
                .then(function (id) {
                    self.send('REGISTERED', {register: {request: {id: message.request.id}}, registration: {id: id}});
                })
                .catch(function (err) {
                    self.error('cannot register remote procedure:', message.procedure, err);
                    self.send('ERROR', {request: {type: 'REGISTER', id: message.request.id}, details: {}, error: 'wamp.error.register_error', args: [], kwargs: {}});
                });
                break;
            case 'UNREGISTER':
                q.fcall(function () {
                    var defer = q.defer();
                    self.emit('unregister', message.registered.registration.id, defer);
                    return defer.promise;
                })
                .then(function () {
                    self.send('UNREGISTERED', {unregister: {request: {id: message.request.id}}});
                })
                .catch(function (err) {
                    self.error('cannot unregister remote procedure:', message.registered.registration.id, err);
                    self.send('ERROR', {request: {type: 'UNREGISTER', id: message.request.id}, details: {}, error: 'wamp.error.unregister_error', args: [], kwargs: {}});
                });
                break;
            case 'CALL':
                q.fcall(function () {
                    var defer = q.defer();
                    self.emit('call', message.procedure, defer);
                    return defer.promise;
                })
                .then(function (procedure) {
                    var id = procedure.invoke(self, message.request.id);
                    procedure.callee.send('INVOCATION', {request: {id: id}, registered: {registration: {id: procedure.id}}, details: {}, call: {args: message.args, kwargs: message.kwargs}});
                })
                .catch(function (err) {
                    self.error('cannot call remote procedure:', message.registered.registration.id, err);
                    self.send('ERROR', {request: {type: 'CALL', id: message.request.id}, details: {}, reason: 'wamp.error.call_error', args: [], kwargs: {}});
                });
                break;
            case 'YIELD':
                q.fcall(function () {
                    var defer = q.defer();
                    self.emit('yield', message.invocation.request.id, defer);
                    return defer.promise;
                })
                .then(function (invocation) {
                    invocation.session.send('RESULT', {call: {request: {id: invocation.request}}, options: {}, yield: {args: message.args, kwargs: message.kwargs}});
                })
                .catch(function (err) {
                    self.error('cannot yield remote procedure:', message.request.id, err);
                });
                break;
            case 'ERROR':
                var type = mp.getType(message.request.type);
                switch (type) {
                    case 'INVOCATION':
                        q.fcall(function () {
                            var defer = q.defer();
                            self.emit('yield', message.request.id, defer);
                            return defer.promise;
                        })
                        .then(function (invocation) {
                            invocation.session.send('ERROR', {request: {type: 'INVOCATION', id: invocation.request}, details: {}, error: 'wamp.error.invocation_error', args: message.args, kwargs: message.kwargs});
                        })
                        .catch(function (err) {
                            self.error('cannot respond to invocation error! Invocation request:', message.request.id);
                        });
                        break;
                    default:
                        self.error('error response for message type [%s] is not implemented yet!', message.request.type);
                }
                break;
            default:
                self.error('message type [' + message.type + '] not implemented yet!');
        }
    })
    .catch(function (err) {
        self.error('session parse error!', err);
        self.close();
    });
};

Session.prototype.close = function() {
    var self = this;

    if (self.open) {
        self.send('GOODBYE', {details: {message: 'Close connection'}, reason: 'wamp.error.goodbye_and_out'})
        .catch(function (err) {
            self.error('session close error!', err);
        })
        .finally(function () {
            self.info('session close');
            self.open = false;
            self.emit('close');
        });
    }
};

Session.prototype.send = function(type, opts) {
    var self = this
        , mp = self.config.getValue('message-parser');

    return mp.encode(type, opts)
    //.then(q.nfcall(WebSocket.prototype.send.bind(self.socket)));
    .then(function (message) {
        WebSocket.prototype.send.call(self.socket, message, function () {
            self.info('message sent');
        });
    });
};

module.exports = Session;
