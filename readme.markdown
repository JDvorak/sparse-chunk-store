# sparse-chunk-store

populate and query a chunk store with sparse blocks

# example

## put

``` js
var sparse = require('sparse-chunk-store')
var fdstore = require('fd-chunk-store')
var sp = sparse(32, fdstore(32, '/tmp/chunks'))

var n = Number(process.argv[2])
var buf = Buffer(process.argv[3])
sp.put(n, buf, function (err) {
  if (err) console.error(err)
})
```

## get

``` js
var sparse = require('sparse-chunk-store')
var fdstore = require('fd-chunk-store')
var sp = sparse(32, fdstore(32, '/tmp/chunks'))

var n = Number(process.argv[2])
sp.get(n, function (err, buf) {
  if (err) console.error(err)
  else console.log(buf.toString())
})
```

# api

``` js
var sparse = require('sparse-chunk-store')
```

## var sp = sparse(size, store)
## var sp = sparse(store)

Return a sparse chunk store `sp` from a non-sparse chunk store `store`.

If `store.size` is defined, `size` can be omitted as an explicit parameter.

## sp.get(index, opts={}, cb)

Read the block data at `index` as `cb(err, buf)`.

## sp.put(index, opts={}, cb)

Write block data at `index`.

# install

```
npm install sparse-chunk-store
```

# license

MIT
