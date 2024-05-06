// Config
var linkColor = '63b2cc';

var links = [
    { id: 'album=4108014993', name: 'Nomali - Dubcore', credits: 'Credits: Mastering', date: '2024-05-03', type: 'bandcamp' },
    { id: 'spotify:track:32GAT5y3WYNpvBHAaRk8XU', name: 'bobby mayo - Axolotl', credits: 'Credits: Mastering', date: '2024-03-08', type: 'spotify' },
    { id: 'album=3993366517', name: 'Teeth and Tail - Air [TNT001]', credits: 'Credits: Mastering', date: '2024-03-01', type: 'bandcamp', isVariousArtists: true },
    { id: 'playlists/1754058492', name: 'Zero Plussed - Zero Plussed plates', credits: 'Credits: Mastering', date: '2024-02-10', type: 'soundcloud' },
    { id: 'album=4074789862', name: 'Lü Ka - Burning Bedroom', credits: 'Credits: Mastering', date: '2023-12-08', type: 'bandcamp' },
    { id: 'spotify:track:5GBzndCuV6kqYZQm3DY78x', name: 'bobby mayo - Funk It Up', credits: 'Credits: Mastering', date: '2023-12-01', type: 'spotify' },
    { id: 'album=1188484858', name: 'ACOLDPLACE - ACP 2.1', credits: 'Credits: Contributor, Mastering', date: '2023-12-01', type: 'bandcamp', isVariousArtists: true },
    { id: 'album=79054116', name: 'xtopher - FOR PSY-IENCE', credits: 'Credits: Mastering', date: '2023-11-29', type: 'bandcamp' },
    { id: 'playlists/1717724526', name: 'Sound Salad - Lettuce Begin', credits: 'Credits: Mastering', date: '2023-11-03', type: 'soundcloud' },
    { id: 'spotify:track:45qXRq6fkLxcA8i7N7PnDO', name: 'bobby mayo - Dance Attack!', credits: 'Credits: Mastering', date: '2023-09-29', type: 'spotify' },
    { id: 'tracks/1603868022', name: 'LŪNA - Funk', credits: 'Credits: Mastering', date: '2023-08-30', type: 'soundcloud' },
    { id: 'album=1182416007', name: 'Khz Collective - Various Artists: Vol. 2', credits: 'Credits: Mastering', date: '2023-08-25', type: 'bandcamp', isVariousArtists: true },
    { id: 'album=1916604811', name: 'Sauin x Root Basis - Above the Abject Tide', credits: 'Credits: Co-Writing, Co-Mixing, Mastering', date: '2023-08-04', type: 'bandcamp' },
    { id: 'playlists/1546172593', name: 'Alley - snake oil', credits: 'Credits: Mastering', date: '2023-01-01', type: 'soundcloud' },
    { id: 'track=864865153', name: 'Sano - Scandi', credits: 'Credits: Mastering', date: '2022-12-24', type: 'bandcamp' },
    { id: 'album=2085826436', name: 'Keith - In a Crockpot', credits: 'Credits: Writing, Mixing, Mastering', date: '2022-03-04', type: 'bandcamp' },
    { id: 'tracks/1214910616', name: 'Sauin - Wharariki', credits: 'Credits: Mastering', date: '2023-02-13', type: 'soundcloud' },
    { id: 'album=2595562505', name: 'Grains - Dualism', credits: 'Credits: Mastering', date: '2021-11-27', type: 'bandcamp' },
    { id: 'tracks/1165075729', name: 'Sano - Lost Some Of Me', credits: 'Credits: Mastering', date: '2021-11-23', type: 'soundcloud' },
    { id: 'tracks/1164338554', name: 'PLISSKIN - Turn And Twist', credits: 'Credits: Mastering', date: '2021-11-21', type: 'soundcloud' },
    { id: 'album=343771191', name: 'DESTROY WITH SCIENCE - A New View', credits: 'Credits: Mastering', date: '2021-03-12', type: 'bandcamp' },
    { id: 'album=1891136990', name: 'Grains - ζ', credits: 'Credits: Mastering', date: '2020-09-19', type: 'bandcamp' },
];

// Sort links by date in descending order
function sortLinks(a, b) {
    return new Date(b.date) - new Date(a.date);
}

// Create a common iframe element
function createIframe(src, allowAutoplay = false) {
    var iframe = document.createElement('iframe');
    iframe.style.cssText = 'border: 0; width: 100%; height: 100%;';
    iframe.src = src;
    if (allowAutoplay) {
        iframe.allow = 'autoplay';
    }
    return iframe;
}

// Create an element with text content and class name
function createElementWithText(tag, text, className) {
    var element = document.createElement(tag);
    element.textContent = text;
    element.className = className;
    return element;
}

// Create common elements for the embed
function createEmbedElements(item, iframeSrc, allowAutoplay = false) {
    var wrapperDiv = document.createElement('div');
    wrapperDiv.className = 'player-wrapper';

    var iframeDiv = document.createElement('div');
    iframeDiv.className = 'embed-responsive aspect-ratio-1/1';

    var iframe = createIframe(iframeSrc, allowAutoplay);
    iframeDiv.appendChild(iframe);

    wrapperDiv.appendChild(iframeDiv);

    var nameDiv = createElementWithText('div', item.name, 'release-name');
    if (item.isVariousArtists) {
        var variousArtistsSpan = createElementWithText('span', ' (Various Artists)', 'various-artists');
        nameDiv.appendChild(variousArtistsSpan);
    }
    wrapperDiv.appendChild(nameDiv);

    wrapperDiv.appendChild(createElementWithText('div', item.credits, 'credits'));

    return wrapperDiv;
}

// Create an embed based on item type
function createEmbed(item) {
    var embedSrc = '';
    switch (item.type) {
        case 'bandcamp':
            embedSrc = `https://bandcamp.com/EmbeddedPlayer/${item.id}/size=large/bgcol=333333/linkcol=${linkColor}/tracklist=false/transparent=true/`;
            break;
        case 'soundcloud':
            embedSrc = `https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/${item.id}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&visual=true`;
            break;
        case 'spotify':
            var spotifyURI = item.id.replace(/:/g, '/');
            embedSrc = `https://open.spotify.com/embed/${spotifyURI.split('spotify/')[1]}`;
            break;
    }
    return createEmbedElements(item, embedSrc);
}

// Add all iframes to the grid
function populateGrid() {
    var grid = document.getElementById('songsGrid');
    links.forEach(function (item) {
        grid.appendChild(createEmbed(item));
    });
}

// Initialize the grid on window load
window.addEventListener('load', function () {
    links.sort(sortLinks);
    populateGrid();
});