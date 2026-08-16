import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ArrowRight, Check, Heart, Minus, Plus, ShoppingBag, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useOutletContext, useParams } from 'react-router-dom'

import { Container } from '../components/layout/LayoutPrimitives'
import { ProductCard } from '../components/customer/ProductCard'
import { sellableProducts } from '../data/products'
import {
  isDemoProduct,
  isProductActive,
  type ProductSize,
} from '../data/productTypes'
import { classNames } from '../lib/classNames'
import { formatInr } from '../lib/currency'
import { useDemoStore } from '../store/demoStore'

interface CustomerOutletContext {
  openCart: () => void
}

interface ConfirmationSheetProps {
  isOpen: boolean
  onClose: () => void
  onCheckout: () => void
  productName: string
  image: string
  priceInPaise: number
  quantity: number
  size: ProductSize
  color?: string
}

function ConfirmationSheet({
  isOpen,
  onClose,
  onCheckout,
  productName,
  image,
  priceInPaise,
  quantity,
  size,
  color,
}: ConfirmationSheetProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-70" role="dialog" aria-modal="true" aria-labelledby="added-title">
          <motion.button
            aria-label="Close added to bag confirmation"
            className="absolute inset-0 bg-ovia-ink/35 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            type="button"
          />
          <motion.div
            className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-3xl rounded-t-[2rem] bg-ovia-ivory px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-floating sm:bottom-6 sm:rounded-[2rem] sm:px-7 sm:pb-7"
            data-testid="added-to-bag-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 34 }}
          >
            <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-ovia-muted/30 sm:hidden" />
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <span className="flex size-7 items-center justify-center rounded-full bg-ovia-primary text-white">
                  <Check aria-hidden="true" size={16} strokeWidth={2.5} />
                </span>
                <h2 className="font-display text-2xl" id="added-title">Added to bag</h2>
              </div>
              <button
                aria-label="Close confirmation"
                className="flex size-11 items-center justify-center rounded-full text-ovia-muted hover:bg-ovia-blush/50"
                onClick={onClose}
                type="button"
              >
                <X aria-hidden="true" size={21} />
              </button>
            </div>
            <div className="mt-5 grid grid-cols-[6rem_1fr] gap-4 sm:grid-cols-[7rem_1fr]">
              <img
                alt={productName}
                className="aspect-[4/5] w-full rounded-2xl object-cover"
                src={image}
              />
              <div className="min-w-0 py-1">
                <p className="font-display text-xl leading-tight sm:text-2xl">{productName}</p>
                <p className="mt-2 text-sm text-ovia-muted">
                  Size <strong className="text-ovia-ink" data-testid="confirmation-size">{size}</strong>
                  {color ? <span> · {color}</span> : null}
                  <span> · Qty {quantity}</span>
                </p>
                <p className="mt-3 font-semibold text-ovia-plum">{formatInr(priceInPaise)}</p>
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                className="min-h-12 rounded-full border border-ovia-primary px-5 text-sm font-bold text-ovia-plum hover:bg-ovia-blush/45"
                onClick={onClose}
                type="button"
              >
                Continue shopping
              </button>
              <button
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ovia-primary px-5 text-sm font-bold text-white hover:bg-ovia-plum"
                data-testid="confirmation-checkout"
                onClick={onCheckout}
                type="button"
              >
                Proceed to checkout
                <ArrowRight aria-hidden="true" size={17} />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export function ProductRoutePage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { openCart } = useOutletContext<CustomerOutletContext>()
  const addToCart = useDemoStore((state) => state.addToCart)
  const createdProducts = useDemoStore((state) => state.createdProducts)
  const commerceProducts = useMemo(
    () => [...sellableProducts, ...createdProducts],
    [createdProducts],
  )
  const product = slug
    ? commerceProducts.find((candidate) => candidate.slug === slug)
    : undefined
  const isWishlisted = useDemoStore((state) =>
    product ? state.wishlistProductIds.includes(product.id) : false,
  )
  const toggleWishlist = useDemoStore((state) => state.toggleWishlist)
  const [selectedSize, setSelectedSize] = useState<ProductSize | null>(null)
  const [selectedColor, setSelectedColor] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false)
  const [addToBagState, setAddToBagState] = useState<'idle' | 'adding' | 'added'>('idle')
  const addToBagTimers = useRef<number[]>([])

  useEffect(() => () => addToBagTimers.current.forEach(window.clearTimeout), [])

  const relatedProducts = useMemo(() => {
    if (!product || !isProductActive(product)) return []
    return commerceProducts
      .filter(
        (item) =>
          isProductActive(item) &&
          item.id !== product.id &&
          item.category === product.category,
      )
      .slice(0, 4)
  }, [commerceProducts, product])

  if (!product || !isProductActive(product)) {
    return <Navigate replace to="/" />
  }

  const selectableColors = product.colors.filter((color) => color.selectable)
  const requiredColorSelected = selectableColors.length === 0 || selectedColor !== null
  const canAddToBag = selectedSize !== null && requiredColorSelected

  const handleAddToBag = () => {
    if (!selectedSize || !requiredColorSelected) return

    setAddToBagState('adding')
    addToBagTimers.current.push(window.setTimeout(() => {
      addToCart({
        productId: product.id,
        quantity,
        size: selectedSize,
        ...(selectedColor ? { color: selectedColor } : {}),
      })
      setAddToBagState('added')
    }, 150))
    addToBagTimers.current.push(window.setTimeout(() => setIsConfirmationOpen(true), 320))
    addToBagTimers.current.push(window.setTimeout(() => setAddToBagState('idle'), 1_050))
  }

  return (
    <>
      <div className="pb-24 lg:pb-0">
      <div className="border-b border-ovia-line bg-white/55">
        <Container className="flex min-h-12 items-center gap-2 text-xs text-ovia-muted">
          <Link className="inline-flex items-center gap-1 hover:text-ovia-primary" to="/">
            <ArrowLeft aria-hidden="true" size={14} />
            Shop
          </Link>
          <span aria-hidden="true">/</span>
          <span className="truncate text-ovia-ink">{product.catalogueName}</span>
        </Container>
      </div>

      <div className="mx-auto w-full max-w-360 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-[1.08fr_0.92fr] lg:gap-12 lg:py-12 xl:gap-20">
          <motion.div
            className="relative overflow-hidden bg-[#eee3dc] sm:rounded-[1.25rem]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <img
              alt={product.catalogueName}
              className="aspect-[4/5] max-h-[34rem] w-full object-contain lg:max-h-[49rem]"
              fetchPriority="high"
              src={product.image}
            />
            <span className="absolute bottom-4 left-4 bg-ovia-ivory/90 px-3 py-1.5 text-[0.65rem] font-bold tracking-[0.08em] text-ovia-plum backdrop-blur-sm lg:hidden">1 / 1</span>
            <button
              aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              aria-pressed={isWishlisted}
              className={classNames(
                'absolute top-4 right-4 flex size-12 items-center justify-center rounded-full shadow-sm backdrop-blur-sm transition-colors',
                isWishlisted ? 'bg-ovia-primary text-white' : 'bg-white/90 text-ovia-plum hover:bg-ovia-blush',
              )}
              onClick={() => toggleWishlist(product.id)}
              type="button"
            >
              <Heart aria-hidden="true" fill={isWishlisted ? 'currentColor' : 'none'} size={20} />
            </button>
          </motion.div>

          <motion.div
            className="px-4 py-6 sm:px-0 sm:py-10 lg:sticky lg:top-28 lg:self-start lg:py-6"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08 }}
          >
            <p className="text-[0.68rem] font-bold tracking-[0.16em] text-ovia-primary uppercase">{isDemoProduct(product) ? 'New Ovia edit' : 'Ovia catalogue'}</p>
            <h1 className="mt-2.5 font-display text-[2.05rem] leading-[1] tracking-[-0.035em] sm:text-5xl">{product.catalogueName}</h1>
            <p className="mt-2.5 text-xl font-bold text-ovia-plum sm:mt-4 sm:font-display sm:text-3xl sm:font-medium">{formatInr(product.priceInPaise)}</p>
            {isDemoProduct(product) && (
              <p className="mt-5 hidden max-w-xl text-sm leading-7 text-ovia-muted lg:block">{product.description}</p>
            )}

            <dl className="mt-6 hidden grid-cols-2 border-y border-ovia-line py-4 text-sm lg:grid">
              <div className="border-r border-ovia-line pr-4">
                <dt className="text-xs text-ovia-muted">Available sizes</dt>
                <dd className="mt-1.5 font-semibold">{product.sizes.join(', ')}</dd>
              </div>
              <div className="pl-4">
                <dt className="text-xs text-ovia-muted">Catalogue color</dt>
                <dd className="mt-1.5 font-semibold">{product.colors[0]?.label}</dd>
              </div>
            </dl>

            <div className="mt-6 lg:mt-7">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-sm font-bold tracking-[0.08em] uppercase">Select size</h2>
                <span className="text-xs text-ovia-muted">Required</span>
              </div>
              <div className="mt-3.5 flex flex-wrap gap-2.5" role="group" aria-label="Available sizes">
                {product.sizes.map((size) => (
                  <button
                    aria-pressed={selectedSize === size}
                    className={classNames(
                      'min-h-12 min-w-14 rounded-full border px-5 text-sm font-bold transition-colors duration-150 active:translate-y-px',
                      selectedSize === size
                        ? 'border-ovia-primary bg-ovia-primary text-white'
                        : 'border-ovia-line bg-white text-ovia-ink hover:border-ovia-primary hover:text-ovia-primary',
                    )}
                    data-testid={`size-${size}`}
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    type="button"
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {selectableColors.length > 0 && (
              <div className="mt-6 border-t border-ovia-line pt-6 lg:mt-7 lg:pt-7">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-sm font-bold tracking-[0.08em] uppercase">Select color</h2>
                  <span className="text-xs text-ovia-muted">Required</span>
                </div>
                <div className="mt-3.5 flex flex-wrap gap-2" role="group" aria-label="Available colors">
                  {selectableColors.map((color) => (
                    <button
                      aria-pressed={selectedColor === color.label}
                      className={classNames(
                        'min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors',
                        selectedColor === color.label
                          ? 'border-ovia-primary bg-ovia-primary text-white'
                          : 'border-ovia-line bg-white hover:border-ovia-primary',
                      )}
                      key={color.label}
                      onClick={() => setSelectedColor(color.label)}
                      type="button"
                    >
                      {color.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 border-t border-ovia-line pt-6 lg:mt-7 lg:pt-7">
              <h2 className="text-sm font-bold tracking-[0.08em] uppercase">Quantity</h2>
              <div className="mt-3.5 inline-flex items-center rounded-full border border-ovia-line bg-white">
                <button
                  aria-label="Decrease quantity"
                  className="flex size-12 items-center justify-center rounded-full text-ovia-plum hover:bg-ovia-blush/45 disabled:opacity-35"
                  disabled={quantity === 1}
                  onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                  type="button"
                >
                  <Minus aria-hidden="true" size={17} />
                </button>
                <span aria-live="polite" className="min-w-10 text-center font-semibold">{quantity}</span>
                <button
                  aria-label="Increase quantity"
                  className="flex size-12 items-center justify-center rounded-full text-ovia-plum hover:bg-ovia-blush/45"
                  onClick={() => setQuantity((value) => value + 1)}
                  type="button"
                >
                  <Plus aria-hidden="true" size={17} />
                </button>
              </div>
            </div>

            <dl className="mt-6 grid grid-cols-2 border-y border-ovia-line py-4 text-sm lg:hidden">
              <div className="border-r border-ovia-line pr-4">
                <dt className="text-xs text-ovia-muted">Available sizes</dt>
                <dd className="mt-1.5 font-semibold">{product.sizes.join(', ')}</dd>
              </div>
              <div className="pl-4">
                <dt className="text-xs text-ovia-muted">Catalogue color</dt>
                <dd className="mt-1.5 font-semibold">{product.colors[0]?.label}</dd>
              </div>
            </dl>
            {isDemoProduct(product) && (
              <p className="mt-5 text-sm leading-6 text-ovia-muted lg:hidden">{product.description}</p>
            )}

            <button
              className="customer-primary-action mt-8 hidden min-h-14 w-full items-center justify-center gap-2 rounded-full bg-ovia-primary px-6 text-sm font-bold text-white shadow-[0_12px_30px_rgb(166_79_140/0.22)] hover:bg-ovia-plum disabled:cursor-not-allowed disabled:bg-ovia-muted/30 disabled:shadow-none lg:inline-flex"
              data-testid="add-to-bag"
              disabled={!canAddToBag || addToBagState !== 'idle'}
              onClick={handleAddToBag}
              type="button"
            >
              {addToBagState === 'added' ? <Check aria-hidden="true" size={19} /> : <ShoppingBag aria-hidden="true" size={19} />}
              {addToBagState === 'adding'
                ? 'Adding…'
                : addToBagState === 'added'
                  ? 'Added to bag'
                  : selectedSize
                    ? 'Add to bag'
                    : 'Select a size to continue'}
            </button>
            <button
              className="mt-3 hidden min-h-11 w-full rounded-full text-sm font-semibold text-ovia-plum hover:bg-ovia-blush/40 lg:block"
              onClick={openCart}
              type="button"
            >
              View current bag
            </button>

          </motion.div>
        </div>
      </div>

      {relatedProducts.length > 0 && (
        <section className="border-t border-ovia-line py-10 sm:py-16">
          <Container>
            <p className="text-[0.68rem] font-bold tracking-[0.16em] text-ovia-primary uppercase">More from the edit</p>
            <h2 className="mt-2 font-display text-[2rem] sm:text-4xl">You may also like</h2>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-7 sm:gap-5 lg:grid-cols-4 lg:gap-6">
              {relatedProducts.map((item) => <ProductCard key={item.id} onOpenCart={openCart} product={item} />)}
            </div>
          </Container>
        </section>
      )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-ovia-line bg-ovia-ivory/97 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgb(41_35_39/0.09)] backdrop-blur-xl lg:hidden" data-testid="mobile-pdp-action-bar">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-ovia-plum">{formatInr(product.priceInPaise)}</p>
            <p className="mt-0.5 truncate text-[0.7rem] text-ovia-muted">
              {selectedSize ? `Size ${selectedSize}${selectedColor ? ` · ${selectedColor}` : ''}` : 'Select a size to continue'}
            </p>
          </div>
          <button
            className="customer-primary-action inline-flex min-h-13 min-w-[10rem] items-center justify-center gap-2 rounded-full bg-ovia-primary px-5 text-sm font-bold text-white shadow-[0_8px_22px_rgb(166_79_140/0.2)] disabled:cursor-not-allowed disabled:bg-ovia-muted/30 disabled:shadow-none"
            data-testid="mobile-sticky-add-to-bag"
            disabled={!canAddToBag || addToBagState !== 'idle'}
            onClick={handleAddToBag}
            type="button"
          >
            {addToBagState === 'added' ? <Check aria-hidden="true" size={18} /> : <ShoppingBag aria-hidden="true" size={18} />}
            {addToBagState === 'adding'
              ? 'Adding…'
              : addToBagState === 'added'
                ? 'Added'
                : !selectedSize
                  ? 'Select size'
                  : !requiredColorSelected
                    ? 'Select color'
                    : 'Add to bag'}
          </button>
        </div>
      </div>

      {selectedSize && (
        <ConfirmationSheet
          color={selectedColor ?? undefined}
          image={product.image}
          isOpen={isConfirmationOpen}
          onCheckout={() => navigate('/checkout')}
          onClose={() => setIsConfirmationOpen(false)}
          priceInPaise={product.priceInPaise * quantity}
          productName={product.catalogueName}
          quantity={quantity}
          size={selectedSize}
        />
      )}
    </>
  )
}
