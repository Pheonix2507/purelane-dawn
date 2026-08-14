/*
 * Seeds the development store: metafield and metaobject definitions, products,
 * media, inventory, reviews and collections.
 *
 * Idempotent. productSet upserts on handle, definitions already present are
 * skipped, and media is only uploaded for products that have none, so it is
 * safe to re-run after a partial failure.
 *
 *   node scripts/seed.mjs
 *
 * Reads SHOPIFY_STORE, SHOPIFY_ADMIN_TOKEN and SHOPIFY_API_VERSION from .env.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SINGLES, BOXES, REVIEWS, COLLECTIONS } from './catalogue.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

const env = Object.fromEntries(
  (await readFile(join(HERE, '..', '.env'), 'utf8'))
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const STORE = env.SHOPIFY_STORE;
const TOKEN = env.SHOPIFY_ADMIN_TOKEN;
const VERSION = env.SHOPIFY_API_VERSION || '2026-07';
const ENDPOINT = `https://${STORE}/admin/api/${VERSION}/graphql.json`;

if (!STORE || !TOKEN) {
  console.error('Missing SHOPIFY_STORE or SHOPIFY_ADMIN_TOKEN in .env');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const money = (rupees) => rupees.toFixed(2);
const log = (...a) => console.log(...a);

async function gql(query, variables = {}, attempt = 1) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();

  const throttled = body.errors?.some((e) => e.extensions?.code === 'THROTTLED');
  if (throttled && attempt < 6) {
    await sleep(attempt * 1500);
    return gql(query, variables, attempt + 1);
  }
  if (body.errors) throw new Error(JSON.stringify(body.errors, null, 2));

  // every mutation in here returns userErrors; surface them at the call site
  return body.data;
}

function userErrors(payload, ignore = []) {
  const errs = (payload?.userErrors || []).filter((e) => !ignore.includes(e.code));
  if (errs.length) throw new Error(JSON.stringify(errs, null, 2));
}

/* ------------------------------------------------------------------ *
 * 1. metafield definitions
 * ------------------------------------------------------------------ */

const PRODUCT_DEFS = [
  ['benefit_line', 'Benefit line', 'single_line_text_field'],
  ['badge', 'Card badge', 'single_line_text_field'],
  ['size_label', 'Pack size', 'single_line_text_field'],
  ['bundle_items', 'Bundle contents', 'list.product_reference'],
  // keyed by product handle rather than a list parallel to bundle_items: a
  // positional list cannot express "override the second one only" without blank
  // entries, which the API rejects, and reordering the contents would silently
  // misalign every note
  ['bundle_item_notes', 'Bundle item notes', 'json'],
  ['includes_text', 'Includes copy', 'multi_line_text_field'],
  ['flag', 'Corner flag', 'single_line_text_field'],
  ['save_label', 'Saving label override', 'single_line_text_field'],
  ['tier_features', 'Tier features', 'list.single_line_text_field'],
  ['is_hero', 'Highlight this box', 'boolean'],
];

const M_DEF_CREATE = `
  mutation ($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) {
      createdDefinition { id key }
      userErrors { code message field }
    }
  }`;

async function createDefinitions() {
  let made = 0;
  for (const [key, name, type] of PRODUCT_DEFS) {
    const d = await gql(M_DEF_CREATE, {
      definition: {
        name,
        namespace: 'purelane',
        key,
        type,
        ownerType: 'PRODUCT',
        access: { storefront: 'PUBLIC_READ' },
      },
    });
    const errs = d.metafieldDefinitionCreate.userErrors.filter((e) => e.code !== 'TAKEN');
    if (errs.length) throw new Error(`${key}: ${JSON.stringify(errs)}`);
    if (d.metafieldDefinitionCreate.createdDefinition) made++;
  }

  /* Shopify's own review key, so a real review app can take it over later. A
     rating definition is rejected without an explicit scale.

     reviews.rating_count is refused outright, since that exact namespace and key
     are held for a standard definition this store has no template for. The
     values are still set on each product and Liquid reads metafields whether or
     not a definition exists, so the cards render; it just has no admin UI. */
  const d = await gql(M_DEF_CREATE, {
    definition: {
      name: 'Rating',
      namespace: 'reviews',
      key: 'rating',
      type: 'rating',
      ownerType: 'PRODUCT',
      access: { storefront: 'PUBLIC_READ' },
      validations: [
        { name: 'scale_min', value: '1.0' },
        { name: 'scale_max', value: '5.0' },
      ],
    },
  });
  const errs = d.metafieldDefinitionCreate.userErrors.filter((e) => e.code !== 'TAKEN');
  if (errs.length) log(`  note: reviews.rating not created (${errs[0].message})`);
  else if (d.metafieldDefinitionCreate.createdDefinition) made++;

  log(`  ${made} new definitions`);
}

