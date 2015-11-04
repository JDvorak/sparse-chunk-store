var sparse = require('../')
var fdstore = require('fd-chunk-store')
var test = require('tape')
var randomBytes = require('randombytes')
var path = require('path')

var file = path.join(
  require('os').tmpdir(),
  'sparse-chunk-store-test-' + Math.random()
)
var sp, data = []
var SIZE = 1000

test('populate chunks', function (t) {
  t.plan(SIZE)
  for (var i = 0; i < SIZE; i++) {
    data.push({
      n: Math.floor(Math.random() * Math.pow(2,32)),
      buffer: randomBytes(256)
    })
  }
  sp = sparse(256, fdstore(256, file))
  var n = Number(process.argv[2])
  data.forEach(function (d) {
    sp.put(d.n, d.buffer, function (err) {
      t.ifError(err)
    })
  })
})

test('get chunks', function (t) {
  t.plan(data.length * 2)
  data.forEach(function (d) {
    sp.get(d.n, function (err, buf) {
      t.ifError(err)
      t.deepEqual(buf, d.buffer, 'n=' + d.n)
    })
  })
})
