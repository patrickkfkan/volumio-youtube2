import yt2 from '../../../YouTube2Context';
import { ModelType } from '../../../model';
import { type ContentItem } from '../../../types';
import { EndpointType, type WatchEndpoint } from '../../../types/Endpoint';
import ExplodeHelper from '../../../util/ExplodeHelper';
import { kewToJSPromise } from '../../../util';
import ExplodableViewHandler, { type ExplodedTrackInfo, type QueueItem } from './ExplodableViewHandler';
import type View from './View';
import { type RenderedPage } from './ViewHandler';
import ViewHelper from './ViewHelper';
import { RendererType } from './renderers';
import { type RenderedListItem } from './renderers/BaseRenderer';

/**
 * "Mix" view: YouTube Mix (playlist `RD<videoId>`) of a video,
 * fetched with the signed-in account (personalized).
 *
 * URIs:
 * - youtube2/mix                     -> Mix of the current YouTube track
 * - youtube2/mix@videoId=X           -> Mix of video X
 * - youtube2/mix@videoId=X@save=1    -> same, and save it as a Volumio playlist
 */
export interface MixView extends View {
  name: 'mix';
  videoId?: string;
  save?: '1';
}

/** Videos longer than this are dropped from the Mix (seed video excepted). */
const MIX_MAX_DURATION_SEC = 15 * 60;

interface MixData {
  videoId: string;
  title: string;
  thumbnail?: string;
  videos: ContentItem.Video[];
}

export default class MixViewHandler extends ExplodableViewHandler<MixView> {

  /** The YouTube track currently playing / selected in the queue, if any. */
  static getCurrentTrack(): { videoId: string; title: string } | null {
    try {
      const sm = yt2.getStateMachine();
      const state = sm.getState?.() || {};
      const queue: QueueItem[] = sm.getQueue?.() || [];
      const candidates = [ state, queue[state.position] ];
      for (const item of candidates) {
        if (item?.service === 'youtube2' && item.uri) {
          const videoId = ExplodeHelper.getExplodedTrackInfoFromUri(item.uri)?.endpoint?.payload?.videoId;
          if (videoId) {
            return { videoId, title: item.title || item.name || videoId };
          }
        }
      }
    }
    catch (error: unknown) {
      yt2.getLogger().error(yt2.getErrorMessage('[youtube2-mix] Error obtaining current track:', error));
    }
    return null;
  }

  static getUri(videoId: string, save = false) {
    const view: MixView = { name: 'mix', videoId };
    if (save) {
      view.save = '1';
    }
    return `youtube2/${ViewHelper.constructUriSegmentFromView(view)}`;
  }

  async browse(): Promise<RenderedPage> {
    const mix = await this.#getMix();
    const playlistName = MixViewHandler.#getPlaylistName(mix.title);

    if (this.currentView.save) {
      await this.#save(playlistName, mix);
    }

    const videoRenderer = this.getRenderer(RendererType.Video);
    const trackItems = mix.videos
      .map((video) => videoRenderer.renderToListItem(video))
      .filter((item): item is RenderedListItem => !!item);

    const saveItem: RenderedListItem = {
      service: 'youtube2',
      type: 'item-no-menu',
      title: yt2.getI18n('YOUTUBE2_MIX_SAVE', playlistName),
      icon: 'fa fa-floppy-o',
      uri: MixViewHandler.getUri(mix.videoId, true)
    };

    return {
      navigation: {
        prev: { uri: this.constructPrevUri() },
        info: {
          service: 'youtube2',
          type: 'playlist',
          uri: MixViewHandler.getUri(mix.videoId),
          title: mix.title,
          artist: yt2.getI18n('YOUTUBE2_MIX_TRACKS', trackItems.length),
          albumart: mix.thumbnail
        },
        lists: [
          { availableListViews: [ 'list' ], items: [ saveItem ] },
          {
            title: yt2.getI18n('YOUTUBE2_MIX_TRACKS', trackItems.length),
            availableListViews: [ 'list', 'grid' ],
            items: trackItems
          }
        ]
      }
    };
  }

