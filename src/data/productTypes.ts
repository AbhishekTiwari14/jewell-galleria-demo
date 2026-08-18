export type ProductCategory =
  | 'necklace'
  | 'earrings'
  | 'bracelet'
  | 'ring'
  | 'anklet'

export type ProductImageGallery = readonly [string, ...string[]]

export type ProductNameProvenance =
  | 'descriptive-working-label'
  | 'generated-demo'

export type ProductAttributeEvidence =
  | 'visual-source'
  | 'generated-demo'
  | 'demo-entered'

export interface ProductAttribute {
  label: string
  value: string
  evidence: ProductAttributeEvidence
}

export type JewelleryOptionName =
  | 'Ring Size'
  | 'Finish'
  | 'Color'
  | 'Length'
  | 'Stone'

export interface ProductVariantOption {
  id: string
  name: JewelleryOptionName
  values: readonly [string, ...string[]]
}

export type ProductSelection = Readonly<Record<string, string>>

export interface CatalogueSource {
  kind: 'real-screenshot' | 'generated-demo'
  fileName: string
  notes?: string
}

interface ProductIdentity {
  id: string
  slug: string
  name: string
  catalogueName: string
  nameProvenance: ProductNameProvenance
  price: number | null
  priceInPaise: number | null
  priceStatus: 'unknown' | 'demo'
  category: ProductCategory
  description: string
  attributes: readonly ProductAttribute[]
  variantOptions: readonly ProductVariantOption[]
  images: ProductImageGallery
  isDemoProduct: boolean
}

export interface SellableProduct extends ProductIdentity {
  status: 'sellable'
  source: CatalogueSource
}

export type Product = SellableProduct

export type DemoProductStatus = 'active' | 'draft'

export interface DemoProduct extends ProductIdentity {
  status: 'demo-created'
  isDemoProduct: true
  publicationStatus: DemoProductStatus
  createdAt: string
  updatedAt: string
}

export type CommerceProduct = SellableProduct | DemoProduct

export function isDemoProduct(product: CommerceProduct) {
  return product.isDemoProduct
}

export function isProductActive(product: CommerceProduct) {
  return product.status === 'sellable' || product.publicationStatus === 'active'
}

export function getDefaultSelection(product: CommerceProduct): ProductSelection {
  return Object.fromEntries(
    product.variantOptions.map((option) => [option.id, option.values[0]]),
  )
}

export function getProductSelections(
  product: CommerceProduct,
): ProductSelection[] {
  return product.variantOptions.reduce<ProductSelection[]>(
    (combinations, option) =>
      combinations.flatMap((combination) =>
        option.values.map((value) => ({ ...combination, [option.id]: value })),
      ),
    [{}],
  )
}

export function formatProductSelection(
  product: CommerceProduct,
  selection: ProductSelection,
) {
  return product.variantOptions
    .map((option) => {
      const value = selection[option.id]
      return value ? `${option.name}: ${value}` : null
    })
    .filter((value): value is string => value !== null)
    .join(' · ')
}
