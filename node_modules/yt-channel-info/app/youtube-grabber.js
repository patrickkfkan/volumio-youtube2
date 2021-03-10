const YoutubeGrabberHelper = require('./helper')
const queryString = require('querystring')

// Fetchers
const YoutubeChannelFetcher = require('./fetchers/channel')
const YoutubePlaylistFetcher = require('./fetchers/playlist')

class YoutubeGrabber {
  /**
  * Get channel information. Full list of channel information you can find in README.md file
  * @param { string } channelId The channel id to grab data from.
  * @return { Promise<Object> } Return channel information
  * */
  static async getChannelInfo(channelId) {
    const channelUrl = `https://youtube.com/channel/${channelId}/channels?flow=grid&view=0&pbj=1`

    let channelPageResponse = await YoutubeGrabberHelper.makeChannelRequest(channelUrl)

    if (channelPageResponse.error) {
      // Try again as a user channel
      const userUrl = `https://youtube.com/user/${channelId}/channels?flow=grid&view=0&pbj=1`
      channelPageResponse = await YoutubeGrabberHelper.makeChannelRequest(userUrl)

      if (channelPageResponse.error) {
        return Promise.reject(channelPageResponse.message)
      }
    }

    if (typeof (channelPageResponse.data[1].response.alerts) !== 'undefined') {
      const alert = channelPageResponse.data[1].response.alerts[0].alertRenderer.text.simpleText
      return Promise.reject(alert)
    }

    let channelInfo
    // Try parse as default or topic channels
    try {
      const channelMetaData = channelPageResponse.data[1].response.metadata.channelMetadataRenderer
      const channelHeaderData = channelPageResponse.data[1].response.header.c4TabbedHeaderRenderer
      const headerTabs = channelPageResponse.data[1].response.contents.twoColumnBrowseResultsRenderer.tabs

      const channelsTab = headerTabs.filter((data) => {
        if (typeof data.tabRenderer !== 'undefined') {
          return data.tabRenderer.title === 'Channels'
        }

        return false
      })
      
      let relatedChannels = []

      if (channelsTab[0]) {
        const featuredChannels = channelsTab[0].tabRenderer.content.sectionListRenderer.contents[0].itemSectionRenderer.contents[0]


        if (typeof (featuredChannels.gridRenderer) !== 'undefined') {
          relatedChannels = featuredChannels.gridRenderer.items.map((channel) => {
            const author = channel.gridChannelRenderer
            let channelName

            if (typeof (author.title.runs) !== 'undefined') {
              channelName = author.title.runs[0].text
            } else {
              channelName = author.title.simpleText
            }

            return {
              author: channelName,
              authorId: author.channelId,
              authorUrl: author.navigationEndpoint.browseEndpoint.canonicalBaseUrl,
              authorThumbnails: author.thumbnail.thumbnails,
            }
          })
        }
      }

      let subscriberText
      if (channelHeaderData.subscriberCountText) {
        if (typeof (channelHeaderData.subscriberCountText.runs) !== 'undefined') {
          subscriberText = channelHeaderData.subscriberCountText.runs[0].text
        } else {
          subscriberText = channelHeaderData.subscriberCountText.simpleText
        }
      } else {
        subscriberText = '0 subscribers'
      }

      let bannerThumbnails = null

      if (typeof (channelHeaderData.banner) !== 'undefined') {
        bannerThumbnails = channelHeaderData.banner.thumbnails
      }

      const subscriberSplit = subscriberText.split(' ')
      const subscriberMultiplier = subscriberSplit[0].substring(subscriberSplit[0].length - 1).toLowerCase()

      let subscriberNumber
      if (typeof (parseFloat(subscriberMultiplier)) === 'undefined') {
        subscriberNumber = parseFloat(subscriberText.substring(0, subscriberSplit[0].length - 1))
      } else {
        subscriberNumber = parseFloat(subscriberSplit[0])
      }

      let subscriberCount

      switch (subscriberMultiplier) {
        case 'k':
          subscriberCount = subscriberNumber * 1000
          break
        case 'm':
          subscriberCount = subscriberNumber * 1000000
          break
        default:
          subscriberCount = subscriberNumber
      }

      let isVerified = false
      if (channelHeaderData.badges) {
        isVerified = channelHeaderData.badges.some((badge) => badge.metadataBadgeRenderer.tooltip === 'Verified')
      }

      channelInfo = {
        author: channelMetaData.title,
        authorId: channelMetaData.externalId,
        authorUrl: channelMetaData.vanityChannelUrl,
        authorBanners: bannerThumbnails,
        authorThumbnails: channelHeaderData.avatar.thumbnails,
        subscriberText: subscriberText,
        subscriberCount: subscriberCount,
        description: channelMetaData.description,
        isFamilyFriendly: channelMetaData.isFamilySafe,
        relatedChannels: relatedChannels,
        allowedRegions: channelMetaData.availableCountryCodes,
        isVerified: isVerified
      }
    } catch (e) {
      channelInfo = null
    }

    if (!channelInfo) {
      // Try parse as gaming channel
      try {
        const header = channelPageResponse.data[1].response.header.interactiveTabbedHeaderRenderer
        const microformat = channelPageResponse.data[1].response.microformat.microformatDataRenderer
        const channelId = channelPageResponse.data[1].response.contents.twoColumnBrowseResultsRenderer.tabs[0].tabRenderer.endpoint.browseEndpoint.browseId
        channelInfo = {
          author: microformat.title,
          authorId: channelId,
          authorUrl: microformat.urlCanonical,
          authorBanners: header.banner.thumbnails,
          authorThumbnails: header.boxArt.thumbnails,
          subscriberText: '',
          subscriberCount: '',
          description: microformat.description,
          isFamilyFriendly: microformat.familySafe,
          relatedChannels: [],
          allowedRegions: microformat.availableCountries
        }
      } catch (e) {
        channelInfo = null
      }
    } 

    return channelInfo
  }

