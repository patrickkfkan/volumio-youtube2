import { ContentItem } from '.';
import Endpoint from './Endpoint';

interface WatchContent {
  type: 'watch';
  playlist?: ContentItem.Playlist;
  autoplay?: Endpoint;
}

export default WatchContent;
