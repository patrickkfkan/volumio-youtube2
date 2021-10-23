/**
 * Parts of the code based on ytpl
 * https://github.com/TimeForANinja/node-ytpl
 */
const request = require('request');
const qs = require('querystring');
const parser = require(__dirname + '/parser');

const BASE_WATCH_URL = 'https://www.youtube.com/watch?';
const CONTINUATION_URL = 'https://www.youtube.com/youtubei/v1/next?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const MAX_CONTINUATION_RUNS = 5;

async function main(videoId, options = {}) {
    if (!videoId) {
        throw new Error('video ID is mandatory');
    }
    if (typeof videoId !== 'string') {
        throw new Error('video ID must be of type string');
    }
    return getMixPlaylist(videoId, options);
}

async function getMixPlaylist(videoId, options) {
    /**
     * The context holds the following data:
     * 1. options passed to this function
     * 2. session cookies
     * 3. the collapsed mix playlist obtained below
     * 
     * The context is used for maintaining state between requests.
     */
    let context = createContext(options);
    /**
     * Obtain the collapsed mix playlist. Visually, this is among the items shown on 
     * the right-hand side column of the video's watch page.
     */
    let collapsedList = await getCollapsedList(videoId, context);
    if (!collapsedList) {
        return null;
    }
    context.collapsedList = collapsedList;
    /**
     * With information about the collapsed list (like playlist ID), 
     * we can get the expanded list on the video's watch page.
     */
    return await getExpandedList(videoId, context);
};

async function getCollapsedList(videoId, context) {
    let json = await getJsonFromWatchPage(videoId, context);
    let collapsedList = parser.getCollapsedPlaylistInfo(json);
    if (!collapsedList || (!collapsedList.id && !collapsedList.continuation)) {
        return null;
    }
    /**
     * Sometimes, the collapsed list is not among the items initially shown on the watch page.
     * You would have to scroll further down the page to obtain more items which may then
     * contain the collapsed list. Programatically, we use a continuation token to fetch
     * these additional items.
     */
    if (collapsedList.continuation) {
        collapsedList = await getCollapsedListByContinuation(context, collapsedList.continuation);
        if (!collapsedList) {
            return null;
        }
    }
    return collapsedList;
}

async function getCollapsedListByContinuation(context, continuationToken, rt = MAX_CONTINUATION_RUNS) {
    if (rt === 0) {
        /**
         * Give up after MAX_CONTINUATION_RUNS. It is possible there is no mix playlist for the video
         * after all and it would make no sense to keep on going forever.
         */
        return null;
    }
    let json = await getJsonFromContinuationUrl(context, continuationToken);
    let collapsedList = parser.getCollapsedPlaylistInfo(json, true);
    if (collapsedList && collapsedList.continuation) {
        /**
         * If the result has a continuation token, that means the collapsed playlist is not found
         * among the fetched items. We would have to dig deeper...
         */
        return getCollapsedListByContinuation(context, collapsedList.continuation, rt - 1);
    }
    
    return collapsedList;
}

async function getExpandedList(videoId, context) {
    if (!context.collapsedList) {
        return null;
    }
    let json = await getJsonFromWatchPage(videoId, context);
    let info = parser.getExpandedPlaylistInfo(json);
    let result = null;
    if (info) {
        let collapsedData = {
            videoCount: context.collapsedList.videoCount,
            thumbnails: context.collapsedList.thumbnails
        };
        result = Object.assign({}, info, collapsedData);
        result._context = context;
        result.select = select.bind(result);
        result.selectFirst = selectFirst.bind(result);
        result.selectLast = selectLast.bind(result);
        result.getSelected = getSelected.bind(result);
        result.getItemsBeforeSelected = getItemsBeforeSelected.bind(result);
        result.getItemsAfterSelected = getItemsAfterSelected.bind(result);
    }
    return result;
}

async function getJsonFromWatchPage(videoId, context, rt = 3) {
    if (rt === 0) throw new Error('Unable to find JSON!');

    let query = { v: videoId };
    if (context.collapsedList) query.list = context.collapsedList.id;
    if (context.options.gl) query.gl = context.options.gl;
    if (context.options.hl) query.hl = context.options.hl;

    let requestOptions = {
        method: 'GET', 
        uri: BASE_WATCH_URL + qs.encode(query),
        jar: context.session.cookieJar
    };
    const resp = await doRequest(requestOptions);
    const json = parser.getJsonFromBody(resp.body);

    // Retry if unable to find json => most likely old response
    if (!json) return getJsonFromWatchPage(videoId, context, rt - 1);

    // Pass Errors from the API
    if (json.alerts && !json.contents) {
        let error = json.alerts.find(a => a.alertRenderer && a.alertRenderer.type === 'ERROR');
        if (error) throw new Error(`API-Error: ${parser.parseText(error.alertRenderer.text)}`);
    }

    return json;
}

async function getJsonFromContinuationUrl(context, continuationToken) {
    let postData = {
        context: {
            client: {
                clientName: 'WEB',
                clientVersion: '2.20201021.03.00',
            }
        },
        continuation: continuationToken
    };
    if (context.options.gl) postData.gl = context.options.gl;
    if (context.options.hl) postData.hl = context.options.hl;

    let requestOptions = {
        method: 'POST',
        uri: CONTINUATION_URL,
        json: true,
        body: postData,
        jar: context.session.cookieJar
    };
    let resp = await doRequest(requestOptions);

    return resp.body;
}

async function select(videoIdOrIndex) {
    let videoId;
    if (Number.isInteger(videoIdOrIndex)) {
        videoId = this.items[videoIdOrIndex].id;
    }
    else {
        videoId = videoIdOrIndex;
    }
    return getExpandedList(videoId, this._context);
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

function createContext(options) {
    let context = {
        collapsedList: null,
        options: {
            gl: options.gl || '',
            hl: options.hl || '',
        },
        session: {
            cookieJar: request.jar()
        }
    };
    return context;
}

function doRequest(opts) {
    return new Promise( (resolve, reject) => {
        request(opts, (error, response, body) => {
            if (error) {
                reject(error);
            }
            else {
                resolve({
                    response,
                    body
                });
            }
        });
    });
}

module.exports = main;