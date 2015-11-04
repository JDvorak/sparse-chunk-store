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
      var next = buf.readUInt32BE(
        (n < median(items) ? 0 : 4) + (ix === 0 ? 4 : 0)
      )
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
    buf = Buffer.concat([ buf, self.zeros.slice(0, self.size - buf.length) ])
  }
  self.lock('put', function (release) {
    var index = 0
    var avail = 0
    var first = null
    self.store.get(index, onget)

    function onget (err, hbuf) {
      if (err) return cb(err)
      if (hbuf.length === 0) {
        hbuf = Buffer(self.size)
        hbuf.fill(0)
        if (index === 0) {
          hbuf.writeUInt32BE(2, 0) // next available chunk
          hbuf.writeUInt32BE(0, 4) // left
          hbuf.writeUInt32BE(0, 8) // right
          avail = 2
        } else {
          hbuf.writeUInt32BE(0, 0) // left
          hbuf.writeUInt32BE(0, 4) // right
        }
      } else if (index === 0) {
        avail = hbuf.readUInt32BE(0)
      }
      if (index === 0) first = hbuf

      var items = []
      for (var i = index === 0 ? 12 : 8; i <= hbuf.length - 8; i += 8) {
        var src = hbuf.readUInt32BE(i)
        var dst = hbuf.readUInt32BE(i+4)
        if (dst === 0) {
          first.writeUInt32BE(avail+1, 0)
          hbuf.writeUInt32BE(n, i)
          hbuf.writeUInt32BE(avail, i+4)
          return self.store.put(avail, buf, opts, function (err) {
            if (err) return release(cb)(err)
            self.store.put(0, first, function (err) {
              if (err) return release(cb)(err)
              self.store.put(index, hbuf, release(cb))
            })
          })
        } else if (src === n) {
          return self.store.put(dst, buf, opts, release(cb))
        }
        items.push(src)
      }

      // allocate a new index chunk
      var m = median(items)
      var next = hbuf.readUInt32BE((n < m ? 0 : 4) + (index === 0 ? 4 : 0))
      if (next) {
        index = next
        self.store.get(index, onget)
      } else if (index === 0) {
        index = avail++
        first.writeUInt32BE(avail, 0)
        first.writeUInt32BE(index, n < m ? 4 : 8)
        self.store.put(0, first, function (err) {
          if (err) release(cb)(err)
          else self.store.get(index, onget)
        })
      } else {
        first.writeUInt32BE(avail+1, 0)
        hbuf.writeUInt32BE(avail, n < m ? 0 : 4)
        self.store.put(0, first, function (err) {
          if (err) return release(cb)(err)
          self.store.put(index, hbuf, function (err) {
            if (err) return release(cb)(err)
            index = avail + 1
            self.store.get(index, onget)
          })
        })
      }
    }
  })
}

function noop () {}
