import { Check, ChevronRight, Minus, Plus, Save } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { BusinessPageHeader } from '../../components/business/BusinessPageHeader'
import { Container } from '../../components/layout/LayoutPrimitives'
import { Button } from '../../components/ui/Button'
import { sellableProducts } from '../../data/products'
import {
  formatProductSelection,
  getProductSelections,
  type CommerceProduct,
  type ProductSelection,
} from '../../data/productTypes'
import { getProductStock } from '../../lib/business'
import { classNames } from '../../lib/classNames'
import {
  getVariantKey,
  LOW_STOCK_THRESHOLD,
  useDemoStore,
} from '../../store/demoStore'

const defaultCatalogueProduct = sellableProducts[0]!

function getInitialProduct(
  searchProduct: string | null,
  businessProducts: readonly CommerceProduct[],
) {
  return (
    businessProducts.find((product) => product.id === searchProduct) ??
    defaultCatalogueProduct
  )
}

function selectionLabel(
  product: CommerceProduct,
  selection: ProductSelection,
) {
  return formatProductSelection(product, selection) || 'Default'
}

export function BusinessInventoryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const inventory = useDemoStore((state) => state.inventoryByVariant)
  const createdProducts = useDemoStore((state) => state.createdProducts)
  const setVariantInventory = useDemoStore((state) => state.setVariantInventory)
  const businessProducts: CommerceProduct[] = [
    ...createdProducts,
    ...sellableProducts,
  ]
  const initialProduct = getInitialProduct(
    searchParams.get('product'),
    businessProducts,
  )
  const initialSelection = getProductSelections(initialProduct)[0] ?? {}
  const [selectedProductId, setSelectedProductId] = useState(initialProduct.id)
  const [selectedSelection, setSelectedSelection] =
    useState<ProductSelection>(initialSelection)
  const [draftQuantity, setDraftQuantity] = useState(
    inventory[getVariantKey(initialProduct.id, initialSelection)] ?? 0,
  )
  const [toast, setToast] = useState<string | null>(null)

  const selectedProduct =
    businessProducts.find((product) => product.id === selectedProductId) ??
    defaultCatalogueProduct
  const availableSelections = getProductSelections(selectedProduct)
  const savedQuantity =
    inventory[getVariantKey(selectedProduct.id, selectedSelection)] ?? 0
  const hasChanges = draftQuantity !== savedQuantity

  const chooseProduct = (product: CommerceProduct) => {
    const selection = getProductSelections(product)[0] ?? {}
    setSelectedProductId(product.id)
    setSelectedSelection(selection)
    setDraftQuantity(inventory[getVariantKey(product.id, selection)] ?? 0)
    setSearchParams({ product: product.id }, { replace: true })
  }

  const chooseSelection = (selection: ProductSelection) => {
    setSelectedSelection(selection)
    setDraftQuantity(
      inventory[getVariantKey(selectedProduct.id, selection)] ?? 0,
    )
  }

  const adjustDraft = (amount: number) => {
    setDraftQuantity((quantity) =>
      Math.max(0, Math.min(999, quantity + amount)),
    )
  }

  const handleSave = () => {
    setVariantInventory(
      selectedProduct.id,
      selectedSelection,
      draftQuantity,
    )
    setToast(
      `${selectedProduct.catalogueName} · ${selectionLabel(selectedProduct, selectedSelection)} saved at ${draftQuantity} units`,
    )
    window.setTimeout(() => setToast(null), 3200)
  }

  return (
    <Container className="py-7 sm:py-10">
      <BusinessPageHeader
        description="Edit simulated stock by product and jewellery variant. Products without variants use one standard inventory record."
        eyebrow="Inventory"
        title="Variant-level stock"
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(28rem,1.2fr)]">
        <section aria-label="Inventory list" className="hidden overflow-hidden rounded-card border border-ovia-line bg-white shadow-card lg:block">
          <div className="border-b border-ovia-line px-5 py-4">
            <h2 className="font-display text-xl text-ovia-ink">Products</h2>
            <p className="mt-1 text-xs text-ovia-muted">Select a piece to update its stock</p>
          </div>
          <div className="max-h-[44rem] divide-y divide-ovia-line overflow-y-auto">
            {businessProducts.map((product) => {
              const stock = getProductStock(product, inventory)
              const selected = product.id === selectedProduct.id
              const selectionCount = getProductSelections(product).length
              return (
                <button
                  aria-pressed={selected}
                  className={classNames(
                    'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-ovia-ivory',
                    selected && 'bg-ovia-blush/35',
                  )}
                  key={product.id}
                  onClick={() => chooseProduct(product)}
                  type="button"
                >
                  <img alt="" className="size-14 shrink-0 rounded-xl bg-ovia-ivory object-cover object-top" src={product.images[0]} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-ovia-ink">{product.catalogueName}</span>
                    <span className="mt-1 block text-xs text-ovia-muted">{stock} total units · {selectionCount} stock {selectionCount === 1 ? 'record' : 'records'}</span>
                  </span>
                  <ChevronRight aria-hidden="true" className={selected ? 'text-ovia-primary' : 'text-ovia-muted/50'} size={17} />
                </button>
              )
            })}
          </div>
        </section>

        <section className="rounded-card border border-ovia-line bg-white p-5 shadow-card sm:p-7" data-testid="inventory-editor">
          <label className="mb-5 block lg:hidden">
            <span className="mb-2 block text-xs font-bold tracking-[0.1em] text-ovia-muted uppercase">Select product</span>
            <select
              className="h-12 w-full rounded-xl border border-ovia-line bg-white px-3 text-sm font-semibold text-ovia-ink outline-none focus:border-ovia-primary"
              data-testid="inventory-product-select"
              onChange={(event) => {
                const product = businessProducts.find(
                  (candidate) => candidate.id === event.target.value,
                )
                if (product) chooseProduct(product)
              }}
              value={selectedProduct.id}
            >
              {businessProducts.map((product) => (
                <option key={product.id} value={product.id}>{product.catalogueName}</option>
              ))}
            </select>
          </label>

          <div className="flex items-start gap-4 border-b border-ovia-line pb-5">
            <img
              alt={selectedProduct.catalogueName}
              className="h-30 w-23 shrink-0 rounded-2xl bg-ovia-ivory object-cover object-top sm:h-36 sm:w-28"
              src={selectedProduct.images[0]}
            />
            <div className="min-w-0 pt-1">
              <p className="text-[0.68rem] font-bold tracking-[0.12em] text-ovia-primary uppercase">Editing simulated stock</p>
              <h2 className="mt-2 font-display text-2xl leading-tight text-ovia-ink sm:text-3xl">{selectedProduct.catalogueName}</h2>
              <p className="mt-2 text-sm text-ovia-muted" data-testid="inventory-product-total">{getProductStock(selectedProduct, inventory)} units in simulated inventory</p>
            </div>
          </div>

          <div className="py-6">
            <p className="text-sm font-bold text-ovia-ink">
              {selectedProduct.variantOptions.length === 0
                ? 'Inventory record'
                : 'Jewellery variant'}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3" role="group" aria-label="Inventory variant">
              {availableSelections.map((selection) => {
                const quantity =
                  inventory[getVariantKey(selectedProduct.id, selection)] ?? 0
                const key = getVariantKey(selectedProduct.id, selection)
                const selected =
                  key === getVariantKey(selectedProduct.id, selectedSelection)
                return (
                  <button
                    aria-pressed={selected}
                    className={classNames(
                      'min-h-16 w-full rounded-xl border px-4 py-3 text-left transition-colors',
                      selected
                        ? 'border-ovia-primary bg-ovia-primary text-white'
                        : 'border-ovia-line bg-white text-ovia-ink hover:border-ovia-logo hover:bg-ovia-blush/25',
                    )}
                    data-testid={`inventory-variant-${key}`}
                    key={key}
                    onClick={() => chooseSelection(selection)}
                    type="button"
                  >
                    <span className="block text-sm font-bold">{selectionLabel(selectedProduct, selection)}</span>
                    <span className={classNames('mt-0.5 block text-[0.68rem]', selected ? 'text-white/75' : 'text-ovia-muted')}>
                      {quantity} units
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-ovia-line bg-ovia-ivory/65 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-ovia-ink">{selectionLabel(selectedProduct, selectedSelection)} stock</p>
                <p className="mt-1 text-xs text-ovia-muted">Changes apply only after you save</p>
              </div>
              <span className={classNames(
                'rounded-full px-2.5 py-1 text-xs font-bold',
                draftQuantity <= LOW_STOCK_THRESHOLD
                  ? 'bg-[#fff0dd] text-ovia-warning'
                  : 'bg-[#e6f2eb] text-ovia-success',
              )}>
                {draftQuantity <= LOW_STOCK_THRESHOLD ? 'Low stock' : 'In stock'}
              </span>
            </div>

            <div className="mt-5 flex items-center gap-2 sm:gap-3">
              <button
                aria-label="Decrease variant stock"
                className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-ovia-line bg-white text-ovia-plum hover:border-ovia-logo hover:bg-ovia-blush/25 disabled:cursor-not-allowed disabled:opacity-40"
                data-testid="inventory-minus"
                disabled={draftQuantity === 0}
                onClick={() => adjustDraft(-1)}
                type="button"
              >
                <Minus aria-hidden="true" size={18} />
              </button>
              <label className="min-w-0 flex-1">
                <span className="sr-only">Stock quantity</span>
                <input
                  aria-label="Stock quantity for selected variant"
                  className="h-12 w-full rounded-xl border border-ovia-line bg-white px-3 text-center text-lg font-bold text-ovia-ink outline-none focus:border-ovia-primary"
                  data-testid="inventory-quantity"
                  inputMode="numeric"
                  max="999"
                  min="0"
                  onChange={(event) => {
                    const parsed = Number.parseInt(event.target.value || '0', 10)
                    setDraftQuantity(Math.max(0, Math.min(999, parsed)))
                  }}
                  type="number"
                  value={draftQuantity}
                />
              </label>
              <button
                aria-label="Increase variant stock"
                className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-ovia-line bg-white text-ovia-plum hover:border-ovia-logo hover:bg-ovia-blush/25"
                data-testid="inventory-plus"
                onClick={() => adjustDraft(1)}
                type="button"
              >
                <Plus aria-hidden="true" size={18} />
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-ovia-muted">
              <span data-testid="inventory-change-summary">{hasChanges ? `${savedQuantity} → ${draftQuantity} units` : 'No unsaved changes'}</span>
            </p>
            <Button className="sm:min-w-40" data-testid="save-inventory" disabled={!hasChanges} onClick={handleSave}>
              <Save aria-hidden="true" size={16} /> Save Changes
            </Button>
          </div>

          <div className="mt-7 border-t border-ovia-line pt-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-ovia-ink">Current saved inventory</h3>
              <span className="text-xs text-ovia-muted">Updates live</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {availableSelections.map((selection) => {
                const key = getVariantKey(selectedProduct.id, selection)
                const quantity = inventory[key] ?? 0
                return (
                  <div className="flex items-center justify-between rounded-xl border border-ovia-line px-4 py-3" data-testid={`saved-stock-${key}`} key={key}>
                    <span className="text-sm font-bold text-ovia-ink">{selectionLabel(selectedProduct, selection)}</span>
                    <span className={classNames('text-sm font-bold', quantity <= LOW_STOCK_THRESHOLD ? 'text-ovia-warning' : 'text-ovia-success')}>
                      {quantity} units
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            aria-live="polite"
            className="fixed right-4 bottom-4 left-4 flex items-start gap-3 rounded-2xl bg-ovia-ink px-4 py-3.5 text-sm text-white shadow-floating sm:right-6 sm:left-auto sm:max-w-md"
            data-testid="inventory-success-toast"
            exit={{ opacity: 0, y: 12 }}
            initial={{ opacity: 0, y: 12 }}
            role="status"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ovia-success text-white">
              <Check aria-hidden="true" size={15} />
            </span>
            <span><strong className="block">Inventory saved</strong><span className="mt-0.5 block text-xs text-white/70">{toast}</span></span>
          </motion.div>
        )}
      </AnimatePresence>
    </Container>
  )
}
