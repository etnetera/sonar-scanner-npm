var assert = require('assert');
var index = require('../src/index');

describe('fromParam', function () {
  it('should provide the correct identity', function () {
    assert.deepEqual(index.fromParam(), ['--from=ScannerNpm/' + require('../package.json').version]);
  });
});
