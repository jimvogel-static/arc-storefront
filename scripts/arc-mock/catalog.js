/*
 * ARC mock — fictional Bounteous ARC merch catalog.
 * Everything here is demo data. No real inventory, pricing, or orders.
 */

export const CURRENCY = 'USD';

export const CATEGORIES = [
  { id: '10', name: 'Apparel', urlKey: 'apparel', path: 'apparel' },
  { id: '20', name: 'Drinkware', urlKey: 'drinkware', path: 'drinkware' },
  { id: '30', name: 'Desk & Office', urlKey: 'desk', path: 'desk' },
  { id: '40', name: 'Accessories', urlKey: 'accessories', path: 'accessories' },
];

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

/*
 * art: which illustration family to draw (see images/arc).
 * colors: optional color option (configurable). Each color has its own image set.
 */
export const PRODUCTS = [
  // ---------- Apparel ----------
  {
    sku: 'ARC-HD-001', name: 'ARC Midnight Hoodie', urlKey: 'arc-midnight-hoodie', category: 'apparel', price: 68, position: 100,
    short: 'Heavyweight fleece hoodie with tonal ARC chest mark.',
    description: '<p>A 400gsm brushed-back fleece hoodie in Midnight with a tonal embroidered ARC mark and Purple Rain drawcord tips.</p><ul><li>80% organic cotton, 20% recycled polyester</li><li>Relaxed fit, dropped shoulder</li><li>Kangaroo pocket with hidden phone sleeve</li></ul>',
    sizes: SIZES, collection: 'Core', material: 'Cotton blend',
    colors: [
      { id: 'midnight', label: 'Midnight', hex: '#0B111C', images: ['ARC-HD-001-midnight-1', 'ARC-HD-001-midnight-2'] },
      { id: 'indigo', label: 'Indigo', hex: '#33139F', images: ['ARC-HD-001-indigo-1', 'ARC-HD-001-indigo-2'] },
    ],
  },
  {
    sku: 'ARC-TS-002', name: 'Gradient Signal Tee', urlKey: 'gradient-signal-tee', category: 'apparel', price: 32, position: 95,
    short: 'Soft-wash tee with the Electric Blue to Purple Rain signal print.',
    description: '<p>Our everyday tee, garment-washed for a broken-in feel. Front print uses the signature Electric Blue to Purple Rain gradient.</p><ul><li>100% combed ring-spun cotton</li><li>Water-based inks</li></ul>',
    sizes: SIZES, collection: 'Signal', material: 'Cotton',
    colors: [
      { id: 'white', label: 'Paper White', hex: '#FAFAFC', images: ['ARC-TS-002-white-1', 'ARC-TS-002-white-2'] },
      { id: 'midnight', label: 'Midnight', hex: '#0B111C', images: ['ARC-TS-002-midnight-1', 'ARC-TS-002-midnight-2'] },
    ],
  },
  {
    sku: 'ARC-QZ-003', name: 'Purple Rain Quarter-Zip', urlKey: 'purple-rain-quarter-zip', category: 'apparel', price: 84, position: 90,
    short: 'Lightweight performance quarter-zip for travel days.',
    description: '<p>A four-way stretch midlayer that packs small and looks sharp on client site. Bonded zip pocket and thumb loops.</p>',
    sizes: SIZES, collection: 'Core', material: 'Performance knit', images: ['ARC-QZ-003-1', 'ARC-QZ-003-2'],
  },
  {
    sku: 'ARC-CP-004', name: 'ARC Dad Cap', urlKey: 'arc-dad-cap', category: 'apparel', price: 28, position: 85,
    short: 'Unstructured six-panel cap with embroidered ARC mark.',
    description: '<p>Washed cotton twill, curved brim, and an adjustable brass buckle.</p>',
    collection: 'Core', material: 'Cotton', images: ['ARC-CP-004-1'], salePrice: 22,
  },
  {
    sku: 'ARC-BN-005', name: 'Indigo Rib Beanie', urlKey: 'indigo-rib-beanie', category: 'apparel', price: 24, position: 80,
    short: 'Merino-blend rib-knit beanie with woven label.',
    description: '<p>Warm, breathable, and itch-free. One size fits most.</p>',
    collection: 'Signal', material: 'Merino blend', images: ['ARC-BN-005-1'],
  },

  // ---------- Drinkware ----------
  {
    sku: 'ARC-BT-010', name: 'ARC Insulated Bottle 24oz', urlKey: 'arc-insulated-bottle', category: 'drinkware', price: 36, position: 100,
    short: 'Double-wall stainless bottle. Cold 24h, hot 12h.',
    description: '<p>Powder-coated stainless steel with a leak-proof carry cap and laser-etched ARC mark.</p>',
    collection: 'Core', material: 'Stainless steel', images: ['ARC-BT-010-1', 'ARC-BT-010-2'],
  },
  {
    sku: 'ARC-MG-011', name: 'Midnight Camp Mug', urlKey: 'midnight-camp-mug', category: 'drinkware', price: 18, position: 95,
    short: 'Enamel camp mug with a speckled Midnight finish.',
    description: '<p>12oz enamel-coated steel mug. Great for standups and campfires alike.</p>',
    collection: 'Core', material: 'Enamel steel', images: ['ARC-MG-011-1'],
  },
  {
    sku: 'ARC-TB-012', name: 'Electric Blue Tumbler', urlKey: 'electric-blue-tumbler', category: 'drinkware', price: 30, position: 90,
    short: '20oz tumbler with slide lid and straw.',
    description: '<p>Vacuum-insulated, fits most cup holders, dishwasher safe lid.</p>',
    collection: 'Signal', material: 'Stainless steel', images: ['ARC-TB-012-1'], salePrice: 24,
  },
  {
    sku: 'ARC-GL-013', name: 'Cold Brew Glass Set', urlKey: 'cold-brew-glass-set', category: 'drinkware', price: 26, position: 85,
    short: 'Set of two 16oz glasses with bamboo lids.',
    description: '<p>Borosilicate glass with a subtle etched ARC wordmark.</p>',
    collection: 'Signal', material: 'Glass', images: ['ARC-GL-013-1'],
  },

  // ---------- Desk & Office ----------
  {
    sku: 'ARC-NB-020', name: 'ARC Dot-Grid Notebook', urlKey: 'arc-dot-grid-notebook', category: 'desk', price: 16, position: 100,
    short: 'A5 lay-flat notebook, 160 pages of 100gsm dot grid.',
    description: '<p>Linen cover, numbered pages, two ribbon markers. Built for whiteboard-to-notebook thinkers.</p>',
    collection: 'Core', material: 'Paper', images: ['ARC-NB-020-1', 'ARC-NB-020-2'],
  },
  {
    sku: 'ARC-DM-021', name: 'Glass Effect Desk Mat', urlKey: 'glass-effect-desk-mat', category: 'desk', price: 34, position: 95,
    short: 'Oversized felt-and-cork desk mat.',
    description: '<p>90 × 40cm. Non-slip cork base, smooth merino felt top.</p>',
    collection: 'Signal', material: 'Felt & cork', images: ['ARC-DM-021-1'],
  },
  {
    sku: 'ARC-PN-022', name: 'Brushed Pen Set', urlKey: 'brushed-pen-set', category: 'desk', price: 22, position: 90,
    short: 'Two brushed-aluminum gel pens in a gift sleeve.',
    description: '<p>0.5mm black gel refills. Refillable and weighted for long workshops.</p>',
    collection: 'Core', material: 'Aluminum', images: ['ARC-PN-022-1'],
  },
  {
    sku: 'ARC-SK-023', name: 'Sticker Pack', urlKey: 'arc-sticker-pack', category: 'desk', price: 8, position: 85,
    short: 'Ten die-cut vinyl stickers.',
    description: '<p>Weatherproof, laptop-safe, and very on-brand.</p>',
    collection: 'Signal', material: 'Vinyl', images: ['ARC-SK-023-1'],
  },

  // ---------- Accessories ----------
  {
    sku: 'ARC-TT-030', name: 'Weekender Tote', urlKey: 'weekender-tote', category: 'accessories', price: 42, position: 100,
    short: '16oz canvas tote with leather handles.',
    description: '<p>Heavy cotton canvas, interior zip pocket, and a magnetic snap closure.</p>',
    collection: 'Core', material: 'Canvas', images: ['ARC-TT-030-1', 'ARC-TT-030-2'],
  },
  {
    sku: 'ARC-PC-031', name: 'Tech Pouch', urlKey: 'tech-pouch', category: 'accessories', price: 29, position: 95,
    short: 'Zip pouch with elastic loops for cables and chargers.',
    description: '<p>Water-resistant recycled nylon with a padded base.</p>',
    collection: 'Core', material: 'Recycled nylon', images: ['ARC-PC-031-1'],
  },
  {
    sku: 'ARC-LS-032', name: '14" Laptop Sleeve', urlKey: 'laptop-sleeve', category: 'accessories', price: 48, position: 90,
    short: 'Padded felt laptop sleeve with front pocket.',
    description: '<p>Fits most 13–14" laptops. Wool felt exterior, microfleece lining.</p>',
    collection: 'Signal', material: 'Wool felt', images: ['ARC-LS-032-1'], inStock: false,
  },
  {
    sku: 'ARC-PN-033', name: 'Enamel Pin Set', urlKey: 'enamel-pin-set', category: 'accessories', price: 14, position: 85,
    short: 'Three hard-enamel pins on a backing card.',
    description: '<p>Gold-plated, rubber clutches, collectible.</p>',
    collection: 'Signal', material: 'Enamel', images: ['ARC-PN-033-1'],
  },
  {
    sku: 'ARC-LY-034', name: 'Woven Lanyard', urlKey: 'woven-lanyard', category: 'accessories', price: 10, position: 80,
    short: 'Jacquard-woven lanyard with breakaway clasp.',
    description: '<p>Event-ready. Includes swivel hook.</p>',
    collection: 'Core', material: 'Polyester', images: ['ARC-LY-034-1'],
  },
];

export function findProduct(sku) {
  if (!sku) return null;
  const s = String(sku).toUpperCase();
  return PRODUCTS.find((p) => p.sku === s)
    || PRODUCTS.find((p) => s.startsWith(`${p.sku}-`)) // variant sku → parent
    || null;
}

export function findCategory(pathOrId) {
  return CATEGORIES.find((c) => c.path === pathOrId || c.id === pathOrId || c.urlKey === pathOrId) || null;
}
