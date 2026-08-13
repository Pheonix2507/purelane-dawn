# Build notes

Running record of what the prototype gets wrong for production, what changed on
the way into the theme, and why. Written as the build goes rather than
reconstructed at the end.

Measurements were taken from `docs/reference/purelane-homepage.html`, the file as
supplied.

## The file in one paragraph

A single 1,716-line document: two `<style>` blocks, one `<script>` block, no
external dependencies beyond Outfit and Inter from Google Fonts. Thirteen
sections on a fixed four-scene gradient background with four animated SVG water
layers behind everything. Fourteen product illustrations live as base64 SVG data
URIs inside CSS custom properties.

## What I would flag

### The design is in the second style block, not the first

The prototype ships two full `<style>` blocks. The second is labelled "VERSION 2
- BRAND COLOURS (light)" and overrides most of the first: `--ink` goes from
`#17102b` to `#f4f0fb`, `--paper` and `--surface` swap roles, and the accent
moves from `#f0a03c` to `#b8701c`. The page renders light. Every dark
declaration in block one that block two supersedes is dead weight, and anyone
reading block one alone would build the wrong thing.

Resolved into one stylesheet with the winning value inlined at each property.

### 34 selectors are styled but never used

Verified by extracting every class in the markup and every class in a selector,
then diffing. Two groups:

- **29 product-detail-page selectors** in block two with no matching markup
  anywhere in the file: `.crumb`, `.gal-main`, `.gal-tag`, `.thumb`, `.vopt`,
  `.crow`, `.qty`, `.pin`, `.pinmsg`, `.reassure`, `.acc`, `.vb`, `.ins`,
  `.cmp`, `.rscore`, `.rbar`, `.stickybuy` and their descendants. They belong to
  a different page that shared the stylesheet.
- **five leftovers**: `.d4` (a fourth display size never used), `.rv-d5` (a
  fifth reveal delay, only four are used), `.grain`, and `.voice` / `.voices`,
  which are the styles for a testimonial grid that the review marquee replaced.

None carried over.

`.up` also has no markup, but it is applied by script on scroll, so it stays.

### A navigation link and a progress dot point at nothing

Both the progress rail and the footer link to `#voices`. No element in the
document has that id. The rail's Reviews dot and the footer's Reviews link are
dead. This is the same missing section the orphaned `.voice` styles belonged to.
The live review marquee is `#reviews`, which nothing links to.

Repointed at `#reviews`.

### Three ids are declared twice

`cg`, `wf` and `wf2` each appear twice, because the `.wl-a` and `.wl-b` water
layers carry identical `<defs>`. Invalid HTML, and `url(#cg)` resolves to the
first match in document order, so `.wl-b`'s paths are painted with `.wl-a`'s
gradient. It looks right only because the two definitions happen to be
identical. Shared defs now live once.

### Contrast fails at four points

Measured against WCAG 2.1 AA, 4.5:1 for text under 18.66px bold or 24px regular,
3:1 for larger text and UI components.

| Token / colour | Used on | Measured | Verdict |
|---|---|---|---|
| `--paper-3` `rgba(36,26,61,.56)` | `.kicker` 11px, `.cat .txt p` 11.8px, `.combo .fine` 10.4px, `.railnote` | 3.73:1 | fail |
| `--accent` `#b8701c` | `.stat h5` 10.5px, `.ptag .lbl` 9px, `.card .rate b` 11.5px, `.revhead .agg b` 16px | 3.48:1 | fail |
| `#7a9c1e` | star strings in `.revhead .st`, `.rcard .st` | 2.83:1 | fail |
| `#4f7d10` | `.fcol h5` 11px on the footer gradient | 4.12:1 | fail |

Fixed by the smallest change that reaches the bar in each case, so the palette
still reads as the same design:

- `--paper-3` alpha `.56` to `.64`, giving 4.76:1. `.60` still fails at 4.19:1.
- A second accent token `--pl-accent-ink` `#9e6018` at 4.52:1, for the small
  text only. `--pl-accent` is unchanged at `#b8701c` and still used for display
  type, the progress rail and the carousel dots, all of which sit at the 3:1 bar
  and pass.
- Star glyphs to `#587016`, 5.00:1. They are the only rating indicator on a
  review card, so they are content rather than decoration. Getting a numeric
  rating in alongside them is the better fix and lands with that section.
- `.fcol h5` to `#4a760f`, 4.53:1 on the footer gradient's darkest end.

### Content is invisible without JavaScript

Every `.rv` element is `opacity: 0` at rest and only becomes visible when the
IntersectionObserver callback adds `.in`. There is a fallback for browsers
without IntersectionObserver, but none for script that fails to run at all, so a
blocked or errored bundle leaves a blank page of correctly laid out invisible
boxes.

