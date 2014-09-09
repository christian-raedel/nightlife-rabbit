var CConf = require('node-cconf')
    , CLogger = require('node-clogger')
    , Session = require('./session')
    , _ = require('lodash');

var logger = new CLogger({name: 'realm'});

function Realm() {
    var self = this;

    logger.extend(this);

    self.sessions = [];
    self.topics = {};
    self.procedures = {};
}

Realm.prototype.addSession = function(session) {
    var self = this;

    if (session instanceof Session) {
        var sessions = self.sessions;
        var found = _.find(sessions, function (_session) {
            return _session.id === session.id;
        });
        if (!found) {
            sessions.push(session);
            return self;
        } else {
            throw new Error('Session already attached to realm!');
        }
    } else {
        throw new TypeError('Only a instance of Session can be attached to a realm!');
    }
};

Realm.prototype.removeSession = function(session) {
    var self = this;

    if (session instanceof Session) {
        var sessions = self.sessions;
        var count = sessions.length;
        sessions = _.filter(sessions, function (_session) {
            return _session.id !== session.id;
        });
        if (sessions.length !== count) {
            self.debug('session detached from realm.');
        }
        return self;
    } else {
        throw new TypeError('Only a instance of Session can be detached from a realm!');
    }
};

Realm.prototype.topic = function(uri) {
    var self = this;
    var topics = self.topics;

    if (_.isString(uri)) {
        if (!topics[uri]) {
            topics[uri] = new Topic();
        }
        return topics[uri];
    } else if (_.isNumber(uri)) {
        return _.find(topics, function (topic) {
            return topic.id === uri;
        });
    } else {
        throw new TypeError('Topic uri must be a valid wamp uri string!');
    }
};

Realm.prototype.procedure = function(uri, callee) {
    var self = this;
    var procedures = self.procedures;

    if (_.isString(uri)) {
        if (!procedures[uri] && callee instanceof Session) {
            procedures[uri] = new Procedure(callee);
        } else if (!procedures[uri] && !callee) {
            throw new TypeError('Cannot create Procedure without callee session!');
        }
        return procedures[uri];
    } else if (_.isNumber(uri)) {
        return _.find(procedures, function (procedure) {
            return procedure.id === uri && procedure.callee.id === callee.id;
        });
    } else {
        throw new TypeError('Procedure uri must be a valid wamp uri string!');
    }
};

function Topic() {
    var self = this;

    logger.extend(this);

    self.id = self.randomid;
    self.sessions = [];
}

Topic.prototype.__defineGetter__('randomid', function () {
    return Math.floor(Math.random() * Math.pow(2, 53));
});

Topic.prototype.__defineGetter__('get', function () {
    return this.sessions;
});

Topic.prototype.addSession = function(session) {
    var self = this;

    if (session instanceof Session) {
        var sessions = self.sessions;
        var found = _.find(sessions, function (_session) {
            return _session.id === session.id;
        });
        if (_.isUndefined(found)) {
            sessions.push(session);
            return self;
        } else {
            throw new Error('Session already subscribed to topic!');
        }
    } else {
        throw new Error('Topic subscription must be an instance of Session!');
    }
};

Topic.prototype.removeSession = function(session) {
    var self = this;

    if (session instanceof Session) {
        var sessions = self.sessions;
        var count = sessions.length;
        sessions = _.filter(sessions, function (_session) {
            return _session.id !== session.id;
        });
        if (sessions.length !== count) {
            self.debug('session unsubscribed from topic.');
        }
        return self;
    } else {
        throw new Error('Topic unsubscription must be an instance of Session!');
    }
};

function Procedure(callee) {
    var self = this;
    self.id = self.randomid;

    if (callee instanceof Session) {
        self.callee = callee;
    } else {
        throw new TypeError('Procedure callee must be an instance of Session!');
    }

    logger.extend(this);
}

Procedure.prototype.__defineGetter__('randomid', function () {
    return Math.floor(Math.random() * Math.pow(2, 53));
});

module.exports = Realm;
