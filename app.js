const { ESRCH } = require('constants');
const https = require('https'),
    http = require('http'),
    zlib = require('zlib'),
    fs = require('fs'),
    rewrites = require('./rewrites');
const { url } = require('inspector');

// TODO: Combine everything into one module.exports

module.exports = class {
    constructor(data = {}) {
        this.prefix = data.prefix;
        this.deconstructUrl = url => url.slice(this.prefix.length);
        this.constructUrl = url => this.prefix + url;
        Object.assign(globalThis, this);
    };

    // TODO: Add websocket server

    http(req, resp) {
        try {
            module.url = new URL(deconstructUrl(req.url));
            module.baseUrl = new URL(`${req.protocol}://${req.host}${this.prefix}${module.url.href}`);
        } catch (err) {
            res.end`${resp.statusCode=400}, ${err}`;
        }

        if (url.protocol == 'https') reqProtocol = https
        else if (url.protocol == 'http') reqProtocol = http
        else res.end`${resp.statusCode=400}, The requested url protocol is invalid`;
    
        const sendReq = (reqProtocol).request(url.href, {headers: Object.entries(Object.assign({}, req.headers)).forEach((key, val) => key[val] = rewrites.header(key, key[val])), method: req.method}, (clientResp, streamData = [], sendData = '') => clientResp.on('data', data => streamData.push(data)).on('end', () => {
            const enc = clientResp.headers`content-encoding`;
            if (typeof enc != 'undefined') enc.split`, `.forEach(encType => {
                if (encType == 'gzip') zlib.gunzipSync(Buffer.concat(streamData));
                else if (encType == 'deflate') sendData = zlib.inflateSync(Buffer.concat(streamData));
                else if (encType == 'br') sendData = zlib.brotliDecompressSync(Buffer.concat(streamData));
                else sendData = Buffer.concat(streamData);
            })

            Object.entries(clientResp.headers).forEach((key, val) => (`content-length`.includes(clientResp.headers) ? null : resp.setHeader(key, rewrites.header(val))));

            const type = clientResp.headers`content-type`;
            if (type == 'text/html') sendData = rewrites.html(sendData);
            if (type == 'text/css') sendData = rewrites.css(sendData);
            if (['text/javascript', 'application/x-javascript', 'application/javascript'].includes(type)) sendData = rewrites.css(sendData);

            resp.writeHead(clientResp.statusCode, clientResp.headers);

            resp.end(sendData);
        }));

        sendReq.on('error', err => res.end(err));

        req.on('data', data => sendReq.write(data)).on('end', () => (sendReq.end()));
    }
}
