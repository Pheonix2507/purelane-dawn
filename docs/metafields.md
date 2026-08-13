# Metafield and metaobject definitions

Everything the five sections render comes from the platform. This is the list of
definitions created on the development store, why each one exists, and what was
deliberately left out because it can be derived or is already native.

Created by `scripts/seed.mjs` against the GraphQL Admin API, so the store can be
rebuilt from scratch rather than clicked together.

## Native first

Nothing below duplicates something Shopify already has. These come straight off
the product and needed no definition:

title, handle, description, `price`, `compare_at_price`, `featured_media`,
`media`, `available`, `variants`, `selected_or_first_available_variant`,
collections, product type, vendor, tags.

## Reused standard definitions

| Namespace and key | Type | Why |
|---|---|---|
| `reviews.rating` | `rating` | Shopify's standard rating key, the one Judge.me, Loox and Shopify's own review apps write to. |
| `reviews.rating_count` | `number_integer` | Same. |

Using the standard namespace rather than inventing `purelane.rating` means a real
review app can be installed later and the product cards start showing genuine
ratings with no template change. Seeded by hand here because the store has no
review app.

## Product metafields, namespace `purelane`

| Key | Type | Renders as | Example |
|---|---|---|---|
| `benefit_line` | `single_line_text_field` | the caption under a product inside a combo stack | "Cuts grease instantly" |
| `badge` | `single_line_text_field` | corner pill on a shop card | "Best seller", "Top rated", "New" |
| `size_label` | `single_line_text_field` | pack size on the card | "500 ML", "8 TABLETS" |

`benefit_line` sits on the product rather than on the combo, because the same
sentence is reused wherever that product appears. Where a combo needs to say
something different about a component, `bundle_item_notes` below overrides it.

## Bundle and combo products, namespace `purelane`

Bundles and combos are products, not metaobjects, because they have a price and a
buy button. That is what makes the price on a combo card real store data rather
than a number typed into Liquid.

| Key | Type | Renders as |
|---|---|---|
| `bundle_items` | `list.product_reference` | the products in the box, and by its length the "3 products" count |
| `bundle_item_notes` | `list.single_line_text_field` | positional override of each component's `benefit_line` |
| `includes_text` | `multi_line_text_field` | the "Includes: ..." paragraph |
| `flag` | `single_line_text_field` | the corner ribbon: "Most popular", "Best value" |
| `tier_features` | `list.single_line_text_field` | the ticked list on a bundle tier |
| `is_hero` | `boolean` | the highlighted card treatment, `.hero-combo` and `.tier.best` in the prototype |

### Why the stack shows three when the count says five

Counted this in the prototype before designing the field. The combo rail
disagrees with itself on purpose:

| Combo | Count shown | Pieces of art | Products named in copy |
|---|---|---|---|
| Kitchen essentials | 3 products | 3 | 3 |
| Laundry care bundle | 3 products | 2 plus 1 placeholder | 3 |
| Complete home bundle | 5 products | 3 | 5 |
| Bathroom deep clean | 3 products | 3 | 3 |
| Hard water solution kit | 2 products | 2 | 2 |

So the stack is a display subset capped at three, not the contents. `bundle_items`
holds the real list, the count comes from its length, and the stack renders the
first three with the cap as a section setting.

The laundry bundle's third slot is a dashed placeholder tile with a leaf icon,
because fabric conditioner has no bottle illustration in the prototype. That
means the design already contains its own missing-image state, so it becomes the
fallback for any product without media, and the seeded no-image product is the
fabric conditioner rather than something arbitrary.

## Metaobject: `purelane_review`

Reviews have no native home on Shopify, so they are a metaobject definition.

| Field | Type |
|---|---|
| `rating` | `number_integer`, 1 to 5 |
| `title` | `single_line_text_field` |
| `body` | `multi_line_text_field` |
| `author` | `single_line_text_field` |
| `product` | `product_reference`, optional |
| `verified` | `boolean` |

`product` powers the "· Laundry detergent" suffix on a review card and keeps the
review joined to the thing it is about, so the same entries can feed a product
page later.

Chosen over section blocks because a review is content reused across templates,
and blocks are capped and template-scoped: the same review could not appear in
the homepage rail and on a product page without being typed twice.

## Derived, not stored

Anything arithmetic is computed in Liquid. Storing it would let it drift from the
price it is supposed to describe:

| Shown in the prototype | Derived from |
|---|---|
| "Save ₹398", "You save ₹398" | `compare_at_price` minus `price` |
| "33% off" | the same, as a percentage |
| "Flat ₹166 per product" | `price` divided by `bundle_items.size` |
| "3 products" | `bundle_items.size` |
| sold out state | `product.available` |

## Section settings, not metafields

Copy that is identical on every card belongs to the section, so a merchant edits
it once rather than on twenty products: the "Inclusive of all taxes · COD
available" fine print, the swipe cue, the rail note under the combos, and every
heading and kicker.

The review rail's aggregate figures, "4.8 from 8,000+ reviews" and "Loved by 12
lakh+ homes", are also section settings. They are editorial claims about the whole
shop and cannot be computed from ten seeded entries. If a review app is installed
later these should move to its shop-level metafield.
