/**
 * Parts of the code based on ytpl
 * https://github.com/TimeForANinja/node-ytpl
 */
const request = require('request');
const qs = require('querystring');
const parser = require(__dirname + '/parser');

const BASE_WATCH_URL = 'https://www.youtube.com/watch?';

async function main(videoId, options) {
    return getMixPlaylist(videoId, options);
}

async function getMixPlaylist(videoId, options, context, rt = 3) {
    if (rt === 0) throw new Error('Unable to find JSON!');

    const opts = checkArgs(videoId, options, context);
    const resp = await doRequest(opts);
    const json = parser.getJsonFromBody(resp.body);

    // Retry if unable to find json => most likely old response
    if (!json) return getMixPlaylist(videoId, options, context, rt - 1);

    // Pass Errors from the API
    if (json.alerts && !json.contents) {
        let error = json.alerts.find(a => a.alertRenderer && a.alertRenderer.type === 'ERROR');
        if (error) throw new Error(`API-Error: ${parser.parseText(error.alertRenderer.text)}`);
    }

    if (!opts.query.list) { // no playlistId specified
        let collapsedPlaylist = parser.getCollapsedPlaylistInfo(json);
        if (!collapsedPlaylist || !collapsedPlaylist.id) {
            return null;
        }
        else {
            let _context = {
                session: {
                    cookieJar: resp.cookieJar
                },
                playlistId: collapsedPlaylist.id,
                collapsedExtras: {
                    videoCount: collapsedPlaylist.videoCount,
                    thumbnails: collapsedPlaylist.thumbnails
                },
                options: {
                    hl: opts.query.hl,
                    gl: opts.query.gl
                }
            };
            return getMixPlaylist(videoId, null, _context);
        }
    }

    let info = parser.getExpandedPlaylistInfo(json);
    let result = null;
    if (info) {
        result = Object.assign({}, info, opts.collapsedExtras);
        result._context = {
            session: {
                cookieJar: resp.cookieJar
            },
            playlistId: info.id,
            collapsedExtras: opts.collapsedExtras,
            options: {
                hl: opts.query.hl,
                gl: opts.query.gl
            }
        };
        result.select = select.bind(result);
        result.selectFirst = selectFirst.bind(result);
        result.selectLast = selectLast.bind(result);
        result.getSelected = getSelected.bind(result);
        result.getItemsBeforeSelected = getItemsBeforeSelected.bind(result);
        result.getItemsAfterSelected = getItemsAfterSelected.bind(result);
    }
    
    return result;
};

async function select(videoIdOrIndex) {
    let videoId;
    if (Number.isInteger(videoIdOrIndex)) {
        videoId = this.items[videoIdOrIndex].id;
    }
    else {
        videoId = videoIdOrIndex;
    }
    return getMixPlaylist(videoId, null, this._context);
}

async function selectFirst() {
    return this.select(0);
}

async function selectLast() {
    return this.select(this.items.length - 1);
}

function getSelected() {
    return this.items[this.currentIndex];
}

function getItemsBeforeSelected() {
    return this.items.slice(0, this.currentIndex);
}

function getItemsAfterSelected() {
    return this.items.slice(this.currentIndex + 1);
}

function checkArgs(videoId, options, context) {
    if (!videoId) {
        throw new Error('video ID is mandatory');
    }
    if (typeof videoId !== 'string') {
        throw new Error('video ID must be of type string');
    }
    
    let opts = {
        query: {
            v: videoId,
        }
    };

    if (context) {
        if (context.playlistId) opts.query.list = context.playlistId;
        if (context.options) {
            if (context.options.gl) opts.query.gl = context.options.gl;
            if (context.options.hl) opts.query.hl = context.options.hl;
        }
        if (context.session && context.session.cookieJar) {
            opts.requestCookieJar = context.session.cookieJar;
        }
        opts.collapsedExtras = context.collapsedExtras || {};
    }
    else if (options) {
        if (options.gl) opts.query.gl = options.gl;
        if (options.hl) opts.query.hl = options.hl;
    }

    return opts;
};

async function doRequest(opts) {
    let requestOptions = {
        method: 'GET', 
        uri: BASE_WATCH_URL + qs.encode(opts.query),
        jar: opts.requestCookieJar || request.jar()
    };
    return new Promise( (resolve, reject) => {
        request(requestOptions, (error, response, body) => {
            if (error) {
                reject(error);
            }
            else {
                resolve({
                    response: response,
                    body: body,
                    cookieJar: requestOptions.jar
                });
            }
        });
    });
}

module.exports = main;