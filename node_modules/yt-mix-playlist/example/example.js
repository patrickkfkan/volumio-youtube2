const ytmpl = require('../');

async function getMixPlaylist(videoId) {
    let options = { hl: 'en', gl: 'US' };
    return await ytmpl(videoId, options);
}

function dumpPlaylistInfo(pl) {
    console.log('- Id: ' + pl.id);
    console.log('- Title: ' + pl.title);
    console.log('- Author: ' + pl.author);
    console.log('- Video Count: ' + pl.videoCount);
    console.log('- Share URL: ' + pl.url);
    console.log('- Thumbnails: ' + JSON.stringify(pl.thumbnails));
    console.log(`- Selected video Id: ${pl.getSelected().id} (index: ${pl.currentIndex})`);
    console.log('- Items:');
    console.log('--------------------');
    dumpPlaylistItems(pl.items);
}

function dumpPlaylistItems(items, idOnly = false) {
    items.forEach( (item, index) => {
        if (idOnly) {
            console.log(`${index}. ${item.id}`);
        }
        else {
            console.log(`${index}. ${item.id}${item.selected ? '(selected)' : ''}: ${item.title} by ${item.author.name} (channelId: ${item.author.channelId} - ${item.author.url})`);
        }
        
    });
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    let videoId = 'XCcN-IoYIJA';
    console.log(`Obtaining Mix playlist for video ${videoId}...`);
    console.log('');
    let pl = await getMixPlaylist(videoId);
    if (pl === null) {
        console.log('Failed to obtain playlist');
        return;
    }
    else {
        console.log('Obtained playlist:');
        dumpPlaylistInfo(pl);
    }
    let i = 0, extracted = pl.items;
    while (i < 4) {
        console.log('');
        console.log('================================================');
        console.log(`Iteration #${i}: Selecting last item in playlist...`);
        pl = await pl.selectLast();
        console.log('');
        console.log('Playlist updated:');
        dumpPlaylistInfo(pl);

        extracted = extracted.concat(pl.getItemsAfterSelected());
        i++;
        await sleep(2000);
    }
    console.log('');
    console.log('===========================================');
    console.log('Selecting first item in current playlist...');
    pl = await pl.selectFirst();
    console.log('');
    console.log('Playlist updated:');
    dumpPlaylistInfo(pl);

    console.log('');
    console.log('');
    console.log('Video Ids fetched:');
    console.log('------------------');
    dumpPlaylistItems(extracted, true);
}

main();