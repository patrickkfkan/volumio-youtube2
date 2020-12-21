'use strict';

const libQ = require('kew');
const ytdl = require('ytdl-core');

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
                upNextVideoId = info.response.contents.twoColumnWatchNextResults.secondaryResults.secondaryResults.results[0].compactAutoplayRenderer.contents[0].compactVideoRenderer.videoId || null;
            } catch (error) {
                upNextVideoId = null;
            }

            defer.resolve({
                audioUrl: highestAudioFormat.url,
                upNextVideoId: upNextVideoId
            });
        }).catch( (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }
}

module.exports = VideoHelper;