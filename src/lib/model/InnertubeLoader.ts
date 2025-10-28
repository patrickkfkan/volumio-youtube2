import yt2 from '../YouTube2Context';
import { InnertubeFactory, InnertubeWrapper, type PotFnResult } from 'volumio-yt-support';

export default class InnertubeLoader {

  static #instancePromise: Promise<InnertubeWrapper> | null = null;

  static async getInstance(): Promise<InnertubeWrapper> {
    if (!this.#instancePromise) {
      this.#instancePromise = InnertubeFactory.getWrappedInstance({
        account: {
          cookie: yt2.getConfigValue('cookie') || undefined,
          activeChannelHandle: yt2.getConfigValue('activeChannelHandle')
        },
        locale: {
          region: yt2.getConfigValue('region'),
          language: yt2.getConfigValue('language')
        },
        logger: {
          info: (msg) => yt2.getLogger().info(`[youtube2] ${msg}`),
          warn: (msg) => yt2.getLogger().warn(`[youtube2] ${msg}`),
          error: (msg) => yt2.getLogger().error(`[youtube2] ${msg}`),
        }
      });
    }
    return this.#instancePromise;
  }

  static async generatePoToken(identifier: string): Promise<PotFnResult> {
    const instance = await this.getInstance();
    return await instance.generatePoToken(identifier);
  }

  static async reset() {
    if (this.#instancePromise) {
      const instance = await this.#instancePromise;
      await instance.dispose();
      this.#instancePromise = null;
    }
  }

  static async applyI18nConfig() {
    const region = yt2.getConfigValue('region');
    const language = yt2.getConfigValue('language');
    if (this.#instancePromise) {
      const instance = await this.#instancePromise;
      instance.setLocale({ region, language });
    }
  }
}
