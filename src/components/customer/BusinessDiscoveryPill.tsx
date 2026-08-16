import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowRight, Sparkles, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const SESSION_KEY = 'ovia-business-discovery-seen'
const REVEAL_PROGRESS = 0.37

export function BusinessDiscoveryPill() {
  const prefersReducedMotion = useReducedMotion()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) return

    const checkProgress = () => {
      const availableScroll = document.documentElement.scrollHeight - window.innerHeight
      if (availableScroll <= 0 || window.scrollY / availableScroll < REVEAL_PROGRESS) return

      sessionStorage.setItem(SESSION_KEY, 'seen')
      setIsVisible(true)
      window.removeEventListener('scroll', checkProgress)
    }

    checkProgress()
    window.addEventListener('scroll', checkProgress, { passive: true })
    return () => window.removeEventListener('scroll', checkProgress)
  }, [])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.aside
          animate={{ opacity: 1, y: 0 }}
          aria-label="Business Preview discovery"
          className="fixed right-7 bottom-7 z-35 hidden max-w-[calc(100vw-3.5rem)] items-center rounded-full border border-ovia-primary/22 bg-ovia-ivory/96 pl-4 shadow-[0_12px_34px_rgb(41_35_39/0.16)] backdrop-blur-xl lg:flex"
          data-testid="business-discovery-pill"
          exit={{ opacity: 0, y: prefersReducedMotion ? 0 : 6 }}
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.24, ease: 'easeOut' }}
        >
          <Link
            className="flex min-h-12 items-center gap-2 pr-1 text-xs font-bold text-ovia-plum sm:text-sm"
            data-testid="floating-business-preview"
            to="/business"
          >
            <Sparkles aria-hidden="true" className="shrink-0 text-ovia-primary" size={15} />
            <span>See how Ovia runs behind the scenes</span>
            <ArrowRight aria-hidden="true" className="shrink-0" size={15} />
          </Link>
          <button
            aria-label="Dismiss Business Preview discovery"
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-ovia-muted transition-colors hover:bg-ovia-blush/55 hover:text-ovia-plum"
            data-testid="dismiss-business-discovery"
            onClick={() => {
              sessionStorage.setItem(SESSION_KEY, 'dismissed')
              setIsVisible(false)
            }}
            type="button"
          >
            <X aria-hidden="true" size={16} />
          </button>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
