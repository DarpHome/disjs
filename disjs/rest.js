const { versions } = require('process');
const { NotImplemented } = require('./errors');
const { Logger } = require('./logger');
const { trimStart, trimEnd, trues } = require('./utils');

function _flattenErrorDict(d, k2 = '') {
    let e = new Map();
    for (const [k1, v] of Object.entries(d)) {
        if (k1 === '_errors') {
            for (const {code, message} of v) {
                e.set(k2, [...(e.get(k2) ?? []), `${code}(${JSON.stringify(message)})`]);
            }
        } else {
            const t1 = _flattenErrorDict(v, k2.length === 0 ? k1 : `${k2}.${k1}`);
            for (const [k3, t2] of t1.entries())
                for (const t3 of t2)
                    e.set(k3, [...(e.get(k3) ?? []), t3]);
        }
    }    
    return e;
}

class RESTError extends Error {
    constructor(response, j) {
        const status = response.status;
        let code = 0;
        let text = '';
        if (j instanceof Object) {
            code = typeof j.code === 'number' ? j.code : 0;
            const base = typeof j.message === 'string' ? j.message : '';
            let errors = j.errors;
            if (typeof errors === 'object') {
                errors = _flattenErrorDict(errors, '$');
                let helpful = [];
                for (const [where, es] of errors.entries())
                    for (const e of es)
                        helpful.push(`In ${where} - ${e}`);
                text = base + '\n' + helpful.join('\n');
            } else {
                text = base;
            }
        } else {
            text = typeof j === 'string' ? j : '';
        }
        let t = `${status} ${response.statusText} (error code: ${code})`;
        if (text !== '') {
            t += `: ${text}`;
        }
        super(t);
        this.response = response;
        this.status = response.status;
        this.code = code;
        this.text = text;
    }
}
class Unauthorized extends RESTError {}
class Forbidden extends RESTError {}
class NotFound extends RESTError {}
class Ratelimited extends RESTError {
    constructor(response, j) {
        super(response, j);
        this.retryAfter = j instanceof Object ? j.retry_after : NaN;
    }
}
class DiscordError extends RESTError {}
class InternalServerError extends DiscordError {}
class BadGateway extends DiscordError {}

const httpStatuses = {
    100: "Continue",
    101: "Switching Protocols",
    102: "Processing",
    103: "Early Hints",

    200: "OK",
    201: "Created",
    202: "Accepted",
    203: "Non-Authoritative Information",
    204: "No Content",
    205: "Reset Content",
    206: "Partial Content",
    207: "Multi-Status",
    208: "Already Reported",
    226: "IM Used",

    300: "Multiple Choices",
    301: "Moved Permanently",
    302: "Found",
    303: "See Other",
    304: "Not Modified",
    307: "Temporary Redirect",
    308: "Permanent Redirect",

    400: "Bad Request",
    401: "Unauthorized",
    402: "Payment Required",
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    406: "Not Acceptable",
    407: "Proxy Authentication Required",
    408: "Request Timeout",
    409: "Conflict",
    410: "Gone",
    411: "Length Required",
    412: "Precondition Failed",
    413: "Payload Too Large",
    414: "URI Too Long",
    415: "Unsupported Media Type",
    416: "Range Not Satisfiable",
    417: "Expectation Failed",
    418: "I'm a teapot",
    421: "Misdirected Request",
    422: "Unprocessable Content",
    423: "Locked",
    424: "Failed Dependency",
    425: "Too Early",
    426: "Upgrade Required",
    428: "Precondition Required",
    429: "Too Many Requests",
    431: "Request Header Fields Too Large",
    451: "Unavailable For Legal Reasons",

    500: "Internal Server Error",
    501: "Not Implemented",
    502: "Bad Gateway",
    503: "Service Unavailable",
    504: "Gateway Timeout",
    505: "HTTP Version Not Supported",
    506: "Variant Also Negotiates",
    507: "Insufficient Storage",
    508: "Loop Detected",
    510: "Not Extended",
    511: "Network Authentication Required",
};

class HTTPResponse {
    async json() {
        throw new NotImplemented();
    }

    async text() {
        throw new NotImplemented();
    }

    get status() {
        throw new NotImplemented();
    }

