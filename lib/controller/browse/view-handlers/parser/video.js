'use strict';

const BaseParser = require(__dirname + '/base');

class VideoParser extends BaseParser {

    parseToListItem(video) {
        let baseUri = this.getUri();

        let data = {
            'service': 'youtube2',
            'type': 'song',
            'title': video.title,
            'artist': video.channel.title,
            'albumart': video.thumbnail,
            'uri': baseUri + '/video@videoId=' + video.id
        }
        return data;
    }
}

module.exports = VideoParser;