/**
 * Parts of the code based on ytpl
 * https://github.com/TimeForANinja/node-ytpl
 */
const URL = require('url');

const BASE_URL = 'https://www.youtube.com/';

function getJsonFromBody(body) {
    const json = jsonAfter(body, 'window["ytInitialData"] = ') || jsonAfter(body, 'var ytInitialData = ');
    return json;
};

function jsonAfter(haystack, left) {
    const pos = haystack.indexOf(left);
    if (pos === -1) { return null; }
    haystack = haystack.slice(pos + left.length);
    try {
        return JSON.parse(cutAfterJSON(haystack));
    } catch (e) {
        return null;
    }
};

function cutAfterJSON(mixedJson) {
    let open, close;
    if (mixedJson[0] === '[') {
        open = '[';
        close = ']';
    } else if (mixedJson[0] === '{') {
        open = '{';
        close = '}';
    }

    if (!open) {
        throw new Error(`Can't cut unsupported JSON (need to begin with [ or { ) but got: ${mixedJson[0]}`);
    }

    // States if the loop is currently in a string
    let isString = false;

    // Current open brackets to be closed
    let counter = 0;

    let i;
    for (i = 0; i < mixedJson.length; i++) {
        // Toggle the isString boolean when leaving/entering string
        if (mixedJson[i] === '"' && mixedJson[i - 1] !== '\\') {
        isString = !isString;
        continue;
        }
        if (isString) continue;

        if (mixedJson[i] === open) {
        counter++;
        } else if (mixedJson[i] === close) {
        counter--;
        }

        // All brackets have been closed, thus end of JSON is reached
        if (counter === 0) {
        // Return the cut JSON
        return mixedJson.substr(0, i + 1);
        }
    }

    // We ran through the whole string and ended up with an unclosed bracket
    throw Error("Can't cut unsupported JSON (no matching closing bracket found)");
};

function parseText(txt) {
    return txt.simpleText || txt.runs.map(a => a.text).join('');
}

function getCollapsedPlaylistInfo(json) {
    let results;
    try {
        results = json.contents.twoColumnWatchNextResults.secondaryResults.secondaryResults.results;
    } catch (e) {
        return null;
    }
    if (Array.isArray(results)) {
        for(let i = 0; i < results.length; i++) {
            let result = results[i];
            let info = result.compactRadioRenderer;
            if (info && info.playlistId) {
                return {
                    id: info.playlistId,
                    title: parseText(info.title),
                    author: parseText(info.longBylineText),
                    videoCount: parseText(info.videoCountText),
                    url: result.shareUrl,
                    thumbnails: prepImg(info.thumbnail.thumbnails)
                };
            }
        }
    }
    return null;
}

function getExpandedPlaylistInfo(json) {
    let playlist;
    try {
        playlist = json.contents.twoColumnWatchNextResults.playlist.playlist;
    } catch (e) {
        return null;
    }
    if (playlist) {
        let expandedInfo = {
            id: playlist.playlistId,
            title: parseText(playlist.titleText),
            author: parseText(playlist.ownerName),
            url: playlist.playlistShareUrl,
            currentIndex: playlist.currentIndex,
            items: []
        }
        if (Array.isArray(playlist.contents)) {
            playlist.contents.forEach( (item) => {
                expandedInfo.items.push(parsePlaylistItem(item));
            })
        }
        return expandedInfo;
    }
    return null;
}

function parsePlaylistItem(data) {
    let info = data.playlistPanelVideoRenderer;
    if (info) {
        return {
            id: info.videoId,
            title: parseText(info.title),
            author: parsePlaylistItemAuthor(info),
            url: URL.resolve(BASE_URL, info.navigationEndpoint.commandMetadata.webCommandMetadata.url),
            selected: info.selected,
            duration: parseText(info.lengthText),
            thumbnails: prepImg(info.thumbnail.thumbnails)
        }
    }
    return null;
}

function parsePlaylistItemAuthor(data) {
    return {
        name: parseText(data.shortBylineText),
        channelId: data.shortBylineText.runs[0].navigationEndpoint.browseEndpoint.browseId,
        url: URL.resolve(BASE_URL, data.shortBylineText.runs[0].navigationEndpoint.browseEndpoint.canonicalBaseUrl)
    }
}

function prepImg(img) {
    // Resolve url
    img.forEach(x => x.url = x.url ? URL.resolve(BASE_URL, x.url) : null);
    // Sort
    return img.sort((a, b) => b.width - a.width);
};

module.exports = {
    getJsonFromBody,
    parseText,
    getCollapsedPlaylistInfo,
    getExpandedPlaylistInfo
}