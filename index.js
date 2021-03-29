const http = require('http'),
    Molten = require('./app.js')
    proxy = new Molten({prefix:'/'})

http.createServer((req, res) => proxy.http(req, res)).listen(80);