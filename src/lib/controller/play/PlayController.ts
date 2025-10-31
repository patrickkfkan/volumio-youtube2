// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import libQ from 'kew';

import yt2 from '../../YouTube2Context';
import Model, { ModelType } from '../../model';
import { EndpointType, type WatchEndpoint } from '../../types/Endpoint';
import { kewToJSPromise } from '../../util';
import { type ExplodedTrackInfo } from '../browse/view-handlers/ExplodableViewHandler';
import { type QueueItem } from '../browse/view-handlers/ExplodableViewHandler';
import ViewHelper from '../browse/view-handlers/ViewHelper';
import ExplodeHelper from '../../util/ExplodeHelper';
import { type GenericView } from '../browse/view-handlers/GenericViewHandler';
import type VideoPlaybackInfo from '../../types/VideoPlaybackInfo';
import { type ContentItem } from '../../types';
import EndpointHelper from '../../util/EndpointHelper';
import EventEmitter from 'events';
import { AutoplayManager, LastPlaybackInfo } from 'volumio-yt-support';

export default class PlayController {

  #mpdPlugin: any;
  #prefetchPlaybackStateFixer: PrefetchPlaybackStateFixer | null;
  #prefetchAborter: AbortController | null;
  #autoplayManager: AutoplayManager;

