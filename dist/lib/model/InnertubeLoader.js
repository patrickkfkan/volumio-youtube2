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
var _a, _InnertubeLoader_innertube, _InnertubeLoader_auth, _InnertubeLoader_pendingPromise, _InnertubeLoader_poTokenRefreshTimer, _InnertubeLoader_beginInitStage, _InnertubeLoader_beginPOStage, _InnertubeLoader_createInstance, _InnertubeLoader_clearPOTokenRefreshTimer, _InnertubeLoader_handleAuthEvent, _InnertubeLoader_resolveGetInstanceResult, _InnertubeLoader_handleSubsequentSignIn, _InnertubeLoader_handleSignOut, _InnertubeLoader_refreshPOToken, _InnertubeLoader_generatePoToken;
Object.defineProperty(exports, "__esModule", { value: true });
const YouTube2Context_1 = __importDefault(require("../YouTube2Context"));
const volumio_youtubei_js_1 = __importStar(require("volumio-youtubei.js"));
const Auth_1 = __importStar(require("../util/Auth"));
const bgutils_js_1 = __importDefault(require("bgutils-js"));
const jsdom_1 = require("jsdom");
var Stage;
(function (Stage) {
    Stage["Init"] = "1 - Init";
    Stage["PO"] = "2 - PO";
    Stage["Done"] = "3 - Done";
})(Stage || (Stage = {}));
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
        __classPrivateFieldSet(this, _a, __classPrivateFieldGet(this, _a, "m", _InnertubeLoader_beginInitStage).call(this), "f", _InnertubeLoader_pendingPromise);
        return __classPrivateFieldGet(this, _a, "f", _InnertubeLoader_pendingPromise);
    }
    static reset() {
        __classPrivateFieldGet(this, _a, "m", _InnertubeLoader_clearPOTokenRefreshTimer).call(this);
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
_a = InnertubeLoader, _InnertubeLoader_beginInitStage = function _InnertubeLoader_beginInitStage() {
    return new Promise((resolve) => {
        __classPrivateFieldGet(this, _a, "m", _InnertubeLoader_createInstance).call(this, Stage.Init, resolve)
            .catch((error) => {
            YouTube2Context_1.default.getLogger().error(YouTube2Context_1.default.getErrorMessage(`[youtube2] InnertubeLoader: error creating Innertube instance:`, error));
        });
    });
}, _InnertubeLoader_beginPOStage = async function _InnertubeLoader_beginPOStage(innertube, auth, resolve, lastToken) {
    let identifier = null;
    const visitorData = lastToken?.params.visitorData || innertube.session.context.client.visitorData;
    const lastIdentifier = lastToken?.params.identifier;
    if (lastIdentifier) {
        identifier = lastIdentifier;
    }
    else if (innertube.session.logged_in) {
        YouTube2Context_1.default.getLogger().info('[youtube2] InnertubeLoader: fetching datasyncIdToken...');
        const user = await innertube.account.getInfo();
        const accountItemSections = user.page.contents_memo?.getType(volumio_youtubei_js_1.YTNodes.AccountItemSection);
        if (accountItemSections) {
            const accountItemSection = accountItemSections.first();
            const accountItem = accountItemSection.contents.first();
            const tokens = accountItem.endpoint.payload.supportedTokens;
            let datasyncIdToken = null;
            if (Array.isArray(tokens)) {
                datasyncIdToken = tokens.find((v) => typeof v === 'object' &&
                    Reflect.has(v, 'datasyncIdToken') &&
                    typeof v.datasyncIdToken === 'object' &&
                    Reflect.has(v.datasyncIdToken, 'datasyncIdToken') &&
                    typeof v.datasyncIdToken.datasyncIdToken === 'string')?.datasyncIdToken.datasyncIdToken;
            }
            identifier = datasyncIdToken ? {
                type: 'datasyncIdToken',
                value: datasyncIdToken
            } : null;
        }
        if (!identifier) {
            YouTube2Context_1.default.getLogger().warn('[youtube2] InnertubeLoader: signed in but could not get datasyncIdToken for fetching po_token');
        }
    }
    else {
        identifier = visitorData ? {
            type: 'visitorData',
            value: visitorData
        } : null;
    }
    let poTokenResult;
    if (identifier) {
        YouTube2Context_1.default.getLogger().info(`[youtube2] InnertubeLoader: obtaining po_token by ${identifier.type}...`);
        try {
            poTokenResult = await __classPrivateFieldGet(this, _a, "m", _InnertubeLoader_generatePoToken).call(this, identifier.value);
            YouTube2Context_1.default.getLogger().info(`[youtube2] InnertubeLoader: obtained po_token (expires in ${poTokenResult.ttl} seconds)`);
        }
        catch (error) {
            YouTube2Context_1.default.getLogger().error(YouTube2Context_1.default.getErrorMessage('[youtube2] InnertubeLoader: failed to get poToken: ', error, false));
        }
        if (poTokenResult) {
            YouTube2Context_1.default.getLogger().info(`[youtube2] InnertubeLoader: re-create Innertube instance with po_token`);
            auth.dispose();
            __classPrivateFieldGet(this, _a, "m", _InnertubeLoader_createInstance).call(this, Stage.PO, resolve, {
                params: {
                    visitorData,
                    identifier
                },
                value: poTokenResult.token,
                ttl: poTokenResult.ttl,
                refreshThreshold: poTokenResult.refreshThreshold
            })
                .catch((error) => {
                YouTube2Context_1.default.getLogger().error(YouTube2Context_1.default.getErrorMessage(`[youtube2] InnertubeLoader: error creating Innertube instance:`, error));
            });
            return;
        }
    }
    YouTube2Context_1.default.getLogger().warn('[youtube2] InnertubeLoader: po_token was not used to create Innertube instance. Playback of YouTube content might fail.');
    __classPrivateFieldGet(this, _a, "m", _InnertubeLoader_resolveGetInstanceResult).call(this, innertube, auth, resolve);
}, _InnertubeLoader_createInstance = async function _InnertubeLoader_createInstance(stage, resolve, poToken) {
    YouTube2Context_1.default.getLogger().info(`[youtube2] InnertubeLoader: creating Innertube instance${poToken?.value ? ' with po_token' : ''}...`);
    const innertube = await volumio_youtubei_js_1.default.create({
        visitor_data: poToken?.params.visitorData,
        po_token: poToken?.value
    });
    YouTube2Context_1.default.getLogger().info(`[youtube2] InnertubeLoader: creating Auth instance...`);
    const auth = Auth_1.default.create(innertube);
    auth.on(Auth_1.AuthEvent.SignIn, __classPrivateFieldGet(this, _a, "m", _InnertubeLoader_handleAuthEvent).bind(this, Auth_1.AuthEvent.SignIn, stage, innertube, auth, resolve, poToken));
    auth.on(Auth_1.AuthEvent.Pending, __classPrivateFieldGet(this, _a, "m", _InnertubeLoader_handleAuthEvent).bind(this, Auth_1.AuthEvent.Pending, stage, innertube, auth, resolve, poToken));
    auth.on(Auth_1.AuthEvent.Error, __classPrivateFieldGet(this, _a, "m", _InnertubeLoader_handleAuthEvent).bind(this, Auth_1.AuthEvent.Error, stage, innertube, auth, resolve, poToken));
    auth.signIn();
}, _InnertubeLoader_clearPOTokenRefreshTimer = function _InnertubeLoader_clearPOTokenRefreshTimer() {
    if (__classPrivateFieldGet(this, _a, "f", _InnertubeLoader_poTokenRefreshTimer)) {
        clearTimeout(__classPrivateFieldGet(this, _a, "f", _InnertubeLoader_poTokenRefreshTimer));
        __classPrivateFieldSet(this, _a, null, "f", _InnertubeLoader_poTokenRefreshTimer);
    }
}, _InnertubeLoader_handleAuthEvent = function _InnertubeLoader_handleAuthEvent(event, stage, innertube, auth, resolve, poToken) {
    switch (stage) {
        case Stage.Init:
            if (event === Auth_1.AuthEvent.SignIn || event === Auth_1.AuthEvent.Pending) {
                __classPrivateFieldGet(this, _a, "m", _InnertubeLoader_beginPOStage).call(this, innertube, auth, resolve)
                    .catch((error) => {
                    YouTube2Context_1.default.getLogger().error(YouTube2Context_1.default.getErrorMessage(`[youtube2] InnertubeLoader: error creating Innertube instance (with po_token):`, error));
                });
                return;
            }
            YouTube2Context_1.default.getLogger().warn('[youtube2] InnertubeLoader: po_token was not used to create Innertube instance because of auth error or unknown auth status. Playback of YouTube content might fail.');
            __classPrivateFieldGet(this, _a, "m", _InnertubeLoader_resolveGetInstanceResult).call(this, innertube, auth, resolve);
            return;
        case Stage.PO:
            __classPrivateFieldGet(this, _a, "m", _InnertubeLoader_resolveGetInstanceResult).call(this, innertube, auth, resolve, poToken);
            break;
    }
}, _InnertubeLoader_resolveGetInstanceResult = function _InnertubeLoader_resolveGetInstanceResult(innertube, auth, resolve, poToken) {
    __classPrivateFieldSet(this, _a, null, "f", _InnertubeLoader_pendingPromise);
    __classPrivateFieldSet(this, _a, innertube, "f", _InnertubeLoader_innertube);
    __classPrivateFieldSet(this, _a, auth, "f", _InnertubeLoader_auth);
    this.applyI18nConfig();
    if (innertube.session.logged_in) {
        auth.on(Auth_1.AuthEvent.SignOut, __classPrivateFieldGet(this, _a, "m", _InnertubeLoader_handleSignOut).bind(this));
    }
    else {
        auth.on(Auth_1.AuthEvent.SignIn, __classPrivateFieldGet(this, _a, "m", _InnertubeLoader_handleSubsequentSignIn).bind(this));
    }
    __classPrivateFieldGet(this, _a, "m", _InnertubeLoader_clearPOTokenRefreshTimer).call(this);
    if (poToken) {
        const { ttl, refreshThreshold = 100 } = poToken;
        if (ttl) {
            const timeout = ttl - refreshThreshold;
            YouTube2Context_1.default.getLogger().info(`[youtube2] InnertubeLoader: going to refresh po_token in ${timeout} seconds`);
            __classPrivateFieldSet(this, _a, setTimeout(() => __classPrivateFieldGet(this, _a, "m", _InnertubeLoader_refreshPOToken).call(this, poToken), timeout * 1000), "f", _InnertubeLoader_poTokenRefreshTimer);
        }
    }
    resolve({
        innertube,
        auth
    });
}, _InnertubeLoader_handleSubsequentSignIn = function _InnertubeLoader_handleSubsequentSignIn() {
    const innertube = __classPrivateFieldGet(this, _a, "f", _InnertubeLoader_innertube);
    const auth = __classPrivateFieldGet(this, _a, "f", _InnertubeLoader_auth);
    if (!innertube || !auth) {
        return;
    }
    this.reset();
    __classPrivateFieldSet(this, _a, new Promise((resolve) => {
        __classPrivateFieldGet(this, _a, "m", _InnertubeLoader_handleAuthEvent).call(this, Auth_1.AuthEvent.SignIn, Stage.Init, innertube, auth, resolve);
    }), "f", _InnertubeLoader_pendingPromise);
}, _InnertubeLoader_handleSignOut = function _InnertubeLoader_handleSignOut() {
    const innertube = __classPrivateFieldGet(this, _a, "f", _InnertubeLoader_innertube);
    const auth = __classPrivateFieldGet(this, _a, "f", _InnertubeLoader_auth);
    if (!innertube || !auth) {
        return;
    }
    this.reset();
    __classPrivateFieldSet(this, _a, __classPrivateFieldGet(this, _a, "m", _InnertubeLoader_beginInitStage).call(this), "f", _InnertubeLoader_pendingPromise);
}, _InnertubeLoader_refreshPOToken = function _InnertubeLoader_refreshPOToken(lastToken) {
    const innertube = __classPrivateFieldGet(this, _a, "f", _InnertubeLoader_innertube);
    const auth = __classPrivateFieldGet(this, _a, "f", _InnertubeLoader_auth);
    if (!innertube || !auth) {
        return;
    }
    this.reset();
    __classPrivateFieldSet(this, _a, new Promise((resolve) => {
        YouTube2Context_1.default.getLogger().info('[youtube2] InnertubeLoader: refresh po_token');
        __classPrivateFieldGet(this, _a, "m", _InnertubeLoader_beginPOStage).call(this, innertube, auth, resolve, lastToken)
            .catch((error) => {
            YouTube2Context_1.default.getLogger().error(YouTube2Context_1.default.getErrorMessage(`[youtube2] InnertubeLoader: error creating Innertube instance (while refreshing po_token):`, error));
        });
    }), "f", _InnertubeLoader_pendingPromise);
}, _InnertubeLoader_generatePoToken = async function _InnertubeLoader_generatePoToken(identifier) {
    const requestKey = 'O43z0dpjhgX20SCx4KAo';
    const bgConfig = {
        fetch: (url, options) => fetch(url, options),
        globalObj: globalThis,
        identifier,
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
    return {
        token: poTokenResult.poToken,
        ttl: poTokenResult.integrityTokenData.estimatedTtlSecs,
        refreshThreshold: poTokenResult.integrityTokenData.mintRefreshThreshold
    };
};
_InnertubeLoader_innertube = { value: null };
_InnertubeLoader_auth = { value: null };
_InnertubeLoader_pendingPromise = { value: null };
_InnertubeLoader_poTokenRefreshTimer = { value: null };
exports.default = InnertubeLoader;
//# sourceMappingURL=InnertubeLoader.js.map