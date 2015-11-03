var sparse = require('../')
var fdstore = require('fd-chunk-store')
var sp = sparse(fdstore(64, '/tmp/chunks'))

var n = Number(process.argv[2])
var buf = Buffer(process.argv[3])
sp.get(n, function (err, buf) {
  if (err) console.error(err)
  else console.log(buf)
})
