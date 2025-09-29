import {type YT, type Types, Utils} from 'volumio-youtubei.js';
import type Innertube from 'volumio-youtubei.js';
import yt2 from '../YouTube2Context';
import type VideoPlaybackInfo from '../types/VideoPlaybackInfo';
import { BaseModel } from './BaseModel';
import InnertubeResultParser from './InnertubeResultParser';

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

export default class VideoModel extends BaseModel {

  async getPlaybackInfo(videoId: string, client?: Types.InnerTubeClient, signal?: AbortSignal): Promise<VideoPlaybackInfo | null> {
    const { innertube } = await this.getInnertube();

    try {
      const info = await innertube.getBasicInfo(videoId, { client });
      if (signal?.aborted) {
        throw Error('Aborted');
      }
      const basicInfo = info.basic_info;

      const result: VideoPlaybackInfo = {
        type: 'video',
        title: basicInfo.title,
        author: {
          channelId: basicInfo.channel_id,
          name: basicInfo.author
        },
        description: basicInfo.short_description,
        thumbnail: InnertubeResultParser.parseThumbnail(basicInfo.thumbnail) || '',
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
            result.stream = this.#chooseFormat(innertube, trailerInfo);
          }
        }
        else {
          throw Error(info.playability_status.reason);
        }
      }
      else if (!result.isLive) {
        try {
          result.stream = this.#chooseFormat(innertube, info);
        }
        catch (error) {
          if (error instanceof Utils.PlayerError && client !== 'WEB_EMBEDDED') {
            // Sometimes with default client we fail to get the stream because format is missing url / cipher, leading to 
            // "No valid URL to decipher" error. In this case, we retry with 'WEB_EMBEDDED' client.
            yt2.getLogger().warn(`[youtube2] Error getting stream with default client in VideoModel.getInfo(${videoId}): ${error.message} - retry with 'WEB_EMBEDDED' client.`);
            return await this.getPlaybackInfo(videoId, 'WEB_EMBEDDED');
          }
          throw error;
        }
      }
      else {
        const hlsManifestUrl = info.streaming_data?.hls_manifest_url;
        const streamUrlFromHLS = hlsManifestUrl ? await this.#getStreamUrlFromHLS(hlsManifestUrl, yt2.getConfigValue('liveStreamQuality')) : null;
        result.stream = streamUrlFromHLS ? { url: streamUrlFromHLS } : null;
      }

      // Might need to wait a few seconds before stream becomes accessible (instead of getting 403 Forbidden).
      // We add a test routine here and sleep for a while between retries
      // See: https://github.com/yt-dlp/yt-dlp/issues/14097
      if (result.stream) {
        const startTime = new Date().getTime();
        yt2.getLogger().info(`[youtube2] VideoModel.getInfo(${videoId}): validating stream URL "${result.stream.url}"...`);
        let tries = 0;
        let testStreamResult = await this.#head(result.stream.url, signal);
        while (!testStreamResult.ok && tries < 3) {
          if (signal?.aborted) {
            throw Error('Aborted');
          }
          yt2.getLogger().warn(`[youtube2] VideoModel.getInfo(${videoId}): stream validation failed (${testStreamResult.status} - ${testStreamResult.statusText}); retrying after 2s...`);
          await this.#sleep(2000);
          tries++;
          testStreamResult = await this.#head(result.stream.url);
        }
        const endTime = new Date().getTime();
        const timeTaken = (endTime - startTime) / 1000;
        if (tries === 3) {
          yt2.getLogger().warn(`[youtube2] VideoModel.getInfo(${videoId}): failed to validate stream URL "${result.stream.url}" (retried ${tries} times in ${timeTaken}s).`);
        }
        else {
          yt2.getLogger().info(`[youtube2] VideoModel.getInfo(${videoId}): stream validated in ${timeTaken}s.`);
        }
      }

      if (signal?.aborted) {
        throw Error('Aborted');
      }

      return result;
    }
    catch (error) {
      yt2.getLogger().error(yt2.getErrorMessage(`[youtube2] Error in VideoModel.getInfo(${videoId}): `, error));
      return null;
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

  #chooseFormat(innertube: Innertube, videoInfo: YT.VideoInfo): VideoPlaybackInfo['stream'] | null {
    const format = videoInfo?.chooseFormat(BEST_AUDIO_FORMAT);
    const streamUrl = format ? format.decipher(innertube.session.player) : null;
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
