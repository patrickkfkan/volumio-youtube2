import { ContentItem } from '.';
import Endpoint, { EndpointType } from './Endpoint';

export interface Header {
  type: 'feed' | 'channel' | 'playlist' | 'search';
  title: string;
  subtitles?: string[];
  description?: string;
  thumbnail?: string;
  endpoint?: Endpoint;
}

export interface PlaylistHeader extends Header {
  type: 'playlist';
  author?: ContentItem.Author;
  shufflePlay?: ContentItem.EndpointLink;
}

export type SectionItem = ContentItem.Channel | ContentItem.EndpointLink | ContentItem.GuideEntry | ContentItem.Playlist | ContentItem.Video | Section;

export interface Section {
  type: 'section';
  title?: string;
  subtitle?: string;
  items: SectionItem[];
  filters?: Option[];
  continuation?: Continuation;
  menus?: Option[];
  buttons?: Button[];
  endpoint?: Endpoint;
}

export interface Option {
  type: 'option';
  title?: string,
  optionValues: {
    text: string;
    endpoint: Endpoint | null;
    selected: boolean
  }[];
}

export interface Continuation {
  type: 'continuation';
  text?: string;
  endpoint: Endpoint & {type: EndpointType.BrowseContinuation | EndpointType.SearchContinuation};
}

export interface Button {
  type: 'button';
  text: string;
  endpoint: Endpoint;
}

export interface Tab {
  type: 'tab';
  text: string;
  endpoint: Endpoint;
  selected: boolean;
}
