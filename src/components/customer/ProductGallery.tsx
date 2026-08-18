import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowLeft, ArrowRight, Heart, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type UIEvent } from 'react'

import { classNames } from '../../lib/classNames'

interface ProductGalleryProps {
  images: readonly string[]
  isWishlisted: boolean
  onToggleWishlist: () => void
  productName: string
}

function getScrollIndex(element: HTMLDivElement) {
  if (element.clientWidth === 0) return 0
  return Math.round(element.scrollLeft / element.clientWidth)
}

function scrollTrack(
  element: HTMLDivElement | null,
  index: number,
  behavior: ScrollBehavior,
) {
  if (!element) return
  element.scrollTo({ left: element.clientWidth * index, behavior })
}

export function ProductGallery({
  images,
  isWishlisted,
  onToggleWishlist,
  productName,
}: ProductGalleryProps) {
  const prefersReducedMotion = useReducedMotion()
  const [activeIndex, setActiveIndex] = useState(0)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const mobileTrackRef = useRef<HTMLDivElement>(null)
  const lightboxTrackRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const openingIndexRef = useRef(0)

  const selectImage = useCallback((index: number) => {
    setActiveIndex(index)
    const behavior = prefersReducedMotion ? 'auto' : 'smooth'
    scrollTrack(mobileTrackRef.current, index, behavior)
    scrollTrack(lightboxTrackRef.current, index, behavior)
  }, [prefersReducedMotion])

  const openLightbox = (index: number) => {
    openingIndexRef.current = index
    setActiveIndex(index)
    setIsLightboxOpen(true)
  }

  const handleGalleryScroll = (event: UIEvent<HTMLDivElement>) => {
    const index = Math.min(
      images.length - 1,
      Math.max(0, getScrollIndex(event.currentTarget)),
    )
    setActiveIndex(index)
  }

  useEffect(() => {
    if (!isLightboxOpen) return

    const bodyStyle = document.body.style
    const originalOverflow = bodyStyle.getPropertyValue('overflow')
    bodyStyle.setProperty('overflow', 'hidden')
    const animationFrame = window.requestAnimationFrame(() => {
      scrollTrack(lightboxTrackRef.current, openingIndexRef.current, 'auto')
      closeButtonRef.current?.focus()
    })
    return () => {
      if (originalOverflow) bodyStyle.setProperty('overflow', originalOverflow)
      else bodyStyle.removeProperty('overflow')
      window.cancelAnimationFrame(animationFrame)
    }
  }, [isLightboxOpen])

  useEffect(() => {
    if (!isLightboxOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsLightboxOpen(false)
      if (event.key === 'ArrowLeft') selectImage(Math.max(0, activeIndex - 1))
      if (event.key === 'ArrowRight') {
        selectImage(Math.min(images.length - 1, activeIndex + 1))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeIndex, images.length, isLightboxOpen, selectImage])

  const wishlistButton = (
    <button
      aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
      aria-pressed={isWishlisted}
      className={classNames(
        'absolute top-4 right-4 z-10 flex size-12 items-center justify-center rounded-full border border-white/70 shadow-sm backdrop-blur-md transition-colors',
        isWishlisted
          ? 'bg-ovia-primary text-white'
          : 'bg-white/90 text-ovia-plum hover:bg-ovia-blush',
      )}
      onClick={onToggleWishlist}
      type="button"
    >
      <Heart
        aria-hidden="true"
        fill={isWishlisted ? 'currentColor' : 'none'}
        size={20}
      />
    </button>
  )

  return (
    <>
      <div className="min-w-0 md:mx-auto md:w-full md:max-w-[30rem] lg:hidden">
        <div className="relative bg-[#eee3dc] sm:rounded-[1.25rem]">
          {wishlistButton}
          <div
            aria-label={`${productName} image gallery`}
            className="scrollbar-none flex snap-x snap-mandatory overflow-x-auto scroll-smooth overscroll-x-contain sm:rounded-[1.25rem]"
            data-testid="mobile-gallery-track"
            onScroll={handleGalleryScroll}
            ref={mobileTrackRef}
          >
            {images.map((image, index) => (
              <button
                aria-label={`Open image ${index + 1} of ${images.length}`}
                className="relative aspect-[5/6] w-full shrink-0 snap-center snap-always overflow-hidden bg-[#eee3dc]"
                data-testid={`gallery-slide-${index + 1}`}
                key={image}
                onClick={() => openLightbox(index)}
                type="button"
              >
                <img
                  alt={`${productName}, view ${index + 1}`}
                  className="size-full object-contain"
                  draggable="false"
                  fetchPriority={index === 0 ? 'high' : 'auto'}
                  loading={index === 0 ? 'eager' : 'lazy'}
                  src={image}
                />
              </button>
            ))}
          </div>
          <span className="absolute bottom-4 left-4 rounded-full bg-ovia-ivory/92 px-3 py-1.5 text-[0.65rem] font-bold tracking-[0.08em] text-ovia-plum backdrop-blur-md">
            {activeIndex + 1} / {images.length}
          </span>
        </div>

        {images.length > 1 && (
          <div
            aria-label="Choose product image"
            className="flex min-h-12 items-center justify-center gap-0.5"
            role="group"
          >
            {images.map((image, index) => (
              <button
                aria-label={`Show image ${index + 1}`}
                aria-pressed={activeIndex === index}
                className="flex size-11 items-center justify-center"
                key={image}
                onClick={() => selectImage(index)}
                type="button"
              >
                <span
                  className={classNames(
                    'block h-1.5 rounded-full transition-[width,background-color] duration-200',
                    activeIndex === index
                      ? 'w-5 bg-ovia-primary'
                      : 'w-1.5 bg-ovia-muted/35',
                  )}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="hidden min-w-0 grid-cols-[5.25rem_minmax(0,1fr)] gap-4 lg:grid">
        <div
          aria-label="Choose product image"
          className="flex flex-col gap-3"
          role="group"
        >
          {images.map((image, index) => (
            <button
              aria-label={`Show image ${index + 1}`}
              aria-pressed={activeIndex === index}
              className={classNames(
                'aspect-[4/5] w-full overflow-hidden border-2 bg-[#eee3dc] transition-[border-color,opacity] duration-200',
                activeIndex === index
                  ? 'border-ovia-primary opacity-100'
                  : 'border-transparent opacity-65 hover:opacity-100',
              )}
              data-testid={`gallery-thumbnail-${index + 1}`}
              key={image}
              onClick={() => selectImage(index)}
              type="button"
            >
              <img alt="" className="size-full object-cover" src={image} />
            </button>
          ))}
        </div>

        <motion.div
          animate={{ opacity: 1 }}
          className="relative overflow-hidden bg-[#eee3dc]"
          initial={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.35 }}
        >
          {wishlistButton}
          <button
            aria-label={`Open image ${activeIndex + 1} full screen`}
            className="block aspect-[4/5] max-h-[50rem] w-full cursor-zoom-in overflow-hidden"
            data-testid="desktop-gallery-primary"
            onClick={() => openLightbox(activeIndex)}
            type="button"
          >
            <AnimatePresence initial={false} mode="wait">
              <motion.img
                alt={`${productName}, view ${activeIndex + 1}`}
                animate={{ opacity: 1 }}
                className="size-full object-contain"
                initial={{ opacity: 0.3 }}
                key={images[activeIndex]}
                src={images[activeIndex]}
                transition={{ duration: prefersReducedMotion ? 0 : 0.18 }}
              />
            </AnimatePresence>
          </button>
          <span className="absolute bottom-5 left-5 rounded-full bg-ovia-ivory/92 px-3 py-1.5 text-[0.65rem] font-bold tracking-[0.08em] text-ovia-plum backdrop-blur-md">
            {activeIndex + 1} / {images.length}
          </span>
        </motion.div>
      </div>

      <AnimatePresence>
        {isLightboxOpen && (
          <motion.div
            animate={{ opacity: 1 }}
            aria-label={`${productName} full-screen gallery`}
            aria-modal="true"
            className="fixed inset-0 z-100 touch-pan-x overscroll-none bg-[#16080c] text-white"
            data-testid="product-lightbox"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            role="dialog"
            transition={{ duration: prefersReducedMotion ? 0 : 0.18 }}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-linear-to-b from-black/55 to-transparent px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-10 sm:px-6">
              <span
                aria-live="polite"
                className="text-xs font-semibold tracking-[0.13em]"
                data-testid="lightbox-counter"
              >
                {activeIndex + 1} / {images.length}
              </span>
              <button
                aria-label="Close full-screen gallery"
                className="pointer-events-auto flex size-12 items-center justify-center rounded-full bg-white/12 text-white backdrop-blur-md transition-colors hover:bg-white/20"
                data-testid="lightbox-close"
                onClick={() => setIsLightboxOpen(false)}
                ref={closeButtonRef}
                type="button"
              >
                <X aria-hidden="true" size={23} />
              </button>
            </div>

            <div
              className="scrollbar-none flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth"
              data-testid="lightbox-track"
              onScroll={handleGalleryScroll}
              ref={lightboxTrackRef}
            >
              {images.map((image, index) => (
                <div
                  className="flex h-full w-full shrink-0 snap-center snap-always items-center justify-center px-3 py-16 sm:px-20"
                  key={image}
                >
                  <img
                    alt={`${productName}, enlarged view ${index + 1}`}
                    className="max-h-full max-w-full object-contain"
                    draggable="false"
                    src={image}
                  />
                </div>
              ))}
            </div>

            {images.length > 1 && (
              <>
                <button
                  aria-label="Previous image"
                  className="absolute top-1/2 left-5 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md hover:bg-white/20 disabled:opacity-25 md:flex"
                  disabled={activeIndex === 0}
                  onClick={() => selectImage(Math.max(0, activeIndex - 1))}
                  type="button"
                >
                  <ArrowLeft aria-hidden="true" size={21} />
                </button>
                <button
                  aria-label="Next image"
                  className="absolute top-1/2 right-5 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md hover:bg-white/20 disabled:opacity-25 md:flex"
                  disabled={activeIndex === images.length - 1}
                  onClick={() =>
                    selectImage(Math.min(images.length - 1, activeIndex + 1))
                  }
                  type="button"
                >
                  <ArrowRight aria-hidden="true" size={21} />
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
