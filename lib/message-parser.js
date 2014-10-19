var CConf    = require('node-cconf')
    , engine = require('dna').createDNA()
    , q      = require('q')
    , _      = require('lodash');

function MessageParser(opts) {
    var self = this;

    var config = new CConf('message-parser', [
        'uriMatching:rules',
        'uriMatching:activeRule',
        'dictKeyMatchingRules'
    ], {
        'uriMatching': {
            'rules': {
                'simple': /^([0-9a-z_]*\.)*[0-9a-z_]*$/g
            },
            'activeRule': 'uriMatching:rules:simple'
        },
        'dictKeyMatchingRules': [
            /[a-z][0-9a-z_]{2,}/,
            /_[0-9a-z_]{3,}/
        ]
    })
    .load(opts || {});

    engine.use('typekey', function (value) {
        return self.getTypeKey(value);
    });

    engine.use('uri', function (value) {
        if (self.isUri(value)) {
            return value;
        } else {
            throw new Error('wamp.error.invalid_uri');
        }
    });

    engine.use('dict', function (value) {
        if (_.isPlainObject(value)) {
            var rules = _.map(config.getValue('dictKeyMatchingRules'), function (rule) {
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
                throw new Error('wamp.error.invalid_dict_key');
            }
        } else {
            throw new TypeError('wamp.error.invalid_argument');
        }
    });

    engine.use('list', function (value) {
        if (_.isArray(value)) {
            return value;
        } else {
            throw new TypeError('wamp.error.invalid_argument');
        }
    });

    engine.use('id', function (value) {
        if (_.isNumber(value)) {
            return value;
        } else {
            throw new TypeError('wamp.error.invalid_argument');
        }
    });

    engine.use('optional', function (value) {
        if (_.isEqual(value, []) || _.isEqual(value, {})) {
            return undefined;
        } else {
            return value;
        }
    });

    engine.onexpression = function (value) {
        try {
            return JSON.stringify(value);
        } catch (err) {
            throw new TypeError('wamp.error.invalid_argument');
        }
    };

    engine.oncomplete = function (value) {
        return value.replace(/,\ undefined/g, '');
    };

    self.config = config;
    self.template = engine;
}

MessageParser.prototype.TYPES = require('./message-types').TYPES;

MessageParser.prototype.getTypeKey = function(type) {
    var self = this;

    if (_.isString(type)) {
        var key = _.findKey(self.TYPES, function (t) {
            return t.type === type.toUpperCase();
        });

        if (key) {
            return parseInt(key);
        } else {
            throw new Error('wamp.error.no_such_message_type');
        }
    } else {
        throw new TypeError('wamp.error.invalid_argument');
    }
};

MessageParser.prototype.isUri = function(uri) {
    var self = this
        , config = self.config
        , activeRule = config.getValue('uriMatching:activeRule')
        , pattern = config.getValue(activeRule);

    if (_.isString(uri)) {
        return new RegExp(pattern).test(uri);
    } else {
        throw new TypeError('wamp.error.invalid_argument');
    }
};

MessageParser.prototype.encode = function(type, opts) {
    var self = this;

    return q.fcall(function () {
        var key = self.getTypeKey(type);

        if (_.isNumber(key) && _.isPlainObject(opts)) {
            opts.type = key;
            return self.template.render(self.TYPES[key].encode, opts);
        } else {
            throw new TypeError('wamp.error.invalid_message_type');
        }
    });
};

MessageParser.prototype.decode = function(data) {
    var self = this;

    return q.fcall(function () {
        try {
            data = JSON.parse(data);

            if (_.isArray(data)) {
                var fn = self.TYPES[data[0]].decode;

                if (_.isFunction(fn)) {
                    return fn.call(self, data);
                } else {
                    throw new Error('wamp.error.invalid_message_type');
                }
            } else {
                throw new TypeError('wamp.error.invalid_message');
            }
        } catch (err) {
            throw new TypeError('wamp.error.invalid_json');
        }
    });
};

module.exports = MessageParser;
