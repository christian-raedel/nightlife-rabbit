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
            default:
                logger.error('wamp.error.not_implemented');
        }
    });
};

module.exports = Session;
