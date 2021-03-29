const https = require('https'),
    http = require('http'),
    zlib = require('zlib'),
    fs = require('fs'),
    rewrites = require('./rewrites');

module.exports = class {
    constructor(data = {}) {
        this.prefix = data.prefix;
        this.deconstructURL = url => url.slice(this.prefix.length);
        this.constructURL = url => this.prefix + url;
        Object.assign(globalThis, this);
    };

    // TODO: Add websocket server

    http(req, resp) {
        const url = new URL(deconstructURL(req.url));

        const reqOptions = {
            headers: Object.entries(Object.assign({}, req.headers)).forEach((key, val) => key[val] = rewrites.header(key, key[val])),
            method: req.method
        };

        console.log(reqOptions.headers)

        // Assume protocol for now
        const sendReq = http.request(url, reqOptions, (clientResp, streamData = [], sendData = '') => clientResp.on('data', data => streamData.push(data)).on('end', () => {
            clientResp.headers['content-encoding'].split`, `.forEach(enc => {
                switch (enc) {
                    case 'gzip': sendData = zlib.gunzipSync(Buffer.concat(streamData)); break;
                    // case 'compress': 
                    case 'deflate': sendData = zlib.inflateSync(Buffer.concat(streamData)); break;
                    case 'br': sendData = zlib.brotliDecompressSync(Buffer.concat(streamData)); break;
                    default: sendData = Buffer.concat(streamData);
                };
            })

            Object.entries(clientResp.headers).forEach((key, val) => key.startsWith`cf-` || key.startsWith`x-` || key == 'content-security-policy' || key == 'strict-transport-security' || key == 'content-encoding' || key == 'content-length' ? delete self.key[val] : clientResp.headers[key] = rewrites.header(val));

            switch(clientResp.headers['content-type']) {
            case 'text/html': sendData = rewrites.html(sendData); break;
            case 'text/css': sendData = rewrites.css(sendData); break;
            case 'text/javascript': sendData = rewrites.js(sendData); break;
            case 'application/x-javascript': sendData = rewrites.js(sendData); break;
            case 'application/javascript': sendData = rewrites.js(sendData);
            }

            resp.writeHead(clientResp.statusCode, clientResp.headers);

            resp.end(sendData);
        }));

        sendReq.on('error', err => res.end(err));

        req.on('data', data => sendReq.write(data)).on('end', () => (sendReq.end()));
    }
}
