var sparse = require('../')
var fdstore = require('fd-chunk-store')
var test = require('tape')
var path = require('path')

var file = path.join(
  require('os').tmpdir(),
  'sparse-chunk-store-test-' + Math.random()
)

test('error cases', function (t) {
  t.plan(6)
  var sp = sparse(256, fdstore(256, file))
  sp.put(-1, Buffer('case 1'), function (err) {
    t.ok(err, 'negative n')
  })
  sp.put(5, Buffer('case 2'), function (err) {
    t.ifError(err)
  })
  sp.put(1234567890123456, Buffer('case 3'), function (err) {
    t.ok(err, 'overflow n')
  })
  sp.put('123', Buffer('case 4'), function (err) {
    t.ok(err, 'non-number string n')
  })
  sp.put(null, Buffer('case 5'), function (err) {
    t.ok(err, 'null n')
  })
  sp.put(NaN, Buffer('case 6'), function (err) {
    t.ok(err, 'NaN n')
  })
})
