const nodejs = typeof exports !== 'undefined' && this.exports !== exports,
    url = nodejs ? require('url') : null;

module.exports = class {
    constructor(data = {}) {
        this.prefix = data.prefix,
        this.bUrl = data.bUrl,
        this.pUrl = data.pUrl,
        this.contentLength = data.contentLength,
        Object.assign(globalThis, this);
    };

    deconstructUrl = data => data.slice(data.startsWith(this.prefix) ? this.prefix.length : this.bUrl.href);

    constructUrl = data => data.startsWith(this.prefix) ? this.prefix : this.bUrl.href + url;

    url(data, option) {
        if (option == 'html') {
            data.split`./`.pop();

            return !['http', 'https'].includes(data.split`:`[0]) ? data :
                data.startsWith`//` ? prefix + data.slice(0, 2) :
                data.startsWith`/` ? prefix + this.bUrl.origin + data.slice(1) :
                this.prefix + data;
        } else return this.constructUrl(data);
    }

    cookie(expList) {
        return expList.map(exp => {
            const split = exp.split`=`;
        
            if (split.length == 2) {
                split[1] = split[0] == 'domain' ? this.bUrl.hostname :
                    split4[0] == 'path' ? this.bUrl.path : split[1];
            }

            return split.join`=`;
        })
    }

    header = (key, value) => key == 'access-control-allow-origin' && !['*', 'null'].includes[value] ? this.bUrl.origin :
        ['host'].includes(key) ? this.pUrl.host :
        key == 'location' ? this.url(value) :
        key == 'origin' && value != 'null' ? this.pUrl.origin :
        key == 'referrer' ? deconstructURL(value) :
        ['set-cookie', 'set-cookie2'].includes(key) ? this.cookie(value) :
        key == 'timing-allow-origin' && value != '*' ? this.url(value) : value;

    html(data) {
        const jsdom = nodejs ? require('jsdom').JSDOM : null, 
            fs = nodejs ? require('fs') : null, 
            { minify } = nodejs ? require('terser') : null, 
            dom = nodejs ? new jsdom(data, { contentType: 'text/html' }) : new DOMParser.parseFromString(data, 'text/html');

        dom.window.document.querySelectorAll`*`.forEach(node => {
            node.textContent = node.tagname == 'SCRIPT' ? this.js :
                    node.tagname == 'STYLE' ? this.css : node.textContent
                .attributes.forEach(attr => node.setAttribute(attr.name, ['action', 'content', 'data', 'href', 'poster', 'xlink:href'].includes(attr.name) ? this.url(attr.value) :
                    ['integrity', 'nonce'].includes(attr.name) ? null :
                    attr.name == 'style' ? this.css(attr.value) :
                    attr.name.startsWith`on-` ? this.js(attr.value) :
                    attr.name == 'srcdoc' ? this.html(attr.value) :
                    attr.name == 'srcset' ? attr.value.split`, `.map((val, i) => i % 2 && this.url(val, 'html')).filter(a => a).join`, ` : attr.value
                ));
        });

        if (nodejs) {
            let elm = dom.window.document.createElement`SCRIPT`.innerHTML = (async () => await minify(fs.readFileSync('rewriter.js', 'utf8')
                .replace(/INSERT_PREFIX/g, this.prefix)
                .replace(/INSERT_BURL/g, this.bUrl)
                .replace(/INSERT_PURL/g, this.pUrl)

                .replace(/INSERT_DOM/g, data)
                ).code)();
            dom.window.document.getElementsByTagName`HEAD`[0].appendChild(elm);
        }

        return nodejs ? dom.serialize() : dom.querySelector`*`.outerHTML;
    }

    css = data => data.replace(/(?<=url\((?<a>["']?)).*?(?=\k<a>\))|(?<=@import *(?<b>"|')).*?(?=\k<b>.*?;)/g, this.pUrl);

    js = data => 'let document=proxifiedDocument;' + data;
};

if (!nodejs) {
    const rewriter = new Rewriter({ 
            prefix: INSERT_PREFIX,
            bUrl: INSERT_BURL,
            pUrl: INSERT_PURL
        }),
        orig = { dom: INSERT_DOM };

    proxifiedDocument = new Proxy(document, {
        set: (target, prop) => ['location', 'referrer', 'URL'].includes(prop) ? rewriter.url(target) :
            prop == 'cookie' ? rewriter.cookie(target) : target
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