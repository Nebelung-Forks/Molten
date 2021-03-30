const https = require('https'),
    http = require('http'),
    zlib = require('zlib'),
    rewrites = require('./rewrites');

module.exports = class {
    constructor(data = {}) {
        this.prefix = data.prefix,
        this.deconstructUrl = url => url.slice(this.prefix.length),
        this.constructUrl = url => this.prefix + url,
        Object.assign(globalThis, this); // I needed a little help with 27 and 36
    };

    // TODO: Add websocket server
    // oh and can you add your websocket server here once you are done

    static headers = {
        req(headers, url, parse, rewrite){

        },
        res(headers, url, parse, rewrite){},
        websocket(headers, url, parse, rewrite){},
    }
 // what is parse and rewrite?
    http(req, resp) {
        try {
            pUrl = new URL(deconstructUrl(req.url));
            reqUrl = new URL(`${req.protocol}://${req.host}${this.prefix}${pUrl.href}`);
        } catch (err) {
            res.end`${resp.statusCode = 400}, ${err}`;
        }

        //if (!/(http|https)/.test(req.protocol)) return res.end`${resp.statusCode = 400}, ${url.protocol} is an invalid protocol`;

        if (url.protocol == 'https') reqProtocol = https;
        else if (url.protocol == 'http') reqProtocol = http;
        else res.end`${resp.statusCode = 400}, ${url.protocol} is an invalid protocol`;

        const sendReq = reqProtocol.request(pUrl.href, {headers: Object.entries(Object.assign({}, req.headers)).forEach((key, val) => key[val] = rewrites.header(key, key[val])), method: req.method}, (clientResp, streamData = [], sendData = '') => clientResp.on('data', data => streamData.push(data)).on('end', () => {
            const enc = clientResp.headers`content-encoding`.split`; `[0]; // duce what are you doing here?
            if (typeof enc != 'undefined') enc.split`, `.forEach(encType => {
                if (encType == 'gzip') zlib.gunzipSync(Buffer.concat(streamData));
                else if (encType == 'deflate') sendData = zlib.inflateSync(Buffer.concat(streamData));
                else if (encType == 'br') sendData = zlib.brotliDecompressSync(Buffer.concat(streamData));
                else sendData = Buffer.concat(streamData);
            })

            // Also is undefined here too
            Object.entries(clientResp.headers).forEach((key, val) => (`content-length`.includes(clientResp.headers) ? null : resp.setHeader(key, rewrites.header(val)))); 

            rewriter = new Rewriter({prefix: this.prefix, baseUrl: baseUrl, url: url}); 

            const type = clientResp.headers`content-type`.split`; `[0];
            if (type == 'text/html') sendData = rewriter.html(sendData);
            if (type == 'text/css') sendData = rewriter.css(sendData);
            if (['text/javascript', 'application/x-javascript', 'application/javascript'].includes(type)) sendData = rewriter.css(sendData);

            resp.writeHead(clientResp.statusCode, clientResp.headers);

            resp.end(sendData);
        }));

        sendReq.on('error', err => res.end(err));

        req.on('data', data => sendReq.write(data)).on('end', () => (sendReq.end()));
    }
}
