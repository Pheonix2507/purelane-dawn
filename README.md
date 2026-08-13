# Purelane on Dawn

Production Shopify sections built from `purelane-homepage.html`, a single-file
design prototype for a plant-based homecare brand. Built on stock
[Dawn](https://github.com/Shopify/dawn) 16.0.0 with no premium theme underneath.

Troopod AI Product Engineer assignment.

## Scope

Five sections, in build order:

| # | Section | Prototype anchor | Status |
|---|---------|------------------|--------|
| 1 | Hero | `section.hero` | not started |
| 2 | Shop / product grid | `#shop` | not started |
| 3 | Best-selling combos | `#combos` | not started |
| 4 | Bundles | `#bundles` | not started |
| 5 | Reviews rail | `#reviews` | not started |

Everything else in the prototype is out of scope unless the five above are done.

## Design intent

The prototype ships two `<style>` blocks. The second, labelled "VERSION 2 -
BRAND COLOURS (light)", overrides the first. The light palette is therefore the
design, and the dark declarations in block one are dead. See `docs/build-notes.md`
for the full list of what the original file gets wrong for production and what
changed on the way in.

## Local development

Requires a Shopify Partner account and a development store on stock Dawn.

```sh
npm install -g @shopify/cli
shopify theme dev --store <your-store>.myshopify.com
```

`shopify theme dev` serves the local theme against real store data with hot
reload. It never writes to the store.

## Layout

Theme conventions are Dawn's. Work specific to this build is prefixed
`purelane-`:

```
sections/purelane-*.liquid    section per scope item, each with its own schema
snippets/purelane-*.liquid    shared card and figure partials
assets/purelane-*.css         section styles
docs/                         build notes, metafield definitions, seed data
```

## Licence

Dawn is MIT, Shopify. See `LICENSE.md`.
