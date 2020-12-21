'use strict';

const libQ = require('kew');
const yt2 = require(yt2PluginLibRoot + '/youtube2');
const VideoHelper = require(yt2PluginLibRoot + '/helper/video');

class PlayController {

    constructor() {
        let self = this;

        self.mpdPlugin = yt2.getMpdPlugin();
        
        self.autoplayListener = () => {
            self.mpdPlugin.getState().then( (state) => {
                if (state.status === 'stop') {
                    self._handleAutoplay();
                    self.mpdPlugin.clientMpd.removeListener('system-player', self.autoplayListener);
                }
            });
        }
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
        let autoplayPrefix = 'youtube2/video@autoplay=1@videoId=';
        if (track.uri.startsWith(prefix)) {
            videoId = track.uri.substring(prefix.length).trim() || undefined;
        }
        else if (track.uri.startsWith(autoplayPrefix)) {
            videoId = track.uri.substring(autoplayPrefix.length).trim() || undefined;
        }
        if (videoId == undefined) {
            let err = 'Invalid track uri: ' + track.uri;
            yt2.toast('error', err);
            return libQ.reject(err);
        }

        let streamUrl;
        return VideoHelper.getPlaybackInfo(videoId).then( (info) => {
            streamUrl = info.audioUrl.replace(/"/g, '\\"');  // safe uri
            self.lastPlaybackInfo = {
                track: track,
                position: yt2.getStateMachine().getState().position,
                upNextVideoId: info.upNextVideoId
            };
            return streamUrl;
        }).then( (streamUrl) => {
            return self._doPlay(streamUrl, track);
        }).then( (mpdPlayResult) => {
            if (yt2.getConfigValue('autoplay', false)) {
                self.mpdPlugin.clientMpd.on('system-player', self.autoplayListener);
            }
            return mpdPlayResult;
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

    _handleAutoplay() {
        let self = this;
        let lastPlaybackItemPosition = self._getLastPlaybackItemPosition();

        if (lastPlaybackItemPosition < 0) {
            return;
        }

        let stateMachine = yt2.getStateMachine(),
            state = stateMachine.getState(),
            isLastTrack = stateMachine.getQueue().length - 1 === lastPlaybackItemPosition,
            currentPositionChanged = state.position !== lastPlaybackItemPosition, // true if client clicks on another item in the queue
            autoplayPrefix = 'youtube2/video@autoplay=1@videoId=',
            queueItemRemoved = false;
           
        if (self.lastPlaybackInfo.track.service === 'youtube2' && self.lastPlaybackInfo.track.uri.startsWith(autoplayPrefix)) {
            yt2.getLogger().info(`[youtube2-play] _handleAutoPlay(): Removing autoplayed video from queue (position ${lastPlaybackItemPosition})`);
            stateMachine.removeQueueItem({ value: lastPlaybackItemPosition });
            queueItemRemoved = true;
        }

        if (!yt2.getConfigValue('autoplay', false) || currentPositionChanged || !isLastTrack || state.random || state.repeat || state.repeatSingle || !self.lastPlaybackInfo.upNextVideoId) {
            if (queueItemRemoved && !currentPositionChanged && !isLastTrack) { 
                // Playback stopped without client request
                // StateMachine will try to play the next track after this function exits, but if
                // autoplay item has been removed from queue, StateMachine will somehow obtain 
                // track info with null fields (even at the same track position as the autoplay item
                // prior to removal). We force StateMachine to play the next track here.
                // Note that we don't need to do this if the playback was stopped because
                // client clicked on another item in the queue, because the StateMachine
                // would obtain the correct track info before this function is entered (i.e.
                // before autoplay item is removed).
                // Hacky, but seems to work.
                stateMachine.play(state.position);
            }
            if (!self.lastPlaybackInfo.upNextVideoId) {
                yt2.getLogger().info('[youtube2-play] _handleAutoplay(): No "Up Next" video available');
            }
            return;
        }

        // Add Up Next Video to queue
        let upNextQueueItem = {
            service: 'youtube2',
            uri: 'youtube2/video@autoplay=1@videoId=' + self.lastPlaybackInfo.upNextVideoId
        };
        stateMachine.addQueueItems([upNextQueueItem]).then( (result) => {
            yt2.getLogger().info(`[youtube2-play] _handleAutoplay(): Start autoplaying video ${self.lastPlaybackInfo.upNextVideoId}`);

            // Hacky way to prevent autoplay label from displaying
            // in the player status (the label contains html tags that
            // will be shown as escaped string)
            let queue = stateMachine.getQueue();
            let addedQueueItem = queue[result.firstItemIndex];
            let titleWithAutoplayLabel = addedQueueItem.name;
            addedQueueItem.name = addedQueueItem.title; // 'title' has no autoplay label

            stateMachine.play(result.firstItemIndex).then( () => {
                // Reinstate queue item name
                addedQueueItem.name = titleWithAutoplayLabel;
            });
        });
    }

    _getLastPlaybackItemPosition() {
        if (!this.lastPlaybackInfo) {
            return -1;
        }

        let queue = yt2.getStateMachine().getQueue(),
            uri = this.lastPlaybackInfo.track.uri,
            upTo = this.lastPlaybackInfo.position;

        for (let i = upTo; i >= 0; i--) {
            let queueItem = queue[i];
            if (queueItem && queueItem.uri === uri) {
                return i;
            }
        }

        return -1;
    }

}

module.exports = PlayController;