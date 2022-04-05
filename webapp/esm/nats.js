// deno-fmt-ignore-file
// deno-lint-ignore-file
// This code was bundled using `deno bundle` and it's not recommended to edit it manually

const Empty = new Uint8Array(0);
var Events;
(function(Events1) {
    Events1["Disconnect"] = "disconnect";
    Events1["Reconnect"] = "reconnect";
    Events1["Update"] = "update";
    Events1["LDM"] = "ldm";
    Events1["Error"] = "error";
})(Events || (Events = {}));
var DebugEvents;
(function(DebugEvents1) {
    DebugEvents1["Reconnecting"] = "reconnecting";
    DebugEvents1["PingTimer"] = "pingTimer";
    DebugEvents1["StaleConnection"] = "staleConnection";
})(DebugEvents || (DebugEvents = {}));
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_RECONNECT_TIME_WAIT = 2 * 1000;
const DEFAULT_PING_INTERVAL = 2 * 60 * 1000;
const DEFAULT_MAX_PING_OUT = 2;
var AdvisoryKind;
(function(AdvisoryKind1) {
    AdvisoryKind1["API"] = "api_audit";
    AdvisoryKind1["StreamAction"] = "stream_action";
    AdvisoryKind1["ConsumerAction"] = "consumer_action";
    AdvisoryKind1["SnapshotCreate"] = "snapshot_create";
    AdvisoryKind1["SnapshotComplete"] = "snapshot_complete";
    AdvisoryKind1["RestoreCreate"] = "restore_create";
    AdvisoryKind1["RestoreComplete"] = "restore_complete";
    AdvisoryKind1["MaxDeliver"] = "max_deliver";
    AdvisoryKind1["Terminated"] = "terminated";
    AdvisoryKind1["Ack"] = "consumer_ack";
    AdvisoryKind1["StreamLeaderElected"] = "stream_leader_elected";
    AdvisoryKind1["StreamQuorumLost"] = "stream_quorum_lost";
    AdvisoryKind1["ConsumerLeaderElected"] = "consumer_leader_elected";
    AdvisoryKind1["ConsumerQuorumLost"] = "consumer_quorum_lost";
})(AdvisoryKind || (AdvisoryKind = {}));
var RetentionPolicy;
(function(RetentionPolicy1) {
    RetentionPolicy1["Limits"] = "limits";
    RetentionPolicy1["Interest"] = "interest";
    RetentionPolicy1["Workqueue"] = "workqueue";
})(RetentionPolicy || (RetentionPolicy = {}));
var DiscardPolicy;
(function(DiscardPolicy1) {
    DiscardPolicy1["Old"] = "old";
    DiscardPolicy1["New"] = "new";
})(DiscardPolicy || (DiscardPolicy = {}));
var StorageType;
(function(StorageType1) {
    StorageType1["File"] = "file";
    StorageType1["Memory"] = "memory";
})(StorageType || (StorageType = {}));
var DeliverPolicy;
(function(DeliverPolicy1) {
    DeliverPolicy1["All"] = "all";
    DeliverPolicy1["Last"] = "last";
    DeliverPolicy1["New"] = "new";
    DeliverPolicy1["StartSequence"] = "by_start_sequence";
    DeliverPolicy1["StartTime"] = "by_start_time";
    DeliverPolicy1["LastPerSubject"] = "last_per_subject";
})(DeliverPolicy || (DeliverPolicy = {}));
var AckPolicy;
(function(AckPolicy1) {
    AckPolicy1["None"] = "none";
    AckPolicy1["All"] = "all";
    AckPolicy1["Explicit"] = "explicit";
    AckPolicy1["NotSet"] = "";
})(AckPolicy || (AckPolicy = {}));
var ReplayPolicy;
(function(ReplayPolicy1) {
    ReplayPolicy1["Instant"] = "instant";
    ReplayPolicy1["Original"] = "original";
})(ReplayPolicy || (ReplayPolicy = {}));
var JsHeaders;
(function(JsHeaders1) {
    JsHeaders1["StreamSourceHdr"] = "Nats-Stream-Source";
    JsHeaders1["LastConsumerSeqHdr"] = "Nats-Last-Consumer";
    JsHeaders1["LastStreamSeqHdr"] = "Nats-Last-Stream";
    JsHeaders1["ConsumerStalledHdr"] = "Nats-Consumer-Stalled";
    JsHeaders1["MessageSizeHdr"] = "Nats-Msg-Size";
    JsHeaders1["RollupHdr"] = "Nats-Rollup";
    JsHeaders1["RollupValueSubject"] = "sub";
    JsHeaders1["RollupValueAll"] = "all";
})(JsHeaders || (JsHeaders = {}));
var ErrorCode;
(function(ErrorCode1) {
    ErrorCode1["ApiError"] = "BAD API";
    ErrorCode1["BadAuthentication"] = "BAD_AUTHENTICATION";
    ErrorCode1["BadCreds"] = "BAD_CREDS";
    ErrorCode1["BadHeader"] = "BAD_HEADER";
    ErrorCode1["BadJson"] = "BAD_JSON";
    ErrorCode1["BadPayload"] = "BAD_PAYLOAD";
    ErrorCode1["BadSubject"] = "BAD_SUBJECT";
    ErrorCode1["Cancelled"] = "CANCELLED";
    ErrorCode1["ConnectionClosed"] = "CONNECTION_CLOSED";
    ErrorCode1["ConnectionDraining"] = "CONNECTION_DRAINING";
    ErrorCode1["ConnectionRefused"] = "CONNECTION_REFUSED";
    ErrorCode1["ConnectionTimeout"] = "CONNECTION_TIMEOUT";
    ErrorCode1["Disconnect"] = "DISCONNECT";
    ErrorCode1["InvalidOption"] = "INVALID_OPTION";
    ErrorCode1["InvalidPayload"] = "INVALID_PAYLOAD";
    ErrorCode1["MaxPayloadExceeded"] = "MAX_PAYLOAD_EXCEEDED";
    ErrorCode1["NoResponders"] = "503";
    ErrorCode1["NotFunction"] = "NOT_FUNC";
    ErrorCode1["RequestError"] = "REQUEST_ERROR";
    ErrorCode1["ServerOptionNotAvailable"] = "SERVER_OPT_NA";
    ErrorCode1["SubClosed"] = "SUB_CLOSED";
    ErrorCode1["SubDraining"] = "SUB_DRAINING";
    ErrorCode1["Timeout"] = "TIMEOUT";
    ErrorCode1["Tls"] = "TLS";
    ErrorCode1["Unknown"] = "UNKNOWN_ERROR";
    ErrorCode1["WssRequired"] = "WSS_REQUIRED";
    ErrorCode1["JetStreamInvalidAck"] = "JESTREAM_INVALID_ACK";
    ErrorCode1["JetStream404NoMessages"] = "404";
    ErrorCode1["JetStream408RequestTimeout"] = "408";
    ErrorCode1["JetStream409MaxAckPendingExceeded"] = "409";
    ErrorCode1["JetStreamNotEnabled"] = "503";
    ErrorCode1["AuthorizationViolation"] = "AUTHORIZATION_VIOLATION";
    ErrorCode1["AuthenticationExpired"] = "AUTHENTICATION_EXPIRED";
    ErrorCode1["ProtocolError"] = "NATS_PROTOCOL_ERR";
    ErrorCode1["PermissionsViolation"] = "PERMISSIONS_VIOLATION";
})(ErrorCode || (ErrorCode = {}));
class Messages {
    messages;
    constructor(){
        this.messages = new Map();
        this.messages.set(ErrorCode.InvalidPayload, "Invalid payload type - payloads can be 'binary', 'string', or 'json'");
        this.messages.set(ErrorCode.BadJson, "Bad JSON");
        this.messages.set(ErrorCode.WssRequired, "TLS is required, therefore a secure websocket connection is also required");
    }
    static getMessage(s) {
        return messages.getMessage(s);
    }
    getMessage(s) {
        return this.messages.get(s) || s;
    }
}
const messages = new Messages();
function isNatsError(err) {
    return typeof err.code === "string";
}
class NatsError extends Error {
    name;
    message;
    code;
    chainedError;
    api_error;
    constructor(message, code1, chainedError){
        super(message);
        this.name = "NatsError";
        this.message = message;
        this.code = code1;
        this.chainedError = chainedError;
    }
    static errorForCode(code2, chainedError) {
        const m = Messages.getMessage(code2);
        return new NatsError(m, code2, chainedError);
    }
    isAuthError() {
        return this.code === ErrorCode.AuthenticationExpired || this.code === ErrorCode.AuthorizationViolation;
    }
    isPermissionError() {
        return this.code === ErrorCode.PermissionsViolation;
    }
    isProtocolError() {
        return this.code === ErrorCode.ProtocolError;
    }
    isJetStreamError() {
        return this.api_error !== undefined;
    }
    jsError() {
        return this.api_error ? this.api_error : null;
    }
}
function validateDurableName(name) {
    return validateName("durable", name);
}
function validateStreamName(name) {
    return validateName("stream", name);
}
function validateName(context, name = "") {
    if (name === "") {
        throw Error(`${context} name required`);
    }
    const bad = [
        ".",
        "*",
        ">"
    ];
    bad.forEach((v)=>{
        if (name.indexOf(v) !== -1) {
            throw Error(`invalid ${context} name - ${context} name cannot contain '${v}'`);
        }
    });
}
function defaultConsumer(name, opts = {}) {
    return Object.assign({
        name: name,
        deliver_policy: DeliverPolicy.All,
        ack_policy: AckPolicy.Explicit,
        ack_wait: nanos(30 * 1000),
        replay_policy: ReplayPolicy.Instant
    }, opts);
}
function nanos(millis1) {
    return millis1 * 1000000;
}
function millis(ns) {
    return ns / 1000000;
}
function isFlowControlMsg(msg) {
    const h = msg.headers;
    if (!h) {
        return false;
    }
    return h.code >= 100 && h.code < 200;
}
function isHeartbeatMsg(msg) {
    return isFlowControlMsg(msg) && msg.headers?.description === "Idle Heartbeat";
}
function checkJsError(msg) {
    const h = msg.headers;
    if (!h) {
        return null;
    }
    return checkJsErrorCode(h.code, h.status);
}
function checkJsErrorCode(code3, description = "") {
    if (code3 < 300) {
        return null;
    }
    description = description.toLowerCase();
    switch(code3){
        case 408:
            return NatsError.errorForCode(ErrorCode.JetStream408RequestTimeout, new Error(description));
        case 503:
            return NatsError.errorForCode(ErrorCode.JetStreamNotEnabled, new Error(description));
        default:
            if (description === "") {
                description = ErrorCode.Unknown;
            }
            return new NatsError(description, `${code3}`);
    }
}
const TE = new TextEncoder();
const TD = new TextDecoder();
function concat(...bufs) {
    let max = 0;
    for(let i2 = 0; i2 < bufs.length; i2++){
        max += bufs[i2].length;
    }
    const out = new Uint8Array(max);
    let index = 0;
    for(let i1 = 0; i1 < bufs.length; i1++){
        out.set(bufs[i1], index);
        index += bufs[i1].length;
    }
    return out;
}
function encode(...a) {
    const bufs = [];
    for(let i3 = 0; i3 < a.length; i3++){
        bufs.push(TE.encode(a[i3]));
    }
    if (bufs.length === 0) {
        return Empty;
    }
    if (bufs.length === 1) {
        return bufs[0];
    }
    return concat(...bufs);
}
function decode(a) {
    if (!a || a.length === 0) {
        return "";
    }
    return TD.decode(a);
}
class DataBuffer {
    buffers;
    byteLength;
    constructor(){
        this.buffers = [];
        this.byteLength = 0;
    }
    static concat(...bufs) {
        let max = 0;
        for(let i4 = 0; i4 < bufs.length; i4++){
            max += bufs[i4].length;
        }
        const out = new Uint8Array(max);
        let index = 0;
        for(let i1 = 0; i1 < bufs.length; i1++){
            out.set(bufs[i1], index);
            index += bufs[i1].length;
        }
        return out;
    }
    static fromAscii(m) {
        if (!m) {
            m = "";
        }
        return TE.encode(m);
    }
    static toAscii(a) {
        return TD.decode(a);
    }
    reset() {
        this.buffers.length = 0;
        this.byteLength = 0;
    }
    pack() {
        if (this.buffers.length > 1) {
            const v = new Uint8Array(this.byteLength);
            let index = 0;
            for(let i5 = 0; i5 < this.buffers.length; i5++){
                v.set(this.buffers[i5], index);
                index += this.buffers[i5].length;
            }
            this.buffers.length = 0;
            this.buffers.push(v);
        }
    }
    drain(n) {
        if (this.buffers.length) {
            this.pack();
            const v = this.buffers.pop();
            if (v) {
                const max = this.byteLength;
                if (n === undefined || n > max) {
                    n = max;
                }
                const d = v.subarray(0, n);
                if (max > n) {
                    this.buffers.push(v.subarray(n));
                }
                this.byteLength = max - n;
                return d;
            }
        }
        return new Uint8Array(0);
    }
    fill(a, ...bufs) {
        if (a) {
            this.buffers.push(a);
            this.byteLength += a.length;
        }
        for(let i6 = 0; i6 < bufs.length; i6++){
            if (bufs[i6] && bufs[i6].length) {
                this.buffers.push(bufs[i6]);
                this.byteLength += bufs[i6].length;
            }
        }
    }
    peek() {
        if (this.buffers.length) {
            this.pack();
            return this.buffers[0];
        }
        return new Uint8Array(0);
    }
    size() {
        return this.byteLength;
    }
    length() {
        return this.buffers.length;
    }
}
const CR_LF = "\r\n";
CR_LF.length;
const CRLF = DataBuffer.fromAscii(CR_LF);
const CR = new Uint8Array(CRLF)[0];
const LF = new Uint8Array(CRLF)[1];
function isUint8Array(a) {
    return a instanceof Uint8Array;
}
function protoLen(ba) {
    for(let i7 = 0; i7 < ba.length; i7++){
        const n = i7 + 1;
        if (ba.byteLength > n && ba[i7] === CR && ba[n] === LF) {
            return n + 1;
        }
    }
    return 0;
}
function extractProtocolMessage(a) {
    const len = protoLen(a);
    if (len > 0) {
        const ba = new Uint8Array(a);
        const out = ba.slice(0, len);
        return TD.decode(out);
    }
    return "";
}
function extend(a, ...b) {
    for(let i8 = 0; i8 < b.length; i8++){
        const o = b[i8];
        Object.keys(o).forEach(function(k) {
            a[k] = o[k];
        });
    }
    return a;
}
function render(frame) {
    const cr = "␍";
    const lf = "␊";
    return TD.decode(frame).replace(/\n/g, lf).replace(/\r/g, cr);
}
function timeout(ms) {
    const err = NatsError.errorForCode(ErrorCode.Timeout);
    let methods;
    let timer;
    const p = new Promise((_resolve, reject)=>{
        const cancel = ()=>{
            if (timer) {
                clearTimeout(timer);
            }
        };
        methods = {
            cancel
        };
        timer = setTimeout(()=>{
            reject(err);
        }, ms);
    });
    return Object.assign(p, methods);
}
function delay(ms = 0) {
    return new Promise((resolve)=>{
        setTimeout(()=>{
            resolve();
        }, ms);
    });
}
function deferred() {
    let methods = {};
    const p = new Promise((resolve, reject)=>{
        methods = {
            resolve,
            reject
        };
    });
    return Object.assign(p, methods);
}
function shuffle(a) {
    for(let i9 = a.length - 1; i9 > 0; i9--){
        const j = Math.floor(Math.random() * (i9 + 1));
        [a[i9], a[j]] = [
            a[j],
            a[i9]
        ];
    }
    return a;
}
class Perf {
    timers;
    measures;
    constructor(){
        this.timers = new Map();
        this.measures = new Map();
    }
    mark(key) {
        this.timers.set(key, Date.now());
    }
    measure(key, startKey, endKey) {
        const s = this.timers.get(startKey);
        if (s === undefined) {
            throw new Error(`${startKey} is not defined`);
        }
        const e = this.timers.get(endKey);
        if (e === undefined) {
            throw new Error(`${endKey} is not defined`);
        }
        this.measures.set(key, e - s);
    }
    getEntries() {
        const values = [];
        this.measures.forEach((v, k)=>{
            values.push({
                name: k,
                duration: v
            });
        });
        return values;
    }
}
class QueuedIteratorImpl {
    inflight;
    processed;
    received;
    noIterator;
    iterClosed;
    done;
    signal;
    yields;
    filtered;
    pendingFiltered;
    ingestionFilterFn;
    protocolFilterFn;
    dispatchedFn;
    ctx;
    _data;
    err;
    constructor(){
        this.inflight = 0;
        this.filtered = 0;
        this.pendingFiltered = 0;
        this.processed = 0;
        this.received = 0;
        this.noIterator = false;
        this.done = false;
        this.signal = deferred();
        this.yields = [];
        this.iterClosed = deferred();
    }
    [Symbol.asyncIterator]() {
        return this.iterate();
    }
    push(v) {
        if (this.done) {
            return;
        }
        const { ingest , protocol  } = this.ingestionFilterFn ? this.ingestionFilterFn(v, this.ctx || this) : {
            ingest: true,
            protocol: false
        };
        if (ingest) {
            if (protocol) {
                this.filtered++;
                this.pendingFiltered++;
            }
            this.yields.push(v);
            this.signal.resolve();
        }
    }
    async *iterate() {
        if (this.noIterator) {
            throw new NatsError("unsupported iterator", ErrorCode.ApiError);
        }
        try {
            while(true){
                if (this.yields.length === 0) {
                    await this.signal;
                }
                if (this.err) {
                    throw this.err;
                }
                const yields = this.yields;
                this.inflight = yields.length;
                this.yields = [];
                for(let i10 = 0; i10 < yields.length; i10++){
                    const ok = this.protocolFilterFn ? this.protocolFilterFn(yields[i10]) : true;
                    if (ok) {
                        this.processed++;
                        yield yields[i10];
                        if (this.dispatchedFn && yields[i10]) {
                            this.dispatchedFn(yields[i10]);
                        }
                    } else {
                        this.pendingFiltered--;
                    }
                    this.inflight--;
                }
                if (this.done) {
                    break;
                } else if (this.yields.length === 0) {
                    yields.length = 0;
                    this.yields = yields;
                    this.signal = deferred();
                }
            }
        } finally{
            this.stop();
        }
    }
    stop(err) {
        if (this.done) {
            return;
        }
        this.err = err;
        this.done = true;
        this.signal.resolve();
        this.iterClosed.resolve();
    }
    getProcessed() {
        return this.noIterator ? this.received : this.processed;
    }
    getPending() {
        return this.yields.length + this.inflight - this.pendingFiltered;
    }
    getReceived() {
        return this.received - this.filtered;
    }
}
function canonicalMIMEHeaderKey(k) {
    const dash = 45;
    const toLower = 97 - 65;
    let upper = true;
    const buf = new Array(k.length);
    for(let i11 = 0; i11 < k.length; i11++){
        let c = k.charCodeAt(i11);
        if (c === 58 || c < 33 || c > 126) {
            throw new NatsError(`'${k[i11]}' is not a valid character for a header key`, ErrorCode.BadHeader);
        }
        if (upper && 97 <= c && c <= 122) {
            c -= toLower;
        } else if (!upper && 65 <= c && c <= 90) {
            c += toLower;
        }
        buf[i11] = c;
        upper = c == dash;
    }
    return String.fromCharCode(...buf);
}
function headers() {
    return new MsgHdrsImpl();
}
const HEADER = "NATS/1.0";
var Match;
(function(Match1) {
    Match1[Match1["Exact"] = 0] = "Exact";
    Match1[Match1["CanonicalMIME"] = 1] = "CanonicalMIME";
    Match1[Match1["IgnoreCase"] = 2] = "IgnoreCase";
})(Match || (Match = {}));
class MsgHdrsImpl {
    code;
    headers;
    description;
    constructor(){
        this.code = 0;
        this.headers = new Map();
        this.description = "";
    }
    [Symbol.iterator]() {
        return this.headers.entries();
    }
    size() {
        return this.headers.size;
    }
    equals(mh) {
        if (mh && this.headers.size === mh.headers.size && this.code === mh.code) {
            for (const [k, v] of this.headers){
                const a = mh.values(k);
                if (v.length !== a.length) {
                    return false;
                }
                const vv = [
                    ...v
                ].sort();
                const aa = [
                    ...a
                ].sort();
                for(let i12 = 0; i12 < vv.length; i12++){
                    if (vv[i12] !== aa[i12]) {
                        return false;
                    }
                }
            }
            return true;
        }
        return false;
    }
    static decode(a) {
        const mh = new MsgHdrsImpl();
        const s1 = TD.decode(a);
        const lines = s1.split("\r\n");
        const h = lines[0];
        if (h !== HEADER) {
            let str = h.replace(HEADER, "");
            mh.code = parseInt(str, 10);
            const scode = mh.code.toString();
            str = str.replace(scode, "");
            mh.description = str.trim();
        }
        if (lines.length >= 1) {
            lines.slice(1).map((s)=>{
                if (s) {
                    const idx = s.indexOf(":");
                    if (idx > -1) {
                        const k = s.slice(0, idx);
                        const v = s.slice(idx + 1).trim();
                        mh.append(k, v);
                    }
                }
            });
        }
        return mh;
    }
    toString() {
        if (this.headers.size === 0) {
            return "";
        }
        let s = HEADER;
        for (const [k, v] of this.headers){
            for(let i13 = 0; i13 < v.length; i13++){
                s = `${s}\r\n${k}: ${v[i13]}`;
            }
        }
        return `${s}\r\n\r\n`;
    }
    encode() {
        return TE.encode(this.toString());
    }
    static validHeaderValue(k) {
        const inv = /[\r\n]/;
        if (inv.test(k)) {
            throw new NatsError("invalid header value - \\r and \\n are not allowed.", ErrorCode.BadHeader);
        }
        return k.trim();
    }
    keys() {
        const keys = [];
        for (const sk of this.headers.keys()){
            keys.push(sk);
        }
        return keys;
    }
    findKeys(k, match = Match.Exact) {
        const keys = this.keys();
        switch(match){
            case Match.Exact:
                return keys.filter((v)=>{
                    return v === k;
                });
            case Match.CanonicalMIME:
                k = canonicalMIMEHeaderKey(k);
                return keys.filter((v)=>{
                    return v === k;
                });
            default:
                {
                    const lci = k.toLowerCase();
                    return keys.filter((v)=>{
                        return lci === v.toLowerCase();
                    });
                }
        }
    }
    get(k, match = Match.Exact) {
        const keys = this.findKeys(k, match);
        if (keys.length) {
            const v = this.headers.get(keys[0]);
            if (v) {
                return Array.isArray(v) ? v[0] : v;
            }
        }
        return "";
    }
    has(k, match = Match.Exact) {
        return this.findKeys(k, match).length > 0;
    }
    set(k, v, match = Match.Exact) {
        this.delete(k, match);
        this.append(k, v, match);
    }
    append(k, v, match = Match.Exact) {
        const ck = canonicalMIMEHeaderKey(k);
        if (match === Match.CanonicalMIME) {
            k = ck;
        }
        const keys = this.findKeys(k, match);
        k = keys.length > 0 ? keys[0] : k;
        const value = MsgHdrsImpl.validHeaderValue(v);
        let a = this.headers.get(k);
        if (!a) {
            a = [];
            this.headers.set(k, a);
        }
        a.push(value);
    }
    values(k, match = Match.Exact) {
        const buf = [];
        const keys = this.findKeys(k, match);
        keys.forEach((v)=>{
            const values = this.headers.get(v);
            if (values) {
                buf.push(...values);
            }
        });
        return buf;
    }
    delete(k, match = Match.Exact) {
        const keys = this.findKeys(k, match);
        keys.forEach((v)=>{
            this.headers.delete(v);
        });
    }
    get hasError() {
        return this.code >= 300;
    }
    get status() {
        return `${this.code} ${this.description}`.trim();
    }
}
function StringCodec() {
    return {
        encode (d) {
            return TE.encode(d);
        },
        decode (a) {
            return TD.decode(a);
        }
    };
}
function JSONCodec(reviver) {
    return {
        encode (d) {
            try {
                if (d === undefined) {
                    d = null;
                }
                return TE.encode(JSON.stringify(d));
            } catch (err) {
                throw NatsError.errorForCode(ErrorCode.BadJson, err);
            }
        },
        decode (a) {
            try {
                return JSON.parse(TD.decode(a), reviver);
            } catch (err) {
                throw NatsError.errorForCode(ErrorCode.BadJson, err);
            }
        }
    };
}
const defaultPrefix = "$JS.API";
function defaultJsOptions(opts) {
    opts = opts || {};
    if (opts.domain) {
        opts.apiPrefix = `$JS.${opts.domain}.API`;
        delete opts.domain;
    }
    return extend({
        apiPrefix: defaultPrefix,
        timeout: 5000
    }, opts);
}
class BaseApiClient {
    nc;
    opts;
    prefix;
    timeout;
    jc;
    constructor(nc, opts){
        this.nc = nc;
        this.opts = defaultJsOptions(opts);
        this._parseOpts();
        this.prefix = this.opts.apiPrefix;
        this.timeout = this.opts.timeout;
        this.jc = JSONCodec();
    }
    _parseOpts() {
        let prefix = this.opts.apiPrefix;
        if (!prefix || prefix.length === 0) {
            throw new Error("invalid empty prefix");
        }
        const c = prefix[prefix.length - 1];
        if (c === ".") {
            prefix = prefix.substr(0, prefix.length - 1);
        }
        this.opts.apiPrefix = prefix;
    }
    async _request(subj, data = null, opts) {
        opts = opts || {};
        opts.timeout = this.timeout;
        let a = Empty;
        if (data) {
            a = this.jc.encode(data);
        }
        const m = await this.nc.request(subj, a, opts);
        return this.parseJsResponse(m);
    }
    async findStream(subject) {
        const q = {
            subject
        };
        const r = await this._request(`${this.prefix}.STREAM.NAMES`, q);
        const names = r;
        if (!names.streams || names.streams.length !== 1) {
            throw new Error("no stream matches subject");
        }
        return names.streams[0];
    }
    parseJsResponse(m) {
        const v = this.jc.decode(m.data);
        const r = v;
        if (r.error) {
            const err = checkJsErrorCode(r.error.code, r.error.description);
            if (err !== null) {
                err.api_error = r.error;
                throw err;
            }
        }
        return v;
    }
}
class ListerImpl {
    err;
    offset;
    pageInfo;
    subject;
    jsm;
    filter;
    constructor(subject, filter, jsm){
        if (!subject) {
            throw new Error("subject is required");
        }
        this.subject = subject;
        this.jsm = jsm;
        this.offset = 0;
        this.pageInfo = {};
        this.filter = filter;
    }
    async next() {
        if (this.err) {
            return [];
        }
        if (this.pageInfo && this.offset >= this.pageInfo.total) {
            return [];
        }
        const offset = {
            offset: this.offset
        };
        try {
            const r = await this.jsm._request(this.subject, offset, {
                timeout: this.jsm.timeout
            });
            this.pageInfo = r;
            const a = this.filter(r);
            this.offset += a.length;
            return a;
        } catch (err) {
            this.err = err;
            throw err;
        }
    }
    async *[Symbol.asyncIterator]() {
        let page = await this.next();
        while(page.length > 0){
            for (const item of page){
                yield item;
            }
            page = await this.next();
        }
    }
}
class ConsumerAPIImpl extends BaseApiClient {
    constructor(nc, opts){
        super(nc, opts);
    }
    async add(stream, cfg) {
        validateStreamName(stream);
        if (cfg.deliver_group && cfg.flow_control) {
            throw new Error("jetstream flow control is not supported with queue groups");
        }
        if (cfg.deliver_group && cfg.idle_heartbeat) {
            throw new Error("jetstream idle heartbeat is not supported with queue groups");
        }
        const cr = {};
        cr.config = cfg;
        cr.stream_name = stream;
        if (cr.config.durable_name) {
            validateDurableName(cr.config.durable_name);
        }
        const subj = cfg.durable_name ? `${this.prefix}.CONSUMER.DURABLE.CREATE.${stream}.${cfg.durable_name}` : `${this.prefix}.CONSUMER.CREATE.${stream}`;
        const r = await this._request(subj, cr);
        return r;
    }
    async update(stream, durable, cfg) {
        const ci = await this.info(stream, durable);
        const changable = cfg;
        return this.add(stream, Object.assign(ci.config, changable));
    }
    async info(stream, name) {
        validateStreamName(stream);
        validateDurableName(name);
        const r = await this._request(`${this.prefix}.CONSUMER.INFO.${stream}.${name}`);
        return r;
    }
    async delete(stream, name) {
        validateStreamName(stream);
        validateDurableName(name);
        const r = await this._request(`${this.prefix}.CONSUMER.DELETE.${stream}.${name}`);
        const cr = r;
        return cr.success;
    }
    list(stream) {
        validateStreamName(stream);
        const filter = (v)=>{
            const clr = v;
            return clr.consumers;
        };
        const subj = `${this.prefix}.CONSUMER.LIST.${stream}`;
        return new ListerImpl(subj, filter, this);
    }
}
"use strict";
const digits = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const base = 36;
const maxSeq = 3656158440062976;
const minInc = 33;
const maxInc = 333;
const totalLen = 12 + 10;
const cryptoObj = initCrypto();
function initCrypto() {
    let cryptoObj1 = null;
    if (typeof globalThis !== "undefined") {
        if ("crypto" in globalThis && globalThis.crypto.getRandomValues) {
            cryptoObj1 = globalThis.crypto;
        }
    }
    if (!cryptoObj1) {
        cryptoObj1 = {
            getRandomValues: function(array) {
                for(let i14 = 0; i14 < array.length; i14++){
                    array[i14] = Math.floor(Math.random() * 255);
                }
            }
        };
    }
    return cryptoObj1;
}
class Nuid {
    buf;
    seq;
    inc;
    constructor(){
        this.buf = new Uint8Array(totalLen);
        this.init();
    }
    init() {
        this.setPre();
        this.initSeqAndInc();
        this.fillSeq();
    }
    initSeqAndInc() {
        this.seq = Math.floor(Math.random() * maxSeq);
        this.inc = Math.floor(Math.random() * (maxInc - minInc) + minInc);
    }
    setPre() {
        const cbuf = new Uint8Array(12);
        cryptoObj.getRandomValues(cbuf);
        for(let i15 = 0; i15 < 12; i15++){
            const di = cbuf[i15] % 36;
            this.buf[i15] = digits.charCodeAt(di);
        }
    }
    fillSeq() {
        let n = this.seq;
        for(let i16 = totalLen - 1; i16 >= 12; i16--){
            this.buf[i16] = digits.charCodeAt(n % base);
            n = Math.floor(n / base);
        }
    }
    next() {
        this.seq += this.inc;
        if (this.seq > 3656158440062976) {
            this.setPre();
            this.initSeqAndInc();
        }
        this.fillSeq();
        return String.fromCharCode.apply(String, this.buf);
    }
    reset() {
        this.init();
    }
}
const nuid = new Nuid();
class Request {
    token;
    received;
    deferred;
    timer;
    ctx;
    mux;
    constructor(mux, opts = {
        timeout: 1000
    }){
        this.mux = mux;
        this.received = 0;
        this.deferred = deferred();
        this.token = nuid.next();
        extend(this, opts);
        this.timer = timeout(opts.timeout);
        this.ctx = new Error();
    }
    resolver(err, msg) {
        if (this.timer) {
            this.timer.cancel();
        }
        if (err) {
            err.stack += `\n\n${this.ctx.stack}`;
            this.deferred.reject(err);
        } else {
            this.deferred.resolve(msg);
        }
        this.cancel();
    }
    cancel(err) {
        if (this.timer) {
            this.timer.cancel();
        }
        this.mux.cancel(this);
        this.deferred.reject(err ? err : NatsError.errorForCode(ErrorCode.Cancelled));
    }
}
const ACK = Uint8Array.of(43, 65, 67, 75);
const NAK = Uint8Array.of(45, 78, 65, 75);
const WPI = Uint8Array.of(43, 87, 80, 73);
const NXT = Uint8Array.of(43, 78, 88, 84);
const TERM = Uint8Array.of(43, 84, 69, 82, 77);
const SPACE = Uint8Array.of(32);
function toJsMsg(m) {
    return new JsMsgImpl(m);
}
function parseInfo(s) {
    const tokens = s.split(".");
    if (tokens.length === 9) {
        tokens.splice(2, 0, "_", "");
    }
    if (tokens.length < 11 || tokens[0] !== "$JS" || tokens[1] !== "ACK") {
        throw new Error(`not js message`);
    }
    const di = {};
    di.domain = tokens[2] === "_" ? "" : tokens[2];
    di.account_hash = tokens[3];
    di.stream = tokens[4];
    di.consumer = tokens[5];
    di.redeliveryCount = parseInt(tokens[6], 10);
    di.redelivered = di.redeliveryCount > 1;
    di.streamSequence = parseInt(tokens[7], 10);
    di.deliverySequence = parseInt(tokens[8], 10);
    di.timestampNanos = parseInt(tokens[9], 10);
    di.pending = parseInt(tokens[10], 10);
    return di;
}
class JsMsgImpl {
    msg;
    di;
    didAck;
    constructor(msg){
        this.msg = msg;
        this.didAck = false;
    }
    get subject() {
        return this.msg.subject;
    }
    get sid() {
        return this.msg.sid;
    }
    get data() {
        return this.msg.data;
    }
    get headers() {
        return this.msg.headers;
    }
    get info() {
        if (!this.di) {
            this.di = parseInfo(this.reply);
        }
        return this.di;
    }
    get redelivered() {
        return this.info.redeliveryCount > 1;
    }
    get reply() {
        return this.msg.reply || "";
    }
    get seq() {
        return this.info.streamSequence;
    }
    doAck(payload) {
        if (!this.didAck) {
            this.didAck = !this.isWIP(payload);
            this.msg.respond(payload);
        }
    }
    isWIP(p) {
        return p.length === 4 && p[0] === WPI[0] && p[1] === WPI[1] && p[2] === WPI[2] && p[3] === WPI[3];
    }
    async ackAck() {
        if (!this.didAck) {
            this.didAck = true;
            if (this.msg.reply) {
                const mi = this.msg;
                const proto = mi.publisher;
                const r = new Request(proto.muxSubscriptions);
                proto.request(r);
                try {
                    proto.publish(this.msg.reply, ACK, {
                        reply: `${proto.muxSubscriptions.baseInbox}${r.token}`
                    });
                } catch (err) {
                    r.cancel(err);
                }
                try {
                    await Promise.race([
                        r.timer,
                        r.deferred
                    ]);
                    return true;
                } catch (err1) {
                    r.cancel(err1);
                }
            }
        }
        return false;
    }
    ack() {
        this.doAck(ACK);
    }
    nak(millis1) {
        let payload = NAK;
        if (millis1) {
            payload = StringCodec().encode(`-NAK ${JSON.stringify({
                delay: nanos(millis1)
            })}`);
        }
        this.doAck(payload);
    }
    working() {
        this.doAck(WPI);
    }
    next(subj, ro) {
        let payload = NXT;
        if (ro) {
            const data = JSONCodec().encode(ro);
            payload = DataBuffer.concat(NXT, SPACE, data);
        }
        const opts = subj ? {
            reply: subj
        } : undefined;
        this.msg.respond(payload, opts);
    }
    term() {
        this.doAck(TERM);
    }
}
function checkFn(fn, name, required = false) {
    if (required === true && !fn) {
        throw NatsError.errorForCode(ErrorCode.ApiError, new Error(`${name} is not a function`));
    }
    if (fn && typeof fn !== "function") {
        throw NatsError.errorForCode(ErrorCode.ApiError, new Error(`${name} is not a function`));
    }
}
class TypedSubscription extends QueuedIteratorImpl {
    sub;
    adapter;
    subIterDone;
    constructor(nc, subject, opts){
        super();
        checkFn(opts.adapter, "adapter", true);
        this.adapter = opts.adapter;
        if (opts.callback) {
            checkFn(opts.callback, "callback");
        }
        this.noIterator = typeof opts.callback === "function";
        if (opts.ingestionFilterFn) {
            checkFn(opts.ingestionFilterFn, "ingestionFilterFn");
            this.ingestionFilterFn = opts.ingestionFilterFn;
        }
        if (opts.protocolFilterFn) {
            checkFn(opts.protocolFilterFn, "protocolFilterFn");
            this.protocolFilterFn = opts.protocolFilterFn;
        }
        if (opts.dispatchedFn) {
            checkFn(opts.dispatchedFn, "dispatchedFn");
            this.dispatchedFn = opts.dispatchedFn;
        }
        if (opts.cleanupFn) {
            checkFn(opts.cleanupFn, "cleanupFn");
        }
        let callback = (err, msg)=>{
            this.callback(err, msg);
        };
        if (opts.callback) {
            const uh = opts.callback;
            callback = (err, msg)=>{
                const [jer, tm] = this.adapter(err, msg);
                if (jer) {
                    uh(jer, null);
                    return;
                }
                const { ingest  } = this.ingestionFilterFn ? this.ingestionFilterFn(tm, this) : {
                    ingest: true
                };
                if (ingest) {
                    const ok = this.protocolFilterFn ? this.protocolFilterFn(tm) : true;
                    if (ok) {
                        uh(jer, tm);
                        if (this.dispatchedFn && tm) {
                            this.dispatchedFn(tm);
                        }
                    }
                }
            };
        }
        const { max , queue , timeout: timeout1  } = opts;
        const sopts = {
            queue,
            timeout: timeout1,
            callback
        };
        if (max && max > 0) {
            sopts.max = max;
        }
        this.sub = nc.subscribe(subject, sopts);
        if (opts.cleanupFn) {
            this.sub.cleanupFn = opts.cleanupFn;
        }
        if (!this.noIterator) {
            this.iterClosed.then(()=>{
                this.unsubscribe();
            });
        }
        this.subIterDone = deferred();
        Promise.all([
            this.sub.closed,
            this.iterClosed
        ]).then(()=>{
            this.subIterDone.resolve();
        }).catch(()=>{
            this.subIterDone.resolve();
        });
        (async (s)=>{
            await s.closed;
            this.stop();
        })(this.sub).then().catch();
    }
    unsubscribe(max) {
        this.sub.unsubscribe(max);
    }
    drain() {
        return this.sub.drain();
    }
    isDraining() {
        return this.sub.isDraining();
    }
    isClosed() {
        return this.sub.isClosed();
    }
    callback(e, msg) {
        this.sub.cancelTimeout();
        const [err, tm] = this.adapter(e, msg);
        if (err) {
            this.stop(err);
        }
        if (tm) {
            this.push(tm);
        }
    }
    getSubject() {
        return this.sub.getSubject();
    }
    getReceived() {
        return this.sub.getReceived();
    }
    getProcessed() {
        return this.sub.getProcessed();
    }
    getPending() {
        return this.sub.getPending();
    }
    getID() {
        return this.sub.getID();
    }
    getMax() {
        return this.sub.getMax();
    }
    get closed() {
        return this.sub.closed;
    }
}
function isRequestError(msg) {
    if (msg && msg.headers) {
        const headers1 = msg.headers;
        if (headers1.hasError) {
            if (headers1.code === 503) {
                return NatsError.errorForCode(ErrorCode.NoResponders);
            } else {
                let desc = headers1.description;
                if (desc === "") {
                    desc = ErrorCode.RequestError;
                }
                desc = desc.toLowerCase();
                return new NatsError(desc, headers1.status);
            }
        }
    }
    return null;
}
class MsgImpl {
    _headers;
    _msg;
    _rdata;
    _reply;
    _subject;
    publisher;
    constructor(msg, data, publisher){
        this._msg = msg;
        this._rdata = data;
        this.publisher = publisher;
    }
    get subject() {
        if (this._subject) {
            return this._subject;
        }
        this._subject = TD.decode(this._msg.subject);
        return this._subject;
    }
    get reply() {
        if (this._reply) {
            return this._reply;
        }
        this._reply = TD.decode(this._msg.reply);
        return this._reply;
    }
    get sid() {
        return this._msg.sid;
    }
    get headers() {
        if (this._msg.hdr > -1 && !this._headers) {
            const buf = this._rdata.subarray(0, this._msg.hdr);
            this._headers = MsgHdrsImpl.decode(buf);
        }
        return this._headers;
    }
    get data() {
        if (!this._rdata) {
            return new Uint8Array(0);
        }
        return this._msg.hdr > -1 ? this._rdata.subarray(this._msg.hdr) : this._rdata;
    }
    respond(data = Empty, opts) {
        if (this.reply) {
            this.publisher.publish(this.reply, data, opts);
            return true;
        }
        return false;
    }
}
let transportConfig;
function setTransportFactory(config) {
    transportConfig = config;
}
function defaultPort() {
    return transportConfig !== undefined && transportConfig.defaultPort !== undefined ? transportConfig.defaultPort : 4222;
}
function getUrlParseFn() {
    return transportConfig !== undefined && transportConfig.urlParseFn ? transportConfig.urlParseFn : undefined;
}
function newTransport() {
    if (!transportConfig || typeof transportConfig.factory !== "function") {
        throw new Error("transport fn is not set");
    }
    return transportConfig.factory();
}
function getResolveFn() {
    return transportConfig !== undefined && transportConfig.dnsResolveFn ? transportConfig.dnsResolveFn : undefined;
}
const IPv4LEN = 4;
const ASCII0 = 48;
const ASCIIA = 65;
const ASCIIa = 97;
function ipV4(a, b, c, d) {
    const ip = new Uint8Array(16);
    const prefix = [
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        255,
        255
    ];
    prefix.forEach((v, idx)=>{
        ip[idx] = v;
    });
    ip[12] = a;
    ip[13] = b;
    ip[14] = c;
    ip[15] = d;
    return ip;
}
function isIP(h) {
    return parseIP(h) !== undefined;
}
function parseIP(h) {
    for(let i17 = 0; i17 < h.length; i17++){
        switch(h[i17]){
            case ".":
                return parseIPv4(h);
            case ":":
                return parseIPv6(h);
        }
    }
    return;
}
function parseIPv4(s) {
    const ip = new Uint8Array(4);
    for(let i18 = 0; i18 < 4; i18++){
        if (s.length === 0) {
            return undefined;
        }
        if (i18 > 0) {
            if (s[0] !== ".") {
                return undefined;
            }
            s = s.substring(1);
        }
        const { n , c , ok  } = dtoi(s);
        if (!ok || n > 255) {
            return undefined;
        }
        s = s.substring(c);
        ip[i18] = n;
    }
    return ipV4(ip[0], ip[1], ip[2], ip[3]);
}
function parseIPv6(s) {
    const ip = new Uint8Array(16);
    let ellipsis = -1;
    if (s.length >= 2 && s[0] === ":" && s[1] === ":") {
        ellipsis = 0;
        s = s.substring(2);
        if (s.length === 0) {
            return ip;
        }
    }
    let i19 = 0;
    while(i19 < 16){
        const { n , c , ok  } = xtoi(s);
        if (!ok || n > 65535) {
            return undefined;
        }
        if (c < s.length && s[c] === ".") {
            if (ellipsis < 0 && i19 != 16 - 4) {
                return undefined;
            }
            if (i19 + 4 > 16) {
                return undefined;
            }
            const ip4 = parseIPv4(s);
            if (ip4 === undefined) {
                return undefined;
            }
            ip[i19] = ip4[12];
            ip[i19 + 1] = ip4[13];
            ip[i19 + 2] = ip4[14];
            ip[i19 + 3] = ip4[15];
            s = "";
            i19 += IPv4LEN;
            break;
        }
        ip[i19] = n >> 8;
        ip[i19 + 1] = n;
        i19 += 2;
        s = s.substring(c);
        if (s.length === 0) {
            break;
        }
        if (s[0] !== ":" || s.length == 1) {
            return undefined;
        }
        s = s.substring(1);
        if (s[0] === ":") {
            if (ellipsis >= 0) {
                return undefined;
            }
            ellipsis = i19;
            s = s.substring(1);
            if (s.length === 0) {
                break;
            }
        }
    }
    if (s.length !== 0) {
        return undefined;
    }
    if (i19 < 16) {
        if (ellipsis < 0) {
            return undefined;
        }
        const n = 16 - i19;
        for(let j = i19 - 1; j >= ellipsis; j--){
            ip[j + n] = ip[j];
        }
        for(let j1 = ellipsis + n - 1; j1 >= ellipsis; j1--){
            ip[j1] = 0;
        }
    } else if (ellipsis >= 0) {
        return undefined;
    }
    return ip;
}
function dtoi(s) {
    let i20 = 0;
    let n = 0;
    for(i20 = 0; i20 < s.length && 48 <= s.charCodeAt(i20) && s.charCodeAt(i20) <= 57; i20++){
        n = n * 10 + (s.charCodeAt(i20) - ASCII0);
        if (n >= 16777215) {
            return {
                n: 16777215,
                c: i20,
                ok: false
            };
        }
    }
    if (i20 === 0) {
        return {
            n: 0,
            c: 0,
            ok: false
        };
    }
    return {
        n: n,
        c: i20,
        ok: true
    };
}
function xtoi(s) {
    let n = 0;
    let i21 = 0;
    for(i21 = 0; i21 < s.length; i21++){
        if (48 <= s.charCodeAt(i21) && s.charCodeAt(i21) <= 57) {
            n *= 16;
            n += s.charCodeAt(i21) - ASCII0;
        } else if (97 <= s.charCodeAt(i21) && s.charCodeAt(i21) <= 102) {
            n *= 16;
            n += s.charCodeAt(i21) - ASCIIa + 10;
        } else if (65 <= s.charCodeAt(i21) && s.charCodeAt(i21) <= 70) {
            n *= 16;
            n += s.charCodeAt(i21) - ASCIIA + 10;
        } else {
            break;
        }
        if (n >= 16777215) {
            return {
                n: 0,
                c: i21,
                ok: false
            };
        }
    }
    if (i21 === 0) {
        return {
            n: 0,
            c: i21,
            ok: false
        };
    }
    return {
        n: n,
        c: i21,
        ok: true
    };
}
function isIPV4OrHostname(hp) {
    if (hp.indexOf(".") !== -1) {
        return true;
    }
    if (hp.indexOf("[") !== -1 || hp.indexOf("::") !== -1) {
        return false;
    }
    if (hp.split(":").length <= 2) {
        return true;
    }
    return false;
}
function isIPV6(hp) {
    return !isIPV4OrHostname(hp);
}
function hostPort(u) {
    u = u.trim();
    if (u.match(/^(.*:\/\/)(.*)/m)) {
        u = u.replace(/^(.*:\/\/)(.*)/gm, "$2");
    }
    if (isIPV6(u) && u.indexOf("[") === -1) {
        u = `[${u}]`;
    }
    const op = isIPV6(u) ? u.match(/(]:)(\d+)/) : u.match(/(:)(\d+)/);
    const port = op && op.length === 3 && op[1] && op[2] ? parseInt(op[2]) : 4222;
    const protocol = port === 80 ? "https" : "http";
    const url = new URL(`${protocol}://${u}`);
    url.port = `${port}`;
    let hostname = url.hostname;
    if (hostname.charAt(0) === "[") {
        hostname = hostname.substring(1, hostname.length - 1);
    }
    const listen = url.host;
    return {
        listen,
        hostname,
        port
    };
}
class ServerImpl {
    src;
    listen;
    hostname;
    port;
    didConnect;
    reconnects;
    lastConnect;
    gossiped;
    tlsName;
    resolves;
    constructor(u, gossiped = false){
        this.src = u;
        this.tlsName = "";
        const v = hostPort(u);
        this.listen = v.listen;
        this.hostname = v.hostname;
        this.port = v.port;
        this.didConnect = false;
        this.reconnects = 0;
        this.lastConnect = 0;
        this.gossiped = gossiped;
    }
    toString() {
        return this.listen;
    }
    async resolve(opts) {
        if (!opts.fn) {
            return [
                this
            ];
        }
        const buf = [];
        if (isIP(this.hostname)) {
            return [
                this
            ];
        } else {
            const ips = await opts.fn(this.hostname);
            for (let ip of ips){
                const proto = this.port === 80 ? "https" : "http";
                const url = new URL(`${proto}://${isIPV6(ip) ? "[" + ip + "]" : ip}`);
                url.port = `${this.port}`;
                const ss = new ServerImpl(url.host, false);
                ss.tlsName = this.hostname;
                buf.push(ss);
            }
        }
        if (opts.randomize) {
            shuffle(buf);
        }
        this.resolves = buf;
        return buf;
    }
}
class Servers {
    firstSelect;
    servers;
    currentServer;
    tlsName;
    randomize;
    constructor(listens = [], opts = {}){
        this.firstSelect = true;
        this.servers = [];
        this.tlsName = "";
        this.randomize = opts.randomize || false;
        const urlParseFn = getUrlParseFn();
        if (listens) {
            listens.forEach((hp)=>{
                hp = urlParseFn ? urlParseFn(hp) : hp;
                this.servers.push(new ServerImpl(hp));
            });
            if (this.randomize) {
                this.servers = shuffle(this.servers);
            }
        }
        if (this.servers.length === 0) {
            this.addServer(`${DEFAULT_HOST}:${defaultPort()}`, false);
        }
        this.currentServer = this.servers[0];
    }
    updateTLSName() {
        const cs = this.getCurrentServer();
        if (!isIP(cs.hostname)) {
            this.tlsName = cs.hostname;
            this.servers.forEach((s)=>{
                if (s.gossiped) {
                    s.tlsName = this.tlsName;
                }
            });
        }
    }
    getCurrentServer() {
        return this.currentServer;
    }
    addServer(u, implicit = false) {
        const urlParseFn = getUrlParseFn();
        u = urlParseFn ? urlParseFn(u) : u;
        const s = new ServerImpl(u, implicit);
        if (isIP(s.hostname)) {
            s.tlsName = this.tlsName;
        }
        this.servers.push(s);
    }
    selectServer() {
        if (this.firstSelect) {
            this.firstSelect = false;
            return this.currentServer;
        }
        const t = this.servers.shift();
        if (t) {
            this.servers.push(t);
            this.currentServer = t;
        }
        return t;
    }
    removeCurrentServer() {
        this.removeServer(this.currentServer);
    }
    removeServer(server) {
        if (server) {
            const index = this.servers.indexOf(server);
            this.servers.splice(index, 1);
        }
    }
    length() {
        return this.servers.length;
    }
    next() {
        return this.servers.length ? this.servers[0] : undefined;
    }
    getServers() {
        return this.servers;
    }
    update(info) {
        const added = [];
        let deleted = [];
        const urlParseFn = getUrlParseFn();
        const discovered = new Map();
        if (info.connect_urls && info.connect_urls.length > 0) {
            info.connect_urls.forEach((hp)=>{
                hp = urlParseFn ? urlParseFn(hp) : hp;
                const s = new ServerImpl(hp, true);
                discovered.set(hp, s);
            });
        }
        const toDelete = [];
        this.servers.forEach((s, index)=>{
            const u = s.listen;
            if (s.gossiped && this.currentServer.listen !== u && discovered.get(u) === undefined) {
                toDelete.push(index);
            }
            discovered.delete(u);
        });
        toDelete.reverse();
        toDelete.forEach((index)=>{
            const removed = this.servers.splice(index, 1);
            deleted = deleted.concat(removed[0].listen);
        });
        discovered.forEach((v, k)=>{
            this.servers.push(v);
            added.push(k);
        });
        return {
            added,
            deleted
        };
    }
}
class SubscriptionImpl extends QueuedIteratorImpl {
    sid;
    queue;
    draining;
    max;
    subject;
    drained;
    protocol;
    timer;
    info;
    cleanupFn;
    closed;
    constructor(protocol, subject, opts = {}){
        super();
        extend(this, opts);
        this.protocol = protocol;
        this.subject = subject;
        this.draining = false;
        this.noIterator = typeof opts.callback === "function";
        this.closed = deferred();
        if (opts.timeout) {
            this.timer = timeout(opts.timeout);
            this.timer.then(()=>{
                this.timer = undefined;
            }).catch((err)=>{
                this.stop(err);
                if (this.noIterator) {
                    this.callback(err, {});
                }
            });
        }
        if (!this.noIterator) {
            this.iterClosed.then(()=>{
                this.unsubscribe();
            });
        }
    }
    setPrePostHandlers(opts) {
        if (this.noIterator) {
            const uc = this.callback;
            const ingestion = opts.ingestionFilterFn ? opts.ingestionFilterFn : ()=>{
                return {
                    ingest: true,
                    protocol: false
                };
            };
            const filter = opts.protocolFilterFn ? opts.protocolFilterFn : ()=>{
                return true;
            };
            const dispatched = opts.dispatchedFn ? opts.dispatchedFn : ()=>{};
            this.callback = (err, msg)=>{
                const { ingest  } = ingestion(msg);
                if (!ingest) {
                    return;
                }
                if (filter(msg)) {
                    uc(err, msg);
                    dispatched(msg);
                }
            };
        } else {
            this.protocolFilterFn = opts.protocolFilterFn;
            this.dispatchedFn = opts.dispatchedFn;
        }
    }
    callback(err, msg) {
        this.cancelTimeout();
        err ? this.stop(err) : this.push(msg);
    }
    close() {
        if (!this.isClosed()) {
            this.cancelTimeout();
            this.stop();
            if (this.cleanupFn) {
                try {
                    this.cleanupFn(this, this.info);
                } catch (_err) {}
            }
            this.closed.resolve();
        }
    }
    unsubscribe(max) {
        this.protocol.unsubscribe(this, max);
    }
    cancelTimeout() {
        if (this.timer) {
            this.timer.cancel();
            this.timer = undefined;
        }
    }
    drain() {
        if (this.protocol.isClosed()) {
            throw NatsError.errorForCode(ErrorCode.ConnectionClosed);
        }
        if (this.isClosed()) {
            throw NatsError.errorForCode(ErrorCode.SubClosed);
        }
        if (!this.drained) {
            this.protocol.unsub(this);
            this.drained = this.protocol.flush(deferred());
            this.drained.then(()=>{
                this.protocol.subscriptions.cancel(this);
            });
        }
        return this.drained;
    }
    isDraining() {
        return this.draining;
    }
    isClosed() {
        return this.done;
    }
    getSubject() {
        return this.subject;
    }
    getMax() {
        return this.max;
    }
    getID() {
        return this.sid;
    }
}
class Subscriptions {
    mux;
    subs;
    sidCounter;
    constructor(){
        this.sidCounter = 0;
        this.subs = new Map();
    }
    size() {
        return this.subs.size;
    }
    add(s) {
        this.sidCounter++;
        s.sid = this.sidCounter;
        this.subs.set(s.sid, s);
        return s;
    }
    setMux(s) {
        this.mux = s;
        return s;
    }
    getMux() {
        return this.mux;
    }
    get(sid) {
        return this.subs.get(sid);
    }
    resub(s) {
        this.sidCounter++;
        this.subs.delete(s.sid);
        s.sid = this.sidCounter;
        this.subs.set(s.sid, s);
        return s;
    }
    all() {
        const buf = [];
        for (const s of this.subs.values()){
            buf.push(s);
        }
        return buf;
    }
    cancel(s) {
        if (s) {
            s.close();
            this.subs.delete(s.sid);
        }
    }
    handleError(err) {
        let handled = false;
        if (err) {
            const re = /^'Permissions Violation for Subscription to "(\S+)"'/i;
            const ma = re.exec(err.message);
            if (ma) {
                const subj = ma[1];
                this.subs.forEach((sub)=>{
                    if (subj == sub.subject) {
                        sub.callback(err, {});
                        sub.close();
                        handled = sub !== this.mux;
                    }
                });
            }
        }
        return handled;
    }
    close() {
        this.subs.forEach((sub)=>{
            sub.close();
        });
    }
}
class Heartbeat {
    ph;
    interval;
    maxOut;
    timer;
    pendings;
    constructor(ph, interval, maxOut){
        this.ph = ph;
        this.interval = interval;
        this.maxOut = maxOut;
        this.pendings = [];
    }
    start() {
        this.cancel();
        this._schedule();
    }
    cancel(stale) {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = undefined;
        }
        this._reset();
        if (stale) {
            this.ph.disconnect();
        }
    }
    _schedule() {
        this.timer = setTimeout(()=>{
            this.ph.dispatchStatus({
                type: DebugEvents.PingTimer,
                data: `${this.pendings.length + 1}`
            });
            if (this.pendings.length === this.maxOut) {
                this.cancel(true);
                return;
            }
            const ping = deferred();
            this.ph.flush(ping).then(()=>{
                this._reset();
            }).catch(()=>{
                this.cancel();
            });
            this.pendings.push(ping);
            this._schedule();
        }, this.interval);
    }
    _reset() {
        this.pendings = this.pendings.filter((p)=>{
            const d = p;
            d.resolve();
            return false;
        });
    }
}
class AssertionError extends Error {
    constructor(msg){
        super(msg);
        this.name = "AssertionError";
    }
}
function assert(cond, msg = "Assertion failed.") {
    if (!cond) {
        throw new AssertionError(msg);
    }
}
const MIN_READ = 32 * 1024;
const MAX_SIZE = 2 ** 32 - 2;
function copy(src, dst, off = 0) {
    const r = dst.byteLength - off;
    if (src.byteLength > r) {
        src = src.subarray(0, r);
    }
    dst.set(src, off);
    return src.byteLength;
}
class DenoBuffer {
    _buf;
    _off;
    constructor(ab){
        this._off = 0;
        if (ab == null) {
            this._buf = new Uint8Array(0);
            return;
        }
        this._buf = new Uint8Array(ab);
    }
    bytes(options = {
        copy: true
    }) {
        if (options.copy === false) return this._buf.subarray(this._off);
        return this._buf.slice(this._off);
    }
    empty() {
        return this._buf.byteLength <= this._off;
    }
    get length() {
        return this._buf.byteLength - this._off;
    }
    get capacity() {
        return this._buf.buffer.byteLength;
    }
    truncate(n) {
        if (n === 0) {
            this.reset();
            return;
        }
        if (n < 0 || n > this.length) {
            throw Error("bytes.Buffer: truncation out of range");
        }
        this._reslice(this._off + n);
    }
    reset() {
        this._reslice(0);
        this._off = 0;
    }
    _tryGrowByReslice(n) {
        const l1 = this._buf.byteLength;
        if (n <= this.capacity - l1) {
            this._reslice(l1 + n);
            return l1;
        }
        return -1;
    }
    _reslice(len) {
        assert(len <= this._buf.buffer.byteLength);
        this._buf = new Uint8Array(this._buf.buffer, 0, len);
    }
    readByte() {
        const a = new Uint8Array(1);
        if (this.read(a)) {
            return a[0];
        }
        return null;
    }
    read(p) {
        if (this.empty()) {
            this.reset();
            if (p.byteLength === 0) {
                return 0;
            }
            return null;
        }
        const nread = copy(this._buf.subarray(this._off), p);
        this._off += nread;
        return nread;
    }
    writeByte(n) {
        return this.write(Uint8Array.of(n));
    }
    writeString(s) {
        return this.write(TE.encode(s));
    }
    write(p) {
        const m = this._grow(p.byteLength);
        return copy(p, this._buf, m);
    }
    _grow(n) {
        const m = this.length;
        if (m === 0 && this._off !== 0) {
            this.reset();
        }
        const i22 = this._tryGrowByReslice(n);
        if (i22 >= 0) {
            return i22;
        }
        const c = this.capacity;
        if (n <= Math.floor(c / 2) - m) {
            copy(this._buf.subarray(this._off), this._buf);
        } else if (c + n > MAX_SIZE) {
            throw new Error("The buffer cannot be grown beyond the maximum size.");
        } else {
            const buf = new Uint8Array(Math.min(2 * c + n, MAX_SIZE));
            copy(this._buf.subarray(this._off), buf);
            this._buf = buf;
        }
        this._off = 0;
        this._reslice(Math.min(m + n, MAX_SIZE));
        return m;
    }
    grow(n) {
        if (n < 0) {
            throw Error("Buffer._grow: negative count");
        }
        const m = this._grow(n);
        this._reslice(m);
    }
    readFrom(r) {
        let n = 0;
        const tmp = new Uint8Array(MIN_READ);
        while(true){
            const shouldGrow = this.capacity - this.length < MIN_READ;
            const buf = shouldGrow ? tmp : new Uint8Array(this._buf.buffer, this.length);
            const nread = r.read(buf);
            if (nread === null) {
                return n;
            }
            if (shouldGrow) this.write(buf.subarray(0, nread));
            else this._reslice(this.length + nread);
            n += nread;
        }
    }
}
var Kind;
(function(Kind1) {
    Kind1[Kind1["OK"] = 0] = "OK";
    Kind1[Kind1["ERR"] = 1] = "ERR";
    Kind1[Kind1["MSG"] = 2] = "MSG";
    Kind1[Kind1["INFO"] = 3] = "INFO";
    Kind1[Kind1["PING"] = 4] = "PING";
    Kind1[Kind1["PONG"] = 5] = "PONG";
})(Kind || (Kind = {}));
function newMsgArg() {
    const ma = {};
    ma.sid = -1;
    ma.hdr = -1;
    ma.size = -1;
    return ma;
}
const ASCII_0 = 48;
class Parser {
    dispatcher;
    state;
    as;
    drop;
    hdr;
    ma;
    argBuf;
    msgBuf;
    constructor(dispatcher){
        this.dispatcher = dispatcher;
        this.state = State.OP_START;
        this.as = 0;
        this.drop = 0;
        this.hdr = 0;
    }
    parse(buf) {
        let i23;
        for(i23 = 0; i23 < buf.length; i23++){
            const b = buf[i23];
            switch(this.state){
                case State.OP_START:
                    switch(b){
                        case cc.M:
                        case cc.m:
                            this.state = State.OP_M;
                            this.hdr = -1;
                            this.ma = newMsgArg();
                            break;
                        case cc.H:
                        case cc.h:
                            this.state = State.OP_H;
                            this.hdr = 0;
                            this.ma = newMsgArg();
                            break;
                        case cc.P:
                        case cc.p:
                            this.state = State.OP_P;
                            break;
                        case cc.PLUS:
                            this.state = State.OP_PLUS;
                            break;
                        case cc.MINUS:
                            this.state = State.OP_MINUS;
                            break;
                        case cc.I:
                        case cc.i:
                            this.state = State.OP_I;
                            break;
                        default:
                            throw this.fail(buf.subarray(i23));
                    }
                    break;
                case State.OP_H:
                    switch(b){
                        case cc.M:
                        case cc.m:
                            this.state = State.OP_M;
                            break;
                        default:
                            throw this.fail(buf.subarray(i23));
                    }
                    break;
                case State.OP_M:
                    switch(b){
                        case cc.S:
                        case cc.s:
                            this.state = State.OP_MS;
                            break;
                        default:
                            throw this.fail(buf.subarray(i23));
                    }
                    break;
                case State.OP_MS:
                    switch(b){
                        case cc.G:
                        case cc.g:
                            this.state = State.OP_MSG;
                            break;
                        default:
                            throw this.fail(buf.subarray(i23));
                    }
                    break;
                case State.OP_MSG:
                    switch(b){
                        case cc.SPACE:
                        case cc.TAB:
                            this.state = State.OP_MSG_SPC;
                            break;
                        default:
                            throw this.fail(buf.subarray(i23));
                    }
                    break;
                case State.OP_MSG_SPC:
                    switch(b){
                        case cc.SPACE:
                        case cc.TAB:
                            continue;
                        default:
                            this.state = State.MSG_ARG;
                            this.as = i23;
                    }
                    break;
                case State.MSG_ARG:
                    switch(b){
                        case cc.CR:
                            this.drop = 1;
                            break;
                        case cc.NL:
                            {
                                const arg = this.argBuf ? this.argBuf.bytes() : buf.subarray(this.as, i23 - this.drop);
                                this.processMsgArgs(arg);
                                this.drop = 0;
                                this.as = i23 + 1;
                                this.state = State.MSG_PAYLOAD;
                                i23 = this.as + this.ma.size - 1;
                                break;
                            }
                        default:
                            if (this.argBuf) {
                                this.argBuf.writeByte(b);
                            }
                    }
                    break;
                case State.MSG_PAYLOAD:
                    if (this.msgBuf) {
                        if (this.msgBuf.length >= this.ma.size) {
                            const data = this.msgBuf.bytes({
                                copy: false
                            });
                            this.dispatcher.push({
                                kind: Kind.MSG,
                                msg: this.ma,
                                data: data
                            });
                            this.argBuf = undefined;
                            this.msgBuf = undefined;
                            this.state = State.MSG_END;
                        } else {
                            let toCopy = this.ma.size - this.msgBuf.length;
                            const avail = buf.length - i23;
                            if (avail < toCopy) {
                                toCopy = avail;
                            }
                            if (toCopy > 0) {
                                this.msgBuf.write(buf.subarray(i23, i23 + toCopy));
                                i23 = i23 + toCopy - 1;
                            } else {
                                this.msgBuf.writeByte(b);
                            }
                        }
                    } else if (i23 - this.as >= this.ma.size) {
                        this.dispatcher.push({
                            kind: Kind.MSG,
                            msg: this.ma,
                            data: buf.subarray(this.as, i23)
                        });
                        this.argBuf = undefined;
                        this.msgBuf = undefined;
                        this.state = State.MSG_END;
                    }
                    break;
                case State.MSG_END:
                    switch(b){
                        case cc.NL:
                            this.drop = 0;
                            this.as = i23 + 1;
                            this.state = State.OP_START;
                            break;
                        default:
                            continue;
                    }
                    break;
                case State.OP_PLUS:
                    switch(b){
                        case cc.O:
                        case cc.o:
                            this.state = State.OP_PLUS_O;
                            break;
                        default:
                            throw this.fail(buf.subarray(i23));
                    }
                    break;
                case State.OP_PLUS_O:
                    switch(b){
                        case cc.K:
                        case cc.k:
                            this.state = State.OP_PLUS_OK;
                            break;
                        default:
                            throw this.fail(buf.subarray(i23));
                    }
                    break;
                case State.OP_PLUS_OK:
                    switch(b){
                        case cc.NL:
                            this.dispatcher.push({
                                kind: Kind.OK
                            });
                            this.drop = 0;
                            this.state = State.OP_START;
                            break;
                    }
                    break;
                case State.OP_MINUS:
                    switch(b){
                        case cc.E:
                        case cc.e:
                            this.state = State.OP_MINUS_E;
                            break;
                        default:
                            throw this.fail(buf.subarray(i23));
                    }
                    break;
                case State.OP_MINUS_E:
                    switch(b){
                        case cc.R:
                        case cc.r:
                            this.state = State.OP_MINUS_ER;
                            break;
                        default:
                            throw this.fail(buf.subarray(i23));
                    }
                    break;
                case State.OP_MINUS_ER:
                    switch(b){
                        case cc.R:
                        case cc.r:
                            this.state = State.OP_MINUS_ERR;
                            break;
                        default:
                            throw this.fail(buf.subarray(i23));
                    }
                    break;
                case State.OP_MINUS_ERR:
                    switch(b){
                        case cc.SPACE:
                        case cc.TAB:
                            this.state = State.OP_MINUS_ERR_SPC;
                            break;
                        default:
                            throw this.fail(buf.subarray(i23));
                    }
                    break;
                case State.OP_MINUS_ERR_SPC:
                    switch(b){
                        case cc.SPACE:
                        case cc.TAB:
                            continue;
                        default:
                            this.state = State.MINUS_ERR_ARG;
                            this.as = i23;
                    }
                    break;
                case State.MINUS_ERR_ARG:
                    switch(b){
                        case cc.CR:
                            this.drop = 1;
                            break;
                        case cc.NL:
                            {
                                let arg;
                                if (this.argBuf) {
                                    arg = this.argBuf.bytes();
                                    this.argBuf = undefined;
                                } else {
                                    arg = buf.subarray(this.as, i23 - this.drop);
                                }
                                this.dispatcher.push({
                                    kind: Kind.ERR,
                                    data: arg
                                });
                                this.drop = 0;
                                this.as = i23 + 1;
                                this.state = State.OP_START;
                                break;
                            }
                        default:
                            if (this.argBuf) {
                                this.argBuf.write(Uint8Array.of(b));
                            }
                    }
                    break;
                case State.OP_P:
                    switch(b){
                        case cc.I:
                        case cc.i:
                            this.state = State.OP_PI;
                            break;
                        case cc.O:
                        case cc.o:
                            this.state = State.OP_PO;
                            break;
                        default:
                            throw this.fail(buf.subarray(i23));
                    }
                    break;
                case State.OP_PO:
                    switch(b){
                        case cc.N:
                        case cc.n:
                            this.state = State.OP_PON;
                            break;
                        default:
                            throw this.fail(buf.subarray(i23));
                    }
                    break;
                case State.OP_PON:
                    switch(b){
                        case cc.G:
                        case cc.g:
                            this.state = State.OP_PONG;
                            break;
                        default:
                            throw this.fail(buf.subarray(i23));
                    }
                    break;
                case State.OP_PONG:
                    switch(b){
                        case cc.NL:
                            this.dispatcher.push({
                                kind: Kind.PONG
                            });
                            this.drop = 0;
                            this.state = State.OP_START;
                            break;
                    }
                    break;
                case State.OP_PI:
                    switch(b){
                        case cc.N:
                        case cc.n:
                            this.state = State.OP_PIN;
                            break;
                        default:
                            throw this.fail(buf.subarray(i23));
                    }
                    break;
                case State.OP_PIN:
                    switch(b){
                        case cc.G:
                        case cc.g:
                            this.state = State.OP_PING;
                            break;
                        default:
                            throw this.fail(buf.subarray(i23));
                    }
                    break;
                case State.OP_PING:
                    switch(b){
                        case cc.NL:
                            this.dispatcher.push({
                                kind: Kind.PING
                            });
                            this.drop = 0;
                            this.state = State.OP_START;
                            break;
                    }
                    break;
                case State.OP_I:
                    switch(b){
                        case cc.N:
                        case cc.n:
                            this.state = State.OP_IN;
                            break;
                        default:
                            throw this.fail(buf.subarray(i23));
                    }
                    break;
                case State.OP_IN:
                    switch(b){
                        case cc.F:
                        case cc.f:
                            this.state = State.OP_INF;
                            break;
                        default:
                            throw this.fail(buf.subarray(i23));
                    }
                    break;
                case State.OP_INF:
                    switch(b){
                        case cc.O:
                        case cc.o:
                            this.state = State.OP_INFO;
                            break;
                        default:
                            throw this.fail(buf.subarray(i23));
                    }
                    break;
                case State.OP_INFO:
                    switch(b){
                        case cc.SPACE:
                        case cc.TAB:
                            this.state = State.OP_INFO_SPC;
                            break;
                        default:
                            throw this.fail(buf.subarray(i23));
                    }
                    break;
                case State.OP_INFO_SPC:
                    switch(b){
                        case cc.SPACE:
                        case cc.TAB:
                            continue;
                        default:
                            this.state = State.INFO_ARG;
                            this.as = i23;
                    }
                    break;
                case State.INFO_ARG:
                    switch(b){
                        case cc.CR:
                            this.drop = 1;
                            break;
                        case cc.NL:
                            {
                                let arg;
                                if (this.argBuf) {
                                    arg = this.argBuf.bytes();
                                    this.argBuf = undefined;
                                } else {
                                    arg = buf.subarray(this.as, i23 - this.drop);
                                }
                                this.dispatcher.push({
                                    kind: Kind.INFO,
                                    data: arg
                                });
                                this.drop = 0;
                                this.as = i23 + 1;
                                this.state = State.OP_START;
                                break;
                            }
                        default:
                            if (this.argBuf) {
                                this.argBuf.writeByte(b);
                            }
                    }
                    break;
                default:
                    throw this.fail(buf.subarray(i23));
            }
        }
        if ((this.state === State.MSG_ARG || this.state === State.MINUS_ERR_ARG || this.state === State.INFO_ARG) && !this.argBuf) {
            this.argBuf = new DenoBuffer(buf.subarray(this.as, i23 - this.drop));
        }
        if (this.state === State.MSG_PAYLOAD && !this.msgBuf) {
            if (!this.argBuf) {
                this.cloneMsgArg();
            }
            this.msgBuf = new DenoBuffer(buf.subarray(this.as));
        }
    }
    cloneMsgArg() {
        const s = this.ma.subject.length;
        const r = this.ma.reply ? this.ma.reply.length : 0;
        const buf = new Uint8Array(s + r);
        buf.set(this.ma.subject);
        if (this.ma.reply) {
            buf.set(this.ma.reply, s);
        }
        this.argBuf = new DenoBuffer(buf);
        this.ma.subject = buf.subarray(0, s);
        if (this.ma.reply) {
            this.ma.reply = buf.subarray(s);
        }
    }
    processMsgArgs(arg) {
        if (this.hdr >= 0) {
            return this.processHeaderMsgArgs(arg);
        }
        const args = [];
        let start = -1;
        for(let i24 = 0; i24 < arg.length; i24++){
            const b = arg[i24];
            switch(b){
                case cc.SPACE:
                case cc.TAB:
                case cc.CR:
                case cc.NL:
                    if (start >= 0) {
                        args.push(arg.subarray(start, i24));
                        start = -1;
                    }
                    break;
                default:
                    if (start < 0) {
                        start = i24;
                    }
            }
        }
        if (start >= 0) {
            args.push(arg.subarray(start));
        }
        switch(args.length){
            case 3:
                this.ma.subject = args[0];
                this.ma.sid = this.protoParseInt(args[1]);
                this.ma.reply = undefined;
                this.ma.size = this.protoParseInt(args[2]);
                break;
            case 4:
                this.ma.subject = args[0];
                this.ma.sid = this.protoParseInt(args[1]);
                this.ma.reply = args[2];
                this.ma.size = this.protoParseInt(args[3]);
                break;
            default:
                throw this.fail(arg, "processMsgArgs Parse Error");
        }
        if (this.ma.sid < 0) {
            throw this.fail(arg, "processMsgArgs Bad or Missing Sid Error");
        }
        if (this.ma.size < 0) {
            throw this.fail(arg, "processMsgArgs Bad or Missing Size Error");
        }
    }
    fail(data, label = "") {
        if (!label) {
            label = `parse error [${this.state}]`;
        } else {
            label = `${label} [${this.state}]`;
        }
        return new Error(`${label}: ${TD.decode(data)}`);
    }
    processHeaderMsgArgs(arg) {
        const args = [];
        let start = -1;
        for(let i25 = 0; i25 < arg.length; i25++){
            const b = arg[i25];
            switch(b){
                case cc.SPACE:
                case cc.TAB:
                case cc.CR:
                case cc.NL:
                    if (start >= 0) {
                        args.push(arg.subarray(start, i25));
                        start = -1;
                    }
                    break;
                default:
                    if (start < 0) {
                        start = i25;
                    }
            }
        }
        if (start >= 0) {
            args.push(arg.subarray(start));
        }
        switch(args.length){
            case 4:
                this.ma.subject = args[0];
                this.ma.sid = this.protoParseInt(args[1]);
                this.ma.reply = undefined;
                this.ma.hdr = this.protoParseInt(args[2]);
                this.ma.size = this.protoParseInt(args[3]);
                break;
            case 5:
                this.ma.subject = args[0];
                this.ma.sid = this.protoParseInt(args[1]);
                this.ma.reply = args[2];
                this.ma.hdr = this.protoParseInt(args[3]);
                this.ma.size = this.protoParseInt(args[4]);
                break;
            default:
                throw this.fail(arg, "processHeaderMsgArgs Parse Error");
        }
        if (this.ma.sid < 0) {
            throw this.fail(arg, "processHeaderMsgArgs Bad or Missing Sid Error");
        }
        if (this.ma.hdr < 0 || this.ma.hdr > this.ma.size) {
            throw this.fail(arg, "processHeaderMsgArgs Bad or Missing Header Size Error");
        }
        if (this.ma.size < 0) {
            throw this.fail(arg, "processHeaderMsgArgs Bad or Missing Size Error");
        }
    }
    protoParseInt(a) {
        if (a.length === 0) {
            return -1;
        }
        let n = 0;
        for(let i26 = 0; i26 < a.length; i26++){
            if (a[i26] < 48 || a[i26] > 57) {
                return -1;
            }
            n = n * 10 + (a[i26] - ASCII_0);
        }
        return n;
    }
}
var State;
(function(State1) {
    State1[State1["OP_START"] = 0] = "OP_START";
    State1[State1["OP_PLUS"] = 1] = "OP_PLUS";
    State1[State1["OP_PLUS_O"] = 2] = "OP_PLUS_O";
    State1[State1["OP_PLUS_OK"] = 3] = "OP_PLUS_OK";
    State1[State1["OP_MINUS"] = 4] = "OP_MINUS";
    State1[State1["OP_MINUS_E"] = 5] = "OP_MINUS_E";
    State1[State1["OP_MINUS_ER"] = 6] = "OP_MINUS_ER";
    State1[State1["OP_MINUS_ERR"] = 7] = "OP_MINUS_ERR";
    State1[State1["OP_MINUS_ERR_SPC"] = 8] = "OP_MINUS_ERR_SPC";
    State1[State1["MINUS_ERR_ARG"] = 9] = "MINUS_ERR_ARG";
    State1[State1["OP_M"] = 10] = "OP_M";
    State1[State1["OP_MS"] = 11] = "OP_MS";
    State1[State1["OP_MSG"] = 12] = "OP_MSG";
    State1[State1["OP_MSG_SPC"] = 13] = "OP_MSG_SPC";
    State1[State1["MSG_ARG"] = 14] = "MSG_ARG";
    State1[State1["MSG_PAYLOAD"] = 15] = "MSG_PAYLOAD";
    State1[State1["MSG_END"] = 16] = "MSG_END";
    State1[State1["OP_H"] = 17] = "OP_H";
    State1[State1["OP_P"] = 18] = "OP_P";
    State1[State1["OP_PI"] = 19] = "OP_PI";
    State1[State1["OP_PIN"] = 20] = "OP_PIN";
    State1[State1["OP_PING"] = 21] = "OP_PING";
    State1[State1["OP_PO"] = 22] = "OP_PO";
    State1[State1["OP_PON"] = 23] = "OP_PON";
    State1[State1["OP_PONG"] = 24] = "OP_PONG";
    State1[State1["OP_I"] = 25] = "OP_I";
    State1[State1["OP_IN"] = 26] = "OP_IN";
    State1[State1["OP_INF"] = 27] = "OP_INF";
    State1[State1["OP_INFO"] = 28] = "OP_INFO";
    State1[State1["OP_INFO_SPC"] = 29] = "OP_INFO_SPC";
    State1[State1["INFO_ARG"] = 30] = "INFO_ARG";
})(State || (State = {}));
var cc;
(function(cc1) {
    cc1[cc1["CR"] = "\r".charCodeAt(0)] = "CR";
    cc1[cc1["E"] = "E".charCodeAt(0)] = "E";
    cc1[cc1["e"] = "e".charCodeAt(0)] = "e";
    cc1[cc1["F"] = "F".charCodeAt(0)] = "F";
    cc1[cc1["f"] = "f".charCodeAt(0)] = "f";
    cc1[cc1["G"] = "G".charCodeAt(0)] = "G";
    cc1[cc1["g"] = "g".charCodeAt(0)] = "g";
    cc1[cc1["H"] = "H".charCodeAt(0)] = "H";
    cc1[cc1["h"] = "h".charCodeAt(0)] = "h";
    cc1[cc1["I"] = "I".charCodeAt(0)] = "I";
    cc1[cc1["i"] = "i".charCodeAt(0)] = "i";
    cc1[cc1["K"] = "K".charCodeAt(0)] = "K";
    cc1[cc1["k"] = "k".charCodeAt(0)] = "k";
    cc1[cc1["M"] = "M".charCodeAt(0)] = "M";
    cc1[cc1["m"] = "m".charCodeAt(0)] = "m";
    cc1[cc1["MINUS"] = "-".charCodeAt(0)] = "MINUS";
    cc1[cc1["N"] = "N".charCodeAt(0)] = "N";
    cc1[cc1["n"] = "n".charCodeAt(0)] = "n";
    cc1[cc1["NL"] = "\n".charCodeAt(0)] = "NL";
    cc1[cc1["O"] = "O".charCodeAt(0)] = "O";
    cc1[cc1["o"] = "o".charCodeAt(0)] = "o";
    cc1[cc1["P"] = "P".charCodeAt(0)] = "P";
    cc1[cc1["p"] = "p".charCodeAt(0)] = "p";
    cc1[cc1["PLUS"] = "+".charCodeAt(0)] = "PLUS";
    cc1[cc1["R"] = "R".charCodeAt(0)] = "R";
    cc1[cc1["r"] = "r".charCodeAt(0)] = "r";
    cc1[cc1["S"] = "S".charCodeAt(0)] = "S";
    cc1[cc1["s"] = "s".charCodeAt(0)] = "s";
    cc1[cc1["SPACE"] = " ".charCodeAt(0)] = "SPACE";
    cc1[cc1["TAB"] = "\t".charCodeAt(0)] = "TAB";
})(cc || (cc = {}));
const FLUSH_THRESHOLD = 1024 * 32;
const INFO = /^INFO\s+([^\r\n]+)\r\n/i;
function createInbox(prefix = "") {
    prefix = prefix || "_INBOX";
    if (typeof prefix !== "string") {
        throw new Error("prefix must be a string");
    }
    return `${prefix}.${nuid.next()}`;
}
class MuxSubscription {
    baseInbox;
    reqs;
    constructor(){
        this.reqs = new Map();
    }
    size() {
        return this.reqs.size;
    }
    init(prefix) {
        this.baseInbox = `${createInbox(prefix)}.`;
        return this.baseInbox;
    }
    add(r) {
        if (!isNaN(r.received)) {
            r.received = 0;
        }
        this.reqs.set(r.token, r);
    }
    get(token) {
        return this.reqs.get(token);
    }
    cancel(r) {
        this.reqs.delete(r.token);
    }
    getToken(m) {
        const s = m.subject || "";
        if (s.indexOf(this.baseInbox) === 0) {
            return s.substring(this.baseInbox.length);
        }
        return null;
    }
    dispatcher() {
        return (err, m)=>{
            const token = this.getToken(m);
            if (token) {
                const r = this.get(token);
                if (r) {
                    if (err === null && m.headers) {
                        err = isRequestError(m);
                    }
                    r.resolver(err, m);
                }
            }
        };
    }
    close() {
        const err = NatsError.errorForCode(ErrorCode.Timeout);
        this.reqs.forEach((req)=>{
            req.resolver(err, {});
        });
    }
}
const PONG_CMD = encode("PONG\r\n");
const PING_CMD = encode("PING\r\n");
class Connect {
    echo;
    no_responders;
    protocol;
    verbose;
    pedantic;
    jwt;
    nkey;
    sig;
    user;
    pass;
    auth_token;
    tls_required;
    name;
    lang;
    version;
    headers;
    constructor(transport, opts, nonce){
        this.protocol = 1;
        this.version = transport.version;
        this.lang = transport.lang;
        this.echo = opts.noEcho ? false : undefined;
        this.verbose = opts.verbose;
        this.pedantic = opts.pedantic;
        this.tls_required = opts.tls ? true : undefined;
        this.name = opts.name;
        const creds = (opts && opts.authenticator ? opts.authenticator(nonce) : {}) || {};
        extend(this, creds);
    }
}
class ProtocolHandler {
    connected;
    connectedOnce;
    infoReceived;
    info;
    muxSubscriptions;
    options;
    outbound;
    pongs;
    subscriptions;
    transport;
    noMorePublishing;
    connectError;
    publisher;
    _closed;
    closed;
    listeners;
    heartbeats;
    parser;
    outMsgs;
    inMsgs;
    outBytes;
    inBytes;
    pendingLimit;
    lastError;
    abortReconnect;
    servers;
    server;
    constructor(options, publisher){
        this._closed = false;
        this.connected = false;
        this.connectedOnce = false;
        this.infoReceived = false;
        this.noMorePublishing = false;
        this.abortReconnect = false;
        this.listeners = [];
        this.pendingLimit = FLUSH_THRESHOLD;
        this.outMsgs = 0;
        this.inMsgs = 0;
        this.outBytes = 0;
        this.inBytes = 0;
        this.options = options;
        this.publisher = publisher;
        this.subscriptions = new Subscriptions();
        this.muxSubscriptions = new MuxSubscription();
        this.outbound = new DataBuffer();
        this.pongs = [];
        this.pendingLimit = options.pendingLimit || this.pendingLimit;
        const servers = typeof options.servers === "string" ? [
            options.servers
        ] : options.servers;
        this.servers = new Servers(servers, {
            randomize: !options.noRandomize
        });
        this.closed = deferred();
        this.parser = new Parser(this);
        this.heartbeats = new Heartbeat(this, this.options.pingInterval || DEFAULT_PING_INTERVAL, this.options.maxPingOut || DEFAULT_MAX_PING_OUT);
    }
    resetOutbound() {
        this.outbound.reset();
        const pongs = this.pongs;
        this.pongs = [];
        pongs.forEach((p)=>{
            p.reject(NatsError.errorForCode(ErrorCode.Disconnect));
        });
        this.parser = new Parser(this);
        this.infoReceived = false;
    }
    dispatchStatus(status) {
        this.listeners.forEach((q)=>{
            q.push(status);
        });
    }
    status() {
        const iter = new QueuedIteratorImpl();
        this.listeners.push(iter);
        return iter;
    }
    prepare() {
        this.info = undefined;
        this.resetOutbound();
        const pong = deferred();
        this.pongs.unshift(pong);
        this.connectError = (err)=>{
            pong.reject(err);
        };
        this.transport = newTransport();
        this.transport.closed().then(async (_err)=>{
            this.connected = false;
            if (!this.isClosed()) {
                await this.disconnected(this.transport.closeError);
                return;
            }
        });
        return pong;
    }
    disconnect() {
        this.dispatchStatus({
            type: DebugEvents.StaleConnection,
            data: ""
        });
        this.transport.disconnect();
    }
    async disconnected(_err) {
        this.dispatchStatus({
            type: Events.Disconnect,
            data: this.servers.getCurrentServer().toString()
        });
        if (this.options.reconnect) {
            await this.dialLoop().then(()=>{
                this.dispatchStatus({
                    type: Events.Reconnect,
                    data: this.servers.getCurrentServer().toString()
                });
            }).catch((err)=>{
                this._close(err);
            });
        } else {
            await this._close();
        }
    }
    async dial(srv) {
        const pong = this.prepare();
        let timer;
        try {
            timer = timeout(this.options.timeout || 20000);
            const cp = this.transport.connect(srv, this.options);
            await Promise.race([
                cp,
                timer
            ]);
            (async ()=>{
                try {
                    for await (const b of this.transport){
                        this.parser.parse(b);
                    }
                } catch (err) {
                    console.log("reader closed", err);
                }
            })().then();
        } catch (err) {
            pong.reject(err);
        }
        try {
            await Promise.race([
                timer,
                pong
            ]);
            if (timer) {
                timer.cancel();
            }
            this.connected = true;
            this.connectError = undefined;
            this.sendSubscriptions();
            this.connectedOnce = true;
            this.server.didConnect = true;
            this.server.reconnects = 0;
            this.flushPending();
            this.heartbeats.start();
        } catch (err1) {
            if (timer) {
                timer.cancel();
            }
            await this.transport.close(err1);
            throw err1;
        }
    }
    async _doDial(srv) {
        const alts = await srv.resolve({
            fn: getResolveFn(),
            randomize: !this.options.noRandomize
        });
        let lastErr = null;
        for (const a of alts){
            try {
                lastErr = null;
                this.dispatchStatus({
                    type: DebugEvents.Reconnecting,
                    data: a.toString()
                });
                await this.dial(a);
                return;
            } catch (err) {
                lastErr = err;
            }
        }
        throw lastErr;
    }
    async dialLoop() {
        let lastError;
        while(true){
            const wait = this.options.reconnectDelayHandler ? this.options.reconnectDelayHandler() : DEFAULT_RECONNECT_TIME_WAIT;
            let maxWait = wait;
            const srv = this.selectServer();
            if (!srv || this.abortReconnect) {
                throw lastError || NatsError.errorForCode(ErrorCode.ConnectionRefused);
            }
            const now = Date.now();
            if (srv.lastConnect === 0 || srv.lastConnect + wait <= now) {
                srv.lastConnect = Date.now();
                try {
                    await this._doDial(srv);
                    break;
                } catch (err) {
                    lastError = err;
                    if (!this.connectedOnce) {
                        if (this.options.waitOnFirstConnect) {
                            continue;
                        }
                        this.servers.removeCurrentServer();
                    }
                    srv.reconnects++;
                    const mra = this.options.maxReconnectAttempts || 0;
                    if (mra !== -1 && srv.reconnects >= mra) {
                        this.servers.removeCurrentServer();
                    }
                }
            } else {
                maxWait = Math.min(maxWait, srv.lastConnect + wait - now);
                await delay(maxWait);
            }
        }
    }
    static async connect(options, publisher) {
        const h = new ProtocolHandler(options, publisher);
        await h.dialLoop();
        return h;
    }
    static toError(s) {
        const t = s ? s.toLowerCase() : "";
        if (t.indexOf("permissions violation") !== -1) {
            return new NatsError(s, ErrorCode.PermissionsViolation);
        } else if (t.indexOf("authorization violation") !== -1) {
            return new NatsError(s, ErrorCode.AuthorizationViolation);
        } else if (t.indexOf("user authentication expired") !== -1) {
            return new NatsError(s, ErrorCode.AuthenticationExpired);
        } else {
            return new NatsError(s, ErrorCode.ProtocolError);
        }
    }
    processMsg(msg, data) {
        this.inMsgs++;
        this.inBytes += data.length;
        if (!this.subscriptions.sidCounter) {
            return;
        }
        const sub = this.subscriptions.get(msg.sid);
        if (!sub) {
            return;
        }
        sub.received += 1;
        if (sub.callback) {
            sub.callback(null, new MsgImpl(msg, data, this));
        }
        if (sub.max !== undefined && sub.received >= sub.max) {
            sub.unsubscribe();
        }
    }
    async processError(m) {
        const s = decode(m);
        const err = ProtocolHandler.toError(s);
        const handled = this.subscriptions.handleError(err);
        if (!handled) {
            this.dispatchStatus({
                type: Events.Error,
                data: err.code
            });
        }
        await this.handleError(err);
    }
    async handleError(err) {
        if (err.isAuthError()) {
            this.handleAuthError(err);
        }
        if (err.isPermissionError() || err.isProtocolError()) {
            await this._close(err);
        }
        this.lastError = err;
    }
    handleAuthError(err) {
        if (this.lastError && err.code === this.lastError.code) {
            this.abortReconnect = true;
        }
        if (this.connectError) {
            this.connectError(err);
        } else {
            this.disconnect();
        }
    }
    processPing() {
        this.transport.send(PONG_CMD);
    }
    processPong() {
        const cb = this.pongs.shift();
        if (cb) {
            cb.resolve();
        }
    }
    processInfo(m) {
        const info = JSON.parse(decode(m));
        this.info = info;
        const updates = this.options && this.options.ignoreClusterUpdates ? undefined : this.servers.update(info);
        if (!this.infoReceived) {
            this.infoReceived = true;
            if (this.transport.isEncrypted()) {
                this.servers.updateTLSName();
            }
            const { version , lang  } = this.transport;
            try {
                const c = new Connect({
                    version,
                    lang
                }, this.options, info.nonce);
                if (info.headers) {
                    c.headers = true;
                    c.no_responders = true;
                }
                const cs = JSON.stringify(c);
                this.transport.send(encode(`CONNECT ${cs}${CR_LF}`));
                this.transport.send(PING_CMD);
            } catch (err) {
                this._close(NatsError.errorForCode(ErrorCode.BadAuthentication, err));
            }
        }
        if (updates) {
            this.dispatchStatus({
                type: Events.Update,
                data: updates
            });
        }
        const ldm = info.ldm !== undefined ? info.ldm : false;
        if (ldm) {
            this.dispatchStatus({
                type: Events.LDM,
                data: this.servers.getCurrentServer().toString()
            });
        }
    }
    push(e) {
        switch(e.kind){
            case Kind.MSG:
                {
                    const { msg , data  } = e;
                    this.processMsg(msg, data);
                    break;
                }
            case Kind.OK:
                break;
            case Kind.ERR:
                this.processError(e.data);
                break;
            case Kind.PING:
                this.processPing();
                break;
            case Kind.PONG:
                this.processPong();
                break;
            case Kind.INFO:
                this.processInfo(e.data);
                break;
        }
    }
    sendCommand(cmd, ...payloads) {
        const len = this.outbound.length();
        let buf;
        if (typeof cmd === "string") {
            buf = encode(cmd);
        } else {
            buf = cmd;
        }
        this.outbound.fill(buf, ...payloads);
        if (len === 0) {
            setTimeout(()=>{
                this.flushPending();
            });
        } else if (this.outbound.size() >= this.pendingLimit) {
            this.flushPending();
        }
    }
    publish(subject, data, options) {
        let len = data.length;
        options = options || {};
        options.reply = options.reply || "";
        let headers2 = Empty;
        let hlen = 0;
        if (options.headers) {
            if (this.info && !this.info.headers) {
                throw new NatsError("headers", ErrorCode.ServerOptionNotAvailable);
            }
            const hdrs = options.headers;
            headers2 = hdrs.encode();
            hlen = headers2.length;
            len = data.length + hlen;
        }
        if (this.info && len > this.info.max_payload) {
            throw NatsError.errorForCode(ErrorCode.MaxPayloadExceeded);
        }
        this.outBytes += len;
        this.outMsgs++;
        let proto;
        if (options.headers) {
            if (options.reply) {
                proto = `HPUB ${subject} ${options.reply} ${hlen} ${len}${CR_LF}`;
            } else {
                proto = `HPUB ${subject} ${hlen} ${len}\r\n`;
            }
            this.sendCommand(proto, headers2, data, CRLF);
        } else {
            if (options.reply) {
                proto = `PUB ${subject} ${options.reply} ${len}\r\n`;
            } else {
                proto = `PUB ${subject} ${len}\r\n`;
            }
            this.sendCommand(proto, data, CRLF);
        }
    }
    request(r) {
        this.initMux();
        this.muxSubscriptions.add(r);
        return r;
    }
    subscribe(s) {
        this.subscriptions.add(s);
        this._subunsub(s);
        return s;
    }
    _sub(s) {
        if (s.queue) {
            this.sendCommand(`SUB ${s.subject} ${s.queue} ${s.sid}\r\n`);
        } else {
            this.sendCommand(`SUB ${s.subject} ${s.sid}\r\n`);
        }
    }
    _subunsub(s) {
        this._sub(s);
        if (s.max) {
            this.unsubscribe(s, s.max);
        }
        return s;
    }
    unsubscribe(s, max) {
        this.unsub(s, max);
        if (s.max === undefined || s.received >= s.max) {
            this.subscriptions.cancel(s);
        }
    }
    unsub(s, max) {
        if (!s || this.isClosed()) {
            return;
        }
        if (max) {
            this.sendCommand(`UNSUB ${s.sid} ${max}${CR_LF}`);
        } else {
            this.sendCommand(`UNSUB ${s.sid}${CR_LF}`);
        }
        s.max = max;
    }
    resub(s, subject) {
        if (!s || this.isClosed()) {
            return;
        }
        s.subject = subject;
        this.subscriptions.resub(s);
        this._sub(s);
    }
    flush(p) {
        if (!p) {
            p = deferred();
        }
        this.pongs.push(p);
        this.sendCommand(PING_CMD);
        return p;
    }
    sendSubscriptions() {
        const cmds = [];
        this.subscriptions.all().forEach((s)=>{
            const sub = s;
            if (sub.queue) {
                cmds.push(`SUB ${sub.subject} ${sub.queue} ${sub.sid}${CR_LF}`);
            } else {
                cmds.push(`SUB ${sub.subject} ${sub.sid}${CR_LF}`);
            }
        });
        if (cmds.length) {
            this.transport.send(encode(cmds.join("")));
        }
    }
    async _close(err) {
        if (this._closed) {
            return;
        }
        this.heartbeats.cancel();
        if (this.connectError) {
            this.connectError(err);
            this.connectError = undefined;
        }
        this.muxSubscriptions.close();
        this.subscriptions.close();
        this.listeners.forEach((l2)=>{
            l2.stop();
        });
        this._closed = true;
        await this.transport.close(err);
        await this.closed.resolve(err);
    }
    close() {
        return this._close();
    }
    isClosed() {
        return this._closed;
    }
    drain() {
        const subs = this.subscriptions.all();
        const promises = [];
        subs.forEach((sub)=>{
            promises.push(sub.drain());
        });
        return Promise.all(promises).then(async ()=>{
            this.noMorePublishing = true;
            await this.flush();
            return this.close();
        }).catch(()=>{});
    }
    flushPending() {
        if (!this.infoReceived || !this.connected) {
            return;
        }
        if (this.outbound.size()) {
            const d = this.outbound.drain();
            this.transport.send(d);
        }
    }
    initMux() {
        const mux = this.subscriptions.getMux();
        if (!mux) {
            const inbox = this.muxSubscriptions.init(this.options.inboxPrefix);
            const sub = new SubscriptionImpl(this, `${inbox}*`);
            sub.callback = this.muxSubscriptions.dispatcher();
            this.subscriptions.setMux(sub);
            this.subscribe(sub);
        }
    }
    selectServer() {
        const server = this.servers.selectServer();
        if (server === undefined) {
            return undefined;
        }
        this.server = server;
        return this.server;
    }
    getServer() {
        return this.server;
    }
}
function consumerOpts(opts) {
    return new ConsumerOptsBuilderImpl(opts);
}
class ConsumerOptsBuilderImpl {
    config;
    ordered;
    mack;
    stream;
    callbackFn;
    max;
    qname;
    isBind;
    constructor(opts){
        this.stream = "";
        this.mack = false;
        this.ordered = false;
        this.config = defaultConsumer("", opts || {});
    }
    getOpts() {
        const o = {};
        o.config = this.config;
        o.mack = this.mack;
        o.stream = this.stream;
        o.callbackFn = this.callbackFn;
        o.max = this.max;
        o.queue = this.qname;
        o.ordered = this.ordered;
        o.config.ack_policy = o.ordered ? AckPolicy.None : o.config.ack_policy;
        o.isBind = o.isBind || false;
        return o;
    }
    description(description) {
        this.config.description = description;
    }
    deliverTo(subject) {
        this.config.deliver_subject = subject;
    }
    durable(name) {
        validateDurableName(name);
        this.config.durable_name = name;
    }
    startSequence(seq) {
        if (seq <= 0) {
            throw new Error("sequence must be greater than 0");
        }
        this.config.deliver_policy = DeliverPolicy.StartSequence;
        this.config.opt_start_seq = seq;
    }
    startTime(time) {
        this.config.deliver_policy = DeliverPolicy.StartTime;
        this.config.opt_start_time = time.toISOString();
    }
    deliverAll() {
        this.config.deliver_policy = DeliverPolicy.All;
    }
    deliverLastPerSubject() {
        this.config.deliver_policy = DeliverPolicy.LastPerSubject;
    }
    deliverLast() {
        this.config.deliver_policy = DeliverPolicy.Last;
    }
    deliverNew() {
        this.config.deliver_policy = DeliverPolicy.New;
    }
    startAtTimeDelta(millis2) {
        this.startTime(new Date(Date.now() - millis2));
    }
    headersOnly() {
        this.config.headers_only = true;
    }
    ackNone() {
        this.config.ack_policy = AckPolicy.None;
    }
    ackAll() {
        this.config.ack_policy = AckPolicy.All;
    }
    ackExplicit() {
        this.config.ack_policy = AckPolicy.Explicit;
    }
    ackWait(millis3) {
        this.config.ack_wait = nanos(millis3);
    }
    maxDeliver(max) {
        this.config.max_deliver = max;
    }
    filterSubject(s) {
        this.config.filter_subject = s;
    }
    replayInstantly() {
        this.config.replay_policy = ReplayPolicy.Instant;
    }
    replayOriginal() {
        this.config.replay_policy = ReplayPolicy.Original;
    }
    sample(n) {
        n = Math.trunc(n);
        if (n < 0 || n > 100) {
            throw new Error(`value must be between 0-100`);
        }
        this.config.sample_freq = `${n}%`;
    }
    limit(n) {
        this.config.rate_limit_bps = n;
    }
    maxWaiting(max) {
        this.config.max_waiting = max;
    }
    maxAckPending(max) {
        this.config.max_ack_pending = max;
    }
    idleHeartbeat(millis4) {
        this.config.idle_heartbeat = nanos(millis4);
    }
    flowControl() {
        this.config.flow_control = true;
    }
    deliverGroup(name) {
        this.queue(name);
    }
    manualAck() {
        this.mack = true;
    }
    maxMessages(max) {
        this.max = max;
    }
    callback(fn) {
        this.callbackFn = fn;
    }
    queue(n) {
        this.qname = n;
        this.config.deliver_group = n;
    }
    orderedConsumer() {
        this.ordered = true;
    }
    bind(stream, durable) {
        this.stream = stream;
        this.config.durable_name = durable;
        this.isBind = true;
    }
    inactiveEphemeralThreshold(millis5) {
        this.config.inactive_threshold = nanos(millis5);
    }
    maxPullBatch(n) {
        this.config.max_batch = n;
    }
    maxPullRequestExpires(millis6) {
        this.config.max_expires = nanos(millis6);
    }
}
function isConsumerOptsBuilder(o) {
    return typeof o.getOpts === "function";
}
function ByteArray(n) {
    return new Uint8Array(n);
}
function WordArray(n) {
    return new Uint32Array(n);
}
function IntArray(n) {
    return new Int32Array(n);
}
function NumArray(n) {
    return new Float64Array(n);
}
function getLengths(b64) {
    const len = b64.length;
    let validLen = b64.indexOf("=");
    if (validLen === -1) {
        validLen = len;
    }
    const placeHoldersLen = validLen === len ? 0 : 4 - validLen % 4;
    return [
        validLen,
        placeHoldersLen
    ];
}
function init(lookup1, revLookup1, urlsafe = false) {
    function _byteLength(validLen, placeHoldersLen) {
        return Math.floor((validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen);
    }
    function tripletToBase64(num) {
        return lookup1[num >> 18 & 63] + lookup1[num >> 12 & 63] + lookup1[num >> 6 & 63] + lookup1[num & 63];
    }
    function encodeChunk(buf, start, end) {
        const out = new Array((end - start) / 3);
        for(let i27 = start, curTriplet = 0; i27 < end; i27 += 3){
            out[curTriplet++] = tripletToBase64((buf[i27] << 16) + (buf[i27 + 1] << 8) + buf[i27 + 2]);
        }
        return out.join("");
    }
    return {
        byteLength (b64) {
            return _byteLength.apply(null, getLengths(b64));
        },
        toUint8Array (b64) {
            const [validLen, placeHoldersLen] = getLengths(b64);
            const buf = new Uint8Array(_byteLength(validLen, placeHoldersLen));
            const len = placeHoldersLen ? validLen - 4 : validLen;
            let tmp;
            let curByte = 0;
            let i28;
            for(i28 = 0; i28 < len; i28 += 4){
                tmp = revLookup1[b64.charCodeAt(i28)] << 18 | revLookup1[b64.charCodeAt(i28 + 1)] << 12 | revLookup1[b64.charCodeAt(i28 + 2)] << 6 | revLookup1[b64.charCodeAt(i28 + 3)];
                buf[curByte++] = tmp >> 16 & 255;
                buf[curByte++] = tmp >> 8 & 255;
                buf[curByte++] = tmp & 255;
            }
            if (placeHoldersLen === 2) {
                tmp = revLookup1[b64.charCodeAt(i28)] << 2 | revLookup1[b64.charCodeAt(i28 + 1)] >> 4;
                buf[curByte++] = tmp & 255;
            } else if (placeHoldersLen === 1) {
                tmp = revLookup1[b64.charCodeAt(i28)] << 10 | revLookup1[b64.charCodeAt(i28 + 1)] << 4 | revLookup1[b64.charCodeAt(i28 + 2)] >> 2;
                buf[curByte++] = tmp >> 8 & 255;
                buf[curByte++] = tmp & 255;
            }
            return buf;
        },
        fromUint8Array (buf) {
            const maxChunkLength = 16383;
            const len = buf.length;
            const extraBytes = len % 3;
            const len2 = len - extraBytes;
            const parts = new Array(Math.ceil(len2 / 16383) + (extraBytes ? 1 : 0));
            let curChunk = 0;
            let chunkEnd;
            for(let i29 = 0; i29 < len2; i29 += maxChunkLength){
                chunkEnd = i29 + maxChunkLength;
                parts[curChunk++] = encodeChunk(buf, i29, chunkEnd > len2 ? len2 : chunkEnd);
            }
            let tmp;
            if (extraBytes === 1) {
                tmp = buf[len2];
                parts[curChunk] = lookup1[tmp >> 2] + lookup1[tmp << 4 & 63];
                if (!urlsafe) parts[curChunk] += "==";
            } else if (extraBytes === 2) {
                tmp = buf[len2] << 8 | buf[len2 + 1] & 255;
                parts[curChunk] = lookup1[tmp >> 10] + lookup1[tmp >> 4 & 63] + lookup1[tmp << 2 & 63];
                if (!urlsafe) parts[curChunk] += "=";
            }
            return parts.join("");
        }
    };
}
const lookup = [];
const revLookup = [];
const code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
for(let i = 0, l = code.length; i < l; ++i){
    lookup[i] = code[i];
    revLookup[code.charCodeAt(i)] = i;
}
revLookup["-".charCodeAt(0)] = 62;
revLookup["_".charCodeAt(0)] = 63;
const { byteLength , toUint8Array , fromUint8Array  } = init(lookup, revLookup);
new TextEncoder().encode("0123456789abcdef");
new TextEncoder();
new TextDecoder();
function gf(init1) {
    const r = NumArray(16);
    if (init1) for(let i30 = 0; i30 < init1.length; i30++)r[i30] = init1[i30];
    return r;
}
ByteArray(16);
const _9 = ByteArray(32);
_9[0] = 9;
const gf0 = gf();
const gf1 = gf([
    1
]);
gf([
    56129,
    1
]);
const D = gf([
    30883,
    4953,
    19914,
    30187,
    55467,
    16705,
    2637,
    112,
    59544,
    30585,
    16505,
    36039,
    65139,
    11119,
    27886,
    20995
]);
const D2 = gf([
    61785,
    9906,
    39828,
    60374,
    45398,
    33411,
    5274,
    224,
    53552,
    61171,
    33010,
    6542,
    64743,
    22239,
    55772,
    9222
]);
const X = gf([
    54554,
    36645,
    11616,
    51542,
    42930,
    38181,
    51040,
    26924,
    56412,
    64982,
    57905,
    49316,
    21502,
    52590,
    14035,
    8553
]);
const Y = gf([
    26200,
    26214,
    26214,
    26214,
    26214,
    26214,
    26214,
    26214,
    26214,
    26214,
    26214,
    26214,
    26214,
    26214,
    26214,
    26214
]);
const I = gf([
    41136,
    18958,
    6951,
    50414,
    58488,
    44335,
    6150,
    12099,
    55207,
    15867,
    153,
    11085,
    57099,
    20417,
    9344,
    11139
]);
function A(o, a, b) {
    for(let i31 = 0; i31 < 16; i31++)o[i31] = a[i31] + b[i31];
}
function Z(o, a, b) {
    for(let i32 = 0; i32 < 16; i32++)o[i32] = a[i32] - b[i32];
}
function M(o, a, b) {
    let v, c, t0 = 0, t1 = 0, t2 = 0, t3 = 0, t4 = 0, t5 = 0, t6 = 0, t7 = 0, t8 = 0, t9 = 0, t10 = 0, t11 = 0, t12 = 0, t13 = 0, t14 = 0, t15 = 0, t16 = 0, t17 = 0, t18 = 0, t19 = 0, t20 = 0, t21 = 0, t22 = 0, t23 = 0, t24 = 0, t25 = 0, t26 = 0, t27 = 0, t28 = 0, t29 = 0, t30 = 0, b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3], b4 = b[4], b5 = b[5], b6 = b[6], b7 = b[7], b8 = b[8], b9 = b[9], b10 = b[10], b11 = b[11], b12 = b[12], b13 = b[13], b14 = b[14], b15 = b[15];
    v = a[0];
    t0 += v * b0;
    t1 += v * b1;
    t2 += v * b2;
    t3 += v * b3;
    t4 += v * b4;
    t5 += v * b5;
    t6 += v * b6;
    t7 += v * b7;
    t8 += v * b8;
    t9 += v * b9;
    t10 += v * b10;
    t11 += v * b11;
    t12 += v * b12;
    t13 += v * b13;
    t14 += v * b14;
    t15 += v * b15;
    v = a[1];
    t1 += v * b0;
    t2 += v * b1;
    t3 += v * b2;
    t4 += v * b3;
    t5 += v * b4;
    t6 += v * b5;
    t7 += v * b6;
    t8 += v * b7;
    t9 += v * b8;
    t10 += v * b9;
    t11 += v * b10;
    t12 += v * b11;
    t13 += v * b12;
    t14 += v * b13;
    t15 += v * b14;
    t16 += v * b15;
    v = a[2];
    t2 += v * b0;
    t3 += v * b1;
    t4 += v * b2;
    t5 += v * b3;
    t6 += v * b4;
    t7 += v * b5;
    t8 += v * b6;
    t9 += v * b7;
    t10 += v * b8;
    t11 += v * b9;
    t12 += v * b10;
    t13 += v * b11;
    t14 += v * b12;
    t15 += v * b13;
    t16 += v * b14;
    t17 += v * b15;
    v = a[3];
    t3 += v * b0;
    t4 += v * b1;
    t5 += v * b2;
    t6 += v * b3;
    t7 += v * b4;
    t8 += v * b5;
    t9 += v * b6;
    t10 += v * b7;
    t11 += v * b8;
    t12 += v * b9;
    t13 += v * b10;
    t14 += v * b11;
    t15 += v * b12;
    t16 += v * b13;
    t17 += v * b14;
    t18 += v * b15;
    v = a[4];
    t4 += v * b0;
    t5 += v * b1;
    t6 += v * b2;
    t7 += v * b3;
    t8 += v * b4;
    t9 += v * b5;
    t10 += v * b6;
    t11 += v * b7;
    t12 += v * b8;
    t13 += v * b9;
    t14 += v * b10;
    t15 += v * b11;
    t16 += v * b12;
    t17 += v * b13;
    t18 += v * b14;
    t19 += v * b15;
    v = a[5];
    t5 += v * b0;
    t6 += v * b1;
    t7 += v * b2;
    t8 += v * b3;
    t9 += v * b4;
    t10 += v * b5;
    t11 += v * b6;
    t12 += v * b7;
    t13 += v * b8;
    t14 += v * b9;
    t15 += v * b10;
    t16 += v * b11;
    t17 += v * b12;
    t18 += v * b13;
    t19 += v * b14;
    t20 += v * b15;
    v = a[6];
    t6 += v * b0;
    t7 += v * b1;
    t8 += v * b2;
    t9 += v * b3;
    t10 += v * b4;
    t11 += v * b5;
    t12 += v * b6;
    t13 += v * b7;
    t14 += v * b8;
    t15 += v * b9;
    t16 += v * b10;
    t17 += v * b11;
    t18 += v * b12;
    t19 += v * b13;
    t20 += v * b14;
    t21 += v * b15;
    v = a[7];
    t7 += v * b0;
    t8 += v * b1;
    t9 += v * b2;
    t10 += v * b3;
    t11 += v * b4;
    t12 += v * b5;
    t13 += v * b6;
    t14 += v * b7;
    t15 += v * b8;
    t16 += v * b9;
    t17 += v * b10;
    t18 += v * b11;
    t19 += v * b12;
    t20 += v * b13;
    t21 += v * b14;
    t22 += v * b15;
    v = a[8];
    t8 += v * b0;
    t9 += v * b1;
    t10 += v * b2;
    t11 += v * b3;
    t12 += v * b4;
    t13 += v * b5;
    t14 += v * b6;
    t15 += v * b7;
    t16 += v * b8;
    t17 += v * b9;
    t18 += v * b10;
    t19 += v * b11;
    t20 += v * b12;
    t21 += v * b13;
    t22 += v * b14;
    t23 += v * b15;
    v = a[9];
    t9 += v * b0;
    t10 += v * b1;
    t11 += v * b2;
    t12 += v * b3;
    t13 += v * b4;
    t14 += v * b5;
    t15 += v * b6;
    t16 += v * b7;
    t17 += v * b8;
    t18 += v * b9;
    t19 += v * b10;
    t20 += v * b11;
    t21 += v * b12;
    t22 += v * b13;
    t23 += v * b14;
    t24 += v * b15;
    v = a[10];
    t10 += v * b0;
    t11 += v * b1;
    t12 += v * b2;
    t13 += v * b3;
    t14 += v * b4;
    t15 += v * b5;
    t16 += v * b6;
    t17 += v * b7;
    t18 += v * b8;
    t19 += v * b9;
    t20 += v * b10;
    t21 += v * b11;
    t22 += v * b12;
    t23 += v * b13;
    t24 += v * b14;
    t25 += v * b15;
    v = a[11];
    t11 += v * b0;
    t12 += v * b1;
    t13 += v * b2;
    t14 += v * b3;
    t15 += v * b4;
    t16 += v * b5;
    t17 += v * b6;
    t18 += v * b7;
    t19 += v * b8;
    t20 += v * b9;
    t21 += v * b10;
    t22 += v * b11;
    t23 += v * b12;
    t24 += v * b13;
    t25 += v * b14;
    t26 += v * b15;
    v = a[12];
    t12 += v * b0;
    t13 += v * b1;
    t14 += v * b2;
    t15 += v * b3;
    t16 += v * b4;
    t17 += v * b5;
    t18 += v * b6;
    t19 += v * b7;
    t20 += v * b8;
    t21 += v * b9;
    t22 += v * b10;
    t23 += v * b11;
    t24 += v * b12;
    t25 += v * b13;
    t26 += v * b14;
    t27 += v * b15;
    v = a[13];
    t13 += v * b0;
    t14 += v * b1;
    t15 += v * b2;
    t16 += v * b3;
    t17 += v * b4;
    t18 += v * b5;
    t19 += v * b6;
    t20 += v * b7;
    t21 += v * b8;
    t22 += v * b9;
    t23 += v * b10;
    t24 += v * b11;
    t25 += v * b12;
    t26 += v * b13;
    t27 += v * b14;
    t28 += v * b15;
    v = a[14];
    t14 += v * b0;
    t15 += v * b1;
    t16 += v * b2;
    t17 += v * b3;
    t18 += v * b4;
    t19 += v * b5;
    t20 += v * b6;
    t21 += v * b7;
    t22 += v * b8;
    t23 += v * b9;
    t24 += v * b10;
    t25 += v * b11;
    t26 += v * b12;
    t27 += v * b13;
    t28 += v * b14;
    t29 += v * b15;
    v = a[15];
    t15 += v * b0;
    t16 += v * b1;
    t17 += v * b2;
    t18 += v * b3;
    t19 += v * b4;
    t20 += v * b5;
    t21 += v * b6;
    t22 += v * b7;
    t23 += v * b8;
    t24 += v * b9;
    t25 += v * b10;
    t26 += v * b11;
    t27 += v * b12;
    t28 += v * b13;
    t29 += v * b14;
    t30 += v * b15;
    t0 += 38 * t16;
    t1 += 38 * t17;
    t2 += 38 * t18;
    t3 += 38 * t19;
    t4 += 38 * t20;
    t5 += 38 * t21;
    t6 += 38 * t22;
    t7 += 38 * t23;
    t8 += 38 * t24;
    t9 += 38 * t25;
    t10 += 38 * t26;
    t11 += 38 * t27;
    t12 += 38 * t28;
    t13 += 38 * t29;
    t14 += 38 * t30;
    c = 1;
    v = t0 + c + 65535;
    c = Math.floor(v / 65536);
    t0 = v - c * 65536;
    v = t1 + c + 65535;
    c = Math.floor(v / 65536);
    t1 = v - c * 65536;
    v = t2 + c + 65535;
    c = Math.floor(v / 65536);
    t2 = v - c * 65536;
    v = t3 + c + 65535;
    c = Math.floor(v / 65536);
    t3 = v - c * 65536;
    v = t4 + c + 65535;
    c = Math.floor(v / 65536);
    t4 = v - c * 65536;
    v = t5 + c + 65535;
    c = Math.floor(v / 65536);
    t5 = v - c * 65536;
    v = t6 + c + 65535;
    c = Math.floor(v / 65536);
    t6 = v - c * 65536;
    v = t7 + c + 65535;
    c = Math.floor(v / 65536);
    t7 = v - c * 65536;
    v = t8 + c + 65535;
    c = Math.floor(v / 65536);
    t8 = v - c * 65536;
    v = t9 + c + 65535;
    c = Math.floor(v / 65536);
    t9 = v - c * 65536;
    v = t10 + c + 65535;
    c = Math.floor(v / 65536);
    t10 = v - c * 65536;
    v = t11 + c + 65535;
    c = Math.floor(v / 65536);
    t11 = v - c * 65536;
    v = t12 + c + 65535;
    c = Math.floor(v / 65536);
    t12 = v - c * 65536;
    v = t13 + c + 65535;
    c = Math.floor(v / 65536);
    t13 = v - c * 65536;
    v = t14 + c + 65535;
    c = Math.floor(v / 65536);
    t14 = v - c * 65536;
    v = t15 + c + 65535;
    c = Math.floor(v / 65536);
    t15 = v - c * 65536;
    t0 += c - 1 + 37 * (c - 1);
    c = 1;
    v = t0 + c + 65535;
    c = Math.floor(v / 65536);
    t0 = v - c * 65536;
    v = t1 + c + 65535;
    c = Math.floor(v / 65536);
    t1 = v - c * 65536;
    v = t2 + c + 65535;
    c = Math.floor(v / 65536);
    t2 = v - c * 65536;
    v = t3 + c + 65535;
    c = Math.floor(v / 65536);
    t3 = v - c * 65536;
    v = t4 + c + 65535;
    c = Math.floor(v / 65536);
    t4 = v - c * 65536;
    v = t5 + c + 65535;
    c = Math.floor(v / 65536);
    t5 = v - c * 65536;
    v = t6 + c + 65535;
    c = Math.floor(v / 65536);
    t6 = v - c * 65536;
    v = t7 + c + 65535;
    c = Math.floor(v / 65536);
    t7 = v - c * 65536;
    v = t8 + c + 65535;
    c = Math.floor(v / 65536);
    t8 = v - c * 65536;
    v = t9 + c + 65535;
    c = Math.floor(v / 65536);
    t9 = v - c * 65536;
    v = t10 + c + 65535;
    c = Math.floor(v / 65536);
    t10 = v - c * 65536;
    v = t11 + c + 65535;
    c = Math.floor(v / 65536);
    t11 = v - c * 65536;
    v = t12 + c + 65535;
    c = Math.floor(v / 65536);
    t12 = v - c * 65536;
    v = t13 + c + 65535;
    c = Math.floor(v / 65536);
    t13 = v - c * 65536;
    v = t14 + c + 65535;
    c = Math.floor(v / 65536);
    t14 = v - c * 65536;
    v = t15 + c + 65535;
    c = Math.floor(v / 65536);
    t15 = v - c * 65536;
    t0 += c - 1 + 37 * (c - 1);
    o[0] = t0;
    o[1] = t1;
    o[2] = t2;
    o[3] = t3;
    o[4] = t4;
    o[5] = t5;
    o[6] = t6;
    o[7] = t7;
    o[8] = t8;
    o[9] = t9;
    o[10] = t10;
    o[11] = t11;
    o[12] = t12;
    o[13] = t13;
    o[14] = t14;
    o[15] = t15;
}
function S(o, a) {
    M(o, a, a);
}
function randomBytes(n) {
    let b = ByteArray(n);
    window.crypto.getRandomValues(b);
    return b;
}
ByteArray([
    101,
    120,
    112,
    97,
    110,
    100,
    32,
    51,
    50,
    45,
    98,
    121,
    116,
    101,
    32,
    107
]);
function vn(x, xi, y, yi, n) {
    let i33, d = 0;
    for(i33 = 0; i33 < n; i33++)d |= x[xi + i33] ^ y[yi + i33];
    return (1 & d - 1 >>> 8) - 1;
}
var SecretBoxLength;
(function(SecretBoxLength1) {
    SecretBoxLength1[SecretBoxLength1["Key"] = 32] = "Key";
    SecretBoxLength1[SecretBoxLength1["Nonce"] = 24] = "Nonce";
    SecretBoxLength1[SecretBoxLength1["Overhead"] = 16] = "Overhead";
    SecretBoxLength1[SecretBoxLength1["Zero"] = 32] = "Zero";
})(SecretBoxLength || (SecretBoxLength = {}));
var BoxLength;
var ScalarLength;
function set25519(r, a) {
    for(let i34 = 0; i34 < 16; i34++)r[i34] = a[i34] | 0;
}
function _verify_32(x, xi, y, yi) {
    return vn(x, xi, y, yi, 32);
}
(function(BoxLength1) {
    BoxLength1[BoxLength1["PublicKey"] = 32] = "PublicKey";
    BoxLength1[BoxLength1["SecretKey"] = 32] = "SecretKey";
    BoxLength1[BoxLength1["SharedKey"] = 32] = "SharedKey";
    BoxLength1[BoxLength1["Nonce"] = SecretBoxLength.Nonce] = "Nonce";
    BoxLength1[BoxLength1["Overhead"] = SecretBoxLength.Overhead] = "Overhead";
})(BoxLength || (BoxLength = {}));
function checkArrayTypes(...arrays) {
    for (const array of arrays){
        if (!(array instanceof Uint8Array)) {
            throw new TypeError('unexpected type, use ByteArray');
        }
    }
}
(function(ScalarLength1) {
    ScalarLength1[ScalarLength1["Scalar"] = 32] = "Scalar";
    ScalarLength1[ScalarLength1["GroupElement"] = 32] = "GroupElement";
})(ScalarLength || (ScalarLength = {}));
function car25519(o) {
    let i35, v, c = 1;
    for(i35 = 0; i35 < 16; i35++){
        v = o[i35] + c + 65535;
        c = Math.floor(v / 65536);
        o[i35] = v - c * 65536;
    }
    o[0] += c - 1 + 37 * (c - 1);
}
function sel25519(p, q, b) {
    let t, c = ~(b - 1);
    for(let i36 = 0; i36 < 16; i36++){
        t = c & (p[i36] ^ q[i36]);
        p[i36] ^= t;
        q[i36] ^= t;
    }
}
function pack25519(o, n) {
    const m = gf(), t = gf();
    let i37, j, b;
    for(i37 = 0; i37 < 16; i37++)t[i37] = n[i37];
    car25519(t);
    car25519(t);
    car25519(t);
    for(j = 0; j < 2; j++){
        m[0] = t[0] - 65517;
        for(i37 = 1; i37 < 15; i37++){
            m[i37] = t[i37] - 65535 - (m[i37 - 1] >> 16 & 1);
            m[i37 - 1] &= 65535;
        }
        m[15] = t[15] - 32767 - (m[14] >> 16 & 1);
        b = m[15] >> 16 & 1;
        m[14] &= 65535;
        sel25519(t, m, 1 - b);
    }
    for(i37 = 0; i37 < 16; i37++){
        o[2 * i37] = t[i37] & 255;
        o[2 * i37 + 1] = t[i37] >> 8;
    }
}
function neq25519(a, b) {
    const c = ByteArray(32), d = ByteArray(32);
    pack25519(c, a);
    pack25519(d, b);
    return _verify_32(c, 0, d, 0);
}
function par25519(a) {
    const d = ByteArray(32);
    pack25519(d, a);
    return d[0] & 1;
}
function unpack25519(o, n) {
    for(let i38 = 0; i38 < 16; i38++)o[i38] = n[2 * i38] + (n[2 * i38 + 1] << 8);
    o[15] &= 32767;
}
function inv25519(o, i39) {
    const c = gf();
    let a;
    for(a = 0; a < 16; a++)c[a] = i39[a];
    for(a = 253; a >= 0; a--){
        S(c, c);
        if (a !== 2 && a !== 4) M(c, c, i39);
    }
    for(a = 0; a < 16; a++)o[a] = c[a];
}
var HashLength;
(function(HashLength1) {
    HashLength1[HashLength1["Hash"] = 64] = "Hash";
})(HashLength || (HashLength = {}));
function _hash(out, m, n) {
    const hh = IntArray(8), hl = IntArray(8), x = ByteArray(256);
    let i40, b = n;
    hh[0] = 1779033703;
    hh[1] = 3144134277;
    hh[2] = 1013904242;
    hh[3] = 2773480762;
    hh[4] = 1359893119;
    hh[5] = 2600822924;
    hh[6] = 528734635;
    hh[7] = 1541459225;
    hl[0] = 4089235720;
    hl[1] = 2227873595;
    hl[2] = 4271175723;
    hl[3] = 1595750129;
    hl[4] = 2917565137;
    hl[5] = 725511199;
    hl[6] = 4215389547;
    hl[7] = 327033209;
    _hashblocks_hl(hh, hl, m, n);
    n %= 128;
    for(i40 = 0; i40 < n; i40++)x[i40] = m[b - n + i40];
    x[n] = 128;
    n = 256 - 128 * (n < 112 ? 1 : 0);
    x[n - 9] = 0;
    _ts64(x, n - 8, b / 536870912 | 0, b << 3);
    _hashblocks_hl(hh, hl, x, n);
    for(i40 = 0; i40 < 8; i40++)_ts64(out, 8 * i40, hh[i40], hl[i40]);
    return 0;
}
const _K = [
    1116352408,
    3609767458,
    1899447441,
    602891725,
    3049323471,
    3964484399,
    3921009573,
    2173295548,
    961987163,
    4081628472,
    1508970993,
    3053834265,
    2453635748,
    2937671579,
    2870763221,
    3664609560,
    3624381080,
    2734883394,
    310598401,
    1164996542,
    607225278,
    1323610764,
    1426881987,
    3590304994,
    1925078388,
    4068182383,
    2162078206,
    991336113,
    2614888103,
    633803317,
    3248222580,
    3479774868,
    3835390401,
    2666613458,
    4022224774,
    944711139,
    264347078,
    2341262773,
    604807628,
    2007800933,
    770255983,
    1495990901,
    1249150122,
    1856431235,
    1555081692,
    3175218132,
    1996064986,
    2198950837,
    2554220882,
    3999719339,
    2821834349,
    766784016,
    2952996808,
    2566594879,
    3210313671,
    3203337956,
    3336571891,
    1034457026,
    3584528711,
    2466948901,
    113926993,
    3758326383,
    338241895,
    168717936,
    666307205,
    1188179964,
    773529912,
    1546045734,
    1294757372,
    1522805485,
    1396182291,
    2643833823,
    1695183700,
    2343527390,
    1986661051,
    1014477480,
    2177026350,
    1206759142,
    2456956037,
    344077627,
    2730485921,
    1290863460,
    2820302411,
    3158454273,
    3259730800,
    3505952657,
    3345764771,
    106217008,
    3516065817,
    3606008344,
    3600352804,
    1432725776,
    4094571909,
    1467031594,
    275423344,
    851169720,
    430227734,
    3100823752,
    506948616,
    1363258195,
    659060556,
    3750685593,
    883997877,
    3785050280,
    958139571,
    3318307427,
    1322822218,
    3812723403,
    1537002063,
    2003034995,
    1747873779,
    3602036899,
    1955562222,
    1575990012,
    2024104815,
    1125592928,
    2227730452,
    2716904306,
    2361852424,
    442776044,
    2428436474,
    593698344,
    2756734187,
    3733110249,
    3204031479,
    2999351573,
    3329325298,
    3815920427,
    3391569614,
    3928383900,
    3515267271,
    566280711,
    3940187606,
    3454069534,
    4118630271,
    4000239992,
    116418474,
    1914138554,
    174292421,
    2731055270,
    289380356,
    3203993006,
    460393269,
    320620315,
    685471733,
    587496836,
    852142971,
    1086792851,
    1017036298,
    365543100,
    1126000580,
    2618297676,
    1288033470,
    3409855158,
    1501505948,
    4234509866,
    1607167915,
    987167468,
    1816402316,
    1246189591
];
function _hashblocks_hl(hh, hl, m, n) {
    const wh = IntArray(16), wl = IntArray(16);
    let bh0, bh1, bh2, bh3, bh4, bh5, bh6, bh7, bl0, bl1, bl2, bl3, bl4, bl5, bl6, bl7, th, tl, i41, j, h, l3, a, b, c, d;
    let ah0 = hh[0], ah1 = hh[1], ah2 = hh[2], ah3 = hh[3], ah4 = hh[4], ah5 = hh[5], ah6 = hh[6], ah7 = hh[7], al0 = hl[0], al1 = hl[1], al2 = hl[2], al3 = hl[3], al4 = hl[4], al5 = hl[5], al6 = hl[6], al7 = hl[7];
    let pos = 0;
    while(n >= 128){
        for(i41 = 0; i41 < 16; i41++){
            j = 8 * i41 + pos;
            wh[i41] = m[j + 0] << 24 | m[j + 1] << 16 | m[j + 2] << 8 | m[j + 3];
            wl[i41] = m[j + 4] << 24 | m[j + 5] << 16 | m[j + 6] << 8 | m[j + 7];
        }
        for(i41 = 0; i41 < 80; i41++){
            bh0 = ah0;
            bh1 = ah1;
            bh2 = ah2;
            bh3 = ah3;
            bh4 = ah4;
            bh5 = ah5;
            bh6 = ah6;
            bh7 = ah7;
            bl0 = al0;
            bl1 = al1;
            bl2 = al2;
            bl3 = al3;
            bl4 = al4;
            bl5 = al5;
            bl6 = al6;
            bl7 = al7;
            h = ah7;
            l3 = al7;
            a = l3 & 65535;
            b = l3 >>> 16;
            c = h & 65535;
            d = h >>> 16;
            h = (ah4 >>> 14 | al4 << 32 - 14) ^ (ah4 >>> 18 | al4 << 32 - 18) ^ (al4 >>> 41 - 32 | ah4 << 32 - (41 - 32));
            l3 = (al4 >>> 14 | ah4 << 32 - 14) ^ (al4 >>> 18 | ah4 << 32 - 18) ^ (ah4 >>> 41 - 32 | al4 << 32 - (41 - 32));
            a += l3 & 65535;
            b += l3 >>> 16;
            c += h & 65535;
            d += h >>> 16;
            h = ah4 & ah5 ^ ~ah4 & ah6;
            l3 = al4 & al5 ^ ~al4 & al6;
            a += l3 & 65535;
            b += l3 >>> 16;
            c += h & 65535;
            d += h >>> 16;
            h = _K[i41 * 2];
            l3 = _K[i41 * 2 + 1];
            a += l3 & 65535;
            b += l3 >>> 16;
            c += h & 65535;
            d += h >>> 16;
            h = wh[i41 % 16];
            l3 = wl[i41 % 16];
            a += l3 & 65535;
            b += l3 >>> 16;
            c += h & 65535;
            d += h >>> 16;
            b += a >>> 16;
            c += b >>> 16;
            d += c >>> 16;
            th = c & 65535 | d << 16;
            tl = a & 65535 | b << 16;
            h = th;
            l3 = tl;
            a = l3 & 65535;
            b = l3 >>> 16;
            c = h & 65535;
            d = h >>> 16;
            h = (ah0 >>> 28 | al0 << 32 - 28) ^ (al0 >>> 34 - 32 | ah0 << 32 - (34 - 32)) ^ (al0 >>> 39 - 32 | ah0 << 32 - (39 - 32));
            l3 = (al0 >>> 28 | ah0 << 32 - 28) ^ (ah0 >>> 34 - 32 | al0 << 32 - (34 - 32)) ^ (ah0 >>> 39 - 32 | al0 << 32 - (39 - 32));
            a += l3 & 65535;
            b += l3 >>> 16;
            c += h & 65535;
            d += h >>> 16;
            h = ah0 & ah1 ^ ah0 & ah2 ^ ah1 & ah2;
            l3 = al0 & al1 ^ al0 & al2 ^ al1 & al2;
            a += l3 & 65535;
            b += l3 >>> 16;
            c += h & 65535;
            d += h >>> 16;
            b += a >>> 16;
            c += b >>> 16;
            d += c >>> 16;
            bh7 = c & 65535 | d << 16;
            bl7 = a & 65535 | b << 16;
            h = bh3;
            l3 = bl3;
            a = l3 & 65535;
            b = l3 >>> 16;
            c = h & 65535;
            d = h >>> 16;
            h = th;
            l3 = tl;
            a += l3 & 65535;
            b += l3 >>> 16;
            c += h & 65535;
            d += h >>> 16;
            b += a >>> 16;
            c += b >>> 16;
            d += c >>> 16;
            bh3 = c & 65535 | d << 16;
            bl3 = a & 65535 | b << 16;
            ah1 = bh0;
            ah2 = bh1;
            ah3 = bh2;
            ah4 = bh3;
            ah5 = bh4;
            ah6 = bh5;
            ah7 = bh6;
            ah0 = bh7;
            al1 = bl0;
            al2 = bl1;
            al3 = bl2;
            al4 = bl3;
            al5 = bl4;
            al6 = bl5;
            al7 = bl6;
            al0 = bl7;
            if (i41 % 16 === 15) {
                for(j = 0; j < 16; j++){
                    h = wh[j];
                    l3 = wl[j];
                    a = l3 & 65535;
                    b = l3 >>> 16;
                    c = h & 65535;
                    d = h >>> 16;
                    h = wh[(j + 9) % 16];
                    l3 = wl[(j + 9) % 16];
                    a += l3 & 65535;
                    b += l3 >>> 16;
                    c += h & 65535;
                    d += h >>> 16;
                    th = wh[(j + 1) % 16];
                    tl = wl[(j + 1) % 16];
                    h = (th >>> 1 | tl << 32 - 1) ^ (th >>> 8 | tl << 32 - 8) ^ th >>> 7;
                    l3 = (tl >>> 1 | th << 32 - 1) ^ (tl >>> 8 | th << 32 - 8) ^ (tl >>> 7 | th << 32 - 7);
                    a += l3 & 65535;
                    b += l3 >>> 16;
                    c += h & 65535;
                    d += h >>> 16;
                    th = wh[(j + 14) % 16];
                    tl = wl[(j + 14) % 16];
                    h = (th >>> 19 | tl << 32 - 19) ^ (tl >>> 61 - 32 | th << 32 - (61 - 32)) ^ th >>> 6;
                    l3 = (tl >>> 19 | th << 32 - 19) ^ (th >>> 61 - 32 | tl << 32 - (61 - 32)) ^ (tl >>> 6 | th << 32 - 6);
                    a += l3 & 65535;
                    b += l3 >>> 16;
                    c += h & 65535;
                    d += h >>> 16;
                    b += a >>> 16;
                    c += b >>> 16;
                    d += c >>> 16;
                    wh[j] = c & 65535 | d << 16;
                    wl[j] = a & 65535 | b << 16;
                }
            }
        }
        h = ah0;
        l3 = al0;
        a = l3 & 65535;
        b = l3 >>> 16;
        c = h & 65535;
        d = h >>> 16;
        h = hh[0];
        l3 = hl[0];
        a += l3 & 65535;
        b += l3 >>> 16;
        c += h & 65535;
        d += h >>> 16;
        b += a >>> 16;
        c += b >>> 16;
        d += c >>> 16;
        hh[0] = ah0 = c & 65535 | d << 16;
        hl[0] = al0 = a & 65535 | b << 16;
        h = ah1;
        l3 = al1;
        a = l3 & 65535;
        b = l3 >>> 16;
        c = h & 65535;
        d = h >>> 16;
        h = hh[1];
        l3 = hl[1];
        a += l3 & 65535;
        b += l3 >>> 16;
        c += h & 65535;
        d += h >>> 16;
        b += a >>> 16;
        c += b >>> 16;
        d += c >>> 16;
        hh[1] = ah1 = c & 65535 | d << 16;
        hl[1] = al1 = a & 65535 | b << 16;
        h = ah2;
        l3 = al2;
        a = l3 & 65535;
        b = l3 >>> 16;
        c = h & 65535;
        d = h >>> 16;
        h = hh[2];
        l3 = hl[2];
        a += l3 & 65535;
        b += l3 >>> 16;
        c += h & 65535;
        d += h >>> 16;
        b += a >>> 16;
        c += b >>> 16;
        d += c >>> 16;
        hh[2] = ah2 = c & 65535 | d << 16;
        hl[2] = al2 = a & 65535 | b << 16;
        h = ah3;
        l3 = al3;
        a = l3 & 65535;
        b = l3 >>> 16;
        c = h & 65535;
        d = h >>> 16;
        h = hh[3];
        l3 = hl[3];
        a += l3 & 65535;
        b += l3 >>> 16;
        c += h & 65535;
        d += h >>> 16;
        b += a >>> 16;
        c += b >>> 16;
        d += c >>> 16;
        hh[3] = ah3 = c & 65535 | d << 16;
        hl[3] = al3 = a & 65535 | b << 16;
        h = ah4;
        l3 = al4;
        a = l3 & 65535;
        b = l3 >>> 16;
        c = h & 65535;
        d = h >>> 16;
        h = hh[4];
        l3 = hl[4];
        a += l3 & 65535;
        b += l3 >>> 16;
        c += h & 65535;
        d += h >>> 16;
        b += a >>> 16;
        c += b >>> 16;
        d += c >>> 16;
        hh[4] = ah4 = c & 65535 | d << 16;
        hl[4] = al4 = a & 65535 | b << 16;
        h = ah5;
        l3 = al5;
        a = l3 & 65535;
        b = l3 >>> 16;
        c = h & 65535;
        d = h >>> 16;
        h = hh[5];
        l3 = hl[5];
        a += l3 & 65535;
        b += l3 >>> 16;
        c += h & 65535;
        d += h >>> 16;
        b += a >>> 16;
        c += b >>> 16;
        d += c >>> 16;
        hh[5] = ah5 = c & 65535 | d << 16;
        hl[5] = al5 = a & 65535 | b << 16;
        h = ah6;
        l3 = al6;
        a = l3 & 65535;
        b = l3 >>> 16;
        c = h & 65535;
        d = h >>> 16;
        h = hh[6];
        l3 = hl[6];
        a += l3 & 65535;
        b += l3 >>> 16;
        c += h & 65535;
        d += h >>> 16;
        b += a >>> 16;
        c += b >>> 16;
        d += c >>> 16;
        hh[6] = ah6 = c & 65535 | d << 16;
        hl[6] = al6 = a & 65535 | b << 16;
        h = ah7;
        l3 = al7;
        a = l3 & 65535;
        b = l3 >>> 16;
        c = h & 65535;
        d = h >>> 16;
        h = hh[7];
        l3 = hl[7];
        a += l3 & 65535;
        b += l3 >>> 16;
        c += h & 65535;
        d += h >>> 16;
        b += a >>> 16;
        c += b >>> 16;
        d += c >>> 16;
        hh[7] = ah7 = c & 65535 | d << 16;
        hl[7] = al7 = a & 65535 | b << 16;
        pos += 128;
        n -= 128;
    }
    return n;
}
function _ts64(x, i42, h, l4) {
    x[i42] = h >> 24 & 255;
    x[i42 + 1] = h >> 16 & 255;
    x[i42 + 2] = h >> 8 & 255;
    x[i42 + 3] = h & 255;
    x[i42 + 4] = l4 >> 24 & 255;
    x[i42 + 5] = l4 >> 16 & 255;
    x[i42 + 6] = l4 >> 8 & 255;
    x[i42 + 7] = l4 & 255;
}
var SignLength;
(function(SignLength1) {
    SignLength1[SignLength1["PublicKey"] = 32] = "PublicKey";
    SignLength1[SignLength1["SecretKey"] = 64] = "SecretKey";
    SignLength1[SignLength1["Seed"] = 32] = "Seed";
    SignLength1[SignLength1["Signature"] = 64] = "Signature";
})(SignLength || (SignLength = {}));
function sign(msg, secretKey) {
    checkArrayTypes(msg, secretKey);
    if (secretKey.length !== SignLength.SecretKey) throw new Error('bad secret key size');
    const signedMsg = ByteArray(SignLength.Signature + msg.length);
    _sign(signedMsg, msg, msg.length, secretKey);
    return signedMsg;
}
function sign_detached(msg, secretKey) {
    const signedMsg = sign(msg, secretKey);
    const sig = ByteArray(SignLength.Signature);
    for(let i43 = 0; i43 < sig.length; i43++)sig[i43] = signedMsg[i43];
    return sig;
}
function sign_detached_verify(msg, sig, publicKey) {
    checkArrayTypes(msg, sig, publicKey);
    if (sig.length !== SignLength.Signature) throw new Error('bad signature size');
    if (publicKey.length !== SignLength.PublicKey) throw new Error('bad public key size');
    const sm = ByteArray(SignLength.Signature + msg.length);
    const m = ByteArray(SignLength.Signature + msg.length);
    let i44;
    for(i44 = 0; i44 < SignLength.Signature; i44++)sm[i44] = sig[i44];
    for(i44 = 0; i44 < msg.length; i44++)sm[i44 + SignLength.Signature] = msg[i44];
    return _sign_open(m, sm, sm.length, publicKey) >= 0;
}
function sign_keyPair_fromSeed(seed) {
    checkArrayTypes(seed);
    if (seed.length !== SignLength.Seed) throw new Error('bad seed size');
    const pk = ByteArray(SignLength.PublicKey);
    const sk = ByteArray(SignLength.SecretKey);
    for(let i45 = 0; i45 < 32; i45++)sk[i45] = seed[i45];
    _sign_keypair(pk, sk, true);
    return {
        publicKey: pk,
        secretKey: sk
    };
}
function _sign_keypair(pk, sk, seeded) {
    const d = ByteArray(64);
    const p = [
        gf(),
        gf(),
        gf(),
        gf()
    ];
    let i46;
    if (!seeded) sk.set(randomBytes(32));
    _hash(d, sk, 32);
    d[0] &= 248;
    d[31] &= 127;
    d[31] |= 64;
    scalarbase(p, d);
    pack(pk, p);
    for(i46 = 0; i46 < 32; i46++)sk[i46 + 32] = pk[i46];
    return 0;
}
function _sign(sm, m, n, sk) {
    const d = ByteArray(64), h = ByteArray(64), r = ByteArray(64);
    const x = NumArray(64);
    const p = [
        gf(),
        gf(),
        gf(),
        gf()
    ];
    let i47, j;
    _hash(d, sk, 32);
    d[0] &= 248;
    d[31] &= 127;
    d[31] |= 64;
    const smlen = n + 64;
    for(i47 = 0; i47 < n; i47++)sm[64 + i47] = m[i47];
    for(i47 = 0; i47 < 32; i47++)sm[32 + i47] = d[32 + i47];
    _hash(r, sm.subarray(32), n + 32);
    reduce(r);
    scalarbase(p, r);
    pack(sm, p);
    for(i47 = 32; i47 < 64; i47++)sm[i47] = sk[i47];
    _hash(h, sm, n + 64);
    reduce(h);
    for(i47 = 0; i47 < 64; i47++)x[i47] = 0;
    for(i47 = 0; i47 < 32; i47++)x[i47] = r[i47];
    for(i47 = 0; i47 < 32; i47++){
        for(j = 0; j < 32; j++){
            x[i47 + j] += h[i47] * d[j];
        }
    }
    modL(sm.subarray(32), x);
    return smlen;
}
function _sign_open(m, sm, n, pk) {
    const t = ByteArray(32), h = ByteArray(64);
    const p = [
        gf(),
        gf(),
        gf(),
        gf()
    ], q = [
        gf(),
        gf(),
        gf(),
        gf()
    ];
    let i48, mlen;
    mlen = -1;
    if (n < 64 || unpackneg(q, pk)) return -1;
    for(i48 = 0; i48 < n; i48++)m[i48] = sm[i48];
    for(i48 = 0; i48 < 32; i48++)m[i48 + 32] = pk[i48];
    _hash(h, m, n);
    reduce(h);
    scalarmult(p, q, h);
    scalarbase(q, sm.subarray(32));
    add(p, q);
    pack(t, p);
    n -= 64;
    if (_verify_32(sm, 0, t, 0)) {
        for(i48 = 0; i48 < n; i48++)m[i48] = 0;
        return -1;
    }
    for(i48 = 0; i48 < n; i48++)m[i48] = sm[i48 + 64];
    mlen = n;
    return mlen;
}
function scalarbase(p, s) {
    const q = [
        gf(),
        gf(),
        gf(),
        gf()
    ];
    set25519(q[0], X);
    set25519(q[1], Y);
    set25519(q[2], gf1);
    M(q[3], X, Y);
    scalarmult(p, q, s);
}
function scalarmult(p, q, s) {
    let b, i49;
    set25519(p[0], gf0);
    set25519(p[1], gf1);
    set25519(p[2], gf1);
    set25519(p[3], gf0);
    for(i49 = 255; i49 >= 0; --i49){
        b = s[i49 / 8 | 0] >> (i49 & 7) & 1;
        cswap(p, q, b);
        add(q, p);
        add(p, p);
        cswap(p, q, b);
    }
}
function pack(r, p) {
    const tx = gf(), ty = gf(), zi = gf();
    inv25519(zi, p[2]);
    M(tx, p[0], zi);
    M(ty, p[1], zi);
    pack25519(r, ty);
    r[31] ^= par25519(tx) << 7;
}
function unpackneg(r, p) {
    const t = gf(), chk = gf(), num = gf(), den = gf(), den2 = gf(), den4 = gf(), den6 = gf();
    set25519(r[2], gf1);
    unpack25519(r[1], p);
    S(num, r[1]);
    M(den, num, D);
    Z(num, num, r[2]);
    A(den, r[2], den);
    S(den2, den);
    S(den4, den2);
    M(den6, den4, den2);
    M(t, den6, num);
    M(t, t, den);
    pow2523(t, t);
    M(t, t, num);
    M(t, t, den);
    M(t, t, den);
    M(r[0], t, den);
    S(chk, r[0]);
    M(chk, chk, den);
    if (neq25519(chk, num)) M(r[0], r[0], I);
    S(chk, r[0]);
    M(chk, chk, den);
    if (neq25519(chk, num)) return -1;
    if (par25519(r[0]) === p[31] >> 7) Z(r[0], gf0, r[0]);
    M(r[3], r[0], r[1]);
    return 0;
}
function reduce(r) {
    const x = NumArray(64);
    let i50;
    for(i50 = 0; i50 < 64; i50++)x[i50] = r[i50];
    for(i50 = 0; i50 < 64; i50++)r[i50] = 0;
    modL(r, x);
}
const L = NumArray([
    237,
    211,
    245,
    92,
    26,
    99,
    18,
    88,
    214,
    156,
    247,
    162,
    222,
    249,
    222,
    20,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    16
]);
function modL(r, x) {
    let carry, i51, j, k;
    for(i51 = 63; i51 >= 32; --i51){
        carry = 0;
        for(j = i51 - 32, k = i51 - 12; j < k; ++j){
            x[j] += carry - 16 * x[i51] * L[j - (i51 - 32)];
            carry = x[j] + 128 >> 8;
            x[j] -= carry * 256;
        }
        x[j] += carry;
        x[i51] = 0;
    }
    carry = 0;
    for(j = 0; j < 32; j++){
        x[j] += carry - (x[31] >> 4) * L[j];
        carry = x[j] >> 8;
        x[j] &= 255;
    }
    for(j = 0; j < 32; j++)x[j] -= carry * L[j];
    for(i51 = 0; i51 < 32; i51++){
        x[i51 + 1] += x[i51] >> 8;
        r[i51] = x[i51] & 255;
    }
}
function add(p, q) {
    const a = gf(), b = gf(), c = gf(), d = gf(), e = gf(), f = gf(), g = gf(), h = gf(), t = gf();
    Z(a, p[1], p[0]);
    Z(t, q[1], q[0]);
    M(a, a, t);
    A(b, p[0], p[1]);
    A(t, q[0], q[1]);
    M(b, b, t);
    M(c, p[3], q[3]);
    M(c, c, D2);
    M(d, p[2], q[2]);
    A(d, d, d);
    Z(e, b, a);
    Z(f, d, c);
    A(g, d, c);
    A(h, b, a);
    M(p[0], e, f);
    M(p[1], h, g);
    M(p[2], g, f);
    M(p[3], e, h);
}
function cswap(p, q, b) {
    for(let i52 = 0; i52 < 4; i52++){
        sel25519(p[i52], q[i52], b);
    }
}
function pow2523(o, i53) {
    const c = gf();
    let a;
    for(a = 0; a < 16; a++)c[a] = i53[a];
    for(a = 250; a >= 0; a--){
        S(c, c);
        if (a !== 1) M(c, c, i53);
    }
    for(a = 0; a < 16; a++)o[a] = c[a];
}
var AuthLength;
(function(AuthLength1) {
    AuthLength1[AuthLength1["Auth"] = 32] = "Auth";
    AuthLength1[AuthLength1["AuthFull"] = 64] = "AuthFull";
    AuthLength1[AuthLength1["Key"] = 32] = "Key";
})(AuthLength || (AuthLength = {}));
WordArray([
    1779033703,
    3144134277,
    1013904242,
    2773480762,
    1359893119,
    2600822924,
    528734635,
    1541459225
]);
ByteArray([
    0,
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    11,
    12,
    13,
    14,
    15,
    14,
    10,
    4,
    8,
    9,
    15,
    13,
    6,
    1,
    12,
    0,
    2,
    11,
    7,
    5,
    3,
    11,
    8,
    12,
    0,
    5,
    2,
    15,
    13,
    10,
    14,
    3,
    6,
    7,
    1,
    9,
    4,
    7,
    9,
    3,
    1,
    13,
    12,
    11,
    14,
    2,
    6,
    5,
    10,
    4,
    0,
    15,
    8,
    9,
    0,
    5,
    7,
    2,
    4,
    10,
    15,
    14,
    1,
    11,
    12,
    6,
    8,
    3,
    13,
    2,
    12,
    6,
    10,
    0,
    11,
    8,
    3,
    4,
    13,
    7,
    5,
    15,
    14,
    1,
    9,
    12,
    5,
    1,
    15,
    14,
    13,
    4,
    10,
    0,
    7,
    6,
    3,
    9,
    2,
    8,
    11,
    13,
    11,
    7,
    14,
    12,
    1,
    3,
    9,
    5,
    0,
    15,
    4,
    8,
    6,
    2,
    10,
    6,
    15,
    14,
    9,
    11,
    3,
    0,
    8,
    12,
    2,
    13,
    7,
    1,
    4,
    10,
    5,
    10,
    2,
    8,
    4,
    7,
    6,
    1,
    5,
    15,
    11,
    9,
    14,
    3,
    12,
    13,
    0
]);
WordArray(16);
WordArray(16);
WordArray([
    4089235720,
    1779033703,
    2227873595,
    3144134277,
    4271175723,
    1013904242,
    1595750129,
    2773480762,
    2917565137,
    1359893119,
    725511199,
    2600822924,
    4215389547,
    528734635,
    327033209,
    1541459225
]);
const SIGMA8 = [
    0,
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    11,
    12,
    13,
    14,
    15,
    14,
    10,
    4,
    8,
    9,
    15,
    13,
    6,
    1,
    12,
    0,
    2,
    11,
    7,
    5,
    3,
    11,
    8,
    12,
    0,
    5,
    2,
    15,
    13,
    10,
    14,
    3,
    6,
    7,
    1,
    9,
    4,
    7,
    9,
    3,
    1,
    13,
    12,
    11,
    14,
    2,
    6,
    5,
    10,
    4,
    0,
    15,
    8,
    9,
    0,
    5,
    7,
    2,
    4,
    10,
    15,
    14,
    1,
    11,
    12,
    6,
    8,
    3,
    13,
    2,
    12,
    6,
    10,
    0,
    11,
    8,
    3,
    4,
    13,
    7,
    5,
    15,
    14,
    1,
    9,
    12,
    5,
    1,
    15,
    14,
    13,
    4,
    10,
    0,
    7,
    6,
    3,
    9,
    2,
    8,
    11,
    13,
    11,
    7,
    14,
    12,
    1,
    3,
    9,
    5,
    0,
    15,
    4,
    8,
    6,
    2,
    10,
    6,
    15,
    14,
    9,
    11,
    3,
    0,
    8,
    12,
    2,
    13,
    7,
    1,
    4,
    10,
    5,
    10,
    2,
    8,
    4,
    7,
    6,
    1,
    5,
    15,
    11,
    9,
    14,
    3,
    12,
    13,
    0,
    0,
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    11,
    12,
    13,
    14,
    15,
    14,
    10,
    4,
    8,
    9,
    15,
    13,
    6,
    1,
    12,
    0,
    2,
    11,
    7,
    5,
    3
];
ByteArray(SIGMA8.map((x)=>x * 2
));
WordArray(32);
WordArray(32);
var SealedBoxLength;
(function(SealedBoxLength1) {
    SealedBoxLength1[SealedBoxLength1["PublicKey"] = BoxLength.PublicKey] = "PublicKey";
    SealedBoxLength1[SealedBoxLength1["SecretKey"] = BoxLength.SecretKey] = "SecretKey";
    SealedBoxLength1[SealedBoxLength1["Nonce"] = BoxLength.Nonce] = "Nonce";
    SealedBoxLength1[SealedBoxLength1["Overhead"] = BoxLength.PublicKey + BoxLength.Overhead] = "Overhead";
})(SealedBoxLength || (SealedBoxLength = {}));
const denoHelper = {
    fromSeed: sign_keyPair_fromSeed,
    sign: sign_detached,
    verify: sign_detached_verify,
    randomBytes: randomBytes
};
let helper;
function setEd25519Helper(lib) {
    helper = lib;
}
function getEd25519Helper() {
    return helper;
}
const crc16tab = new Uint16Array([
    0,
    4129,
    8258,
    12387,
    16516,
    20645,
    24774,
    28903,
    33032,
    37161,
    41290,
    45419,
    49548,
    53677,
    57806,
    61935,
    4657,
    528,
    12915,
    8786,
    21173,
    17044,
    29431,
    25302,
    37689,
    33560,
    45947,
    41818,
    54205,
    50076,
    62463,
    58334,
    9314,
    13379,
    1056,
    5121,
    25830,
    29895,
    17572,
    21637,
    42346,
    46411,
    34088,
    38153,
    58862,
    62927,
    50604,
    54669,
    13907,
    9842,
    5649,
    1584,
    30423,
    26358,
    22165,
    18100,
    46939,
    42874,
    38681,
    34616,
    63455,
    59390,
    55197,
    51132,
    18628,
    22757,
    26758,
    30887,
    2112,
    6241,
    10242,
    14371,
    51660,
    55789,
    59790,
    63919,
    35144,
    39273,
    43274,
    47403,
    23285,
    19156,
    31415,
    27286,
    6769,
    2640,
    14899,
    10770,
    56317,
    52188,
    64447,
    60318,
    39801,
    35672,
    47931,
    43802,
    27814,
    31879,
    19684,
    23749,
    11298,
    15363,
    3168,
    7233,
    60846,
    64911,
    52716,
    56781,
    44330,
    48395,
    36200,
    40265,
    32407,
    28342,
    24277,
    20212,
    15891,
    11826,
    7761,
    3696,
    65439,
    61374,
    57309,
    53244,
    48923,
    44858,
    40793,
    36728,
    37256,
    33193,
    45514,
    41451,
    53516,
    49453,
    61774,
    57711,
    4224,
    161,
    12482,
    8419,
    20484,
    16421,
    28742,
    24679,
    33721,
    37784,
    41979,
    46042,
    49981,
    54044,
    58239,
    62302,
    689,
    4752,
    8947,
    13010,
    16949,
    21012,
    25207,
    29270,
    46570,
    42443,
    38312,
    34185,
    62830,
    58703,
    54572,
    50445,
    13538,
    9411,
    5280,
    1153,
    29798,
    25671,
    21540,
    17413,
    42971,
    47098,
    34713,
    38840,
    59231,
    63358,
    50973,
    55100,
    9939,
    14066,
    1681,
    5808,
    26199,
    30326,
    17941,
    22068,
    55628,
    51565,
    63758,
    59695,
    39368,
    35305,
    47498,
    43435,
    22596,
    18533,
    30726,
    26663,
    6336,
    2273,
    14466,
    10403,
    52093,
    56156,
    60223,
    64286,
    35833,
    39896,
    43963,
    48026,
    19061,
    23124,
    27191,
    31254,
    2801,
    6864,
    10931,
    14994,
    64814,
    60687,
    56684,
    52557,
    48554,
    44427,
    40424,
    36297,
    31782,
    27655,
    23652,
    19525,
    15522,
    11395,
    7392,
    3265,
    61215,
    65342,
    53085,
    57212,
    44955,
    49082,
    36825,
    40952,
    28183,
    32310,
    20053,
    24180,
    11923,
    16050,
    3793,
    7920, 
]);
class crc16 {
    static checksum(data) {
        let crc = 0;
        for(let i54 = 0; i54 < data.byteLength; i54++){
            let b = data[i54];
            crc = crc << 8 & 65535 ^ crc16tab[(crc >> 8 ^ b) & 255];
        }
        return crc;
    }
    static validate(data, expected) {
        let ba = crc16.checksum(data);
        return ba == expected;
    }
}
const b32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
class base32 {
    static encode(src) {
        let bits = 0;
        let value = 0;
        let a = new Uint8Array(src);
        let buf = new Uint8Array(src.byteLength * 2);
        let j = 0;
        for(let i55 = 0; i55 < a.byteLength; i55++){
            value = value << 8 | a[i55];
            bits += 8;
            while(bits >= 5){
                let index = value >>> bits - 5 & 31;
                buf[j++] = b32Alphabet.charAt(index).charCodeAt(0);
                bits -= 5;
            }
        }
        if (bits > 0) {
            let index = value << 5 - bits & 31;
            buf[j++] = b32Alphabet.charAt(index).charCodeAt(0);
        }
        return buf.slice(0, j);
    }
    static decode(src) {
        let bits = 0;
        let __byte = 0;
        let j = 0;
        let a = new Uint8Array(src);
        let out = new Uint8Array(a.byteLength * 5 / 8 | 0);
        for(let i56 = 0; i56 < a.byteLength; i56++){
            let v = String.fromCharCode(a[i56]);
            let vv = b32Alphabet.indexOf(v);
            if (vv === -1) {
                throw new Error("Illegal Base32 character: " + a[i56]);
            }
            __byte = __byte << 5 | vv;
            bits += 5;
            if (bits >= 8) {
                out[j++] = __byte >>> bits - 8 & 255;
                bits -= 8;
            }
        }
        return out.slice(0, j);
    }
}
class NKeysError extends Error {
    name;
    code;
    chainedError;
    constructor(code4, chainedError){
        super(code4);
        this.name = "NKeysError";
        this.code = code4;
        this.chainedError = chainedError;
    }
}
function createOperator() {
    return createPair(Prefix.Operator);
}
function createAccount() {
    return createPair(Prefix.Account);
}
function createUser() {
    return createPair(Prefix.User);
}
var NKeysErrorCode;
(function(NKeysErrorCode1) {
    NKeysErrorCode1["InvalidPrefixByte"] = "nkeys: invalid prefix byte";
    NKeysErrorCode1["InvalidKey"] = "nkeys: invalid key";
    NKeysErrorCode1["InvalidPublicKey"] = "nkeys: invalid public key";
    NKeysErrorCode1["InvalidSeedLen"] = "nkeys: invalid seed length";
    NKeysErrorCode1["InvalidSeed"] = "nkeys: invalid seed";
    NKeysErrorCode1["InvalidEncoding"] = "nkeys: invalid encoded key";
    NKeysErrorCode1["InvalidSignature"] = "nkeys: signature verification failed";
    NKeysErrorCode1["CannotSign"] = "nkeys: cannot sign, no private key available";
    NKeysErrorCode1["PublicKeyOnly"] = "nkeys: no seed or private key available";
    NKeysErrorCode1["InvalidChecksum"] = "nkeys: invalid checksum";
    NKeysErrorCode1["SerializationError"] = "nkeys: serialization error";
    NKeysErrorCode1["ApiError"] = "nkeys: api error";
    NKeysErrorCode1["ClearedPair"] = "nkeys: pair is cleared";
})(NKeysErrorCode || (NKeysErrorCode = {}));
var Prefix;
(function(Prefix1) {
    Prefix1[Prefix1["Seed"] = 144] = "Seed";
    Prefix1[Prefix1["Private"] = 120] = "Private";
    Prefix1[Prefix1["Operator"] = 112] = "Operator";
    Prefix1[Prefix1["Server"] = 104] = "Server";
    Prefix1[Prefix1["Cluster"] = 16] = "Cluster";
    Prefix1[Prefix1["Account"] = 0] = "Account";
    Prefix1[Prefix1["User"] = 160] = "User";
})(Prefix || (Prefix = {}));
class Prefixes {
    static isValidPublicPrefix(prefix) {
        return prefix == Prefix.Server || prefix == Prefix.Operator || prefix == Prefix.Cluster || prefix == Prefix.Account || prefix == Prefix.User;
    }
    static startsWithValidPrefix(s) {
        let c = s[0];
        return c == "S" || c == "P" || c == "O" || c == "N" || c == "C" || c == "A" || c == "U";
    }
    static isValidPrefix(prefix) {
        let v = this.parsePrefix(prefix);
        return v != -1;
    }
    static parsePrefix(v) {
        switch(v){
            case Prefix.Seed:
                return Prefix.Seed;
            case Prefix.Private:
                return Prefix.Private;
            case Prefix.Operator:
                return Prefix.Operator;
            case Prefix.Server:
                return Prefix.Server;
            case Prefix.Cluster:
                return Prefix.Cluster;
            case Prefix.Account:
                return Prefix.Account;
            case Prefix.User:
                return Prefix.User;
            default:
                return -1;
        }
    }
}
class Codec {
    static encode(prefix, src) {
        if (!src || !(src instanceof Uint8Array)) {
            throw new NKeysError(NKeysErrorCode.SerializationError);
        }
        if (!Prefixes.isValidPrefix(prefix)) {
            throw new NKeysError(NKeysErrorCode.InvalidPrefixByte);
        }
        return Codec._encode(false, prefix, src);
    }
    static encodeSeed(role, src) {
        if (!src) {
            throw new NKeysError(NKeysErrorCode.ApiError);
        }
        if (!Prefixes.isValidPublicPrefix(role)) {
            throw new NKeysError(NKeysErrorCode.InvalidPrefixByte);
        }
        if (src.byteLength !== 32) {
            throw new NKeysError(NKeysErrorCode.InvalidSeedLen);
        }
        return Codec._encode(true, role, src);
    }
    static decode(expected, src) {
        if (!Prefixes.isValidPrefix(expected)) {
            throw new NKeysError(NKeysErrorCode.InvalidPrefixByte);
        }
        const raw = Codec._decode(src);
        if (raw[0] !== expected) {
            throw new NKeysError(NKeysErrorCode.InvalidPrefixByte);
        }
        return raw.slice(1);
    }
    static decodeSeed(src) {
        const raw = Codec._decode(src);
        const prefix = Codec._decodePrefix(raw);
        if (prefix[0] != Prefix.Seed) {
            throw new NKeysError(NKeysErrorCode.InvalidSeed);
        }
        if (!Prefixes.isValidPublicPrefix(prefix[1])) {
            throw new NKeysError(NKeysErrorCode.InvalidPrefixByte);
        }
        return {
            buf: raw.slice(2),
            prefix: prefix[1]
        };
    }
    static _encode(seed, role, payload) {
        const payloadOffset = seed ? 2 : 1;
        const payloadLen = payload.byteLength;
        const cap = payloadOffset + payloadLen + 2;
        const checkOffset = payloadOffset + payloadLen;
        const raw = new Uint8Array(cap);
        if (seed) {
            const encodedPrefix = Codec._encodePrefix(Prefix.Seed, role);
            raw.set(encodedPrefix);
        } else {
            raw[0] = role;
        }
        raw.set(payload, payloadOffset);
        const checksum = crc16.checksum(raw.slice(0, checkOffset));
        const dv = new DataView(raw.buffer);
        dv.setUint16(checkOffset, checksum, true);
        return base32.encode(raw);
    }
    static _decode(src) {
        if (src.byteLength < 4) {
            throw new NKeysError(NKeysErrorCode.InvalidEncoding);
        }
        let raw;
        try {
            raw = base32.decode(src);
        } catch (ex) {
            throw new NKeysError(NKeysErrorCode.InvalidEncoding, ex);
        }
        const checkOffset = raw.byteLength - 2;
        const dv = new DataView(raw.buffer);
        const checksum = dv.getUint16(checkOffset, true);
        const payload = raw.slice(0, checkOffset);
        if (!crc16.validate(payload, checksum)) {
            throw new NKeysError(NKeysErrorCode.InvalidChecksum);
        }
        return payload;
    }
    static _encodePrefix(kind, role) {
        const b1 = kind | role >> 5;
        const b2 = (role & 31) << 3;
        return new Uint8Array([
            b1,
            b2
        ]);
    }
    static _decodePrefix(raw) {
        const b1 = raw[0] & 248;
        const b2 = (raw[0] & 7) << 5 | (raw[1] & 248) >> 3;
        return new Uint8Array([
            b1,
            b2
        ]);
    }
}
class KP {
    seed;
    constructor(seed){
        this.seed = seed;
    }
    getRawSeed() {
        if (!this.seed) {
            throw new NKeysError(NKeysErrorCode.ClearedPair);
        }
        let sd = Codec.decodeSeed(this.seed);
        return sd.buf;
    }
    getSeed() {
        if (!this.seed) {
            throw new NKeysError(NKeysErrorCode.ClearedPair);
        }
        return this.seed;
    }
    getPublicKey() {
        if (!this.seed) {
            throw new NKeysError(NKeysErrorCode.ClearedPair);
        }
        const sd = Codec.decodeSeed(this.seed);
        const kp = getEd25519Helper().fromSeed(this.getRawSeed());
        const buf = Codec.encode(sd.prefix, kp.publicKey);
        return new TextDecoder().decode(buf);
    }
    getPrivateKey() {
        if (!this.seed) {
            throw new NKeysError(NKeysErrorCode.ClearedPair);
        }
        const kp = getEd25519Helper().fromSeed(this.getRawSeed());
        return Codec.encode(Prefix.Private, kp.secretKey);
    }
    sign(input) {
        if (!this.seed) {
            throw new NKeysError(NKeysErrorCode.ClearedPair);
        }
        const kp = getEd25519Helper().fromSeed(this.getRawSeed());
        return getEd25519Helper().sign(input, kp.secretKey);
    }
    verify(input, sig) {
        if (!this.seed) {
            throw new NKeysError(NKeysErrorCode.ClearedPair);
        }
        const kp = getEd25519Helper().fromSeed(this.getRawSeed());
        return getEd25519Helper().verify(input, sig, kp.publicKey);
    }
    clear() {
        if (!this.seed) {
            return;
        }
        this.seed.fill(0);
        this.seed = undefined;
    }
}
function createPair(prefix) {
    const rawSeed = getEd25519Helper().randomBytes(32);
    let str = Codec.encodeSeed(prefix, new Uint8Array(rawSeed));
    return new KP(str);
}
class PublicKey {
    publicKey;
    constructor(publicKey){
        this.publicKey = publicKey;
    }
    getPublicKey() {
        if (!this.publicKey) {
            throw new NKeysError(NKeysErrorCode.ClearedPair);
        }
        return new TextDecoder().decode(this.publicKey);
    }
    getPrivateKey() {
        if (!this.publicKey) {
            throw new NKeysError(NKeysErrorCode.ClearedPair);
        }
        throw new NKeysError(NKeysErrorCode.PublicKeyOnly);
    }
    getSeed() {
        if (!this.publicKey) {
            throw new NKeysError(NKeysErrorCode.ClearedPair);
        }
        throw new NKeysError(NKeysErrorCode.PublicKeyOnly);
    }
    sign(_) {
        if (!this.publicKey) {
            throw new NKeysError(NKeysErrorCode.ClearedPair);
        }
        throw new NKeysError(NKeysErrorCode.CannotSign);
    }
    verify(input, sig) {
        if (!this.publicKey) {
            throw new NKeysError(NKeysErrorCode.ClearedPair);
        }
        let buf = Codec._decode(this.publicKey);
        return getEd25519Helper().verify(input, sig, buf.slice(1));
    }
    clear() {
        if (!this.publicKey) {
            return;
        }
        this.publicKey.fill(0);
        this.publicKey = undefined;
    }
}
function fromPublic(src) {
    const ba = new TextEncoder().encode(src);
    const raw = Codec._decode(ba);
    const prefix = Prefixes.parsePrefix(raw[0]);
    if (Prefixes.isValidPublicPrefix(prefix)) {
        return new PublicKey(ba);
    }
    throw new NKeysError(NKeysErrorCode.InvalidPublicKey);
}
function fromSeed(src) {
    Codec.decodeSeed(src);
    return new KP(src);
}
function encode1(bytes) {
    return btoa(String.fromCharCode(...bytes));
}
function decode1(b64str) {
    const bin = atob(b64str);
    const bytes = new Uint8Array(bin.length);
    for(let i57 = 0; i57 < bin.length; i57++){
        bytes[i57] = bin.charCodeAt(i57);
    }
    return bytes;
}
setEd25519Helper(denoHelper);
const mod = {
    createAccount,
    createOperator,
    createPair,
    createUser,
    fromPublic,
    fromSeed,
    NKeysError,
    NKeysErrorCode,
    Prefix,
    decode: decode1,
    encode: encode1
};
function buildAuthenticator(opts) {
    if (opts.authenticator) {
        return opts.authenticator;
    }
    if (opts.token) {
        return tokenFn(opts.token);
    }
    if (opts.user) {
        return passFn(opts.user, opts.pass);
    }
    return noAuthFn();
}
function noAuthFn() {
    return ()=>{
        return;
    };
}
function passFn(user, pass) {
    return ()=>{
        return {
            user,
            pass
        };
    };
}
function tokenFn(token) {
    return ()=>{
        return {
            auth_token: token
        };
    };
}
function nkeyAuthenticator(seed) {
    return (nonce)=>{
        seed = typeof seed === "function" ? seed() : seed;
        const kp = seed ? mod.fromSeed(seed) : undefined;
        const nkey = kp ? kp.getPublicKey() : "";
        const challenge = TE.encode(nonce || "");
        const sigBytes = kp !== undefined && nonce ? kp.sign(challenge) : undefined;
        const sig = sigBytes ? mod.encode(sigBytes) : "";
        return {
            nkey,
            sig
        };
    };
}
function jwtAuthenticator(ajwt, seed) {
    return (nonce)=>{
        const jwt = typeof ajwt === "function" ? ajwt() : ajwt;
        const fn = nkeyAuthenticator(seed);
        const { nkey , sig  } = fn(nonce);
        return {
            jwt,
            nkey,
            sig
        };
    };
}
function credsAuthenticator(creds) {
    const CREDS = /\s*(?:(?:[-]{3,}[^\n]*[-]{3,}\n)(.+)(?:\n\s*[-]{3,}[^\n]*[-]{3,}\n))/ig;
    const s = TD.decode(creds);
    let m = CREDS.exec(s);
    if (!m) {
        throw NatsError.errorForCode(ErrorCode.BadCreds);
    }
    const jwt = m[1].trim();
    m = CREDS.exec(s);
    if (!m) {
        throw NatsError.errorForCode(ErrorCode.BadCreds);
    }
    const seed = TE.encode(m[1].trim());
    return jwtAuthenticator(jwt, seed);
}
class StreamAPIImpl extends BaseApiClient {
    constructor(nc, opts){
        super(nc, opts);
    }
    async add(cfg = {}) {
        validateStreamName(cfg.name);
        const r = await this._request(`${this.prefix}.STREAM.CREATE.${cfg.name}`, cfg);
        const si = r;
        this._fixInfo(si);
        return si;
    }
    async delete(stream) {
        validateStreamName(stream);
        const r = await this._request(`${this.prefix}.STREAM.DELETE.${stream}`);
        const cr = r;
        return cr.success;
    }
    async update(name, cfg = {}) {
        if (typeof name === "object") {
            const sc = name;
            name = sc.name;
            cfg = sc;
            console.trace(`\u001B[33m >> streams.update(config: StreamConfig) api changed to streams.update(name: string, config: StreamUpdateConfig) - this shim will be removed - update your code.  \u001B[0m`);
        }
        validateStreamName(name);
        const ncfg = cfg;
        ncfg.name = name;
        const r = await this._request(`${this.prefix}.STREAM.UPDATE.${name}`, ncfg);
        const si = r;
        this._fixInfo(si);
        return si;
    }
    async info(name, data) {
        validateStreamName(name);
        const r = await this._request(`${this.prefix}.STREAM.INFO.${name}`, data);
        const si = r;
        this._fixInfo(si);
        return si;
    }
    list() {
        const filter = (v)=>{
            const slr = v;
            slr.streams.forEach((si)=>{
                this._fixInfo(si);
            });
            return slr.streams;
        };
        const subj = `${this.prefix}.STREAM.LIST`;
        return new ListerImpl(subj, filter, this);
    }
    _fixInfo(si) {
        si.config.sealed = si.config.sealed || false;
        si.config.deny_delete = si.config.deny_delete || false;
        si.config.deny_purge = si.config.deny_purge || false;
        si.config.allow_rollup_hdrs = si.config.allow_rollup_hdrs || false;
    }
    async purge(name, opts) {
        if (opts) {
            const { keep , seq  } = opts;
            if (typeof keep === "number" && typeof seq === "number") {
                throw new Error("can specify one of keep or seq");
            }
        }
        validateStreamName(name);
        const v = await this._request(`${this.prefix}.STREAM.PURGE.${name}`, opts);
        return v;
    }
    async deleteMessage(stream, seq, erase = true) {
        validateStreamName(stream);
        const dr = {
            seq
        };
        if (!erase) {
            dr.no_erase = true;
        }
        const r = await this._request(`${this.prefix}.STREAM.MSG.DELETE.${stream}`, dr);
        const cr = r;
        return cr.success;
    }
    async getMessage(stream, query) {
        validateStreamName(stream);
        const r = await this._request(`${this.prefix}.STREAM.MSG.GET.${stream}`, query);
        const sm = r;
        return new StoredMsgImpl(sm);
    }
    find(subject) {
        return this.findStream(subject);
    }
}
class StoredMsgImpl {
    subject;
    seq;
    data;
    time;
    header;
    constructor(smr){
        this.subject = smr.message.subject;
        this.seq = smr.message.seq;
        this.time = new Date(smr.message.time);
        this.data = smr.message.data ? this._parse(smr.message.data) : Empty;
        if (smr.message.hdrs) {
            const hd = this._parse(smr.message.hdrs);
            this.header = MsgHdrsImpl.decode(hd);
        } else {
            this.header = headers();
        }
    }
    _parse(s) {
        const bs = atob(s);
        const len = bs.length;
        const bytes = new Uint8Array(len);
        for(let i58 = 0; i58 < len; i58++){
            bytes[i58] = bs.charCodeAt(i58);
        }
        return bytes;
    }
}
class JetStreamManagerImpl extends BaseApiClient {
    streams;
    consumers;
    constructor(nc, opts){
        super(nc, opts);
        this.streams = new StreamAPIImpl(nc, opts);
        this.consumers = new ConsumerAPIImpl(nc, opts);
    }
    async getAccountInfo() {
        const r = await this._request(`${this.prefix}.INFO`);
        return r;
    }
    advisories() {
        const iter = new QueuedIteratorImpl();
        this.nc.subscribe(`$JS.EVENT.ADVISORY.>`, {
            callback: (err, msg)=>{
                if (err) {
                    throw err;
                }
                try {
                    const d = this.parseJsResponse(msg);
                    const chunks = d.type.split(".");
                    const kind = chunks[chunks.length - 1];
                    iter.push({
                        kind: kind,
                        data: d
                    });
                } catch (err1) {
                    iter.stop(err1);
                }
            }
        });
        return iter;
    }
}
class Metric {
    name;
    duration;
    date;
    payload;
    msgs;
    lang;
    version;
    bytes;
    asyncRequests;
    min;
    max;
    constructor(name, duration){
        this.name = name;
        this.duration = duration;
        this.date = Date.now();
        this.payload = 0;
        this.msgs = 0;
        this.bytes = 0;
    }
    toString() {
        const sec = this.duration / 1000;
        const mps = Math.round(this.msgs / sec);
        const label = this.asyncRequests ? "asyncRequests" : "";
        let minmax = "";
        if (this.max) {
            minmax = `${this.min}/${this.max}`;
        }
        return `${this.name}${label ? " [asyncRequests]" : ""} ${humanizeNumber(mps)} msgs/sec - [${sec.toFixed(2)} secs] ~ ${throughput(this.bytes, sec)} ${minmax}`;
    }
    toCsv() {
        return `"${this.name}",${new Date(this.date).toISOString()},${this.lang},${this.version},${this.msgs},${this.payload},${this.bytes},${this.duration},${this.asyncRequests ? this.asyncRequests : false}\n`;
    }
    static header() {
        return `Test,Date,Lang,Version,Count,MsgPayload,Bytes,Millis,Async\n`;
    }
}
class Bench {
    nc;
    callbacks;
    msgs;
    size;
    subject;
    asyncRequests;
    pub;
    sub;
    req;
    rep;
    perf;
    payload;
    constructor(nc, opts = {
        msgs: 100000,
        size: 128,
        subject: "",
        asyncRequests: false,
        pub: false,
        sub: false,
        req: false,
        rep: false
    }){
        this.nc = nc;
        this.callbacks = opts.callbacks || false;
        this.msgs = opts.msgs || 0;
        this.size = opts.size || 0;
        this.subject = opts.subject || nuid.next();
        this.asyncRequests = opts.asyncRequests || false;
        this.pub = opts.pub || false;
        this.sub = opts.sub || false;
        this.req = opts.req || false;
        this.rep = opts.rep || false;
        this.perf = new Perf();
        this.payload = this.size ? new Uint8Array(this.size) : Empty;
        if (!this.pub && !this.sub && !this.req && !this.rep) {
            throw new Error("no bench option selected");
        }
    }
    async run() {
        this.nc.closed().then((err)=>{
            if (err) {
                throw new NatsError(`bench closed with an error: ${err.message}`, ErrorCode.Unknown, err);
            }
        });
        if (this.callbacks) {
            await this.runCallbacks();
        } else {
            await this.runAsync();
        }
        return this.processMetrics();
    }
    processMetrics() {
        const nc = this.nc;
        const { lang , version  } = nc.protocol.transport;
        if (this.pub && this.sub) {
            this.perf.measure("pubsub", "pubStart", "subStop");
        }
        const measures = this.perf.getEntries();
        const pubsub = measures.find((m)=>m.name === "pubsub"
        );
        const req = measures.find((m)=>m.name === "req"
        );
        const pub = measures.find((m)=>m.name === "pub"
        );
        const sub = measures.find((m)=>m.name === "sub"
        );
        const stats = this.nc.stats();
        const metrics = [];
        if (pubsub) {
            const { name , duration  } = pubsub;
            const m = new Metric(name, duration);
            m.msgs = this.msgs * 2;
            m.bytes = stats.inBytes + stats.outBytes;
            m.lang = lang;
            m.version = version;
            m.payload = this.payload.length;
            metrics.push(m);
        }
        if (pub) {
            const { name , duration  } = pub;
            const m = new Metric(name, duration);
            m.msgs = this.msgs;
            m.bytes = stats.outBytes;
            m.lang = lang;
            m.version = version;
            m.payload = this.payload.length;
            metrics.push(m);
        }
        if (sub) {
            const { name , duration  } = sub;
            const m = new Metric(name, duration);
            m.msgs = this.msgs;
            m.bytes = stats.inBytes;
            m.lang = lang;
            m.version = version;
            m.payload = this.payload.length;
            metrics.push(m);
        }
        if (req) {
            const { name , duration  } = req;
            const m = new Metric(name, duration);
            m.msgs = this.msgs * 2;
            m.bytes = stats.inBytes + stats.outBytes;
            m.lang = lang;
            m.version = version;
            m.payload = this.payload.length;
            metrics.push(m);
        }
        return metrics;
    }
    async runCallbacks() {
        const jobs = [];
        if (this.req) {
            const d = deferred();
            jobs.push(d);
            const sub = this.nc.subscribe(this.subject, {
                max: this.msgs,
                callback: (_, m)=>{
                    m.respond(this.payload);
                    if (sub.getProcessed() === this.msgs) {
                        d.resolve();
                    }
                }
            });
        }
        if (this.sub) {
            const d = deferred();
            jobs.push(d);
            let i59 = 0;
            this.nc.subscribe(this.subject, {
                max: this.msgs,
                callback: ()=>{
                    i59++;
                    if (i59 === 1) {
                        this.perf.mark("subStart");
                    }
                    if (i59 === this.msgs) {
                        this.perf.mark("subStop");
                        this.perf.measure("sub", "subStart", "subStop");
                        d.resolve();
                    }
                }
            });
        }
        if (this.pub) {
            const job = (async ()=>{
                this.perf.mark("pubStart");
                for(let i60 = 0; i60 < this.msgs; i60++){
                    this.nc.publish(this.subject, this.payload);
                }
                await this.nc.flush();
                this.perf.mark("pubStop");
                this.perf.measure("pub", "pubStart", "pubStop");
            })();
            jobs.push(job);
        }
        if (this.req) {
            const job = (async ()=>{
                if (this.asyncRequests) {
                    this.perf.mark("reqStart");
                    const a = [];
                    for(let i61 = 0; i61 < this.msgs; i61++){
                        a.push(this.nc.request(this.subject, this.payload, {
                            timeout: 20000
                        }));
                    }
                    await Promise.all(a);
                    this.perf.mark("reqStop");
                    this.perf.measure("req", "reqStart", "reqStop");
                } else {
                    this.perf.mark("reqStart");
                    for(let i62 = 0; i62 < this.msgs; i62++){
                        await this.nc.request(this.subject);
                    }
                    this.perf.mark("reqStop");
                    this.perf.measure("req", "reqStart", "reqStop");
                }
            })();
            jobs.push(job);
        }
        await Promise.all(jobs);
    }
    async runAsync() {
        const jobs = [];
        if (this.req) {
            const sub = this.nc.subscribe(this.subject, {
                max: this.msgs
            });
            const job = (async ()=>{
                for await (const m of sub){
                    m.respond(this.payload);
                }
            })();
            jobs.push(job);
        }
        if (this.sub) {
            let first = false;
            const sub = this.nc.subscribe(this.subject, {
                max: this.msgs
            });
            const job = (async ()=>{
                for await (const _m of sub){
                    if (!first) {
                        this.perf.mark("subStart");
                        first = true;
                    }
                }
                this.perf.mark("subStop");
                this.perf.measure("sub", "subStart", "subStop");
            })();
            jobs.push(job);
        }
        if (this.pub) {
            const job = (async ()=>{
                this.perf.mark("pubStart");
                for(let i63 = 0; i63 < this.msgs; i63++){
                    this.nc.publish(this.subject, this.payload);
                }
                await this.nc.flush();
                this.perf.mark("pubStop");
                this.perf.measure("pub", "pubStart", "pubStop");
            })();
            jobs.push(job);
        }
        if (this.req) {
            const job = (async ()=>{
                if (this.asyncRequests) {
                    this.perf.mark("reqStart");
                    const a = [];
                    for(let i64 = 0; i64 < this.msgs; i64++){
                        a.push(this.nc.request(this.subject, this.payload, {
                            timeout: 20000
                        }));
                    }
                    await Promise.all(a);
                    this.perf.mark("reqStop");
                    this.perf.measure("req", "reqStart", "reqStop");
                } else {
                    this.perf.mark("reqStart");
                    for(let i65 = 0; i65 < this.msgs; i65++){
                        await this.nc.request(this.subject);
                    }
                    this.perf.mark("reqStop");
                    this.perf.measure("req", "reqStart", "reqStop");
                }
            })();
            jobs.push(job);
        }
        await Promise.all(jobs);
    }
}
function throughput(bytes, seconds) {
    return humanizeBytes(bytes / seconds);
}
function humanizeBytes(bytes, si = false) {
    const base1 = si ? 1000 : 1024;
    const pre = si ? [
        "k",
        "M",
        "G",
        "T",
        "P",
        "E"
    ] : [
        "K",
        "M",
        "G",
        "T",
        "P",
        "E"
    ];
    const post = si ? "iB" : "B";
    if (bytes < base1) {
        return `${bytes.toFixed(2)} ${post}/sec`;
    }
    const exp = parseInt(Math.log(bytes) / Math.log(base1) + "");
    const index = parseInt(exp - 1 + "");
    return `${(bytes / Math.pow(base1, exp)).toFixed(2)} ${pre[index]}${post}/sec`;
}
function humanizeNumber(n) {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
export { AckPolicy as AckPolicy, AdvisoryKind as AdvisoryKind, Bench as Bench, canonicalMIMEHeaderKey as canonicalMIMEHeaderKey, checkJsError as checkJsError, consumerOpts as consumerOpts, createInbox as createInbox, credsAuthenticator as credsAuthenticator, DebugEvents as DebugEvents, deferred as deferred, DeliverPolicy as DeliverPolicy, DiscardPolicy as DiscardPolicy, Empty as Empty, ErrorCode as ErrorCode, Events as Events, headers as headers, isFlowControlMsg as isFlowControlMsg, isHeartbeatMsg as isHeartbeatMsg, JsHeaders as JsHeaders, JSONCodec as JSONCodec, jwtAuthenticator as jwtAuthenticator, Match as Match, Metric as Metric, millis as millis, MsgHdrsImpl as MsgHdrsImpl, nanos as nanos, NatsError as NatsError, nkeyAuthenticator as nkeyAuthenticator, Nuid as Nuid, nuid as nuid, ReplayPolicy as ReplayPolicy, RetentionPolicy as RetentionPolicy, StorageType as StorageType, StringCodec as StringCodec, toJsMsg as toJsMsg };
function defaultOptions() {
    return {
        maxPingOut: 2,
        maxReconnectAttempts: 10,
        noRandomize: false,
        pedantic: false,
        pingInterval: DEFAULT_PING_INTERVAL,
        reconnect: true,
        reconnectJitter: 100,
        reconnectJitterTLS: 1000,
        reconnectTimeWait: DEFAULT_RECONNECT_TIME_WAIT,
        tls: undefined,
        verbose: false,
        waitOnFirstConnect: false
    };
}
function parseOptions(opts) {
    const dhp = `${DEFAULT_HOST}:${defaultPort()}`;
    opts = opts || {
        servers: [
            dhp
        ]
    };
    opts.servers = opts.servers || [];
    if (typeof opts.servers === "string") {
        opts.servers = [
            opts.servers
        ];
    }
    if (opts.servers.length > 0 && opts.port) {
        throw new NatsError("port and servers options are mutually exclusive", ErrorCode.InvalidOption);
    }
    if (opts.servers.length === 0 && opts.port) {
        opts.servers = [
            `${DEFAULT_HOST}:${opts.port}`
        ];
    }
    if (opts.servers && opts.servers.length === 0) {
        opts.servers = [
            dhp
        ];
    }
    const options = extend(defaultOptions(), opts);
    if (opts.user && opts.token) {
        throw NatsError.errorForCode(ErrorCode.BadAuthentication);
    }
    if (opts.authenticator && (opts.token || opts.user || opts.pass)) {
        throw NatsError.errorForCode(ErrorCode.BadAuthentication);
    }
    options.authenticator = buildAuthenticator(options);
    [
        "reconnectDelayHandler",
        "authenticator"
    ].forEach((n)=>{
        if (options[n] && typeof options[n] !== "function") {
            throw new NatsError(`${n} option should be a function`, ErrorCode.NotFunction);
        }
    });
    if (!options.reconnectDelayHandler) {
        options.reconnectDelayHandler = ()=>{
            let extra = options.tls ? options.reconnectJitterTLS : options.reconnectJitter;
            if (extra) {
                extra++;
                extra = Math.floor(Math.random() * extra);
            }
            return options.reconnectTimeWait + extra;
        };
    }
    if (options.inboxPrefix) {
        try {
            createInbox(options.inboxPrefix);
        } catch (err) {
            throw new NatsError(err.message, ErrorCode.ApiError);
        }
    }
    if (options.resolve) {
        if (typeof getResolveFn() !== "function") {
            throw new NatsError(`'resolve' is not supported on this client`, ErrorCode.InvalidOption);
        }
    }
    return options;
}
var PubHeaders;
(function(PubHeaders1) {
    PubHeaders1["MsgIdHdr"] = "Nats-Msg-Id";
    PubHeaders1["ExpectedStreamHdr"] = "Nats-Expected-Stream";
    PubHeaders1["ExpectedLastSeqHdr"] = "Nats-Expected-Last-Sequence";
    PubHeaders1["ExpectedLastMsgIdHdr"] = "Nats-Expected-Last-Msg-Id";
    PubHeaders1["ExpectedLastSubjectSequenceHdr"] = "Nats-Expected-Last-Subject-Sequence";
})(PubHeaders || (PubHeaders = {}));
function NoopKvCodecs() {
    return {
        key: {
            encode (k) {
                return k;
            },
            decode (k) {
                return k;
            }
        },
        value: {
            encode (v) {
                return v;
            },
            decode (v) {
                return v;
            }
        }
    };
}
function defaultBucketOpts() {
    return {
        replicas: 1,
        history: 1,
        timeout: 2000,
        maxBucketSize: -1,
        maxValueSize: -1,
        codec: NoopKvCodecs(),
        storage: StorageType.File
    };
}
const kvOperationHdr = "KV-Operation";
const kvPrefix = "KV_";
const kvSubjectPrefix = "$KV";
const validKeyRe = /^[-/=.\w]+$/;
const validSearchKey = /^[-/=.>*\w]+$/;
const validBucketRe = /^[-\w]+$/;
function validateKey(k) {
    if (k.startsWith(".") || k.endsWith(".") || !validKeyRe.test(k)) {
        throw new Error(`invalid key: ${k}`);
    }
}
function validateSearchKey(k) {
    if (k.startsWith(".") || k.endsWith(".") || !validSearchKey.test(k)) {
        throw new Error(`invalid key: ${k}`);
    }
}
function hasWildcards(k) {
    if (k.startsWith(".") || k.endsWith(".")) {
        throw new Error(`invalid key: ${k}`);
    }
    const chunks = k.split(".");
    let hasWildcards1 = false;
    for(let i66 = 0; i66 < chunks.length; i66++){
        switch(chunks[i66]){
            case "*":
                hasWildcards1 = true;
                break;
            case ">":
                if (i66 !== chunks.length - 1) {
                    throw new Error(`invalid key: ${k}`);
                }
                hasWildcards1 = true;
                break;
            default:
        }
    }
    return hasWildcards1;
}
function validateBucket(name) {
    if (!validBucketRe.test(name)) {
        throw new Error(`invalid bucket name: ${name}`);
    }
}
class Bucket {
    jsm;
    js;
    stream;
    bucket;
    codec;
    _prefixLen;
    subjPrefix;
    constructor(bucket, jsm, js){
        validateBucket(bucket);
        this.jsm = jsm;
        this.js = js;
        this.bucket = bucket;
        this._prefixLen = 0;
        this.subjPrefix = kvSubjectPrefix;
        const jsi = js;
        const prefix = jsi.prefix || "$JS.API";
        if (prefix !== "$JS.API") {
            this.subjPrefix = `${prefix}.${kvSubjectPrefix}`;
        }
    }
    static async create(js, name, opts = {}) {
        validateBucket(name);
        const to = opts.timeout || 2000;
        const jsi = js;
        let jsopts = jsi.opts || {};
        jsopts = Object.assign(jsopts, {
            timeout: to
        });
        const jsm = await jsi.nc.jetstreamManager(jsopts);
        const bucket = new Bucket(name, jsm, js);
        await bucket.init(opts);
        return bucket;
    }
    async init(opts = {}) {
        const bo = Object.assign(defaultBucketOpts(), opts);
        this.codec = bo.codec;
        const sc = {};
        this.stream = sc.name = opts.streamName ?? this.bucketName();
        sc.subjects = [
            this.subjectForBucket()
        ];
        sc.retention = RetentionPolicy.Limits;
        sc.max_msgs_per_subject = bo.history;
        sc.max_bytes = bo.maxBucketSize;
        sc.max_msg_size = bo.maxValueSize;
        sc.storage = bo.storage;
        sc.discard = DiscardPolicy.Old;
        sc.num_replicas = bo.replicas;
        if (bo.ttl) {
            sc.max_age = nanos(bo.ttl);
        }
        sc.allow_rollup_hdrs = true;
        try {
            await this.jsm.streams.info(sc.name);
        } catch (err) {
            if (err.message === "stream not found") {
                await this.jsm.streams.add(sc);
            }
        }
    }
    bucketName() {
        return this.stream ?? `${kvPrefix}${this.bucket}`;
    }
    subjectForBucket() {
        return `${this.subjPrefix}.${this.bucket}.>`;
    }
    subjectForKey(k) {
        return `${this.subjPrefix}.${this.bucket}.${k}`;
    }
    fullKeyName(k) {
        return `${kvSubjectPrefix}.${this.bucket}.${k}`;
    }
    get prefixLen() {
        if (this._prefixLen === 0) {
            this._prefixLen = `${kvSubjectPrefix}.${this.bucket}.`.length;
        }
        return this._prefixLen;
    }
    encodeKey(key) {
        const chunks = [];
        for (const t of key.split(".")){
            switch(t){
                case ">":
                case "*":
                    chunks.push(t);
                    break;
                default:
                    chunks.push(this.codec.key.encode(t));
                    break;
            }
        }
        return chunks.join(".");
    }
    decodeKey(ekey) {
        const chunks = [];
        for (const t of ekey.split(".")){
            switch(t){
                case ">":
                case "*":
                    chunks.push(t);
                    break;
                default:
                    chunks.push(this.codec.key.decode(t));
                    break;
            }
        }
        return chunks.join(".");
    }
    validateKey = validateKey;
    validateSearchKey = validateSearchKey;
    hasWildcards = hasWildcards;
    close() {
        return Promise.resolve();
    }
    dataLen(data, h) {
        const slen = h ? h.get(JsHeaders.MessageSizeHdr) || "" : "";
        if (slen !== "") {
            return parseInt(slen, 10);
        }
        return data.length;
    }
    smToEntry(key, sm) {
        return {
            bucket: this.bucket,
            key: key,
            value: sm.data,
            delta: 0,
            created: sm.time,
            revision: sm.seq,
            operation: sm.header.get(kvOperationHdr) || "PUT",
            length: this.dataLen(sm.data, sm.header)
        };
    }
    jmToEntry(k, jm) {
        const key = this.decodeKey(jm.subject.substring(this.prefixLen));
        return {
            bucket: this.bucket,
            key: key,
            value: jm.data,
            created: new Date(millis(jm.info.timestampNanos)),
            revision: jm.seq,
            operation: jm.headers?.get(kvOperationHdr) || "PUT",
            delta: jm.info.pending,
            length: this.dataLen(jm.data, jm.headers)
        };
    }
    create(k, data) {
        return this.put(k, data, {
            previousSeq: 0
        });
    }
    update(k, data, version) {
        if (version <= 0) {
            throw new Error("version must be greater than 0");
        }
        return this.put(k, data, {
            previousSeq: version
        });
    }
    async put(k, data, opts = {}) {
        const ek = this.encodeKey(k);
        this.validateKey(ek);
        const o = {};
        if (opts.previousSeq !== undefined) {
            const h = headers();
            o.headers = h;
            h.set("Nats-Expected-Last-Subject-Sequence", `${opts.previousSeq}`);
        }
        const pa = await this.js.publish(this.subjectForKey(ek), data, o);
        return pa.seq;
    }
    async get(k) {
        const ek = this.encodeKey(k);
        this.validateKey(ek);
        try {
            const sm = await this.jsm.streams.getMessage(this.bucketName(), {
                last_by_subj: this.fullKeyName(ek)
            });
            return this.smToEntry(k, sm);
        } catch (err) {
            if (err.message === "no message found") {
                return null;
            }
            throw err;
        }
    }
    purge(k) {
        return this._deleteOrPurge(k, "PURGE");
    }
    delete(k) {
        return this._deleteOrPurge(k, "DEL");
    }
    async _deleteOrPurge(k, op) {
        if (!this.hasWildcards(k)) {
            return this._doDeleteOrPurge(k, op);
        }
        const iter = await this.keys(k);
        const buf = [];
        for await (const k1 of iter){
            buf.push(this._doDeleteOrPurge(k1, op));
            if (buf.length === 100) {
                await Promise.all(buf);
                buf.length = 0;
            }
        }
        if (buf.length > 0) {
            await Promise.all(buf);
        }
    }
    async _doDeleteOrPurge(k, op) {
        const ek = this.encodeKey(k);
        this.validateKey(ek);
        const h = headers();
        h.set(kvOperationHdr, op);
        if (op === "PURGE") {
            h.set(JsHeaders.RollupHdr, JsHeaders.RollupValueSubject);
        }
        await this.js.publish(this.subjectForKey(ek), Empty, {
            headers: h
        });
    }
    _buildCC(k, history = false, opts = {}) {
        const ek = this.encodeKey(k);
        this.validateSearchKey(k);
        return Object.assign({
            "deliver_policy": history ? DeliverPolicy.All : DeliverPolicy.LastPerSubject,
            "ack_policy": AckPolicy.None,
            "filter_subject": this.fullKeyName(ek),
            "flow_control": true,
            "idle_heartbeat": nanos(5 * 1000)
        }, opts);
    }
    remove(k) {
        return this.purge(k);
    }
    async history(opts = {}) {
        const k = opts.key ?? ">";
        const qi = new QueuedIteratorImpl();
        const done = deferred();
        const co = {};
        co.headers_only = opts.headers_only || false;
        const cc2 = this._buildCC(k, true, co);
        const subj = cc2.filter_subject;
        const copts = consumerOpts(cc2);
        copts.orderedConsumer();
        copts.callback((err, jm)=>{
            if (err) {
                qi.stop(err);
                return;
            }
            if (jm) {
                const e = this.jmToEntry(k, jm);
                qi.push(e);
                qi.received++;
                if (jm.info.pending === 0) {
                    done.resolve();
                }
            }
        });
        const sub = await this.js.subscribe(subj, copts);
        done.then(()=>{
            sub.unsubscribe();
        });
        done.catch((_err)=>{
            sub.unsubscribe();
        });
        qi.iterClosed.then(()=>{
            sub.unsubscribe();
        });
        sub.closed.then(()=>{
            qi.stop();
        }).catch((err)=>{
            qi.stop(err);
        });
        this.jsm.streams.getMessage(this.stream, {
            "last_by_subj": subj
        }).catch(()=>{
            done.resolve();
        });
        return qi;
    }
    async watch(opts = {}) {
        const k = opts.key ?? ">";
        const qi = new QueuedIteratorImpl();
        const co = {};
        co.headers_only = opts.headers_only || false;
        const cc3 = this._buildCC(k, false, co);
        const subj = cc3.filter_subject;
        const copts = consumerOpts(cc3);
        copts.orderedConsumer();
        copts.callback((err, jm)=>{
            if (err) {
                qi.stop(err);
                return;
            }
            if (jm) {
                const e = this.jmToEntry(k, jm);
                qi.push(e);
                qi.received++;
            }
        });
        const sub = await this.js.subscribe(subj, copts);
        qi._data = sub;
        qi.iterClosed.then(()=>{
            sub.unsubscribe();
        });
        sub.closed.then(()=>{
            qi.stop();
        }).catch((err)=>{
            qi.stop(err);
        });
        return qi;
    }
    async keys(k = ">") {
        const keys = new QueuedIteratorImpl();
        const cc4 = this._buildCC(k, false, {
            headers_only: true
        });
        const subj = cc4.filter_subject;
        const copts = consumerOpts(cc4);
        copts.orderedConsumer();
        const sub = await this.js.subscribe(subj, copts);
        (async ()=>{
            for await (const jm of sub){
                const op = jm.headers?.get(kvOperationHdr);
                if (op !== "DEL" && op !== "PURGE") {
                    const key = this.decodeKey(jm.subject.substring(this.prefixLen));
                    keys.push(key);
                }
                if (jm.info.pending === 0) {
                    sub.unsubscribe();
                }
            }
        })().then(()=>{
            keys.stop();
        }).catch((err)=>{
            keys.stop(err);
        });
        const si = sub;
        if (si.info.last.num_pending === 0) {
            sub.unsubscribe();
        }
        return keys;
    }
    purgeBucket(opts) {
        return this.jsm.streams.purge(this.bucketName(), opts);
    }
    destroy() {
        return this.jsm.streams.delete(this.bucketName());
    }
    async status() {
        const ji = this.js;
        const cluster = ji.nc.info?.cluster ?? "";
        const si = await this.jsm.streams.info(this.bucketName());
        return {
            bucket: this.bucketName(),
            values: si.state.messages,
            history: si.config.max_msgs_per_subject,
            ttl: si.config.max_age,
            bucket_location: cluster,
            backingStore: si.config.storage
        };
    }
}
class ViewsImpl {
    js;
    constructor(js){
        this.js = js;
        jetstreamPreview(this.js.nc);
    }
    kv(name, opts = {}) {
        return Bucket.create(this.js, name, opts);
    }
}
class JetStreamClientImpl extends BaseApiClient {
    api;
    constructor(nc, opts){
        super(nc, opts);
        this.api = new ConsumerAPIImpl(nc, opts);
    }
    get views() {
        return new ViewsImpl(this);
    }
    async publish(subj, data = Empty, opts) {
        opts = opts || {};
        opts.expect = opts.expect || {};
        const mh = opts?.headers || headers();
        if (opts) {
            if (opts.msgID) {
                mh.set(PubHeaders.MsgIdHdr, opts.msgID);
            }
            if (opts.expect.lastMsgID) {
                mh.set(PubHeaders.ExpectedLastMsgIdHdr, opts.expect.lastMsgID);
            }
            if (opts.expect.streamName) {
                mh.set(PubHeaders.ExpectedStreamHdr, opts.expect.streamName);
            }
            if (opts.expect.lastSequence) {
                mh.set(PubHeaders.ExpectedLastSeqHdr, `${opts.expect.lastSequence}`);
            }
            if (opts.expect.lastSubjectSequence) {
                mh.set(PubHeaders.ExpectedLastSubjectSequenceHdr, `${opts.expect.lastSubjectSequence}`);
            }
        }
        const to = opts.timeout || this.timeout;
        const ro = {};
        if (to) {
            ro.timeout = to;
        }
        if (opts) {
            ro.headers = mh;
        }
        const r = await this.nc.request(subj, data, ro);
        const pa = this.parseJsResponse(r);
        if (pa.stream === "") {
            throw NatsError.errorForCode(ErrorCode.JetStreamInvalidAck);
        }
        pa.duplicate = pa.duplicate ? pa.duplicate : false;
        return pa;
    }
    async pull(stream, durable) {
        validateStreamName(stream);
        validateDurableName(durable);
        const msg = await this.nc.request(`${this.prefix}.CONSUMER.MSG.NEXT.${stream}.${durable}`, this.jc.encode({
            no_wait: true,
            batch: 1,
            expires: 0
        }), {
            noMux: true,
            timeout: this.timeout
        });
        const err = checkJsError(msg);
        if (err) {
            throw err;
        }
        return toJsMsg(msg);
    }
    fetch(stream, durable, opts = {}) {
        validateStreamName(stream);
        validateDurableName(durable);
        let timer = null;
        const args = {};
        args.batch = opts.batch || 1;
        args.no_wait = opts.no_wait || false;
        if (args.no_wait && args.expires) {
            args.expires = 0;
        }
        const expires = opts.expires || 0;
        if (expires) {
            args.expires = nanos(expires);
        }
        if (expires === 0 && args.no_wait === false) {
            throw new Error("expires or no_wait is required");
        }
        const qi = new QueuedIteratorImpl();
        const wants = args.batch;
        let received = 0;
        qi.dispatchedFn = (m)=>{
            if (m) {
                received++;
                if (timer && m.info.pending === 0) {
                    return;
                }
                if (qi.getPending() === 1 && m.info.pending === 0 || wants === received) {
                    qi.stop();
                }
            }
        };
        const inbox = createInbox(this.nc.options.inboxPrefix);
        const sub = this.nc.subscribe(inbox, {
            max: opts.batch,
            callback: (err, msg)=>{
                if (err === null) {
                    err = checkJsError(msg);
                }
                if (err !== null) {
                    if (timer) {
                        timer.cancel();
                        timer = null;
                    }
                    if (isNatsError(err) && (err.code === ErrorCode.JetStream404NoMessages || err.code === ErrorCode.JetStream408RequestTimeout)) {
                        qi.stop();
                    } else {
                        qi.stop(err);
                    }
                } else {
                    qi.received++;
                    qi.push(toJsMsg(msg));
                }
            }
        });
        if (expires) {
            timer = timeout(expires);
            timer.catch(()=>{
                if (!sub.isClosed()) {
                    sub.drain();
                    timer = null;
                }
            });
        }
        (async ()=>{
            await sub.closed;
            if (timer !== null) {
                timer.cancel();
                timer = null;
            }
            qi.stop();
        })().catch();
        this.nc.publish(`${this.prefix}.CONSUMER.MSG.NEXT.${stream}.${durable}`, this.jc.encode(args), {
            reply: inbox
        });
        return qi;
    }
    async pullSubscribe(subject, opts = consumerOpts()) {
        const cso = await this._processOptions(subject, opts);
        if (cso.ordered) {
            throw new Error("pull subscribers cannot be be ordered");
        }
        if (!cso.attached) {
            cso.config.filter_subject = subject;
        }
        if (cso.config.deliver_subject) {
            throw new Error("consumer info specifies deliver_subject - pull consumers cannot have deliver_subject set");
        }
        const ackPolicy = cso.config.ack_policy;
        if (ackPolicy === AckPolicy.None || ackPolicy === AckPolicy.All) {
            throw new Error("ack policy for pull consumers must be explicit");
        }
        const so = this._buildTypedSubscriptionOpts(cso);
        const sub = new JetStreamPullSubscriptionImpl(this, cso.deliver, so);
        sub.info = cso;
        try {
            await this._maybeCreateConsumer(cso);
        } catch (err) {
            sub.unsubscribe();
            throw err;
        }
        return sub;
    }
    async subscribe(subject, opts = consumerOpts()) {
        const cso = await this._processOptions(subject, opts);
        if (!cso.config.deliver_subject) {
            throw new Error("consumer info specifies a pull consumer - deliver_subject is required");
        }
        const so = this._buildTypedSubscriptionOpts(cso);
        const sub = new JetStreamSubscriptionImpl(this, cso.deliver, so);
        sub.info = cso;
        try {
            await this._maybeCreateConsumer(cso);
        } catch (err) {
            sub.unsubscribe();
            throw err;
        }
        return sub;
    }
    async _processOptions(subject, opts = consumerOpts()) {
        const jsi = isConsumerOptsBuilder(opts) ? opts.getOpts() : opts;
        jsi.isBind = isConsumerOptsBuilder(opts) ? opts.isBind : false;
        jsi.flow_control = {
            heartbeat_count: 0,
            fc_count: 0,
            consumer_restarts: 0
        };
        if (jsi.ordered) {
            jsi.ordered_consumer_sequence = {
                stream_seq: 0,
                delivery_seq: 0
            };
            if (jsi.config.ack_policy !== AckPolicy.NotSet && jsi.config.ack_policy !== AckPolicy.None) {
                throw new NatsError("ordered consumer: ack_policy can only be set to 'none'", ErrorCode.ApiError);
            }
            if (jsi.config.durable_name && jsi.config.durable_name.length > 0) {
                throw new NatsError("ordered consumer: durable_name cannot be set", ErrorCode.ApiError);
            }
            if (jsi.config.deliver_subject && jsi.config.deliver_subject.length > 0) {
                throw new NatsError("ordered consumer: deliver_subject cannot be set", ErrorCode.ApiError);
            }
            if (jsi.config.max_deliver !== undefined && jsi.config.max_deliver > 1) {
                throw new NatsError("ordered consumer: max_deliver cannot be set", ErrorCode.ApiError);
            }
            if (jsi.config.deliver_group && jsi.config.deliver_group.length > 0) {
                throw new NatsError("ordered consumer: deliver_group cannot be set", ErrorCode.ApiError);
            }
            jsi.config.deliver_subject = createInbox(this.nc.options.inboxPrefix);
            jsi.config.ack_policy = AckPolicy.None;
            jsi.config.max_deliver = 1;
            jsi.config.flow_control = true;
            jsi.config.idle_heartbeat = jsi.config.idle_heartbeat || nanos(5000);
            jsi.config.ack_wait = nanos(22 * 60 * 60 * 1000);
        }
        if (jsi.config.ack_policy === AckPolicy.NotSet) {
            jsi.config.ack_policy = AckPolicy.All;
        }
        jsi.api = this;
        jsi.config = jsi.config || {};
        jsi.stream = jsi.stream ? jsi.stream : await this.findStream(subject);
        jsi.attached = false;
        if (jsi.config.durable_name) {
            try {
                const info = await this.api.info(jsi.stream, jsi.config.durable_name);
                if (info) {
                    if (info.config.filter_subject && info.config.filter_subject !== subject) {
                        throw new Error("subject does not match consumer");
                    }
                    const qn = jsi.config.deliver_group ?? "";
                    const rqn = info.config.deliver_group ?? "";
                    if (qn !== rqn) {
                        if (rqn === "") {
                            throw new Error(`durable requires no queue group`);
                        } else {
                            throw new Error(`durable requires queue group '${rqn}'`);
                        }
                    }
                    jsi.last = info;
                    jsi.config = info.config;
                    jsi.attached = true;
                }
            } catch (err) {
                if (err.code !== "404") {
                    throw err;
                }
            }
        }
        if (!jsi.attached) {
            jsi.config.filter_subject = subject;
        }
        jsi.deliver = jsi.config.deliver_subject || createInbox(this.nc.options.inboxPrefix);
        return jsi;
    }
    _buildTypedSubscriptionOpts(jsi) {
        const so = {};
        so.adapter = msgAdapter(jsi.callbackFn === undefined);
        so.ingestionFilterFn = JetStreamClientImpl.ingestionFn(jsi.ordered);
        so.protocolFilterFn = (jm, ingest = false)=>{
            const jsmi = jm;
            if (isFlowControlMsg(jsmi.msg)) {
                if (!ingest) {
                    jsmi.msg.respond();
                }
                return false;
            }
            return true;
        };
        if (!jsi.mack && jsi.config.ack_policy !== AckPolicy.None) {
            so.dispatchedFn = autoAckJsMsg;
        }
        if (jsi.callbackFn) {
            so.callback = jsi.callbackFn;
        }
        so.max = jsi.max || 0;
        so.queue = jsi.queue;
        return so;
    }
    async _maybeCreateConsumer(jsi) {
        if (jsi.attached) {
            return;
        }
        if (jsi.isBind) {
            throw new Error(`unable to bind - durable consumer ${jsi.config.durable_name} doesn't exist in ${jsi.stream}`);
        }
        jsi.config = Object.assign({
            deliver_policy: DeliverPolicy.All,
            ack_policy: AckPolicy.Explicit,
            ack_wait: nanos(30 * 1000),
            replay_policy: ReplayPolicy.Instant
        }, jsi.config);
        const ci = await this.api.add(jsi.stream, jsi.config);
        jsi.name = ci.name;
        jsi.config = ci.config;
        jsi.last = ci;
    }
    static ingestionFn(ordered) {
        return (jm, ctx)=>{
            const jsub = ctx;
            if (!jm) return {
                ingest: false,
                protocol: false
            };
            const jmi = jm;
            if (isHeartbeatMsg(jmi.msg)) {
                const ingest = ordered ? jsub._checkHbOrderConsumer(jmi.msg) : true;
                if (!ordered) {
                    jsub.info.flow_control.heartbeat_count++;
                }
                return {
                    ingest,
                    protocol: true
                };
            } else if (isFlowControlMsg(jmi.msg)) {
                jsub.info.flow_control.fc_count++;
                return {
                    ingest: true,
                    protocol: true
                };
            }
            const ingest = ordered ? jsub._checkOrderedConsumer(jm) : true;
            return {
                ingest,
                protocol: false
            };
        };
    }
}
class NatsConnectionImpl {
    options;
    protocol;
    draining;
    listeners;
    constructor(opts){
        this.draining = false;
        this.options = parseOptions(opts);
        this.listeners = [];
    }
    static connect(opts = {}) {
        return new Promise((resolve, reject)=>{
            const nc = new NatsConnectionImpl(opts);
            ProtocolHandler.connect(nc.options, nc).then((ph)=>{
                nc.protocol = ph;
                (async function() {
                    for await (const s of ph.status()){
                        nc.listeners.forEach((l5)=>{
                            l5.push(s);
                        });
                    }
                })();
                resolve(nc);
            }).catch((err)=>{
                reject(err);
            });
        });
    }
    closed() {
        return this.protocol.closed;
    }
    async close() {
        await this.protocol.close();
    }
    _check(subject, sub, pub) {
        if (this.isClosed()) {
            throw NatsError.errorForCode(ErrorCode.ConnectionClosed);
        }
        if (sub && this.isDraining()) {
            throw NatsError.errorForCode(ErrorCode.ConnectionDraining);
        }
        if (pub && this.protocol.noMorePublishing) {
            throw NatsError.errorForCode(ErrorCode.ConnectionDraining);
        }
        subject = subject || "";
        if (subject.length === 0) {
            throw NatsError.errorForCode(ErrorCode.BadSubject);
        }
    }
    publish(subject, data = Empty, options) {
        this._check(subject, false, true);
        if (data && !isUint8Array(data)) {
            throw NatsError.errorForCode(ErrorCode.BadPayload);
        }
        this.protocol.publish(subject, data, options);
    }
    subscribe(subject, opts = {}) {
        this._check(subject, true, false);
        const sub = new SubscriptionImpl(this.protocol, subject, opts);
        this.protocol.subscribe(sub);
        return sub;
    }
    _resub(s, subject, max) {
        this._check(subject, true, false);
        const si = s;
        si.max = max;
        if (max) {
            si.max = max + si.received;
        }
        this.protocol.resub(si, subject);
    }
    request(subject, data = Empty, opts = {
        timeout: 1000,
        noMux: false
    }) {
        try {
            this._check(subject, true, true);
        } catch (err1) {
            return Promise.reject(err1);
        }
        opts.timeout = opts.timeout || 1000;
        if (opts.timeout < 1) {
            return Promise.reject(new NatsError("timeout", ErrorCode.InvalidOption));
        }
        if (!opts.noMux && opts.reply) {
            return Promise.reject(new NatsError("reply can only be used with noMux", ErrorCode.InvalidOption));
        }
        if (opts.noMux) {
            const inbox = opts.reply ? opts.reply : createInbox(this.options.inboxPrefix);
            const d = deferred();
            const errCtx = new Error();
            this.subscribe(inbox, {
                max: 1,
                timeout: opts.timeout,
                callback: (err, msg)=>{
                    if (err) {
                        if (err.code !== ErrorCode.Timeout) {
                            err.stack += `\n\n${errCtx.stack}`;
                        }
                        d.reject(err);
                    } else {
                        err = isRequestError(msg);
                        if (err) {
                            err.stack += `\n\n${errCtx.stack}`;
                            d.reject(err);
                        } else {
                            d.resolve(msg);
                        }
                    }
                }
            });
            this.protocol.publish(subject, data, {
                reply: inbox
            });
            return d;
        } else {
            const r = new Request(this.protocol.muxSubscriptions, opts);
            this.protocol.request(r);
            try {
                this.publish(subject, data, {
                    reply: `${this.protocol.muxSubscriptions.baseInbox}${r.token}`,
                    headers: opts.headers
                });
            } catch (err) {
                r.cancel(err);
            }
            const p = Promise.race([
                r.timer,
                r.deferred
            ]);
            p.catch(()=>{
                r.cancel();
            });
            return p;
        }
    }
    flush() {
        if (this.isClosed()) {
            return Promise.reject(NatsError.errorForCode(ErrorCode.ConnectionClosed));
        }
        return this.protocol.flush();
    }
    drain() {
        if (this.isClosed()) {
            return Promise.reject(NatsError.errorForCode(ErrorCode.ConnectionClosed));
        }
        if (this.isDraining()) {
            return Promise.reject(NatsError.errorForCode(ErrorCode.ConnectionDraining));
        }
        this.draining = true;
        return this.protocol.drain();
    }
    isClosed() {
        return this.protocol.isClosed();
    }
    isDraining() {
        return this.draining;
    }
    getServer() {
        const srv = this.protocol.getServer();
        return srv ? srv.listen : "";
    }
    status() {
        const iter = new QueuedIteratorImpl();
        this.listeners.push(iter);
        return iter;
    }
    get info() {
        return this.protocol.isClosed() ? undefined : this.protocol.info;
    }
    stats() {
        return {
            inBytes: this.protocol.inBytes,
            outBytes: this.protocol.outBytes,
            inMsgs: this.protocol.inMsgs,
            outMsgs: this.protocol.outMsgs
        };
    }
    async jetstreamManager(opts = {}) {
        const adm = new JetStreamManagerImpl(this, opts);
        try {
            await adm.getAccountInfo();
        } catch (err) {
            let ne = err;
            if (ne.code === ErrorCode.NoResponders) {
                ne.code = ErrorCode.JetStreamNotEnabled;
            }
            throw ne;
        }
        return adm;
    }
    jetstream(opts = {}) {
        return new JetStreamClientImpl(this, opts);
    }
}
function checkOptions(info, options) {
    const { proto , tls_required: tlsRequired  } = info;
    if ((proto === undefined || proto < 1) && options.noEcho) {
        throw new NatsError("noEcho", ErrorCode.ServerOptionNotAvailable);
    }
    if (options.tls && !tlsRequired) {
        throw new NatsError("tls", ErrorCode.ServerOptionNotAvailable);
    }
}
class JetStreamSubscriptionImpl extends TypedSubscription {
    js;
    constructor(js, subject, opts){
        super(js.nc, subject, opts);
        this.js = js;
    }
    set info(info) {
        this.sub.info = info;
    }
    get info() {
        return this.sub.info;
    }
    _resetOrderedConsumer(sseq) {
        if (this.info === null || this.sub.isClosed()) {
            return;
        }
        const newDeliver = createInbox(this.js.nc.options.inboxPrefix);
        const nci = this.js.nc;
        nci._resub(this.sub, newDeliver);
        const info = this.info;
        info.ordered_consumer_sequence.delivery_seq = 0;
        info.flow_control.heartbeat_count = 0;
        info.flow_control.fc_count = 0;
        info.flow_control.consumer_restarts++;
        info.deliver = newDeliver;
        info.config.deliver_subject = newDeliver;
        info.config.deliver_policy = DeliverPolicy.StartSequence;
        info.config.opt_start_seq = sseq;
        const subj = `${info.api.prefix}.CONSUMER.CREATE.${info.stream}`;
        this.js._request(subj, this.info.config).catch((err)=>{
            const nerr = new NatsError(`unable to recreate ordered consumer ${info.stream} at seq ${sseq}`, ErrorCode.RequestError, err);
            this.sub.callback(nerr, {});
        });
    }
    _checkHbOrderConsumer(msg) {
        const rm = msg.headers.get(JsHeaders.ConsumerStalledHdr);
        if (rm !== "") {
            const nci = this.js.nc;
            nci.publish(rm);
        }
        const lastDelivered = parseInt(msg.headers.get(JsHeaders.LastConsumerSeqHdr), 10);
        const ordered = this.info.ordered_consumer_sequence;
        this.info.flow_control.heartbeat_count++;
        if (lastDelivered !== ordered.delivery_seq) {
            this._resetOrderedConsumer(ordered.stream_seq + 1);
        }
        return false;
    }
    _checkOrderedConsumer(jm) {
        const ordered = this.info.ordered_consumer_sequence;
        const sseq = jm.info.streamSequence;
        const dseq = jm.info.deliverySequence;
        if (dseq != ordered.delivery_seq + 1) {
            this._resetOrderedConsumer(ordered.stream_seq + 1);
            return false;
        }
        ordered.delivery_seq = dseq;
        ordered.stream_seq = sseq;
        return true;
    }
    async destroy() {
        if (!this.isClosed()) {
            await this.drain();
        }
        const jinfo = this.sub.info;
        const name = jinfo.config.durable_name || jinfo.name;
        const subj = `${jinfo.api.prefix}.CONSUMER.DELETE.${jinfo.stream}.${name}`;
        await jinfo.api._request(subj);
    }
    async consumerInfo() {
        const jinfo = this.sub.info;
        const name = jinfo.config.durable_name || jinfo.name;
        const subj = `${jinfo.api.prefix}.CONSUMER.INFO.${jinfo.stream}.${name}`;
        const ci = await jinfo.api._request(subj);
        jinfo.last = ci;
        return ci;
    }
}
class JetStreamPullSubscriptionImpl extends JetStreamSubscriptionImpl {
    constructor(js, subject, opts){
        super(js, subject, opts);
    }
    pull(opts = {
        batch: 1
    }) {
        const { stream , config , name  } = this.sub.info;
        const consumer = config.durable_name ?? name;
        const args = {};
        args.batch = opts.batch || 1;
        args.no_wait = opts.no_wait || false;
        if (opts.expires && opts.expires > 0) {
            args.expires = nanos(opts.expires);
        }
        if (this.info) {
            const api = this.info.api;
            const subj = `${api.prefix}.CONSUMER.MSG.NEXT.${stream}.${consumer}`;
            const reply = this.sub.subject;
            api.nc.publish(subj, api.jc.encode(args), {
                reply: reply
            });
        }
    }
}
function msgAdapter(iterator) {
    if (iterator) {
        return iterMsgAdapter;
    } else {
        return cbMsgAdapter;
    }
}
function cbMsgAdapter(err, msg) {
    if (err) {
        return [
            err,
            null
        ];
    }
    err = checkJsError(msg);
    if (err) {
        return [
            err,
            null
        ];
    }
    return [
        null,
        toJsMsg(msg)
    ];
}
function iterMsgAdapter(err, msg) {
    if (err) {
        return [
            err,
            null
        ];
    }
    const ne = checkJsError(msg);
    if (ne !== null) {
        switch(ne.code){
            case ErrorCode.JetStream404NoMessages:
            case ErrorCode.JetStream408RequestTimeout:
            case ErrorCode.JetStream409MaxAckPendingExceeded:
                return [
                    null,
                    null
                ];
            default:
                return [
                    ne,
                    null
                ];
        }
    }
    return [
        null,
        toJsMsg(msg)
    ];
}
function autoAckJsMsg(data) {
    if (data) {
        data.ack();
    }
}
const jetstreamPreview = (()=>{
    let once = false;
    return (nci)=>{
        if (!once) {
            once = true;
            const { lang  } = nci?.protocol?.transport;
            if (lang) {
                console.log(`\u001B[33m >> jetstream's materialized views functionality in ${lang} is beta functionality \u001B[0m`);
            } else {
                console.log(`\u001B[33m >> jetstream's materialized views functionality is beta functionality \u001B[0m`);
            }
        }
    };
})();
const VERSION = "1.7.2";
const LANG = "nats.ws";
class WsTransport {
    version;
    lang;
    closeError;
    connected;
    done;
    socket;
    options;
    socketClosed;
    encrypted;
    peeked;
    yields;
    signal;
    closedNotification;
    constructor(){
        this.version = VERSION;
        this.lang = LANG;
        this.connected = false;
        this.done = false;
        this.socketClosed = false;
        this.encrypted = false;
        this.peeked = false;
        this.yields = [];
        this.signal = deferred();
        this.closedNotification = deferred();
    }
    connect(server, options) {
        const connected = false;
        const connLock = deferred();
        if (options.tls) {
            connLock.reject(new NatsError("tls", ErrorCode.InvalidOption));
            return connLock;
        }
        this.options = options;
        const u = server.src;
        this.encrypted = u.indexOf("wss://") === 0;
        this.socket = new WebSocket(u);
        this.socket.binaryType = "arraybuffer";
        this.socket.onopen = ()=>{};
        this.socket.onmessage = (me)=>{
            this.yields.push(new Uint8Array(me.data));
            if (this.peeked) {
                this.signal.resolve();
                return;
            }
            const t = DataBuffer.concat(...this.yields);
            const pm = extractProtocolMessage(t);
            if (pm !== "") {
                const m = INFO.exec(pm);
                if (!m) {
                    if (options.debug) {
                        console.error("!!!", render(t));
                    }
                    connLock.reject(new Error("unexpected response from server"));
                    return;
                }
                try {
                    const info = JSON.parse(m[1]);
                    checkOptions(info, this.options);
                    this.peeked = true;
                    this.connected = true;
                    this.signal.resolve();
                    connLock.resolve();
                } catch (err) {
                    connLock.reject(err);
                    return;
                }
            }
        };
        this.socket.onclose = (evt)=>{
            this.socketClosed = true;
            let reason;
            if (this.done) return;
            if (!evt.wasClean) {
                reason = new Error(evt.reason);
            }
            this._closed(reason);
        };
        this.socket.onerror = (e)=>{
            const evt = e;
            const err = new NatsError(evt.message, ErrorCode.Unknown, new Error(evt.error));
            if (!connected) {
                connLock.reject(err);
            } else {
                this._closed(err);
            }
        };
        return connLock;
    }
    disconnect() {
        this._closed(undefined, true);
    }
    async _closed(err, internal = true) {
        if (!this.connected) return;
        if (this.done) return;
        this.closeError = err;
        if (!err) {
            while(!this.socketClosed && this.socket.bufferedAmount > 0){
                console.log(this.socket.bufferedAmount);
                await delay(100);
            }
        }
        this.done = true;
        try {
            this.socket.close(err ? 1002 : 1000, err ? err.message : undefined);
        } catch (err1) {}
        if (internal) {
            this.closedNotification.resolve(err);
        }
    }
    get isClosed() {
        return this.done;
    }
    [Symbol.asyncIterator]() {
        return this.iterate();
    }
    async *iterate() {
        while(true){
            if (this.yields.length === 0) {
                await this.signal;
            }
            const yields = this.yields;
            this.yields = [];
            for(let i67 = 0; i67 < yields.length; i67++){
                if (this.options.debug) {
                    console.info(`> ${render(yields[i67])}`);
                }
                yield yields[i67];
            }
            if (this.done) {
                break;
            } else if (this.yields.length === 0) {
                yields.length = 0;
                this.yields = yields;
                this.signal = deferred();
            }
        }
    }
    isEncrypted() {
        return this.connected && this.encrypted;
    }
    send(frame) {
        if (this.done) {
            return Promise.resolve();
        }
        try {
            this.socket.send(frame.buffer);
            if (this.options.debug) {
                console.info(`< ${render(frame)}`);
            }
            return Promise.resolve();
        } catch (err) {
            if (this.options.debug) {
                console.error(`!!! ${render(frame)}: ${err}`);
            }
            return Promise.reject(err);
        }
    }
    close(err) {
        return this._closed(err, false);
    }
    closed() {
        return this.closedNotification;
    }
}
function wsUrlParseFn(u) {
    const ut = /^(.*:\/\/)(.*)/;
    if (!ut.test(u)) {
        u = `https://${u}`;
    }
    let url = new URL(u);
    const srcProto = url.protocol.toLowerCase();
    if (srcProto !== "https:" && srcProto !== "http") {
        u = u.replace(/^(.*:\/\/)(.*)/gm, "$2");
        url = new URL(`http://${u}`);
    }
    let protocol;
    let port;
    const host = url.hostname;
    const path = url.pathname;
    const search = url.search || "";
    switch(srcProto){
        case "http:":
        case "ws:":
        case "nats:":
            port = url.port || "80";
            protocol = "ws:";
            break;
        default:
            port = url.port || "443";
            protocol = "wss:";
            break;
    }
    return `${protocol}//${host}:${port}${path}${search}`;
}
function connect(opts = {}) {
    setTransportFactory({
        defaultPort: 443,
        urlParseFn: wsUrlParseFn,
        factory: ()=>{
            return new WsTransport();
        }
    });
    return NatsConnectionImpl.connect(opts);
}
export { connect as connect };
