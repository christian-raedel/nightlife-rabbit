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
    var self = this;

    if (_.isNumber(id) && self.session(session)) {
        _.find(self.topics, function (t) {
            return t.id === id;
        })
        .removeSession(session);
    } else {
    }
};

Realm.prototype.topic = function(uri) {
    var self = this;

    if (parser.isUri(uri)) {
        if (self.topics[uri]) {
            return self.topics[uri];
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
            procedures[uri] = new Procedure(callee);
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
        delete self.caller[id];
    } else {
        throw new TypeError('wamp.error.invalid_argument');
    }
};
