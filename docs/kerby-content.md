# KerBy on slypork.net

The product area has three destinations. Keep the distinction when adding material:

| Destination | Reader's question | What belongs here |
| --- | --- | --- |
| `/kerby/` — Overview | What is it, and would I use it? | Short introduction, current interface, core benefits, beta contact, updates. |
| `/kerby/learn/` — Learn | How do I use it, and what could I try? | Illustrated explanation and links to practical guides. The original product page's explanatory figures live here. |
| `/kerby/reference/` — Reference | What does this control do? | The wiki/reference layer: searchable topics, stable heading links, precise behaviour. |

Signal flow is a reference article at `/kerby/reference/signal-flow/`, linked prominently
from Reference and from guides where routing explains the result. It is not a fourth
competing top-level destination.

## Guides

The first three guides cover a first pattern, balancing the duck, and layering a sampled
attack. They are starting techniques, not claims of tested presets or ideal settings.
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

Behaviour was checked against plugin tag `v0.7.0`. The dated reference labels record that
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
dry kick stays outside the duck, while bass and wet reverb share it. Reverse and voice
meters/scopes precede the final sum and output clipper. Preserve these distinctions when
simplifying or redrawing the diagram.

## Files and maintenance

- HTML is hand-authored, as elsewhere in this site; the KerBy navigation is repeated in
  every page. Update all copies when changing its destinations.
- `assets/css/kerby.css` is served directly and owns the product area's styles.
  Existing utility styles still come from the committed Tailwind `output.css`.
- `assets/js/kerby.js` owns signup, screenshot enlargement, the ducking illustration
  and reference search. New functions should return early on pages without their controls.
- New nested pages use root-relative assets and navigation. Shared logo hover and boid
  image loading also use root-relative paths so they work at any route depth.
- Keep the existing changelog markers, version marker and signup on `/kerby/`. The plugin
  release scripts own the generated changelog; the reference's review date is maintained
  separately. Do not move the changelog without changing and verifying that integration.
- Keep the Overview concise. New detail normally belongs in Learn or Reference, with a
  contextual link from the Overview if it helps a first-time visitor.

Validate nested links and assets, mobile layout, both colour schemes, keyboard navigation,
search clearing/no-results/deep links, and no-JavaScript fallbacks when changing this area.

## Voice and site consistency

KerBy belongs to the personal site. Use its shared title spacing, neutral half-pixel
rules and `link-underline` hover offset (3px to 6px). Keep the KerBy font, pink accents, hero, beta button, eyebrow labels and boxed Live/Draw labels.
Only the current local navigation destination is underlined. The shared divider
position and colour and the text-link hover behavior still belong to the site.

Lead with the instrument's playable relationship between kick and bass. Rate is the
main expression control and the only knob visible on every tab: a steady pulse can
become a brief stutter or rhythmic variation. Explain Live and MIDI-clip Draw mode,
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

Reserve neutral rules for page/section dividers. The interface snapshot border and
ducking illustration's border, grid and slider track use the pink accent-line colour.
The signal-flow card, search input, signal-map frame/caption rule and individual
processing boxes use that same pink border; they are not page dividers.
The newsletter and beta actions share `kerby-button`; newsletter inputs use the same
ink/panel/accent palette, in both themes.
