var sparse = require('../')
var fdstore = require('fd-chunk-store')
var sp = sparse(32, fdstore(32, '/tmp/chunks'))

var n = Number(process.argv[2])
sp.get(n, function (err, buf) {
  if (err) console.error(err)
  else console.log(buf.toString())
})
