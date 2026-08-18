import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowLeft, Check, ChevronDown, Minus, Plus, ShoppingBag, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useOutletContext, useParams } from 'react-router-dom'

import { ProductCard } from '../components/customer/ProductCard'
import { ProductGallery } from '../components/customer/ProductGallery'
import { Container } from '../components/layout/LayoutPrimitives'
import { sellableProducts } from '../data/products'
import { formatProductSelection, isDemoProduct, isProductActive, type ProductSelection } from '../data/productTypes'
import { classNames } from '../lib/classNames'
import { formatInr } from '../lib/currency'
import { useDemoStore } from '../store/demoStore'

interface CustomerOutletContext {
  openCart: () => void
}

interface ConfirmationSheetProps {
  image: string
  isOpen: boolean
  onClose: () => void
  onViewBag: () => void
  priceInPaise: number
  productName: string
  quantity: number
  selectionLabel: string
}

function ConfirmationSheet({ image, isOpen, onClose, onViewBag, priceInPaise, productName, quantity, selectionLabel }: ConfirmationSheetProps) {
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    if (!isOpen) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <div aria-labelledby="added-title" aria-modal="true" className="fixed inset-0 z-80" role="dialog">
          <motion.button animate={{ opacity: 1 }} aria-label="Close added to bag confirmation" className="absolute inset-0 bg-ovia-ink/40 backdrop-blur-[2px]" exit={{ opacity: 0 }} initial={{ opacity: 0 }} onClick={onClose} type="button" />
          <motion.div
            animate={{ y: 0 }}
            className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-2xl rounded-t-[1.5rem] bg-ovia-ivory px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-floating sm:bottom-6 sm:rounded-[1.5rem] sm:px-7 sm:pb-7"
            data-testid="added-to-bag-sheet"
            exit={{ y: prefersReducedMotion ? 0 : '100%' }}
            initial={{ y: prefersReducedMotion ? 0 : '100%' }}
            transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 340, damping: 34 }}
          >
            <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-ovia-muted/25 sm:hidden" />
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <span className="flex size-7 items-center justify-center rounded-full bg-ovia-primary text-white"><Check aria-hidden="true" size={16} strokeWidth={2.5} /></span>
                <h2 className="font-display text-2xl" id="added-title">Added to bag</h2>
              </div>
              <button aria-label="Close confirmation" className="flex size-11 items-center justify-center rounded-full text-ovia-muted hover:bg-ovia-blush/50" onClick={onClose} type="button"><X aria-hidden="true" size={21} /></button>
            </div>
            <div className="mt-5 grid grid-cols-[6rem_1fr] gap-4 sm:grid-cols-[7rem_1fr]">
              <img alt="" className="aspect-[4/5] w-full bg-[#eee3dc] object-cover" src={image} />
              <div className="min-w-0 py-1">
                <p className="font-display text-xl leading-tight sm:text-2xl">{productName}</p>
                <p className="mt-2 text-sm text-ovia-muted">{selectionLabel ? <span>{selectionLabel} · </span> : null}<span>Qty {quantity}</span></p>
                <p className="mt-3 font-semibold text-ovia-plum">{formatInr(priceInPaise)}</p>
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button className="min-h-12 rounded-control border border-ovia-primary px-5 text-sm font-bold text-ovia-plum hover:bg-ovia-blush/45" onClick={onClose} type="button">Continue shopping</button>
              <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-control bg-ovia-primary px-5 text-sm font-bold text-white hover:bg-ovia-plum" data-testid="confirmation-view-bag" onClick={onViewBag} type="button"><ShoppingBag aria-hidden="true" size={17} />View bag</button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export function ProductRoutePage() {
  const { slug } = useParams()
  const { openCart } = useOutletContext<CustomerOutletContext>()
  const addToCart = useDemoStore((state) => state.addToCart)
  const createdProducts = useDemoStore((state) => state.createdProducts)
  const commerceProducts = useMemo(() => [...sellableProducts, ...createdProducts], [createdProducts])
  const product = slug ? commerceProducts.find((candidate) => candidate.slug === slug) : undefined
  const isWishlisted = useDemoStore((state) => product ? state.wishlistProductIds.includes(product.id) : false)
  const toggleWishlist = useDemoStore((state) => state.toggleWishlist)
  const [selectionState, setSelectionState] = useState<{
    productId: string
    value: ProductSelection
  }>({ productId: '', value: {} })
  const [quantityState, setQuantityState] = useState({ productId: '', value: 1 })
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false)
  const [isFooterVisible, setIsFooterVisible] = useState(false)
  const [addToBagState, setAddToBagState] = useState<'idle' | 'adding' | 'added'>('idle')
  const addToBagTimers = useRef<number[]>([])

  useEffect(() => () => addToBagTimers.current.forEach(window.clearTimeout), [])
  useEffect(() => {
    const footer = document.querySelector('footer')
    if (!footer) return

    const observer = new IntersectionObserver(
      ([entry]) => setIsFooterVisible(entry?.isIntersecting ?? false),
      { threshold: 0.01 },
    )
    observer.observe(footer)
    return () => observer.disconnect()
  }, [])

  const relatedProducts = useMemo(() => {
    if (!product || !isProductActive(product)) return []
    return commerceProducts
      .filter((item) => isProductActive(item) && item.id !== product.id && item.category === product.category)
      .sort((left, right) => Number(left.isDemoProduct) - Number(right.isDemoProduct))
      .slice(0, 4)
  }, [commerceProducts, product])

  if (!product || !isProductActive(product)) return <Navigate replace to="/" />

  const selectedOptions = selectionState.productId === product.id
    ? selectionState.value
    : {}
  const quantity = quantityState.productId === product.id
    ? quantityState.value
    : 1
  const selectOption = (optionId: string, value: string) => {
    setSelectionState((current) => ({
      productId: product.id,
      value: {
        ...(current.productId === product.id ? current.value : {}),
        [optionId]: value,
      },
    }))
  }
  const updateQuantity = (updater: (current: number) => number) => {
    setQuantityState((current) => ({
      productId: product.id,
      value: updater(current.productId === product.id ? current.value : 1),
    }))
  }

  const missingOption = product.variantOptions.find((option) => !selectedOptions[option.id])
  const selectionLabel = formatProductSelection(product, selectedOptions)
  const hasKnownPrice = product.priceInPaise !== null
  const canAddToBag = hasKnownPrice && !missingOption
  const unavailableReason = !hasKnownPrice
    ? 'Official pricing was not supplied for this product.'
    : missingOption
      ? `Select ${missingOption.name} to continue.`
      : null
  const addToBagLabel = !hasKnownPrice
    ? 'Price unavailable'
    : missingOption
      ? `Select ${missingOption.name}`
      : 'Add to bag'

  const handleAddToBag = () => {
    if (!canAddToBag || addToBagState !== 'idle') return
    setAddToBagState('adding')
    addToBagTimers.current.push(window.setTimeout(() => {
      addToCart({ productId: product.id, quantity, selection: selectedOptions })
      setAddToBagState('added')
    }, 140))
    addToBagTimers.current.push(window.setTimeout(() => setIsConfirmationOpen(true), 260))
    addToBagTimers.current.push(window.setTimeout(() => setAddToBagState('idle'), 1_050))
  }

  const buttonLabel = addToBagState === 'adding'
    ? 'Adding…'
    : addToBagState === 'added'
      ? 'Added to bag'
      : addToBagLabel

  return (
    <>
      <div className="pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-0">
        <div className="border-b border-ovia-line bg-white/55">
          <Container className="flex min-h-12 items-center gap-2 text-xs text-ovia-muted">
            <Link className="inline-flex min-h-11 items-center gap-1 hover:text-ovia-primary" to="/"><ArrowLeft aria-hidden="true" size={14} />Shop</Link>
            <span aria-hidden="true">/</span>
            <span className="truncate text-ovia-ink">{product.catalogueName}</span>
          </Container>
        </div>

        <div className="mx-auto w-full max-w-360 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-[minmax(0,1.08fr)_minmax(23rem,0.92fr)] lg:gap-10 lg:py-12 xl:gap-16">
            <ProductGallery images={product.images} isWishlisted={isWishlisted} key={product.id} onToggleWishlist={() => toggleWishlist(product.id)} productName={product.catalogueName} />

            <motion.div animate={{ opacity: 1, y: 0 }} className="px-4 pt-5 pb-9 sm:px-0 sm:pt-8 lg:sticky lg:top-24 lg:self-start lg:py-3" initial={{ opacity: 0, y: 14 }} transition={{ duration: 0.45, delay: 0.06 }}>
              <p className="text-[0.66rem] font-bold tracking-[0.16em] text-ovia-primary uppercase">{isDemoProduct(product) ? 'Fictional demo product' : 'Jewellgalleria catalogue'}</p>
              <h1 className="mt-2.5 max-w-xl font-display text-[2.25rem] leading-[0.96] tracking-[-0.035em] sm:text-5xl lg:text-[3.35rem]">{product.catalogueName}</h1>

              {hasKnownPrice ? (
                <div className="mt-4">
                  <p className="font-display text-3xl font-medium text-ovia-plum">{formatInr(product.priceInPaise)}</p>
                  {product.priceStatus === 'demo' && <p className="mt-1 text-xs text-ovia-muted">Demo catalogue price</p>}
                </div>
              ) : (
                <div className="mt-4">
                  <p className="text-base font-semibold text-ovia-plum">Price not supplied</p>
                  <p className="mt-1 text-xs leading-5 text-ovia-muted">Official pricing was not included in the reference material.</p>
                </div>
              )}

              <dl className="mt-6 grid grid-cols-2 border-y border-ovia-line text-sm">
                <div className="py-4 pr-4"><dt className="text-xs text-ovia-muted">Product type</dt><dd className="mt-1.5 font-semibold capitalize">{product.category}</dd></div>
                {product.attributes.map((attribute) => (
                  <div className="border-l border-ovia-line py-4 pl-4" key={`${attribute.label}-${attribute.value}`}><dt className="text-xs text-ovia-muted">{attribute.label}</dt><dd className="mt-1.5 font-semibold">{attribute.value}</dd></div>
                ))}
              </dl>

              {product.variantOptions.map((option, optionIndex) => (
                <fieldset className={classNames('mt-6', optionIndex > 0 && 'border-t border-ovia-line pt-6')} key={option.id}>
                  <legend className="flex w-full items-center justify-between gap-4 text-sm font-bold tracking-[0.07em] uppercase"><span>{option.name}</span><span className="text-[0.66rem] font-medium tracking-normal text-ovia-muted normal-case">Required</span></legend>
                  <div aria-label={`Available ${option.name}`} className="mt-3.5 flex flex-wrap gap-2.5" role="group">
                    {option.values.map((value) => (
                      <button
                        aria-pressed={selectedOptions[option.id] === value}
                        className={classNames('min-h-12 min-w-14 rounded-full border px-5 text-sm font-bold transition-colors duration-150 active:translate-y-px', selectedOptions[option.id] === value ? 'border-ovia-primary bg-ovia-primary text-white' : 'border-ovia-line bg-white text-ovia-ink hover:border-ovia-primary hover:text-ovia-primary')}
                        data-testid={`option-${option.id}-${value}`}
                        key={value}
                        onClick={() => selectOption(option.id, value)}
                        type="button"
                      >{value}</button>
                    ))}
                  </div>
                </fieldset>
              ))}

              <div className="mt-6">
                <h2 className="text-sm font-bold tracking-[0.07em] uppercase">Quantity</h2>
                <div className="mt-3.5 inline-flex items-center rounded-full border border-ovia-line bg-white">
                  <button aria-label="Decrease quantity" className="flex size-12 items-center justify-center rounded-full text-ovia-plum hover:bg-ovia-blush/45 disabled:opacity-35" disabled={quantity === 1} onClick={() => updateQuantity((value) => Math.max(1, value - 1))} type="button"><Minus aria-hidden="true" size={17} /></button>
                  <span aria-live="polite" className="min-w-10 text-center font-semibold" data-testid="product-quantity">{quantity}</span>
                  <button aria-label="Increase quantity" className="flex size-12 items-center justify-center rounded-full text-ovia-plum hover:bg-ovia-blush/45" onClick={() => updateQuantity((value) => value + 1)} type="button"><Plus aria-hidden="true" size={17} /></button>
                </div>
              </div>

              <button className="customer-primary-action mt-7 hidden min-h-14 w-full items-center justify-center gap-2 rounded-control bg-ovia-primary px-6 text-sm font-bold text-white shadow-[0_10px_24px_rgb(127_23_50/0.16)] hover:bg-ovia-plum disabled:cursor-not-allowed disabled:bg-ovia-muted/30 disabled:shadow-none lg:inline-flex" data-testid="add-to-bag" disabled={!canAddToBag || addToBagState !== 'idle'} onClick={handleAddToBag} type="button">
                {addToBagState === 'added' ? <Check aria-hidden="true" size={19} /> : <ShoppingBag aria-hidden="true" size={19} />}{buttonLabel}
              </button>
              {unavailableReason && <p className="mt-2 hidden text-center text-xs leading-5 text-ovia-muted lg:block" role="status">{unavailableReason}</p>}

              <div className="mt-7 border-t border-ovia-line">
                <details className="group border-b border-ovia-line">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 text-sm font-bold [&::-webkit-details-marker]:hidden">Product details<ChevronDown aria-hidden="true" className="transition-transform group-open:rotate-180" size={18} /></summary>
                  <div className="pb-5 text-sm leading-7 text-ovia-muted">
                    <p>{product.description}</p>
                    {!product.isDemoProduct && <p className="mt-3 text-xs leading-5">Description is limited to details visible in the supplied Jewellgalleria source.</p>}
                  </div>
                </details>
              </div>
            </motion.div>
          </div>
        </div>

        {relatedProducts.length > 0 && (
          <section className="border-t border-ovia-line py-10 sm:py-14 lg:py-18">
            <Container>
              <p className="text-[0.66rem] font-bold tracking-[0.16em] text-ovia-primary uppercase">More from the catalogue</p>
              <h2 className="mt-2 font-display text-[2.15rem] leading-none sm:text-4xl">You may also like</h2>
              <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-7 sm:gap-x-5 md:grid-cols-4 md:gap-5 lg:gap-6">
                {relatedProducts.map((item) => <ProductCard key={item.id} onOpenCart={openCart} product={item} />)}
              </div>
            </Container>
          </section>
        )}
      </div>

      <div className={classNames('fixed inset-x-0 bottom-0 z-50 border-t border-ovia-line bg-ovia-ivory/97 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgb(41_35_39/0.09)] backdrop-blur-xl transition-transform duration-300 lg:hidden', isFooterVisible && 'pointer-events-none translate-y-full')} data-testid="mobile-pdp-action-bar">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-ovia-plum">{hasKnownPrice ? formatInr(product.priceInPaise) : 'Price unavailable'}</p>
            <p className="mt-0.5 truncate text-[0.68rem] text-ovia-muted">{!hasKnownPrice ? 'Official price not supplied' : missingOption ? `Select ${missingOption.name}` : selectionLabel || `Quantity ${quantity}`}</p>
          </div>
          <button className="customer-primary-action inline-flex min-h-13 min-w-[9.75rem] items-center justify-center gap-2 rounded-control bg-ovia-primary px-5 text-sm font-bold text-white shadow-[0_7px_18px_rgb(127_23_50/0.16)] disabled:cursor-not-allowed disabled:bg-ovia-muted/30 disabled:shadow-none" data-testid="mobile-sticky-add-to-bag" disabled={!canAddToBag || addToBagState !== 'idle'} onClick={handleAddToBag} type="button">
            {addToBagState === 'added' ? <Check aria-hidden="true" size={18} /> : <ShoppingBag aria-hidden="true" size={18} />}
            {addToBagState === 'adding' ? 'Adding…' : addToBagState === 'added' ? 'Added' : !hasKnownPrice ? 'Unavailable' : missingOption ? 'Select option' : 'Add to bag'}
          </button>
        </div>
      </div>

      <ConfirmationSheet
        image={product.images[0]}
        isOpen={isConfirmationOpen}
        onClose={() => setIsConfirmationOpen(false)}
        onViewBag={() => {
          setIsConfirmationOpen(false)
          addToBagTimers.current.push(window.setTimeout(openCart, 320))
        }}
        priceInPaise={(product.priceInPaise ?? 0) * quantity}
        productName={product.catalogueName}
        quantity={quantity}
        selectionLabel={selectionLabel}
      />
    </>
  )
}