  protected async getTracksOnExplode(): Promise<ExplodedTrackInfo[]> {
    const mix = await this.#getMix();
    return mix.videos.map((video) => ExplodeHelper.getExplodedTrackInfoFromVideo(video));
  }

  async #getMix(): Promise<MixData> {
    let videoId = this.currentView.videoId;
    if (!videoId) {
      videoId = MixViewHandler.getCurrentTrack()?.videoId;
    }
    if (!videoId) {
      yt2.toast('error', yt2.getI18n('YOUTUBE2_ERR_MIX_NO_CURRENT'));
      throw Error(yt2.getI18n('YOUTUBE2_ERR_MIX_NO_CURRENT'));
    }

    const endpoint: WatchEndpoint = {
      type: EndpointType.Watch,
      payload: { videoId, playlistId: `RD${videoId}` }
    };
    const contents = await this.getModel(ModelType.Endpoint).getContents(endpoint);
    const items = contents?.playlist?.items?.filter((item): item is ContentItem.Video => item.type === 'video') || [];
    if (items.length === 0) {
      yt2.toast('error', yt2.getI18n('YOUTUBE2_ERR_MIX_NOT_FOUND'));
      throw Error(`No Mix found for videoId ${videoId}`);
    }

    // Dedupe (videoId + normalized title) and drop long videos (keeps the seed).
    const seenIds = new Set<string>();
    const seenTitles = new Set<string>();
    const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    const videos = items.filter((item) => {
      const t = norm(item.title || '');
      if (seenIds.has(item.videoId) || (t && seenTitles.has(t))) {
        return false;
      }
      if (item.videoId !== videoId && item.duration && item.duration > MIX_MAX_DURATION_SEC) {
        return false;
      }
      seenIds.add(item.videoId);
      if (t) {
        seenTitles.add(t);
      }
      return true;
    });

    const seed = items.find((item) => item.videoId === videoId) || items[0];
    const title = contents?.playlist?.title || `Mix - ${seed.title}`;
    return { videoId, title, thumbnail: seed.thumbnail, videos };
  }

  static #getPlaylistName(mixTitle: string) {
    const name = /^mix\s*[-–—:]/i.test(mixTitle) ? mixTitle.replace(/^mix\s*[-–—:]\s*/i, 'Mix - ') : `Mix - ${mixTitle}`;
    return name.replace(/[/\\:*?"<>|]/g, '-').substring(0, 100).trim();
  }

  /** Writes the Mix to a Volumio playlist in one go (appending, without duplicates). */
  async #save(name: string, mix: MixData) {
    try {
      const pm = yt2.volumioCoreCommand.playListManager;
      const existing: any[] = (await kewToJSPromise(pm.getPlaylistContent(name))) || [];
      const existingIds = new Set(existing
        .map((entry) => entry?.uri && ExplodeHelper.getExplodedTrackInfoFromUri(entry.uri)?.endpoint?.payload?.videoId)
        .filter(Boolean));
      const newItems = mix.videos
        .filter((video) => !existingIds.has(video.videoId))
        .map((video) => ExplodeHelper.createQueueItemFromExplodedTrackInfo(ExplodeHelper.getExplodedTrackInfoFromVideo(video)));
      if (newItems.length > 0) {
        // commonAddItemsToPlaylist() overwrites the file and reads `name` as title
        const merged = [ ...existing.map((entry) => ({ ...entry, name: entry.title })), ...newItems ];
        await kewToJSPromise(pm.commonAddItemsToPlaylist(pm.playlistFolder, name, merged));
      }
      yt2.toast('success', yt2.getI18n('YOUTUBE2_MIX_SAVED', newItems.length, name, mix.videos.length - newItems.length));
    }
    catch (error: unknown) {
      yt2.getLogger().error(yt2.getErrorMessage('[youtube2-mix] Error saving playlist:', error));
      yt2.toast('error', yt2.getI18n('YOUTUBE2_ERR_MIX_SAVE', name));
    }
  }
}
