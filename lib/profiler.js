/*******************************************************************
 * memwatch
 ******************************************************************/
var memwatch = require('memwatch');
var diff = new memwatch.HeapDiff();
memwatch.on('leak', function (info) {
    console.log('memory leak info:\n', util.inspect(info));
    diff.end();
    console.log('heap memory diff:\n', util.inspect(diff));
    diff = new memwatch.HeapDiff();
});
memwatch.on('stats', function (stats) {
    console.log('memory stats:\n', util.inspect(stats));
});
/******************************************************************/
