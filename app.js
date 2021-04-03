const https = require('https'), 
    http = require('http'),
    WebSocket = require('ws'),
    zlib = require('zlib'), 
    url = require('url'), 
    Rewriter = require('./rewriter');

module.exports = class {
    constructor(passthrough = {}) {
        this.wsPrefix = passthrough.wsPrefix,
        this.httpPrefix = passthrough.httpPrefix;

        Object.assign(globalThis, this);
    };

    http(req, resp) {
        const clientProtocol = req.connection.encrypted ? 'https' : 
            !req.connection.encrypted ? 'http' : 
            null;

        try {
            this.baseUrl = new URL(clientProtocol + '://' + req.headers.host),
            this.clientUrl = new URL(req.url.slice(this.httpPrefix));
        } catch (err) {
            resp.writeHead(200, { 'content-type': 'text/plain' })
                .destroy(err);
        }

        const clientHeaders = Object.entries(req.headers).map(([key, value]) => {
                if (key == 'cookie') {
                    value.map(exp => {
                        const split = exp.split('=');

                        if (split.length == 2) {
                            this.originalCookie = split[0] == 'original' ? split[1] : null;
                        }
                    });
                } else return [key, rewriter.header(key, value)]
            }),
            rewriter = new Rewriter({
                httpPrefix: this.httpPrefix,
                wsPrefix: this.wsPrefix,
                bUrl: this.baseUrl, 
                clientUrl: this.clientUrl,
                originalCookie: this.originalCookie
            }), 
            client = (clientProtocol == 'https' ? https : clientProtocol == 'http' ? http : null).request(this.clientUrl.href, { 
                headers: clientHeaders,
                method: req.method, 
                followAllRedirects: false 
            }, (clientResp, streamData = [], sendData = '') => clientResp.on('data', data => streamData.push(data)).on('end', () => {
                if (typeof (enc = clientResp.headers['content-encoding'] || clientResp.headers['transfer-encoding']) != 'undefined') enc.split('; ')[0].split(', ').forEach(encType => {
                    sendData = encType == 'gzip' ? zlib.gunzipSync(Buffer.concat(streamData)).toString() :
                        encType == 'deflate' ? zlib.inflateSync(Buffer.concat(streamData)).toString() :
                        encType == 'br' ? zlib.brotliDecompressSync(Buffer.concat(streamData)).toString() : 
                        Buffer.concat(streamData).toString();
                })

                if (typeof (type = clientResp.headers['content-type']) != 'undefined') {
                    const directive = type.split('; ')[0];
                    
                    sendData = directive == 'text/html' ? rewriter.html :
                        directive == 'text/css' ? rewriter.css :
                        ['text/javascript', 'application/x-javascript', 'application/javascript'].includes(directive) ? rewriter.js :
                        sendData;
                }

                resp.writeHead(200, Object.entries(clientResp.headers).filter(([key, value]) => !['content-encoding', 'content-length', 'forwarded'].includes(key) && !key.startsWith('x-') ? [key, rewriter.header(key, value)] : null))
                    .end(sendData)
            }));

        client.on('error', err => {
            resp.writeHead(200, { 'content-type': 'text/plain' })
                .destroy(err)
        });

        req.on('data', data => client.write(data))
            .on('end', () => client.end());
    };

    ws(server) {
        new WebSocket.Server({ server: server }).on('connection', (client, req) => {
            try {
                this.baseUrl = new URL(clientProtocol + '://' + req.headers.host),
                this.clientUrl = new URL(req.url.slice(this.wsPrefix));
            } catch (err) {
                req.terminate(err);
            }

            let msgParts = [];

            sendReq = new WebSocket(this.clientUrl.href, {
                headers: req.headers
            }).on('message', msg => client.send(msg))
                .on('open', () => sendReq.send(msgParts.join('')))
                .on('error', () => client.terminate())
                .on('close', () => client.close());

            client.on('message', msg => sendReq.readyState == WebSocket.open ? sendReq.send(msg) : msgParts.push(msg))
                .on('error', () => sendReq.terminate())
                .on('close', () => sendReq.close());
        });
    };
}
