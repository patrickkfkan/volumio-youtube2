import { Innertube } from 'volumio-yt-support/dist/innertube';
import { type PluginConfig } from '../types';
export type AccountInfo = {
    isSignedIn: true;
    list: PluginConfig.Account[];
    active: PluginConfig.Account;
} | {
    isSignedIn: false;
    list: null;
    active: null;
};
export declare function getAccountInitialInfo(innertube: Innertube): Promise<AccountInfo>;
//# sourceMappingURL=AccountModelHelper.d.ts.map