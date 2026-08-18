import type {
  ProductCategory,
  ProductImageGallery,
  ProductVariantOption,
  SellableProduct,
} from './productTypes'

interface ProductDefinition {
  id: string
  slug: string
  name: string
  price: number | null
  category: ProductCategory
  description: string
  color: string
  images: ProductImageGallery
  isDemoProduct: boolean
  variantOptions?: readonly ProductVariantOption[]
  source: SellableProduct['source']
}

function defineProduct(definition: ProductDefinition): SellableProduct {
  const { color, variantOptions, ...product } = definition

  return {
    ...product,
    catalogueName: definition.name,
    nameProvenance: definition.isDemoProduct
      ? 'generated-demo'
      : 'descriptive-working-label',
    priceInPaise:
      definition.price === null ? null : definition.price * 100,
    priceStatus: definition.isDemoProduct ? 'demo' : 'unknown',
    attributes: [
      {
        label: 'Visible appearance',
        value: color,
        evidence: definition.isDemoProduct
          ? 'generated-demo'
          : 'visual-source',
      },
    ],
    variantOptions: variantOptions ?? [],
    status: 'sellable',
  }
}

export const products = [
  defineProduct({
    id: 'jg-real-001',
    slug: 'floral-drop-necklace',
    name: 'Floral Drop Necklace',
    price: null,
    category: 'necklace',
    description:
      'A delicate necklace with alternating clear teardrop and floral motifs, presented exactly as visible in the supplied Jewellgalleria source.',
    color: 'Yellow-tone with clear details',
    images: [
      '/products/real/floral-drop-necklace/hero.jpg',
      '/products/real/floral-drop-necklace/detail-01.jpg',
      '/products/real/floral-drop-necklace/editorial.jpg',
    ],
    isDemoProduct: false,
    source: {
      kind: 'real-screenshot',
      fileName: 'Screenshot 2026-08-17 045722.png',
      notes:
        'Descriptive working label only; official name and price are not supplied. Material, stone type, dimensions and rear closure are not established by the source.',
    },
  }),
  defineProduct({
    id: 'jg-real-009',
    slug: 'heritage-jhumka-earrings',
    name: 'Heritage Jhumka Earrings',
    price: null,
    category: 'earrings',
    description:
      'An ornate front-facing pair with red, green and clear decorative details, bell-shaped drops and layered bead fringe.',
    color: 'Yellow-tone with red, green and clear details',
    images: [
      '/products/real/heritage-jhumka-earrings/hero.jpg',
      '/products/real/heritage-jhumka-earrings/detail-01.jpg',
      '/products/real/heritage-jhumka-earrings/editorial.jpg',
    ],
    isDemoProduct: false,
    source: {
      kind: 'real-screenshot',
      fileName: 'Screenshot 2026-08-17 050015.png',
      notes:
        'Front view only. Official name and price, material, stones and fastening are not supplied.',
    },
  }),
  defineProduct({
    id: 'jg-real-010',
    slug: 'pear-drop-statement-necklace',
    name: 'Pear Drop Statement Necklace',
    price: null,
    category: 'necklace',
    description:
      'A symmetrical two-row necklace with clear square and pear-shaped elements, preserved from the supplied worn view.',
    color: 'Yellow-tone with clear details',
    images: [
      '/products/real/pear-drop-statement-necklace/hero.jpg',
      '/products/real/pear-drop-statement-necklace/detail-01.jpg',
      '/products/real/pear-drop-statement-necklace/editorial.jpg',
    ],
    isDemoProduct: false,
    source: {
      kind: 'real-screenshot',
      fileName: 'Screenshot 2026-08-17 050030.png',
      notes:
        'Front neckline view only. Official name and price, rear chain, clasp, materials and dimensions are not supplied.',
    },
  }),
  defineProduct({
    id: 'jg-real-013',
    slug: 'cascading-chandelier-earring',
    name: 'Cascading Chandelier Earring',
    price: null,
    category: 'earrings',
    description:
      'A long chandelier design with a floral top and articulated strands of clear pear-shaped and round elements.',
    color: 'Pale-tone with clear details',
    images: [
      '/products/real/cascading-chandelier-earring/hero.jpg',
      '/products/real/cascading-chandelier-earring/detail-01.jpg',
      '/products/real/cascading-chandelier-earring/editorial.jpg',
    ],
    isDemoProduct: false,
    source: {
      kind: 'real-screenshot',
      fileName: 'Screenshot 2026-08-17 050135.png',
      notes:
        'Only one worn earring is visible. Official name and price, pairing, fastening, materials and dimensions require seller confirmation.',
    },
  }),
  defineProduct({
    id: 'jg-real-005',
    slug: 'pearl-floral-ear-climber',
    name: 'Pearl-Like Floral Ear Climber',
    price: null,
    category: 'earrings',
    description:
      'A diagonal ear piece combining clear floral and leaf-like elements with several luminous pearl-like round details.',
    color: 'Pale-tone with clear and pearl-like details',
    images: [
      '/products/real/pearl-floral-ear-climber/hero.jpg',
      '/products/real/pearl-floral-ear-climber/detail-01.jpg',
      '/products/real/pearl-floral-ear-climber/editorial.jpg',
    ],
    isDemoProduct: false,
    source: {
      kind: 'real-screenshot',
      fileName: 'Screenshot 2026-08-17 050321.png',
      notes:
        'Canonical duplicate of 045911. Official name and price are not supplied. Only one worn front view is visible; pearl and stone materials are not claimed.',
    },
  }),
  defineProduct({
    id: 'jg-real-004',
    slug: 'two-row-statement-ring',
    name: 'Two-Row Statement Ring',
    price: null,
    category: 'ring',
    description:
      'Two closely arranged rows of clear geometric elements, shown on the hand exactly as supplied.',
    color: 'Pale-tone with clear details',
    images: [
      '/products/real/two-row-statement-ring/hero.jpg',
      '/products/real/two-row-statement-ring/detail-01.jpg',
      '/products/real/two-row-statement-ring/editorial.jpg',
    ],
    isDemoProduct: false,
    source: {
      kind: 'real-screenshot',
      fileName: 'Screenshot 2026-08-17 045854.png',
      notes:
        'Official name and price are not supplied. Seller confirmation is required on whether the visual is one multi-row ring or a coordinated stack. No hidden shank is reconstructed.',
    },
  }),
  defineProduct({
    id: 'jg-real-011',
    slug: 'solitaire-fan-earring',
    name: 'Solitaire Fan Earring',
    price: null,
    category: 'earrings',
    description:
      'A large round clear stud above a shallow fan of five clear geometric drops, taken from the supplied worn view.',
    color: 'Pale-tone with clear details',
    images: [
      '/products/real/solitaire-fan-earring/hero.jpg',
      '/products/real/solitaire-fan-earring/detail-01.jpg',
      '/products/real/solitaire-fan-earring/editorial.jpg',
    ],
    isDemoProduct: false,
    source: {
      kind: 'real-screenshot',
      fileName: 'Screenshot 2026-08-17 050053.png',
      notes:
        'Official name and price are not supplied. Only one worn front view is visible; pairing, fastening, materials and dimensions are not supplied.',
    },
  }),
  defineProduct({
    id: 'jg-real-015',
    slug: 'toggle-pendant-necklace',
    name: 'Toggle Pendant Necklace',
    price: null,
    category: 'necklace',
    description:
      'A circular-link necklace with a front toggle detail and an irregular luminous white centerpiece in a textured border.',
    color: 'Yellow-tone with white centerpiece',
    images: [
      '/products/real/toggle-pendant-necklace/hero.jpg',
      '/products/real/toggle-pendant-necklace/detail-01.jpg',
      '/products/real/toggle-pendant-necklace/editorial.jpg',
    ],
    isDemoProduct: false,
    source: {
      kind: 'real-screenshot',
      fileName: 'Screenshot 2026-08-17 050235.png',
      notes:
        'Official name and price are not supplied. The white centerpiece material, rear chain and dimensions are not established by the supplied view.',
    },
  }),
  defineProduct({
    id: 'jg-real-006',
    slug: 'multicolour-oval-bracelet',
    name: 'Multicolour Oval Bracelet',
    price: null,
    category: 'bracelet',
    description:
      'A fine bracelet with alternating multicoloured oval settings, retained from the supplied wrist view.',
    color: 'Yellow-tone with multicoloured details',
    images: [
      '/products/real/multicolour-oval-bracelet/hero.jpg',
      '/products/real/multicolour-oval-bracelet/detail-01.jpg',
      '/products/real/multicolour-oval-bracelet/editorial.jpg',
    ],
    isDemoProduct: false,
    source: {
      kind: 'real-screenshot',
      fileName: 'Screenshot 2026-08-17 045927.png',
      notes:
        'Official name and price are not supplied. Only the visible front section is documented; clasp, materials and dimensions are not shown.',
    },
  }),
  defineProduct({
    id: 'jg-real-008',
    slug: 'oval-marquise-bracelet',
    name: 'Oval and Marquise Bracelet',
    price: null,
    category: 'bracelet',
    description:
      'A delicate bracelet of pale oval settings and paired marquise-shaped details with a small pink accent.',
    color: 'Yellow-tone with pale and pink details',
    images: [
      '/products/real/oval-marquise-bracelet/hero.jpg',
      '/products/real/oval-marquise-bracelet/detail-01.jpg',
      '/products/real/oval-marquise-bracelet/editorial.jpg',
    ],
    isDemoProduct: false,
    source: {
      kind: 'real-screenshot',
      fileName: 'Screenshot 2026-08-17 045959.png',
      notes:
        'Official name and price are not supplied. Only the visible worn section is documented; clasp, materials and dimensions are not shown.',
    },
  }),
  defineProduct({
    id: 'jg-demo-001',
    slug: 'wave-station-ring',
    name: 'Wave Station Ring',
    price: 1_790,
    category: 'ring',
    description:
      'A slender original wave-shaped demo ring with three clear round stations, created to add an everyday ring option to the private concept catalogue.',
    color: 'Yellow-tone with clear details',
    images: [
      '/products/demo/wave-station-ring/hero.jpg',
      '/products/demo/wave-station-ring/detail-01.jpg',
      '/products/demo/wave-station-ring/detail-02.jpg',
      '/products/demo/wave-station-ring/editorial.jpg',
    ],
    isDemoProduct: true,
    variantOptions: [
      {
        id: 'ring-size',
        name: 'Ring Size',
        values: ['6', '7', '8'],
      },
    ],
    source: {
      kind: 'generated-demo',
      fileName: '_source.png',
      notes:
        'Fictional product created for catalogue depth. This is not an actual Jewellgalleria catalogue item.',
    },
  }),
  defineProduct({
    id: 'jg-demo-002',
    slug: 'asymmetric-stone-huggies',
    name: 'Asymmetric Stone Huggies',
    price: 1_490,
    category: 'earrings',
    description:
      'An original pair of rounded everyday demo huggies with a restrained asymmetric line of clear details.',
    color: 'Yellow-tone with clear details',
    images: [
      '/products/demo/asymmetric-stone-huggies/hero.jpg',
      '/products/demo/asymmetric-stone-huggies/detail-01.jpg',
      '/products/demo/asymmetric-stone-huggies/detail-02.jpg',
      '/products/demo/asymmetric-stone-huggies/editorial.jpg',
    ],
    isDemoProduct: true,
    source: {
      kind: 'generated-demo',
      fileName: '_source.png',
      notes:
        'Fictional product created for catalogue depth. This is not an actual Jewellgalleria catalogue item.',
    },
  }),
  defineProduct({
    id: 'jg-demo-003',
    slug: 'seven-station-anklet',
    name: 'Seven Station Anklet',
    price: 1_690,
    category: 'anklet',
    description:
      'An original fine-chain demo anklet with seven evenly spaced clear stations and a visible clasp.',
    color: 'Yellow-tone with clear details',
    images: [
      '/products/demo/seven-station-anklet/hero.jpg',
      '/products/demo/seven-station-anklet/detail-01.jpg',
      '/products/demo/seven-station-anklet/detail-02.jpg',
      '/products/demo/seven-station-anklet/editorial.jpg',
    ],
    isDemoProduct: true,
    variantOptions: [
      {
        id: 'length',
        name: 'Length',
        values: ['9 in', '10 in'],
      },
    ],
    source: {
      kind: 'generated-demo',
      fileName: '_source.png',
      notes:
        'Fictional product created for catalogue depth. This is not an actual Jewellgalleria catalogue item.',
    },
  }),
] as const satisfies readonly SellableProduct[]

export const realProducts = products.filter((product) => !product.isDemoProduct)
export const demoProducts = products.filter((product) => product.isDemoProduct)
export const sellableProducts = [...realProducts, ...demoProducts]

export function findProductBySlug(slug: string) {
  return products.find((product) => product.slug === slug)
}
