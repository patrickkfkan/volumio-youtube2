import yt2 from '../YouTube2Context';
import Innertube from 'volumio-youtubei.js';
import Auth, { AuthEvent } from '../util/Auth';
import BG, { type BgConfig } from 'bgutils-js';
import { JSDOM } from 'jsdom';

export interface InnertubeLoaderGetInstanceResult {
  innertube: Innertube;
  auth: Auth;
}

export default class InnertubeLoader {

  static #innertube: Innertube | null = null;
  static #auth: Auth | null = null;
  static #pendingPromise: Promise<InnertubeLoaderGetInstanceResult> | null = null;

  static async getInstance(): Promise<InnertubeLoaderGetInstanceResult> {
    if (this.#innertube && this.#auth) {
      return {
        innertube: this.#innertube,
        auth: this.#auth
      };
    }

    if (this.#pendingPromise) {
      return this.#pendingPromise;
    }

    this.#pendingPromise = new Promise((resolve) => {
      void (async () => {
        yt2.getLogger().info('[youtube2] InnertubeLoader: creating Innertube instance...');
        try {
          const { visitorData, poToken } = await this.#generatePoToken();
          this.#innertube = await Innertube.create({
            po_token: poToken,
            visitor_data: visitorData
          });
        }
        catch (error) {
          yt2.getLogger().error(yt2.getErrorMessage('[youtube2] Failed to get poToken: ', error, false));
          yt2.getLogger().error('[youtube2] Warning: poToken will not be used to create Innertube instance. Playback of YouTube content might fail.');
          this.#innertube = await Innertube.create();
        }
        this.applyI18nConfig();
  
        yt2.getLogger().info('[youtube2] InnertubeLoader: creating Auth instance...');
        this.#auth = Auth.create(this.#innertube);
        this.#auth.on(AuthEvent.SignIn, this.#handleAuthEvent.bind(this, AuthEvent.SignIn, this.#innertube, this.#auth, resolve));
        this.#auth.on(AuthEvent.Pending, this.#handleAuthEvent.bind(this, AuthEvent.Pending, this.#innertube, this.#auth, resolve));
        this.#auth.on(AuthEvent.Error, this.#handleAuthEvent.bind(this, AuthEvent.Error, this.#innertube, this.#auth, resolve));
        this.#auth.signIn();
      })();
    });

    return this.#pendingPromise;
  }

  static reset() {
    if (this.#pendingPromise) {
      this.#pendingPromise = null;
    }
    if (this.#auth) {
      this.#auth.dispose();
    }
    this.#auth = null;
    this.#innertube = null;
  }

  static hasInstance() {
    return this.#innertube && this.#auth;
  }

  static #handleAuthEvent(event: AuthEvent, innertube: Innertube, auth: Auth, resolve: (value: InnertubeLoaderGetInstanceResult) => void) {
    if (!this.#pendingPromise) {
      return;
    }
    let status: string;
    switch (event) {
      case AuthEvent.SignIn:
        status = 'signed in';
        break;
      case AuthEvent.Pending:
        status = 'pending sign-in';
        break;
      case AuthEvent.Error:
        status = 'error';
        break;
      default:
        status = 'undefined';
    }
    yt2.getLogger().info(`[youtube2] InnertubeLoader: Auth instance created (status: ${status})`);
    this.#pendingPromise = null;
    auth.removeAllListeners();
    resolve({
      innertube,
      auth
    });
  }

  static applyI18nConfig() {
    if (!this.#innertube) {
      return;
    }

    const region = yt2.getConfigValue('region');
    const language = yt2.getConfigValue('language');

    this.#innertube.session.context.client.gl = region;
    this.#innertube.session.context.client.hl = language;
  }

  /**
   * Required for initializing innertube, otherwise videos will return 403
   * Much of this taken from https://github.com/LuanRT/BgUtils/blob/main/examples/node/index.ts
   * @returns
   */
  static async #generatePoToken() {
    yt2.getLogger().info('[youtube2] InnertubeLoader: Generating poToken...');
    const requestKey = 'O43z0dpjhgX20SCx4KAo';
    const visitorData = (await Innertube.create({ retrieve_player: false })).session.context.client.visitorData;
    if (!visitorData) {
      throw Error('Visitor data not found in session data');
    }

    const bgConfig: BgConfig = {
      fetch: (url, options) => fetch(url, options),
      globalObj: globalThis,
      identifier: visitorData,
      requestKey
    };

    const dom = new JSDOM();
    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document
    });

    const bgChallenge = await BG.Challenge.create(bgConfig);
    if (!bgChallenge) {
      throw new Error('Could not get challenge');
    }

    const interpreterJavascript = bgChallenge.interpreterJavascript.privateDoNotAccessOrElseSafeScriptWrappedValue;
    if (interpreterJavascript) {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      new Function(interpreterJavascript)();
    }
    else throw new Error('Could not load VM');

    const poTokenResult = await BG.PoToken.generate({
      program: bgChallenge.program,
      globalName: bgChallenge.globalName,
      bgConfig
    });

    yt2.getLogger().info('[youtube2] InnertubeLoader: obtained poToken');

    return {
      visitorData, poToken: poTokenResult.poToken
    };
  }
}
