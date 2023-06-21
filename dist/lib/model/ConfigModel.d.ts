import { Credentials } from 'volumio-youtubei.js';
import { BaseModel } from './BaseModel';
import { I18nOptions } from '../types/ConfigData';
export type PluginConfigKey = keyof PluginConfigSchema;
export type PluginConfigValue<T extends PluginConfigKey> = PluginConfigSchema[T]['defaultValue'];
export interface PluginConfigSchemaEntry<T, U = false> {
    defaultValue: T;
    json: U;
}
export interface PluginConfigSchema {
    region: PluginConfigSchemaEntry<string>;
    language: PluginConfigSchemaEntry<string>;
    rootContentType: PluginConfigSchemaEntry<'full' | 'simple'>;
    loadFullPlaylists: PluginConfigSchemaEntry<boolean>;
    autoplay: PluginConfigSchemaEntry<boolean>;
    autoplayClearQueue: PluginConfigSchemaEntry<boolean>;
    autoplayPrefMixRelated: PluginConfigSchemaEntry<boolean>;
    addToHistory: PluginConfigSchemaEntry<boolean>;
    liveStreamQuality: PluginConfigSchemaEntry<'auto' | '144p' | '240p' | '360p' | '480p' | '720p' | '1080p'>;
    prefetch: PluginConfigSchemaEntry<boolean>;
    authCredentials: PluginConfigSchemaEntry<Credentials | undefined, true>;
}
export declare const PLUGIN_CONFIG_SCHEMA: PluginConfigSchema;
export default class ConfigModel extends BaseModel {
    #private;
    getI18nOptions(): Promise<I18nOptions>;
    clearCache(): void;
    getRootContentTypeOptions(): {
        label: string;
        value: string;
    }[];
    getLiveStreamQualityOptions(): {
        label: string;
        value: string;
    }[];
}
//# sourceMappingURL=ConfigModel.d.ts.map