  static async getChannelVideos (channelId, sortBy = 'newest') {
    switch (sortBy) {
      case 'popular':
        return await YoutubeChannelFetcher.getChannelVideosPopular(channelId)
      case 'newest':
        return await YoutubeChannelFetcher.getChannelVideosNewest(channelId)
      case 'oldest':
        return await YoutubeChannelFetcher.getChannelVideosOldest(channelId)
      default:
        return await YoutubeChannelFetcher.getChannelVideosNewest(channelId)
    }
  }

  static async getChannelVideosMore (continuation) {
    const urlParams = {
      context: {
        client: {
          clientName: 'WEB',
          clientVersion: '2.20201021.03.00',
        },
      },
      continuation: continuation
    }
    const ajaxUrl = 'https://www.youtube.com/youtubei/v1/browse?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8'

    const channelPageResponse = await YoutubeGrabberHelper.makeChannelPost(ajaxUrl, urlParams)

    if (channelPageResponse.error) {
      return Promise.reject(channelPageResponse.message)
    }

    let nextContinuation = null

    const continuationData = channelPageResponse.data.onResponseReceivedActions[0].appendContinuationItemsAction.continuationItems

    const continuationItem = continuationData.filter((item) => {
      return typeof (item.continuationItemRenderer) !== 'undefined'
    })

    if (typeof continuationItem !== 'undefined' && typeof continuationItem[0] !== 'undefined') {
      nextContinuation = continuationItem[0].continuationItemRenderer.continuationEndpoint.continuationCommand.token
    }

    const channelMetaData = channelPageResponse.data.metadata.channelMetadataRenderer
    const channelName = channelMetaData.title
    const channelId = channelMetaData.externalId

    const channelInfo = {
      channelId: channelId,
      channelName: channelName
    }

    const nextVideos = continuationData.filter((item) => {
      return typeof (item.continuationItemRenderer) === 'undefined'
    }).map((item) => {
      return YoutubeGrabberHelper.parseVideo(item, channelInfo)
    })

    return {
      items: nextVideos,
      continuation: nextContinuation
    }
  }

