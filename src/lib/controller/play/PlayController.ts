// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import libQ from 'kew';

import yt2 from '../../YouTube2Context';
import Model, { ModelType } from '../../model';
import Endpoint, { EndpointType } from '../../types/Endpoint';
import { kewToJSPromise } from '../../util';
import { ExplodedTrackInfo } from '../browse/view-handlers/ExplodableViewHandler';
import { QueueItem } from '../browse/view-handlers/ExplodableViewHandler';
import { VideoView } from '../browse/view-handlers/VideoViewHandler';
import ViewHelper from '../browse/view-handlers/ViewHelper';
import ExplodeHelper from '../../util/ExplodeHelper';
import { GenericView } from '../browse/view-handlers/GenericViewHandler';

interface MpdState {
  status: 'play' | 'stop' | 'pause';
  seek: number;
  uri: string;
}

export default class PlayController {

  #mpdPlugin: any;
  #autoplayListener: (() => void) | null;
  #lastPlaybackInfo: {
    track: QueueItem;
    position: number;
  };

  constructor() {
    this.#mpdPlugin = yt2.getMpdPlugin();
    this.#autoplayListener = null;
  }

  #addAutoplayListener() {
    if (!this.#autoplayListener) {
      this.#autoplayListener = () => {
        this.#mpdPlugin.getState().then((state: MpdState) => {
          if (state.status === 'stop') {
            this.#handleAutoplay();
            this.#removeAutoplayListener();
          }
        });
      };
      this.#mpdPlugin.clientMpd.on('system-player', this.#autoplayListener);
    }
  }

  #removeAutoplayListener() {
    if (this.#autoplayListener) {
      this.#mpdPlugin.clientMpd.removeListener('system-player', this.#autoplayListener);
      this.#autoplayListener = null;
    }
  }

  /**
   * Track uri:
   * - youtube2/video@endpoint={...}@explodeTrackData={...}
   *
   */
  async clearAddPlayTrack(track: QueueItem) {
    yt2.getLogger().info(`[youtube2-play] clearAddPlayTrack: ${track.uri}`);

    const watchEndpoint = this.#getExplodedTrackInfoFromUri(track.uri)?.endpoint;
    const videoId = watchEndpoint?.payload?.videoId;
    if (!videoId) {
      throw Error(`Invalid track uri: ${track.uri}`);
    }

    const model = Model.getInstance(ModelType.Video);
    const playbackInfo = await model.getPlaybackInfo(videoId);
    if (!playbackInfo) {
      throw Error(`Could not obtain playback info for videoId: ${videoId})`);
    }

    const stream = playbackInfo.stream;
    if (!stream?.url) {
      yt2.toast('error', yt2.getI18n('YOUTUBE2_ERR_NO_STREAM', track.name));
      throw Error(`Stream not found for videoId: ${videoId}`);
    }

    track.title = playbackInfo.title || track.title;
    track.name = playbackInfo.title || track.title;
    track.artist = playbackInfo.author?.name || track.artist;
    track.albumart = playbackInfo.thumbnail || track.albumart;
    if (stream.bitrate) {
      track.samplerate = stream.bitrate;
    }

    this.#lastPlaybackInfo = {
      track,
      position: yt2.getStateMachine().getState().position
    };

    const safeStreamUrl = stream.url.replace(/"/g, '\\"');
    await this.#doPlay(safeStreamUrl, track);

    if (yt2.getConfigValue('autoplay', false)) {
      this.#addAutoplayListener();
    }

    if (yt2.getConfigValue('addToHistory', true)) {
      try {
        playbackInfo.addToHistory();
      }
      catch (error) {
        yt2.getLogger().error(yt2.getErrorMessage(`[youtube2-play] Error: could not add to history (videoId: ${videoId}): `, error));
      }
    }
  }

  // Returns kew promise!
  stop() {
    this.#removeAutoplayListener();
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

  #getExplodedTrackInfoFromUri(uri: string): ExplodedTrackInfo | null {
    if (!uri) {
      return null;
    }

    const trackView = ViewHelper.getViewsFromUri(uri)[1] as VideoView;

    if (!trackView || trackView.name !== 'video' ||
      trackView.explodeTrackData?.endpoint?.type !== EndpointType.Watch) {
      return null;
    }

    return trackView.explodeTrackData;
  }

  #doPlay(streamUrl: string, track: QueueItem) {
    const mpdPlugin = this.#mpdPlugin;

    return kewToJSPromise(mpdPlugin.sendMpdCommand('stop', [])
      .then(() => {
        return mpdPlugin.sendMpdCommand('clear', []);
      })
      .then(() => {
        return mpdPlugin.sendMpdCommand(`addid "${streamUrl}"`, []);
      })
      .then((addIdResp: { Id: string }) => this.#mpdAddTags(addIdResp, track))
      .then(() => {
        yt2.getStateMachine().setConsumeUpdateService('mpd', true, false);
        return mpdPlugin.sendMpdCommand('play', []);
      }));
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

  async #handleAutoplay() {
    const lastPlayedQueueIndex = this.#findLastPlayedTrackQueueIndex();
    if (lastPlayedQueueIndex < 0) {
      return;
    }

    const stateMachine = yt2.getStateMachine(),
      state = stateMachine.getState(),
      isLastTrack = stateMachine.getQueue().length - 1 === lastPlayedQueueIndex,
      currentPositionChanged = state.position !== lastPlayedQueueIndex; // True if client clicks on another item in the queue

    const noAutoplayConditions = !yt2.getConfigValue('autoplay', false) || currentPositionChanged || !isLastTrack || state.random || state.repeat || state.repeatSingle;
    const getAutoplayItemsPromise = noAutoplayConditions ? Promise.resolve(null) : this.#getAutoplayItems();

    if (!noAutoplayConditions) {
      yt2.toast('info', yt2.getI18n('YOUTUBE2_AUTOPLAY_FETCH'));
    }

    const items = await getAutoplayItemsPromise;
    if (items && items.length > 0) {
      // Add items to queue and play
      const clearQueue = yt2.getConfigValue('autoplayClearQueue', false);
      if (clearQueue) {
        stateMachine.clearQueue();
      }
      stateMachine.addQueueItems(items).then((result: { firstItemIndex: number }) => {
        if (items.length > 1) {
          yt2.toast('success', yt2.getI18n('YOUTUBE2_AUTOPLAY_ADDED', items.length));
        }
        else {
          yt2.toast('success', yt2.getI18n('YOUTUBE2_AUTOPLAY_ADDED_SINGLE', items[0].title));
        }
        stateMachine.play(result.firstItemIndex);
      });
    }
    else if (!noAutoplayConditions) {
      yt2.toast('info', yt2.getI18n('YOUTUBE2_AUTOPLAY_NO_ITEMS'));
    }
  }

  #findLastPlayedTrackQueueIndex() {
    if (!this.#lastPlaybackInfo) {
      return -1;
    }

    const queue = yt2.getStateMachine().getQueue();
    const trackUri = this.#lastPlaybackInfo.track.uri;
    const endIndex = this.#lastPlaybackInfo.position;

    for (let i = endIndex; i >= 0; i--) {
      if (queue[i]?.uri === trackUri) {
        return i;
      }
    }

    return -1;
  }

  async #getAutoplayItems() {
    const lastPlayedEndpoint = this.#getExplodedTrackInfoFromUri(this.#lastPlaybackInfo?.track?.uri)?.endpoint;

    if (!lastPlayedEndpoint?.payload?.videoId) {
      return [];
    }

    const autoplayPayload: Endpoint['payload'] = {
      videoId: lastPlayedEndpoint.payload.videoId
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
      type: EndpointType.Watch,
      payload: autoplayPayload
    } as const;

    const endpointModel = Model.getInstance(ModelType.Endpoint);
    const contents = await endpointModel.getContents(autoplayFetchEndpoint);

    const autoplayItems: ExplodedTrackInfo[] = [];
    if (contents?.playlist) {
      const currentIndex = contents.playlist.currentIndex || 0;
      const itemsAfter = contents.playlist.items?.slice(currentIndex + 1).filter((item) => item.type === 'video') || [];
      const explodedTrackInfos = itemsAfter.map((item) => ExplodeHelper.getExplodedTrackInfoFromVideo(item));
      autoplayItems.push(...explodedTrackInfos);
    }
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
    }

    if (autoplayItems.length > 0) {
      return autoplayItems.map((item) => ExplodeHelper.createQueueItemFromExplodedTrackInfo(item));
    }

    return [];
  }

  async getGotoUri(type: 'album' | 'artist', uri: QueueItem['uri']): Promise<string | null> {
    if (type === 'album') {
      const playlistId = this.#getExplodedTrackInfoFromUri(uri)?.endpoint?.payload?.playlistId;
      if (playlistId) {
        const targetView: GenericView = {
          name: 'generic',
          endpoint: {
            type: EndpointType.Browse,
            payload: {
              browseId: (!playlistId.startsWith('VL') ? 'VL' : '') + playlistId
            }
          }
        };
        return `youtube2/${ViewHelper.constructUriSegmentFromView(targetView)}`;
      }
    }
    else if (type === 'artist') {
      const videoId = this.#getExplodedTrackInfoFromUri(uri)?.endpoint?.payload?.videoId;
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
}
