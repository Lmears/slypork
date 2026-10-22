# KerBy on slypork.net

The product area has three destinations. Keep the distinction when adding material:

| Destination | Reader's question | What belongs here |
| --- | --- | --- |
| `/kerby/` — Overview | What is it, and would I use it? | Short introduction, current interface, core benefits, requirements, launch sign-up, updates. |
| `/kerby/learn/` — Learn | How do I use it, and what could I try? | Illustrated explanation and links to practical guides. The original product page's explanatory figures live here. |
| `/kerby/reference/` — Reference | What does this control do? | The wiki/reference layer: searchable topics, stable heading links, precise behaviour. |

Signal flow is a reference article at `/kerby/reference/signal-flow/`, linked prominently
from Reference and from guides where routing explains the result. It is not a fourth
competing top-level destination.

## Guides

The guides cover a first pattern, balancing the duck, layering a sampled attack, and
ducking other tracks to the kick with DucKy following KerBy (KerBy's MIDI out, for other
duckers, is a callout there). They are starting techniques, not claims
of tested presets or ideal settings.
Keep each new guide about one audible result. Include a starting state, actions, what to
listen for, and links to the relevant reference anchors. Specific controls are explained
once in Reference; guides explain why to reach for them in this situation.

Sound examples should eventually sit beside the step they illustrate, with explicit play
controls. Label source preset, build and any external processing. Add real audio when it
exists; do not imply the illustrative SVGs are recordings or an in-browser plugin.

## Reference and signal map

This is a static, repository-authored wiki, matching the rest of the website. There is no
account system or visitor editing. Stable topic IDs allow guides and support replies to
link directly to an answer. Search progressively filters complete HTML sections; every
topic remains readable without JavaScript.

Behaviour was last checked against plugin tag `v0.9.0`. The dated reference labels record that
review, rather than automatically claiming compatibility with every new build. On a
behaviour change, update the affected topic, related guide and signal map together.

Primary sources in the sibling KerBy repository:

| Content | Implementation and design record |
| --- | --- |
| Modes, Rate, Length, launch and reverse | `Source/PluginProcessor.cpp`, `Source/dsp/PulseVoice.cpp`, `docs/design-notes/pulse-voice.md` |
| Control names, placement and gestures | `Source/ui/VoiceRowComponent.cpp`, `Source/PluginEditor.cpp` |
| Shape editing | `Source/ui/EnvelopeEditorComponent.cpp`, `docs/design-notes/envelopes.md` |
| Wave samples and bypass behaviour | `docs/design-notes/sample-source.md`, `Source/dsp/SampleSource.cpp` |
| Click layer | `docs/design-notes/click-layer.md`, `PulseVoice::renderChunk` |
| Step row | `docs/design-notes/step-mask.md`, `Source/dsp/StepPattern.h` |
| Signal order, reverb, duck and output | `PulseVoice::renderChunk`, `KerByAudioProcessor::processBlock` |

The signal map distinguishes audio (solid) from control (dashed). FM acts at the source
read; it is not an insert after the combined kick. Tone acts separately before the main
and Click envelopes. Crush processes their sum. The Click HP follows its envelope. The
duck affects the bass and kick reverb. Reverse and voice
meters/scopes precede the final sum and output clipper. Preserve these distinctions when
simplifying or redrawing the diagram.

## Files and maintenance

- HTML is hand-authored, as elsewhere in this site; the KerBy navigation is repeated in
  every page. Update all copies when changing its destinations.
- `assets/css/kerby.css` is served directly and owns the product area's styles.
  Existing utility styles still come from the committed Tailwind `output.css`.
- `assets/js/kerby.js` owns signup, changelog loading and reference search.
  New functions should return early on pages without their controls.
