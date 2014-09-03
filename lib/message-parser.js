var CConf = require('node-cconf')
    , CLogger = require('node-clogger')
    , CPlate = require('node-cplate').CPlate
    , debug = require('debug')('message-parser')
    , q = require('q')
    , _ = require('lodash');

function MessageParser(opts) {
    var self = this;
    var config = new CConf('message-parser-config', [
        'uri-matching:rules',
        'uri-matching:active-rule',
        'dict-key-matching-rules',
        'logger'
    ], {
        'uri-matching:rules': {
            'loose': {
                'allow-empty': /^(([^\s\.#]+\.)|\.)*([^\s\.#]+)?$/,
                'disallow-empty': /^([^\s\.#]+\.)*([^\s\.#]+)$/
            },
            'strict': {
                'allow-empty': /^(([0-9a-z_]+\.)|\.)*([0-9a-z_]+)?$/,
                'disallow-empty': /^([0-9a-z_]+\.)*([0-9a-z_]+)$/
            },
            'simple': /^([0-9a-z]*\.)*[0-9a-z]*$/g
        },
        'uri-matching:active-rule': 'uri-matching:rules:simple',
        'dict-key-matching-rules': [
            /[a-z][a-z0-9_]{2,}/,
            /_[a-z0-9_]{3,}/
        ],
        'logger': new CLogger({name: 'message-parser'}),
        'template': new CPlate()
    }).load(opts || {});

    config.getValue('logger').extend(self);

    self.config = config;

    debug('new message parser created.');
}

MessageParser.prototype.type = require('./message-types');

MessageParser.prototype.init = function () {
    var self = this;
    var config = self.config;
    var tpl = config.getValue('template');

    tpl.registerFilter('type', function (value) {
        var type = _.findKey(self.type, function (type) {
            return type[0] === value.toUpperCase();
        });
        if (_.isString(type)) {
            return parseInt(type);
        } else {
            throw new TypeError('Unrecognized wamp message type!');
        }
    })
    .registerFilter('uri', function (value) {
        if (_.isString(value)) {
            var pattern = config.getValue(config.getValue('uri-matching:active-rule'));
            var valid = new RegExp(pattern).test(value);
            debug('validating uri [%s] with pattern [%s] is [%s]...', value, pattern, valid ? 'valid' : 'invalid');
            if (valid) {
                return value;
            } else {
                self.error('Uri [%s] does not match pattern [%s]!', value, pattern);
            }
            return valid;
        } else {
            throw new TypeError('WAMP uri must be a string!');
        }
    })
    .registerFilter('dict', function (value) {
        var rules = _.map(config.getValue('dict-key-matching-rules'), function (rule) {
            return new RegExp(rule);
        });
        var valid = true;
        _.forOwn(value, function (value, key) {
            valid = _.reduce(rules, function (prev, rule) {
                return prev || rule.test(key);
            }, valid);
        });
        if (valid) {
            return value;
        } else {
            throw new TypeError('Wamp dict keys must match one of these rules: ' + _.map(rules, function (rule) {
                return rule.toString();
            }).join(' || '));
        }
    })
    .registerFilter('list', function (value) {
        if (_.isArray(value)) {
            return value;
        } else {
            throw new TypeError('Wamp list must be an array!');
        }
    })
    .registerFilter('id', function (value) {
        if (_.isNumber(value)) {
            return value;
        } else {
            return Math.floor(Math.random() * Math.pow(2, 53));
        }
    })
    .registerFilter('optional', function (value) {
        if (_.isEqual(value, []) || _.isEqual(value, {})) {
            return undefined;
        } else {
            return value;
        }
    })
    .registerFilter('transformer', function (value) {
        try {
            return JSON.stringify(value);
        } catch (err) {
            self.error('Cannot transform value to JSON! reason: ' + err.message);
        }
    })
    .registerFilter('finalizer', function (value) {
        return value.replace(/,\ undefined|\ /g, '');
    });

    return self;
};

MessageParser.prototype.encode = function (type, opts) {
    var self = this;
    var tpl = self.config.getValue('template');
    return q.fcall(function () {
        var key = _.findKey(self.type, function (key) {
            debug('type %s %s %s', key[0], key[0] === type.toUpperCase() ? '===' : '!==', type.toUpperCase());
            return key[0] === type.toUpperCase();
        });
        if (_.isString(key) && _.isObject(opts)) {
            var message = tpl.format(self.type[key][1], _.merge(opts, {type: parseInt(key)}), this);
            debug('encoded message: %j', message);
            return message;
        } else {
            throw new TypeError('Message encoding requires a valid message type and a message parameters object!');
        }
    });
};

MessageParser.prototype.decode = function(data, fn) {
    var self = this;
    return q.fcall(function () {
        try {
            var message = JSON.parse(data);
            debug('parse message = %j', message);
            if (_.isArray(message)) {
                var type = self.type[message.shift()][0];

                var result = {
                    type: type
                };
                debug('parse result = %j', result);
                return fn(result);
            } else {
                throw new TypeError('WAMP message must be an array!');
            }
        } catch (err) {
            throw new Error('Cannot parse message! reason: ' + err.message);
        }
    });
};

module.exports = MessageParser;
