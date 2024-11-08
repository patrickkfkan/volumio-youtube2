"use strict";
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _Auth_instances, _Auth_innertube, _Auth_handlers, _Auth_handlersRegistered, _Auth_handlePending, _Auth_handleSuccess, _Auth_handleError, _Auth_registerHandlers, _Auth_unregisterHandlers;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthEvent = exports.AuthStatus = void 0;
const YouTube2Context_1 = __importDefault(require("../YouTube2Context"));
const events_1 = __importDefault(require("events"));
var AuthStatus;
(function (AuthStatus) {
    AuthStatus["SignedIn"] = "SignedIn";
    AuthStatus["SignedOut"] = "SignedOut";
    AuthStatus["SigningIn"] = "SigningIn";
    AuthStatus["Error"] = "Error";
})(AuthStatus || (exports.AuthStatus = AuthStatus = {}));
const INITIAL_SIGNED_OUT_STATUS = {
    status: AuthStatus.SignedOut,
    verificationInfo: null
};
var AuthEvent;
(function (AuthEvent) {
    AuthEvent["SignIn"] = "SignIn";
    AuthEvent["SignOut"] = "SignOut";
    AuthEvent["Pending"] = "Pending";
    AuthEvent["Error"] = "Error";
})(AuthEvent || (exports.AuthEvent = AuthEvent = {}));
class Auth extends events_1.default {
    constructor() {
        super();
        _Auth_instances.add(this);
        _Auth_innertube.set(this, void 0);
        _Auth_handlers.set(this, void 0);
        _Auth_handlersRegistered.set(this, void 0);
        __classPrivateFieldSet(this, _Auth_innertube, null, "f");
        __classPrivateFieldSet(this, _Auth_handlersRegistered, false, "f");
    }
    static create(innertube) {
        const auth = new Auth();
        __classPrivateFieldSet(auth, _Auth_innertube, innertube, "f");
        __classPrivateFieldSet(auth, _Auth_handlers, {
            onSuccess: __classPrivateFieldGet(auth, _Auth_instances, "m", _Auth_handleSuccess).bind(auth),
            onPending: __classPrivateFieldGet(auth, _Auth_instances, "m", _Auth_handlePending).bind(auth),
            onError: __classPrivateFieldGet(auth, _Auth_instances, "m", _Auth_handleError).bind(auth),
            onCredentials: __classPrivateFieldGet(auth, _Auth_instances, "m", _Auth_handleSuccess).bind(auth)
        }, "f");
        return auth;
    }
    dispose() {
        __classPrivateFieldGet(this, _Auth_instances, "m", _Auth_unregisterHandlers).call(this);
        this.removeAllListeners();
        __classPrivateFieldSet(this, _Auth_innertube, null, "f");
    }
    signIn() {
        if (__classPrivateFieldGet(this, _Auth_innertube, "f")?.session) {
            const credentials = YouTube2Context_1.default.getConfigValue('authCredentials');
            if (credentials) {
                YouTube2Context_1.default.set('authStatusInfo', {
                    status: AuthStatus.SigningIn
                });
                YouTube2Context_1.default.getLogger().info('[youtube2] Attempt sign-in with existing credentials');
            }
            else {
                YouTube2Context_1.default.set('authStatusInfo', INITIAL_SIGNED_OUT_STATUS);
                YouTube2Context_1.default.getLogger().info('[youtube2] Obtaining device code for sign-in...');
            }
            __classPrivateFieldGet(this, _Auth_instances, "m", _Auth_registerHandlers).call(this);
            YouTube2Context_1.default.refreshUIConfig();
            __classPrivateFieldGet(this, _Auth_innertube, "f").session.signIn(credentials)
                .then(() => {
                const oldStatusInfo = YouTube2Context_1.default.get('authStatusInfo');
                if (__classPrivateFieldGet(this, _Auth_innertube, "f")?.session.logged_in && (!oldStatusInfo || oldStatusInfo.status !== AuthStatus.SignedIn)) {
                    YouTube2Context_1.default.set('authStatusInfo', {
                        status: AuthStatus.SignedIn
                    });
                    YouTube2Context_1.default.getLogger().info('[youtube2] Auth success');
                    YouTube2Context_1.default.toast('success', YouTube2Context_1.default.getI18n('YOUTUBE2_SIGN_IN_SUCCESS'));
                    YouTube2Context_1.default.refreshUIConfig();
                    this.emit(AuthEvent.SignIn);
                }
            })
                .catch((error) => {
                YouTube2Context_1.default.getLogger().error(YouTube2Context_1.default.getErrorMessage('[youtube2] Caught Innertube sign-in error:', error, false));
            });
        }
    }
    async signOut() {
        if (__classPrivateFieldGet(this, _Auth_innertube, "f")?.session?.logged_in) {
            await __classPrivateFieldGet(this, _Auth_innertube, "f").session.signOut();
            YouTube2Context_1.default.deleteConfigValue('authCredentials');
            YouTube2Context_1.default.set('authStatusInfo', INITIAL_SIGNED_OUT_STATUS);
            YouTube2Context_1.default.getLogger().info('[youtube2] Auth revoked');
            YouTube2Context_1.default.toast('success', YouTube2Context_1.default.getI18n('YOUTUBE2_SIGNED_OUT'));
            this.emit(AuthEvent.SignOut);
            YouTube2Context_1.default.refreshUIConfig();
        }
    }
    getStatus() {
        return YouTube2Context_1.default.get('authStatusInfo') || INITIAL_SIGNED_OUT_STATUS;
    }
}
_Auth_innertube = new WeakMap(), _Auth_handlers = new WeakMap(), _Auth_handlersRegistered = new WeakMap(), _Auth_instances = new WeakSet(), _Auth_handlePending = function _Auth_handlePending(data) {
    YouTube2Context_1.default.set('authStatusInfo', {
        status: AuthStatus.SignedOut,
        verificationInfo: {
            verificationUrl: data.verification_url,
            userCode: data.user_code
        }
    });
    YouTube2Context_1.default.getLogger().info(`[youtube2] Obtained device code for sign-in (expires in ${data.expires_in} seconds)`);
    YouTube2Context_1.default.refreshUIConfig();
    this.emit(AuthEvent.Pending);
}, _Auth_handleSuccess = function _Auth_handleSuccess(data) {
    YouTube2Context_1.default.setConfigValue('authCredentials', data.credentials);
    YouTube2Context_1.default.getLogger().info('[youtube2] Auth credentials updated');
}, _Auth_handleError = function _Auth_handleError(err) {
    if (err.info.error === 'expired_token') {
        YouTube2Context_1.default.getLogger().info('[youtube2] Device code for sign-in expired - refetch');
        this.signIn(); // This will refetch the code and refresh UI config
        return;
    }
    YouTube2Context_1.default.set('authStatusInfo', {
        status: AuthStatus.Error,
        error: err
    });
    YouTube2Context_1.default.toast('error', YouTube2Context_1.default.getI18n('YOUTUBE2_ERR_SIGN_IN', YouTube2Context_1.default.getErrorMessage('', err, false)));
    YouTube2Context_1.default.refreshUIConfig();
    this.emit(AuthEvent.Error);
}, _Auth_registerHandlers = function _Auth_registerHandlers() {
    if (__classPrivateFieldGet(this, _Auth_innertube, "f")?.session && !__classPrivateFieldGet(this, _Auth_handlersRegistered, "f")) {
        __classPrivateFieldGet(this, _Auth_innertube, "f").session.on('auth', __classPrivateFieldGet(this, _Auth_handlers, "f").onSuccess);
        __classPrivateFieldGet(this, _Auth_innertube, "f").session.on('auth-pending', __classPrivateFieldGet(this, _Auth_handlers, "f").onPending);
        __classPrivateFieldGet(this, _Auth_innertube, "f").session.on('auth-error', __classPrivateFieldGet(this, _Auth_handlers, "f").onError);
        __classPrivateFieldGet(this, _Auth_innertube, "f").session.on('update-credentials', __classPrivateFieldGet(this, _Auth_handlers, "f").onCredentials);
        __classPrivateFieldSet(this, _Auth_handlersRegistered, true, "f");
    }
}, _Auth_unregisterHandlers = function _Auth_unregisterHandlers() {
    if (__classPrivateFieldGet(this, _Auth_innertube, "f")?.session) {
        __classPrivateFieldGet(this, _Auth_innertube, "f").session.off('auth', __classPrivateFieldGet(this, _Auth_handlers, "f").onSuccess);
        __classPrivateFieldGet(this, _Auth_innertube, "f").session.off('auth-pending', __classPrivateFieldGet(this, _Auth_handlers, "f").onPending);
        __classPrivateFieldGet(this, _Auth_innertube, "f").session.off('auth-error', __classPrivateFieldGet(this, _Auth_handlers, "f").onError);
        __classPrivateFieldGet(this, _Auth_innertube, "f").session.off('update-credentials', __classPrivateFieldGet(this, _Auth_handlers, "f").onCredentials);
    }
    __classPrivateFieldSet(this, _Auth_handlersRegistered, false, "f");
};
exports.default = Auth;
//# sourceMappingURL=Auth.js.map