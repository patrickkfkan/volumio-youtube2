import { YTNodes, Misc as YTMisc, YT } from 'volumio-youtubei.js';
import { type PluginConfig } from '../types';
import { EndpointType } from '../types/Endpoint';
import { BaseModel } from './BaseModel';
import InnertubeResultParser from './InnertubeResultParser';
import { findInObject } from '../util';
import yt2 from '../YouTube2Context';
import { getAccountInitialInfo } from './AccountModelHelper';

export default class AccountModel extends BaseModel {

  async getInfo() {
    const { innertube } = await this.getInnertube();
    const { isSignedIn, response } = await getAccountInitialInfo(innertube);

    if (!isSignedIn) {
      return {
        isSignedIn: false,
        info: null
      };
    }

    const info = new YT.AccountInfo(response);   
    // This plugin supports single sign-in, so there should only be one account in contents.
    // But we still get the 'selected' one just to be sure.
    const account = info.contents?.contents.find((ac) => ac.is(YTNodes.AccountItem) && ac.is_selected);

    if (account?.is(YTNodes.AccountItem)) {
      const name = InnertubeResultParser.unwrap(account?.account_name);

      if (name) {
        const result: PluginConfig.Account = {
          name,
          photo: InnertubeResultParser.parseThumbnail(account.account_photo)
        };

        try {
          const channel = await this.#getChannelInfo();
          if (channel) {
            result.channel = channel;
          }
        }
        catch (error: unknown) {
          yt2.getLogger().error(yt2.getErrorMessage('[youtube2] AccountModel.#getChannelInfo() error:', error));
        }

        return {
          isSignedIn: true,
          info: result
        };
      }
    }

    throw Error('Signed in but unable to get account info')
  }

  async #getChannelInfo() {
    const menu = await this.fetchAccountMenu();
    const title = findInObject(menu, (key) => key === 'manageAccountTitle')[0];
    if (title) {
      const text = new YTMisc.Text(title);
      const endpoint = InnertubeResultParser.parseEndpoint(text.endpoint, EndpointType.Browse);
      if (text.text && endpoint?.payload.browseId.startsWith('UC')) {
        return {
          title: text.text,
          endpoint
        };
      }
    }
    return null;
  }
}
