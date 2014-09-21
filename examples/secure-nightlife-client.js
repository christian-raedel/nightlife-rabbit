// Workaround for using self signed server certificates.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

var autobahn  = require('autobahn')
    , CLogger = require('node-clogger');

// See http://github.com/christian-raedel/node-clogger for reference.
var logger = new CLogger({name: 'client'});

// Create a new client connection.
// See http://autobahn.ws/js/ for reference.
var client = new autobahn.Connection({
    url: 'wss://localhost:8080/secure-nightlife',
    realm: 'com.example.inge'
});

// When client session is established, call 'random integer' service
// and subscribe to 'time' event.
client.onopen = function (session) {
    setInterval(function () {
        session.call('com.example.random')
        .then(function (random) {
            logger.info('random integer:', random);
        })
        .catch(function (err) {
            logger.error('cannot call random service!', err);
        })
        .done();
    }, 1800);

    session.subscribe('com.example.time', function (args, kwargs, details) {
        logger.info('current system time:', new Date(args[0]));
    })
    .catch(function (err) {
        logger.error('cannot subscribe to topic!', err);
    })
    .done();
};

// Open client connection.
client.open();
