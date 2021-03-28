// TODO: Make this into a module
var fs = require`fs`,
    jsdom = require`jsdom`;

// Rewrite Utility Code

function header(key, val) {
    switch(key) {
    // Request headers
    case 'host':
    // Response headers
    case 'location': url(val);
    }

    return val;
}
function cookie(data) {
    data.split`; `.forEach(exp => {
        split = exp.split`=`;

        if (split.length == 2) {
            switch (split[0]) {
            case "domain":
            case "path":
            }
        }

        return split.join`=`;
    })
}
function url(data) {
    for (proto of ['http', 'https']) {
        if(data.split`:`!=protocol&&protocol.length==2)return protocol;
    }

    return data;
}
function html(data) {
    var dom = new JSDOM().parseFromString(data,'text/html'), 
        sel = dom.querySelector`*`;

    sel.querySelectorAll`*`.forEach(node => {
        switch(node.tagName) {
        case'STYLE': node.textContent = css(node.textContent);
        case'SCRIPT': node.textContent = js(node.textContent);
        }

        node.getAttributeNames().forEach(attr => {
            switch (attr) {
            case'nonce'||'integrity': node.removeAttribute(attr);
            case'href'||'xlink:href'||'src'||'action'||'content'||'data'||'poster': node.setAttribute(self.url(node.getAttribute(attr)));
            case'srcset': node.getAttribute(attr).split`, `.map((val, i) => i%2&&url(val)).filter(a => a).join`, `;
            case'srcdoc': node.setAttribute(html(node.getAttribute(attr)));
            case'style': node.setAttribute(css(node.getAttribute(attr)));
            case'on-*': node.setAttribute(js(node.getAttribute(attr)));
            }
        });
    });

    return sel.innerHTML;
}
function css(data) {
    return data.replace(/(?<=url\((?<a>["']?)).*?(?=\k<a>\))|(?<=@import *(?<b>"|')).*?(?=\k<b>.*?;)/g, url(data))
}
function js(data) {
    return `{let document=proxifiedDocument;${data.replace(/proxifiedDocument/g, 'document')}`
}

// Document object

// TODO: Find out how to mask use of this
proxifiedDocument = new Proxy(document, {
    get: (target, prop) => {
        switch (prop) {
        case 'location':
        case 'referrer'||'URL': Reflect.get(target, prop);
        }

        return typeof(prop=Reflect.get(target, prop))=='function'?prop.bind(target):prop;
    }
});

document.write = new Proxy(document.write, {
    apply: (target, thisArg, args) => {
        args[0] = html(args[0]);

        return Reflect.apply(target, thisArg, args);
    }
});

// Window object

window.fetch = new Proxy(window.fetch, {
    apply: (target,thisArg,args) => {
        args[0] = url(args[0]);

        return Reflect.apply(target, thisArg, args);
    }
});

const historyHandler = {
    apply: (target, thisArg, args) => {
        args[2] = url(args[2]);

        return Reflect.apply(target, thisArg, args);
    }
};

window.History.prototype.pushState = new Proxy(window.History.prototype.pushState, historyHandler);
window.History.prototype.replaceState = new Proxy(window.History.prototype.replaceState, historyHandler);

window.Navigator.prototype.sendBeacon = new Proxy(window.Navigator.prototype.sendBeacon, {
    apply: (target, thisArg, args) => {
        args[0] = url(args[0]);

        return Reflect.apply(target, thisArg, args);
    }
});

window.open = new Proxy(window.open, {
    apply: (target, thisArg, args) => {
        args[0] = url(args[0]);

        return Reflect.apply(target, thisArg, args);
    }
});

window.WebSocket = new Proxy(window.WebSocket, {
    construct: (target, args) => {
        // Websocket connections are currently unsupported
        Reflect.construct(target, args);
    }
});

window.XMLHttpRequest.prototype.open = new Proxy(window.XMLHttpRequest.prototype.open, {
    apply: (target, thisArg, args) => {
        args[1] = url(args[1]);

        return Reflect.apply(target, thisArg, args);
    }
});

// Delete non-proxified objects so requests don't escape the proxy

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