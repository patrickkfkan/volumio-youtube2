'use strict';

const BaseEntity = require(__dirname + '/base');

class Video extends BaseEntity {

    constructor(id, title, thumbnail, channel) {
        super(id, title, thumbnail);
        this.channel = channel;
    }

}

module.exports = Video;