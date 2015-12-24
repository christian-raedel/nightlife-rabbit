var util       = require('./util')
    , logger   = util.logger()
    , parser   = util.parser()
    , randomid = util.randomid
    , Session  = require('./session')
    , q        = require('q')
    , _        = require('lodash');

function Realm() {
    var self = this;

    self.sessions = [];
    self.topics = {};
    self.procedures = {};
}

Realm.prototype.close = function(code, reason, wasClean) {
    var self = this;

    return q.fcall(function () {
        var promises = [];

        _.forEach(self.sessions, function (session) {
            promises.push(session.close(code, reason, true));
        });

        return promises;
    })
    .then(q.all);
};

Realm.prototype.session = function(session) {
    var self = this;

    if (session instanceof Session) {
        return _.find(self.sessions, function (s) {
            return s === session;
        });
    } else {
        throw new Error('wamp.error.invalid_argument');
    }
};

Realm.prototype.addSession = function(session) {
    var self = this;

    if (!self.session(session)) {
        self.sessions.push(session);
    } else {
        throw new Error('wamp.error.session_already_exists');
    }
};

Realm.prototype.cleanup = function(session) {

    _.forEach(this.procedures, function(procedure) {
        this.unregister(procedure.id, session);
    }, this);

    _.forEach(this.topics, function(topic, key, topics) {
        topic.removeSession(session);
        if (topic.sessions.length === 0) {
            delete topics[key];
        }
    });

    return this;
};

Realm.prototype.removeSession = function(session) {
    var self = this;

    if (self.session(session)) {
        self.sessions = _.filter(self.sessions, function (s) {
            return s !== session;
        });
    } else {
        throw new Error('wamp.error.no_such_session');
    }
};

Realm.prototype.subscribe = function(uri, session) {
    var self = this;

    if (parser.isUri(uri) && self.session(session)) {
        var topics = self.topics;

        if (!topics[uri]) {
            topics[uri] = new Topic();
        }

        topics[uri].addSession(session);

        return topics[uri].id;
    } else {
        throw new TypeError('wamp.error.invalid_argument');
    }
};

Realm.prototype.unsubscribe = function(id, session) {

    if (_.isNumber(id) && this.session(session)) {

        var key,
            topic = _.find(this.topics, function(t, k) {
                if (t.id === id) {
                    key = k;
                    return true;
                }
            });

        if (topic) {
            topic.removeSession(session);
            if (topic.sessions.length === 0) {
                delete this.topics[key];
            }
        }
        else {
            throw new TypeError('wamp.error.no_such_topic');
        }
    }
};

Realm.prototype.topic = function(uri) {
    var self = this;

    if (parser.isUri(uri)) {
        if (self.topics[uri]) {
            return self.topics[uri];
        } else {
            throw new Error('wamp.error.no_such_subscription');
        }
    } else {
        throw new TypeError('wamp.error.invalid_uri');
    }
};

Realm.prototype.procedure = function(uri) {
    var self = this;

    if (parser.isUri(uri)) {
        if (self.procedures[uri]) {
            return self.procedures[uri];
        } else {
            throw new Error('wamp.error.no_such_registration');
        }
    } else {
        throw new TypeError('wamp.error.invalid_uri');
    }
};

Realm.prototype.register = function(uri, callee) {
    var self = this;

    if (parser.isUri(uri) && self.session(callee)) {
        var procedures = self.procedures;

        if (!procedures[uri]) {
            var procedure = new Procedure(callee);
            procedures[uri] = procedure;
            return procedure.id;
        } else {
            throw new Error('wamp.error.procedure_already_exists');
        }
    } else {
        throw new TypeError('wamp.error.invalid_argument');
    }
};

Realm.prototype.unregister = function(id, callee) {
    var self = this;

    if (_.isNumber(id) && self.session(callee)) {
        var procedures = self.procedures;

        var uri = _.findKey(procedures, function (p) {
            return p.id === id && p.callee === callee;
        });

        if (uri) {
            delete procedures[uri];
        } else {
            throw new Error('wamp.error.no_such_registration');
        }
    } else {
        throw new TypeError('wamp.error.invalid_argument');
    }
};

Realm.prototype.invoke = function(uri, session, requestId) {
    var self = this;

    if (parser.isUri(uri) && self.session(session) && _.isNumber(requestId)) {
        var procedure = self.procedures[uri];

        if (procedure instanceof Procedure) {
            return procedure.invoke(session, requestId);
        } else {
            throw new Error('wamp.error.no_such_procedure');
        }
    } else {
        throw new TypeError('wamp.error.invalid_argument');
    }
};

Realm.prototype.yield = function(id) {
    var self = this;

    if (_.isNumber(id)) {
        return _.find(self.procedures, function (procedure) {
            return procedure.caller[id];
        })
        .yield(id);
    } else {
        throw new TypeError('wamp.error.invalid_argument');
    }
};

module.exports = Realm;

function Topic() {
    var self = this;

    self.id = randomid();
    self.sessions = [];
}

Topic.prototype.addSession = function(session) {
    var self = this;

    if (session instanceof Session) {
        var sessions = self.sessions;

        if (_.indexOf(sessions, session) === -1) {
            sessions.push(session);
        } else {
            throw new Error('wamp.error.topic_already_subscribed');
        }
    } else {
        throw new TypeError('wamp.error.invalid_arguments');
    }
};

Topic.prototype.removeSession = function(session) {
    var self = this;

    if (session instanceof Session) {
        self.sessions = _.filter(self.sessions, function (s) {
            return s !== session;
        });
    } else {
        throw new TypeError('wamp.error.invalid_argument');
    }
};

function Procedure(callee) {
    var self = this;

    if (callee instanceof Session) {
        self.callee = callee;
    } else {
        throw new TypeError('wamp.error.invalid_argument');
    }

    self.id = randomid();
    self.caller = {};
}

Procedure.prototype.invoke = function(requestId, session) {
    var self = this;

    if (session instanceof Session && self.callee instanceof Session) {
        var id = randomid();
        self.caller[id] = {requestId: requestId, session: session};
        return id;
    } else {
        throw new TypeError('wamp.error.invalid_argument');
    }
};

Procedure.prototype.yield = function(id) {
    var self = this;

    if (_.isNumber(id)) {
        var invocation = self.caller[id];
        delete self.caller[id];
        return invocation;
    } else {
        throw new TypeError('wamp.error.invalid_argument');
    }
};