  constructor() {
    this.#mpdPlugin = yt2.getMpdPlugin();
    this.#prefetchPlaybackStateFixer = new PrefetchPlaybackStateFixer();
    this.#prefetchAborter = null;
    this.#autoplayManager = new AutoplayManager({
      serviceName: 'youtube2',
      volumioCoreCommand: yt2.volumioCoreCommand,
      stateMachine: yt2.getStateMachine(),
      mpdPlugin: yt2.getMpdPlugin(),
      getConfigValue: (key) => yt2.getConfigValue(key),
      getAutoplayItems: this.#getAutoplayItems.bind(this),
      logger: {
        info: (msg) => yt2.getLogger().info(`[youtube2] ${msg}`),
        warn: (msg) => yt2.getLogger().warn(`[youtube2] ${msg}`),
        error: (msg) => yt2.getLogger().error(`[youtube2] ${msg}`),
      }
    });
    this.#autoplayManager.on('queued', ({items}) => {
      if (items.length === 0) {
        yt2.toast('info', yt2.getI18n('YOUTUBE2_AUTOPLAY_NO_ITEMS'));
      }
      else if (items.length > 1) {
        yt2.toast('success', yt2.getI18n('YOUTUBE2_AUTOPLAY_ADDED', items.length));
      }
      else {
        yt2.toast('success', yt2.getI18n('YOUTUBE2_AUTOPLAY_ADDED_SINGLE', items[0].title));
      }
    });
  }

  reset() {
    this.#autoplayManager.disable();
    this.#prefetchPlaybackStateFixer?.reset();
    this.#prefetchPlaybackStateFixer = null;
  }

  /**
   * Track uri:
   * - youtube2/video@endpoint={...}@explodeTrackData={...}
   *
   */
  async clearAddPlayTrack(track: QueueItem) {
    yt2.getLogger().info(`[youtube2-play] clearAddPlayTrack: ${track.uri}`);

    this.#cancelPrefetch();
    this.#prefetchPlaybackStateFixer?.notifyPrefetchCleared();

    const {videoId, info: playbackInfo} = await PlayController.getPlaybackInfoFromUri(track.uri);
    if (!playbackInfo) {
      throw Error(`Could not obtain playback info for videoId: ${videoId})`);
    }

    const stream = playbackInfo.stream;
    if (!stream?.url) {
      yt2.toast('error', yt2.getI18n('YOUTUBE2_ERR_NO_STREAM', track.name));
      throw Error(`Stream not found for videoId: ${videoId}`);
    }

    const sm = yt2.getStateMachine();

    this.#updateTrackWithPlaybackInfo(track, playbackInfo);
    if (playbackInfo.duration) {
      /**
       * Notes:
       * - Ideally, we should have duration in `explodeTrackData` (set at browse time), but we didn't do this
       *   plus there is no guarantee that duration is always available when browsing.
       * - So we directly set `currentSongDuration` of statemachine -- required to trigger prefetch.
       */
      sm.currentSongDuration = playbackInfo.duration * 1000;
    }

    this.#autoplayManager.enable();

    const safeStreamUrl = stream.url.replace(/"/g, '\\"');
    await this.#doPlay(safeStreamUrl, track);

    if (yt2.getConfigValue('addToHistory')) {
      try {
        void playbackInfo.addToHistory();
      }
      catch (error) {
        yt2.getLogger().error(yt2.getErrorMessage(`[youtube2-play] Error: could not add to history (videoId: ${videoId}): `, error));
      }
    }
  }

  #updateTrackWithPlaybackInfo(track: QueueItem, playbackInfo: VideoPlaybackInfo) {
    track.title = playbackInfo.title || track.title;
    track.name = playbackInfo.title || track.title;
    track.artist = playbackInfo.author?.name || track.artist;
    track.albumart = playbackInfo.thumbnail || track.albumart;
    track.duration = playbackInfo.isLive ? 0 : playbackInfo.duration;
    if (playbackInfo.stream?.bitrate) {
      track.samplerate = playbackInfo.stream.bitrate;
    }
    return track;
  }

  // Returns kew promise!
  stop() {
    this.#autoplayManager.disable();
    yt2.getStateMachine().setConsumeUpdateService('mpd', true, false);
    return this.#mpdPlugin.stop();
  }

  // Returns kew promise!
  pause() {
    yt2.getStateMachine().setConsumeUpdateService('mpd', true, false);
    return this.#mpdPlugin.pause();
  }

  // Returns kew promise!
  resume() {
    yt2.getStateMachine().setConsumeUpdateService('mpd', true, false);
    return this.#mpdPlugin.resume();
  }

  // Returns kew promise!
  seek(position: number) {
    yt2.getStateMachine().setConsumeUpdateService('mpd', true, false);
    return this.#mpdPlugin.seek(position);
  }

  // Returns kew promise!
  next() {
    yt2.getStateMachine().setConsumeUpdateService('mpd', true, false);
    return this.#mpdPlugin.next();
  }

  // Returns kew promise!
  previous() {
    yt2.getStateMachine().setConsumeUpdateService(undefined);
    return yt2.getStateMachine().previous();
  }

  static async getPlaybackInfoFromUri(uri: string, signal?: AbortSignal): Promise<{videoId: string; info: VideoPlaybackInfo | null}> {
    const watchEndpoint = ExplodeHelper.getExplodedTrackInfoFromUri(uri)?.endpoint;
    const videoId = watchEndpoint?.payload?.videoId;
    if (!videoId) {
      throw Error(`Invalid track uri: ${uri}`);
    }

    const model = Model.getInstance(ModelType.Video);
    return {
      videoId,
      info: await model.getPlaybackInfo(videoId, undefined, signal)
    };
  }

  #doPlay(streamUrl: string, track: QueueItem) {
    const mpdPlugin = this.#mpdPlugin;

    return kewToJSPromise(mpdPlugin.sendMpdCommand('stop', [])
      .then(() => {
        return mpdPlugin.sendMpdCommand('clear', []);
      })
      .then(() => {
        return mpdPlugin.sendMpdCommand(`addid "${this.#appendTrackTypeToStreamUrl(streamUrl)}"`, []);
      })
      .then((addIdResp: { Id: string }) => this.#mpdAddTags(addIdResp, track))
      .then(() => {
        yt2.getStateMachine().setConsumeUpdateService('mpd', true, false);
        return mpdPlugin.sendMpdCommand('play', []);
      }));
  }

  #appendTrackTypeToStreamUrl(url: string) {
    /**
     * Fool MPD plugin to return correct `trackType` in `parseTrackInfo()` by adding
     * track type to URL query string as a dummy param.
     */
    return `${url}&t.YouTube`;
  }

  // Returns kew promise!
  #mpdAddTags(mpdAddIdResponse: { Id: string }, track: QueueItem) {
    const songId = mpdAddIdResponse?.Id;
    if (songId !== undefined) {
      const cmds = [];
      cmds.push({
        command: 'addtagid',
        parameters: [ songId, 'title', track.title ]
      });
      if (track.album) {
        cmds.push({
          command: 'addtagid',
          parameters: [ songId, 'album', track.album ]
        });
      }
      cmds.push({
        command: 'addtagid',
        parameters: [ songId, 'artist', track.artist ]
      });

      return this.#mpdPlugin.sendMpdCommandArray(cmds);
    }
    return libQ.resolve();
  }

  async #getAutoplayItems(lastPlaybackInfo: LastPlaybackInfo) {
    const lastPlayedEndpoint = ExplodeHelper.getExplodedTrackInfoFromUri(lastPlaybackInfo.track.uri)?.endpoint;
    const videoId = lastPlayedEndpoint?.payload?.videoId;

    if (!videoId) {
      return [];
    }

    yt2.getLogger().info(`[youtube2-play] Obtaining autoplay videos for ${videoId}`);

    const autoplayPayload: WatchEndpoint['payload'] = {
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

    const autoplayFetchEndpoint: WatchEndpoint = {
      type: EndpointType.Watch,
      payload: autoplayPayload
    };

    const endpointModel = Model.getInstance(ModelType.Endpoint);
    const contents = await endpointModel.getContents(autoplayFetchEndpoint);

    const autoplayItems: ExplodedTrackInfo[] = [];

    // Get from current playlist, if any.
    if (contents?.playlist) {
      const currentIndex = contents.playlist.currentIndex || 0;
      const itemsAfter = contents.playlist.items?.slice(currentIndex + 1).filter((item) => item.type === 'video') || [];
      const explodedTrackInfos = itemsAfter.map((item) => ExplodeHelper.getExplodedTrackInfoFromVideo(item));
      autoplayItems.push(...explodedTrackInfos);
      yt2.getLogger().info(`[youtube2-play] Obtained ${autoplayItems.length} videos for autoplay from current playlist`);
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
    const autoplayPrefMixRelated = yt2.getConfigValue('autoplayPrefMixRelated');
    const relatedItems = contents?.related?.items;

    // 1. Mix
    if (autoplayItems.length === 0 && relatedItems && autoplayPrefMixRelated) {
      const mixPlaylist = relatedItems.find((item) => item.type === 'playlist' && item.isMix) as ContentItem.Playlist;
      if (mixPlaylist?.endpoint && EndpointHelper.isType(mixPlaylist.endpoint, EndpointType.Watch)) {
        // Get videos in the Mix playlist
        const mixPlaylistContents = await endpointModel.getContents(mixPlaylist.endpoint);
        if (mixPlaylistContents?.playlist?.items) {
          const mixes = mixPlaylistContents.playlist.items.filter((item) => item.videoId !== videoId);
          autoplayItems.push(...mixes.map((item) => ExplodeHelper.getExplodedTrackInfoFromVideo(item)));
          yt2.getLogger().info(`[youtube2-play] Obtained ${autoplayItems.length} videos for autoplay from Mix playlist ${mixPlaylist.playlistId}`);
        }
      }
    }

    // 2. Related
    if (autoplayItems.length === 0 && relatedItems && autoplayPrefMixRelated) {
      const relatedVideos = relatedItems.filter((item) => item.type === 'video');
      if (relatedVideos) {
        autoplayItems.push(...relatedVideos.map((item) => ExplodeHelper.getExplodedTrackInfoFromVideo(item)));
        yt2.getLogger().info(`[youtube2-play] Obtained ${autoplayItems.length} related videos for autoplay`);
      }
    }

    // 3. YouTube default
    if (autoplayItems.length === 0 && contents?.autoplay?.payload?.videoId) {
      const videoModel = Model.getInstance(ModelType.Video);
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
      yt2.getLogger().info('[youtube2-play] Used YouTube default result for autoplay');
    }

    if (autoplayItems.length > 0) {
      return autoplayItems.map((item) => ExplodeHelper.createQueueItemFromExplodedTrackInfo(item));
    }

    return [];
  }

  async getGotoUri(type: 'album' | 'artist', uri: QueueItem['uri']): Promise<string | null> {
    if (type === 'album') {
      const playlistId = ExplodeHelper.getExplodedTrackInfoFromUri(uri)?.endpoint?.payload?.playlistId;
      if (playlistId) {
        const targetView: GenericView = {
          name: 'generic',
          endpoint: {
            type: EndpointType.Browse,
            payload: {
              browseId: `${(!playlistId.startsWith('VL') ? 'VL' : '')}${playlistId}`
            }
          }
        };
        return `youtube2/${ViewHelper.constructUriSegmentFromView(targetView)}`;
      }
    }
    else if (type === 'artist') {
      const videoId = ExplodeHelper.getExplodedTrackInfoFromUri(uri)?.endpoint?.payload?.videoId;
      if (videoId) {
        const model = Model.getInstance(ModelType.Video);
        const playbackInfo = await model.getPlaybackInfo(videoId);
        const channelId = playbackInfo?.author?.channelId;
        if (channelId) {
          const targetView: GenericView = {
            name: 'generic',
            endpoint: {
              type: EndpointType.Browse,
              payload: {
                browseId: channelId
              }
            }
          };
          return `youtube2/${ViewHelper.constructUriSegmentFromView(targetView)}`;
        }
      }
    }

    return null;
  }

  async prefetch(track: QueueItem) {
    // Cancel any ongoing prefetch
    this.#cancelPrefetch();
    const prefetchEnabled = yt2.getConfigValue('prefetch');
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
      yt2.getLogger().info('[youtube2-play] Prefetch disabled');
      yt2.getStateMachine().prefetchDone = false;
      return;
    }
    let streamUrl;
    // Only set `prefetchDone` to `true` on success.
    // Volumio gives us 5 seconds to prefetch before going to next song,
    // setting this to `false` will make it play next track without prefetch
    // - this can happen if prefetch fails or takes too long.
    yt2.getStateMachine().prefetchDone = false;
    this.#prefetchAborter = new AbortController();
    const signal = this.#prefetchAborter.signal;
    try {
      const { videoId, info: playbackInfo } = await PlayController.getPlaybackInfoFromUri(track.uri, signal);
      streamUrl = playbackInfo?.stream?.url;
      if (!streamUrl || !playbackInfo) {
        throw Error(`Stream not found for videoId '${videoId}'`);
      }
      this.#updateTrackWithPlaybackInfo(track, playbackInfo);
      yt2.getStateMachine().prefetchDone = true;
    }
    catch (error: any) {
      if (signal.aborted) {
        yt2.getLogger().info(`[youtube2-play] Prefetch aborted: ${track.name}`);
        return;
      }
      yt2.getLogger().error(`[youtube2-play] Prefetch failed: ${error}`);
      return;
    }
    finally {
      this.#prefetchAborter = null;
    }

    const mpdPlugin = this.#mpdPlugin;
    const res = await kewToJSPromise(mpdPlugin.sendMpdCommand(`addid "${this.#appendTrackTypeToStreamUrl(streamUrl)}"`, [])
      .then((addIdResp: { Id: string }) => this.#mpdAddTags(addIdResp, track))
      .then(() => {
        yt2.getLogger().info(`[youtube2-play] Prefetched and added track to MPD queue: ${track.name}`);
        return mpdPlugin.sendMpdCommand('consume 1', []);
      }));

    this.#prefetchPlaybackStateFixer?.notifyPrefetched(track);

    return res;
  }

  #cancelPrefetch() {
    if (this.#prefetchAborter) {
      this.#prefetchAborter.abort();
      this.#prefetchAborter = null;
    }
  }
}

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
class PrefetchPlaybackStateFixer extends EventEmitter {

