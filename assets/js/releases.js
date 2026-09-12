/* Renders the discography on /music from the data in music-releases.js into
 * #releaseList. Built with DOM calls rather than innerHTML so nothing in the
 * data file can inject markup, and so the page's CSP stays as strict as it is.
 *
 * The section is hidden until this runs (see #releases[hidden]) so a visitor
 * without modules enabled gets the rest of the page cleanly rather than an
 * empty "Releases:" heading. */

import { releases, PROJECT_ORDER } from './music-releases.js';

const ART_PATH = '../assets/images/releases/';

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
}

function externalLink(href, className) {
    const a = el('a', className);
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    return a;
}

/* "Album · Metacortex Records · 2025", skipping whatever is absent. */
function metaLine(release) {
    return [release.type, release.label, release.date.slice(0, 4)]
        .filter(Boolean)
        .join(' · ');
}

function renderRelease(release) {
    const card = el('article', 'release');

    /* Art and title share one anchor, the same way a project card wraps its
       logo and name, so hovering either lights up both. The meta line and
       track list stay outside it - the track links are anchors of their own. */
    const link = externalLink(release.url, 'release-link hover-effect subtle-underline');
    const img = el('img', 'release-art');
    img.src = ART_PATH + release.art;
    img.alt = `${release.title} cover art`;
    img.loading = 'lazy';
    img.width = 600;
    img.height = 600;
    link.appendChild(img);
    link.appendChild(el('span', 'release-title', release.title));
    card.appendChild(link);

    const body = el('div', 'release-body');

    /* Only worth showing when it is not just the project name again - it is
       there to credit collaborators. */
    if (release.artist) body.appendChild(el('div', 'release-artist', release.artist));

    body.appendChild(el('div', 'release-meta', metaLine(release)));

    if (release.tracks && release.tracks.length) {
        const list = el('ul', 'release-tracks');
        for (const track of release.tracks) {
            const item = el('li');
            const link = externalLink(track.url, 'thin-underline');
            link.textContent = track.title;
            item.appendChild(link);
            if (track.artist) item.appendChild(el('span', 'release-track-artist', ` ${track.artist}`));
            list.appendChild(item);
        }
        body.appendChild(list);
    }

    card.appendChild(body);
    return card;
}

function render() {
    const list = document.getElementById('releaseList');
    if (!list) return;

    const byProject = new Map(PROJECT_ORDER.map((name) => [name, []]));
    for (const release of releases) {
        const group = byProject.get(release.project);
        /* A release naming a project that is not in PROJECT_ORDER would
           otherwise vanish from the page with no indication of why. */
        if (!group) {
            console.warn(`Release "${release.title}" names unknown project "${release.project}"`);
            continue;
        }
        group.push(release);
    }

    const fragment = document.createDocumentFragment();
    for (const [project, group] of byProject) {
        if (!group.length) continue;
        group.sort((a, b) => b.date.localeCompare(a.date));

        const section = el('div', 'release-group');
        section.appendChild(el('h3', 'release-group-title', project));

        const grid = el('div', 'release-grid');
        for (const release of group) grid.appendChild(renderRelease(release));
        section.appendChild(grid);

        fragment.appendChild(section);
    }

    list.appendChild(fragment);
    document.getElementById('releases').hidden = false;
}

render();
