const https = require('https'), 
    http = require('http'),
    WebSocket = require('ws'),
    zlib = require('zlib'), 
    url = require('url'), 
    Rewriter = require('./rewriter');

module.exports = class {
    constructor(data = {}) {
        this.prefix = data.prefix;

        Object.assign(globalThis, this);
    };

    constructUrl = url => url = this.prefix + url;

    deconstructUrl = url => url = url.slice(this.prefix.length);

    http(req, resp) {
        try {
            this.pUrl = new URL(this.deconstructUrl(req.url)),
            this.bUrl = new URL((req.connection.encrypted ? 'https' : !req.connection.encrypted ? 'http' : null) + '://' + req.headers.host + this.prefix + this.pUrl.href);
        } catch (err) {
            resp.writeHead(200, { 'content-type': 'text/plain' })
                .destroy(err);
        }

        const rewriter = new Rewriter({
            prefix: this.prefix, 
            bUrl: this.bUrl, 
            pUrl: this.pUrl
        });

        const sendReq = (this.pUrl.protocol == 'https:' ? https :
        this.pUrl.protocol == 'http:' ? http : null).request(this.pUrl.href, { 
            headers: Object.entries(req.headers).map(([key, val]) => [key, rewriter.header(key, val)]),
            method: req.method, 
            followAllRedirects: false 
        }, (clientResp, streamData = [], sendData = '') => clientResp.on('data', data => streamData.push(data)).on('end', () => {
            const enc = clientResp.headers['content-encoding'] || clientResp.headers['transfer-encoding'];
            if (typeof enc != 'undefined') enc.split`; `[0].split`, `.forEach(encType => {
                sendData = encType == 'gzip' ? zlib.gunzipSync(Buffer.concat(streamData)).toString() :
                    encType == 'deflate' ? zlib.inflateSync(Buffer.concat(streamData)).toString() :
                    encType == 'br' ? zlib.brotliDecompressSync(Buffer.concat(streamData)).toString() :
                    Buffer.concat(streamData).toString();
            })

            const type = clientResp.headers['content-type'];
            if (typeof type != 'undefined') {
                const directive = type.split`; `[0];
                
                sendData = directive == 'text/html' ? rewriter.html :
                    directive == 'text/css' ? rewriter.css :
                    ['text/javascript', 'application/x-javascript', 'application/javascript'].includes(directive) ? rewriter.js : sendData;
            }

            resp.writeHead(200, Object.entries(clientResp.headers).filter(([key, val]) => !['content-encoding', 'content-length', 'forwarded'].includes(key) && !key.startsWith`x-` ? [key, rewriter.header(key, val)] : null))
                .end(sendData)
        }));

        sendReq.on('error', err => {
            resp.writeHead(200, { 'content-type': 'text/plain' })
                .destroy(err)
        });

        req.on('data', data => sendReq.write(data))
            .on('end', () => sendReq.end());
    };

    ws(server) {
        new WebSocket.Server({ server: server }).on('connection', (wsClient, req) => {
            try {
                this.pUrl = new URL((typeof this.pUrl == 'undefined' ? this.deconstructUrl(req.url) : this.pUrl).split`?ws=`[1])
            } catch (err) {
                req.terminate(err);
            }

            let msgParts = [];

            sendReq = new WebSocket(this.pUrl.href, { origin: this.pUrl.origin, headers: req.headers }).on('message', msg => wsClient.send(msg))
                .on('open', () => sendReq.send(msgParts.join('')))
                .on('error', () => wsClient.terminate())
                .on('close', () => wsClient.close());

            wsClient.on('message', msg => sendReq.readyState == WebSocket.open ? sendReq.send(msg) : msgParts.push(msg))
                .on('error', () => sendReq.terminate())
                .on('close', () => sendReq.close());
        });
    };
}
