import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type TouchEvent,
} from 'react'
import { Link } from 'react-router-dom'

import type { SellableProduct } from '../../data/productTypes'
import { classNames } from '../../lib/classNames'
import { formatInr } from '../../lib/currency'

export interface HeroSlide {
  product: SellableProduct
  headline: string
  copy: string
  cta: string
  surface: string
  imageSurface: string
  mobileObjectPosition: string
  desktopObjectPosition: string
  imageFit: 'contain' | 'cover'
}

interface HomeHeroCarouselProps {
  slides: readonly [HeroSlide, ...HeroSlide[]]
}

const AUTOPLAY_DELAY = 5_000
const SWIPE_DISTANCE = 48
const transitionEase = [0.22, 1, 0.36, 1] as const
const slideVariants = {
  enter: (direction: number) => ({ opacity: 0, x: direction > 0 ? '5%' : '-5%' }),
  center: { opacity: 1, x: 0 },
  exit: (direction: number) => ({ opacity: 0, x: direction > 0 ? '-3%' : '3%' }),
}

export function HomeHeroCarousel({ slides }: HomeHeroCarouselProps) {
  const prefersReducedMotion = useReducedMotion()
  const [activeIndex, setActiveIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [hasUserInteracted, setHasUserInteracted] = useState(false)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const blockSlideClick = useRef(false)
  const activeSlide = slides[activeIndex] ?? slides[0]

  useEffect(() => {
    if (prefersReducedMotion || hasUserInteracted || slides.length < 2) return
    const timer = window.setTimeout(() => {
      setDirection(1)
      setActiveIndex((index) => (index + 1) % slides.length)
    }, AUTOPLAY_DELAY)
    return () => window.clearTimeout(timer)
  }, [activeIndex, hasUserInteracted, prefersReducedMotion, slides.length])

  const showSlide = (index: number, movement: number) => {
    setHasUserInteracted(true)
    if (index === activeIndex) return
    setDirection(movement)
    setActiveIndex(index)
  }
  const showPrevious = () => showSlide((activeIndex - 1 + slides.length) % slides.length, -1)
  const showNext = () => showSlide((activeIndex + 1) % slides.length, 1)

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      showPrevious()
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      showNext()
    }
  }

  const handleTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const start = touchStart.current
    const touch = event.changedTouches[0]
    touchStart.current = null
    if (!start || !touch) return
    const distanceX = touch.clientX - start.x
    const distanceY = touch.clientY - start.y
    if (Math.abs(distanceX) < SWIPE_DISTANCE || Math.abs(distanceX) <= Math.abs(distanceY)) return

    blockSlideClick.current = true
    window.setTimeout(() => { blockSlideClick.current = false }, 450)
    if (distanceX > 0) showPrevious()
    else showNext()
  }

  return (
    <section
      aria-label="Ovia featured collection"
      aria-roledescription="carousel"
      className="relative h-[70svh] min-h-[31rem] max-h-[39rem] overflow-hidden border-b border-ovia-line bg-ovia-ivory focus-visible:outline focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-ovia-primary/40 sm:h-[78svh] sm:min-h-[38rem] sm:max-h-[44rem] lg:h-[74svh] lg:min-h-160 lg:max-h-200"
      data-testid="home-hero-carousel"
      onKeyDown={handleKeyDown}
      onTouchCancel={() => { touchStart.current = null }}
      onTouchEnd={handleTouchEnd}
      onTouchStart={(event) => {
        const touch = event.touches[0]
        if (!touch) return
        touchStart.current = { x: touch.clientX, y: touch.clientY }
      }}
      style={{ touchAction: 'pan-y' }}
      tabIndex={0}
    >
      <AnimatePresence custom={direction} initial={false} mode="popLayout">
        <motion.article
          animate="center"
          aria-label={`${activeSlide.headline}: ${activeSlide.product.catalogueName}`}
          aria-roledescription="slide"
          className="absolute inset-0 overflow-hidden"
          custom={direction}
          data-slide-index={activeIndex}
          data-testid="hero-active-slide"
          exit="exit"
          initial="enter"
          key={activeSlide.product.id}
          role="group"
          style={{ backgroundColor: activeSlide.surface }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.62, ease: transitionEase }}
          variants={slideVariants}
        >
          <div className="absolute inset-0 sm:hidden" style={{ backgroundColor: activeSlide.imageSurface }}>
            <motion.img
              alt={activeSlide.product.catalogueName}
              animate={{ scale: 1, x: 0 }}
              className="size-full object-cover [object-position:var(--hero-mobile-position)]"
              fetchPriority={activeIndex === 0 ? 'high' : 'auto'}
              initial={{ scale: prefersReducedMotion ? 1 : 1.035, x: prefersReducedMotion ? 0 : direction * 8 }}
              src={activeSlide.product.image}
              style={{
                '--hero-mobile-position': activeSlide.mobileObjectPosition,
              } as CSSProperties}
              transition={{ duration: prefersReducedMotion ? 0 : 0.68, ease: transitionEase }}
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-ovia-ink/78 via-ovia-ink/30 to-transparent" />
            <div className="pointer-events-none absolute inset-x-4 bottom-11 z-20 text-white">
              <p className="truncate text-lg leading-tight font-semibold">{activeSlide.product.catalogueName}</p>
              <div className="mt-1 flex items-center justify-between gap-4">
                <p className="text-base font-bold">{formatInr(activeSlide.product.priceInPaise)}</p>
                <Link
                  className="pointer-events-auto inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-white"
                  data-testid="hero-mobile-cta"
                  onClick={() => setHasUserInteracted(true)}
                  to={`/product/${activeSlide.product.slug}`}
                >
                  Shop Now <ArrowRight aria-hidden="true" size={16} />
                </Link>
              </div>
            </div>
          </div>

          <div className="hidden size-full grid-rows-[64%_36%] sm:grid lg:grid-cols-[minmax(23rem,0.9fr)_minmax(25rem,1.1fr)] lg:grid-rows-1">
            <div className="relative order-2 flex min-h-0 items-center px-5 pt-3 pb-13 lg:order-1 lg:px-[clamp(2.5rem,6vw,7.5rem)] lg:py-18" style={{ backgroundColor: activeSlide.surface }}>
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="pointer-events-none relative z-20 max-w-xl"
                initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 14 }}
                transition={{ delay: prefersReducedMotion ? 0 : 0.14, duration: prefersReducedMotion ? 0 : 0.54, ease: transitionEase }}
              >
                <p className="text-[0.66rem] font-bold tracking-[0.14em] text-ovia-plum uppercase lg:text-xs">
                  {activeSlide.product.catalogueName} · {formatInr(activeSlide.product.priceInPaise)}
                </p>
                <h1 className="mt-2 max-w-[21rem] font-display text-[clamp(2.55rem,11.5vw,3.25rem)] leading-[0.88] font-medium tracking-[-0.045em] text-ovia-ink lg:mt-5 lg:max-w-[42rem] lg:text-[clamp(4.5rem,6.8vw,7.1rem)] lg:leading-[0.86]">
                  {activeSlide.headline}
                </h1>
                <p className="mt-3 max-w-sm text-sm leading-6 text-ovia-muted lg:mt-7 lg:text-lg lg:leading-8">{activeSlide.copy}</p>
                <Link
                  className="customer-primary-action pointer-events-auto mt-4 inline-flex min-h-12 items-center gap-2 rounded-full bg-ovia-primary px-5 text-sm font-bold text-white shadow-[0_12px_28px_rgb(103_52_83/0.16)] hover:bg-ovia-plum lg:mt-8 lg:px-6"
                  data-testid="hero-cta"
                  onClick={() => setHasUserInteracted(true)}
                  to={`/product/${activeSlide.product.slug}`}
                >
                  {activeSlide.cta}<ArrowRight aria-hidden="true" size={17} />
                </Link>
              </motion.div>
            </div>

            <div className="relative order-1 min-h-0 overflow-hidden lg:order-2" style={{ backgroundColor: activeSlide.imageSurface }}>
              <motion.img
                alt={activeSlide.product.catalogueName}
                animate={{ scale: 1, x: 0 }}
                className={classNames(
                  'size-full',
                  activeSlide.imageFit === 'contain' ? 'object-contain' : 'object-cover',
                  '[object-position:var(--hero-mobile-position)] lg:[object-position:var(--hero-desktop-position)]',
                )}
                fetchPriority={activeIndex === 0 ? 'high' : 'auto'}
                initial={{ scale: prefersReducedMotion ? 1 : 1.035, x: prefersReducedMotion ? 0 : direction * 8 }}
                src={activeSlide.product.image}
                style={{
                  '--hero-mobile-position': activeSlide.mobileObjectPosition,
                  '--hero-desktop-position': activeSlide.desktopObjectPosition,
                } as CSSProperties}
                transition={{ duration: prefersReducedMotion ? 0 : 0.68, ease: transitionEase }}
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-ovia-ink/16 to-transparent lg:inset-y-0 lg:left-0 lg:h-auto lg:w-20 lg:bg-gradient-to-r" />
              <span className="pointer-events-none absolute top-4 right-5 font-display text-5xl leading-none text-white/60 lg:top-7 lg:right-8 lg:text-7xl">0{activeIndex + 1}</span>
            </div>
          </div>

          <Link
            aria-label={`View ${activeSlide.product.catalogueName}`}
            className="absolute inset-0 z-10 cursor-pointer focus-visible:outline-0"
            data-testid="hero-slide-link"
            onClick={(event) => {
              if (blockSlideClick.current) event.preventDefault()
              else setHasUserInteracted(true)
            }}
            to={`/product/${activeSlide.product.slug}`}
          >
            <span className="sr-only">View {activeSlide.product.catalogueName}</span>
          </Link>
        </motion.article>
      </AnimatePresence>

      <div className="absolute right-4 bottom-3 z-30 flex items-center gap-1 lg:right-auto lg:bottom-7 lg:left-[clamp(2.5rem,6vw,7.5rem)]" role="tablist" aria-label="Choose featured slide">
        {slides.map((slide, index) => {
          const selected = activeIndex === index
          return (
            <button
              aria-label={`Show slide ${index + 1}: ${slide.headline}`}
              aria-selected={selected}
              className="group flex min-h-11 min-w-8 items-center justify-center"
              data-testid={`hero-indicator-${index}`}
              key={slide.product.id}
              onClick={() => showSlide(index, index > activeIndex ? 1 : -1)}
              role="tab"
              type="button"
            >
              <span className={classNames('h-1 rounded-full transition-[width,background-color] duration-300', selected ? 'w-8 bg-white sm:bg-ovia-primary' : 'w-3 bg-white/45 sm:bg-ovia-muted/35 sm:group-hover:bg-ovia-primary/65')} />
            </button>
          )
        })}
      </div>

      <div className="absolute right-7 bottom-7 z-30 hidden items-center gap-2 lg:flex">
        <button aria-label="Previous hero slide" className="flex size-12 items-center justify-center rounded-full border border-ovia-plum/20 bg-ovia-ivory/90 text-ovia-plum shadow-sm backdrop-blur-md transition-colors hover:border-ovia-primary hover:bg-white" data-testid="hero-previous" onClick={showPrevious} type="button"><ArrowLeft aria-hidden="true" size={18} /></button>
        <button aria-label="Next hero slide" className="flex size-12 items-center justify-center rounded-full bg-ovia-primary text-white shadow-sm transition-colors hover:bg-ovia-plum" data-testid="hero-next" onClick={showNext} type="button"><ArrowRight aria-hidden="true" size={18} /></button>
      </div>

      <a aria-label="Discover more below" className="absolute bottom-0 left-1/2 z-30 hidden min-h-10 -translate-x-1/2 items-center gap-2 text-[0.62rem] font-bold tracking-[0.1em] text-ovia-muted uppercase hover:text-ovia-plum sm:inline-flex lg:bottom-7" href="#category-title">
        <span className="hidden lg:inline">Discover more</span>
        <motion.span animate={prefersReducedMotion ? undefined : { y: [0, 4, 0] }} className="flex size-7 items-center justify-center rounded-full border border-ovia-muted/25" transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}><ArrowDown aria-hidden="true" size={13} /></motion.span>
      </a>

      <p aria-live="polite" className="sr-only">Slide {activeIndex + 1} of {slides.length}: {activeSlide.headline}</p>
    </section>
  )
}
