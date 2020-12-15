'use strict';

const BaseParser = require(__dirname + '/base');

class PlaylistParser extends BaseParser {

    parseToListItem(playlist) {
        let baseUri = this.getUri();
    
        let data = {
            'service': 'youtube2',
            'type': 'folder',
            'title': playlist.title,
            'artist': playlist.channel.title,
            'albumart': playlist.thumbnail,
            'uri': baseUri + '/videos@playlistId=' + playlist.id
        }
        return data;
    }
}

module.exports = PlaylistParser;