    get statusText() {
        return httpStatuses[this.status] ?? `Unknown status ${this.status}`;
    }

    getHeader(name) {
        throw new NotImplemented();
    }
}

class FetchResponse extends HTTPResponse {
    constructor(_fetchResponse) {
        super();
        this._fetchResponse = _fetchResponse;
    }

    async json() {
        return await this._fetchResponse.json();
    }

    async text() {
        return await this._fetchResponse.text();
    }

    get status() {
        return this._fetchResponse.status;
    }

    get statusText() {
        return this._fetchResponse.statusText;
    }

    getHeader(name) {
        return this._fetchResponse.headers.get(name);
    }
}

class HTTPClient {
    async perform(url, options) {
        return new FetchResponse(await fetch(url, options));
    }
}

class REST {
    constructor(options = {}) {
        if (typeof options === 'string') {
            options = {token: options}
        }
        this.base = trimEnd(options.base ?? 'https://discord.com/api/v10', '/') + '/';
        this.token = options.token ?? null;
        this.httpClient = options.httpClient ?? new HTTPClient();
        this.logger = options.logger instanceof Logger ? options.logger : null;
    }

    async request(endpoint, options = {}) {
        let version = [`node/${versions.node}`];
        if (versions.hasOwnProperty('uv')) {
            version.push(`uv/${versions.uv}`);
        }
        if (versions.hasOwnProperty('v8')) {
            version.push(`v8/${versions.v8}`);
        }
        let headers = {'User-Agent': `DiscordBot (https://github.com/DarpHome/disjs, 1.0.0) ${version.join(' ')}`};
        if (this.token !== null && (options.authenticate ?? true))
            headers['Authorization'] = this.token;
        let body = undefined;
        if (trues(options.hasOwnProperty('body'), options.hasOwnProperty('json'), options.hasOwnProperty('form')) > 1) {
            throw new TypeError('cannot have both body and json');
        } else if (options.hasOwnProperty('body')) {
            body = options.body;
        } else if (options.hasOwnProperty('json')) {
            body = JSON.stringify(options.json);
            headers['Content-Type'] = 'application/json';
        } else if (options.hasOwnProperty('form')) {
            body = options.form;
        }
        headers = {...headers, ...options.headers ?? {}};
        const url = this.base + trimStart(endpoint.path, '/') + (options.hasOwnProperty('queryParameters') ? ((params) => {
            if (!(params instanceof URLSearchParams)) {
                params = new URLSearchParams(params);
            }
            const r = params.toString();
            if (r.length === 0)
                return '';
            return '?' + r;
        })(options.queryParameters ?? {}) : '');
        if (this.logger != null) {
            const index = url.indexOf('?');
            let t = index === -1
                ? `sending request to ${endpoint.method} ${url}; without query params`
                : `sending request to ${endpoint.method} ${url.slice(0, index)}; with query params: ${url.slice(index)}`;
            this.logger.trace(`${t}\n - Headers:\n${
                Object.entries(headers)
                .filter(([k, _]) => k.toLowerCase() !== 'authorization')
                .map(([k, v]) => ` -- ${k}: ${v}`)
                .join('\n')
            }`);
        }
        const response = await this.httpClient.perform(url, {
            method: endpoint.method,
            headers,
            body,
        });
        this.logger?.trace(`received response with status ${response.status}`);
        if (response.status >= 400) {
            const j = await (response.getHeader('content-type') === 'application/json'
                ? response.json()
                : response.text()); // cloudflare, why HTML on `/api` routes??
            switch (response.status) {
            case 401:
                throw new Unauthorized(response, j);
            case 403:
                throw new Forbidden(response, j);
            case 404:
                throw new NotFound(response, j);
            case 429:
                throw new Ratelimited(response, j);
            case 500:
                throw new InternalServerError(response, j);
            case 502:
                throw new BadGateway(response, j);
            default:
                if (response.status >= 503)
                    throw new DiscordError(response, j);
                throw new RESTError(response, j);
            }
        }
        return response;
    }
}

module.exports = {RESTError, Unauthorized, Forbidden, NotFound, Ratelimited, DiscordError, InternalServerError, BadGateway, HTTPResponse, HTTPClient, REST};