/* ------------------------------------------------------------------ *
 * 2. review metaobject
 * ------------------------------------------------------------------ */

async function createReviewDefinition() {
  const d = await gql(
    `mutation ($definition: MetaobjectDefinitionCreateInput!) {
      metaobjectDefinitionCreate(definition: $definition) {
        metaobjectDefinition { id type }
        userErrors { code message field }
      }
    }`,
    {
      definition: {
        name: 'Purelane review',
        type: 'purelane_review',
        access: { storefront: 'PUBLIC_READ' },
        fieldDefinitions: [
          { key: 'rating', name: 'Rating', type: 'number_integer' },
          { key: 'title', name: 'Title', type: 'single_line_text_field' },
          { key: 'body', name: 'Body', type: 'multi_line_text_field' },
          { key: 'author', name: 'Author', type: 'single_line_text_field' },
          { key: 'product', name: 'Product', type: 'product_reference' },
          { key: 'verified', name: 'Verified buyer', type: 'boolean' },
        ],
      },
    }
  );
  const errs = d.metaobjectDefinitionCreate.userErrors.filter((e) => e.code !== 'TAKEN');
  if (errs.length) throw new Error(JSON.stringify(errs));
  log(d.metaobjectDefinitionCreate.metaobjectDefinition ? '  created purelane_review' : '  purelane_review already present');
}

/* ------------------------------------------------------------------ *
 * 3. media
 * ------------------------------------------------------------------ */

async function uploadArt(name) {
  const filename = `${name}.png`;
  const buf = await readFile(join(HERE, 'seed-assets', filename));

  const staged = await gql(
    `mutation ($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets { url resourceUrl parameters { name value } }
        userErrors { message field }
      }
    }`,
    { input: [{ filename, mimeType: 'image/png', resource: 'IMAGE', httpMethod: 'POST' }] }
  );
  userErrors(staged.stagedUploadsCreate);

  const target = staged.stagedUploadsCreate.stagedTargets[0];
  const form = new FormData();
  for (const p of target.parameters) form.append(p.name, p.value);
  form.append('file', new Blob([buf], { type: 'image/png' }), filename);

  const up = await fetch(target.url, { method: 'POST', body: form });
  if (!up.ok) throw new Error(`upload failed for ${filename}: ${up.status} ${await up.text()}`);

  return target.resourceUrl;
}

/* ------------------------------------------------------------------ *
 * 4. products
 * ------------------------------------------------------------------ */

/* identifier makes this an upsert on handle, which is what keeps the whole
   script re-runnable after a partial failure */
const PRODUCT_SET = `
  mutation ($identifier: ProductSetIdentifiers, $input: ProductSetInput!) {
    productSet(synchronous: true, identifier: $identifier, input: $input) {
      product { id handle title media(first: 1) { nodes { id } } variants(first: 1) { nodes { id inventoryItem { id } } } }
      userErrors { code message field }
    }
  }`;

async function existingProducts() {
  const map = new Map();
  let cursor = null;
  for (;;) {
    const d = await gql(
      `query ($cursor: String) {
        products(first: 100, after: $cursor) {
          nodes { id handle mediaCount { count } variants(first: 1) { nodes { id inventoryItem { id } } } }
          pageInfo { hasNextPage endCursor }
        }
      }`,
      { cursor }
    );
    for (const n of d.products.nodes) map.set(n.handle, n);
    if (!d.products.pageInfo.hasNextPage) break;
    cursor = d.products.pageInfo.endCursor;
  }
  return map;
}

