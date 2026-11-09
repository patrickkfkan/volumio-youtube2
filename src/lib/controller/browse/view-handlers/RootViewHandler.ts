import yt2 from '../../../YouTube2Context';
import { ModelType } from '../../../model';
import { type ContentItem, type PageElement } from '../../../types';
import { type PageContent } from '../../../types/Content';
import { type ExplodedTrackInfo } from './ExplodableViewHandler';
import FeedViewHandler, { type FeedView } from './FeedViewHandler';
import MixViewHandler from './MixViewHandler';
import { type RenderedListItem } from './renderers/BaseRenderer';
import { type RenderedPage } from './ViewHandler';

export interface RootView extends FeedView {
  name: 'root';
}

export default class RootViewHandler extends FeedViewHandler<RootView> {

  protected getTracksOnExplode(): Promise<ExplodedTrackInfo | ExplodedTrackInfo[]> {
    throw Error('Operation not supported');
  }

  async browse(): Promise<RenderedPage> {
    const result = await super.browse();
    if (result.navigation?.lists && result.navigation.lists.length > 0) {
      result.navigation.lists[0].title = yt2.getI18n('YOUTUBE2_TITLE');
    }

    // "Mix of the current track" entry at the top of the plugin root
    const current = MixViewHandler.getCurrentTrack();
    const mixItem: RenderedListItem = current ? {
      service: 'youtube2',
      type: 'folder',
      title: yt2.getI18n('YOUTUBE2_MIX_FROM_CURRENT', current.title),
      icon: 'fa fa-random',
      uri: MixViewHandler.getUri(current.videoId)
    } : {
      service: 'youtube2',
      type: 'item-no-menu',
      title: yt2.getI18n('YOUTUBE2_MIX_NO_CURRENT'),
      icon: 'fa fa-random',
      uri: 'youtube2/mix'
    };
    if (!result.navigation) {
      result.navigation = {};
    }
    if (!result.navigation.lists || result.navigation.lists.length === 0) {
      result.navigation.lists = [ { title: yt2.getI18n('YOUTUBE2_TITLE'), availableListViews: [ 'list' ], items: [] } ];
    }
    result.navigation.lists[0].items.unshift(mixItem);

    return result;
  }

  protected async getContents(): Promise<PageContent | null> {
    const contentType = yt2.getConfigValue('rootContentType');
    const rootModel = this.getModel(ModelType.Root);
    let contents = await rootModel.getContents({ contentType });

    if (!contents) {
      contents = {
        sections: [] as PageElement.Section[]
      } as PageContent;
    }
    // We should never come to this, but just in case...
    else if (!contents.sections || contents.sections.length === 0) {
      contents.sections = [];
    }

    const accountModel = this.getModel(ModelType.Account);
    const account = await accountModel.getInfo();
    if (account.active?.channel) {
      contents.sections.unshift({
        type: 'section',
        items: [
          {
            type: 'endpointLink',
            title: account.active.channel.title,
            thumbnail: account.active.photo,
            endpoint: account.active.channel.endpoint
          } as ContentItem.EndpointLink
        ]
      });
    }

    if (contentType === 'simple' && contents.sections.length > 1) {
      // Place all items into one section
      const allItems = this.findAllItemsInSection(contents.sections);
      contents.sections = [
        {
          ...contents.sections[0],
          items: allItems
        }
      ];
    }

    return contents;
  }

  protected getAvailableListViews(): ('list' | 'grid')[] {
    const contentType = yt2.getConfigValue('rootContentType');
    return contentType === 'simple' ? [ 'grid', 'list' ] : [ 'list' ];
  }
}
