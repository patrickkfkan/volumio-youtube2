import { YtDlp } from "volumio-yt-dlp";
import yt2 from "../YouTube2Context";

const WD = '/data/plugins/music_service/youtube2/.yt-dlp';

function createYtDlpInstance() {
  return new YtDlp({
    workingDir: WD,
    cookies: yt2.getConfigValue('cookie'),
    logger: {
      info: (msg) => yt2.getLogger().info(`[youtube2] [yt-dlp] ${msg}`),
      warn: (msg) => yt2.getLogger().warn(`[youtube2] [yt-dlp] ${msg}`),
      debug: (msg) => yt2.getLogger().verbose(`[youtube2] [yt-dlp] ${msg}`),
      error: (msg) => yt2.getLogger().error(`[youtube2] [yt-dlp] ${msg}`),
    }
  });
}

export class YtDlpWrapper {

  static #ytDlp: YtDlp | null = null;

  static getInstance() {
    if (!this.#ytDlp) {
      this.#ytDlp = createYtDlpInstance();
    }
    return this.#ytDlp;
  }

  static refresh() {
    const ytDlp = this.getInstance();
    const cookie = yt2.getConfigValue('cookie');
    if (cookie) {
      ytDlp.setCookies(cookie);
    }
    else {
      ytDlp.setCookies(null);
    }
  }
}