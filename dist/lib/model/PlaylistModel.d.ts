import { PageElement } from '../types';
import Endpoint, { EndpointType } from '../types/Endpoint';
import PageContent from '../types/PageContent';
import { SectionItem } from '../types/PageElement';
import WatchContent, { WatchContinuationContent } from '../types/WatchContent';
import EndpointModel from './EndpointModel';
export default class PlaylistModel extends EndpointModel {
    #private;
    getContents(endpoint: Endpoint & {
        type: EndpointType.Watch;
    }): Promise<WatchContent | null>;
    getContents(endpoint: Endpoint & {
        type: EndpointType.WatchContinuation;
    }): Promise<WatchContinuationContent | null>;
    getContents(endpoint: Endpoint & {
        type: EndpointType.Browse | EndpointType.Search | EndpointType.BrowseContinuation | EndpointType.SearchContinuation;
    }): Promise<PageContent | null>;
    getContents(endpoint: Endpoint & {
        type: EndpointType;
    }): Promise<WatchContent | PageContent | null>;
    protected getContinuationItems(continuation: PageElement.Section['continuation'], recursive?: boolean, currentItems?: SectionItem[]): Promise<PageElement.SectionItem[]>;
}
//# sourceMappingURL=PlaylistModel.d.ts.map