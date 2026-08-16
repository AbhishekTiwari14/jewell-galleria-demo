import type { Product } from './productTypes'

export const products = [
  {
    id: 'ovia-001',
    slug: 'lime-shells-corset-kurti',
    catalogueName: 'Lime Shells Corset Kurti',
    priceInPaise: 39_900,
    sizes: ['S', 'M', 'L'],
    colors: [
      { label: 'Lime', evidence: 'catalogue-name', selectable: false },
    ],
    category: 'kurti',
    image: '/products/lime-shells-corset-kurti/primary.png',
    source: {
      fileName: 'Screenshot 2026-08-13 065518.png',
      crop: { x: 50, y: 63, width: 320, height: 393 },
    },
    status: 'sellable',
  },
  {
    id: 'ovia-002',
    slug: 'green-heart-corset-kurti',
    catalogueName: 'Green Heart Corset Kurti🍀',
    priceInPaise: 55_900,
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colors: [
      {
        label: 'White with green heart details',
        evidence: 'catalogue-photo',
        selectable: false,
      },
    ],
    category: 'kurti',
    image: '/products/green-heart-corset-kurti/primary.png',
    source: {
      fileName: 'Screenshot 2026-08-13 065551.png',
      crop: { x: 41, y: 59, width: 320, height: 399 },
    },
    status: 'sellable',
  },
  {
    id: 'ovia-003',
    slug: 'purple-shell-kurti',
    catalogueName: 'Purple Shell Kurti💜',
    priceInPaise: 45_900,
    sizes: ['M', 'L', 'XL', 'XXL'],
    colors: [
      { label: 'Purple', evidence: 'catalogue-name', selectable: false },
    ],
    category: 'kurti',
    image: '/products/purple-shell-kurti/primary.png',
    source: {
      fileName: 'Screenshot 2026-08-13 065711.png',
      crop: { x: 49, y: 63, width: 320, height: 398 },
    },
    status: 'sellable',
  },
  {
    id: 'ovia-004',
    slug: 'beige-off-shoulder-one-piece',
    catalogueName: 'Beige off shoulder one piece🔥',
    priceInPaise: 99_900,
    sizes: ['Free size'],
    colors: [
      { label: 'Beige', evidence: 'catalogue-name', selectable: false },
    ],
    category: 'dress',
    image: '/products/beige-off-shoulder-one-piece/primary.png',
    source: {
      fileName: 'Screenshot 2026-08-13 065741.png',
      crop: { x: 49, y: 58, width: 320, height: 399 },
    },
    status: 'sellable',
  },
  {
    id: 'ovia-005',
    slug: 'white-one-shoulder-piece',
    catalogueName: 'White One shoulder piece🤍',
    priceInPaise: 99_900,
    sizes: ['S', 'M'],
    colors: [
      { label: 'White', evidence: 'catalogue-name', selectable: false },
    ],
    category: 'dress',
    image: '/products/white-one-shoulder-piece/primary.png',
    source: {
      fileName: 'Screenshot 2026-08-13 065802.png',
      crop: { x: 48, y: 65, width: 320, height: 400 },
    },
    status: 'sellable',
  },
  {
    id: 'ovia-006',
    slug: 'brown-off-shoulder-dress',
    catalogueName: 'Brown Off Shoulder Dress',
    priceInPaise: 119_900,
    sizes: ['S', 'M'],
    colors: [
      { label: 'Brown', evidence: 'catalogue-name', selectable: false },
    ],
    category: 'dress',
    image: '/products/brown-off-shoulder-dress/primary.png',
    source: {
      fileName: 'Screenshot 2026-08-13 065825.png',
      crop: { x: 44, y: 60, width: 320, height: 397 },
    },
    status: 'sellable',
  },
  {
    id: 'ovia-ref-065851',
    slug: 'catalogue-item-065851',
    catalogueName: null,
    priceInPaise: null,
    sizes: ['S', 'M', 'L'],
    colors: [
      { label: 'Black', evidence: 'catalogue-photo', selectable: false },
    ],
    category: null,
    image: '/products/catalogue-item-065851/primary.png',
    source: {
      fileName: 'Screenshot 2026-08-13 065851.png',
      crop: { x: 26, y: 42, width: 584, height: 465 },
      notes: 'Name and price are not visible; retained as a reference-only item.',
    },
    status: 'reference-only',
    reason: 'missing-name-and-price',
  },
  {
    id: 'ovia-007',
    slug: 'lace-trimmed-top',
    catalogueName: 'Lace trimmed top',
    priceInPaise: 49_900,
    sizes: ['S'],
    colors: [
      { label: 'Red', evidence: 'explicitly-listed', selectable: true },
      { label: 'Cream', evidence: 'explicitly-listed', selectable: true },
      { label: 'Black', evidence: 'explicitly-listed', selectable: true },
      { label: 'Brown', evidence: 'explicitly-listed', selectable: true },
    ],
    category: 'top',
    image: '/products/lace-trimmed-top/primary.png',
    source: {
      fileName: 'Screenshot 2026-08-13 065916.png',
      crop: { x: 87, y: 58, width: 257, height: 388 },
      notes:
        'Left edge is cropped to remove the overlaid carousel control without retouching the garment.',
    },
    status: 'sellable',
  },
  {
    id: 'ovia-008',
    slug: 'waist-coat',
    catalogueName: 'Waist Coat',
    priceInPaise: 49_900,
    sizes: ['S'],
    colors: [
      { label: 'Black', evidence: 'catalogue-photo', selectable: false },
    ],
    category: 'waistcoat',
    image: '/products/waist-coat/primary.png',
    source: {
      fileName: 'Screenshot 2026-08-13 065953.png',
      crop: { x: 69, y: 58, width: 275, height: 389 },
      notes: 'Left edge is cropped to remove the overlaid carousel control.',
    },
    status: 'sellable',
  },
  {
    id: 'ovia-009',
    slug: 'brown-ombre-top',
    catalogueName: 'Brown Ombre top',
    priceInPaise: 59_900,
    sizes: ['S'],
    colors: [
      { label: 'Brown', evidence: 'catalogue-name', selectable: false },
    ],
    category: 'top',
    image: '/products/brown-ombre-top/primary.png',
    source: {
      fileName: 'Screenshot 2026-08-13 070014.png',
      crop: { x: 46, y: 63, width: 320, height: 400 },
    },
    status: 'sellable',
  },
  {
    id: 'ovia-010',
    slug: 'red-ombre-top',
    catalogueName: 'Red ombre top❤️',
    priceInPaise: 59_900,
    sizes: ['S'],
    colors: [
      { label: 'Red', evidence: 'catalogue-name', selectable: false },
    ],
    category: 'top',
    image: '/products/red-ombre-top/primary.png',
    source: {
      fileName: 'Screenshot 2026-08-13 070038.png',
      crop: { x: 39, y: 65, width: 291, height: 389 },
      notes:
        'Left edge is cropped to remove the overlaid carousel control without retouching the garment.',
    },
    status: 'sellable',
  },
] as const satisfies readonly Product[]

export const sellableProducts = products.filter(
  (product) => product.status === 'sellable',
)

export function findProductBySlug(slug: string) {
  return products.find((product) => product.slug === slug)
}
