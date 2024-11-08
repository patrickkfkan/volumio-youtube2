import yt2 from '../YouTube2Context';
import Innertube, { Endpoints, YTNodes } from 'volumio-youtubei.js';
import Auth, { AuthEvent } from '../util/Auth';
import BG, { type BgConfig } from 'bgutils-js';
import { JSDOM } from 'jsdom';

export interface InnertubeLoaderGetInstanceResult {
  innertube: Innertube;
  auth: Auth;
}

enum Stage {
  Init = '1 - Init',
  PO = '2 - PO',
  Done = '3 - Done'
}

interface POToken {
  params: {
    visitorData?: string;
    identifier: {
      type: 'visitorData' | 'datasyncIdToken';
      value: string;
    };
  }
  value: string;
  ttl?: number;
  refreshThreshold?: number;
}

export default class InnertubeLoader {

  static #innertube: Innertube | null = null;
  static #auth: Auth | null = null;
  static #pendingPromise: Promise<InnertubeLoaderGetInstanceResult> | null = null;
  static #poTokenRefreshTimer: NodeJS.Timeout | null = null;

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

    this.#pendingPromise = this.#beginInitStage();

    return this.#pendingPromise;
  }

  static #beginInitStage() {
    return new Promise<InnertubeLoaderGetInstanceResult>((resolve) => {
      this.#createInstance(Stage.Init, resolve)
        .catch((error: unknown) => {
          yt2.getLogger().error(yt2.getErrorMessage(`[youtube2] InnertubeLoader: error creating Innertube instance:`, error));
        });
    });
  }

  static async #beginPOStage(innertube: Innertube, auth: Auth, resolve: (value: InnertubeLoaderGetInstanceResult) => void, lastToken?: POToken) {
    let identifier: POToken['params']['identifier'] | null = null;
    const visitorData = lastToken?.params.visitorData || innertube.session.context.client.visitorData;
    const lastIdentifier = lastToken?.params.identifier;
    if (lastIdentifier) {
      identifier = lastIdentifier;
    }
    else if (innertube.session.logged_in) {
      yt2.getLogger().info('[youtube2] InnertubeLoader: fetching datasyncIdToken...');
      const user = await innertube.account.getInfo();
      const accountItemSections = user.page.contents_memo?.getType(YTNodes.AccountItemSection);
      if (accountItemSections) {
        const accountItemSection = accountItemSections.first();
        const accountItem = accountItemSection.contents.first();
        const tokens = accountItem.endpoint.payload.supportedTokens;
        let datasyncIdToken: string | null = null;
        if (Array.isArray(tokens)) {
          datasyncIdToken = tokens.find((v) =>
            typeof v === 'object' &&
            Reflect.has(v, 'datasyncIdToken') &&
            typeof v.datasyncIdToken === 'object' &&
            Reflect.has(v.datasyncIdToken, 'datasyncIdToken') &&
            typeof v.datasyncIdToken.datasyncIdToken === 'string')?.datasyncIdToken.datasyncIdToken;
        }
        identifier = datasyncIdToken ? {
          type: 'datasyncIdToken',
          value: datasyncIdToken
        } : null;
      }
      if (!identifier) {
        yt2.getLogger().warn('[youtube2] InnertubeLoader: signed in but could not get datasyncIdToken for fetching po_token');
      }
    }
    else {
      identifier = visitorData ? {
        type: 'visitorData',
        value: visitorData
      } : null;
    }
    let poTokenResult;
    if (identifier) {
      yt2.getLogger().info(`[youtube2] InnertubeLoader: obtaining po_token by ${identifier.type}...`);
      try {
        poTokenResult = await this.#generatePoToken(identifier.value);
        yt2.getLogger().info(`[youtube2] InnertubeLoader: obtained po_token (expires in ${poTokenResult.ttl} seconds)`);
      }
      catch (error: unknown) {
        yt2.getLogger().error(yt2.getErrorMessage('[youtube2] InnertubeLoader: failed to get poToken: ', error, false));
      }
      if (poTokenResult) {
        yt2.getLogger().info(`[youtube2] InnertubeLoader: re-create Innertube instance with po_token`);
        auth.dispose();
        this.#createInstance(Stage.PO, resolve, {
          params: {
            visitorData,
            identifier
          },
          value: poTokenResult.token,
          ttl: poTokenResult.ttl,
          refreshThreshold: poTokenResult.refreshThreshold
        })
          .catch((error: unknown) => {
            yt2.getLogger().error(yt2.getErrorMessage(`[youtube2] InnertubeLoader: error creating Innertube instance:`, error));
          });
        return;
      }
    }
    yt2.getLogger().warn('[youtube2] InnertubeLoader: po_token was not used to create Innertube instance. Playback of YouTube content might fail.');
    this.#resolveGetInstanceResult(innertube, auth, resolve);
  }

  static async #createInstance(stage: Stage, resolve: (value: InnertubeLoaderGetInstanceResult) => void, poToken?: POToken) {
    yt2.getLogger().info(`[youtube2] InnertubeLoader: creating Innertube instance${poToken?.value ? ' with po_token' : ''}...`);
    const innertube = await Innertube.create({
      visitor_data: poToken?.params.visitorData,
      po_token: poToken?.value
    });
    yt2.getLogger().info(`[youtube2] InnertubeLoader: creating Auth instance...`);
    const auth = Auth.create(innertube);
    auth.on(AuthEvent.SignIn, this.#handleAuthEvent.bind(this, AuthEvent.SignIn, stage, innertube, auth, resolve, poToken));
    auth.on(AuthEvent.Pending, this.#handleAuthEvent.bind(this, AuthEvent.Pending, stage, innertube, auth, resolve, poToken));
    auth.on(AuthEvent.Error, this.#handleAuthEvent.bind(this, AuthEvent.Error, stage, innertube, auth, resolve, poToken));
    auth.signIn();
  }

  static reset() {
    this.#clearPOTokenRefreshTimer();
    if (this.#pendingPromise) {
      this.#pendingPromise = null;
    }
    if (this.#auth) {
      this.#auth.dispose();
    }
    this.#auth = null;
    this.#innertube = null;
  }

  static #clearPOTokenRefreshTimer() {
    if (this.#poTokenRefreshTimer) {
      clearTimeout(this.#poTokenRefreshTimer);
      this.#poTokenRefreshTimer = null;
    }
  }

  static hasInstance() {
    return this.#innertube && this.#auth;
  }

  static #handleAuthEvent(event: AuthEvent, stage: Stage, innertube: Innertube, auth: Auth, resolve: (value: InnertubeLoaderGetInstanceResult) => void, poToken?: POToken) {
    switch (stage) {
      case Stage.Init:
        if (event === AuthEvent.SignIn || event === AuthEvent.Pending) {
          this.#beginPOStage(innertube, auth, resolve)
            .catch((error: unknown) => {
              yt2.getLogger().error(yt2.getErrorMessage(`[youtube2] InnertubeLoader: error creating Innertube instance (with po_token):`, error));
            });
          return;
        }
        yt2.getLogger().warn('[youtube2] InnertubeLoader: po_token was not used to create Innertube instance because of auth error or unknown auth status. Playback of YouTube content might fail.');
        this.#resolveGetInstanceResult(innertube, auth, resolve);
        return;
      case Stage.PO:
        this.#resolveGetInstanceResult(innertube, auth, resolve, poToken);
        break;
    }
  }

  static #resolveGetInstanceResult(innertube: Innertube, auth: Auth, resolve: (value: InnertubeLoaderGetInstanceResult) => void, poToken?: POToken) {
    this.#pendingPromise = null;
    this.#innertube = innertube;
    this.#auth = auth;
    this.applyI18nConfig();
    if (innertube.session.logged_in) {
      auth.on(AuthEvent.SignOut, this.#handleSignOut.bind(this));
    }
    else {
      auth.on(AuthEvent.SignIn, this.#handleSubsequentSignIn.bind(this));
    }
    this.#clearPOTokenRefreshTimer();
    if (poToken) {
      const { ttl, refreshThreshold = 100 } = poToken;
      if (ttl) {
        const timeout = ttl - refreshThreshold;
        yt2.getLogger().info(`[youtube2] InnertubeLoader: going to refresh po_token in ${timeout} seconds`);
        this.#poTokenRefreshTimer = setTimeout(() => this.#refreshPOToken(poToken), timeout * 1000);
      }
    }
    resolve({
      innertube,
      auth
    });
  }

  static #handleSubsequentSignIn() {
    const innertube = this.#innertube;
    const auth = this.#auth;
    if (!innertube || !auth) {
      return;
    }
    this.reset();
    this.#pendingPromise = new Promise((resolve) => {
      this.#handleAuthEvent(AuthEvent.SignIn, Stage.Init, innertube, auth, resolve);
    });
  }

  static #handleSignOut() {
    const innertube = this.#innertube;
    const auth = this.#auth;
    if (!innertube || !auth) {
      return;
    }
    this.reset();
    this.#pendingPromise = this.#beginInitStage();
  }

  static #refreshPOToken(lastToken: POToken) {
    const innertube = this.#innertube;
    const auth = this.#auth;
    if (!innertube || !auth) {
      return;
    }
    this.reset();
    this.#pendingPromise = new Promise((resolve) => {
      yt2.getLogger().info('[youtube2] InnertubeLoader: refresh po_token');
      this.#beginPOStage(innertube, auth, resolve, lastToken)
        .catch((error: unknown) => {
          yt2.getLogger().error(yt2.getErrorMessage(`[youtube2] InnertubeLoader: error creating Innertube instance (while refreshing po_token):`, error));
        });
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
  static async #generatePoToken(identifier: string) {
    const requestKey = 'O43z0dpjhgX20SCx4KAo';
    const bgConfig: BgConfig = {
      fetch: (url, options) => fetch(url, options),
      globalObj: globalThis,
      identifier,
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

    return {
      token: poTokenResult.poToken,
      ttl: poTokenResult.integrityTokenData.estimatedTtlSecs,
      refreshThreshold: poTokenResult.integrityTokenData.mintRefreshThreshold
    };
  }
}