async function upsertProduct(item, existing) {
  const prior = existing.get(item.handle);
  const hasMedia = (prior?.mediaCount?.count ?? 0) > 0;

  const metafields = [
    item.benefit && { namespace: 'purelane', key: 'benefit_line', type: 'single_line_text_field', value: item.benefit },
    item.badge && { namespace: 'purelane', key: 'badge', type: 'single_line_text_field', value: item.badge },
    item.size && { namespace: 'purelane', key: 'size_label', type: 'single_line_text_field', value: item.size },
    item.flag && { namespace: 'purelane', key: 'flag', type: 'single_line_text_field', value: item.flag },
    item.saveLabel && {
      namespace: 'purelane',
      key: 'save_label',
      type: 'single_line_text_field',
      value: item.saveLabel,
    },
    item.includes && {
      namespace: 'purelane',
      key: 'includes_text',
      type: 'multi_line_text_field',
      value: item.includes,
    },
    item.features && {
      namespace: 'purelane',
      key: 'tier_features',
      type: 'list.single_line_text_field',
      value: JSON.stringify(item.features),
    },
    item.hero && { namespace: 'purelane', key: 'is_hero', type: 'boolean', value: 'true' },
    item.notes && {
      namespace: 'purelane',
      key: 'bundle_item_notes',
      type: 'json',
      value: JSON.stringify(item.notes),
    },
    item.rating && {
      namespace: 'reviews',
      key: 'rating',
      type: 'rating',
      value: JSON.stringify({ scale_min: '1.0', scale_max: '5.0', value: String(item.rating) }),
    },
    item.ratingCount && {
      namespace: 'reviews',
      key: 'rating_count',
      type: 'number_integer',
      value: String(item.ratingCount),
    },
  ].filter(Boolean);

  const input = {
    handle: item.handle,
    title: item.title,
    descriptionHtml: `<p>${item.body}</p>`,
    vendor: 'Purelane',
    productType: item.combo || item.features ? 'Bundle' : 'Homecare',
    status: 'ACTIVE',
    metafields,
    productOptions: [{ name: 'Title', values: [{ name: 'Default Title' }] }],
    variants: [
      {
        optionValues: [{ optionName: 'Title', name: 'Default Title' }],
        price: money(item.price),
        compareAtPrice: item.compare ? money(item.compare) : null,
        // only the one product that has to read as sold out is tracked
        inventoryItem: { tracked: Boolean(item.soldOut) },
        inventoryPolicy: 'DENY',
      },
    ],
  };

  if (item.art && !hasMedia) {
    input.files = [{ originalSource: await uploadArt(item.art), contentType: 'IMAGE', alt: item.title }];
  }

  const d = await gql(PRODUCT_SET, { identifier: { handle: item.handle }, input });
  userErrors(d.productSet);
  return d.productSet.product;
}

/* ------------------------------------------------------------------ *
 * 5. run
 * ------------------------------------------------------------------ */

log(`\nSeeding ${STORE} on API ${VERSION}\n`);

log('metafield definitions');
await createDefinitions();

log('review metaobject');
await createReviewDefinition();

log('products');
const existing = await existingProducts();
const byHandle = new Map();

for (const item of [...SINGLES, ...BOXES]) {
  const p = await upsertProduct(item, existing);
  byHandle.set(item.handle, p);
  log(`  ${item.handle}`);
}

log('bundle contents');
for (const box of BOXES) {
  const ids = box.items.map((h) => byHandle.get(h)?.id).filter(Boolean);
  if (ids.length !== box.items.length) throw new Error(`${box.handle}: unresolved items`);
  const d = await gql(
    `mutation ($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) { userErrors { code message field } }
    }`,
    {
      metafields: [
        {
          ownerId: byHandle.get(box.handle).id,
          namespace: 'purelane',
          key: 'bundle_items',
          type: 'list.product_reference',
          value: JSON.stringify(ids),
        },
      ],
    }
  );
  userErrors(d.metafieldsSet);
  log(`  ${box.handle}: ${ids.length} products`);
}

