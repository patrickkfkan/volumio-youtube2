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
 * - youtube2/mix@videoId=X@gen=G      -> generation G of that Mix (as displayed)
 * - youtube2/mix@videoId=X@gen=G@save=1 -> same, and save it as a Volumio playlist
 *
 * Every browse without `gen` generates a new Mix: the seed's Mix is extended
 * (continuation) and mixed with the Mixes of randomly picked tracks, then
 * MIX_SIZE tracks are drawn at random (seed first). The generation is cached so
 * that Play / Add / Save act on what is displayed.
 */
export interface MixView extends View {
  name: 'mix';
  videoId?: string;
  gen?: string;
  save?: '1';
}

/** Videos longer than this are dropped from the Mix (seed video excepted). */
const MIX_MAX_DURATION_SEC = 15 * 60;
/** Number of tracks in a generated Mix. */
const MIX_SIZE = 100;
/**
 * Share of the Mix (at most) taken from the account's personalized Mix. The rest
 * comes from the anonymous (non-personalized) Mix of the seed and of its tracks,
 * i.e. tracks related to the seed rather than the account's usual favourites.
 */
const MIX_PERSONAL_SHARE = 0.35;
/** Pool size aimed at for related tracks (leaves room for randomness). */
const MIX_RELATED_POOL_TARGET = 200;
/** Max anonymous /next requests per generation (about 1 s each, run 4 at a time). */
const MIX_MAX_ANON_FETCHES = 16;
/** Generations kept in memory. */
const MIX_CACHE_SIZE = 10;
/** Draw weights: the seed's own Mix is favoured over the Mixes of its tracks. */
const MIX_WEIGHT_SEED_MIX = 4;
const MIX_WEIGHT_SEED_CONTINUATION = 3;
const MIX_WEIGHT_RELATED_MIX = 1;
/** Bonus each time a track shows up again in another Mix (closely related). */
const MIX_WEIGHT_RECURRENCE = 1;
/** Bonus for a related track that is also in the account's Mix (related and liked). */
const MIX_WEIGHT_ALSO_PERSONAL = 2;
/** Weight multiplier for tracks found in the account's watch history. */
const MIX_HISTORY_FACTOR = 0.15;
/** Watch history pages read (about 20-50 videos each), and cache lifetime. */
const MIX_HISTORY_PAGES = 4;
const MIX_HISTORY_TTL_MS = 10 * 60 * 1000;
/** Fallback WEB client version for anonymous requests. */
const ANON_CLIENT_VERSION = '2.20251101.00.00';

let historyCache: { ids: Set<string>; expires: number } | null = null;

interface MixData {
  videoId: string;
  gen: string;
  created: number;
  title: string;
  thumbnail?: string;
  videos: ContentItem.Video[];
}

const mixCache = new Map<string, MixData>();

/** Collects video IDs from a (possibly nested) list of page sections. */
function collectVideoIds(items: any[] | undefined, out: Set<string>) {
  for (const item of items || []) {
    if (item?.type === 'video' && item.videoId) {
      out.add(item.videoId);
    }
    else if (item?.type === 'section') {
      collectVideoIds(item.items, out);
    }
  }
}

/** Deduped (videoId + normalized title) set of tracks with draw weights. */
class TrackPool {
  readonly items: ContentItem.Video[] = [];
  readonly weights = new Map<string, number>();
  #idOf = new Map<string, string>();

  constructor(private seedId: string) {}

  // Ignores bracketed parts so that "X (Official Video)" and "X [HD]" collide.
  static norm(s: string) {
    return s.toLowerCase().replace(/\([^)]*\)|\[[^\]]*\]/g, '').replace(/[^\p{L}\p{N}]/gu, '');
  }

  find(item: ContentItem.Video) {
    const t = TrackPool.norm(item.title || '');
    return this.#idOf.get(item.videoId) || (t ? this.#idOf.get(`t:${t}`) : undefined);
  }

  /** Adds the tracks of one Mix; tracks already there get the recurrence bonus. Returns the number added. */
  add(items: ContentItem.Video[], weight: number) {
    let added = 0;
    const seenInThisMix = new Set<string>();
    for (const item of items) {
      const known = this.find(item);
      if (known) {
        if (!seenInThisMix.has(known)) {
          seenInThisMix.add(known);
          this.weights.set(known, Math.max(this.weights.get(known) || 0, weight) + MIX_WEIGHT_RECURRENCE);
        }
        continue;
      }
      if (item.videoId !== this.seedId && item.duration && item.duration > MIX_MAX_DURATION_SEC) {
        continue;
      }
      const t = TrackPool.norm(item.title || '');
      this.#idOf.set(item.videoId, item.videoId);
      if (t) {
        this.#idOf.set(`t:${t}`, item.videoId);
      }
      seenInThisMix.add(item.videoId);
      this.weights.set(item.videoId, weight);
      this.items.push(item);
      added++;
    }
    return added;
  }

  /**
   * Weighted draw without replacement (Efraimidis-Spirakis: key = u^(1/w)),
   * tracks of the watch history being penalized.
   */
  draw(n: number, history: Set<string>, exclude: (item: ContentItem.Video) => boolean) {
    return this.items
      .filter((item) => !exclude(item))
      .map((item) => {
        const w = (this.weights.get(item.videoId) || MIX_WEIGHT_RELATED_MIX) * (history.has(item.videoId) ? MIX_HISTORY_FACTOR : 1);
        return { item, key: Math.random() ** (1 / w) };
      })
      .sort((a, b) => b.key - a.key)
      .slice(0, Math.max(n, 0))
      .map((k) => k.item);
  }
}

