import type VideoPlaybackInfo from '../types/VideoPlaybackInfo';
import { BaseModel } from './BaseModel';
declare const CLIENTS: readonly ["WEB", "MWEB", "TV"];
export default class VideoModel extends BaseModel {
    #private;
    getPlaybackInfo(videoId: string, client?: typeof CLIENTS[number], signal?: AbortSignal): Promise<VideoPlaybackInfo | null>;
}
export {};
//# sourceMappingURL=VideoModel.d.ts.map