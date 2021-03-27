const https = require('https'),
    http = require('http'),
    zlib = require('zlib'),
    JSDOM = require('./jsdom').JSDOM,
    fs = require('fs');

module.exports = class {
    constructor(data={}){
        this.prefix = data.prefix ? data.prefix : '/web/'; // Ok what is data.prefix
        this.deconstructURL = data.deconstructURL ? data.deconstructURL : url => url.replace(this.prefix, '');
        this.constructURL = data.constructURL ? data.constructURL : url => this.prefix + url;
        Object.assign(globalThis, this);
    };
    rewriter(baseURL){
        return {
            url(url, base = baseURL) {
                if (/^(#|about:|data:|blob:|mailto:|javascript:|{|\*)/.test(url)) return url;
                return constructURL(new URL(url, base).href);
            },
            style(stylesheet){
                return (typeof res == 'string' ? stylesheet : stylesheet.toString()).replace(/url\("(.*?)"\)/gi, str => {
                    var url = str.replace(/url\("(.*?)"\)/gi, '$1');
                    return `url("${this.url(url, baseURL)}")`;
                }).replace(/url\('(.*?)'\)/gi, str => {
                    var url = str.replace(/url\('(.*?)'\)/gi, '$1');
                    return `url('${this.url(url, baseURL)}')`;
                }).replace(/url\((.*?)\)/gi, str => {
                    var url = str.replace(/url\((.*?)\)/gi, '$1');
                    if (url.startsWith(`"`) || url.startsWith(`'`)) return str;
                    return `url("${this.url(url, baseURL)}")`;
                }).replace(/@import (.*?)"(.*?)";/gi, str => {
                    var url = str.replace(/@import (.*?)"(.*?)";/, '$2');
                    return `@import "${this.url(url, baseURL)}";`
                }).replace(/@import (.*?)'(.*?)';/gi, str => {
                    var url = str.replace(/@import (.*?)'(.*?)';/, '$2');
                    return `@import '${this.url(url, baseURL)}';`
                })
            },
            html(page){
                var html = new JSDOM((typeof page == 'string' ? page : page.toString()), {contentType: 'text/html'});
                baseURL = html.window.document.querySelector('head base[href]') ? html.window.document.querySelector('head base[href]').href : baseURL;
                html.window.document.querySelectorAll('*').forEach(node => {
                    if (node.hasAttribute('nonce')) node.removeAttribute('nonce');
                    if (node.hasAttribute('integrity')) node.removeAttribute('integrity');
                    if (node.hasAttribute('src') && /(script|embed|iframe|audio|video|img|input|source|track)/.test(node.tagName.toLowerCase())) node.src = this.url(node.src, baseURL);
                    if (node.hasAttribute('srcset') && /(img|source)/.test(node.tagName.toLowerCase())) {
                        var arr = [];
                            node.srcset.split(',').forEach(url => {
                                url = url.trimStart().split(' ');
                                url[0] = this.url(url[0], baseURL);
                                arr.push(url.join(' '));
                            });
                            node.srcset = arr.join(', ')
                    };
                    if (node.hasAttribute('href') && /(a|link|area|base)/.test(node.tagName.toLowerCase())) node.href = this.url(node.href, baseURL);
                    if (node.hasAttribute('action') && node.tagName.toLowerCase() == 'form') node.action = this.url(node.action, baseURL);
                    if (node.hasAttribute('data') && node.tagName.toLowerCase() == 'object') node.data = this.url(node.data, baseURL);
                    if (node.hasAttribute('style')) node.setAttribute('style', this.style(node.getAttribute('style')));
                    if (node.tagName.toLowerCase() == 'style') node.textContent = this.style(node.textContent);
                    if (node.tagName.toLowerCase() == 'title') node.innerHTML = 'WEB';
                });
                return html.serialize();
            }
        }
    };
    http(req, res, next = () => res.end('')){
        if (!/^https?:\/\//.test(deconstructURL(req.url))) return res.end('URL Parse Error');

        var url = deconstructURL(req.url),
            requestOptions = {
                headers: Object.assign({}, req.headers),
                method: req.method,
                rejectUnauthorized: false, // This has to be set I thought it was default? can you answer this?
            };
        delete requestOptions.headers['host']; // This will be rewritten later right? just got to confirm can you confirm lol
    
        var sendRequest = (url.startsWith('https://') ? https : http).request(url, requestOptions, (proxyRes, rewrite = (this.rewriter)(url), rawData = [], sendData = '') => proxyRes.on('data', data=>rawData.push(data)).on('end', ()=>{
            if (rawData.length != 0) switch(proxyRes.headers['content-encoding']){
                case 'gzip':
                    sendData = zlib.gunzipSync(Buffer.concat(rawData));
                    break;
                case 'deflate':
                    sendData = zlib.inflateSync(Buffer.concat(rawData));
                    break;
                case 'br':
                    sendData = zlib.brotliDecompressSync(Buffer.concat(rawData));
                    break;
                default: sendData = Buffer.concat(rawData); break;
            };
            Object.entries(proxyRes.headers).forEach(([header_name, header_value]) => {
                if (/^(content-encoding|x-|cf-|strict-transport-security|content-security-policy|content-length)/.test(header_name)) delete proxyRes.headers[header_name];
                if (header_name == 'location') proxyRes.headers[header_name] = rewrite.url(header_value);
            });
            if (proxyRes.headers['content-type'] && proxyRes.headers['content-type'].startsWith('text/html')) sendData = rewrite.html(sendData);
            else if (proxyRes.headers['content-type'] && proxyRes.headers['content-type'].startsWith('text/css')) sendData = rewrite.style(sendData);
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            res.end(sendData);
        }));
        sendRequest.on('error', err=>res.end(err.toString()));
        req.on('data', data => sendRequest.write(data)).on('end', () => sendRequest.end());
    }
    ws(server){}
}
