export type ProductCategory = 'kurti' | 'dress' | 'top' | 'waistcoat'

export type ProductSize = 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'Free size'

export type ColorEvidence =
  | 'explicitly-listed'
  | 'catalogue-name'
  | 'catalogue-photo'
  | 'demo-entered'

export interface ProductColor {
  label: string
  evidence: ColorEvidence
  selectable: boolean
}

export interface CropRectangle {
  x: number
  y: number
  width: number
  height: number
}

export interface CatalogueSource {
  fileName: string
  crop: CropRectangle
  notes?: string
}

interface ProductIdentity {
  id: string
  slug: string
  sizes: readonly ProductSize[]
  colors: readonly ProductColor[]
  image: string
}

interface CatalogueProductBase extends ProductIdentity {
  catalogueName: string | null
  priceInPaise: number | null
  category: ProductCategory | null
  source: CatalogueSource
}

export interface SellableProduct extends CatalogueProductBase {
  status: 'sellable'
  catalogueName: string
  priceInPaise: number
  category: ProductCategory
}

export interface ReferenceOnlyProduct extends CatalogueProductBase {
  status: 'reference-only'
  reason: 'missing-name-and-price'
  catalogueName: null
  priceInPaise: null
  category: null
}

export type Product = SellableProduct | ReferenceOnlyProduct

export type DemoProductStatus = 'active' | 'draft'

export interface DemoProduct extends ProductIdentity {
  status: 'demo-created'
  catalogueName: string
  priceInPaise: number
  category: ProductCategory
  publicationStatus: DemoProductStatus
  description: string
  createdAt: string
  updatedAt: string
}

export type CommerceProduct = SellableProduct | DemoProduct

export function isDemoProduct(
  product: CommerceProduct,
): product is DemoProduct {
  return product.status === 'demo-created'
}

export function isProductActive(product: CommerceProduct) {
  return product.status === 'sellable' || product.publicationStatus === 'active'
}
