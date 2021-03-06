'use strict';

const libQ = require('kew');
const md5 = require('md5');
const yt2 = require(yt2PluginLibRoot + '/youtube2');

class ScrapingBaseModel {

    _doGetItems(options, defer, currentList = [], iteration = 1) {
        let self = this;

        let filter = self.getFilter(options),
            pageOffset = options.pageOffset || 0,
            limit = options.limit || 47;

        let fetchPromise = self.getFetchPromise(options);

        fetchPromise.then( (result) => {
            let items = self.getItemsFromFetchResult(result, options);
            if (pageOffset) {
                items.splice(0, pageOffset);
            }
            let itemCountToLimit = limit - currentList.length; // number of items to add before hitting limit

            let nextPageOffset;
            if (items && filter) { 
                let itemOffset = 0;
                let includeCount = 0;
                let filtered = items.filter( (item) => {
                    if (includeCount >= itemCountToLimit) {
                        return false;
                    }
                    let inc = filter(item);
                    if (inc) {
                        includeCount++;
                    }
                    itemOffset++;
                    return inc;
                });
                if (itemOffset === items.length) {
                    nextPageOffset = 0;
                }
                else {
                    nextPageOffset = itemOffset + pageOffset;
                }
                items = filtered;
            }
            else if (items) {
                if (items.length > itemCountToLimit) {
                    items.splice(itemCountToLimit);
                    nextPageOffset = items.length + pageOffset;
                }
                else {
                    nextPageOffset = 0;
                }
            }
            currentList = currentList.concat(items);

            let nextPageToken;
            if (nextPageOffset > 0 && options.pageToken) {
                nextPageToken = options.pageToken;
            }
            else if (nextPageOffset === 0) {
                nextPageToken = self.getNextPageTokenFromFetchResult(result, options);
            }
            else {
                nextPageToken = null;
            }
            
            iteration++;
            let maxIt = self.getMaxFetchIterations(options);
            let maxFetchIterationsReached = maxIt && iteration > maxIt;
            if (!maxFetchIterationsReached && currentList.length < limit && nextPageToken) { // get more items
                options.pageToken = nextPageToken;
                options.pageOffset = 0;
                self._doGetItems(options, defer, currentList, iteration);
            }
            else {
                let entities = [];
                currentList.forEach( (item) => {
                    entities.push(self.convertToEntity(item, options));
                });

                defer.resolve({
                    items: entities,
                    nextPageToken: maxFetchIterationsReached ? null : nextPageToken,
                    nextPageOffset: maxFetchIterationsReached ? 0 : nextPageOffset
                });
            }
        }).fail( (error) => {
            yt2.getLogger().error('[youtube2-model.scraper.base] getItems(): ' + error.message + "\n" + error.stack);
            defer.reject(error);
        });
    }

    getItems(options) {
        let defer = libQ.defer();

        this._doGetItems(Object.assign({}, options), defer);

        return defer.promise;
    }

    getFetchPromise(options) {
        return libQ.resolve();
    }

    getItemsFromFetchResult(result, options) {
        return [];
    }

    getNextPageTokenFromFetchResult(result, options) {
        return null;
    }

    getFilter(options) {
        return null;
    }

    getMaxFetchIterations(options) {
        return false;
    }

    convertToEntity(item, options) {
        return null;
    }

    getCacheKeyForFetch(resourceName, fetchOptions) {
        let key = `yt2.model.scraping.${resourceName}`;
        let opKeys = Object.keys(fetchOptions);
        let sorted = opKeys.sort();
        sorted.forEach( (k) => {
            let s = `${k}=${encodeURIComponent(fetchOptions[k])}`;
            key += '@' + s;
        });
        return md5(key);
    }

}

module.exports = ScrapingBaseModel;