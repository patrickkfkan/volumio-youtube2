import {type YT, type Types, type Innertube} from 'volumio-yt-support/dist/innertube';
import yt2 from '../YouTube2Context';
import type VideoPlaybackInfo from '../types/VideoPlaybackInfo';
import { BaseModel } from './BaseModel';
import InnertubeResultParser from './InnertubeResultParser';
import InnertubeLoader from './InnertubeLoader';
import { YtDlpWrapper } from '../util/YtDlp';

// https://gist.github.com/sidneys/7095afe4da4ae58694d128b1034e01e2
const ITAG_TO_BITRATE: Record<string, string> = {
  '139': '48',
  '140': '128',
  '141': '256',
  '171': '128',
  '249': '50',
  '250': '70',
  '251': '160'
};

const BEST_AUDIO_FORMAT: Types.FormatOptions = {
  type: 'audio',
  format: 'any',
  quality: 'best'
};

interface HLSPlaylistVariant {
  quality?: string;
  url?: string;
}


// Clients:
// WEB_EMBEDDED now throws "This video is unavailable" error.
// ANDROID_VR, MWEB and TV work, but:
// - ANDROID_VR returns 400 error if cookies used (signed-in);
// - MWEB URLs have a 4-second delay before they become valid;
// - TV requires sign-in.

const CLIENTS_WHEN_SIGNED_IN = [
  'WEB',
  'TV',
  'MWEB'
] as const;

const CLIENTS_WHEN_SIGNED_IN_AND_PREFETCH = [
  'WEB',
  'TV'
  // No MWEB here, because of the 4-second delay.
  // This delay coupled with the actual fetch time is enough to screw up
  // prefetching in Volumio.
] as const;

const CLIENTS_WHEN_SIGNED_OUT = [
  'WEB',
  'ANDROID_VR',
  'MWEB'
] as const;

const CLIENTS_WHEN_SIGNED_OUT_AND_PREFETCH = [
  'WEB',
  'ANDROID_VR',
  // No MWEB here, for same reason stated above.
] as const;

type CLIENT = 'WEB' | 'ANDROID_VR' | 'MWEB' | 'TV';

/* yt-dlp streaming URL cache ----------------------------------------------
 * yt-dlp can take ~10 s per video on low-power devices (e.g. a Raspberry Pi,
 * where the JS challenge is solved by node), and
 * Volumio's prefetch only allows 5 s. URLs are therefore resolved in advance
 * (`warmYtDlpUrl()`, called when a track starts for the next one in the queue)
 * and cached until shortly before they expire.
 */
const YTDLP_URL_SAFETY_MARGIN_MS = 30 * 60 * 1000; // drop URLs expiring within 30 min
const YTDLP_URL_DEFAULT_TTL_MS = 3 * 60 * 60 * 1000; // if no `expire` param
const YTDLP_CACHE_MAX = 50;
const ytDlpUrlCache = new Map<string, { url: string; expiresAt: number }>();
const ytDlpInFlight = new Map<string, Promise<string>>();

function getUrlExpiry(url: string) {
  try {
    const expire = Number(new URL(url.split('\n')[0]).searchParams.get('expire'));
    if (expire > 0) {
      return expire * 1000;
    }
  }
  catch (_error: unknown) {
    // Ignore
  }
  return Date.now() + YTDLP_URL_DEFAULT_TTL_MS;
}

export default class VideoModel extends BaseModel {

  static getCachedYtDlpUrl(videoId: string): string | null {
    const entry = ytDlpUrlCache.get(videoId);
    if (entry && entry.expiresAt - YTDLP_URL_SAFETY_MARGIN_MS > Date.now()) {
      return entry.url;
    }
    ytDlpUrlCache.delete(videoId);
    return null;
  }

