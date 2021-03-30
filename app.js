const https = require('https'), 
    http = require('http'), 
    zlib = require('zlib'), 
    url = require('url'), 
    Rewriter = require('./rewriter');

module.exports = class {
    constructor(data = {}) { // duce can you help with something else
        this.prefix = data.prefix,
        this.deconstructUrl = url => url.slice(this.prefix.length), 
        this.constructUrl = url => this.prefix + url;
        Object.assign(globalThis, this);
    };

    // TODO: Add websocket server

    http(req, resp) {
        try {
            this.pUrl = new URL(deconstructUrl(req.url)),
            this.bUrl = new URL(req.protocol + '://' + req.host + this.prefix + this.pUrl.href)
        } catch (err) {
            return resp.writeHead(400, err).end(); // Also the error on the client side is blank
        }

        const rewriter = new Rewriter({prefix: this.prefix, bUrl: this.bUrl, pUrl: this.pUrl});

        if (this.pUrl.protocol == 'https:') this.reqProtocol = https;
        else if (this.pUrl.protocol == 'http:') this.reqProtocol = http;
        else return resp.writeHead(400, 'invalid protocol').end();

        const sendReq = this.reqProtocol.request(this.pUrl.href, {headers: Object.fromEntries(Object.entries(Object.assign({}, req.headers)).map(([key, val]) => [key, rewriter.header(key, val)])), method: req.method, followAllRedirects: false}, (clientResp, streamData = [], sendData = '') => clientResp.on('data', data => streamData.push(data)).on('end', () => {
            const enc = clientResp.headers['content-encoding'].split('; ')[0];
            console.log(enc)
            if (typeof enc != 'undefined') enc.split(', ').forEach(encType => {
                if (encType == 'gzip') sendData = zlib.gunzipSync(Buffer.concat(streamData)).toString();
                else if (encType == 'deflate') sendData = zlib.inflateSync(Buffer.concat(streamData)).toString();
                else if (encType == 'br') sendData = zlib.brotliDecompressSync(Buffer.concat(streamData)).toString();
                else sendData = Buffer.concat(streamData).toString();
            })

            Object.entries(clientResp.headers).forEach((key, val) => (['access-control-allow-origin', 'content-length', 'content-encoding'].includes(clientResp.headers) ? null : resp.setHeader[key, rewriter.header(key, val)]));

            resp.setHeader['access-control-allow-origin', this.bUrl.host];

            const type = clientResp.headers['content-type'].split('; ')[0];
            if (type == 'text/html') sendData = rewriter.html(sendData);
            if (type == 'text/css') sendData = rewriter.css(sendData);
            if (['text/javascript', 'application/x-javascript', 'application/javascript'].includes(type)) sendData = rewriter.css(sendData);

            console.log(resp.getHeaders());
            resp.statusCode = 200;

            resp.end(sendData);
        }));

        sendReq.on('error', err => resp.writeHead(400, err).end());

        req.on('data', data => sendReq.write(data)).on('end', () => (sendReq.end()));
    }
}
