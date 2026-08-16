import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowRight, ShoppingBag, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { formatInr } from '../../lib/currency'
import { sellableProducts } from '../../data/products'
import { useDemoStore } from '../../store/demoStore'
import { CartLineItem } from './CartLineItem'

interface CartDrawerProps {
  isOpen: boolean
  onClose: () => void
}

export function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const prefersReducedMotion = useReducedMotion()
  const [isDesktopDrawer, setIsDesktopDrawer] = useState(() =>
    window.matchMedia('(min-width: 640px)').matches,
  )
  const cart = useDemoStore((state) => state.cart)
  const createdProducts = useDemoStore((state) => state.createdProducts)
  const commerceProducts = [...sellableProducts, ...createdProducts]
  const subtotal = cart.reduce((sum, line) => {
    const product = commerceProducts.find((item) => item.id === line.productId)
    return sum + (product?.priceInPaise ?? 0) * line.quantity
  }, 0)

  useEffect(() => {
    const media = window.matchMedia('(min-width: 640px)')
    const handleChange = () => setIsDesktopDrawer(media.matches)
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

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
        <div className="fixed inset-0 z-60" role="dialog" aria-modal="true">
          <motion.button
            aria-label="Close bag"
            className="absolute inset-0 bg-ovia-ink/35 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            type="button"
          />
          <motion.aside
            className="absolute right-0 bottom-0 flex max-h-[92dvh] w-full flex-col rounded-t-sheet bg-ovia-ivory shadow-floating sm:top-0 sm:h-full sm:max-h-none sm:max-w-md sm:rounded-none sm:rounded-l-sheet"
            data-testid="cart-drawer"
            initial={prefersReducedMotion
              ? { opacity: 0 }
              : isDesktopDrawer
                ? { opacity: 0, x: '100%' }
                : { opacity: 0, y: '100%' }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={prefersReducedMotion
              ? { opacity: 0 }
              : isDesktopDrawer
                ? { opacity: 0, x: '100%' }
                : { opacity: 0, y: '100%' }}
            transition={prefersReducedMotion
              ? { duration: 0 }
              : { type: 'spring', stiffness: 340, damping: 34 }}
          >
            <div className="flex items-center justify-between border-b border-ovia-line px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <ShoppingBag aria-hidden="true" className="text-ovia-primary" size={21} />
                <h2 className="font-display text-2xl">Your bag</h2>
                <span className="rounded-full bg-ovia-blush px-2 py-0.5 text-xs font-bold text-ovia-plum">
                  {cart.reduce((count, line) => count + line.quantity, 0)}
                </span>
              </div>
              <button
                aria-label="Close bag"
                className="flex size-11 items-center justify-center rounded-full text-ovia-muted hover:bg-ovia-blush/50 hover:text-ovia-plum"
                onClick={onClose}
                type="button"
              >
                <X aria-hidden="true" size={21} />
              </button>
            </div>

            {cart.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-8 py-16 text-center">
                <span className="flex size-16 items-center justify-center rounded-full bg-ovia-blush/60 text-ovia-plum">
                  <ShoppingBag aria-hidden="true" size={26} strokeWidth={1.5} />
                </span>
                <h3 className="mt-5 font-display text-2xl">Your bag is waiting</h3>
                <p className="mt-2 max-w-xs text-sm leading-6 text-ovia-muted">
                  Explore the Ovia edit and choose a piece that feels like you.
                </p>
                <Link
                  className="mt-6 inline-flex min-h-11 items-center rounded-control bg-ovia-primary px-5 text-sm font-semibold text-white hover:bg-ovia-plum"
                  onClick={onClose}
                  to="/"
                >
                  Continue shopping
                </Link>
              </div>
            ) : (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto px-5 sm:px-6">
                  {cart.map((line) => (
                    <CartLineItem compact key={line.id} line={line} />
                  ))}
                </div>
                <div className="border-t border-ovia-line bg-white px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-sm text-ovia-muted">Subtotal</span>
                    <strong className="font-display text-2xl text-ovia-plum">
                      {formatInr(subtotal)}
                    </strong>
                  </div>
                  <Link
                    className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-control bg-ovia-primary px-5 text-sm font-bold text-white transition-colors hover:bg-ovia-plum"
                    onClick={onClose}
                    data-testid="drawer-checkout"
                    to="/checkout"
                  >
                    Proceed to checkout
                    <ArrowRight aria-hidden="true" size={17} />
                  </Link>
                  <Link
                    className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-control text-sm font-semibold text-ovia-plum hover:bg-ovia-blush/40"
                    onClick={onClose}
                    to="/cart"
                  >
                    View full bag
                  </Link>
                </div>
              </>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  )
}
