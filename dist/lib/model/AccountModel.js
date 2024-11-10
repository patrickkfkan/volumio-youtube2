"use strict";
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _AccountModel_instances, _AccountModel_getChannelInfo;
Object.defineProperty(exports, "__esModule", { value: true });
const volumio_youtubei_js_1 = require("volumio-youtubei.js");
const Endpoint_1 = require("../types/Endpoint");
const Auth_1 = require("../util/Auth");
const BaseModel_1 = require("./BaseModel");
const InnertubeResultParser_1 = __importDefault(require("./InnertubeResultParser"));
const util_1 = require("../util");
const YouTube2Context_1 = __importDefault(require("../YouTube2Context"));
class AccountModel extends BaseModel_1.BaseModel {
    constructor() {
        super(...arguments);
        _AccountModel_instances.add(this);
    }
    async getInfo() {
        const { innertube, auth } = await this.getInnertube();
        if (auth.getStatus().status !== Auth_1.AuthStatus.SignedIn) {
            return null;
        }
        const info = await innertube.account.getInfo();
        // This plugin supports single sign-in, so there should only be one account in contents.
        // But we still get the 'selected' one just to be sure.
        const account = info.contents?.contents.find((ac) => ac.is(volumio_youtubei_js_1.YTNodes.AccountItem) && ac.is_selected);
        if (account?.is(volumio_youtubei_js_1.YTNodes.AccountItem)) {
            const accountName = InnertubeResultParser_1.default.unwrap(account.account_name);
            if (accountName) {
                const result = {
                    name: accountName,
                    photo: InnertubeResultParser_1.default.parseThumbnail(account.account_photo)
                };
                try {
                    const channel = await __classPrivateFieldGet(this, _AccountModel_instances, "m", _AccountModel_getChannelInfo).call(this);
                    if (channel) {
                        result.channel = channel;
                    }
                }
                catch (error) {
                    YouTube2Context_1.default.getLogger().error(YouTube2Context_1.default.getErrorMessage('[youtube2] AccountModel.#getChannelInfo() error:', error));
                }
                return result;
            }
        }
        return null;
    }
}
_AccountModel_instances = new WeakSet(), _AccountModel_getChannelInfo = async function _AccountModel_getChannelInfo() {
    const menu = await this.fetchAccountMenu();
    const title = (0, util_1.findInObject)(menu, (key) => key === 'manageAccountTitle')[0];
    if (title) {
        const text = new volumio_youtubei_js_1.Misc.Text(title);
        const endpoint = InnertubeResultParser_1.default.parseEndpoint(text.endpoint, Endpoint_1.EndpointType.Browse);
        if (text.text && endpoint?.payload.browseId.startsWith('UC')) {
            return {
                title: text.text,
                endpoint
            };
        }
    }
    return null;
};
exports.default = AccountModel;
//# sourceMappingURL=AccountModel.js.map