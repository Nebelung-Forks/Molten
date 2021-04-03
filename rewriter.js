const nodejs = typeof exports !== 'undefined' && this.exports !== exports,
    url = nodejs ? require('url') : null;

module.exports = class {
    constructor(passthrough = {}) {
        this.httpPrefix = passthrough.httpPrefix,
        this.wsPrefix = passthrough.wsPrefix,
        this.baseUrl = passthrough.baseUrl,
        this.clientUrl = passthrough.clientUrl,
        this.originalCookie = passthrough.originalCookie;

        Object.assign(globalThis, this);
    };

    cookie(expList) {
        return expList.map(exp => {
            const split = exp.split('=');
        
            if (split.length == 2) split[1] = split[0] == 'domain' ? this.baseUrl.hostname :
                split[0] == 'path' ? this.httpPrefix + split[1] :
                split[1];

            return split.join('=');
        })
    }

    header(key, value) {
        return key == 'access-control-allow-origin' && !['*', 'null'].includes[value] ? this.baseUrl.href :
            ['host'].includes(key) ? this.clientUrl.host :
            key == 'location' || key == 'timing-allow-origin' && value != '*' ? this.baseUrl.href + this.httpPrefix + value :
            key == 'referrer' ? value.slice(this.httpPrefix.length) :
            ['set-cookie', 'set-cookie2'].includes(key) ? this.cookie(value) :
            value;
    }

    html(body) {
        const jsdom = nodejs ? require('jsdom').JSDOM : null, 
            fs = nodejs ? require('fs') : null, 
            { minify } = nodejs ? require('terser') : null, 
            dom = nodejs ? new jsdom(body, { contentType: 'text/html' }) : new DOMParser.parseFromString(body, 'text/html');

        function url(url) {
            url.split('.').pop();

            return !['http', 'https'].includes(url.split(':')[0]) ? url :
                url.startsWith('//') ? this.httpPrefix + url.slice(2) :
                url.startsWith('/') ? this.httpPrefix + this.baseUrl.href + url : 
                this.httpPrefix + url;
        }

        dom.window.document.querySelectorAll('*').forEach(node => {
            node.textContent = node.tagname == 'SCRIPT' ? this.js(node.textContent) :
                    node.tagname == 'STYLE' ? this.css : node.textContent
                .attributes.forEach(attr => node.setAttribute(attr.name, ['action', 'content', 'data', 'href', 'poster', 'xlink:href'].includes(attr.name) ? this.baseUrl.href + this.httpPrefix + attr.value :
                    ['integrity', 'nonce'].includes(attr.name) ? null :
                    attr.name == 'style' ? this.css(attr.value) :
                    attr.name.startsWith('on-') ? this.js(attr.value) :
                    attr.name == 'srcdoc' ? this.html(attr.value) :
                    attr.name == 'srcset' ? attr.value.split(', ').map((val, i) => i % 2 && url(attr.value)).join(', ') :
                    attr.value
                ));
        });

        if (nodejs) {
            let elm = dom.window.document.createElement('SCRIPT').innerHTML = (async () => await minify(fs.readFileSync('rewriter.js', 'utf8')
                .replace(/INSERT_HTTP_PREFIX/g, this.httpPrefix)
                .replace(/INSERT_WS_PREFIX/g, this.wsPrefix)
                .replace(/INSERT_BASE_URL/g, this.baseUrl)
                .replace(/INSERT_CLIENT_URL/g, this.clientUrl)
                .replace(/INSERT_DOM/g, body)
                .replace(/INSERT_ORIGINAL_COOKIE/g, this.originalCookie),
                { format: { quote_style: 3 } })
                .code)();

            dom.window.document.getElementsByTagName('HEAD')[0].appendChild(elm);
        }

        return nodejs ? dom.serialize() : dom.querySelector('*').outerHTML;
    }

    css(body) {
        return body.replace(/(?<=url\((?<a>["']?)).*?(?=\k<a>\))|(?<=@import *(?<b>"|')).*?(?=\k<b>.*?;)/g, this.baseUrl.href + this.httpPrefix + body);
    }

    js(body) {
        'let document=proxifiedDocument;' + body;
    }
};

if (!nodejs) {
    const passthrough = {
            httpPrefix: 'INSERT_HTTP_PREFIX',
            wsPrefix: 'INSERT_WS_PREFIX',
            baseUrl: INSERT_BASE_URL,
            clientUrl: INSERT_PROXY_URL,
            original = {
                dom: 'INSERT_DOM',
                cookie: 'INSERT_ORIGINAL_COOKIE'
            }
        },
        rewriter = new Rewriter({
            httpPrefix: passthrough.httpPrefix,
            wsPrefix: passthrough.wsPrefix,
            baseUrl: passthrough.baseUrl,
            clientUrl: passthrough.clientUrl
        }),

    proxifiedDocument = new Proxy(document, {
        set: (target, prop) => ['location', 'referrer', 'URL'].includes(prop) ? rewriter.url(target) :
            prop == 'cookie' ? rewriter.cookie(target) : 
            target
    });

    document.write = new Proxy(document.write, {
        apply(target, thisArg, args) {
            args[0] = rewriter.html(args[0]);

            return Reflect.apply(target, thisArg, args);
        }
    });

    window.fetch = new Proxy(window.fetch, {
        apply(target, thisArg, args) {
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
            args[1] = passthrough.baseUrl.href;

            return Reflect.apply(target, thisArg, args);
        }
    });

    window.WebSocket = new Proxy(window.WebSocket, {
        construct(target, args) {
            args[0] = passthrough.baseUrl.href + passthrough.httpPrefix + args[0];
            
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