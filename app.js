const https = require('https'), 
    http = require('http'),
    WebSocket = require('ws'),
    zlib = require('zlib'), 
    url = require('url'), 
    Rewriter = require('./rewriter');

module.exports = class {
    constructor(data = {}) {
        this.httpPrefix = data.wsPrefix;
        this.wsPrefix = data.wsPrefix;
        Object.assign(globalThis, this);
    };

    static blockedRespHeaders = ['content-*', 'forwarded', 'x-*']

    static constructUrl(url) {
        const caller = this.deconstructUrl.caller.name;
        if (caller == 'http') return this.httpPrefix + url;
        if (caller == 'ws') return this.wsPrefix + url;
    }

    static deconstructUrl(url) {
        const caller = this.deconstructUrl.caller.name;
        if (caller == 'http') return url.slice(this.httpPrefix.length);
        if (caller == 'ws') return url.slice(this.wsPrefix.length);
    }

    http(req, resp) {
        this.pUrl = new URL(httpDeconstructUrl(req.url));
        this.bUrl = new URL(req.protocol + '://' + req.host + this.httpPrefix + this.pUrl.href);

        if (this.pUrl.protocol == 'https:') this.reqProtocol = https;
        else if (this.pUrl.protocol == 'http:') this.reqProtocol = http;
        else return resp.writeHead(400, 'invalid protocol').end();
        
        const sendReq = this.reqProtocol.request(this.pUrl.href, {headers: Object.fromEntries(Object.entries(Object.assign({}, req.headers)).map((key, val) => this.blockedRespHeaders.includes(key) ? delete (key, val) : key, rewriter.header(key, val))), method: req.method, followAllRedirects: false}, (clientResp, streamData = [], sendData = '') => clientResp.on('data', data => streamData.push(data)).on('end', () => {
            const enc = clientResp.headers['content-encoding'] || clientResp.headers['transfer-encoding'].split('; ')[0];
            if (typeof enc != 'undefined') enc.split(', ').forEach(encType => {
                if (encType == 'gzip') sendData = zlib.gunzipSync(Buffer.concat(streamData)).toString();
                else if (encType == 'deflate') sendData = zlib.inflateSync(Buffer.concat(streamData)).toString();
                else if (encType == 'br') sendData = zlib.brotliDecompressSync(Buffer.concat(streamData)).toString();
                else sendData = Buffer.concat(streamData).toString();
            })

            const rewriter = new Rewriter({httpPrefix: this.httpPrefix, bUrl: this.bUrl, pUrl: this.pUrl, blockedRespHeaders: this.blockedRespHeaders});

            resp.setHeader(Object.entries(clientResp.headers).map((key, val) => !key.startsWith('content-') && !['forwarded'].includes(key) && !key.startsWith('x-') ? (key, rewriter.header(key, val)) : delete (key, val)));

            const type = clientResp.headers['content-type'].split('; ')[0];
            if (type == 'text/html') sendData = rewriter.html(sendData);
            if (type == 'text/css') sendData = rewriter.css(sendData);
            if (['text/javascript', 'application/x-javascript', 'application/javascript'].includes(type)) sendData = rewriter.css(sendData);

            resp.statusCode = 200;

            resp.end(sendData);
        }));

        sendReq.on('error', err => resp.writeHead(400, err).end());

        req.on('data', data => sendReq.write(data)).on('end', () => (sendReq.end()));
    };

    ws(server) {
        new WebSocket.Server({server: server}).on('connection', (wsClient, req) => {
            this.pUrl = new URL(wsDeconstructUrl(req.url)),
            this.bUrl = new URL(req.protocol + '://' + req.host + this.wsPrefix + this.pUrl.href)

            let msgParts = [];

            sendReq = new WebSocket(this.pUrl.href, {origin: this.pUrl.origin, headers: req.headers})
                .on('message', msg => wsClient.send(msg))
                .on('open', () => sendReq.send(msgParts.join('')))
                .on('error', () => wsClient.terminate())
                .on('close', () => wsClient.close());

            wsClient
                .on('message', msg => sendReq.readyState == WebSocket.open ? sendReq.send(msg) : msgParts.push(msg))
                .on('error', () => sendReq.terminate())
                .on('close', () => sendReq.close());
        });
    };
}
