const helper = require('../helper')

class PlaylistFetcher {
  constructor(url) {
    const _url = url
    this.getOriginalURL = () => _url
  }

  static async doGetChannelPlaylist(channelId, tryChannelType, sort) {
    let channelPageResponse;
    if (tryChannelType !== 'defaultOrTopic' && tryChannelType !== 'topic' && tryChannelType !== 'gaming') {
      tryChannelType = 'defaultOrTopic'
    }
    if (tryChannelType === 'defaultOrTopic' || tryChannelType === 'topic') {
      const channelUrl = `https://youtube.com/channel/${channelId}/playlists?flow=grid&view=1&pbj=1${sort ? '&sort=' + sort : ''}`
      channelPageResponse = await helper.makeChannelRequest(channelUrl)

      if (channelPageResponse.error) {
        // Try again as a user channel
        const userUrl = `https://youtube.com/user/${channelId}/playlists?flow=grid&view=1&pbj=1${sort ? '&sort=' + sort : ''}`
        channelPageResponse = await helper.makeChannelRequest(userUrl)
      }
    }
    else if (tryChannelType === 'gaming') {
      const channelUrl = `https://youtube.com/channel/${channelId}/letsplay?flow=grid&view=1&pbj=1${sort ? '&sort=' + sort : ''}`
      channelPageResponse = await helper.makeChannelRequest(channelUrl)
    }

    if (channelPageResponse.error) {
      return Promise.reject(channelPageResponse.message)
    }

    return await this.parseChannelPlaylistResponse(channelPageResponse, tryChannelType)
  }

  static async getChannelPlaylist(channelId, sort) {
    // Different channel types are parsed differently, but we don't know the channel type until
    // we've actually tried to parse it. So here we would have to get the playlists through trial 
    // and error, in a predefined sequence. 
    // The fun part about topic channels is that playlists don't always get returned on the first try.
    // You can even verify this on YouTube. For (possibly) topic channels, we try up to 5 times before 
    // giving up, while adding a slight pause betweeen requests to (hopefully) avoid getting HTTP 429.
    // The downside of this is the potentially long delay in getting results for topic channels.
    const tries = ['defaultOrTopic', 'gaming', 'sleep', 'topic', 'sleep', 'topic', 'sleep', 'topic', 'sleep', 'topic'];

    let result = null;
    while (!result && tries.length) {
      try {
        let currentTry = tries.shift();
        if (currentTry === 'sleep') {
          await helper.sleepRandom(1200, 1800);
          result = null;
        }
        else {
          result = await this.doGetChannelPlaylist(channelId, currentTry, sort);
        }
      } catch (e) {
        result = null;
      }
    }

    if (!result) {
      return {
        continuation: null,
        items: []
      }
    }

    return result;
  }

  static async getChannelPlaylistLast (channelId) {
    return await this.getChannelPlaylist(channelId);
  }

  static async getChannelPlaylistOldest (channelId) {
    return await this.getChannelPlaylist(channelId, 'da');
  }

  static async getChannelPlaylistNewest (channelId) {
    return await this.getChannelPlaylist(channelId, 'dd');
  }

  static async parseChannelPlaylistResponse (response, tryChannelType) {
    let channelInfo;
    if (tryChannelType === 'defaultOrTopic' || tryChannelType === 'topic') {
      const channelMetaData = response.data[1].response.metadata.channelMetadataRenderer
      const channelName = channelMetaData.title
      const channelId = channelMetaData.externalId
  
      channelInfo = {
        channelId: channelId,
        channelName: channelName,
        channelUrl: `https://youtube.com/channel/${channelId}`
      }
    }
    else if (tryChannelType === 'gaming') {
      const channelMetaData = response.data[1].response.microformat.microformatDataRenderer
      channelInfo = {
        channelId: response.data[1].endpoint.browseEndpoint.browseId,
        channelName: channelMetaData.title,
        channelUrl: channelMetaData.urlCanonical
      }
    }
    let playlistData, assumeChannelType
    if (tryChannelType === 'defaultOrTopic' || tryChannelType === 'topic') {
      const tryGetFromTab = (tabIndex) => {
        try {
          return response.data[1].response.contents.twoColumnBrowseResultsRenderer.tabs[tabIndex].tabRenderer.content.sectionListRenderer.contents[0].itemSectionRenderer.contents[0].gridRenderer
        } catch (e) {
          return null
        }
      }
      // Assume this is topic channel and get from second tab
      assumeChannelType = 'topic'
      playlistData = tryGetFromTab(1)
      if (!playlistData && tryChannelType === 'defaultOrTopic') {
        // If non-topic channel, then third tab should contain playlist data
        assumeChannelType = 'default'
        playlistData = tryGetFromTab(2)
      }
    }
    else if (tryChannelType === 'gaming') {
      try {
        assumeChannelType = 'gaming'
        playlistData = response.data[1].response.contents.twoColumnBrowseResultsRenderer.tabs[4].tabRenderer.content.sectionListRenderer.contents[0].itemSectionRenderer.contents[0].shelfRenderer.content.gridRenderer;
      } catch (e) {
        playlistData = null;
      }
    }

    if (!playlistData) {
      return null;
    }
    const playlistItems = playlistData.items.filter((playlist) => {
      return typeof (playlist.gridShowRenderer) === 'undefined'
    }).map((playlist) => {
      return helper.parsePlaylist(playlist, channelInfo)
    })

    let continuation = null

    if (typeof (playlistData.continuations) !== 'undefined') {
      continuation = JSON.stringify({
        token: playlistData.continuations[0].nextContinuationData.continuation,
        channelType: assumeChannelType
      });
    }

    return {
      continuation: continuation,
      items: playlistItems
    }
  }
}

module.exports = PlaylistFetcher
