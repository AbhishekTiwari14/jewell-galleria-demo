import { ArrowUpRight, PackageCheck, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'

import { BusinessPageHeader } from '../../components/business/BusinessPageHeader'
import { Container } from '../../components/layout/LayoutPrimitives'
import { sellableProducts } from '../../data/products'
import { isProductActive, type CommerceProduct } from '../../data/productTypes'
import { getProductStock } from '../../lib/business'
import { classNames } from '../../lib/classNames'
import { formatInr } from '../../lib/currency'
import { useDemoStore } from '../../store/demoStore'

const categoryLabels = {
  dress: 'Dress',
  kurti: 'Kurti',
  top: 'Top',
  waistcoat: 'Waistcoat',
} as const

function ProductRow({
  product,
  inventory,
}: {
  product: CommerceProduct
  inventory: Record<string, number>
}) {
  const isCreated = product.status === 'demo-created'
  const active = isProductActive(product)
  const stock = getProductStock(product, inventory)
  const destination = isCreated
    ? `/business/products/${product.id}`
    : `/business/inventory?product=${product.id}`

  return (
    <article
      className="flex min-w-0 gap-4 bg-white p-4 sm:p-5"
      data-testid={`business-product-${product.slug}`}
    >
      <img
        alt={product.catalogueName}
        className="h-28 w-22 shrink-0 rounded-xl bg-ovia-ivory object-cover object-top"
        src={product.image}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[0.68rem] font-bold tracking-[0.1em] text-ovia-primary uppercase">
              {categoryLabels[product.category]} · {isCreated ? 'Demo-created' : 'Ovia catalogue'}
            </p>
            <h2 className="mt-1 line-clamp-2 text-sm leading-5 font-bold text-ovia-ink">
              <Link className="hover:text-ovia-primary" to={destination}>{product.catalogueName}</Link>
            </h2>
          </div>
          <span
            className={classNames(
              'shrink-0 rounded-full px-2 py-1 text-[0.65rem] font-bold',
              active
                ? 'bg-[#e6f2eb] text-ovia-success'
                : 'bg-ovia-ivory text-ovia-muted',
            )}
          >
            {active ? 'Active' : 'Draft'}
          </span>
        </div>
        <p className="mt-1 text-sm font-semibold text-ovia-plum">{formatInr(product.priceInPaise)}</p>
        <p className="mt-1 text-xs text-ovia-muted">
          {product.colors.length} {product.colors.length === 1 ? 'color' : 'colors'} · {product.sizes.length} {product.sizes.length === 1 ? 'size' : 'sizes'} · {stock} units
        </p>
        <Link
          className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-bold text-ovia-primary hover:text-ovia-plum"
          data-testid={`open-business-product-${product.slug}`}
          to={destination}
        >
          {isCreated ? 'Open product details' : 'Manage inventory'} <ArrowUpRight aria-hidden="true" size={13} />
        </Link>
      </div>
    </article>
  )
}

export function BusinessProductsPage() {
  const inventory = useDemoStore((state) => state.inventoryByVariant)
  const createdProducts = useDemoStore((state) => state.createdProducts)
  const businessProducts: CommerceProduct[] = [
    ...createdProducts,
    ...sellableProducts,
  ]
  const activeCount = businessProducts.filter(isProductActive).length

  return (
    <Container className="py-7 sm:py-10">
      <BusinessPageHeader
        actions={(
          <Link
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-control bg-ovia-primary px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-ovia-plum sm:w-auto"
            data-testid="add-product"
            to="/business/products/new"
          >
            <Plus aria-hidden="true" size={18} /> Add Product
          </Link>
        )}
        description="Manage Ovia’s source-backed catalogue and browser-only demo products with structured variant stock."
        eyebrow="Products"
        title="Catalogue overview"
      />

      <div className="mt-6 overflow-hidden rounded-card border border-ovia-line bg-white shadow-card">
        <div className="flex items-center justify-between gap-4 border-b border-ovia-line px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-ovia-blush/55 text-ovia-plum">
              <PackageCheck aria-hidden="true" size={17} />
            </span>
            <div>
              <p className="text-sm font-bold text-ovia-ink">{activeCount} active products</p>
              <p className="text-xs text-ovia-muted">
                {sellableProducts.length} catalogue · {createdProducts.length} demo-created
              </p>
            </div>
          </div>
          <span className="hidden text-xs font-semibold text-ovia-muted sm:inline">Stock values are simulated</span>
        </div>

        <div className="grid gap-px bg-ovia-line sm:grid-cols-2 xl:grid-cols-3">
          {businessProducts.map((product) => (
            <ProductRow inventory={inventory} key={product.id} product={product} />
          ))}
        </div>
      </div>
    </Container>
  )
}
