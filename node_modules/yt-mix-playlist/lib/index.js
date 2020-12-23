/**
 * Parts of the code based on ytpl
 * https://github.com/TimeForANinja/node-ytpl
 */
const miniget = require('miniget');
const qs = require('querystring');
const parser = require(__dirname + '/parser');

const BASE_WATCH_URL = 'https://www.youtube.com/watch?';

async function getMixPlaylist(params, rt = 3) {
    if (rt === 0) throw new Error('Unable to find JSON!');

    const opts = checkParams(params);
    const url =  BASE_WATCH_URL + qs.encode(opts.query);
    const body = await miniget(url, opts.requestOptions).text();
    const json = parser.getJsonFromBody(body);

    // Retry if unable to find json => most likely old response
    if (!json) return getMixPlaylist(params, rt - 1);

    // Pass Errors from the API
    if (json.alerts && !json.contents) {
        let error = json.alerts.find(a => a.alertRenderer && a.alertRenderer.type === 'ERROR');
        if (error) throw new Error(`API-Error: ${parser.parseText(error.alertRenderer.text)}`);
    }

    if (!params.playlistId) {
        let unexpandedPlaylist = parser.getUnexpandedPlaylistInfo(json);
        if (!unexpandedPlaylist || !unexpandedPlaylist.id) {
            return null;
        }
        else {
            let newParams = Object.assign({}, params);
            newParams.playlistId = unexpandedPlaylist.id;
            return getMixPlaylist(newParams);
        }
    }

    return parser.getExpandedPlaylistInfo(json);
};

function checkParams(params) {
    if (!params.videoId) {
        throw new Error('video ID is mandatory');
    }
    if (typeof params.videoId !== 'string') {
        throw new Error('video ID must be of type string');
    }
    if (params.playlistId && typeof params.playlistId !== 'string') {
        throw new Error('playlist ID must be of of type string');
    }

    let query = {
        v: params.videoId,
    };
    if (params.playlistId) query.list = params.playlistId;
    if (params.gl) query.gl = params.gl;
    if (params.hl) query.hl = params.hl;

    let requestOptions = Object.assign({}, params.requestOptions);
    // Unlink requestOptions#headers
    if (requestOptions.headers) {
        requestOptions.headers = JSON.parse(JSON.stringify(requestOptions.headers));
    }

    return {
        query: query,
        requestOptions: requestOptions
    };
};

module.exports = getMixPlaylist