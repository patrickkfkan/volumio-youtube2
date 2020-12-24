/**
 * Parts of the code based on ytpl
 * https://github.com/TimeForANinja/node-ytpl
 */
const request = require('request');
const qs = require('querystring');
const parser = require(__dirname + '/parser');

const BASE_WATCH_URL = 'https://www.youtube.com/watch?';

async function getMixPlaylist(params, rt = 3) {
    if (rt === 0) throw new Error('Unable to find JSON!');

    const opts = checkParams(params);   
    const resp = await doRequest(opts);
    const json = parser.getJsonFromBody(resp.body);

    // Retry if unable to find json => most likely old response
    if (!json) return getMixPlaylist(params, rt - 1);

    // Pass Errors from the API
    if (json.alerts && !json.contents) {
        let error = json.alerts.find(a => a.alertRenderer && a.alertRenderer.type === 'ERROR');
        if (error) throw new Error(`API-Error: ${parser.parseText(error.alertRenderer.text)}`);
    }

    if (!opts.query.list) { // no playlistId specified
        let unexpandedPlaylist = parser.getUnexpandedPlaylistInfo(json);
        if (!unexpandedPlaylist || !unexpandedPlaylist.id) {
            return null;
        }
        else {
            let newParams = Object.assign({}, params);
            newParams.session = {
                cookieJar: resp.cookieJar,
                playlistId: unexpandedPlaylist.id
            }
            return getMixPlaylist(newParams);
        }
    }

    let info = parser.getExpandedPlaylistInfo(json);
    info.session = {
        cookieJar: resp.cookieJar,
        playlistId: info.id
    };

    return info;
};

function checkParams(params) {
    if (!params.videoId) {
        throw new Error('video ID is mandatory');
    }
    if (typeof params.videoId !== 'string') {
        throw new Error('video ID must be of type string');
    }
    if (params.session && params.session.playlistId && typeof params.session.playlistId !== 'string') {
        throw new Error('playlist ID must be of of type string');
    }

    let opts = {
        query: {
            v: params.videoId,
        }
    };
    if (params.gl) opts.query.gl = params.gl;
    if (params.hl) opts.query.hl = params.hl;

    if (params.session) {
        if (params.session.playlistId) opts.query.list = params.session.playlistId;
        if (params.session.cookieJar) opts.requestCookieJar = params.session.cookieJar;
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

module.exports = getMixPlaylist;