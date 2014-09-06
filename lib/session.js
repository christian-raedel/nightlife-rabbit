var MessageParser  = require('./message-parser')
    , CConf        = require('node-cconf')
    , CLogger      = require('node-clogger')
    , debug        = require('debug')('wamp:session')
    , util         = require('util')
    , EventEmitter = require('events').EventEmitter
    , WebSocket    = require('ws')
    , q            = require('q')
    , _            = require('lodash');

function Session(socket, opts) {
    if (!(socket instanceof WebSocket)) {
        throw new TypeError('Session socket must be a websocket!');
    }

    console.log(opts);
    var config = new CConf('session', ['supported-roles'], {
        'logger': new CLogger({name: 'session'})
    }).load(opts || {});

    config.getValue('logger').extend(this);

    EventEmitter.call(this);

    var self = this
        , mp = new MessageParser().init();

    self.info('Session supports:', config.getValue('supported-roles'));

    socket.on('message', function (data) {
        debug('socket received data:', data);
        self.receive(data);
    });

    socket.on('error', function (err) {
        debug('socket error:', err);
        self.emit('error', err);
    });

    socket.on('close', function (code) {
        debug('socket closed:', code);
        self.emit('close', code);
    });

    self.config = config;
    self.mp = mp;
    self.id = self.randomid;
    self.realm = null;
    self.socket = socket;
    self.requests = {};
}

util.inherits(Session, EventEmitter);

Session.prototype.__defineGetter__('randomid', function () {
    return Math.floor(Math.random() * Math.pow(2, 53));
});

Session.prototype.send = function(type, opts) {
    debug('sending message of type [%s]...', type);
    var self     = this
        , mp     = self.mp
        , socket = self.socket;

    return mp.encode(type, opts).then(q.nfcall(WebSocket.prototype.send.bind(socket)));
};

Session.prototype.receive = function(data) {
    debug('receiving message...');
    var self = this
        , mp = self.mp;

    mp.decode(data)
    .then(function (message) {
        switch (message.type) {
            case 'HELLO':
                debug('received HELLO message...');
                self.establish(message.realm, message.details)
                .then(self.send('WELCOME', {session: self, details: {roles: message.details.roles}}))
                .then(function () {
                    self.info('Session [%d] to realm [%s] established.', self.id, message.realm);
                })
                .catch(function (err) {
                    self.send('ABORT', {details: {message: err.message}, reason: 'wamp.error.invalid_arguments'});
                    self.error('Cannot establish session [%d] to realm [%s]!', self.id, message.realm);
                    self.emit('error', err);
                });
                break;
            default:
                self.error('Message type not implemented yet!');
        }
    })
    .catch(function (err) {
        self.emit('error', err);
    });
};

Session.prototype.establish = function(realm, opts) {
    debug('establish session to realm:', realm);
    var self = this;

    return q.fcall(function () {
        if (_.isString(realm) && _.isPlainObject(opts)) {
            self.realm = realm;
            self.roles = opts.roles;
            self.emit('attach', realm, opts);
            return true;
        } else {
            throw new TypeError('Session establishment requires a realm uri and an object with supported roles!');
        }
    });
};

Session.prototype.close = function(message, reason) {
    debug('closing session...');
    var self = this;

    return self.send('GOODBYE', {details: {message: message}, reason: reason})
    .then(function () {
        self.socket.close();
    })
    .catch(function (err) {
        self.emit('error', err);
    });
};

/*
Session.prototype.register = function(<`3:#:first_argument`>) {
    <`0:TARGET`>
};

Session.prototype.unregister = function(<`3:#:first_argument`>) {
    <`0:TARGET`>
};

Session.prototype.call = function(<`3:#:first_argument`>) {
    <`0:TARGET`>
};

Session.prototype.subscribe = function(<`3:#:first_argument`>) {
    <`0:TARGET`>
};

Session.prototype.unsubscribe = function(<`3:#:first_argument`>) {
    <`0:TARGET`>
};

Session.prototype.publish = function(<`3:#:first_argument`>) {
    <`0:TARGET`>
};
*/

module.exports = Session;
