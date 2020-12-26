# yt-mix-playlist

JS library for fetching YouTube Mix playlists.

## Install

```
npm install yt-mix-playlist --save
```

## Usage

Fetch Mix playlist for a video:
```
const ytmpl = require('yt-mix-playlist');

const videoId = 'XCcN-IoYIJA';
const mixPlaylist = await ytmpl(videoId);
console.log(mixPlaylist);
```

Result:
```
{ id: 'RDXCcN-IoYIJA',
  title: 'Mix - Wiljan & Xandra - Woodlands',
  author: 'YouTube',
  url: 'http://www.youtube.com/watch?v=XCcN-IoYIJA&list=RDXCcN-IoYIJA',
  currentIndex: 0,
  items: 
   [ { id: 'XCcN-IoYIJA',
       title: 'Wiljan & Xandra - Woodlands',
       author: [Object],
       url: 'https://www.youtube.com/watch?v=XCcN-IoYIJA&list=RDXCcN-IoYIJA&index=1',
       selected: true,
       ... },
     { id: 'fwR-TM-0ha4',
       title: 'Chillstep | Aurai - Our Dawn',
       author: [Object],
       url: 'https://www.youtube.com/watch?v=fwR-TM-0ha4&list=RDXCcN-IoYIJA&index=2',
       selected: false,
       ... },
     ...
     { id: 'DzYp5uqixz0',
       title: '🍀 Chill Instrumental [Non Copyrighted Music] "Embrace" by Sappheiros 🇺🇸',
       author: [Object],
       url: 'https://www.youtube.com/watch?v=DzYp5uqixz0&list=RDXCcN-IoYIJA&index=25',
       selected: false,
       ... } ],
  videoCount: '50+ videos',
  thumbnails: 
   [ { url: 'https://i.ytimg.com/vi/XCcN-IoYIJA/hqdefault.jpg?sqp=-oaymwEXCNACELwBSFryq4qpAwkIARUAAIhCGAE=&rs=AOn4CLARuI_29dvrA_u7pQj4xs8X_HUwDw',
       width: 336,
       height: 188 },
     { url: 'https://i.ytimg.com/vi/XCcN-IoYIJA/hqdefault.jpg?sqp=-oaymwEWCKgBEF5IWvKriqkDCQgBFQAAiEIYAQ==&rs=AOn4CLCnA4XJbGLUcY1BPiU3TjMhKj1VXA',
       width: 168,
       height: 94 } ],
  ...
```

`items` array contains videos currently in the playlist. `currentIndex` refers to the index of the selected video in the array.

To change selected video:
```
// Select by video Id or index from current list
const updatedPlaylist = mixPlaylist.select(videoIdOrIndex);
```
or:
```
// Select the last video in current list
const updatedPlaylist = mixPlaylist.selectLast();
```
or:
```
// Select the first video in current list
const updatedPlaylist = mixPlaylist.selectFirst();
```
List of videos in playlist *may* change after selection. You need to refer to `currentIndex` and `items` of the returned result for the updated selection index and list of videos, respectively.

Example:
```
// Select last video in the list
const updatedPlaylist = await mixPlaylist.selectLast();
console.log(updatedPlaylist);
```

