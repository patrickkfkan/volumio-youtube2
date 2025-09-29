"use strict";
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _VideoModel_instances, _VideoModel_sleep, _VideoModel_head, _VideoModel_chooseFormat, _VideoModel_parseStreamData, _VideoModel_getStreamUrlFromHLS;
Object.defineProperty(exports, "__esModule", { value: true });
const volumio_youtubei_js_1 = require("volumio-youtubei.js");
const YouTube2Context_1 = __importDefault(require("../YouTube2Context"));
const BaseModel_1 = require("./BaseModel");
const InnertubeResultParser_1 = __importDefault(require("./InnertubeResultParser"));
// https://gist.github.com/sidneys/7095afe4da4ae58694d128b1034e01e2
const ITAG_TO_BITRATE = {
    '139': '48',
    '140': '128',
    '141': '256',
    '171': '128',
    '249': '50',
    '250': '70',
    '251': '160'
};
const BEST_AUDIO_FORMAT = {
    type: 'audio',
    format: 'any',
    quality: 'best'
};
class VideoModel extends BaseModel_1.BaseModel {
    constructor() {
        super(...arguments);
        _VideoModel_instances.add(this);
    }
    async getPlaybackInfo(videoId, client, signal) {
        const { innertube } = await this.getInnertube();
        try {
            const info = await innertube.getBasicInfo(videoId, { client });
            if (signal?.aborted) {
                throw Error('Aborted');
            }
            const basicInfo = info.basic_info;
            const result = {
                type: 'video',
                title: basicInfo.title,
                author: {
                    channelId: basicInfo.channel_id,
                    name: basicInfo.author
                },
                description: basicInfo.short_description,
                thumbnail: InnertubeResultParser_1.default.parseThumbnail(basicInfo.thumbnail) || '',
                isLive: !!basicInfo.is_live,
                duration: basicInfo.duration,
                addToHistory: () => {
                    return info?.addToWatchHistory();
                }
            };
            if (info.playability_status?.status === 'UNPLAYABLE') {
                // Check if this video has a trailer (non-purchased movies / films)
                if (info.has_trailer) {
                    const trailerInfo = info.getTrailerInfo();
                    if (trailerInfo) {
                        result.stream = __classPrivateFieldGet(this, _VideoModel_instances, "m", _VideoModel_chooseFormat).call(this, innertube, trailerInfo);
                    }
                }
                else {
                    throw Error(info.playability_status.reason);
                }
            }
            else if (!result.isLive) {
                try {
                    result.stream = __classPrivateFieldGet(this, _VideoModel_instances, "m", _VideoModel_chooseFormat).call(this, innertube, info);
                }
                catch (error) {
                    if (error instanceof volumio_youtubei_js_1.Utils.PlayerError && client !== 'WEB_EMBEDDED') {
                        // Sometimes with default client we fail to get the stream because format is missing url / cipher, leading to 
                        // "No valid URL to decipher" error. In this case, we retry with 'WEB_EMBEDDED' client.
                        YouTube2Context_1.default.getLogger().warn(`[youtube2] Error getting stream with default client in VideoModel.getInfo(${videoId}): ${error.message} - retry with 'WEB_EMBEDDED' client.`);
                        return await this.getPlaybackInfo(videoId, 'WEB_EMBEDDED');
                    }
                    throw error;
                }
            }
            else {
                const hlsManifestUrl = info.streaming_data?.hls_manifest_url;
                const streamUrlFromHLS = hlsManifestUrl ? await __classPrivateFieldGet(this, _VideoModel_instances, "m", _VideoModel_getStreamUrlFromHLS).call(this, hlsManifestUrl, YouTube2Context_1.default.getConfigValue('liveStreamQuality')) : null;
                result.stream = streamUrlFromHLS ? { url: streamUrlFromHLS } : null;
            }
            // Might need to wait a few seconds before stream becomes accessible (instead of getting 403 Forbidden).
            // We add a test routine here and sleep for a while between retries
            // See: https://github.com/yt-dlp/yt-dlp/issues/14097
            if (result.stream) {
                const startTime = new Date().getTime();
                YouTube2Context_1.default.getLogger().info(`[youtube2] VideoModel.getInfo(${videoId}): validating stream URL "${result.stream.url}"...`);
                let tries = 0;
                let testStreamResult = await __classPrivateFieldGet(this, _VideoModel_instances, "m", _VideoModel_head).call(this, result.stream.url, signal);
                while (!testStreamResult.ok && tries < 3) {
                    if (signal?.aborted) {
                        throw Error('Aborted');
                    }
                    YouTube2Context_1.default.getLogger().warn(`[youtube2] VideoModel.getInfo(${videoId}): stream validation failed (${testStreamResult.status} - ${testStreamResult.statusText}); retrying after 2s...`);
                    await __classPrivateFieldGet(this, _VideoModel_instances, "m", _VideoModel_sleep).call(this, 2000);
                    tries++;
                    testStreamResult = await __classPrivateFieldGet(this, _VideoModel_instances, "m", _VideoModel_head).call(this, result.stream.url);
                }
                const endTime = new Date().getTime();
                const timeTaken = (endTime - startTime) / 1000;
                if (tries === 3) {
                    YouTube2Context_1.default.getLogger().warn(`[youtube2] VideoModel.getInfo(${videoId}): failed to validate stream URL "${result.stream.url}" (retried ${tries} times in ${timeTaken}s).`);
                }
                else {
                    YouTube2Context_1.default.getLogger().info(`[youtube2] VideoModel.getInfo(${videoId}): stream validated in ${timeTaken}s.`);
                }
            }
            if (signal?.aborted) {
                throw Error('Aborted');
            }
            return result;
        }
        catch (error) {
            YouTube2Context_1.default.getLogger().error(YouTube2Context_1.default.getErrorMessage(`[youtube2] Error in VideoModel.getInfo(${videoId}): `, error));
            return null;
        }
    }
}
_VideoModel_instances = new WeakSet(), _VideoModel_sleep = function _VideoModel_sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}, _VideoModel_head = async function _VideoModel_head(url, signal) {
    const res = await fetch(url, { method: 'HEAD', signal });
    return {
        ok: res.ok,
        status: res.status,
        statusText: res.statusText
    };
}, _VideoModel_chooseFormat = function _VideoModel_chooseFormat(innertube, videoInfo) {
    const format = videoInfo?.chooseFormat(BEST_AUDIO_FORMAT);
    const streamUrl = format ? format.decipher(innertube.session.player) : null;
    const streamData = format ? { ...format, url: streamUrl } : null;
    return __classPrivateFieldGet(this, _VideoModel_instances, "m", _VideoModel_parseStreamData).call(this, streamData);
}, _VideoModel_parseStreamData = function _VideoModel_parseStreamData(data) {
    if (!data) {
        return null;
    }
    const audioBitrate = ITAG_TO_BITRATE[data.itag];
    return {
        url: data.url,
        mimeType: data.mime_type,
        bitrate: audioBitrate ? `${audioBitrate} kbps` : null,
        sampleRate: data.audio_sample_rate,
        channels: data.audio_channels
    };
}, _VideoModel_getStreamUrlFromHLS = async function _VideoModel_getStreamUrlFromHLS(manifestUrl, targetQuality) {
    if (!manifestUrl) {
        return null;
    }
    if (!targetQuality || targetQuality === 'auto') {
        return manifestUrl;
    }
    const res = await fetch(manifestUrl);
    const manifestContents = await res.text();
    // Match Resolution and Url
    const regex = /#EXT-X-STREAM-INF.*RESOLUTION=(\d+x\d+).*[\r\n](.+)/gm;
    const playlistVariants = [];
    // Modified from regex101's code generator :)
    let m;
    while ((m = regex.exec(manifestContents)) !== null) {
        if (m.index === regex.lastIndex) {
            regex.lastIndex++;
        }
        const variant = {};
        playlistVariants.push(variant);
        m.forEach((match, groupIndex) => {
            if (groupIndex === 1) { // Resolution
                variant.quality = `${match.split('x')[1]}p`;
            }
            if (groupIndex === 2) {
                variant.url = match;
            }
        });
    }
    // Find matching variant or closest one that is lower than targetQuality
    const targetQualityInt = parseInt(targetQuality);
    const diffs = playlistVariants.map((variant) => ({
        variant,
        qualityDelta: targetQualityInt - (variant.quality ? parseInt(variant.quality) : 0)
    }));
    const closest = diffs.filter((v) => v.qualityDelta >= 0).sort((v1, v2) => v1.qualityDelta - v2.qualityDelta)[0];
    return closest?.variant.url || playlistVariants[0]?.url || null;
};
exports.default = VideoModel;
//# sourceMappingURL=VideoModel.js.map