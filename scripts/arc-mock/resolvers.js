/*
 * ARC mock — resolvers for the Catalog Service (CS) and Core GraphQL
 * operations the Commerce drop-ins issue. State (carts, customer, orders)
 * lives in the browser's localStorage so each viewer gets their own sandbox.
 */
import {
  PRODUCTS, CATEGORIES, CURRENCY, findProduct, findCategory,
} from './catalog.js';

/* ---------------- helpers ---------------- */
const r2 = (n) => Math.round(n * 100) / 100;
const money = (v) => ({ value: r2(v), currency: CURRENCY });
const ORIGIN = (typeof window !== 'undefined' && window.location?.origin) || '';
const img = (name) => `${ORIGIN}/images/arc/${name}.svg`;
const b64 = (s) => btoa(s);
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const TAX_RATE = 0.0825;
const FREE_SHIP_OVER = 100;

const store = {
  get(key, fallback) {
    try { const v = window.localStorage.getItem(`arc-mock:${key}`); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  set(key, v) { try { window.localStorage.setItem(`arc-mock:${key}`, JSON.stringify(v)); } catch { /* ignore */ } },
};

const COUNTRIES = [
  {
    id: 'US',
    name: 'United States',
    regions: [['AL', 'Alabama', 1], ['AZ', 'Arizona', 4], ['CA', 'California', 12], ['CO', 'Colorado', 13], ['FL', 'Florida', 18], ['GA', 'Georgia', 19], ['IL', 'Illinois', 23], ['MA', 'Massachusetts', 32], ['MI', 'Michigan', 33], ['NY', 'New York', 43], ['NC', 'North Carolina', 44], ['OH', 'Ohio', 47], ['PA', 'Pennsylvania', 51], ['TX', 'Texas', 57], ['WA', 'Washington', 62]],
  },
  { id: 'CA', name: 'Canada', regions: [['ON', 'Ontario', 74], ['QC', 'Quebec', 76], ['BC', 'British Columbia', 67]] },
  { id: 'GB', name: 'United Kingdom', regions: [] },
  { id: 'IN', name: 'India', regions: [] },
];
const countryLabel = (code) => COUNTRIES.find((c) => c.id === code)?.name || code;
function regionFor(countryCode, region, regionId) {
  const c = COUNTRIES.find((x) => x.id === countryCode);
  const list = c?.regions || [];
  const hit = list.find(([code, name, id]) => id === Number(regionId) || code === region || name === region
    || (region && typeof region === 'object' && (code === region.region_code || id === Number(region.region_id))));
  if (hit) return { region_id: hit[2], code: hit[0], label: hit[1], region_code: hit[0], region: hit[1] };
  const txt = typeof region === 'string' ? region : region?.region || '';
  return { region_id: null, code: txt, label: txt, region_code: txt, region: txt };
}

/* ---------------- catalog (CS) ---------------- */
const SIZE_ATTR = '93';
const COLOR_ATTR = '94';
const optUid = (attr, val) => b64(`configurable/${attr}/${val}`);
const isComplex = (p) => !!(p.sizes || p.colors);

function imagesFor(p, colorId) {
  if (p.colors) {
    const c = p.colors.find((x) => x.id === colorId) || p.colors[0];
    return c.images;
  }
  return p.images || [];
}

function imageList(p, colorId) {
  return imagesFor(p, colorId).map((name, i) => ({
    url: img(name),
    label: p.name,
    roles: i === 0 ? ['image', 'small_image', 'thumbnail', 'swatch_image'] : [],
  }));
}

function attrList(p) {
  return [
    { name: 'collection', label: 'Collection', value: p.collection, roles: ['visible_in_pdp', 'visible_in_plp', 'visible_in_search'] },
    { name: 'material', label: 'Material', value: p.material, roles: ['visible_in_pdp'] },
  ];
}

function optionsFor(p) {
  const opts = [];
  if (p.colors) {
    opts.push({
      id: 'color',
      title: 'Color',
      required: true,
      multi: false,
      values: p.colors.map((c) => ({
        __typename: 'ProductViewOptionValueSwatch', id: optUid(COLOR_ATTR, c.id), title: c.label, inStock: true, type: 'COLOR_HEX', value: c.hex,
      })),
    });
  }
  if (p.sizes) {
    opts.push({
      id: 'size',
      title: 'Size',
      required: true,
      multi: false,
      values: p.sizes.map((s) => ({
        __typename: 'ProductViewOptionValueSwatch', id: optUid(SIZE_ATTR, s), title: s, inStock: !(p.sku === 'ARC-HD-001' && s === 'XS'), type: 'TEXT', value: s,
      })),
    });
  }
  return opts;
}

function decodeOptionIds(ids = []) {
  const sel = {};
  (ids || []).forEach((id) => {
    try {
      const [, attr, val] = atob(id).split('/');
      if (attr === COLOR_ATTR) sel.color = val;
      if (attr === SIZE_ATTR) sel.size = val;
    } catch { /* ignore */ }
  });
  return sel;
}

const finalPrice = (p) => p.salePrice ?? p.price;

export function productView(p, optionIds) {
  const sel = decodeOptionIds(optionIds);
  const base = {
    id: b64(p.sku),
    sku: p.sku,
    name: p.name,
    shortDescription: p.short,
    description: p.description,
    metaTitle: `${p.name} | Bounteous ARC`,
    metaDescription: p.short,
    metaKeyword: '',
    inStock: p.inStock !== false,
    addToCartAllowed: p.inStock !== false,
    url: `${ORIGIN}/products/${p.urlKey}/${p.sku.toLowerCase()}`,
    urlKey: p.urlKey,
    externalId: String(PRODUCTS.indexOf(p) + 1000),
    lowStock: false,
    queryType: 'standard',
    visibility: 'Catalog, Search',
    images: () => imageList(p, sel.color),
    videos: [],
    links: () => [],
    inputOptions: [],
    categories: [findCategory(p.category)?.name].filter(Boolean),
    attributes: (args = {}) => {
      const roles = args.roles || [];
      return attrList(p).filter((a) => !roles.length || a.roles.some((r) => roles.includes(r)));
    },
  };
  if (!isComplex(p)) {
    return {
      ...base,
      __typename: 'SimpleProductView',
      price: {
        roles: ['visible'],
        regular: { amount: money(p.price), adjustments: [] },
        final: { amount: money(finalPrice(p)), adjustments: [] },
        tiers: [],
      },
    };
  }
  const pr = {
    roles: ['visible'],
    regular: { amount: money(p.price), adjustments: [] },
    final: { amount: money(finalPrice(p)), adjustments: [] },
    tiers: [],
  };
  return {
    ...base,
    __typename: 'ComplexProductView',
    priceRange: { minimum: pr, maximum: pr },
    options: () => optionsFor(p),
    optionUIDs: optionIds || [],
  };
}

function legacyProduct(p) {
  return {
    __typename: isComplex(p) ? 'ConfigurableProduct' : 'SimpleProduct',
    uid: b64(p.sku),
    sku: p.sku,
    name: p.name,
    url_key: p.urlKey,
    canonical_url: `products/${p.urlKey}/${p.sku.toLowerCase()}`,
    stock_status: p.inStock === false ? 'OUT_OF_STOCK' : 'IN_STOCK',
    only_x_left_in_stock: null,
    thumbnail: { url: img(imagesFor(p)[0]), label: p.name },
    small_image: { url: img(imagesFor(p)[0]), label: p.name },
    image: { url: img(imagesFor(p)[0]), label: p.name },
    categories: [{ url_path: p.category, url_key: p.category, name: findCategory(p.category)?.name, uid: b64(findCategory(p.category)?.id || '0') }],
    custom_attributesV2: { items: [] },
    price_tiers: [],
    quantity: null,
    gift_message_available: false,
    gift_wrapping_available: false,
    gift_wrapping_price: null,
    price_range: {
      minimum_price: {
        regular_price: money(p.price), final_price: money(finalPrice(p)), discount: { percent_off: 0, amount_off: r2(p.price - finalPrice(p)) },
      },
      maximum_price: {
        regular_price: money(p.price), final_price: money(finalPrice(p)), discount: { percent_off: 0, amount_off: r2(p.price - finalPrice(p)) },
      },
    },
  };
}

function matchesFilter(p, f) {
  const attr = f.attribute;
  const val = (() => {
    switch (attr) {
      case 'categoryPath': case 'categories': return [p.category];
      case 'categoryIds': return [findCategory(p.category)?.id];
      case 'price': return finalPrice(p);
      case 'collection': return [p.collection];
      case 'material': return [p.material];
      case 'inStock': return [String(p.inStock !== false)];
      case 'sku': return [p.sku];
      default: return null;
    }
  })();
  if (val === null) return true; // unknown filter (visibility etc.) → ignore
  if (f.eq !== undefined && f.eq !== null) {
    const eq = String(f.eq);
    if (attr === 'categoryPath' || attr === 'categories') return eq === '' || val.includes(eq) || eq.split('/').pop() === p.category;
    return val.map(String).includes(eq);
  }
  if (Array.isArray(f.in) && f.in.length) return f.in.map(String).some((x) => val.map(String).includes(x));
  if (f.range) {
    const from = f.range.from ?? -Infinity; const to = f.range.to ?? Infinity;
    return val >= from && val <= to;
  }
  return true;
}

function priceBuckets(list) {
  const ranges = [[0, 15], [15, 30], [30, 50], [50, 100]];
  return ranges.map(([from, to]) => ({
    __typename: 'RangeBucket', title: `${from}.0-${to}.0`, from, to, count: list.filter((p) => finalPrice(p) >= from && finalPrice(p) < to).length,
  })).filter((b) => b.count);
}
function scalarBuckets(list, key) {
  const counts = {};
  list.forEach((p) => { counts[p[key]] = (counts[p[key]] || 0) + 1; });
  return Object.entries(counts).map(([k, c]) => ({
    __typename: 'ScalarBucket', title: k, id: k, count: c,
  }));
}

export function productSearch(args = {}) {
  const phrase = (args.phrase || '').trim().toLowerCase();
  const filters = args.filter || [];
  const pageSize = args.page_size || 12;
  const page = args.current_page || 1;
  const catFilters = filters.filter((f) => ['categoryPath', 'categories', 'categoryIds'].includes(f.attribute));
  const base = PRODUCTS.filter((p) => !phrase || `${p.name} ${p.short} ${p.sku} ${p.collection} ${p.category}`.toLowerCase().includes(phrase))
    .filter((p) => catFilters.every((f) => matchesFilter(p, f)));
  let list = base.filter((p) => filters.every((f) => matchesFilter(p, f)));

  const sort = (args.sort || [])[0];
  if (sort) {
    const dir = sort.direction === 'DESC' ? -1 : 1;
    const key = sort.attribute;
    list = [...list].sort((a, b) => {
      let va; let vb;
      if (key === 'price') { va = finalPrice(a); vb = finalPrice(b); } else if (key === 'name') { va = a.name; vb = b.name; } else { va = a.position; vb = b.position; }
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }
  const total = list.length;
  const items = list.slice((page - 1) * pageSize, page * pageSize).map((p) => ({
    productView: productView(p),
    product: legacyProduct(p),
    highlights: [],
    appliedQueryRule: null,
  }));
  const catBuckets = CATEGORIES.map((c) => ({
    __typename: 'CategoryView', title: c.path, name: c.name, path: c.path, id: c.id, count: base.filter((p) => p.category === c.path).length,
  })).filter((b) => b.count);
  return {
    total_count: total,
    items,
    facets: [
      { title: 'Categories', attribute: 'categories', type: 'PINNED', buckets: catBuckets },
      { title: 'Price', attribute: 'price', type: 'PINNED', buckets: priceBuckets(base) },
      { title: 'Collection', attribute: 'collection', type: 'INTELLIGENT', buckets: scalarBuckets(base, 'collection') },
      { title: 'Material', attribute: 'material', type: 'INTELLIGENT', buckets: scalarBuckets(base, 'material') },
    ],
    page_info: { current_page: page, page_size: pageSize, total_pages: Math.max(1, Math.ceil(total / pageSize)) },
    suggestions: [],
    related_terms: [],
    warnings: [],
  };
}

const attributeMetadata = () => ({
  sortable: [
    { label: 'Relevance', attribute: 'relevance', numeric: false },
    { label: 'Position', attribute: 'position', numeric: true },
    { label: 'Price', attribute: 'price', numeric: true },
    { label: 'Product Name', attribute: 'name', numeric: false },
  ],
  filterableInSearch: [
    { label: 'Categories', attribute: 'categories', numeric: false },
    { label: 'Price', attribute: 'price', numeric: true },
    { label: 'Collection', attribute: 'collection', numeric: false },
    { label: 'Material', attribute: 'material', numeric: false },
  ],
});

function categoryView(c) {
  return {
    __typename: 'CategoryView',
    id: c.id,
    uid: b64(c.id),
    name: c.name,
    title: c.name,
    urlKey: c.urlKey,
    urlPath: c.path,
    path: c.path,
    level: 1,
    parentId: '2',
    roles: ['show_in_menu', 'active'],
    children: [],
    count: PRODUCTS.filter((p) => p.category === c.path).length,
    metaTags: { title: `${c.name} | Bounteous ARC`, description: `Shop ARC ${c.name}`, keywords: '' },
    images: [],
  };
}

function recommendations(args = {}) {
  const current = findProduct(args.currentSku);
  const inCart = new Set((args.cartSkus || []).map((s) => findProduct(s)?.sku));
  const pool = PRODUCTS.filter((p) => p !== current && !inCart.has(p.sku) && p.inStock !== false);
  const sameCat = current ? pool.filter((p) => p.category === current.category) : [];
  const picks = [...sameCat, ...pool.filter((p) => !sameCat.includes(p))].slice(0, 8);
  const unitIds = args.unitIds?.length ? args.unitIds : ['arc-recs-1'];
  return {
    totalResults: unitIds.length,
    results: unitIds.map((unitId, i) => ({
      unitId,
      unitName: 'You may also like',
      storefrontLabel: current ? 'Complete the look' : 'Trending at ARC',
      typeId: 'more-like-this',
      pageType: current ? 'Product' : 'CMS',
      displayOrder: i + 1,
      totalProducts: picks.length,
      productsView: picks.map((p) => productView(p)),
      products: picks.map((p) => ({ ...legacyProduct(p), ...productView(p) })),
    })),
  };
}

/* ---------------- carts (Core) ---------------- */
const SHIPPING_METHODS = [
  { carrier_code: 'arc', method_code: 'standard', carrier_title: 'ARC Shipping', method_title: 'Standard (3–5 business days)', amount: 5 },
  { carrier_code: 'arc', method_code: 'express', carrier_title: 'ARC Shipping', method_title: 'Express (1–2 business days)', amount: 15 },
];
const PAYMENT_METHODS = [
  { code: 'checkmo', title: 'Pay by invoice (demo, no charge)' },
  { code: 'banktransfer', title: 'Bank transfer (demo, no charge)' },
];
const COUPONS = { ARC20: 0.2, BOUNTEOUS10: 0.1 };

const carts = () => store.get('carts', {});
const saveCarts = (c) => store.set('carts', c);
function getCartState(id) {
  const all = carts();
  if (!all[id]) {
    all[id] = { id, items: [], email: null, coupons: [] };
    saveCarts(all);
  }
  return all[id];
}
function saveCartState(state) {
  const all = carts();
  all[state.id] = state;
  saveCarts(all);
}
function newCart() {
  const id = `arc${uid()}${uid()}`;
  saveCartState({ id, items: [], email: null, coupons: [] });
  return id;
}

function shippingAmountFor(method, subtotal) {
  if (!method) return 0;
  if (method.method_code === 'standard' && subtotal >= FREE_SHIP_OVER) return 0;
  return method.amount;
}
function methodView(m, subtotal) {
  const amt = shippingAmountFor(m, subtotal);
  return {
    ...m,
    method_title: m.method_code === 'standard' && amt === 0 ? 'Standard (free over $100)' : m.method_title,
    amount: money(amt),
    price_excl_tax: money(amt),
    price_incl_tax: money(amt),
    available: true,
    error_message: '',
  };
}

function addressView(a, extra = {}) {
  if (!a) return null;
  const region = regionFor(a.country_code, a.region, a.region_id);
  return {
    uid: a.uid || b64(`addr-${uid()}`),
    id: null,
    firstname: a.firstname,
    lastname: a.lastname,
    middlename: null,
    prefix: null,
    suffix: null,
    company: a.company || null,
    street: (a.street || []).filter(Boolean),
    city: a.city,
    region,
    postcode: a.postcode,
    country: { code: a.country_code, label: countryLabel(a.country_code) },
    telephone: a.telephone,
    fax: null,
    vat_id: a.vat_id || null,
    custom_attributes: [],
    ...extra,
  };
}

function lineFor(item) {
  const p = findProduct(item.sku);
  if (!p) return null;
  const sel = decodeOptionIds(item.options);
  const unit = finalPrice(p);
  const rowTotal = unit * item.quantity;
  const color = p.colors?.find((c) => c.id === sel.color);
  const thumb = img(imagesFor(p, sel.color)[0]);
  const variantSku = [p.sku, sel.color, sel.size].filter(Boolean).join('-').toUpperCase();
  const configurable = isComplex(p);
  const product = { ...legacyProduct(p), thumbnail: { url: thumb, label: p.name }, small_image: { url: thumb, label: p.name } };
  const line = {
    __typename: configurable ? 'ConfigurableCartItem' : 'SimpleCartItem',
    uid: item.uid,
    id: item.uid,
    quantity: item.quantity,
    is_salable: true,
    is_available: true,
    not_available_message: null,
    errors: null,
    is_free_gift: false,
    max_qty: 99,
    min_qty: 1,
    note_from_buyer: [],
    note_from_seller: [],
    prices: {
      price: money(unit),
      price_including_tax: money(unit),
      row_total: money(rowTotal),
      row_total_including_tax: money(rowTotal),
      total_item_discount: money(0),
      original_item_price: money(p.price),
      original_row_total: money(p.price * item.quantity),
      catalog_discount: { amount_off: r2(p.price - unit), percent_off: r2(((p.price - unit) / p.price) * 100) },
      row_catalog_discount: { amount_off: r2((p.price - unit) * item.quantity), percent_off: r2(((p.price - unit) / p.price) * 100) },
      discounts: null,
      fixed_product_taxes: [],
    },
    product,
    customizable_options: [],
    available_gift_wrapping: [],
    gift_message: null,
    gift_wrapping: null,
  };
  if (configurable) {
    line.configurable_options = [
      ...(color ? [{
        option_label: 'Color', value_label: color.label, value_id: COLOR_ATTR, configurable_product_option_uid: b64(`configurable/${COLOR_ATTR}`), configurable_product_option_value_uid: optUid(COLOR_ATTR, color.id),
      }] : []),
      ...(sel.size ? [{
        option_label: 'Size', value_label: sel.size, value_id: SIZE_ATTR, configurable_product_option_uid: b64(`configurable/${SIZE_ATTR}`), configurable_product_option_value_uid: optUid(SIZE_ATTR, sel.size),
      }] : []),
    ];
    line.configured_variant = {
      ...product, __typename: 'SimpleProduct', sku: variantSku, uid: b64(variantSku),
    };
  }
  return line;
}

function totals(state) {
  const lines = state.items.map(lineFor).filter(Boolean);
  const subtotal = lines.reduce((s, l) => s + l.prices.row_total.value, 0);
  const pct = (state.coupons || []).reduce((m, c) => Math.max(m, COUPONS[c] || 0), 0);
  const discount = r2(subtotal * pct);
  const method = state.shipping_method ? SHIPPING_METHODS.find((m) => m.method_code === state.shipping_method) : null;
  const shipping = shippingAmountFor(method, subtotal);
  const taxable = state.shipping_address ? subtotal - discount : 0;
  const tax = r2(taxable * TAX_RATE);
  return {
    lines, subtotal: r2(subtotal), discount, shipping, tax, grand: r2(subtotal - discount + shipping + tax), method,
  };
}

export function buildCart(state) {
  const t = totals(state);
  const qty = state.items.reduce((s, i) => s + i.quantity, 0);
  const shipping = state.shipping_address ? [addressView(state.shipping_address, {
    available_shipping_methods: SHIPPING_METHODS.map((m) => methodView(m, t.subtotal)),
    selected_shipping_method: t.method ? methodView(t.method, t.subtotal) : null,
    same_as_billing: !!state.billing_same,
    pickup_location_code: null,
  })] : [];
  const discounts = t.discount ? [{ amount: money(t.discount), label: `Coupon ${state.coupons.join(', ')}`, applied_to: 'ITEM', coupon: { code: state.coupons[0] } }] : null;
  return {
    __typename: 'Cart',
    id: state.id,
    email: state.email,
    is_virtual: false,
    total_quantity: qty,
    has_available_free_gifts: false,
    applied_gift_cards: [],
    gift_receipt_included: false,
    printed_card_included: false,
    gift_message: null,
    gift_wrapping: null,
    available_gift_wrappings: [],
    applied_reward_points: null,
    applied_store_credit: null,
    rules: [],
    applied_coupons: state.coupons?.length ? state.coupons.map((code) => ({ code })) : null,
    applied_coupon: state.coupons?.length ? { code: state.coupons[0] } : null,
    prices: {
      grand_total: money(t.grand),
      grand_total_excluding_tax: money(t.grand - t.tax),
      subtotal_excluding_tax: money(t.subtotal),
      subtotal_including_tax: money(t.subtotal),
      subtotal_with_discount_excluding_tax: money(t.subtotal - t.discount),
      applied_taxes: t.tax ? [{ amount: money(t.tax), label: 'Sales tax (demo 8.25%)' }] : [],
      discounts,
      gift_options: {
        gift_wrapping_for_items: money(0), gift_wrapping_for_items_incl_tax: money(0), gift_wrapping_for_order: money(0), gift_wrapping_for_order_incl_tax: money(0), printed_card: money(0), printed_card_incl_tax: money(0),
      },
    },
    items: t.lines,
    itemsV2: (args = {}) => ({
      items: t.lines,
      total_count: t.lines.length,
      page_info: { current_page: args.currentPage || 1, page_size: args.pageSize || 100, total_pages: 1 },
    }),
    shipping_addresses: shipping,
    billing_address: state.billing_address ? addressView(state.billing_address) : null,
    available_payment_methods: PAYMENT_METHODS.map((m) => ({ ...m, is_deferred: false, oope_payment_method_config: null })),
    selected_payment_method: state.payment
      ? { ...PAYMENT_METHODS.find((m) => m.code === state.payment), purchase_order_number: null }
      : { code: '', title: '', purchase_order_number: null },
  };
}

function cartIdFrom(args) {
  return args.cart_id || args.cartId || args.input?.cart_id || args.input?.cartId;
}

function mutateCart(args, fn) {
  const state = getCartState(cartIdFrom(args));
  fn(state);
  saveCartState(state);
  return buildCart(state);
}

function toAddress(input = {}) {
  const a = input.address || input;
  return {
    firstname: a.firstname,
    lastname: a.lastname,
    company: a.company,
    street: a.street || [],
    city: a.city,
    region: a.region,
    region_id: a.region_id,
    postcode: a.postcode,
    country_code: a.country_code || a.country_id || 'US',
    telephone: a.telephone,
    vat_id: a.vat_id,
  };
}

/* ---------------- customer & orders ---------------- */
const DEMO_CUSTOMER = {
  firstname: 'Avery',
  lastname: 'Quinn',
  email: 'avery.quinn@example.com',
  addresses: [{
    id: 1, firstname: 'Avery', lastname: 'Quinn', street: ['1 Demo Plaza', 'Suite 400'], city: 'Chicago', region: 'IL', region_id: 23, postcode: '60601', country_code: 'US', telephone: '3125550142', company: 'Bounteous ARC (demo)', default_shipping: true, default_billing: true,
  }],
};
const getCustomer = () => store.get('customer', DEMO_CUSTOMER);
const saveCustomer = (c) => store.set('customer', c);
function requireAuth(ctx) {
  if (!ctx.token) throw new Error("The current customer isn't authorized.");
}

function customerAddressView(a) {
  const region = regionFor(a.country_code, a.region, a.region_id);
  return {
    id: a.id,
    uid: b64(`caddr-${a.id}`),
    firstname: a.firstname,
    lastname: a.lastname,
    middlename: null,
    prefix: null,
    suffix: null,
    company: a.company || null,
    street: (a.street || []).filter(Boolean),
    city: a.city,
    region: { region: region.label, region_code: region.code, region_id: region.region_id },
    region_id: region.region_id,
    postcode: a.postcode,
    country_code: a.country_code,
    country_id: a.country_code,
    telephone: a.telephone,
    fax: null,
    vat_id: a.vat_id || null,
    default_shipping: !!a.default_shipping,
    default_billing: !!a.default_billing,
    custom_attributes: [],
    custom_attributesV2: [],
    extension_attributes: [],
  };
}

function orderAddressView(a) {
  if (!a) return null;
  const region = regionFor(a.country_code, a.region, a.region_id);
  return {
    firstname: a.firstname,
    lastname: a.lastname,
    middlename: null,
    prefix: null,
    suffix: null,
    company: a.company || null,
    street: (a.street || []).filter(Boolean),
    city: a.city,
    region: region.label,
    region_id: region.region_id ? String(region.region_id) : null,
    postcode: a.postcode,
    country_code: a.country_code,
    telephone: a.telephone,
    fax: null,
    vat_id: a.vat_id || null,
    custom_attributes: [],
    custom_attributesV2: [],
  };
}

function orderItemView(line) {
  const p = line.product;
  return {
    __typename: 'OrderItem',
    id: b64(`oi-${line.uid}`),
    uid: b64(`oi-${line.uid}`),
    product_sku: line.configured_variant?.sku || p.sku,
    product_name: p.name,
    product_url_key: p.url_key,
    product_type: line.configured_variant ? 'configurable' : 'simple',
    product_sale_price: line.prices.price,
    status: 'Ordered',
    discounts: [],
    eligible_for_return: false,
    quantity_ordered: line.quantity,
    quantity_shipped: 0,
    quantity_canceled: 0,
    quantity_invoiced: line.quantity,
    quantity_refunded: 0,
    quantity_returned: 0,
    quantity_return_requested: 0,
    selected_options: (line.configurable_options || []).map((o) => ({ label: o.option_label, value: o.value_label })),
    entered_options: [],
    prices: {
      price: line.prices.price,
      price_including_tax: line.prices.price_including_tax,
      row_total: line.prices.row_total,
      row_total_including_tax: line.prices.row_total_including_tax,
      total_item_discount: money(0),
      original_price: line.prices.original_item_price,
      original_price_including_tax: line.prices.original_item_price,
      original_row_total: line.prices.original_row_total,
      original_row_total_including_tax: line.prices.original_row_total,
      discounts: [],
      fixed_product_taxes: [],
    },
    product: p,
    gift_message: null,
    gift_wrapping: null,
    gift_card: null,
    downloadable_links: [],
    bundle_options: [],
  };
}

function orderView(o) {
  return {
    __typename: 'CustomerOrder',
    id: b64(`order-${o.number}`),
    uid: b64(`order-${o.number}`),
    number: o.number,
    increment_id: o.number,
    order_number: o.number,
    order_date: o.date,
    created_at: o.date,
    order_status_change_date: o.date,
    status: o.status,
    state: o.status === 'Complete' ? 'complete' : 'processing',
    token: o.token,
    email: o.email,
    is_virtual: false,
    carrier: 'ARC Shipping',
    shipping_method: o.shipping_title,
    available_actions: [],
    applied_coupons: (o.coupons || []).map((code) => ({ code })),
    applied_gift_cards: [],
    customer_info: { firstname: o.shipping.firstname, lastname: o.shipping.lastname, middlename: null },
    gift_message: null,
    gift_wrapping: null,
    gift_receipt_included: false,
    printed_card_included: false,
    payment_methods: [{ name: o.payment_title, type: o.payment, additional_data: [] }],
    shipping_address: orderAddressView(o.shipping),
    billing_address: orderAddressView(o.billing || o.shipping),
    items: o.lines.map(orderItemView),
    items_eligible_for_return: [],
    total: {
      grand_total: money(o.grand),
      base_grand_total: money(o.grand),
      grand_total_excl_tax: money(o.grand - o.tax),
      subtotal: money(o.subtotal),
      subtotal_excl_tax: money(o.subtotal),
      subtotal_incl_tax: money(o.subtotal),
      total_shipping: money(o.shipping_amount),
      total_tax: money(o.tax),
      taxes: o.tax ? [{ amount: money(o.tax), rate: 8.25, title: 'Sales tax (demo)' }] : [],
      discounts: o.discount ? [{ amount: money(o.discount), label: 'Coupon' }] : [],
      shipping_handling: {
        amount_excluding_tax: money(o.shipping_amount), amount_including_tax: money(o.shipping_amount), total_amount: money(o.shipping_amount), taxes: [], discounts: [],
      },
      gift_options: null,
    },
    shipments: o.status === 'Complete' ? [{
      id: b64(`ship-${o.number}`), number: `S${o.number}`, comments: [], tracking: [{ title: 'UPS', number: `1Z999AA1${o.number}`, carrier: 'ups' }], items: o.lines.map((l) => ({ id: b64(`si-${l.uid}`), product_name: l.product.name, product_sku: l.product.sku, quantity_shipped: l.quantity, order_item: orderItemView(l) })),
    }] : [],
    invoices: [],
    credit_memos: [],
    comments: [],
    returns: { items: [], total_count: 0, page_info: { current_page: 1, page_size: 10, total_pages: 0 } },
  };
}

function seedOrders() {
  const existing = store.get('orders', null);
  if (existing) return existing;
  const c = DEMO_CUSTOMER;
  const mk = (number, date, status, items) => {
    const state = { id: `seed-${number}`, items: items.map(([sku, quantity, options]) => ({ uid: b64(`seed-${number}-${sku}`), sku, quantity, options })), coupons: [], shipping_address: toAddress(c.addresses[0]), shipping_method: 'standard' };
    const t = totals(state);
    return {
      number, date, status, token: b64(`tok-${number}`), email: c.email, customer: true, shipping: toAddress(c.addresses[0]), billing: null, payment: 'checkmo', payment_title: PAYMENT_METHODS[0].title, shipping_title: 'Standard (3–5 business days)', lines: t.lines, subtotal: t.subtotal, discount: t.discount, tax: t.tax, shipping_amount: t.shipping, grand: t.grand,
    };
  };
  const orders = [
    mk('000000042', '2026-09-18 14:22:10', 'Complete', [['ARC-BT-010', 2], ['ARC-NB-020', 3]]),
    mk('000000057', '2026-10-02 09:41:55', 'Processing', [['ARC-HD-001', 1, [optUid(COLOR_ATTR, 'midnight'), optUid(SIZE_ATTR, 'L')]], ['ARC-CP-004', 1]]),
  ];
  store.set('orders', orders);
  return orders;
}

function customerView(ctx) {
  const c = getCustomer();
  const orders = () => seedOrders().filter((o) => o.customer);
  return {
    __typename: 'Customer',
    id: null,
    firstname: c.firstname,
    lastname: c.lastname,
    middlename: null,
    prefix: null,
    suffix: null,
    email: c.email,
    date_of_birth: null,
    dob: null,
    gender: 0,
    taxvat: null,
    is_subscribed: false,
    allow_remote_shopping_assistance: false,
    confirmation_status: 'ACCOUNT_CONFIRMED',
    created_at: '2025-01-15 10:00:00',
    group: { uid: 'MQ==' },
    group_id: 1,
    custom_attributes: [],
    role: null,
    status: 'ACTIVE',
    addresses: c.addresses.map(customerAddressView),
    addressesV2: () => ({ items: c.addresses.map(customerAddressView), total_count: c.addresses.length, page_info: { current_page: 1, page_size: 20, total_pages: 1 } }),
    default_shipping: String(c.addresses.find((a) => a.default_shipping)?.id || ''),
    default_billing: String(c.addresses.find((a) => a.default_billing)?.id || ''),
    orders: (args = {}) => {
      let list = orders();
      const num = args.filter?.number?.eq || args.filter?.number?.match;
      if (num) list = list.filter((o) => o.number === num);
      list = [...list].sort((a, b) => (a.date < b.date ? 1 : -1));
      const size = args.pageSize || 10; const page = args.currentPage || 1;
      return {
        items: list.slice((page - 1) * size, page * size).map(orderView),
        total_count: list.length,
        page_info: { current_page: page, page_size: size, total_pages: Math.max(1, Math.ceil(list.length / size)) },
        date_of_first_order: list.length ? list[list.length - 1].date : null,
      };
    },
    returns: () => ({ items: [], total_count: 0, page_info: { current_page: 1, page_size: 10, total_pages: 0 } }),
    wishlists: () => [{
      id: '1', name: 'My favorites', items_count: 0, sharing_code: 'arcdemo', updated_at: '2026-10-01', visibility: 'PRIVATE', items_v2: () => ({ items: [], page_info: { current_page: 1, page_size: 20, total_pages: 0 } }),
    }],
    wishlist_v2: () => ({ id: '1', items_count: 0, items_v2: () => ({ items: [] }) }),
    compare_list: null,
    reward_points: null,
    store_credit: null,
    gift_registries: [],
    purchase_orders_enabled: false,
    ctxToken: ctx.token,
  };
}

function placeOrder(args, ctx) {
  const id = cartIdFrom(args);
  const state = getCartState(id);
  if (!state.items.length) throw new Error('Unable to place order: the cart is empty.');
  const t = totals(state);
  const all = seedOrders();
  const number = String(100 + all.length).padStart(9, '0');
  const o = {
    number,
    date: new Date().toISOString().replace('T', ' ').slice(0, 19),
    status: 'Processing',
    token: b64(`tok-${number}-${uid()}`),
    email: state.email || getCustomer().email,
    customer: !!ctx.token,
    shipping: state.shipping_address,
    billing: state.billing_address,
    payment: state.payment || 'checkmo',
    payment_title: PAYMENT_METHODS.find((m) => m.code === state.payment)?.title || PAYMENT_METHODS[0].title,
    shipping_title: t.method ? methodView(t.method, t.subtotal).method_title : 'Standard',
    coupons: state.coupons,
    lines: t.lines,
    subtotal: t.subtotal,
    discount: t.discount,
    tax: t.tax,
    shipping_amount: t.shipping,
    grand: t.grand,
  };
  all.push(o);
  store.set('orders', all);
  // empty the cart (the cart drop-in will request a new one)
  const c = carts(); delete c[id]; saveCarts(c);
  if (store.get('customerCartId', null) === id) store.set('customerCartId', null);
  return {
    orderV2: orderView(o),
    order: { order_number: number, order_id: number },
    errors: [],
  };
}

function findOrder({ number, token }) {
  const o = seedOrders().find((x) => (number && x.number === number) || (token && x.token === token));
  if (!o) throw new Error('We couldn\'t find an order matching those details.');
  return orderView(o);
}

/* ---------------- store config ---------------- */
const STORE_CONFIG = {
  store_code: 'default',
  store_name: 'Bounteous ARC Store',
  store_group_code: 'main_website_store',
  website_code: 'base',
  locale: 'en_US',
  base_currency_code: 'USD',
  default_display_currency_code: 'USD',
  timezone: 'America/Chicago',
  weight_unit: 'lbs',
  base_url: `${ORIGIN}/`,
  secure_base_url: `${ORIGIN}/`,
  base_link_url: `${ORIGIN}/`,
  minicart_display: true,
  minicart_max_items: 10,
  cart_expires_in_days: 30,
  cart_summary_display_quantity: 1,
  max_items_in_order_summary: 10,
  default_country: 'US',
  defaultCountry: 'US',
  category_fixed_product_tax_display_setting: 'FPT_DISABLED',
  product_fixed_product_tax_display_setting: 'FPT_DISABLED',
  sales_fixed_product_tax_display_setting: 'FPT_DISABLED',
  shopping_cart_display_full_summary: true,
  shopping_cart_display_grand_total: true,
  shopping_cart_display_price: 1,
  shopping_cart_display_shipping: 1,
  shopping_cart_display_subtotal: 1,
  shopping_cart_display_tax_gift_wrapping: 'DISPLAY_TYPE_EXCLUDING_TAX',
  shopping_cart_display_zero_tax: false,
  configurable_thumbnail_source: 'itself',
  orders_invoices_credit_memos_display_price: 1,
  orders_invoices_credit_memos_display_subtotal: 1,
  orders_invoices_credit_memos_display_shipping_amount: 1,
  orders_invoices_credit_memos_display_grandtotal: true,
  orders_invoices_credit_memos_display_full_summary: true,
  orders_invoices_credit_memos_display_zero_tax: false,
  allow_gift_wrapping_on_order: '0',
  allow_gift_wrapping_on_order_items: '0',
  allow_order: '0',
  allow_items: '0',
  allow_gift_receipt: '0',
  allow_printed_card: '0',
  printed_card_priceV2: money(0),
  cart_gift_wrapping: '0',
  cart_printed_card: '0',
  is_checkout_agreements_enabled: true,
  is_guest_checkout_enabled: true,
  is_one_page_checkout_enabled: true,
  countries_with_required_region: 'US,CA',
  optional_zip_countries: 'HK,IE',
  display_state_if_optional: false,
  autocomplete_on_storefront: true,
  minimum_password_length: '8',
  required_character_classes_number: '2',
  create_account_confirmation: false,
  customer_access_token_lifetime: 1,
  cart_merge_preference: 'merged',
  order_cancellation_enabled: true,
  order_cancellation_reasons: [{ description: 'Changed my mind' }, { description: 'Ordered by mistake' }],
  returns_enabled: 'disabled',
  grid_per_page: 12,
  grid_per_page_values: '12,24,36',
  list_per_page: 12,
  list_per_page_values: '12,24,36',
  product_url_suffix: '',
  category_url_suffix: '',
  root_category_uid: b64('2'),
  magento_wishlist_general_is_enabled: '1',
  enable_multiple_wishlists: '0',
  share_all_catalog_rules: false,
  share_all_sales_rule: false,
  share_applied_catalog_rules: false,
  share_applied_sales_rule: false,
  graphql_share_customer_group: true,
  quickorder_active: false,
  company_enabled: false,
  is_requisition_list_active: '0',
  is_negotiable_quote_active: false,
  newsletter_enabled: false,
};

const ADDRESS_FORM = [
  ['firstname', 'First Name', 'TEXT', true, 10],
  ['lastname', 'Last Name', 'TEXT', true, 20],
  ['company', 'Company', 'TEXT', false, 30],
  ['street', 'Street Address', 'MULTILINE', true, 40, 2],
  ['country_id', 'Country', 'SELECT', true, 50],
  ['region', 'State/Province', 'TEXT', false, 60],
  ['city', 'City', 'TEXT', true, 70],
  ['postcode', 'Zip/Postal Code', 'TEXT', true, 80],
  ['telephone', 'Phone Number', 'TEXT', true, 90],
];
const ACCOUNT_FORM = [
  ['firstname', 'First Name', 'TEXT', true, 10],
  ['lastname', 'Last Name', 'TEXT', true, 20],
  ['email', 'Email', 'TEXT', true, 30],
];
function attributesForm({ formCode }) {
  const isAccount = /customer_account/.test(formCode || '');
  const src = isAccount ? ACCOUNT_FORM : ADDRESS_FORM;
  return {
    items: src.map(([code, label, input, req, sort, lines]) => ({
      __typename: isAccount ? 'CustomerAttributeMetadata' : 'CustomerAddressAttributeMetadata',
      code,
      label,
      default_value: code === 'country_id' ? 'US' : null,
      entity_type: isAccount ? 'CUSTOMER' : 'CUSTOMER_ADDRESS',
      frontend_class: null,
      frontend_input: input,
      input_filter: 'NONE',
      is_required: req,
      is_unique: false,
      multiline_count: lines || 0,
      sort_order: sort,
      options: [],
      validate_rules: [{ name: 'MAX_TEXT_LENGTH', value: '255' }],
    })),
    errors: [],
  };
}

const PAYMENT_CONFIG = {
  __typename: 'PaymentConfigOutput',
  apple_pay: { code: 'payment_services_paypal_apple_pay', is_visible: false, sdk_params: [], button_styles: null },
  google_pay: { code: 'payment_services_paypal_google_pay', is_visible: false, sdk_params: [], button_styles: null },
  credit_card: { code: 'payment_services_paypal_hosted_fields', is_visible: false, sdk_params: [], payment_source: 'cc', three_ds_mode: 'OFF', is_vault_enabled: false, requires_card_details: false },
  paypal_buttons: { code: 'payment_services_paypal_smart_buttons', is_visible: false, sdk_params: [], display_message: false },
  smart_buttons: { code: 'payment_services_paypal_smart_buttons', is_visible: false, sdk_params: [] },
  hosted_fields: { code: 'payment_services_paypal_hosted_fields', is_visible: false, sdk_params: [] },
};

const AGREEMENTS = [{
  agreement_id: 1,
  name: 'Prototype notice',
  content: 'This is a Bounteous ARC prototype storefront. No payment is taken and no goods ship.',
  checkbox_text: 'I understand this is a demo and no real order is placed',
  is_html: false,
  mode: 'MANUAL',
}];

/* ---------------- resolver maps ---------------- */
const recaptchaOff = () => ({ is_enabled: false, configurations: null });

export const csResolvers = {
  query: {
    products: (args) => (args.skus || []).map((s) => findProduct(s)).filter(Boolean).map((p) => productView(p, args.optionIds)),
    refineProduct: (args) => { const p = findProduct(args.sku); return p ? productView(p, args.optionIds) : null; },
    productSearch,
    attributeMetadata,
    categories: (args = {}) => {
      let list = CATEGORIES;
      if (args.ids?.length) list = list.filter((c) => args.ids.includes(c.id) || args.ids.includes(c.path));
      return list.map(categoryView);
    },
    categoryTree: () => CATEGORIES.map(categoryView),
    navigation: () => CATEGORIES.map(categoryView),
    recommendationsByUnitIds: recommendations,
    recommendations,
    variants: (args) => {
      const p = findProduct(args.sku);
      if (!p || !isComplex(p)) return { variants: [], cursor: null };
      const vs = [];
      (p.colors || [{ id: null }]).forEach((c) => (p.sizes || [null]).forEach((s) => {
        const ids = [c.id && optUid(COLOR_ATTR, c.id), s && optUid(SIZE_ATTR, s)].filter(Boolean);
        vs.push({ selections: ids, product: { ...productView(p, ids), __typename: 'SimpleProductView', sku: [p.sku, c.id, s].filter(Boolean).join('-').toUpperCase() } });
      }));
      return { variants: vs, cursor: null };
    },
  },
};

export const coreResolvers = {
  query: {
    storeConfig: () => STORE_CONFIG,
    recaptchaFormConfig: recaptchaOff,
    recaptchaV3Config: () => ({ is_enabled: false, website_key: '', badge_position: 'inline', forms: [] }),
    countries: () => COUNTRIES.map((c) => ({
      id: c.id,
      label: c.name,
      two_letter_abbreviation: c.id,
      three_letter_abbreviation: c.id,
      full_name_locale: c.name,
      full_name_english: c.name,
      available_regions: c.regions.length ? c.regions.map(([code, name, id]) => ({ id, code, name })) : null,
    })),
    country: ({ id }) => {
      const c = COUNTRIES.find((x) => x.id === id) || COUNTRIES[0];
      return {
        id: c.id, two_letter_abbreviation: c.id, full_name_locale: c.name, full_name_english: c.name, available_regions: c.regions.map(([code, name, rid]) => ({ id: rid, code, name })),
      };
    },
    attributesForm,
    attributesList: () => ({ items: [], errors: [] }),
    customAttributeMetadataV2: () => ({ items: [], errors: [] }),
    isEmailAvailable: () => ({ is_email_available: true }),
    customerGroup: (args, ctx) => ({ uid: ctx.token ? 'MQ==' : 'MA==' }),
    customerSegments: () => [],
    getPaymentConfig: () => PAYMENT_CONFIG,
    checkoutAgreements: () => AGREEMENTS,
    cart: (args) => buildCart(getCartState(cartIdFrom(args))),
    customerCart: (args, ctx) => {
      requireAuth(ctx);
      let id = store.get('customerCartId', null);
      if (!id || !carts()[id]) { id = newCart(); store.set('customerCartId', id); }
      return buildCart(getCartState(id));
    },
    customer: (args, ctx) => { requireAuth(ctx); return customerView(ctx); },
    guestOrder: ({ input = {} }) => findOrder({ number: input.number }),
    guestOrderByToken: ({ input = {} }) => findOrder({ token: input.token }),
    customerOrders: (args, ctx) => { requireAuth(ctx); return customerView(ctx).orders({}); },
    customerPaymentTokens: () => ({ items: [] }),
    dynamicBlocks: () => ({ items: [], total_count: 0, page_info: { current_page: 1, page_size: 10, total_pages: 0 } }),
    products: (args = {}) => {
      const skus = args.filter?.sku?.in || (args.filter?.sku?.eq ? [args.filter.sku.eq] : []);
      const list = skus.length ? skus.map(findProduct).filter(Boolean) : PRODUCTS;
      return { items: list.map(legacyProduct), total_count: list.length, page_info: { current_page: 1, page_size: list.length, total_pages: 1 } };
    },
    company: () => null,
  },
  mutation: {
    createGuestCart: () => ({ cart: buildCart(getCartState(newCart())) }),
    createEmptyCart: () => newCart(),
    addProductsToCart: (args) => {
      const errors = [];
      const cart = mutateCart(args, (state) => {
        (args.cartItems || []).forEach((ci) => {
          const p = findProduct(ci.sku);
          if (!p) { errors.push({ code: 'PRODUCT_NOT_FOUND', message: `Could not find a product with SKU "${ci.sku}"` }); return; }
          const options = [...(ci.selected_options || [])].sort();
          const existing = state.items.find((i) => i.sku === p.sku && JSON.stringify(i.options) === JSON.stringify(options));
          if (existing) existing.quantity += Number(ci.quantity || 1);
          else state.items.push({ uid: b64(`item-${uid()}`), sku: p.sku, quantity: Number(ci.quantity || 1), options });
        });
      });
      return { cart, user_errors: errors };
    },
    updateCartItems: (args) => {
      const input = args.input || {};
      const cart = mutateCart(input, (state) => {
        (input.cart_items || []).forEach((u) => {
          const it = state.items.find((i) => i.uid === u.cart_item_uid || i.uid === String(u.cart_item_id));
          if (!it) return;
          if (u.quantity !== undefined) it.quantity = Number(u.quantity);
        });
        state.items = state.items.filter((i) => i.quantity > 0);
      });
      return { cart, errors: [] };
    },
    removeItemFromCart: (args) => {
      const input = args.input || {};
      return { cart: mutateCart(input, (state) => { state.items = state.items.filter((i) => i.uid !== input.cart_item_uid && i.uid !== String(input.cart_item_id)); }) };
    },
    applyCouponToCart: (args) => {
      const input = args.input || {};
      const code = String(input.coupon_code || '').toUpperCase();
      if (!COUPONS[code]) throw new Error(`The coupon code "${input.coupon_code}" is not valid. Try ARC20.`);
      return { cart: mutateCart(input, (s) => { s.coupons = [code]; }) };
    },
    applyCouponsToCart: (args) => {
      const input = args.input || {};
      const codes = (input.coupon_codes || []).map((c) => String(c).toUpperCase());
      const bad = codes.find((c) => !COUPONS[c]);
      if (bad) throw new Error(`The coupon code "${bad}" is not valid. Try ARC20.`);
      return { cart: mutateCart(input, (s) => { s.coupons = input.type === 'APPEND' ? [...new Set([...(s.coupons || []), ...codes])] : codes; }) };
    },
    removeCouponFromCart: (args) => ({ cart: mutateCart(args.input || {}, (s) => { s.coupons = []; }) }),
    removeCouponsFromCart: (args) => {
      const input = args.input || {};
      const rm = (input.coupon_codes || []).map((c) => String(c).toUpperCase());
      return { cart: mutateCart(input, (s) => { s.coupons = (s.coupons || []).filter((c) => !rm.includes(c)); }) };
    },
    setGuestEmailOnCart: (args) => ({ cart: mutateCart(args.input || {}, (s) => { s.email = args.input.email; }) }),
    setShippingAddressesOnCart: (args) => {
      const input = args.input || {};
      return {
        cart: mutateCart(input, (s) => {
          const sa = (input.shipping_addresses || [])[0] || {};
          if (sa.customer_address_id) {
            const ca = getCustomer().addresses.find((a) => String(a.id) === String(sa.customer_address_id));
            s.shipping_address = ca ? toAddress(ca) : s.shipping_address;
          } else {
            s.shipping_address = toAddress(sa.address || sa);
          }
          if (!s.shipping_method) s.shipping_method = 'standard';
        }),
      };
    },
    setBillingAddressOnCart: (args) => {
      const input = args.input || {};
      return {
        cart: mutateCart(input, (s) => {
          const ba = input.billing_address || {};
          if (ba.same_as_shipping || ba.use_for_shipping) {
            s.billing_address = s.shipping_address; s.billing_same = true;
          } else if (ba.customer_address_id) {
            const ca = getCustomer().addresses.find((a) => String(a.id) === String(ba.customer_address_id));
            s.billing_address = ca ? toAddress(ca) : s.billing_address; s.billing_same = false;
          } else {
            s.billing_address = toAddress(ba.address || ba);
            s.billing_same = JSON.stringify(s.billing_address) === JSON.stringify(s.shipping_address);
          }
        }),
      };
    },
    setShippingMethodsOnCart: (args) => {
      const input = args.input || {};
      return { cart: mutateCart(input, (s) => { const m = (input.shipping_methods || [])[0]; if (m) s.shipping_method = m.method_code; }) };
    },
    setPaymentMethodOnCart: (args) => {
      const input = args.input || {};
      return { cart: mutateCart(input, (s) => { s.payment = input.payment_method?.code || 'checkmo'; }) };
    },
    estimateShippingMethods: (args) => {
      const input = args.input || {};
      const t = totals(getCartState(cartIdFrom(input)));
      return SHIPPING_METHODS.map((m) => methodView(m, t.subtotal));
    },
    estimateTotals: (args) => {
      const input = args.input || {};
      const state = getCartState(cartIdFrom(input));
      const preview = { ...state, shipping_address: state.shipping_address || toAddress(input.address || { country_code: 'US' }), shipping_method: input.shipping_method?.method_code || state.shipping_method || 'standard' };
      return { cart: buildCart(preview) };
    },
    placeOrder: (args, ctx) => placeOrder(args.input || args, ctx),
    setPaymentMethodAndPlaceOrder: (args, ctx) => {
      const input = args.input || {};
      const s = getCartState(cartIdFrom(input)); s.payment = input.payment_method?.code || 'checkmo'; saveCartState(s);
      return placeOrder(input, ctx);
    },
    mergeCarts: (args) => {
      const src = getCartState(args.source_cart_id);
      const dest = getCartState(args.destination_cart_id);
      src.items.forEach((i) => dest.items.push(i));
      saveCartState(dest);
      const c = carts(); delete c[args.source_cart_id]; saveCarts(c);
      return buildCart(dest);
    },
    assignCustomerToGuestCart: (args) => { store.set('customerCartId', args.cart_id); return buildCart(getCartState(args.cart_id)); },

    // ---- auth ----
    generateCustomerToken: ({ email }) => {
      const c = getCustomer();
      if (email && email !== c.email) saveCustomer({ ...c, email });
      return { token: `arc-demo-${uid()}` };
    },
    generateCustomerTokenWithAuth: ({ email }) => ({ token: `arc-demo-${uid()}`, email }),
    revokeCustomerToken: () => ({ result: true }),
    createCustomer: ({ input = {} }, ctx) => {
      saveCustomer({ ...DEMO_CUSTOMER, firstname: input.firstname || DEMO_CUSTOMER.firstname, lastname: input.lastname || DEMO_CUSTOMER.lastname, email: input.email || DEMO_CUSTOMER.email });
      return { customer: customerView({ ...ctx, token: 'new' }) };
    },
    createCustomerV2: (args, ctx) => coreResolvers.mutation.createCustomer(args, ctx),
    requestPasswordResetEmail: () => true,
    resetPassword: () => true,
    confirmEmail: (args, ctx) => ({ customer: customerView(ctx) }),
    resendConfirmationEmail: () => true,
    updateCustomer: ({ input = {} }, ctx) => { saveCustomer({ ...getCustomer(), ...input }); return { customer: customerView(ctx) }; },
    updateCustomerV2: ({ input = {} }, ctx) => { saveCustomer({ ...getCustomer(), ...input }); return { customer: customerView(ctx) }; },
    updateCustomerEmail: ({ email }, ctx) => { saveCustomer({ ...getCustomer(), email }); return { customer: customerView(ctx) }; },
    changeCustomerPassword: (args, ctx) => customerView(ctx),
    subscribeEmailToNewsletter: () => ({ status: 'SUBSCRIBED' }),
    createCustomerAddress: ({ input = {} }) => {
      const c = getCustomer();
      const id = Math.max(0, ...c.addresses.map((a) => a.id)) + 1;
      const a = { ...toAddress(input), id, default_shipping: !!input.default_shipping, default_billing: !!input.default_billing };
      if (a.default_shipping) c.addresses.forEach((x) => { x.default_shipping = false; });
      if (a.default_billing) c.addresses.forEach((x) => { x.default_billing = false; });
      c.addresses.push(a); saveCustomer(c);
      return customerAddressView(a);
    },
    updateCustomerAddress: ({ id, uid: auid, input = {} }) => {
      const c = getCustomer();
      const a = c.addresses.find((x) => String(x.id) === String(id) || b64(`caddr-${x.id}`) === auid);
      if (!a) throw new Error('Address not found');
      Object.assign(a, toAddress({ ...a, ...input }), { default_shipping: input.default_shipping ?? a.default_shipping, default_billing: input.default_billing ?? a.default_billing });
      saveCustomer(c);
      return customerAddressView(a);
    },
    updateCustomerAddressV2: (args) => coreResolvers.mutation.updateCustomerAddress(args),
    deleteCustomerAddress: ({ id }) => { const c = getCustomer(); c.addresses = c.addresses.filter((a) => String(a.id) !== String(id)); saveCustomer(c); return true; },
    deleteCustomerAddressV2: ({ uid: auid }) => { const c = getCustomer(); c.addresses = c.addresses.filter((a) => b64(`caddr-${a.id}`) !== auid); saveCustomer(c); return true; },
    reorderItems: ({ orderNumber }) => {
      const o = seedOrders().find((x) => x.number === orderNumber);
      let id = store.get('customerCartId', null);
      if (!id) { id = newCart(); store.set('customerCartId', id); }
      const s = getCartState(id);
      (o?.lines || []).forEach((l) => s.items.push({ uid: b64(`item-${uid()}`), sku: l.product.sku, quantity: l.quantity, options: (l.configurable_options || []).map((x) => x.configurable_product_option_value_uid) }));
      saveCartState(s);
      return { cart: buildCart(s), userInputErrors: [] };
    },
    cancelOrder: ({ input = {} }) => {
      const all = seedOrders(); const o = all.find((x) => atob(input.order_id || '').endsWith(x.number) || x.number === input.order_id);
      if (o) { o.status = 'Canceled'; store.set('orders', all); }
      return { order: o ? orderView(o) : null, error: null, errorV2: null };
    },
    addProductsToWishlist: () => ({ wishlist: { id: '1', items_count: 0, items_v2: { items: [] } }, user_errors: [] }),
    removeProductsFromWishlist: () => ({ wishlist: { id: '1', items_count: 0, items_v2: { items: [] } }, user_errors: [] }),
  },
};
