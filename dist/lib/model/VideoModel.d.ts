import { type Types } from 'volumio-youtubei.js';
import type VideoPlaybackInfo from '../types/VideoPlaybackInfo';
import { BaseModel } from './BaseModel';
export default class VideoModel extends BaseModel {
    #private;
    getPlaybackInfo(videoId: string, client?: Types.InnerTubeClient, signal?: AbortSignal): Promise<VideoPlaybackInfo | null>;
}
//# sourceMappingURL=VideoModel.d.ts.map