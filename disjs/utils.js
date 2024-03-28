const { EventEmitter } = require('events');
const { TimeoutError } = require('./errors');

class EventEmitterExt extends EventEmitter {
    constructor(options) {
        super(options);
        this.subscriptions = new Map();
        this.id = 0;
    }

    _generateId() {
        return this.id++;
    }
    
    waitFor(event, {timeout, check}) {
        const id = this._generateId();
        return new Promise((resolve, reject) => {
            if (!this.subscriptions.has(event)) this.promises.set(event, new Map());
            if (timeout) setTimeout(() => {
                const subscriptions = this.subscriptions.get(event);
                if (subscriptions.delete(id)) {
                    reject(new TimeoutError());
                }
            }, timeout);
            this.subscriptions.get(event).set(id, {check, resolve});
        });
    }

    async emit(event, ...args) {
        if (!this.subscriptions.has(event)) this.subscriptions.set(event, new Map());
        const subscriptions = this.subscriptions.get(event);
        for (const [id, subscription] of subscriptions) {
            if (subscription.check === undefined || await subscription.check(...args)) {
                subscription.resolve([...args]);
                subscriptions.delete(id);
                return;
            }
        }
        super.emit(event, ...args);
    }
}

function trimStart(s, c) {
    const k = Array.from(c).map(d => d[0]);
    if (k.length === 0)
        return s;
    else if (k.length === 1)
        while (s.startsWith(k[0])) s = s.slice(1);
    else
        while (k.some(c => s.startsWith(c))) s = s.slice(1);
    return s;
}

function trimEnd(s, c) {
    const k = Array.from(c).map(d => d[0]);
    if (k.length === 0)
        return s;
    else if (k.length === 1)
        while (s.endsWith(k[0])) s = s.slice(0, s.length - 1);
    else
        while (k.some(c => s.endsWith(c))) s = s.slice(0, s.length - 1);
    return s;
}

function trues(...xs) {
    return xs.filter(x => x ? 1 : 0).reduce((x, y) => x + y, 0);
}

const _textEncoder = new TextEncoder();

function blobFromText(s) {
    return new Blob([_textEncoder.encode(s)]);
}


module.exports = {EventEmitterExt, trimStart, trimEnd, trues, blobFromText};