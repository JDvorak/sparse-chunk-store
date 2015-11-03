var inherits = require('inherits')
var median = require('median')
var lock = require('lock')
var EventEmitter = require('events').EventEmitter

var buf0 = Buffer(0)

module.exports = Sparse
inherits(Sparse, EventEmitter)

function Sparse (size, store) {
  var self = this
  if (!(self instanceof Sparse)) return new Sparse(size, store)
  if (typeof size === 'object' && size.size) {
    store = size
    size = store.size
  }
  if (size < 20) {
    throw new Error('size must be >= 20')
  }
  self.size = size
  self.zeros = Buffer(size).fill(0)
  self.store = store
  self.lock = lock()
}

Sparse.prototype.get = function (n, opts, cb) {
  var self = this
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  if (!cb) cb = noop
  ;(function get (ix) {
    self.store.get(ix, function onget (err, buf) {
      if (err) return cb(err)
      if (buf.length === 0) return cb(null, buf0)
      var items = []
      for (var i = ix === 0 ? 12 : 8; i <= buf.length - 8; i += 8) {
        var src = buf.readUInt32BE(i)
        var dst = buf.readUInt32BE(i+4)
        if (dst === 0) break
        if (src === n) return self.store.get(dst, cb)
        items.push(src)
      }
      var next = buf.readUInt32BE(n < median(items) ? 4 : 8)
      if (next) get(next)
      else cb(null, buf0)
    })
  })(0)
}

Sparse.prototype.put = function (n, buf, opts, cb) {
  var self = this
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  if (!cb) cb = noop
  if (buf.length < self.size) {
    buf = Buffer.concat([ buf, self.zeros.slice(0, self.size - buf.length)  ])
  }
  self.lock('put', function (release) {
    self.store.get(0, function (err, hbuf) {
      if (err) return cb(err)
      if (hbuf.length === 0) {
        hbuf = Buffer(self.size)
        hbuf.writeUInt32BE(1, 0) // next available chunk
        hbuf.writeUInt32BE(0, 4) // left
        hbuf.writeUInt32BE(0, 8) // right
        hbuf.writeUInt32BE(n, 12) // src: n
        hbuf.writeUInt32BE(1, 16) // dst: 1

        return self.store.put(1, buf, opts, function (err) {
          if (err) return release(cb)(err)
          self.store.put(0, hbuf, release(cb))
        })
      }
      for (var i = 12; i <= hbuf.length - 8; i += 8) {
        var src = hbuf.readUInt32BE(i)
        var dst = hbuf.readUInt32BE(i+4)
        if (dst === 0) break
        if (src === n) return self.store.put(dst, buf, opts, release(cb))
      }
      console.log('todo')
    })
  })
}

function noop () {}
