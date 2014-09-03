var Router = require('../lib/router')
    , CLogger = require('node-clogger')
    , chai = require('chai')
    , expect = chai.expect
    , spies = require('chai-spies')
    , promised = require('chai-as-promised');

chai.use(spies).use(promised);

var logger = new CLogger({name: 'router-tests'});

describe('Router:constructor', function () {
});