/** "4:56" / "1:02:03" -> seconds */
function parseDuration(text?: string) {
  if (!text || !/^\d+(:\d+)*$/.test(text)) {
    return undefined;
  }
  return text.split(':').reduce((acc, part) => acc * 60 + parseInt(part, 10), 0);
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ arr[i], arr[j] ] = [ arr[j], arr[i] ];
  }
  return arr;
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

  static getUri(videoId: string, gen?: string, save = false) {
    const view: MixView = { name: 'mix', videoId };
    if (gen) {
      view.gen = gen;
    }
    if (save) {
      view.save = '1';
    }
    return `youtube2/${ViewHelper.constructUriSegmentFromView(view)}`;
  }

  async browse(): Promise<RenderedPage> {
    const mix = await this.#getMix();
    const playlistName = MixViewHandler.#getPlaylistName(mix);

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
      uri: MixViewHandler.getUri(mix.videoId, mix.gen, true)
    };

    return {
      navigation: {
        prev: { uri: this.constructPrevUri() },
        info: {
          service: 'youtube2',
          type: 'playlist',
          uri: MixViewHandler.getUri(mix.videoId, mix.gen),
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
    const gen = this.currentView.gen;
    if (gen) {
      const cached = mixCache.get(gen);
      if (cached) {
        return cached;
      }
    }

    let videoId = this.currentView.videoId;
    if (!videoId) {
      videoId = MixViewHandler.getCurrentTrack()?.videoId;
    }
    if (!videoId) {
      yt2.toast('error', yt2.getI18n('YOUTUBE2_ERR_MIX_NO_CURRENT'));
      throw Error(yt2.getI18n('YOUTUBE2_ERR_MIX_NO_CURRENT'));
    }

    const mix = await this.#generateMix(videoId, gen);
    mixCache.set(mix.gen, mix);
    while (mixCache.size > MIX_CACHE_SIZE) {
      mixCache.delete(mixCache.keys().next().value as string);
    }
    return mix;
  }

  /** /next on a Mix window (signed-in, personalized): `fromId` at position `index` of Mix `RD<mixId>`. */
  async #fetchMixPage(mixId: string, fromId = mixId, index?: number) {
    const endpoint: WatchEndpoint = {
      type: EndpointType.Watch,
      payload: { videoId: fromId, playlistId: `RD${mixId}`, ...(index !== undefined ? { index } : {}) }
    };
    try {
      const contents = await this.getModel(ModelType.Endpoint).getContents(endpoint);
      return {
        title: contents?.playlist?.title,
        items: contents?.playlist?.items?.filter((item): item is ContentItem.Video => item.type === 'video') || []
      };
    }
    catch (error: unknown) {
      yt2.getLogger().error(yt2.getErrorMessage(`[youtube2-mix] Error fetching Mix RD${mixId} (from ${fromId}):`, error));
      return { title: undefined, items: [] };
    }
  }

  /** Same as #fetchMixPage(), but anonymous (no cookie): the Mix is not personalized. */
  async #fetchAnonMixPage(mixId: string, fromId = mixId, index?: number): Promise<{ title?: string; items: ContentItem.Video[] }> {
    try {
      let client: any = {};
      try {
        const { innertube } = await (this.getModel(ModelType.Endpoint) as any).getInnertube();
        client = innertube?.session?.context?.client || {};
      }
      catch {
        // Fallback values below
      }
      const body = {
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: client.clientName === 'WEB' && client.clientVersion ? client.clientVersion : ANON_CLIENT_VERSION,
            hl: client.hl || 'en',
            gl: client.gl || 'US'
          }
        },
        videoId: fromId,
        playlistId: `RD${mixId}`,
        ...(index !== undefined ? { index } : {})
      };
      const res = await fetch('https://www.youtube.com/youtubei/v1/next?prettyPrint=false', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000)
      });
      if (!res.ok) {
        throw Error(`HTTP ${res.status}`);
      }
      const data: any = await res.json();
      const playlist = data?.contents?.twoColumnWatchNextResults?.playlist?.playlist;
      const items: ContentItem.Video[] = [];
      for (const entry of playlist?.contents || []) {
        const r = entry?.playlistPanelVideoRenderer;
        if (!r?.videoId) {
          continue;
        }
        const title = r.title?.simpleText || r.title?.runs?.map((run: any) => run.text).join('') || r.videoId;
        const byline = r.shortBylineText?.runs?.[0];
        const thumbs = r.thumbnail?.thumbnails || [];
        items.push({
          type: 'video',
          videoId: r.videoId,
          title,
          author: byline?.text ? { name: byline.text, channelId: byline.navigationEndpoint?.browseEndpoint?.browseId } : undefined,
          thumbnail: thumbs.length > 0 ? thumbs[thumbs.length - 1].url : undefined,
          duration: parseDuration(r.lengthText?.simpleText),
          endpoint: {
            type: EndpointType.Watch,
            payload: { videoId: r.videoId, playlistId: `RD${mixId}`, ...(typeof r.navigationEndpoint?.watchEndpoint?.index === 'number' ? { index: r.navigationEndpoint.watchEndpoint.index } : {}) }
          }
        });
      }
      return { title: playlist?.title, items };
    }
    catch (error: unknown) {
      yt2.getLogger().error(yt2.getErrorMessage(`[youtube2-mix] Error fetching anonymous Mix RD${mixId} (from ${fromId}):`, error));
      return { title: undefined, items: [] };
    }
  }

  /** Video IDs of the signed-in account's watch history (empty if not signed in). */
  async #getWatchHistory(): Promise<Set<string>> {
    if (historyCache && historyCache.expires > Date.now()) {
      return historyCache.ids;
    }
    const ids = new Set<string>();
    try {
      const model = this.getModel(ModelType.Endpoint);
      let endpoint: any = { type: EndpointType.Browse, payload: { browseId: 'FEhistory' } };
      for (let page = 0; page < MIX_HISTORY_PAGES && endpoint; page++) {
        const contents: any = await model.getContents(endpoint);
        const sections: any[] = contents?.sections || [];
        collectVideoIds(sections, ids);
        endpoint = null;
        for (const section of sections) {
          if (section?.continuation?.endpoint) {
            endpoint = section.continuation.endpoint;
          }
        }
      }
    }
    catch (error: unknown) {
      yt2.getLogger().error(yt2.getErrorMessage('[youtube2-mix] Error fetching watch history:', error));
    }
    historyCache = { ids, expires: Date.now() + MIX_HISTORY_TTL_MS };
    return ids;
  }

  /**
   * Related tracks: anonymous Mix of the seed, its continuation, and anonymous
   * Mixes of random tracks of the pool. If anonymous requests fail, falls back
   * to the personalized ones.
   */
  async #buildRelatedPool(videoId: string, first: { items: ContentItem.Video[] }, anonymous: boolean) {
    const fetchPage = anonymous ? this.#fetchAnonMixPage.bind(this) : this.#fetchMixPage.bind(this);
    const pool = new TrackPool(videoId);
    pool.add(first.items, MIX_WEIGHT_SEED_MIX);
    let fetches = 1;
    let seedNext: { id: string; index: number } | null = first.items.length > 0 ?
      { id: first.items[first.items.length - 1].videoId, index: first.items.length - 1 } : null;
    const usedSeeds = new Set([ videoId ]);
    while (pool.items.length < MIX_RELATED_POOL_TARGET && fetches < MIX_MAX_ANON_FETCHES) {
      const tasks: Promise<void>[] = [];
      if (seedNext) {
        const { id, index } = seedNext;
        seedNext = null;
        tasks.push(fetchPage(videoId, id, index).then(({ items }) => {
          if (pool.add(items, MIX_WEIGHT_SEED_CONTINUATION) > 0) {
            seedNext = { id: items[items.length - 1].videoId, index: index + items.length - 1 };
          }
        }));
      }
      // Prefer tracks of the seed's own Mix as seeds of further Mixes (stay on topic).
      const candidates = shuffle(pool.items.filter((v) => !usedSeeds.has(v.videoId)))
        .sort((a, b) => (pool.weights.get(b.videoId) || 0) - (pool.weights.get(a.videoId) || 0));
      const batch = Math.min(4 - tasks.length, MIX_MAX_ANON_FETCHES - fetches - tasks.length, candidates.length);
      for (const c of candidates.slice(0, Math.max(batch, 0))) {
        usedSeeds.add(c.videoId);
        tasks.push(fetchPage(c.videoId).then(({ items }) => void pool.add(items, MIX_WEIGHT_RELATED_MIX)));
      }
      if (tasks.length === 0) {
        break;
      }
      fetches += tasks.length;
      await Promise.all(tasks);
    }
    return { pool, fetches };
  }

  async #generateMix(videoId: string, gen?: string): Promise<MixData> {
    const historyPromise = this.#getWatchHistory();
    const [ anonFirst, personalFirst ] = await Promise.all([
      this.#fetchAnonMixPage(videoId),
      this.#fetchMixPage(videoId)
    ]);
    if (anonFirst.items.length === 0 && personalFirst.items.length === 0) {
      yt2.toast('error', yt2.getI18n('YOUTUBE2_ERR_MIX_NOT_FOUND'));
      throw Error(`No Mix found for videoId ${videoId}`);
    }
    const anonymous = anonFirst.items.length > 0;

    // Personalized Mix of the seed (+ its continuation): the account's taste.
    const personal = new TrackPool(videoId);
    personal.add(personalFirst.items, MIX_WEIGHT_SEED_MIX);
    const personalNext = personalFirst.items.length > 0 ?
      this.#fetchMixPage(videoId, personalFirst.items[personalFirst.items.length - 1].videoId, personalFirst.items.length - 1) :
      Promise.resolve({ items: [] as ContentItem.Video[] });

    const [ { pool: related, fetches }, personalCont ] = await Promise.all([
      this.#buildRelatedPool(videoId, anonymous ? anonFirst : personalFirst, anonymous),
      personalNext
    ]);
    personal.add(personalCont.items, MIX_WEIGHT_SEED_CONTINUATION);

    // Related tracks that are also in the account's Mix: related *and* liked.
    for (const item of personal.items) {
      const known = related.find(item);
      if (known) {
        related.weights.set(known, (related.weights.get(known) || 0) + MIX_WEIGHT_ALSO_PERSONAL);
      }
    }

    const history = await historyPromise;
    const seed = related.items.find((item) => item.videoId === videoId) ||
      personal.items.find((item) => item.videoId === videoId) ||
      (anonymous ? anonFirst.items[0] : personalFirst.items[0]);
    const isSeed = (item: ContentItem.Video) => item.videoId === seed.videoId;
    const slots = MIX_SIZE - 1;
    const personalOnly = (item: ContentItem.Video) => isSeed(item) || !!related.find(item);
    const personalCount = anonymous ? Math.round(slots * MIX_PERSONAL_SHARE) : 0;
    let picked = personal.draw(personalCount, history, personalOnly);
    const relatedPicked = related.draw(slots - picked.length, history, isSeed);
    if (picked.length + relatedPicked.length < slots) {
      // Not enough tracks: top up with the personalized Mixes of the best related tracks
      // (still close to the seed), then draw the remainder from the personal pool.
      const topRelated = [ ...related.items ]
        .filter((v) => !isSeed(v))
        .sort((x, y) => (related.weights.get(y.videoId) || 0) - (related.weights.get(x.videoId) || 0))
        .slice(0, 3);
      const extra = await Promise.all(topRelated.map((v) => this.#fetchMixPage(v.videoId)));
      extra.forEach(({ items }) => personal.add(items, MIX_WEIGHT_RELATED_MIX));
      const taken = new Set(picked.map((v) => v.videoId));
      picked = picked.concat(personal.draw(slots - picked.length - relatedPicked.length, history,
        (item) => personalOnly(item) || taken.has(item.videoId)));
    }
    const videos = [ seed, ...shuffle([ ...relatedPicked, ...picked ]) ];

    const title = anonFirst.title || personalFirst.title || `Mix - ${seed.title}`;
    const watched = (list: ContentItem.Video[]) => list.filter((v) => history.has(v.videoId)).length;
    yt2.getLogger().info(`[youtube2-mix] Mix of ${videoId}${anonymous ? '' : ' (anonymous Mix unavailable, personalized only)'}: ` +
      `related pool ${related.items.length} (${watched(related.items)} watched, ${fetches} requests), ` +
      `personal pool ${personal.items.length}, history ${history.size}; drawn ${relatedPicked.length} related + ${picked.length} personal ` +
      `(${watched(videos)} watched)`);
    return {
      videoId,
      gen: gen || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      created: Date.now(),
      title,
      thumbnail: seed.thumbnail,
      videos
    };
  }

  /** One playlist per generation: "Mix - <title> (dd/mm hh:mm)". */
  static #getPlaylistName(mix: MixData) {
    const base = /^mix\s*[-–—:]/i.test(mix.title) ? mix.title.replace(/^mix\s*[-–—:]\s*/i, 'Mix - ') : `Mix - ${mix.title}`;
    const d = new Date(mix.created);
    const p = (n: number) => String(n).padStart(2, '0');
    const stamp = `${p(d.getDate())}.${p(d.getMonth() + 1)} ${p(d.getHours())}h${p(d.getMinutes())}`;
    return `${base.replace(/[/\\:*?"<>|]/g, '-').substring(0, 85).trim()} (${stamp})`;
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
