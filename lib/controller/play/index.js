'use strict';

const libQ = require('kew');
const yt2 = require(yt2PluginLibRoot + '/youtube2');
const VideoHelper = require(yt2PluginLibRoot + '/helper/video');

class PlayController {

    constructor() {
        this.mpdPlugin = yt2.getMpdPlugin();
    }

    /**
     * Track uri:
     * youtube/video@videoId={videoId}
     */
    clearAddPlayTrack(track) {
        yt2.getLogger().info('[youtube2-play] clearAddPlayTrack: ' + track.uri);

        let self = this;

        let videoId;
        let prefix = 'youtube2/video@videoId=';
        if (track.uri.startsWith(prefix)) {
            videoId = track.uri.substring(prefix.length).trim() || undefined;
        }
        if (videoId == undefined) {
            let err = 'Invalid track uri: ' + track.uri;
            yt2.toast('error', err);
            return libQ.reject(err);
        }

        return VideoHelper.getAudioUrl(videoId).then( (url) => {
            let safeUri = url.replace(/"/g, '\\"');
            return safeUri;
        }).then( (streamUrl) => {
            return self._doPlay(streamUrl, track);
        }).fail( (error) => {
            yt2.getLogger().error('[youtube2-play] clearAddPlayTrack() error');
            yt2.getLogger().error(error);
            if (error.statusCode === 429) {
                yt2.toast('error', 'Cannot play track: HTTP status 429 - Too Many Requests');
            }
            else {
                yt2.toast(error);
            }
            return libQ.reject(error);
        });
    }

    stop() {
        yt2.getStateMachine().setConsumeUpdateService('mpd', false, false);
        return this.mpdPlugin.stop();
    };

    pause() {
        yt2.getStateMachine().setConsumeUpdateService('mpd', false, false);
        return this.mpdPlugin.pause();
    };
  
    resume() {
        yt2.getStateMachine().setConsumeUpdateService('mpd', false, false);
        return this.mpdPlugin.resume();
    }
  
    seek(position) {
        yt2.getStateMachine().setConsumeUpdateService('mpd', false, false);
        return this.mpdPlugin.seek(position);
    }

    _doPlay(streamUrl, track) {
        let mpdPlugin = this.mpdPlugin;

        return mpdPlugin.sendMpdCommand('stop', [])
        .then( () => {
            return mpdPlugin.sendMpdCommand('clear', []);
        })
        .then( () => {
            return mpdPlugin.sendMpdCommand('load "' + streamUrl + '"', []);
        })
        .fail( () => {
            // Send 'addid' command instead of 'add' to get mpd's Id of the song added.
            // We can then add tags using mpd's song Id.
            return mpdPlugin.sendMpdCommand('addid "' + streamUrl + '"', []);
        })
        .then( (addIdResp) => {
            if (addIdResp && typeof addIdResp.Id != undefined) {
                let songId = addIdResp.Id;

                let cmdAddTitleTag = {
                    command: 'addtagid',
                    parameters: [songId, 'title', track.title]
                };
                let cmdAddArtistTag = {
                    command: 'addtagid',
                    parameters: [songId, 'artist', track.artist]
                }

                return mpdPlugin.sendMpdCommandArray([cmdAddTitleTag, cmdAddArtistTag]);
            }
            else {
                return libQ.resolve();
            }
        })
        .then( () => {
            yt2.getStateMachine().setConsumeUpdateService('mpd', false, false);
            return mpdPlugin.sendMpdCommand('play', []);
        });
    }

}

module.exports = PlayController;