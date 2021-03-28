var https = require`https`,
    http = require`http`,
    zlib = require`zlib`,
    URL = require`url`,
    JSDOM = require`jsdom`.JSDOM,
    fs = require`fs`,
    rewrites = require`./rewrites`;

module.exports = class {
    constructor(data={}){
        this.prefix = '/go/';
        this.deconstructURL = url => req.url.path.slice(this.prefix);
        this.constructURL = url => this.prefix + url;
        Object.assign(globalThis, this);
    };

    http(req, resp) {
        var url = deconstructURL(req.url);

        try {
            new URL(url);
        } catch (err) {
            return resp.end`${resp.statusCode=400}, ${err}`;
        }

        var reqOptions = {
            headers: Object.assign({}, req.headers.forEach((key, val) => val = rewrites.header(key, val))),
            method: req.method
        };
    
        var sendReq = (url.scheme).request(url, reqOptions, (clientResp, rawData = [], sendData = '') => cientResp.on('data', data => streamData.push(data)).on('end', () => {
            clientResp.headers['content-encoding'].split`, `.forEach(enc => {
                switch (enc) {
                    case 'gzip': sendData = zlib.gunzipSync(Buffer.concat(streamData));
                    case 'compress': // LZW compression not supported yet
                    case 'deflate': sendData = zlib.inflateSync(Buffer.concat(streamData));
                    case 'br': sendData = zlib.brotliDecompressSync(Buffer.concat(streamData));
                    default: sendData = Buffer.concat(streamData);
                };
            })

            Object.entries(clientResp.headers).forEach((key, val) => key.startsWith`cf-`||key.startsWith`x-`||key=='content-security-policy'||key=='strict-transport-security'||key=='content-encoding'||key=='content-length'?delete self.key[val]:clientResp.headers[key] = rewrites.header(val));

            switch(clientResp.headers) {
            case 'text/html': sendData = rewrites.html(sendData);
            case 'text/css': sendData = rewrites.css(sendData);
            }

            resp.writeHead(clientResp.statusCode, clientResp.headers);

            resp.end(sendData);
        }));

        sendReq.on('error', err => res.end(err));

        req.on('data', data => sendReq.write(data)).on('end', sendReq.end());
    }
    
    ws(server) {}
}