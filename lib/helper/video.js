'use strict';

const libQ = require('kew');
const ytdl = require('ytdl-core');
const ytmpl = require('yt-mix-playlist');

class VideoHelper {

    static getPlaybackInfo(videoId) {
        let defer = libQ.defer();
        
        ytdl.getInfo(videoId).then( (info) => {
            // Audio
            let audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
            let highestAudioFormat = ytdl.chooseFormat(audioFormats, {
                quality: 'highest'
            });

            // Up Next video
            let upNextVideoId;
            try {
                upNextVideoId = info.response.contents.twoColumnWatchNextResults.autoplay.autoplay.sets[0].autoplayVideo.watchEndpoint.videoId || null;
            } catch (error) {
                upNextVideoId = null;
            }

            defer.resolve({
                audioUrl: highestAudioFormat.url,
                upNextVideoId: upNextVideoId,
                relatedVideos: info.related_videos
            });
        }).catch( (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }

    static getMixPlaylist(videoId) {
        let defer = libQ.defer();

        ytmpl(videoId).then( (mixPlaylist) => {
            defer.resolve(mixPlaylist);
        }).catch( (error) => {
            defer.resolve(null);
        });

        return defer.promise;
    }

    static refreshMixPlaylist(mixPlaylist, currentVideoId) {
        let defer = libQ.defer();

        mixPlaylist.select(currentVideoId).then( (updatedPlaylist) => {
            defer.resolve(updatedPlaylist);
        }).catch( (error) => {
            defer.resolve(null);
        });

        return defer.promise;
    }
}

module.exports = VideoHelper;