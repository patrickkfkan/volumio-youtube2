"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a, _InnertubeLoader_innertube, _InnertubeLoader_auth, _InnertubeLoader_pendingPromise, _InnertubeLoader_handleAuthEvent, _InnertubeLoader_generatePoToken;
Object.defineProperty(exports, "__esModule", { value: true });
const YouTube2Context_1 = __importDefault(require("../YouTube2Context"));
const volumio_youtubei_js_1 = __importDefault(require("volumio-youtubei.js"));
const Auth_1 = __importStar(require("../util/Auth"));
const bgutils_js_1 = __importDefault(require("bgutils-js"));
const jsdom_1 = require("jsdom");
class InnertubeLoader {
    static async getInstance() {
        if (__classPrivateFieldGet(this, _a, "f", _InnertubeLoader_innertube) && __classPrivateFieldGet(this, _a, "f", _InnertubeLoader_auth)) {
            return {
                innertube: __classPrivateFieldGet(this, _a, "f", _InnertubeLoader_innertube),
                auth: __classPrivateFieldGet(this, _a, "f", _InnertubeLoader_auth)
            };
        }
        if (__classPrivateFieldGet(this, _a, "f", _InnertubeLoader_pendingPromise)) {
            return __classPrivateFieldGet(this, _a, "f", _InnertubeLoader_pendingPromise);
        }
        __classPrivateFieldSet(this, _a, new Promise((resolve) => {
            void (async () => {
                YouTube2Context_1.default.getLogger().info('[youtube2] InnertubeLoader: creating Innertube instance...');
                try {
                    const { visitorData, poToken } = await __classPrivateFieldGet(this, _a, "m", _InnertubeLoader_generatePoToken).call(this);
                    __classPrivateFieldSet(this, _a, await volumio_youtubei_js_1.default.create({
                        po_token: poToken,
                        visitor_data: visitorData
                    }), "f", _InnertubeLoader_innertube);
                }
                catch (error) {
                    YouTube2Context_1.default.getLogger().error(YouTube2Context_1.default.getErrorMessage('[youtube2] Failed to get poToken: ', error, false));
                    YouTube2Context_1.default.getLogger().error('[youtube2] Warning: poToken will not be used to create Innertube instance. Playback of YouTube content might fail.');
                    __classPrivateFieldSet(this, _a, await volumio_youtubei_js_1.default.create(), "f", _InnertubeLoader_innertube);
                }
                this.applyI18nConfig();
                YouTube2Context_1.default.getLogger().info('[youtube2] InnertubeLoader: creating Auth instance...');
                __classPrivateFieldSet(this, _a, Auth_1.default.create(__classPrivateFieldGet(this, _a, "f", _InnertubeLoader_innertube)), "f", _InnertubeLoader_auth);
                __classPrivateFieldGet(this, _a, "f", _InnertubeLoader_auth).on(Auth_1.AuthEvent.SignIn, __classPrivateFieldGet(this, _a, "m", _InnertubeLoader_handleAuthEvent).bind(this, Auth_1.AuthEvent.SignIn, __classPrivateFieldGet(this, _a, "f", _InnertubeLoader_innertube), __classPrivateFieldGet(this, _a, "f", _InnertubeLoader_auth), resolve));
                __classPrivateFieldGet(this, _a, "f", _InnertubeLoader_auth).on(Auth_1.AuthEvent.Pending, __classPrivateFieldGet(this, _a, "m", _InnertubeLoader_handleAuthEvent).bind(this, Auth_1.AuthEvent.Pending, __classPrivateFieldGet(this, _a, "f", _InnertubeLoader_innertube), __classPrivateFieldGet(this, _a, "f", _InnertubeLoader_auth), resolve));
                __classPrivateFieldGet(this, _a, "f", _InnertubeLoader_auth).on(Auth_1.AuthEvent.Error, __classPrivateFieldGet(this, _a, "m", _InnertubeLoader_handleAuthEvent).bind(this, Auth_1.AuthEvent.Error, __classPrivateFieldGet(this, _a, "f", _InnertubeLoader_innertube), __classPrivateFieldGet(this, _a, "f", _InnertubeLoader_auth), resolve));
                __classPrivateFieldGet(this, _a, "f", _InnertubeLoader_auth).signIn();
            })();
        }), "f", _InnertubeLoader_pendingPromise);
        return __classPrivateFieldGet(this, _a, "f", _InnertubeLoader_pendingPromise);
    }
    static reset() {
        if (__classPrivateFieldGet(this, _a, "f", _InnertubeLoader_pendingPromise)) {
            __classPrivateFieldSet(this, _a, null, "f", _InnertubeLoader_pendingPromise);
        }
        if (__classPrivateFieldGet(this, _a, "f", _InnertubeLoader_auth)) {
            __classPrivateFieldGet(this, _a, "f", _InnertubeLoader_auth).dispose();
        }
        __classPrivateFieldSet(this, _a, null, "f", _InnertubeLoader_auth);
        __classPrivateFieldSet(this, _a, null, "f", _InnertubeLoader_innertube);
    }
    static hasInstance() {
        return __classPrivateFieldGet(this, _a, "f", _InnertubeLoader_innertube) && __classPrivateFieldGet(this, _a, "f", _InnertubeLoader_auth);
    }
    static applyI18nConfig() {
        if (!__classPrivateFieldGet(this, _a, "f", _InnertubeLoader_innertube)) {
            return;
        }
        const region = YouTube2Context_1.default.getConfigValue('region');
        const language = YouTube2Context_1.default.getConfigValue('language');
        __classPrivateFieldGet(this, _a, "f", _InnertubeLoader_innertube).session.context.client.gl = region;
        __classPrivateFieldGet(this, _a, "f", _InnertubeLoader_innertube).session.context.client.hl = language;
    }
}
_a = InnertubeLoader, _InnertubeLoader_handleAuthEvent = function _InnertubeLoader_handleAuthEvent(event, innertube, auth, resolve) {
    if (!__classPrivateFieldGet(this, _a, "f", _InnertubeLoader_pendingPromise)) {
        return;
    }
    let status;
    switch (event) {
        case Auth_1.AuthEvent.SignIn:
            status = 'signed in';
            break;
        case Auth_1.AuthEvent.Pending:
            status = 'pending sign-in';
            break;
        case Auth_1.AuthEvent.Error:
            status = 'error';
            break;
        default:
            status = 'undefined';
    }
    YouTube2Context_1.default.getLogger().info(`[youtube2] InnertubeLoader: Auth instance created (status: ${status})`);
    __classPrivateFieldSet(this, _a, null, "f", _InnertubeLoader_pendingPromise);
    auth.removeAllListeners();
    resolve({
        innertube,
        auth
    });
}, _InnertubeLoader_generatePoToken = async function _InnertubeLoader_generatePoToken() {
    YouTube2Context_1.default.getLogger().info('[youtube2] InnertubeLoader: Generating poToken...');
    const requestKey = 'O43z0dpjhgX20SCx4KAo';
    const visitorData = (await volumio_youtubei_js_1.default.create({ retrieve_player: false })).session.context.client.visitorData;
    if (!visitorData) {
        throw Error('Visitor data not found in session data');
    }
    const bgConfig = {
        fetch: (url, options) => fetch(url, options),
        globalObj: globalThis,
        identifier: visitorData,
        requestKey
    };
    const dom = new jsdom_1.JSDOM();
    Object.assign(globalThis, {
        window: dom.window,
        document: dom.window.document
    });
    const bgChallenge = await bgutils_js_1.default.Challenge.create(bgConfig);
    if (!bgChallenge) {
        throw new Error('Could not get challenge');
    }
    const interpreterJavascript = bgChallenge.interpreterJavascript.privateDoNotAccessOrElseSafeScriptWrappedValue;
    if (interpreterJavascript) {
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        new Function(interpreterJavascript)();
    }
    else
        throw new Error('Could not load VM');
    const poTokenResult = await bgutils_js_1.default.PoToken.generate({
        program: bgChallenge.program,
        globalName: bgChallenge.globalName,
        bgConfig
    });
    YouTube2Context_1.default.getLogger().info('[youtube2] InnertubeLoader: obtained poToken');
    return {
        visitorData, poToken: poTokenResult.poToken
    };
};
_InnertubeLoader_innertube = { value: null };
_InnertubeLoader_auth = { value: null };
_InnertubeLoader_pendingPromise = { value: null };
exports.default = InnertubeLoader;
//# sourceMappingURL=InnertubeLoader.js.map