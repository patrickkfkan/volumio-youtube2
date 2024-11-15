import { type PluginConfig } from '../types';
import { BaseModel } from './BaseModel';
export default class AccountModel extends BaseModel {
    #private;
    getInfo(): Promise<{
        isSignedIn: boolean;
        info: null;
    } | {
        isSignedIn: boolean;
        info: PluginConfig.Account;
    }>;
}
//# sourceMappingURL=AccountModel.d.ts.map