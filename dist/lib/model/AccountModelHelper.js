"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAccountInitialInfo = getAccountInitialInfo;
const volumio_youtubei_js_1 = require("volumio-youtubei.js");
async function getAccountInitialInfo(innertube) {
    const response = await innertube.actions.execute(volumio_youtubei_js_1.Endpoints.Account.AccountListEndpoint.PATH, volumio_youtubei_js_1.Endpoints.Account.AccountListEndpoint.build());
    let isSignedIn = false;
    if (!response.success) {
        throw Error(`Response error ${response.status_code}`);
    }
    if (response.data.responseContext?.serviceTrackingParams) {
        for (const params of response.data.responseContext.serviceTrackingParams) {
            const p = params.params?.find((p) => p.key === 'logged_in');
            if (p) {
                isSignedIn = p.value === '1' ? true : false;
                break;
            }
        }
    }
    return {
        isSignedIn,
        response
    };
}
//# sourceMappingURL=AccountModelHelper.js.map