var CConf = require('node-cconf')
    , CLogger = require('node-clogger')
    , debug = require('debug')('router')
    , WebSocketServer = require('ws')
    , util = require('util')
    , http = require('http')
    , _ = require('lodash');

function Router(opts) {
    var self = this;

    var config = new CConf('nightlife-router-conf', [
        'realms'
    ], {
        'name': 'nightlife-router',
        'path': '/nightlife',
        'port': 3000,
        'verifyClient': function () {},
        'disableHixie': false,
        'clientTracking': true
    })
    .setDefault('logger', new CLogger({name: this.getValue('name')}))
    .load(opts || {});

    config.getValue('logger').extend(self);

    var port = config.getValue('port');
    var server = http.Server(function (req, res) {
        res.writeHead(404);
        res.end();
    }).listen(port, function() {
        self.info('bound and listen at %d', port);
    });

    config.setDefault('server', server);

    WebSocketServer.call(self, config.getObject([
        'path',
        'server',
        'verifyClient',
        'disableHixie',
        'clientTracking'
    ]));

    self.config = config;

    self.on('error', function (err) {
        self.error('WebSocket error: %s', err.message);
    });

    self.on('connection', function (socket) {
        self.info('Incoming connection...');
    });
}

util.inherits(Router, WebSocketServer);

module.exports = Router;
