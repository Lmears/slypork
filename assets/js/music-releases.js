/* Discography data for /music. Rendered by releases.js into #releases.
 *
 * To add a release: add an entry to the array below and drop a square cover
 * into assets/images/releases/ (600px webp; see the other files there). Order
 * within the array does not matter - the renderer groups by `project` in the
 * order the projects appear in PROJECT_ORDER, then sorts newest first by
 * `date`.
 *
 * Fields:
 *   project  - must match a name in PROJECT_ORDER; groups the release.
 *   title    - the release title as it should read on the page.
 *   artist   - the credit, when it differs from the project name (collabs).
 *   type     - 'Album' | 'EP' | 'Single' | 'Compilation'. Shown in the meta line.
 *   label    - releasing label, or omitted for self-released.
 *   date     - ISO release date; used for sorting and for the displayed year.
 *   url      - the release page.
 *   art      - filename within assets/images/releases/.
 *   tracks   - only for compilations: this project's own tracks on the release,
 *              each { title, url }. Listed under the compilation so a visitor
 *              can tell which of a various-artists record is actually mine.
 */

/* Release projects, in the order their groups appear on the page. DJ PRETENCE
   is deliberately absent: it was a DJ alias for sets of other people's music,
   never a release project, and its direction has since been folded into Keith.
   It was retired from the page entirely in Sep 2026. */
export const PROJECT_ORDER = ['Keith', 'Root Basis'];

export const releases = [
    {
        project: 'Keith',
        title: 'A Year from the Abyss',
        type: 'Compilation',
        label: 'Abyssal Soundworks',
        date: '2026-09-21',
        url: 'https://abyssalsoundworks.bandcamp.com/album/a-year-from-the-abyss',
        art: 'a-year-from-the-abyss.webp',
        tracks: [
            {
                title: 'Internal Dilemma',
                url: 'https://abyssalsoundworks.bandcamp.com/track/keith-internal-dilemma',
            },
        ],
    },
    {
        project: 'Keith',
        title: 'Ghost Train',
        type: 'Album',
        label: 'Abyssal Soundworks',
        date: '2026-06-24',
        url: 'https://abyssalsoundworks.bandcamp.com/album/ghost-train',
        art: 'ghost-train.webp',
    },
    {
        project: 'Keith',
        title: 'Out of the Crockpot and Into the Frying Pan',
        type: 'Album',
        label: 'Metacortex Records',
        date: '2025-01-21',
        url: 'https://metacortexrecords.bandcamp.com/album/out-of-the-crockpot-and-into-the-frying-pan',
        art: 'out-of-the-crockpot.webp',
    },
    {
        project: 'Keith',
        title: 'Cosmic Enigma',
        type: 'Compilation',
        label: 'Khnum Crew',
        date: '2024-05-10',
        url: 'https://khnumcrew.bandcamp.com/album/v-a-cosmic-enigma',
        art: 'cosmic-enigma.webp',
        tracks: [
            {
                title: "This Life Thing's Pretty Cool [220]",
                artist: 'Saturnin x Keith',
                url: 'https://khnumcrew.bandcamp.com/track/this-life-things-pretty-cool-220',
            },
        ],
    },
    {
        project: 'Keith',
        title: 'WE ARE HERE 001',
        type: 'Compilation',
        label: 'Khnum Crew',
        date: '2023-08-31',
        url: 'https://khnumcrew.bandcamp.com/album/v-a-we-are-here-001-free-download',
        art: 'we-are-here-001.webp',
        tracks: [
            {
                title: 'What Lurks Beneath the Surface',
                url: 'https://khnumcrew.bandcamp.com/track/what-lurkes-beneath-the-surface-200',
            },
        ],
    },
    {
        project: 'Keith',
        title: 'ATMOS — A Tribute To Goa Gil',
        type: 'Compilation',
        label: 'The Endless Knot',
        date: '2023-06-07',
        url: 'https://theendlessknot.bandcamp.com/album/atmos-a-tribute-to-goa-gil',
        art: 'atmos-goa-gil.webp',
        tracks: [
            {
                title: 'Integrity Jeapordized',
                url: 'https://theendlessknot.bandcamp.com/track/keith-integrity-jeapordized',
            },
            {
                title: 'Peace and Suffering',
                url: 'https://theendlessknot.bandcamp.com/track/keith-peace-and-suffering',
            },
        ],
    },
    {
        project: 'Keith',
        title: 'TRIBE 002',
        type: 'Compilation',
        label: 'The Endless Knot',
        date: '2022-11-30',
        url: 'https://theendlessknot.bandcamp.com/album/tribe-002',
        art: 'tribe-002.webp',
        tracks: [
            {
                title: 'Tangling of the Mortal Coil',
                url: 'https://theendlessknot.bandcamp.com/track/keith-tangling-of-the-mortal-coil',
            },
        ],
    },
    {
        project: 'Keith',
        title: 'In a Crockpot',
        type: 'Album',
        date: '2022-03-04',
        url: 'https://keithunsheathed.bandcamp.com/album/in-a-crockpot',
        art: 'in-a-crockpot.webp',
    },
    {
        project: 'Root Basis',
        title: 'Above the Abject Tide',
        artist: 'Sauin & Root Basis',
        type: 'Album',
        label: 'Teeth and Tail',
        date: '2023-08-04',
        url: 'https://teethandtail.bandcamp.com/album/above-the-abject-tide',
        art: 'above-the-abject-tide.webp',
    },
];