Inverted: the reveal styles now sit behind a `.pl-reveal-ready` class that script
puts on the root element. No script means no hiding.

### Reduced motion fast-forwards the marquees instead of stopping them

The `prefers-reduced-motion` block sets `animation-duration: .01ms` and
`animation-iteration-count: 1` on `*`. For a fade that is fine. For the review
marquee and the ticker, whose keyframes end at `translateX(-50%)`, it runs the
animation to completion instantly and parks the track half off screen, so a user
who asked for less motion loses half the reviews.

Cancelling the animation outright leaves the track at its starting offset with
everything readable.

### The performance cost is concentrated in one place

Four full-viewport SVG layers sit behind the entire page. Two of them run
`feTurbulence` plus `feDisplacementMap`, one at `baseFrequency="0.0022 0.019"`
with `numOctaves="3"` over a 1800x1100 viewport, composited with
`mix-blend-mode` and transformed on every scroll frame with `will-change:
transform`.

The displacement itself never animates. Only the containers move. So the filter
output is a static image being recomputed for motion that does not depend on it.
Pre-rendering each layer once and keeping the transform gives identical output
without the per-frame filter cost. Detail lands with the background work.

### Product images are not images

All fourteen product illustrations are CSS `background-image` values on empty
`<span role="img" aria-label="...">` elements, sized by `aspect-ratio` and
`height`. Consequences: no `srcset`, no `loading` or `fetchpriority` control, no
CDN transform, nothing for image search, and the hero product, which is the
largest thing above the fold and therefore the LCP candidate, cannot be
preloaded.

On Shopify these become real product media through `image_tag`, which is also
what makes the grid render actual store data rather than decoration.

### The shop grid renders four products as eight cards

`#shop` has eight cards, but only four distinct products: tap cleaner, kitchen
cleaner, copper and brass cleaner, washing machine descaler, each appearing
twice. The first four use the `.pimg` background-image treatment, the second four
inline the same bottle as an SVG element, around 30 lines each. Two techniques
for one job, and the two do not render identically because `.card .shot svg` is
122px tall against `.card .shot .pimg` at 108px on mobile.

### Smaller things

- `.striphint` ("Swipe to see the full shelf") only has a rule inside the
  `max-width: 760px` block, `display: block`. It is a `<p>`, so it is visible at
  every width anyway, including desktop where the shelf does not scroll. The
  intent was clearly mobile-only.
- `.hslide` sets `pointer-events: none` and `.hslide.on` never restores it, so no
  hero slide is interactive. Harmless today because the slides contain only a
  price label, and a trap for whoever adds a link.
- `.hero-prod .pimg` in block two targets nothing. The hero stage uses `.hp`.
- `syncRail` reads `t.offsetTop` directly while `pickScene` accumulates
  `offsetTop` up the `offsetParent` chain for the same kind of element. Rail
  targets are nested inside `.wrap`, so the two functions disagree about where a
  section starts and the rail highlight lags the scene change.
- Both run on every animation frame and read layout each time.
- `.badges` carries `aria-label` on a plain `div` with no role, so the label is
  discarded.
- The ticker is `aria-hidden="true"`, which hides the free shipping and bundle
  pricing offers from assistive technology. It is the only place some of that
  copy appears.

## What changed, and why

### Everything is prefixed `pl-`

Four prototype class names are already styled by Dawn: `.card` in
`component-card.css` and `base.css`, `.price` across four files including
`section-main-product.css`, `.badge` in `section-main-product.css`, and `.dot` in
`component-slider.css`. Dropping the prototype's names in unprefixed would
inherit Dawn's card and price styling.

Prefixing only the four that collide today leaves a trap for the fifth, so all
152 prototype classes are prefixed. Custom properties too.

Two names also changed meaning rather than just gaining a prefix: `.lime` became
`.pl-hl`, because in the light palette that colour is orange, and `.in` became
`.is-in`, which is too generic to introduce into a shared theme.

### The global reset is scoped

The prototype opens with `* { box-sizing: border-box; margin: 0; padding: 0 }`.
A theme cannot carry that; it would reset Dawn's own components. The margin and
list resets our sections depend on are scoped to `.pl-section` and wrapped in
`:where()` so they hold zero specificity and component rules override them
without escalation.

### Container width stays at 1180px

Dawn's page width is a theme setting, default 1200px. The prototype is 1180px
with 18px gutters, and the brief asks for a match at every width, so this is
hardcoded rather than inherited. Worth revisiting if the merchant ever wants the
whole storefront to agree.

## Still open

- Fonts. Outfit and Inter currently resolve by family name only. Both are SIL
  Open Font License, so self-hosting the woff2 subsets in `assets/` and
  preloading beats the prototype's render-blocking Google Fonts link.
- Everything in the five-section scope. Nothing is built yet beyond this
  foundation.
