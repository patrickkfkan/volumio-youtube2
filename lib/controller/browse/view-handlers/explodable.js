'use strict';

const libQ = require('kew');
const yt2 = require(yt2PluginLibRoot + '/youtube2');
const BaseViewHandler = require(__dirname + '/base');

class ExplodableViewHandler extends BaseViewHandler {

    explode() {
        let self = this;

        let view = self.getCurrentView();
        if (view.noExplode) {
            return libQ.resolve([]);
        }

        let defer = libQ.defer();

        this.getVideosOnExplode().then( (videos) => {
            if (videos == null) {
                defer.reject('Video not found');
            }
            else if (!Array.isArray(videos)) {
                self._parseVideoForExplode(videos).then( (videoInfo) => {
                    defer.resolve([videoInfo]);
                });
            }
            else {
                let parsePromises = [];
                videos.forEach( (video) => {
                    parsePromises.push(self._parseVideoForExplode(video));
                });
                libQ.all(parsePromises).then( (videos) => {
                    let items = [];
                    videos.forEach( (video) => {
                        items.push(video);
                    });
                    defer.resolve(items);
                });
            }
        }).fail( (error) => {
            defer.reject(error);
        })

        return defer.promise;
    }

    getVideosOnExplode() {
        return libQ.resolve([]);
    }

    _parseVideoForExplode(video) {
        let defer = libQ.defer();
        let data = {
            'service': 'youtube2',
            'uri': this._getTrackUri(video),
            'type': 'song',
            'albumart': video.thumbnail,
            'artist': video.channel.title,
            'name': video.title,
            'title': video.title,
        };
        defer.resolve(data);
        return defer.promise;
    }

    /**
     * Track uri:
     * youtube2/{videoId}
     */
    _getTrackUri(video) {
        let uri = 'youtube2/video@videoId=' + video.id;
        yt2.getLogger().info('[youtube2-explodable] getTrackUri(): ' + uri);
        return uri;
    }

}

module.exports = ExplodableViewHandler;