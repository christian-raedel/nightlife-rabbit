[![Build Status](https://travis-ci.org/christian-raedel/nightlife-rabbit.svg?branch=master)](https://travis-ci.org/christian-raedel/nightlife-rabbit)

#Nightlife-Rabbit#
[![Gitter](https://badges.gitter.im/Join Chat.svg)](https://gitter.im/christian-raedel/nightlife-rabbit?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

A [WAMP](http://wamp.ws)-Router implementation for [node.js](http://nodejs.org).
At the moment, WAMP basic profile in the roles of dealer and broker are supported.
For client connections: publish/subscribe and remote procedure register/call,
[AutobahnJS](http://autobahn.ws/js) can be used.

##Install##

```
npm install --save git+https://github.com/christian-raedel/nightlife-rabbit
```

##Basic Usage##

``` Javascript
var http       = require('http')
    , CLogger  = require('node-clogger');

var nightlife  = require('nightlife')
    , autobahn = require('autobahn');

// Create a new router with given options. In this example, the options are the
// default values.
var router = nightlife.createRouter({
    httpServer: http.createServer(),                    // Nodes http or https server can be used.
                                                        // httpServer.listen() will be called from
                                                        // within router constructor.

    port: 3000,                                         // The url for client connections will be:
    path: '/nightlife',                                 // ws://localhost:3000/nightlife.

    autoCreateRealms: true,                             // If set to false, an exception will be thrown
                                                        // on connecting to a non-existent realm.

    logger: new CLogger({name: 'nightlife-router'})     // Must be an instance of 'node-clogger'.
                                                        // See http://github.com/christian-raedel/node-clogger
                                                        // for reference...
});

var client = new autobahn.Connection({
    url: 'ws://localhost:3000/nightlife',
    realm: 'com.example.myapp'
});

client.onopen = function (session) {
    // do pub/sub or some procedure calls...
};

client.open();
```

##Advanced Usage##

Please see the examples directory of this repository.
