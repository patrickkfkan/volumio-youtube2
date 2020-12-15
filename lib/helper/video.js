'use strict';

const libQ = require('kew');
const ytdl = require('ytdl-core');

class VideoHelper {

    static getAudioUrl(videoId) {
        let defer = libQ.defer();
        
        ytdl.getInfo(videoId).then( (info) => {
            let audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
            let highestAudioFormat = ytdl.chooseFormat(audioFormats, {
                quality: 'highest'
            });
            defer.resolve(highestAudioFormat.url);
        }).catch( (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }
}

module.exports = VideoHelper;