Result:
```
{ id: 'RDXCcN-IoYIJA',
  title: 'Mix - Wiljan & Xandra - Woodlands',
  author: 'YouTube',
  url: 'http://www.youtube.com/watch?v=DzYp5uqixz0&list=RDXCcN-IoYIJA',
  currentIndex: 24,
  items: 
   [ { id: 'XCcN-IoYIJA',
       title: 'Wiljan & Xandra - Woodlands',
       author: [Object],
       url: 'https://www.youtube.com/watch?v=XCcN-IoYIJA&list=RDXCcN-IoYIJA&index=1',
       selected: false,
       ... },
     { id: 'fwR-TM-0ha4',
       title: 'Chillstep | Aurai - Our Dawn',
       author: [Object],
       url: 'https://www.youtube.com/watch?v=fwR-TM-0ha4&list=RDXCcN-IoYIJA&index=2',
       selected: false,
       ... },
     ...
     { id: 'DzYp5uqixz0',
       title: '🍀 Chill Instrumental [Non Copyrighted Music] "Embrace" by Sappheiros 🇺🇸',
       author: [Object],
       url: 'https://www.youtube.com/watch?v=DzYp5uqixz0&list=RDXCcN-IoYIJA&index=25',
       selected: true,
       ... },
     ...
     { id: 'i8GGp_rLWD8',
       title: 'Jarico - Island',
       author: [Object],
       url: 'https://www.youtube.com/watch?v=i8GGp_rLWD8&list=RDXCcN-IoYIJA&index=48',
       selected: false,
       ... },
     { id: 'RmvtWlUDFY4',
       title: 'Morning',
       author: [Object],
       url: 'https://www.youtube.com/watch?v=RmvtWlUDFY4&list=RDXCcN-IoYIJA&index=49',
       selected: false,
       ... } ],
  videoCount: '50+ videos',
  thumbnails: 
   [ { url: 'https://i.ytimg.com/vi/XCcN-IoYIJA/hqdefault.jpg?sqp=-oaymwEXCNACELwBSFryq4qpAwkIARUAAIhCGAE=&rs=AOn4CLARuI_29dvrA_u7pQj4xs8X_HUwDw',
       width: 336,
       height: 188 },
     { url: 'https://i.ytimg.com/vi/XCcN-IoYIJA/hqdefault.jpg?sqp=-oaymwEWCKgBEF5IWvKriqkDCQgBFQAAiEIYAQ==&rs=AOn4CLCnA4XJbGLUcY1BPiU3TjMhKj1VXA',
       width: 168,
       height: 94 } ],
  ...
```

Given a Mix playlist, you can obtain further items like this:
```
const updatedPlaylist = await mixPlaylist.selectLast();
const newItems = updatedPlaylist.getItemsAfterSelected();
```
## API

**ytmpl(videoId, [options])**

Options:
- hl: language
- gl: region

Example:
```
const mixPlaylist = ytmpl('XCcN-IoYIJA', { hl: 'en', gl: 'US' });
```

Returns an object representing the Mix playlist, or `null` if none found.

### Playlist functions

The following functions can be called on the returned playlist object:

**select(videoIdOrIndex)**

`videoIdOrIndex`: A playlist item's Id or index in the playlist's `items` array

Selects the specified video in the playlist. Returns a new object representing the updated playlist after selection. Original playlist is not changed.

**selectFirst()**

Convenience function that passes the first item in the playlist to `select()` and returns the result.

**selectLast()**

Convenience function that passes the last item in the playlist to `select()` and returns the result.

**getSelected()**

Returns the selected item in the playlist. Same as calling `playlist.items[playlist.currentIndex]`.

**getItemsBeforeSelected()**

Returns playlist items up to but not including the selected one.

**getItemsAfterSelected()**

Returns playlist items after the selected one.

## Playlist properties

|Property               |Remark                                     |
|-----------------------|-------------------------------------------|
|id                     |Id of the Mix playlist                     |
|title                  |                                           |
|author                 |'YouTube'                                  |
|url                    |Share URL                                  |
|items                  |Array of videos contained in the playlist  |
|currentIndex           |Index of the selected item                 |
|videoCount             |'50+ ...'                                  |
|thumbnails             |Thumbnails for the Mix playlist            |
|_context               |For internal use only                      |

Each item in the `items` array has the following properties:

|Property               |Remark                                     |
|-----------------------|-------------------------------------------|
|id                     |Video Id                                   |
|title                  |                                           |
|url                    |                                           |
|author                 |{ name, channelId, url }                   |
|selected               |Whether item is selected in the playlist   |
|duration               |                                           |
|thumbnails             |                                           |

## License
GPLv3