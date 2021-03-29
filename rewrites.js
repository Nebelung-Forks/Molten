const nodejs = typeof exports !== 'undefined' && this.exports !== exports;

if (nodejs) {
    const fs = require('fs'), DOMParser = require('jsdom').JSDOM;
} else {
    proxifiedDocument = new Proxy(document, {
        get: (target, prop) => (prop == 'cookie' ? rewrites.cookie.deconstruct(target) : typeof(prop = Reflect.get(target, prop)) == 'function' ? prop.bind(target) : prop),
        set: (target, prop) => {
            switch (prop) {
            case 'location' || 'referrer' || 'URL': return rewrites.url(target); break;
            case 'cookie': return rewrites.cookie.construct(target);
            }
        }
    });

    document.write = new Proxy(document.write, {
        apply(target, thisArg, args) {
            args[0] = rewrites.html(args[0]);
    
            return Reflect.apply(target, thisArg, args);
        }
    });

    window.fetch = new Proxy(window.fetch, {
        apply(target,thisArg,args) {
            args[0] = rewrites.url(args[0]);
    
            return Reflect.apply(target, thisArg, args);
        }
    });
    
    const historyHandler = {
        apply(target, thisArg, args) {
            args[2] = rewrites.url(args[2]);
    
            return Reflect.apply(target, thisArg, args);
        }
    };
    
    window.History.prototype.pushState = new Proxy(window.History.prototype.pushState, historyHandler);
    window.History.prototype.replaceState = new Proxy(window.History.prototype.replaceState, historyHandler);
    
    window.Navigator.prototype.sendBeacon = new Proxy(window.Navigator.prototype.sendBeacon, {
        apply(target, thisArg, args) {
            args[0] = rewrites.url(args[0]);
    
            return Reflect.apply(target, thisArg, args);
        }
    }); 
    
    window.open = new Proxy(window.open, {
        apply(target, thisArg, args) {
            args[0] = rewrites.url(args[0]);
    
            return Reflect.apply(target, thisArg, args);
        }
    });
    
    window.postMessage = new Proxy(window.postMessage, {
        apply(target, thisArg, args) {
            args[1] = location.origin;
    
            return Reflect.apply(target, thisArg, args)
        }
    });
    
    window.WebSocket = new Proxy(window.WebSocket, {
        construct(target, args) {
            // Websocket connections are currently unsupported
        }
    });
    
    window.Worker = new Proxy(window.Worker, {
        construct(target, args) {
            args[0] = rewrites.url(args[0]);
    
            return Reflect.construct(target, args);
        }
    });
     
    window.XMLHttpRequest.prototype.open = new Proxy(window.XMLHttpRequest.prototype.open, {
        apply(target, thisArg, args) {
            args[1] = rewrites.url(args[1]);
    
            return Reflect.apply(target, thisArg, args);
        }
    });
    
    // Delete the current script tag to prevent dom interferance with future javascript code
    document.currentScript.remove();
    
    // WebSocket
    delete window.WebSocket;
    
    // WebRTC
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

// (nodejs ? module.exports : (window.rewrites = {}) = {

module.exports = {
    cookie: {
        construct: (data) => {
            data.split`; `.forEach(exp => {
                split = exp.split`=`;
        
                if (split.length == 2) {
                    switch (split[0]) {
                    case "domain": break;
                    case "path":
                    }
                }
        
                return split.join`=`;
            });
        },
        deconstruct: (data) => {
            // Currently unsupported
        }
    },
    header: (key, val) => {
        switch(key) {
            // Request headers
            // case 'cookie': cookie.deconstruct(val);
            // case 'host':
            // Response headers
            case 'location': this.url(val); break;
            case 'set-cookie': this.cookie.construct(val);
        }

        return val;
    },
    url: url => {
        for (proto of ['http', 'https']) {
            if(url.split`:` != protocol && protocol.length == 2) return protocol;
        }
        
        return url;
    },
    // manifest:
    html: body => {
        new DOMParser().parseFromString(body, 'text/html').querySelector`*`.sel.querySelectorAll`*`.forEach(node => {
            switch(node.tagName) {
            case 'STYLE': node.textContent = css(node.textContent); break;
            case 'SCRIPT': node.textContent = js(node.textContent);
            }

            node
                .getAttributeNames().forEach(attr => {
                    switch (attr) {
                    case 'nonce' || 'integrity': node.removeAttribute(attr); break;
                    case 'href' || 'xlink:href' || 'src' || 'action' || 'content' || 'data' || 'poster': node.setAttribute(this.url(node.getAttribute(attr))); break;
                    case 'srcset': node.getAttribute(attr).split`, `.map((val, i) => i % 2 && this.url(val)).filter(a => a).join`, `; break;
                    case 'srcdoc': node.setAttribute(attr, this.html(node.getAttribute(attr))); break;
                    case 'style': node.setAttribute(attr, this.css(node.getAttribute(attr))); break;
                    case 'on-*': node.setAttribute(this.js(node.getAttribute(attr)));
                    }
                })
                .getElementsByTagName`head`[0].appendChild(document.createElement('SCRIPT').setAttribute('src', '/inject'));
        });

        return sel.innerHTML;
    },
    css: body => body.replace(/(?<=url\((?<a>["']?)).*?(?=\k<a>\))|(?<=@import *(?<b>"|')).*?(?=\k<b>.*?;)/g, this.url),
    js: body => `{let document=proxifiedDocument;${body.replace(/proxifiedDocument/g, 'document')}`
};