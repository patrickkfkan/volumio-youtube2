import { type PluginConfig } from '../types';
import { BaseModel } from './BaseModel';
export default class AccountModel extends BaseModel {
    #private;
    getInfo(): Promise<PluginConfig.Account | null>;
}
//# sourceMappingURL=AccountModel.d.ts.map