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
        self.debug('socket error:', err.message);
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
                self.id = self.randomid;
                self.realm = message.realm;
                self.send('WELCOME', {session: self, details: {roles: self.config.getValue('supported-roles')}})
                .then(function () {
                    self.debug('attach session to realm:', message.realm);
                    self.emit('attach');
                })
                .catch(function (err) {
                    self.error('cannot establish session!', err.message);
                    self.close();
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
                    self.error('Cannot subscribe to topic:', message.topic);
                    self.send('ERROR', {request: {type: 'SUBSCRIBE', id: message.request.id}, details: {}, error: 'wamp.error.subscribe_error'});
                });
                break;
            case 'UNSUBSCRIBE':
                q.fcall(function () {
                    var defer = q.defer();
                    self.emit('unsubscribe', message.subscription.id, defer);
                    return defer.promise;
                })
                .then(function () {
                    self.send('UNSUBSCRIBED', {unsubscribe: {request: {id: message.request.id}}});
                })
                .catch(function (err) {
                    self.error('Cannot unsubscribe from topic:', message.subscription.id);
                    self.send('ERROR', {request: {type: 'UNSUBSCRIBE', id: message.request.id}, details: {}, error: 'wamp.error.unsubscribe_error'});
                });
                break;
            default:
                self.error('message type not implemented yet!');
        }
    })
    .catch(function (err) {
        self.error('session parse error!', err.message);
        self.close();
    });
};

Session.prototype.close = function() {
    var self = this;

    if (self.open) {
        self.send('GOODBYE', {details: {message: 'Close connection'}, reason: 'wamp.error.goodbye_and_out'})
        .catch(function (err) {
            self.error('session close error!', err.message);
        })
        .finally(function () {
            self.info('session close');
            self.open = false;
            self.emit('close');
        });
    } else {
        self.emit('close');
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