  #positionAtPrefetch: number;
  #prefetchedTrack: QueueItem | null;
  #volumioPushStateListener: ((state: any) => void) | null;

  constructor() {
    super();
    this.#positionAtPrefetch = -1;
    this.#prefetchedTrack = null;
  }

  reset() {
    this.#removePushStateListener();
    this.removeAllListeners();
  }

  notifyPrefetched(track: QueueItem) {
    this.#positionAtPrefetch = yt2.getStateMachine().currentPosition;
    this.#prefetchedTrack = track;
    this.#addPushStateListener();
  }

  notifyPrefetchCleared() {
    this.#removePushStateListener();
  }

  #addPushStateListener() {
    if (!this.#volumioPushStateListener) {
      this.#volumioPushStateListener = this.#handleVolumioPushState.bind(this);
      yt2.volumioCoreCommand?.addCallback('volumioPushState', this.#volumioPushStateListener);
    }
  }

  #removePushStateListener() {
    if (this.#volumioPushStateListener) {
      const listeners = yt2.volumioCoreCommand?.callbacks?.['volumioPushState'] || [];
      const index = listeners.indexOf(this.#volumioPushStateListener);
      if (index >= 0) {
        yt2.volumioCoreCommand.callbacks['volumioPushState'].splice(index, 1);
      }
      this.#volumioPushStateListener = null;
      this.#positionAtPrefetch = -1;
      this.#prefetchedTrack = null;
    }
  }