  static async getChannelPlaylistInfo (channelId, sortBy = 'last') {
    switch (sortBy) {
      case 'last':
        return await YoutubePlaylistFetcher.getChannelPlaylistLast(channelId)
      case 'oldest':
        console.warn("yt-channel-info: Fetching by oldest isn't available in YouTube any more. This option will be removed in a later update.")
        return await YoutubePlaylistFetcher.getChannelPlaylistOldest(channelId)
      case 'newest':
        return await YoutubePlaylistFetcher.getChannelPlaylistNewest(channelId)
      default:
        return await YoutubePlaylistFetcher.getChannelPlaylistLast(channelId)
    }
  }

  static async doGetChannelPlaylistsMore (continuation) {
    const urlParams = {
      context: {
        client: {
          clientName: 'WEB',
          clientVersion: '2.20201021.03.00',
        },
      },
      continuation: continuation
    }
    const ajaxUrl = 'https://www.youtube.com/youtubei/v1/browse?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8'

    const channelPageResponse = await YoutubeGrabberHelper.makeChannelPost(ajaxUrl, urlParams)

    if (channelPageResponse.error) {
      return Promise.reject(channelPageResponse.message)
    }

    let nextContinuation = null

    const continuationData = channelPageResponse.data.onResponseReceivedActions[0].appendContinuationItemsAction.continuationItems

    const continuationItem = continuationData.filter((item) => {
      return typeof (item.continuationItemRenderer) !== 'undefined'
    })

    if (typeof continuationItem !== 'undefined' && typeof continuationItem[0] !== 'undefined') {
      nextContinuation = continuationItem[0].continuationItemRenderer.continuationEndpoint.continuationCommand.token
    }

    const channelMetaData = channelPageResponse.data.metadata.channelMetadataRenderer
    const channelName = channelMetaData.title
    const channelId = channelMetaData.externalId

    const channelInfo = {
      channelId: channelId,
      channelName: channelName,
      channelUrl: `https://youtube.com/channel/${channelId}`
    }

    const nextPlaylists = continuationData.filter((item) => {
      return typeof (item.gridShowRenderer) === 'undefined' && typeof (item.continuationItemRenderer) === 'undefined'
    }).map((item) => {
      return YoutubeGrabberHelper.parsePlaylist(item, channelInfo)
    })

    return {
      items: nextPlaylists,
      continuation: nextContinuation
    }
  }

  static async getChannelPlaylistsMore(continuation) {
    const continuationObj = JSON.parse(continuation)
    const token = continuationObj.token
    const channelType = continuationObj.channelType

    let result = null
    // Topic channel playlists don't always return on the first attempt; allow up to 5 tries.
    let tries = channelType === 'topic' ? 5 : 1
    let currentTry = 0;
    while (!result && currentTry < tries) {
      if (currentTry > 0) {
        // slight pause between requests to (hopefully) avoid getting HTTP 429
        await YoutubeGrabberHelper.sleepRandom(1200, 1800);
      }
      try {
        result = await this.doGetChannelPlaylistsMore(token)
      } catch (e) {
        result = null
      }
      currentTry++;
    }
    if (!result) {
      return {
        items: [],
        continuation: null
      }
    }
    
    // Modify continuation in result to include channelType
    if (result.continuation) {
      result.continuation = JSON.stringify({
        token: result.continuation,
        channelType: channelType
      })
    }

    return result
  }