log('inventory');
// id only: the name field would need read_locations, which this app has no
// reason to hold
const loc = await gql('{ locations(first: 1) { nodes { id } } }');
const locationId = loc.locations.nodes[0].id;
for (const item of SINGLES.filter((s) => s.soldOut)) {
  const p = byHandle.get(item.handle);
  const inventoryItemId = p.variants.nodes[0].inventoryItem.id;

  /* This is a compare-and-swap, so it needs the quantity it expects to be
     replacing. Reading it first also makes a re-run a no-op instead of an
     error. */
  const level = await gql(
    `query ($id: ID!, $loc: ID!) {
      inventoryItem(id: $id) {
        inventoryLevel(locationId: $loc) { quantities(names: ["available"]) { name quantity } }
      }
    }`,
    { id: inventoryItemId, loc: locationId }
  );
  const current = level.inventoryItem?.inventoryLevel?.quantities?.[0]?.quantity ?? 0;
  if (current === 0) {
    log(`  ${item.handle}: already 0 on hand, tracked, deny oversell`);
    continue;
  }

  const d = await gql(
    `mutation ($input: InventorySetQuantitiesInput!) {
      inventorySetQuantities(input: $input) { userErrors { code message field } }
    }`,
    {
      input: {
        name: 'available',
        reason: 'correction',
        quantities: [{ inventoryItemId, locationId, quantity: 0, changeFromQuantity: current }],
      },
    }
  );
  userErrors(d.inventorySetQuantities);
  log(`  ${item.handle}: 0 on hand, tracked, deny oversell`);
}

log('reviews');
for (const [i, r] of REVIEWS.entries()) {
  /* Upsert, not create. metaobjectCreate does not reject a handle already in
     use, it silently appends a suffix, so re-running the seed produced
     review-1-1 alongside review-1 and doubled the rail. */
  const d = await gql(
    `mutation ($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
      metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
        metaobject { id handle }
        userErrors { code message field }
      }
    }`,
    {
      handle: { type: 'purelane_review', handle: `review-${i + 1}` },
      metaobject: {
        /* No publishable capability: entries are always visible, and which ones
           appear is decided by the section's picker rather than by a draft
           status a merchant would have to manage in two places. */
        fields: [
          { key: 'rating', value: String(r.rating) },
          { key: 'title', value: r.title },
          { key: 'body', value: r.body },
          { key: 'author', value: r.author },
          { key: 'verified', value: String(r.verified) },
          ...(byHandle.get(r.product) ? [{ key: 'product', value: byHandle.get(r.product).id }] : []),
        ],
      },
    }
  );
  userErrors(d.metaobjectUpsert);
  log(`  ${d.metaobjectUpsert.metaobject.handle}`);
}

log('collections');
for (const c of COLLECTIONS) {
  const found = await gql(`query ($q: String!) { collections(first: 1, query: $q) { nodes { id } } }`, {
    q: `handle:${c.handle}`,
  });
  let id = found.collections.nodes[0]?.id;
  if (!id) {
    const d = await gql(
      `mutation ($input: CollectionInput!) {
        collectionCreate(input: $input) { collection { id } userErrors { message field } }
      }`,
      { input: { handle: c.handle, title: c.title, sortOrder: 'MANUAL' } }
    );
    userErrors(d.collectionCreate);
    id = d.collectionCreate.collection.id;
  }
  const d = await gql(
    `mutation ($id: ID!, $productIds: [ID!]!) {
      collectionAddProducts(id: $id, productIds: $productIds) { userErrors { message field } }
    }`,
    { id, productIds: c.products.map((h) => byHandle.get(h).id) }
  );
  userErrors(d.collectionAddProducts);
  log(`  ${c.handle}: ${c.products.length} products`);
}

log('publishing to the online store');
const pubs = await gql('{ publications(first: 10, catalogType: APP) { nodes { id name } } }');
const online = pubs.publications.nodes.find((p) => /online store/i.test(p.name));
if (!online) {
  log('  no Online Store publication found, skipping');
} else {
  const ids = [...byHandle.values()].map((p) => p.id);
  for (const id of ids) {
    const d = await gql(
      `mutation ($id: ID!, $input: [PublicationInput!]!) {
        publishablePublish(id: $id, input: $input) { userErrors { message field } }
      }`,
      { id, input: [{ publicationId: online.id }] }
    );
    userErrors(d.publishablePublish);
  }
  log(`  ${ids.length} products published`);
}

log(`\nDone. ${SINGLES.length} products, ${BOXES.length} boxes, ${REVIEWS.length} reviews.\n`);
