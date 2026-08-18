import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowRight, X } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'

interface MobileNavigationDrawerProps {
  isOpen: boolean
  onClose: () => void
}

const navigation = [
  ['Featured', '/#featured'],
  ['Necklaces', '/#necklaces'],
  ['Earrings', '/#earrings'],
  ['Bracelets', '/#bracelets'],
  ['Rings', '/#rings'],
] as const

export function MobileNavigationDrawer({ isOpen, onClose }: MobileNavigationDrawerProps) {
  const prefersReducedMotion = useReducedMotion()

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
        <div className="fixed inset-0 z-70" role="dialog" aria-modal="true" aria-label="Jewellgalleria navigation">
          <motion.button animate={{ opacity: 1 }} aria-label="Close navigation" className="absolute inset-0 bg-ovia-ink/35 backdrop-blur-[2px]" exit={{ opacity: 0 }} initial={{ opacity: 0 }} onClick={onClose} type="button" />
          <motion.aside
            animate={{ x: 0 }}
            className="absolute inset-y-0 left-0 flex w-[min(88vw,23rem)] flex-col bg-ovia-ivory shadow-floating"
            exit={{ x: prefersReducedMotion ? 0 : '-100%' }}
            initial={{ x: prefersReducedMotion ? 0 : '-100%' }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center justify-between border-b border-ovia-line px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
              <Link aria-label="Jewellgalleria home" onClick={onClose} to="/"><img alt="Jewellgalleria" className="size-12 object-cover" src="/brand/jewellgalleria-logo.png" /></Link>
              <button aria-label="Close navigation" className="flex size-12 items-center justify-center rounded-full text-ovia-plum hover:bg-ovia-blush/55" onClick={onClose} type="button"><X aria-hidden="true" size={21} /></button>
            </div>
            <nav className="flex-1 overflow-y-auto px-5 py-6">
              <p className="type-eyebrow">Jewellgalleria catalogue</p>
              <div className="mt-4 divide-y divide-ovia-line">
                {navigation.map(([label, href]) => (
                  <a className="flex min-h-14 items-center justify-between font-display text-2xl text-ovia-ink" href={href} key={href} onClick={onClose}>
                    {label}<ArrowRight aria-hidden="true" className="text-ovia-primary" size={17} />
                  </a>
                ))}
              </div>
              <Link
                className="group mt-8 block rounded-card border border-ovia-plum bg-ovia-plum p-5 text-white shadow-[0_16px_34px_rgb(71_34_44/0.18)]"
                data-testid="mobile-drawer-business-preview"
                onClick={onClose}
                to="/business"
              >
                <span className="text-[0.62rem] font-bold tracking-[0.14em] text-ovia-blush uppercase">Private demo workspace</span>
                <span className="mt-2 flex items-center justify-between gap-4 font-display text-2xl">
                  Business Preview
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/12">
                    <ArrowRight aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" size={18} />
                  </span>
                </span>
                <span className="mt-2 block text-xs leading-5 text-white/70">Manage products, inventory, orders and analytics behind the storefront.</span>
              </Link>
            </nav>
            <p className="border-t border-ovia-line px-5 py-4 text-[0.64rem] leading-5 text-ovia-muted">Private concept for Jewellgalleria</p>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  )
}
