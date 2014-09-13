var CLogger         = require('node-clogger')
    , MessageParser = require('./message-parser');

var logger;
module.exports.logger = function () {
    if (!(logger instanceof CLogger)) {
        logger = new CLogger({name: 'nightlife-router'});
    }
    return logger;
};

var parser;
module.exports.parser = function (opts) {
    if (!(parser instanceof MessageParser) || opts) {
        parser = new MessageParser(opts);
    }
    return parser;
};

module.exports.randomid = function () {
    return Math.floor(Math.random() * Math.pow(2, 53));
};