  #handleVolumioPushState(state: any) {
    const sm = yt2.getStateMachine();
    const currentPosition = sm.currentPosition as number;
    if (sm.getState().service !== 'youtube2') {
      this.#removePushStateListener();
      return;
    }
    if (this.#positionAtPrefetch >= 0 && this.#positionAtPrefetch !== currentPosition) {
      const track = sm.getTrack(currentPosition);
      const pf = this.#prefetchedTrack;
      this.#removePushStateListener();
      if (track && state && pf && track.service === 'youtube2' && pf.uri === track.uri) {
        if (state.uri !== track.uri) {
          const mpdPlugin = yt2.getMpdPlugin();
          mpdPlugin.getState().then((st: any) => mpdPlugin.pushState(st));
        }
        this.emit('playPrefetch', {
          track: pf,
          position: currentPosition
        });
      }
    }
  }

  emit(event: 'playPrefetch', info: { track: QueueItem; position: number; }): boolean;
  emit(event: string | symbol, ...args: any[]): boolean {
    return super.emit(event, ...args);
  }

  on(event: 'playPrefetch', listener: (info: { track: QueueItem; position: number; }) => void): this;
  on(event: string | symbol, listener: (...args: any[]) => void): this {
    super.on(event, listener);
    return this;
  }
}
