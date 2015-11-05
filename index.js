var inherits = require('inherits')
var median = require('median')
var lock = require('lock')
var EventEmitter = require('events').EventEmitter
var has = require('has')

var buf0 = Buffer(0)
var maxInt32 = Math.pow(2,32) - 1

module.exports = Sparse
inherits(Sparse, EventEmitter)

function Sparse (size, store, opts) {
  var self = this
  if (!(self instanceof Sparse)) return new Sparse(size, store, opts)
  if (typeof size === 'object' && size.size) {
    opts = store
    store = size
    size = store.size
  }
  if (!opts) opts = {}
  if (size < 20) {
    throw new Error('size must be >= 20')
  }
  self.size = size
  self.cache = opts.cache ? {} : null
  self.zeros = Buffer(size).fill(0)
  self.store = store
  self.lock = lock()
}

Sparse.prototype._putTable = function (n, buf, cb) {
  if (this.cache) this.cache[n] = buf
  this.store.put(n, buf, cb)
}

Sparse.prototype._getTable = function (n, cb) {
  var self = this
  if (self.cache && has(self.cache, n)) {
    process.nextTick(function () { cb(null, self.cache[n]) })
  } else self.store.get(n, cb)
}

Sparse.prototype.get = function (n, opts, cb) {
  var self = this
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  if (!cb) cb = noop
  ;(function get (ix) {
    self._getTable(ix, function onget (err, buf) {
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
  if (n < 0) return nexterr(cb, 'negative value for n in put: n=' + n)
  else if (isNaN(n) || typeof n !== 'number') {
    return nexterr(cb, 'n is not a number: n=' + n + ' (' + typeof n + ')')
  } else if (n > maxInt32) {
    return nexterr(cb, 'n does not fit in 32 bits: n=' + n)
  }

  self.lock('put', function (release) {
    var index = 0
    var avail = 0
    var first = null
    self._getTable(index, onget)

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
      for (var i = index === 0 ? 12 : 8; i < hbuf.length - 8; i += 8) {
        var src = hbuf.readUInt32BE(i)
        var dst = hbuf.readUInt32BE(i+4)
        if (dst === 0) {
          first.writeUInt32BE(avail+1, 0)
          hbuf.writeUInt32BE(n, i)
          hbuf.writeUInt32BE(avail, i+4)
          return self.store.put(avail, buf, opts, function (err) {
            if (err) return release(cb)(err)
            self._putTable(0, first, function (err) {
              if (err) return release(cb)(err)
              self._putTable(index, hbuf, release(cb))
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
        self._getTable(index, onget)
      } else if (index === 0) {
        index = avail++
        first.writeUInt32BE(avail, 0)
        first.writeUInt32BE(index, n < m ? 4 : 8)
        self._putTable(0, first, function (err) {
          if (err) release(cb)(err)
          else self._getTable(index, onget)
        })
      } else {
        first.writeUInt32BE(avail+1, 0)
        hbuf.writeUInt32BE(avail, n < m ? 0 : 4)
        self._putTable(0, first, function (err) {
          if (err) return release(cb)(err)
          self._putTable(index, hbuf, function (err) {
            if (err) return release(cb)(err)
            index = avail++
            self._getTable(index, onget)
          })
        })
      }
    }
  })
}

function noop () {}

function nexterr (cb, msg) {
  var err = new Error(msg)
  process.nextTick(function () { cb(err) })
}
