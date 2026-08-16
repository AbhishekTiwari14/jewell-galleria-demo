import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowRight, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { sellableProducts } from '../../data/products'
import { isProductActive } from '../../data/productTypes'
import { formatInr } from '../../lib/currency'
import { useDemoStore } from '../../store/demoStore'

interface CustomerSearchSheetProps {
  isOpen: boolean
  onClose: () => void
}

export function CustomerSearchSheet({ isOpen, onClose }: CustomerSearchSheetProps) {
  const prefersReducedMotion = useReducedMotion()
  const [query, setQuery] = useState('')
  const createdProducts = useDemoStore((state) => state.createdProducts)
  const products = useMemo(
    () => [...sellableProducts, ...createdProducts.filter(isProductActive)],
    [createdProducts],
  )
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return (normalized
      ? products.filter((product) => product.catalogueName.toLowerCase().includes(normalized))
      : products.slice(0, 4)
    ).slice(0, 6)
  }, [products, query])

  useEffect(() => {
    if (!isOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-70" role="dialog" aria-modal="true" aria-label="Search Ovia products">
          <motion.button
            animate={{ opacity: 1 }}
            aria-label="Close search"
            className="absolute inset-0 bg-ovia-ink/32 backdrop-blur-[2px]"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onClick={onClose}
            type="button"
          />
          <motion.section
            animate={{ opacity: 1, y: 0 }}
            className="absolute inset-x-0 top-0 max-h-[88dvh] overflow-y-auto bg-ovia-ivory px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-7 shadow-floating sm:px-6 lg:left-auto lg:w-[34rem]"
            exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -18 }}
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : -18 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.22, ease: 'easeOut' }}
          >
            <div className="mx-auto max-w-xl">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="type-eyebrow">Find your next Ovia piece</p>
                  <h2 className="mt-1.5 font-display text-3xl">Search the edit</h2>
                </div>
                <button aria-label="Close search" className="flex size-12 items-center justify-center rounded-full text-ovia-plum hover:bg-ovia-blush/55" onClick={onClose} type="button">
                  <X aria-hidden="true" size={21} />
                </button>
              </div>
              <label className="mt-6 flex min-h-14 items-center gap-3 rounded-full border border-ovia-primary/30 bg-white px-4 focus-within:border-ovia-primary focus-within:ring-3 focus-within:ring-ovia-primary/15">
                <Search aria-hidden="true" className="text-ovia-primary" size={19} />
                <span className="sr-only">Search products</span>
                <input
                  autoFocus
                  className="customer-search-input min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ovia-muted/65"
                  data-testid="customer-search-input"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search dresses, tops, kurtis…"
                  type="search"
                  value={query}
                />
              </label>
              <p className="mt-6 text-xs font-bold tracking-[0.12em] text-ovia-muted uppercase">{query ? 'Results' : 'Popular in the edit'}</p>
              <div className="mt-3 divide-y divide-ovia-line">
                {results.map((product) => (
                  <Link className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 py-4" key={product.id} onClick={onClose} to={`/product/${product.slug}`}>
                    <img alt="" className="aspect-[4/5] w-full bg-ovia-blush/25 object-cover" src={product.image} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ovia-ink">{product.catalogueName}</p>
                      <p className="mt-1 text-sm font-bold text-ovia-plum">{formatInr(product.priceInPaise)}</p>
                    </div>
                    <ArrowRight aria-hidden="true" className="text-ovia-primary" size={17} />
                  </Link>
                ))}
                {results.length === 0 && <p className="py-10 text-center text-sm text-ovia-muted">No matching catalogue pieces found.</p>}
              </div>
            </div>
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  )
}
