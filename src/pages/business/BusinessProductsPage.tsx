import { ArrowUpRight, PackageCheck, Plus, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { BusinessPageHeader } from '../../components/business/BusinessPageHeader'
import { Container } from '../../components/layout/LayoutPrimitives'
import { sellableProducts } from '../../data/products'
import {
  getProductSelections,
  isDemoProduct,
  isProductActive,
  type CommerceProduct,
  type DemoProductStatus,
  type ProductCategory,
} from '../../data/productTypes'
import { getProductStock } from '../../lib/business'
import { classNames } from '../../lib/classNames'
import { formatInr } from '../../lib/currency'
import { useDemoStore } from '../../store/demoStore'

const categoryLabels = {
  necklace: 'Necklace',
  earrings: 'Earrings',
  bracelet: 'Bracelet',
  ring: 'Ring',
  anklet: 'Anklet',
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
        src={product.images[0]}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[0.68rem] font-bold tracking-[0.1em] text-ovia-primary uppercase">
              {categoryLabels[product.category]} · {isDemoProduct(product) ? 'Demo product' : 'Real source'}
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
          {product.variantOptions.length === 0
            ? 'No selectable variants'
            : `${product.variantOptions.length} option ${product.variantOptions.length === 1 ? 'group' : 'groups'}`}
          {' · '}{getProductSelections(product).length} stock {getProductSelections(product).length === 1 ? 'record' : 'records'} · {stock} units
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
  const businessProducts = useMemo<CommerceProduct[]>(
    () => [...createdProducts, ...sellableProducts],
    [createdProducts],
  )
  const activeCount = businessProducts.filter(isProductActive).length
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<'all' | ProductCategory>('all')
  const [status, setStatus] = useState<'all' | DemoProductStatus>('all')
  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()

    return businessProducts.filter((product) => {
      const matchesQuery =
        !normalizedQuery ||
        product.catalogueName.toLocaleLowerCase().includes(normalizedQuery) ||
        categoryLabels[product.category]
          .toLocaleLowerCase()
          .includes(normalizedQuery)
      const matchesCategory =
        category === 'all' || product.category === category
      const matchesStatus =
        status === 'all' ||
        (status === 'active' && isProductActive(product)) ||
        (status === 'draft' && !isProductActive(product))

      return matchesQuery && matchesCategory && matchesStatus
    })
  }, [businessProducts, category, query, status])
  const filtersActive = query.length > 0 || category !== 'all' || status !== 'all'

  const clearFilters = () => {
    setQuery('')
    setCategory('all')
    setStatus('all')
  }

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
        description="Manage Jewellgalleria’s source-backed catalogue and clearly marked demo products with structured variant stock."
        eyebrow="Products"
        title="Catalogue overview"
      />

      <section
        aria-label="Product filters"
        className="mt-6 rounded-card border border-ovia-line bg-white p-4 shadow-card sm:p-5"
      >
        <div className="grid gap-3 lg:grid-cols-[minmax(18rem,1fr)_13rem_11rem_auto] lg:items-end">
          <label>
            <span className="mb-2 block text-xs font-bold tracking-[0.08em] text-ovia-muted uppercase">
              Search catalogue
            </span>
            <span className="relative block">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ovia-muted"
                size={17}
              />
              <input
                className="min-h-12 w-full rounded-xl border border-ovia-line bg-white pr-4 pl-11 text-sm text-ovia-ink placeholder:text-ovia-muted/60 focus:border-ovia-primary focus:outline-none focus-visible:ring-3 focus-visible:ring-ovia-primary/20"
                data-testid="product-search"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by product or category"
                type="search"
                value={query}
              />
            </span>
          </label>
          <label>
            <span className="mb-2 block text-xs font-bold tracking-[0.08em] text-ovia-muted uppercase">
              Category
            </span>
            <select
              className="min-h-12 w-full rounded-xl border border-ovia-line bg-white px-4 text-sm text-ovia-ink focus:border-ovia-primary focus:outline-none focus-visible:ring-3 focus-visible:ring-ovia-primary/20"
              data-testid="product-category-filter"
              onChange={(event) =>
                setCategory(event.target.value as 'all' | ProductCategory)
              }
              value={category}
            >
              <option value="all">All categories</option>
              {Object.entries(categoryLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-2 block text-xs font-bold tracking-[0.08em] text-ovia-muted uppercase">
              Status
            </span>
            <select
              className="min-h-12 w-full rounded-xl border border-ovia-line bg-white px-4 text-sm text-ovia-ink focus:border-ovia-primary focus:outline-none focus-visible:ring-3 focus-visible:ring-ovia-primary/20"
              data-testid="product-status-filter"
              onChange={(event) =>
                setStatus(event.target.value as 'all' | DemoProductStatus)
              }
              value={status}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
            </select>
          </label>
          {filtersActive && (
            <button
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-ovia-primary hover:bg-ovia-blush/35"
              data-testid="clear-product-filters"
              onClick={clearFilters}
              type="button"
            >
              <X aria-hidden="true" size={16} /> Clear
            </button>
          )}
        </div>
      </section>

      <div className="mt-4 overflow-hidden rounded-card border border-ovia-line bg-white shadow-card">
        <div className="flex items-center justify-between gap-4 border-b border-ovia-line px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-ovia-blush/55 text-ovia-plum">
              <PackageCheck aria-hidden="true" size={17} />
            </span>
            <div>
              <p className="text-sm font-bold text-ovia-ink">{activeCount} active products</p>
              <p className="text-xs text-ovia-muted">
                Showing {visibleProducts.length} of {businessProducts.length} products
              </p>
            </div>
          </div>
          <span className="hidden text-xs font-semibold text-ovia-muted sm:inline">Stock values are simulated</span>
        </div>

        <div className="grid gap-px bg-ovia-line sm:grid-cols-2 xl:grid-cols-3">
          {visibleProducts.map((product) => (
            <ProductRow inventory={inventory} key={product.id} product={product} />
          ))}
          {visibleProducts.length === 0 && (
            <div className="col-span-full px-5 py-14 text-center" data-testid="products-empty-filter-state">
              <p className="font-display text-2xl text-ovia-ink">No matching products</p>
              <p className="mt-2 text-sm text-ovia-muted">Try a different search, category, or status.</p>
              <button className="mt-4 min-h-11 rounded-full px-4 text-sm font-bold text-ovia-primary hover:bg-ovia-blush/35" onClick={clearFilters} type="button">
                Clear filters
              </button>
            </div>
          )}
        </div>
      </div>
    </Container>
  )
}