  /** Cached URL, else the in-flight resolution, else a new yt-dlp run. */
  static getYtDlpUrl(videoId: string): Promise<string> {
    const cached = this.getCachedYtDlpUrl(videoId);
    if (cached) {
      yt2.getLogger().info(`[youtube2] [yt-dlp] Using cached streaming URL for ${videoId}`);
      return Promise.resolve(cached);
    }
    const inFlight = ytDlpInFlight.get(videoId);
    if (inFlight) {
      yt2.getLogger().info(`[youtube2] [yt-dlp] Waiting for in-progress resolution of ${videoId}`);
      return inFlight;
    }
    const startedAt = Date.now();
    const promise = YtDlpWrapper.getInstance().getStreamingUrl(
      `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
      yt2.getConfigValue('ytDlpVersion') ?? undefined
    ).then((url: string) => {
      ytDlpUrlCache.set(videoId, { url, expiresAt: getUrlExpiry(url) });
      while (ytDlpUrlCache.size > YTDLP_CACHE_MAX) {
        ytDlpUrlCache.delete(ytDlpUrlCache.keys().next().value as string);
      }
      yt2.getLogger().info(`[youtube2] [yt-dlp] Resolved ${videoId} in ${Date.now() - startedAt} ms`);
      return url;
    }).finally(() => {
      ytDlpInFlight.delete(videoId);
    });
    ytDlpInFlight.set(videoId, promise);
    return promise;
  }

  /** Resolves the URL in the background (errors are only logged). */
  static warmYtDlpUrl(videoId: string) {
    if (!yt2.getConfigValue('useYtDlp') || this.getCachedYtDlpUrl(videoId) || ytDlpInFlight.has(videoId)) {
      return;
    }
    yt2.getLogger().info(`[youtube2] [yt-dlp] Pre-resolving streaming URL for ${videoId}`);
    this.getYtDlpUrl(videoId).catch((error: unknown) => {
      yt2.getLogger().warn(yt2.getErrorMessage(`[youtube2] [yt-dlp] Pre-resolution failed for ${videoId}:`, error, false));
    });
  }

  async getPlaybackInfo(
    videoId: string,
    isPrefetch = false,
    skipStream = false,
    signal?: AbortSignal
  ) {
    const useYtDlp = yt2.getConfigValue('useYtDlp');
    /* yt-dlp URL cache: prefetch is possible when the URL was resolved in advance */
    if (useYtDlp && isPrefetch && !skipStream && !VideoModel.getCachedYtDlpUrl(videoId)) {
      throw Error(`Cannot prefetch with yt-dlp as time taken will exceed Volumio's limit`);
    }
    if (!skipStream && useYtDlp) {
      const [info, url] = await Promise.all([
        // Metadata only (no stream): use the regular client list even when prefetching
        this.#doGetPlaybackInfo(videoId, false, true, undefined, signal),
        VideoModel.getYtDlpUrl(videoId).catch((error: unknown) => {
          yt2.getLogger().error(yt2.getErrorMessage('Failed to get streaming URL with yt-dlp:', error, false));
          return null;
        })
      ]);
      if (info && url) {
        const itag = new URL(url).searchParams.get('itag');
        const bitrate = itag ? ITAG_TO_BITRATE[itag] : null;
        info.stream = {
          url,
          bitrate: bitrate ? `${bitrate} kbps` : undefined
        };
      }
      return info;
    }
    return this.#doGetPlaybackInfo(videoId, isPrefetch, skipStream, undefined, signal);
  }

