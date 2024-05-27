// Config
var linkColor = '63b2cc';

var links = [
    {
        name: 'Nomali - Dubcore',
        credits: 'Credits: Mastering',
        date: '2024-05-03',
        id: 'album=4108014993',
        url: 'https://post-modernmusic.bandcamp.com/album/dubcore',
        type: 'bandcamp',
    },
    {
        name: 'bobby mayo - Axolotl',
        credits: 'Credits: Mastering',
        date: '2024-03-08', id: 'spotify:track:32GAT5y3WYNpvBHAaRk8XU',
        url: 'https://open.spotify.com/track/32GAT5y3WYNpvBHAaRk8XU?si=799e38d2744e410c',
        type: 'spotify',
    },
    {
        name: 'Teeth and Tail - Air [TNT001]',
        credits: 'Credits: Mastering',
        date: '2024-03-01',
        id: 'album=3993366517',
        url: 'https://teethandtail.bandcamp.com/album/air-tnt001',
        type: 'bandcamp', isVariousArtists: true,
    },
    {
        name: 'Zero Plussed - Zero Plussed plates',
        credits: 'Credits: Mastering',
        date: '2024-02-10',
        id: 'playlists/1754058492',
        url: 'https://soundcloud.com/commander_zeroplussed/sets/zero-plussed-plates',
        type: 'soundcloud',
    },
    {
        name: 'Lü Ka - Burning Bedroom',
        credits: 'Credits: Mastering',
        date: '2023-12-08',
        id: 'album=4074789862',
        url: 'https://lukaplays.bandcamp.com/album/burning-bedroom',
        type: 'bandcamp',
    },
    {
        name: 'bobby mayo - Funk It Up',
        credits: 'Credits: Mastering',
        date: '2023-12-01',
        id: 'spotify:track:5GBzndCuV6kqYZQm3DY78x',
        url: 'https://open.spotify.com/track/5GBzndCuV6kqYZQm3DY78x?si=c8807b5c19734774',
        type: 'spotify',
    },
    {
        name: 'ACOLDPLACE - ACP 2.1',
        credits: 'Credits: Contributor, Mastering',
        date: '2023-12-01',
        id: 'album=1188484858',
        url: 'https://acoldplace.bandcamp.com/album/acp-21',
        type: 'bandcamp',
        isVariousArtists: true,
    },
    {
        name: 'xtopher - FOR PSY-IENCE',
        credits: 'Credits: Mastering',
        date: '2023-11-29',
        id: 'album=79054116',
        url: 'https://xtopher69.bandcamp.com/album/for-psy-ience-ep',
        type: 'bandcamp',
    },
    {
        name: 'Sound Salad - Lettuce Begin',
        credits: 'Credits: Mastering',
        date: '2023-11-03',
        id: 'playlists/1717724526',
        url: 'https://soundcloud.com/sound-salad-225675916/sets/lettuce-begin-ep',
        type: 'soundcloud',
    },
    {
        name: 'bobby mayo - Dance Attack!',
        credits: 'Credits: Mastering',
        date: '2023-09-29',
        id: 'spotify:track:45qXRq6fkLxcA8i7N7PnDO',
        url: 'https://open.spotify.com/track/45qXRq6fkLxcA8i7N7PnDO?si=2dacfa4254eb4948',
        type: 'spotify',
    },
    {
        name: 'LŪNA - Funk',
        credits: 'Credits: Mastering',
        date: '2023-08-30',
        id: 'tracks/1603868022',
        url: 'https://soundcloud.com/lunanz/funk',
        type: 'soundcloud',
    },
    {
        name: 'Khz Collective - Various Artists: Vol. 2',
        credits: 'Credits: Mastering',
        date: '2023-08-25',
        id: 'album=1182416007',
        url: 'https://khzcollective.bandcamp.com/album/various-artists-vol-2',
        type: 'bandcamp',
        isVariousArtists: true,
    },
    {
        name: 'Sauin x Root Basis - Above the Abject Tide',
        credits: 'Credits: Co-Writing, Co-Mixing, Mastering',
        date: '2023-08-04',
        id: 'album=1916604811',
        url: 'https://teethandtail.bandcamp.com/album/above-the-abject-tide-sauin-x-root-basis',
        type: 'bandcamp',
    },
    {
        name: 'Sauin - Wharariki',
        credits: 'Credits: Mastering',
        date: '2023-02-13',
        id: 'tracks/1214910616',
        url: 'https://soundcloud.com/birkenthot/wharariki',
        type: 'soundcloud',
    },
    // {
    //     id: 'playlists/1546172593',
    //     name: 'Alley - snake oil',
    //     credits: 'Credits: Mastering',
    //     date: '2023-01-01',
    //     type: 'soundcloud'
    // },
    {
        name: 'Sano - Scandi',
        credits: 'Credits: Mastering',
        date: '2022-12-24',
        id: 'track=864865153',
        url: 'https://khzcollective.bandcamp.com/track/scandi',
        type: 'bandcamp',
    },
    {
        name: 'Keith - In a Crockpot',
        credits: 'Credits: Writing, Mixing, Mastering',
        date: '2022-03-04',
        id: 'album=2085826436',
        url: 'https://keithunsheathed.bandcamp.com/album/in-a-crockpot',
        type: 'bandcamp',
    },
    {
        name: 'Grains - Dualism',
        credits: 'Credits: Mastering',
        date: '2021-11-27',
        id: 'album=2595562505',
        url: 'https://grainsnz.bandcamp.com/album/dualism',
        type: 'bandcamp',
    },
    {
        name: 'Sano - Lost Some Of Me',
        credits: 'Credits: Mastering',
        date: '2021-11-23',
        id: 'tracks/1165075729',
        url: 'https://soundcloud.com/sano_dng/lost-some-of-me',
        type: 'soundcloud',
    },
    {
        name: 'PLISSKIN - Turn And Twist',
        credits: 'Credits: Mastering',
        date: '2021-11-21',
        id: 'tracks/1164338554',
        url: 'https://soundcloud.com/mmcrotn/turn-and-twist',
        type: 'soundcloud',
    },
    {
        name: 'DESTROY WITH SCIENCE - A New View',
        credits: 'Credits: Mastering',
        date: '2021-03-12',
        id: 'album=343771191',
        url: 'https://destroywithscience.bandcamp.com/album/a-new-view',
        type: 'bandcamp',
    },
    {
        name: 'Grains - ζ',
        credits: 'Credits: Mastering',
        date: '2020-09-19',
        id: 'album=1891136990',
        url: 'https://grainsnz.bandcamp.com/album/-',
        type: 'bandcamp',
    },
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
function createElementWithText(tag, text, className, url) {
    var element = document.createElement(tag);
    if (url != null) {
        element.href = url;
        element.target = '_blank';
    }
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

    var nameDiv = createElementWithText('a', item.name, 'release-name subtle-underline', item.url);
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