- Signup uses a native HTML POST to Buttondown, including with JavaScript enabled.
  Keep the hero button's synchronous email-field focus for mobile. Do not intercept
  submission with `fetch`: Buttondown may return a validation or CAPTCHA page that
  the visitor must see. Its embed endpoint is not a JSON success API; HTTP 400 was
  previously observed for a pending-confirmation page, but treating every response
  below 500 as success also hides genuine rejections and rate limits. Follow
  [Buttondown's embed instructions](https://docs.buttondown.com/building-your-subscriber-base).
- Links to `/kerby/#notifyForm`, including the check-inbox page's retry link, scroll
  to the form and focus its email field on arrival and history restoration. Mobile
  browsers may require a fresh tap to open the keyboard after crossing pages.
- After accepted signup, Buttondown's newsletter setting `subscription_redirect_url`
  must point to `https://slypork.net/kerby/check-inbox/`. Publish that static page before
  enabling the redirect. It explains email confirmation without claiming activation,
  works without JavaScript, and is excluded from search indexing. Keep
  `subscription_confirmation_redirect_url` separate: that is for the later email click.
  The Overview's `form-action` also permits `'self'` so Chromium allows the return redirect.
  See [Buttondown's redirect settings](https://docs.buttondown.com/api-newsletters-update).
- Every image KerBy draws itself is generated, not hand-made: the Overview's full captures
  (`KerBy_*mode.png`, `KerBy_matrix_*`, `KerBy_duck_*`), every `kerby-learn/kerby-*` crop and
  strip, the `thumb-rates`, `thumb-duck` and `thumb-click` thumbnails, and Reference's PS5
  controller window. `scripts/site-images.py` in the plugin repo (KerBy folder) holds each as a
  recipe over the plugin's offscreen screenshot mode, and every release runs it against the
  build it ships, writing only the images whose pixels changed. To refresh them by hand, or to
  check a UI change, run `python3 scripts/site-images.py` there with `KERBY_SITE_ROOT` set to
  this repo. A new KerBy image gets a recipe in that script rather than a one-off crop.
  The third-party screenshots (`live-*`, `shaperbox-*`, `thumb-midi`) are made by hand.
- DucKy (`/ducky/`) is one page in KerBy's layout, recoloured by the `.ducky` class in
  `kerby.css`. Its full captures (`DucKy_*mode.png`) are the KerBy-trigger pair
  (`DucKy_editor_kerby*.png`, KerBy being what sets DucKy apart) of the 2x screenshots DucKy's
  `ducky_editor_tests` writes to `build-dev/screenshots/` (`DucKy_editor*.png`, one per trigger,
  with a KerBy running so its cell is solid); `ducky/ducky-header-kerby-*` is cropped from the
  KerBy one with KerBy's highlight recipe (the preset button and logo faded), and
  `ducky/ducky-mode-*` crops the Tempo/MIDI/KerBy pill from each as KerBy's Live/Draw selector is
  cropped. There's no site-images recipe for DucKy yet. Its hero's "Get notified at launch" goes to
  KerBy's signup form (one list, one launch day).
- OrBy has no page yet, only a card on `/plugins/`, hidden until KerBy is out (Companion's plan
  says when). The card isn't a link; its "Get updates" goes to KerBy's signup. `OrBy_*mode.webp`
  are OrBy's First Light editor screenshots, from `ORBY_EDITOR_SHOTS=<dir>
  build-dev/tests/orby_editor_tests` in slypork-plugins' `OrBy/`, scaled to 1800 px wide and
  converted with `cwebp -q 88` (as PNGs they're over 1 MB).
- Captures run from a fresh install's state on Init with the scale on A Minor; the step row and
  keyboard are hidden, and the scopes show one held bar. The Click crop uses the promo click,
  the sampled Wave crop the bass source sample (both in the script's samples folder), and the
  Glitch crop the More tab with Glitch at 50%, where the scope shows three clear rolls.
- On the Overview, Learn tour and Reference, tab crops fill the column rather than serving at
  half size, which would leave dead space on their right. The Overview's full captures keep one
  interface scale. Header and bottom-bar strips and the Live/Draw selector crops serve at half
  size, the selector with CSS clipping away the surrounding panel background.
  `kerby-step-toggle` serves at 175px wide so the active, filled button stays at native size.
- The Learn tour's Duck and Glitch figures include the voice's scope on desktop and use
  tab-only crops at 767px and below.
- Highlighted crops (`header-live`, `header-scale`, `bottom-bar`, `bass-length`, `kick-key`,
  `step-toggle`) leave the control untouched and fade everything else to 30% of its contrast
  against the panel background.
- New nested pages use root-relative assets and navigation. Shared logo hover and boid
  image loading also use root-relative paths so they work at any route depth.
- Keep the version markers and signup on `/kerby/`, and the changelog container on
  `/kerby/whats-new/`. The plugin release scripts own the generated changelog and check for that
  container there; the reference's review date is maintained separately. Do not move the
  changelog without changing and verifying that integration.
- Keep the Overview concise. New detail normally belongs in Learn or Reference, with a
  contextual link from the Overview if it helps a first-time visitor.
- Every KerBy page carries Open Graph and `twitter:card` tags so links shared in Discord,
  Instagram and video descriptions show a preview. `og:description` repeats the page's meta
  description; change both together. Describe audible results in preview text without
  assuming readers know interface labels such as Rate. A new page needs its own block
  with its own `og:url`.
- The KerBy pages' CSP allows `media-src 'self'` for self-hosted audio and video, and
  `https://www.youtube-nocookie.com` in `frame-src` for embedded videos. Use the nocookie
  domain for YouTube embeds. A plain link to Gumroad needs no CSP change; Gumroad's overlay
  script would need `script-src` and `frame-src` entries, which is why it isn't allowed.
  `npm run check:security` checks media and iframe sources against the policy.
- System requirements live on `/kerby/install/#requirements`, with a short copy in the
  Overview hero and footer. They come from the plugin repository: `CMAKE_OSX_DEPLOYMENT_TARGET`
  and the universal build in `CMakeLists.txt`, the x64 Windows job, and JUCE's own minimum
  Windows version. Update all three places together.

Validate nested links and assets, mobile layout, both colour schemes, keyboard navigation,
search clearing/no-results/deep links, and no-JavaScript fallbacks when changing this area.

## Say only what gets the reader there

Every sentence must help the reader do the thing or understand the result. Test it by
deleting it: if they can still follow the steps and know what they got, leave it out.
Don't explain the options they won't pick, how a step works underneath, or what a
screenshot already shows. Point at the right choice instead.

Decided 2026-10-13, from the MIDI-out guide. A draft explained that Live's Pre FX and Post
FX carry the notes you play, then that Post FX looks like output but isn't. Both were cut
for "KerBy, the third option under Pre FX and Post FX": the highlighted screenshot does
the rest, and readers still duck their mix. Likewise, where any tool of a kind will do,
name the kind and give a few examples together; leading with one product reads as a promo.

## Voice and site consistency

KerBy belongs to the personal site. Use its shared title spacing, neutral half-pixel
rules and `link-underline` hover offset (3px to 6px). Keep the KerBy font, pink accents, hero, call-to-action button, eyebrow labels and boxed Live/Draw labels.
Only the current local navigation destination is underlined. The shared divider
position and colour and the text-link hover behavior still belong to the site.

Lead with the instrument's playable relationship between kick and bass. In Live mode,
KerBy divides a held MIDI note or legato phrase into repeating kick and bass pulses.
Rate controls how often each voice pulses; it is the main expression control and the
only knob visible on every tab. Explain this core behaviour before examples such as
stutters or rhythmic variations. Explain Live and MIDI-clip Draw mode,
and synthesis and samples, without promising a particular genre or limiting either voice.
The developer's four-to-the-floor starting point and the user testing that prompted
Draw mode belong in Learn as personal context, not as the overview's main use case. Ducking alone is not the novelty.

Teach sound shaping with kick and bass in context; solo is a brief diagnostic aid.
Duck is on by default. A short bass hit disappearing under the duck depends on its
alignment with the kick; distinguish equal rates from later hits at faster rates.
Reverb is optional, especially useful as a low techno rumble with the bass muted.
Do not make adding it a standard finishing step or recommend combining bass and
rumble without a specific musical reason.

Each MIDI note triggers both voices, not separately addressed kick and bass hits.
Draw disables both Rate divisions. Notes must last long enough for bass to pass the
initial duck. Faster bass divisions need held or legato MIDI notes with Rate enabled;
short MIDI hits do not leave time for later bass pulses. Check note duration as well
as the internal Length and Duck controls when explaining missing bass.

Every KerBy page uses the same compact row above the neutral divider: small KerBy
brand at left, Overview/Learn/Reference at right. Keep the bottom padding short;
this row does not need the site's large page-title spacing. The overview repeats
the brand at hero scale; articles use their own title below the divider. Callouts
use the pink panel and accent side rule.
When teaching from Init, describe its existing rates instead of asking readers to
set those same defaults again.

Navigation marks the current section with pink text and a matching stationary
underline offset by .5rem. Current-page markers are non-link spans; within an
article the current-section link still leads back to its index. Guide lists use
uppercase pink category labels and plain titles, underlined on hover only. Keep
whole-row cards free of permanent underlines; diagonal arrows are for external
destinations, not internal navigation. Ordinary underlined text links retain the
site's hover offset behavior.

Reserve neutral rules for page/section dividers. Interface snapshot borders use the
pink accent-line colour. The duck sections use the existing light/dark bass Duck tab
snapshots, with no interactive illustration or recovery slider.
The signal-flow card, search input, signal-map frame/caption rule and individual
processing boxes use that same pink border; they are not page dividers.
The newsletter and hero actions share `kerby-button`; newsletter inputs use the same
ink/panel/accent palette, in both themes.
