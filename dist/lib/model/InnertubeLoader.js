"use strict";
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
var _a, _InnertubeLoader_instancePromise;
Object.defineProperty(exports, "__esModule", { value: true });
const YouTube2Context_1 = __importDefault(require("../YouTube2Context"));
const volumio_yt_support_1 = require("volumio-yt-support");
class InnertubeLoader {
    static async getInstance() {
        if (!__classPrivateFieldGet(this, _a, "f", _InnertubeLoader_instancePromise)) {
            __classPrivateFieldSet(this, _a, volumio_yt_support_1.InnertubeFactory.getWrappedInstance({
                account: {
                    cookie: YouTube2Context_1.default.getConfigValue('cookie') || undefined,
                    activeChannelHandle: YouTube2Context_1.default.getConfigValue('activeChannelHandle')
                },
                locale: {
                    region: YouTube2Context_1.default.getConfigValue('region'),
                    language: YouTube2Context_1.default.getConfigValue('language')
                },
                logger: {
                    info: (msg) => YouTube2Context_1.default.getLogger().info(`[youtube2] ${msg}`),
                    warn: (msg) => YouTube2Context_1.default.getLogger().warn(`[youtube2] ${msg}`),
                    error: (msg) => YouTube2Context_1.default.getLogger().error(`[youtube2] ${msg}`),
                }
            }), "f", _InnertubeLoader_instancePromise);
        }
        return __classPrivateFieldGet(this, _a, "f", _InnertubeLoader_instancePromise);
    }
    static async generatePoToken(identifier) {
        const instance = await this.getInstance();
        return await instance.generatePoToken(identifier);
    }
    static async reset() {
        if (__classPrivateFieldGet(this, _a, "f", _InnertubeLoader_instancePromise)) {
            const instance = await __classPrivateFieldGet(this, _a, "f", _InnertubeLoader_instancePromise);
            await instance.dispose();
            __classPrivateFieldSet(this, _a, null, "f", _InnertubeLoader_instancePromise);
        }
    }
    static async applyI18nConfig() {
        const region = YouTube2Context_1.default.getConfigValue('region');
        const language = YouTube2Context_1.default.getConfigValue('language');
        if (__classPrivateFieldGet(this, _a, "f", _InnertubeLoader_instancePromise)) {
            const instance = await __classPrivateFieldGet(this, _a, "f", _InnertubeLoader_instancePromise);
            instance.setLocale({ region, language });
        }
    }
}
_a = InnertubeLoader;
_InnertubeLoader_instancePromise = { value: null };
exports.default = InnertubeLoader;
//# sourceMappingURL=InnertubeLoader.js.map