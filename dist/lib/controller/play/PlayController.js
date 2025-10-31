"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _PlayController_instances, _PlayController_mpdPlugin, _PlayController_prefetchPlaybackStateFixer, _PlayController_prefetchAborter, _PlayController_autoplayManager, _PlayController_updateTrackWithPlaybackInfo, _PlayController_doPlay, _PlayController_appendTrackTypeToStreamUrl, _PlayController_mpdAddTags, _PlayController_getAutoplayItems, _PlayController_cancelPrefetch, _PrefetchPlaybackStateFixer_instances, _PrefetchPlaybackStateFixer_positionAtPrefetch, _PrefetchPlaybackStateFixer_prefetchedTrack, _PrefetchPlaybackStateFixer_volumioPushStateListener, _PrefetchPlaybackStateFixer_addPushStateListener, _PrefetchPlaybackStateFixer_removePushStateListener, _PrefetchPlaybackStateFixer_handleVolumioPushState;
Object.defineProperty(exports, "__esModule", { value: true });
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const kew_1 = __importDefault(require("kew"));
const YouTube2Context_1 = __importDefault(require("../../YouTube2Context"));
const model_1 = __importStar(require("../../model"));
const Endpoint_1 = require("../../types/Endpoint");
const util_1 = require("../../util");
const ViewHelper_1 = __importDefault(require("../browse/view-handlers/ViewHelper"));
const ExplodeHelper_1 = __importDefault(require("../../util/ExplodeHelper"));
const EndpointHelper_1 = __importDefault(require("../../util/EndpointHelper"));
const events_1 = __importDefault(require("events"));
const volumio_yt_support_1 = require("volumio-yt-support");
class PlayController {
    constructor() {
        _PlayController_instances.add(this);
        _PlayController_mpdPlugin.set(this, void 0);
        _PlayController_prefetchPlaybackStateFixer.set(this, void 0);
        _PlayController_prefetchAborter.set(this, void 0);
        _PlayController_autoplayManager.set(this, void 0);
        __classPrivateFieldSet(this, _PlayController_mpdPlugin, YouTube2Context_1.default.getMpdPlugin(), "f");
        __classPrivateFieldSet(this, _PlayController_prefetchPlaybackStateFixer, new PrefetchPlaybackStateFixer(), "f");
        __classPrivateFieldSet(this, _PlayController_prefetchAborter, null, "f");
        __classPrivateFieldSet(this, _PlayController_autoplayManager, new volumio_yt_support_1.AutoplayManager({
            serviceName: 'youtube2',
            volumioCoreCommand: YouTube2Context_1.default.volumioCoreCommand,
            stateMachine: YouTube2Context_1.default.getStateMachine(),
            mpdPlugin: YouTube2Context_1.default.getMpdPlugin(),
            getConfigValue: (key) => YouTube2Context_1.default.getConfigValue(key),
            getAutoplayItems: __classPrivateFieldGet(this, _PlayController_instances, "m", _PlayController_getAutoplayItems).bind(this),
            logger: {
                info: (msg) => YouTube2Context_1.default.getLogger().info(`[youtube2] ${msg}`),
                warn: (msg) => YouTube2Context_1.default.getLogger().warn(`[youtube2] ${msg}`),
                error: (msg) => YouTube2Context_1.default.getLogger().error(`[youtube2] ${msg}`),
            }
        }), "f");
        __classPrivateFieldGet(this, _PlayController_autoplayManager, "f").on('queued', ({ items }) => {
            if (items.length === 0) {
                YouTube2Context_1.default.toast('info', YouTube2Context_1.default.getI18n('YOUTUBE2_AUTOPLAY_NO_ITEMS'));
            }
            else if (items.length > 1) {
                YouTube2Context_1.default.toast('success', YouTube2Context_1.default.getI18n('YOUTUBE2_AUTOPLAY_ADDED', items.length));
            }
            else {
                YouTube2Context_1.default.toast('success', YouTube2Context_1.default.getI18n('YOUTUBE2_AUTOPLAY_ADDED_SINGLE', items[0].title));
            }
        });
    }
    reset() {
        __classPrivateFieldGet(this, _PlayController_autoplayManager, "f").disable();
        __classPrivateFieldGet(this, _PlayController_prefetchPlaybackStateFixer, "f")?.reset();
        __classPrivateFieldSet(this, _PlayController_prefetchPlaybackStateFixer, null, "f");
    }
    /**
     * Track uri:
     * - youtube2/video@endpoint={...}@explodeTrackData={...}
     *
     */
    async clearAddPlayTrack(track) {
        YouTube2Context_1.default.getLogger().info(`[youtube2-play] clearAddPlayTrack: ${track.uri}`);
        __classPrivateFieldGet(this, _PlayController_instances, "m", _PlayController_cancelPrefetch).call(this);
        __classPrivateFieldGet(this, _PlayController_prefetchPlaybackStateFixer, "f")?.notifyPrefetchCleared();
        const { videoId, info: playbackInfo } = await PlayController.getPlaybackInfoFromUri(track.uri);
        if (!playbackInfo) {
            throw Error(`Could not obtain playback info for videoId: ${videoId})`);
        }
        const stream = playbackInfo.stream;
        if (!stream?.url) {
            YouTube2Context_1.default.toast('error', YouTube2Context_1.default.getI18n('YOUTUBE2_ERR_NO_STREAM', track.name));
            throw Error(`Stream not found for videoId: ${videoId}`);
        }
        const sm = YouTube2Context_1.default.getStateMachine();
        __classPrivateFieldGet(this, _PlayController_instances, "m", _PlayController_updateTrackWithPlaybackInfo).call(this, track, playbackInfo);
        if (playbackInfo.duration) {
            /**
             * Notes:
             * - Ideally, we should have duration in `explodeTrackData` (set at browse time), but we didn't do this
             *   plus there is no guarantee that duration is always available when browsing.
             * - So we directly set `currentSongDuration` of statemachine -- required to trigger prefetch.
             */
            sm.currentSongDuration = playbackInfo.duration * 1000;
        }
        __classPrivateFieldGet(this, _PlayController_autoplayManager, "f").enable();
        const safeStreamUrl = stream.url.replace(/"/g, '\\"');
        await __classPrivateFieldGet(this, _PlayController_instances, "m", _PlayController_doPlay).call(this, safeStreamUrl, track);
        if (YouTube2Context_1.default.getConfigValue('addToHistory')) {
            try {
                void playbackInfo.addToHistory();
            }
            catch (error) {
                YouTube2Context_1.default.getLogger().error(YouTube2Context_1.default.getErrorMessage(`[youtube2-play] Error: could not add to history (videoId: ${videoId}): `, error));
            }
        }
    }
    // Returns kew promise!
    stop() {
        __classPrivateFieldGet(this, _PlayController_autoplayManager, "f").disable();
        YouTube2Context_1.default.getStateMachine().setConsumeUpdateService('mpd', true, false);
        return __classPrivateFieldGet(this, _PlayController_mpdPlugin, "f").stop();
    }
    // Returns kew promise!
    pause() {
        YouTube2Context_1.default.getStateMachine().setConsumeUpdateService('mpd', true, false);
        return __classPrivateFieldGet(this, _PlayController_mpdPlugin, "f").pause();
    }
    // Returns kew promise!
    resume() {
        YouTube2Context_1.default.getStateMachine().setConsumeUpdateService('mpd', true, false);
        return __classPrivateFieldGet(this, _PlayController_mpdPlugin, "f").resume();
    }
    // Returns kew promise!
    seek(position) {
        YouTube2Context_1.default.getStateMachine().setConsumeUpdateService('mpd', true, false);
        return __classPrivateFieldGet(this, _PlayController_mpdPlugin, "f").seek(position);
    }
    // Returns kew promise!
    next() {
        YouTube2Context_1.default.getStateMachine().setConsumeUpdateService('mpd', true, false);
        return __classPrivateFieldGet(this, _PlayController_mpdPlugin, "f").next();
    }
    // Returns kew promise!
    previous() {
        YouTube2Context_1.default.getStateMachine().setConsumeUpdateService(undefined);
        return YouTube2Context_1.default.getStateMachine().previous();
    }
    static async getPlaybackInfoFromUri(uri, signal) {
        const watchEndpoint = ExplodeHelper_1.default.getExplodedTrackInfoFromUri(uri)?.endpoint;
        const videoId = watchEndpoint?.payload?.videoId;
        if (!videoId) {
            throw Error(`Invalid track uri: ${uri}`);
        }
        const model = model_1.default.getInstance(model_1.ModelType.Video);
        return {
            videoId,
            info: await model.getPlaybackInfo(videoId, undefined, signal)
        };
    }
    async getGotoUri(type, uri) {
        if (type === 'album') {
            const playlistId = ExplodeHelper_1.default.getExplodedTrackInfoFromUri(uri)?.endpoint?.payload?.playlistId;
            if (playlistId) {
                const targetView = {
                    name: 'generic',
                    endpoint: {
                        type: Endpoint_1.EndpointType.Browse,
                        payload: {
                            browseId: `${(!playlistId.startsWith('VL') ? 'VL' : '')}${playlistId}`
                        }
                    }
                };
                return `youtube2/${ViewHelper_1.default.constructUriSegmentFromView(targetView)}`;
            }
        }
        else if (type === 'artist') {
            const videoId = ExplodeHelper_1.default.getExplodedTrackInfoFromUri(uri)?.endpoint?.payload?.videoId;
            if (videoId) {
                const model = model_1.default.getInstance(model_1.ModelType.Video);
                const playbackInfo = await model.getPlaybackInfo(videoId);
                const channelId = playbackInfo?.author?.channelId;
                if (channelId) {
                    const targetView = {
                        name: 'generic',
                        endpoint: {
                            type: Endpoint_1.EndpointType.Browse,
                            payload: {
                                browseId: channelId
                            }
                        }
                    };
                    return `youtube2/${ViewHelper_1.default.constructUriSegmentFromView(targetView)}`;
                }
            }
        }
        return null;
    }
    async prefetch(track) {
        // Cancel any ongoing prefetch
        __classPrivateFieldGet(this, _PlayController_instances, "m", _PlayController_cancelPrefetch).call(this);
        const prefetchEnabled = YouTube2Context_1.default.getConfigValue('prefetch');
        if (!prefetchEnabled) {
            /**
             * Volumio doesn't check whether `prefetch()` is actually performed or
             * successful (such as inspecting the result of the function call) -
             * it just sets its internal state variable `prefetchDone`
             * to `true`. This results in the next track being skipped in cases
             * where prefetch is not performed or fails. So we set statemachine's
             * `prefetchDone` variable to `false` and only set it to `true` when
             * prefetch is successful.
             */
            YouTube2Context_1.default.getLogger().info('[youtube2-play] Prefetch disabled');
            YouTube2Context_1.default.getStateMachine().prefetchDone = false;
            return;
        }
        let streamUrl;
        // Only set `prefetchDone` to `true` on success.
        // Volumio gives us 5 seconds to prefetch before going to next song,
        // setting this to `false` will make it play next track without prefetch
        // - this can happen if prefetch fails or takes too long.
        YouTube2Context_1.default.getStateMachine().prefetchDone = false;
        __classPrivateFieldSet(this, _PlayController_prefetchAborter, new AbortController(), "f");
        const signal = __classPrivateFieldGet(this, _PlayController_prefetchAborter, "f").signal;
        try {
            const { videoId, info: playbackInfo } = await PlayController.getPlaybackInfoFromUri(track.uri, signal);
            streamUrl = playbackInfo?.stream?.url;
            if (!streamUrl || !playbackInfo) {
                throw Error(`Stream not found for videoId '${videoId}'`);
            }
            __classPrivateFieldGet(this, _PlayController_instances, "m", _PlayController_updateTrackWithPlaybackInfo).call(this, track, playbackInfo);
            YouTube2Context_1.default.getStateMachine().prefetchDone = true;
        }
        catch (error) {
            if (signal.aborted) {
                YouTube2Context_1.default.getLogger().info(`[youtube2-play] Prefetch aborted: ${track.name}`);
                return;
            }
            YouTube2Context_1.default.getLogger().error(`[youtube2-play] Prefetch failed: ${error}`);
            return;
        }
        finally {
            __classPrivateFieldSet(this, _PlayController_prefetchAborter, null, "f");
        }
        const mpdPlugin = __classPrivateFieldGet(this, _PlayController_mpdPlugin, "f");
        const res = await (0, util_1.kewToJSPromise)(mpdPlugin.sendMpdCommand(`addid "${__classPrivateFieldGet(this, _PlayController_instances, "m", _PlayController_appendTrackTypeToStreamUrl).call(this, streamUrl)}"`, [])
            .then((addIdResp) => __classPrivateFieldGet(this, _PlayController_instances, "m", _PlayController_mpdAddTags).call(this, addIdResp, track))
            .then(() => {
            YouTube2Context_1.default.getLogger().info(`[youtube2-play] Prefetched and added track to MPD queue: ${track.name}`);
            return mpdPlugin.sendMpdCommand('consume 1', []);
        }));
        __classPrivateFieldGet(this, _PlayController_prefetchPlaybackStateFixer, "f")?.notifyPrefetched(track);
        return res;
    }
}
_PlayController_mpdPlugin = new WeakMap(), _PlayController_prefetchPlaybackStateFixer = new WeakMap(), _PlayController_prefetchAborter = new WeakMap(), _PlayController_autoplayManager = new WeakMap(), _PlayController_instances = new WeakSet(), _PlayController_updateTrackWithPlaybackInfo = function _PlayController_updateTrackWithPlaybackInfo(track, playbackInfo) {
    track.title = playbackInfo.title || track.title;
    track.name = playbackInfo.title || track.title;
    track.artist = playbackInfo.author?.name || track.artist;
    track.albumart = playbackInfo.thumbnail || track.albumart;
    track.duration = playbackInfo.isLive ? 0 : playbackInfo.duration;
    if (playbackInfo.stream?.bitrate) {
        track.samplerate = playbackInfo.stream.bitrate;
    }
    return track;
}, _PlayController_doPlay = function _PlayController_doPlay(streamUrl, track) {
    const mpdPlugin = __classPrivateFieldGet(this, _PlayController_mpdPlugin, "f");
    return (0, util_1.kewToJSPromise)(mpdPlugin.sendMpdCommand('stop', [])
        .then(() => {
        return mpdPlugin.sendMpdCommand('clear', []);
    })
        .then(() => {
        return mpdPlugin.sendMpdCommand(`addid "${__classPrivateFieldGet(this, _PlayController_instances, "m", _PlayController_appendTrackTypeToStreamUrl).call(this, streamUrl)}"`, []);
    })
        .then((addIdResp) => __classPrivateFieldGet(this, _PlayController_instances, "m", _PlayController_mpdAddTags).call(this, addIdResp, track))
        .then(() => {
        YouTube2Context_1.default.getStateMachine().setConsumeUpdateService('mpd', true, false);
        return mpdPlugin.sendMpdCommand('play', []);
    }));
}, _PlayController_appendTrackTypeToStreamUrl = function _PlayController_appendTrackTypeToStreamUrl(url) {
    /**
     * Fool MPD plugin to return correct `trackType` in `parseTrackInfo()` by adding
     * track type to URL query string as a dummy param.
     */
    return `${url}&t.YouTube`;
}, _PlayController_mpdAddTags = function _PlayController_mpdAddTags(mpdAddIdResponse, track) {
    const songId = mpdAddIdResponse?.Id;
    if (songId !== undefined) {
        const cmds = [];
        cmds.push({
            command: 'addtagid',
            parameters: [songId, 'title', track.title]
        });
        if (track.album) {
            cmds.push({
                command: 'addtagid',
                parameters: [songId, 'album', track.album]
            });
        }
        cmds.push({
            command: 'addtagid',
            parameters: [songId, 'artist', track.artist]
        });
        return __classPrivateFieldGet(this, _PlayController_mpdPlugin, "f").sendMpdCommandArray(cmds);
    }
    return kew_1.default.resolve();
}, _PlayController_getAutoplayItems = async function _PlayController_getAutoplayItems(lastPlaybackInfo) {
    const lastPlayedEndpoint = ExplodeHelper_1.default.getExplodedTrackInfoFromUri(lastPlaybackInfo.track.uri)?.endpoint;
    const videoId = lastPlayedEndpoint?.payload?.videoId;
    if (!videoId) {
        return [];
    }
    YouTube2Context_1.default.getLogger().info(`[youtube2-play] Obtaining autoplay videos for ${videoId}`);
    const autoplayPayload = {
        videoId
    };
    if (lastPlayedEndpoint.payload.playlistId) {
        autoplayPayload.playlistId = lastPlayedEndpoint.payload.playlistId;
        if (lastPlayedEndpoint.payload.index) {
            autoplayPayload.playlistIndex = lastPlayedEndpoint.payload.index;
        }
    }
    if (lastPlayedEndpoint.payload.params) {
        autoplayPayload.params = lastPlayedEndpoint.payload.params;
    }
    const autoplayFetchEndpoint = {
        type: Endpoint_1.EndpointType.Watch,
        payload: autoplayPayload
    };
    const endpointModel = model_1.default.getInstance(model_1.ModelType.Endpoint);
    const contents = await endpointModel.getContents(autoplayFetchEndpoint);
    const autoplayItems = [];
    // Get from current playlist, if any.
    if (contents?.playlist) {
        const currentIndex = contents.playlist.currentIndex || 0;
        const itemsAfter = contents.playlist.items?.slice(currentIndex + 1).filter((item) => item.type === 'video') || [];
        const explodedTrackInfos = itemsAfter.map((item) => ExplodeHelper_1.default.getExplodedTrackInfoFromVideo(item));
        autoplayItems.push(...explodedTrackInfos);
        YouTube2Context_1.default.getLogger().info(`[youtube2-play] Obtained ${autoplayItems.length} videos for autoplay from current playlist`);
    }
    /**
     * If there are no items added, that means playlist doesn't exist or has
     * reached the end. From here, we obtain the autoplay video in the following
     * order of priority:
     *
     * 1. Videos in a Mix playlist that appears in the Related section
     * 2. Any video in Related section
     * 3. YouTube default
     *
     * (1 and 2 subject to plugin config)
     */
    const autoplayPrefMixRelated = YouTube2Context_1.default.getConfigValue('autoplayPrefMixRelated');
    const relatedItems = contents?.related?.items;
    // 1. Mix
    if (autoplayItems.length === 0 && relatedItems && autoplayPrefMixRelated) {
        const mixPlaylist = relatedItems.find((item) => item.type === 'playlist' && item.isMix);
        if (mixPlaylist?.endpoint && EndpointHelper_1.default.isType(mixPlaylist.endpoint, Endpoint_1.EndpointType.Watch)) {
            // Get videos in the Mix playlist
            const mixPlaylistContents = await endpointModel.getContents(mixPlaylist.endpoint);
            if (mixPlaylistContents?.playlist?.items) {
                const mixes = mixPlaylistContents.playlist.items.filter((item) => item.videoId !== videoId);
                autoplayItems.push(...mixes.map((item) => ExplodeHelper_1.default.getExplodedTrackInfoFromVideo(item)));
                YouTube2Context_1.default.getLogger().info(`[youtube2-play] Obtained ${autoplayItems.length} videos for autoplay from Mix playlist ${mixPlaylist.playlistId}`);
            }
        }
    }
    // 2. Related
    if (autoplayItems.length === 0 && relatedItems && autoplayPrefMixRelated) {
        const relatedVideos = relatedItems.filter((item) => item.type === 'video');
        if (relatedVideos) {
            autoplayItems.push(...relatedVideos.map((item) => ExplodeHelper_1.default.getExplodedTrackInfoFromVideo(item)));
            YouTube2Context_1.default.getLogger().info(`[youtube2-play] Obtained ${autoplayItems.length} related videos for autoplay`);
        }
    }
    // 3. YouTube default
    if (autoplayItems.length === 0 && contents?.autoplay?.payload?.videoId) {
        const videoModel = model_1.default.getInstance(model_1.ModelType.Video);
        // Contents.autoplay is just an endpoint, so we need to get video info (title, author...) from it
        const playbackInfo = await videoModel.getPlaybackInfo(contents.autoplay.payload.videoId);
        if (playbackInfo && playbackInfo.title && playbackInfo.author?.name) {
            autoplayItems.push({
                title: playbackInfo.title,
                artist: playbackInfo.author.name,
                albumart: playbackInfo.thumbnail,
                endpoint: contents.autoplay
            });
        }
        YouTube2Context_1.default.getLogger().info('[youtube2-play] Used YouTube default result for autoplay');
    }
    if (autoplayItems.length > 0) {
        return autoplayItems.map((item) => ExplodeHelper_1.default.createQueueItemFromExplodedTrackInfo(item));
    }
    return [];
}, _PlayController_cancelPrefetch = function _PlayController_cancelPrefetch() {
    if (__classPrivateFieldGet(this, _PlayController_prefetchAborter, "f")) {
        __classPrivateFieldGet(this, _PlayController_prefetchAborter, "f").abort();
        __classPrivateFieldSet(this, _PlayController_prefetchAborter, null, "f");
    }
};
exports.default = PlayController;
/**
 * (Taken from YouTube Music plugin)
 * https://github.com/patrickkfkan/volumio-yt2/blob/master/src/lib/controller/play/PlayController.ts
 *
 * Given state is updated by calling `setConsumeUpdateService('mpd', true)` (`consumeIgnoreMetadata`: true), when moving to
 * prefetched track there's no guarantee the state machine will store the correct consume state obtained from MPD. It depends on
 * whether the state machine increments `currentPosition` before or after MPD calls `pushState()`. The intended
 * order is 'before' - but because the increment is triggered through a timer, it is possible that MPD calls `pushState()` first,
 * thereby causing the state machine to store the wrong state info (title, artist, album...obtained from trackBlock at
 * `currentPosition` which has not yet been incremented).
 *
 * See state machine `syncState()` and  `increasePlaybackTimer()`.
 *
 * `PrefetchPlaybackStateFixer` checks whether the state is consistent when prefetched track is played and `currentPosition` updated
 * and triggers an MPD `pushState()` if necessary.
 */
class PrefetchPlaybackStateFixer extends events_1.default {
    constructor() {
        super();
        _PrefetchPlaybackStateFixer_instances.add(this);
        _PrefetchPlaybackStateFixer_positionAtPrefetch.set(this, void 0);
        _PrefetchPlaybackStateFixer_prefetchedTrack.set(this, void 0);
        _PrefetchPlaybackStateFixer_volumioPushStateListener.set(this, void 0);
        __classPrivateFieldSet(this, _PrefetchPlaybackStateFixer_positionAtPrefetch, -1, "f");
        __classPrivateFieldSet(this, _PrefetchPlaybackStateFixer_prefetchedTrack, null, "f");
    }
    reset() {
        __classPrivateFieldGet(this, _PrefetchPlaybackStateFixer_instances, "m", _PrefetchPlaybackStateFixer_removePushStateListener).call(this);
        this.removeAllListeners();
    }
    notifyPrefetched(track) {
        __classPrivateFieldSet(this, _PrefetchPlaybackStateFixer_positionAtPrefetch, YouTube2Context_1.default.getStateMachine().currentPosition, "f");
        __classPrivateFieldSet(this, _PrefetchPlaybackStateFixer_prefetchedTrack, track, "f");
        __classPrivateFieldGet(this, _PrefetchPlaybackStateFixer_instances, "m", _PrefetchPlaybackStateFixer_addPushStateListener).call(this);
    }
    notifyPrefetchCleared() {
        __classPrivateFieldGet(this, _PrefetchPlaybackStateFixer_instances, "m", _PrefetchPlaybackStateFixer_removePushStateListener).call(this);
    }
    emit(event, ...args) {
        return super.emit(event, ...args);
    }
    on(event, listener) {
        super.on(event, listener);
        return this;
    }
}
_PrefetchPlaybackStateFixer_positionAtPrefetch = new WeakMap(), _PrefetchPlaybackStateFixer_prefetchedTrack = new WeakMap(), _PrefetchPlaybackStateFixer_volumioPushStateListener = new WeakMap(), _PrefetchPlaybackStateFixer_instances = new WeakSet(), _PrefetchPlaybackStateFixer_addPushStateListener = function _PrefetchPlaybackStateFixer_addPushStateListener() {
    if (!__classPrivateFieldGet(this, _PrefetchPlaybackStateFixer_volumioPushStateListener, "f")) {
        __classPrivateFieldSet(this, _PrefetchPlaybackStateFixer_volumioPushStateListener, __classPrivateFieldGet(this, _PrefetchPlaybackStateFixer_instances, "m", _PrefetchPlaybackStateFixer_handleVolumioPushState).bind(this), "f");
        YouTube2Context_1.default.volumioCoreCommand?.addCallback('volumioPushState', __classPrivateFieldGet(this, _PrefetchPlaybackStateFixer_volumioPushStateListener, "f"));
    }
}, _PrefetchPlaybackStateFixer_removePushStateListener = function _PrefetchPlaybackStateFixer_removePushStateListener() {
    if (__classPrivateFieldGet(this, _PrefetchPlaybackStateFixer_volumioPushStateListener, "f")) {
        const listeners = YouTube2Context_1.default.volumioCoreCommand?.callbacks?.['volumioPushState'] || [];
        const index = listeners.indexOf(__classPrivateFieldGet(this, _PrefetchPlaybackStateFixer_volumioPushStateListener, "f"));
        if (index >= 0) {
            YouTube2Context_1.default.volumioCoreCommand.callbacks['volumioPushState'].splice(index, 1);
        }
        __classPrivateFieldSet(this, _PrefetchPlaybackStateFixer_volumioPushStateListener, null, "f");
        __classPrivateFieldSet(this, _PrefetchPlaybackStateFixer_positionAtPrefetch, -1, "f");
        __classPrivateFieldSet(this, _PrefetchPlaybackStateFixer_prefetchedTrack, null, "f");
    }
}, _PrefetchPlaybackStateFixer_handleVolumioPushState = function _PrefetchPlaybackStateFixer_handleVolumioPushState(state) {
    const sm = YouTube2Context_1.default.getStateMachine();
    const currentPosition = sm.currentPosition;
    if (sm.getState().service !== 'youtube2') {
        __classPrivateFieldGet(this, _PrefetchPlaybackStateFixer_instances, "m", _PrefetchPlaybackStateFixer_removePushStateListener).call(this);
        return;
    }
    if (__classPrivateFieldGet(this, _PrefetchPlaybackStateFixer_positionAtPrefetch, "f") >= 0 && __classPrivateFieldGet(this, _PrefetchPlaybackStateFixer_positionAtPrefetch, "f") !== currentPosition) {
        const track = sm.getTrack(currentPosition);
        const pf = __classPrivateFieldGet(this, _PrefetchPlaybackStateFixer_prefetchedTrack, "f");
        __classPrivateFieldGet(this, _PrefetchPlaybackStateFixer_instances, "m", _PrefetchPlaybackStateFixer_removePushStateListener).call(this);
        if (track && state && pf && track.service === 'youtube2' && pf.uri === track.uri) {
            if (state.uri !== track.uri) {
                const mpdPlugin = YouTube2Context_1.default.getMpdPlugin();
                mpdPlugin.getState().then((st) => mpdPlugin.pushState(st));
            }
            this.emit('playPrefetch', {
                track: pf,
                position: currentPosition
            });
        }
    }
};
//# sourceMappingURL=PlayController.js.map