  async #doGetPlaybackInfo(
    videoId: string,
    isPrefetch = false,
    skipStream = false,
    client?: CLIENT,
    signal?: AbortSignal
  ): Promise<VideoPlaybackInfo | null> {
    const { innertube } = await this.getInnertube();
    let availableClients;
    if (innertube.session.logged_in) {
      availableClients = isPrefetch ? CLIENTS_WHEN_SIGNED_IN_AND_PREFETCH : CLIENTS_WHEN_SIGNED_IN;
    }
    else {
      availableClients = isPrefetch ? CLIENTS_WHEN_SIGNED_OUT_AND_PREFETCH : CLIENTS_WHEN_SIGNED_OUT;
    }
    let isLive = false;
    try {
      client = client ?? availableClients[0];
      const __tryNextClientOnError = async (error: any, obtainedInfo?: YT.VideoInfo) => {
        if (obtainedInfo) {
          yt2.getLogger().warn(`[youtube2] Error getting playback info with ${client} client. The playability status of the target is: ${JSON.stringify(obtainedInfo.playability_status, null, 2)}`);
        }
        else {
          yt2.getLogger().warn(`[youtube2] Error getting playback info with ${client} client`);
        }
        const clientIndex = availableClients.indexOf(client as any);
        if (clientIndex < availableClients.length - 1) {
          const nextClient = availableClients[clientIndex + 1];
          yt2.getLogger().warn(yt2.getErrorMessage(`[youtube2] Got error in VideoModel.getPlaybackInfo(${videoId}):`, error, false));
          yt2.getLogger().warn(`[youtube2] Going to retry with '${nextClient}' client`)

          return await this.#doGetPlaybackInfo(videoId, isPrefetch, skipStream, nextClient, signal);
        }
        throw error;
      }

      let contentPoToken: string | undefined = undefined;
      try {
        contentPoToken = (await InnertubeLoader.generatePoToken(videoId)).poToken;
        yt2.getLogger().info(`[youtube2] Obtained PO token for video #${videoId}: ${contentPoToken}`);
      }
      catch (error: unknown) {
        yt2.getLogger().error(yt2.getErrorMessage(`[youtube2] Error obtaining PO token for video #${videoId}:`,error, false));
      }

      let sessionPoToken: string | undefined;
      try {
        sessionPoToken = (await (await InnertubeLoader.getInstance()).getSessionPoToken())?.poToken;
      }
      catch (error: unknown) {
        yt2.getLogger().error(yt2.getErrorMessage(`[youtube2] Error obtaining PO token for session:`,error, false));
        sessionPoToken = undefined;
      }

      let info;
      try {
        info = await innertube.getBasicInfo(videoId, { client, po_token: sessionPoToken });
      }
      catch (error) {
        // Sometimes getBasicInfo() directly throws error when video is unavailable.
        // Retry with next client if possible.
        return await __tryNextClientOnError(error);
      }
      if (signal?.aborted) {
        throw Error('Aborted');
      }

      const basicInfo = info.basic_info;
      isLive = !!basicInfo.is_live;

      if (!isLive && client === 'WEB') {
        // For non-live videos, WEB client returns SABR streams which Volumio doesn't support.
        // Proceed to the next client.
        return await this.#doGetPlaybackInfo(videoId, isPrefetch, skipStream, availableClients[1], signal);
      }

      const result: VideoPlaybackInfo = {
        type: 'video',
        title: basicInfo.title,
        author: {
          channelId: basicInfo.channel_id,
          name: basicInfo.author
        },
        description: basicInfo.short_description,
        thumbnail: InnertubeResultParser.parseThumbnail(basicInfo.thumbnail) || '',
        isLive,
        duration: basicInfo.duration,
        addToHistory: () => {
          return info?.addToWatchHistory();
        }
      };

      if (skipStream === true) {
        return result;
      }
      
      if (info.playability_status?.status === 'UNPLAYABLE') {
        // Check if this video has a trailer (non-purchased movies / films)
        if (info.has_trailer) {
          const trailerInfo = info.getTrailerInfo();
          if (trailerInfo) {
            result.stream = await this.#chooseFormat(innertube, trailerInfo);
          }
        }
        else {
          return await __tryNextClientOnError(new Error(info.playability_status.reason), info);
        }
      }
      else if (!isLive) {
        try {
          result.stream = await this.#chooseFormat(innertube, info);
        }
        catch (error) {
          return await __tryNextClientOnError(error, info);
        }
      }
      else {
        const hlsManifestUrl = info.streaming_data?.hls_manifest_url;
        const streamUrlFromHLS = hlsManifestUrl ? await this.#getStreamUrlFromHLS(hlsManifestUrl, yt2.getConfigValue('liveStreamQuality')) : null;
        result.stream = streamUrlFromHLS ? { url: streamUrlFromHLS } : null;
      }

      if (result.stream && !isLive) {
        // Innertube sets `pot` searchParam of URL to session-bound PO token.
        // Seems YT now requires `pot` to be the *content-bound* token, otherwise we'll get 403.
        // See: https://github.com/TeamNewPipe/NewPipeExtractor/issues/1392
        const urlObj = new URL(result.stream.url);
        if (contentPoToken) {
          urlObj.searchParams.set('pot', contentPoToken);
        }
        result.stream.url = urlObj.toString();
      }

      // Might need to wait a few seconds before stream becomes accessible (instead of getting 403 Forbidden).
      // We add a test routine here and sleep for a while between retries
      // See: https://github.com/yt-dlp/yt-dlp/issues/14097
      if (result.stream) {
        yt2.getLogger().info(`[youtube2] Got stream with ${client} client`);
        const startTime = new Date().getTime();
        yt2.getLogger().info(`[youtube2] VideoModel.getPlaybackInfo(${videoId}): validating stream URL "${result.stream.url}"...`);
        let tries = 0;
        let testStreamResult = await this.#head(result.stream.url, signal);
        while (!testStreamResult.ok && tries < 3) {
          if (signal?.aborted) {
            throw Error('Aborted');
          }
          yt2.getLogger().warn(`[youtube2] VideoModel.getPlaybackInfo(${videoId}): stream validation failed (${testStreamResult.status} - ${testStreamResult.statusText}); retrying after 2s...`);
          await this.#sleep(2000);
          tries++;
          testStreamResult = await this.#head(result.stream.url);
        }
        const endTime = new Date().getTime();
        const timeTaken = (endTime - startTime) / 1000;
        if (tries === 3) {
          yt2.getLogger().warn(`[youtube2] VideoModel.getPlaybackInfo(${videoId}): failed to validate stream URL "${result.stream.url}" (retried ${tries} times in ${timeTaken}s).`);
        }
        else {
          yt2.getLogger().info(`[youtube2] VideoModel.getPlaybackInfo(${videoId}): stream validated in ${timeTaken}s.`);
        }
      }

      if (signal?.aborted) {
        throw Error('Aborted');
      }

      return result;
    }
    catch (error) {
      yt2.getLogger().error(yt2.getErrorMessage(`[youtube2] Error in VideoModel.getPlaybackInfo(${videoId}): `, error));
      throw error
    }
  }

  #sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async #head(url: string, signal?: AbortSignal) {
    const res = await fetch(url, { method: 'HEAD', signal });
    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText
    };
  }

  async #chooseFormat(innertube: Innertube, videoInfo: YT.VideoInfo): Promise<VideoPlaybackInfo['stream'] | null> {
    const format = videoInfo?.chooseFormat(BEST_AUDIO_FORMAT);
    const streamUrl = format ? await format.decipher(innertube.session.player) : null;
    // eslint-disable-next-line @typescript-eslint/no-misused-spread
    const streamData = format ? { ...format, url: streamUrl } : null;
    return this.#parseStreamData(streamData);
  }

  #parseStreamData(data: any): VideoPlaybackInfo['stream'] | null {
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
  }

  async #getStreamUrlFromHLS(manifestUrl: string, targetQuality: string) {
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

    const playlistVariants: HLSPlaylistVariant[] = [];

    // Modified from regex101's code generator :)
    let m: any;
    while ((m = regex.exec(manifestContents)) !== null) {
      if (m.index === regex.lastIndex) {
        regex.lastIndex++;
      }

      const variant: HLSPlaylistVariant = {};
      playlistVariants.push(variant);

      m.forEach((match: string, groupIndex: number) => {
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
  }
}
