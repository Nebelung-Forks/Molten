const nodejs = typeof exports !== 'undefined' && this.exports !== exports

const url = nodejs ? require('url') : null;

module.exports = class {
    constructor(data = {}) {
        this.prefix = nodejs ? data.prefix : location.pathname.split('/')[0], 
        this.pUrl = nodejs ? data.pUrl : this.deconstructURL(location.path), 
        this.bUrl = nodejs ? data.bUrl : location.href, 
        this.contentLength = data.contentLength,
        Object.assign(globalThis, this);
    };

    static deconstructUrl(url) {
        return url.slice(url.startsWith(this.prefix) ? this.prefix.length : this.bUrl.href);
    }

    static constructUrl(url) {
        return url.startsWith(this.prefix) ? this.prefix : this.bUrl.href + url;
    }

    static url(val, options = {}) {
        if (options.type == 'html') {
            val = val.split('./').pop();

            if (!['http', 'https'].includes(val.split(':')[0])) return val;
            else if (val.startsWith('//')) return prefix + val.slice(0, 2);
            else if (val.startsWith('/')) return prefix + this.pUrl.origin + val.slice(1);
            else return prefix + this.pUrl.href.slice(this.pUrl.href.split('/').pop().split('.').length + 1) + val;
        } else return constructUrl(val);
    }

    static cookie(expList) {
        expList.split(';').forEach(exp => {
            const split = exp.split('=');
        
            if (split.length == 2) {
                if (split[0] == 'domain') this.bUrl.hostname;
                if (split[0] == 'path') this.bUrl.path;
            }
        }).join('=');
    }

    header(key, val) {
        // General information https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers
        // TODO: Add websocket headers
        if (key == 'access-control-allow-origin' && !['*', 'null'].includes[val]) return this.bUrl.origin;
        else if (['host'].includes(key)) return this.pUrl.host;
        else if (key == 'location') return this.url(val);
        else if (key == 'origin' && val != 'null') return this.pUrl.origin;
        else if (key == 'referrer') return deconstructURL(val);
        else if (['set-cookie', 'set-cookie2'].includes(key)) return this.cookie.construct(val);
        else if (key == 'timing-allow-origin' && val != '*') return this.url(val);
        else return val;
    }

    html(val) {
        const DOMParser = nodejs ? require('jsdom').JSDOM : null, 
            fs = nodejs ? require('fs') : null, 
            {minify} = nodejs ? require("terser") : null, 
            dom = new DOMParser.parseFromString(val, 'text/html');

        dom.window.document.querySelectorAll('*').forEach(node => {
            if (node.tagname == 'SCRIPT') this.js(node.textContent);
            if (node.tagname == 'STYLE') this.css(node.textContent);

            node.getAttributeNames().forEach(attr => {
                if (['action', 'content', 'data', 'href', 'poster', 'xlink:href'].includes(attr)) node.setAttribute(attr, this.url(node.getAttribute(attr), {type: 'html'}));
                if (['integrity', 'nonce'].includes(attr)) node.removeAttribute(attr);
                if (attr == 'style') node.setAttribute(attr, this.css(node.getAttribute(attr))); 
                if (attr.startsWith('on-')) node.setAttribute(this.js(node.getAttribute(attr)));
                if (attr == 'srcdoc') node.setAttribute(attr, this.html(node.getAttribute(attr)));
                if (attr == 'srcset') node.getAttribute(attr).split(', ').map((val, i) => i % 2 && this.url(val, {type: 'html'})).filter(a => a).join(', ');
            })

            nodejs ? node.getElementsByTagName('head')[0].appendChild(document.createElement('SCRIPT').innerHTML(await minify(fs.readFileSync('rewriter.js')))) : null;
        });

        return dom.querySelector('*').outerHTML;
    }
    css(val) {
        return val.replace(/(?<=url\((?<a>["']?)).*?(?=\k<a>\))|(?<=@import *(?<b>"|')).*?(?=\k<b>.*?;)/g, this.pUrl);
    } 
    js(val) {
        return 'let document=proxifiedDocument;' + val; 
    }
};

if (!nodejs) {
    rewriter = new Rewriter();

    proxifiedDocument = new Proxy(document, {
        set: (target, prop) => {
            if (['location', 'referrer', 'URL'].includes(prop)) return rewriter.url(target);
            else if (prop == 'cookie') return rewriter.cookie.construct(target);
            else return target;
        }
    });

    document.write = new Proxy(document.write, {
    apply(target, thisArg, args) {
        args[0] = rewriter.html(args[0]);

            return Reflect.apply(target, thisArg, args);
        }
    });

    window.fetch = new Proxy(window.fetch, {
        apply(target,thisArg,args) {
            args[0] = rewriter.url(args[0]);

            return Reflect.apply(target, thisArg, args);
        }
    });

    const historyHandler = {
        apply(target, thisArg, args) {
            args[2] = rewriter.url(args[2]);

            return Reflect.apply(target, thisArg, args);
        }
    };

    window.History.prototype.pushState = new Proxy(window.History.prototype.pushState, historyHandler);
    window.History.prototype.replaceState = new Proxy(window.History.prototype.replaceState, historyHandler);

    window.Navigator.prototype.sendBeacon = new Proxy(window.Navigator.prototype.sendBeacon, {
        apply(target, thisArg, args) {
            args[0] = rewriter.url(args[0]);

            return Reflect.apply(target, thisArg, args);
        }
    }); 

    window.open = new Proxy(window.open, {
        apply(target, thisArg, args) {
            args[0] = rewriter.url(args[0]);

            return Reflect.apply(target, thisArg, args);
        }
    });

    window.postMessage = new Proxy(window.postMessage, {
        apply(target, thisArg, args) {
            args[1] = location.origin;

            return Reflect.apply(target, thisArg, args);
        }
    });

    window.WebSocket = new Proxy(window.WebSocket, {
        construct(target, args) {
            args[0] = rewrites.url(args[0]);
            
            return Reflect.construct(target, args);
        }
    });

    window.Worker = new Proxy(window.Worker, {
        construct(target, args) {
            args[0] = rewriter.url(args[0]);

            return Reflect.construct(target, args);
        }
    });
    
    window.XMLHttpRequest.prototype.open = new Proxy(window.XMLHttpRequest.prototype.open, {
        apply(target, thisArg, args) {
            args[1] = rewriter.url(args[1]);

            return Reflect.apply(target, thisArg, args);
        }
    });

    document.currentScript.remove();

    delete window.MediaStreamTrack; 
    delete window.RTCPeerConnection;
    delete window.RTCSessionDescription;
    delete window.mozMediaStreamTrack;
    delete window.mozRTCPeerConnection;
    delete window.mozRTCSessionDescription;
    delete window.navigator.getUserMedia;
    delete window.navigator.mozGetUserMedia;
    delete window.navigator.webkitGetUserMedia;
    delete window.webkitMediaStreamTrack;
    delete window.webkitRTCPeerConnection;
    delete window.webkitRTCSessionDescription;
}
