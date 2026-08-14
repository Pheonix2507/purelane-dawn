# AI workflow notes

What I delegated, where it let me down, and what I would turn into infrastructure
if this were twenty projects rather than one.

Built with Claude Code as the primary agent, driving the whole loop: reading the
prototype, writing the Liquid, scripting the store, and writing the commits.

## What I delegated

**Reading the prototype, arithmetically rather than by eye.** This produced the
findings I am most confident in, and none of them came from looking at the file:

- Extracted the fourteen base64 SVG illustrations to real files, because you
  cannot upload artwork to Shopify from inside a stylesheet.
- Diffed every class in the markup against every class in a selector. That found
  34 styled selectors with no markup, 29 of them product-detail-page styles that
  had no business in a homepage stylesheet.
- Computed every contrast pair in the palette. Four failures, and the exact alpha
  that fixes the worst of them without visibly changing the design.
- Listed every distinct image aspect ratio. That is what caught the hero using
  the wrong artwork, described below.
- Counted duplicate ids, dead anchors, and per-product art counts against the
  copy that describes them.

**Bulk transformation.** Resolving two conflicting style blocks into one and
prefixing 152 class names is exactly the work an agent should do and a person
should not.

**GraphQL boilerplate.** The seed script is 500 lines of Admin API calls. Writing
that by hand would have been a day; the interesting part was the eight or so
places where the API did not behave as documented.

**Commit messages.** Sixteen commits, each explaining why rather than what. The
history is a deliverable here and it was written as the work happened.

## Where it failed me

Six real failures, in the order they cost me most.

### I verified the layer I wrote to, not the layer the customer sees

After seeding I queried the Admin API: 19 products published, prices set, all
three edge cases correct. Called it verified and moved on.

The shop grid and the combos rail were both rendering onboarding placeholders,
because the **collections** were never published to the Online Store. The API
does not care about publication, so it reported a perfectly healthy store. And
the failure looked plausible: a grid of grey placeholder bottles reads as "images
still uploading", not as "this collection does not exist".

Only fetching the rendered storefront caught it. That is the single most useful
lesson from this build.

### I trusted a harness I had improvised

Without browser tooling I fetched the page and re-rendered it locally. It handed
me two bugs that were not real:

- Every product image appeared broken. My URL rewrite fixed `src` and missed
  `srcset`, which takes precedence, so all of them resolved to `file://`.
- The hero badge rail appeared on the wrong side. I isolated the CSS in a
  standalone page and measured it: `position: absolute`, spanning the right edge
  of the grid, exactly as written.

I was one step from reporting both as defects. When your instrument is
improvised, isolate the finding before believing it.

### A create mutation that silently duplicated

`metaobjectCreate` does not reject a handle already in use. It appends a suffix.
Re-running the seed produced `review-1-1` beside `review-1` and quietly doubled
the review rail, while the script logged eight successful creates. Counting rows
on the store is what found it. It uses `metaobjectUpsert` now.

Two more of the same shape: `productSet` needs an explicit `identifier` argument
or it treats every call as a create and collides on handle, and
`inventorySetQuantities` is a compare-and-swap that requires the quantity it
expects to replace.

### An open item I wrote down and never closed

"Self-host the fonts" sat in my own notes from the first CSS commit onward. For
the entire build after that, every heading and every line of body copy on the
store rendered in `system-ui`, because Dawn cannot supply Outfit or Inter and
nothing else was loading them. Type is named explicitly in the brief.

It survived several review passes because it looked deliberate rather than
broken. A TODO written in prose is not a check.

### I stated a plan before I measured it

I committed, out loud, to pre-rendering the prototype's animated SVG water
filters to raster. Then I measured: 6KB of gzipped SVG against 52KB to 276KB of
WebP depending on resolution. Nine to forty-six times the bytes, competing for
bandwidth with the LCP image.

The outcome was right, the ordering was not. The measurement was cheap and I
could have run it first.

### I front-loaded the wrong work

Six commits of foundation, audit and tooling before a single one of the five
sections that actually get graded. The foundation was a genuine dependency, since
all five sections are translucent panels sitting on that background and the
palette had to be resolved first. But the ordering was mine to choose, and had we
run out of time I would have had beautiful infrastructure and nothing to show.

## What I would systematise for twenty of these

### 1. A render-layer assertion harness

The highest-value thing on this list. Fetch the rendered storefront past the
password gate after every deploy and assert on the DOM, not on the API:

- N product cards, exactly one disabled, exactly one placeholder tile
- zero occurrences of onboarding markup
- prices match the expected currency pattern
- every `img` carries `srcset` and a `loading` attribute
- every declared font family appears in a `@font-face` on the page

Those five checks would have caught both of my worst misses, the collections and
the fonts, in seconds rather than days.

### 2. The prototype audit as a fixed first pass

Scripted, always, before any code: extract assets, diff selectors against
markup, compute every contrast pair, enumerate image aspect ratios, count
duplicate ids and dead anchors. It takes twenty minutes and it produced every
finding in the build notes I would actually defend.

### 3. Seed scripts, never clicking in admin

Non-negotiable at volume, and metaobject definitions cannot be created any other
way. The hard part is idempotency, so the default assumption should be that no
create mutation is safe to re-run until proven otherwise.

### 4. A standing edge-case fixture set

Sold out, no media, punishing title, single variant, many variants, missing
metafield, zero price. Seeded into every store as a matter of course rather than
because a brief asked for three of them. Most card bugs are one of these.

### 5. Golden screenshots per breakpoint, diffed

I never had this, and it is the gap that made the visual pass unreliable. For
pixel-accuracy work against a supplied design, a stored reference render per
breakpoint with a diff threshold is the whole game.

### 6. Open items become failing checks

Anything I would write as "still open" becomes an assertion that fails until it
is done. The font gap is the entire argument for this.

### 7. Decide the design-versus-code rule once

The prototype contradicted itself in three places: per-unit prices rounded
inconsistently, the hero product kept a shadow the light palette lightened
everywhere else, and a combo claiming five products pictures three. Settling on
"reproduce what renders, document the inconsistency, never silently correct it"
once meant I did not re-litigate it three times.

## Honest summary

The agent was strongest where the work was mechanical or arithmetic: bulk
transformation, API boilerplate, and auditing by measurement rather than reading.
It was weakest exactly where I was weakest, because it inherited my assumptions.
Every failure above is a verification failure, not a generation failure. Nothing
it wrote was wrong in a way I could not have caught; the things that got through
got through because I checked the wrong layer, or trusted an instrument I had not
validated, or wrote a reminder instead of a test.

That is the part worth systematising. The code generation is already fast enough.