  static async searchChannel(channelId, query = '') {
    const urlParams = queryString.stringify({
      query: query,
      flow: 'grid',
      view: 0,
      pbj: 1
    })
    const ajaxUrl = `https://youtube.com/channel/${channelId}/search?${urlParams}`

    let channelPageResponse = await YoutubeGrabberHelper.makeChannelRequest(ajaxUrl)

    if (channelPageResponse.error) {
      // Try again as a user channel
      const userUrl = `https://youtube.com/user/${channelId}/search?${urlParams}`
      channelPageResponse = await YoutubeGrabberHelper.makeChannelRequest(userUrl)

      if (channelPageResponse.error) {
        return Promise.reject(channelPageResponse.message)
      }
    }

    const channelMetaData = channelPageResponse.data[1].response.metadata.channelMetadataRenderer
    const channelName = channelMetaData.title

    const channelInfo = {
      channelId: channelId,
      channelName: channelName,
      channelUrl: `https://youtube.com/channel/${channelId}`
    }

    const searchTab = channelPageResponse.data[1].response.contents.twoColumnBrowseResultsRenderer.tabs.findIndex((tab) => {
      if (typeof (tab.expandableTabRenderer) !== 'undefined') {
        return true
      }
    })

    const searchResults = channelPageResponse.data[1].response.contents.twoColumnBrowseResultsRenderer.tabs[searchTab].expandableTabRenderer.content.sectionListRenderer

    let continuation = null

    const searchItems = searchResults.contents

    const continuationItem = searchItems.filter((item) => {
      return typeof (item.continuationItemRenderer) !== 'undefined'
    })

    if (typeof continuationItem !== 'undefined' && typeof continuationItem[0] !== 'undefined') {
      continuation = continuationItem[0].continuationItemRenderer.continuationEndpoint.continuationCommand.token
    }

    if (typeof (searchItems[0].itemSectionRenderer.contents[0].messageRenderer) !== 'undefined') {
      return {
        continuation: null,
        items: []
      }
    }

    const parsedSearchItems = searchItems.filter((item) => {
      return typeof (item.continuationItemRenderer) === 'undefined'
    }).map((item) => {
      const obj = item.itemSectionRenderer.contents[0]

      if (typeof (obj.playlistRenderer) !== 'undefined') {
        return YoutubeGrabberHelper.parsePlaylist(obj, channelInfo)
      } else {
        return YoutubeGrabberHelper.parseVideo(obj, channelInfo)
      }
    })

    return {
      continuation: continuation,
      items: parsedSearchItems
    }
  }

  static async searchChannelMore (continuation) {
    const urlParams = {
      context: {
        client: {
          clientName: 'WEB',
          clientVersion: '2.20201021.03.00',
        },
      },
      continuation: continuation
    }
    const ajaxUrl = 'https://www.youtube.com/youtubei/v1/browse?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8'

    const channelPageResponse = await YoutubeGrabberHelper.makeChannelPost(ajaxUrl, urlParams)

    if (channelPageResponse.error) {
      return Promise.reject(channelPageResponse.message)
    }

    let nextContinuation = null

    const continuationData = channelPageResponse.data.onResponseReceivedActions[0].appendContinuationItemsAction.continuationItems

    const continuationItem = continuationData.filter((item) => {
      return typeof (item.continuationItemRenderer) !== 'undefined'
    })

    if (typeof continuationItem !== 'undefined' && typeof continuationItem[0] !== 'undefined') {
      nextContinuation = continuationItem[0].continuationItemRenderer.continuationEndpoint.continuationCommand.token
    }

    const channelMetaData = channelPageResponse.data.metadata.channelMetadataRenderer
    const channelName = channelMetaData.title
    const channelId = channelMetaData.externalId

    const channelInfo = {
      channelId: channelId,
      channelName: channelName
    }

    const nextVideos = continuationData.filter((item) => {
      return typeof (item.continuationItemRenderer) === 'undefined'
    }).map((item) => {
      const channel = item.itemSectionRenderer.contents[0]
      return YoutubeGrabberHelper.parseVideo(channel, channelInfo)
    })

    return {
      items: nextVideos,
      continuation: nextContinuation
    }
  }
}

module.exports = YoutubeGrabber
