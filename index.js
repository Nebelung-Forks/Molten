const http = require('http'),
    Molten = require('./app'),
    proxy = new Molten({httpPrefix: '/', wsPrefix: '/ws/'});

proxy.ws(http.createServer((req, res) => proxy.http(req, res)).listen(80));