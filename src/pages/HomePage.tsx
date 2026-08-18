import { motion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'

import { BusinessRevealSection } from '../components/customer/BusinessRevealSection'
import {
  HomeHeroCarousel,
  type HeroSlide,
} from '../components/customer/HomeHeroCarousel'
import { JewelleryDetailsSection } from '../components/customer/JewelleryDetailsSection'
import { JewelleryEditorialSection } from '../components/customer/JewelleryEditorialSection'
import { ProductSection } from '../components/customer/ProductSection'
import { Container } from '../components/layout/LayoutPrimitives'
import { realProducts, sellableProducts } from '../data/products'
import { isProductActive } from '../data/productTypes'
import { useDemoStore } from '../store/demoStore'

const bySlug = Object.fromEntries(
  sellableProducts.map((product) => [product.slug, product]),
)

function requiredProduct(slug: string) {
  const product = bySlug[slug]
  if (!product) {
    throw new Error(`Required Jewellgalleria product is missing: ${slug}`)
  }
  return product
}

const floralNecklace = requiredProduct('floral-drop-necklace')
const jhumkaEarrings = requiredProduct('heritage-jhumka-earrings')
const statementNecklace = requiredProduct('pear-drop-statement-necklace')
const chandelierEarring = requiredProduct('cascading-chandelier-earring')
const pearlClimber = requiredProduct('pearl-floral-ear-climber')
const statementRing = requiredProduct('two-row-statement-ring')
const multicolourBracelet = requiredProduct('multicolour-oval-bracelet')
const marquiseBracelet = requiredProduct('oval-marquise-bracelet')

const featuredProducts = [
  statementNecklace,
  jhumkaEarrings,
  floralNecklace,
  statementRing,
]

const earrings = realProducts.filter(
  (product) => product.category === 'earrings',
)

const categoryCards = [
  { label: 'Necklaces', href: '#necklaces', product: statementNecklace },
  { label: 'Earrings', href: '#earrings', product: jhumkaEarrings },
  { label: 'Bracelets', href: '#bracelets', product: multicolourBracelet },
  { label: 'Rings', href: '#rings', product: statementRing },
]

const heroSlides = [
  {
    product: statementNecklace,
    headline: 'A study in light.',
    copy: 'Clear geometric forms in a balanced, light-catching arrangement.',
    cta: 'View necklace',
    mobileObjectPosition: 'center 52%',
    desktopObjectPosition: 'center 54%',
  },
  {
    product: jhumkaEarrings,
    headline: 'Heritage, in motion.',
    copy: 'An ornate front-facing composition of colour and movement.',
    cta: 'View earrings',
    mobileObjectPosition: 'center 48%',
    desktopObjectPosition: 'center 50%',
  },
  {
    product: floralNecklace,
    headline: 'Delicate by design.',
    copy: 'Floral and teardrop motifs in a quiet, refined arrangement.',
    cta: 'View necklace',
    mobileObjectPosition: 'center 58%',
    desktopObjectPosition: 'center 58%',
  },
] as const satisfies readonly [HeroSlide, ...HeroSlide[]]

interface CustomerOutletContext {
  openCart: () => void
}

export function HomePage() {
  const { openCart } = useOutletContext<CustomerOutletContext>()
  const createdProducts = useDemoStore((state) => state.createdProducts)
  const activeCreatedProducts = createdProducts.filter(isProductActive)

  return (
    <>
      <HomeHeroCarousel slides={heroSlides} />

      <Container>
        <section aria-labelledby="category-title" className="pt-14 pb-5 sm:pt-20 sm:pb-8 lg:pt-24 lg:pb-10">
          <div className="mb-6 sm:mb-10">
            <p className="type-eyebrow">Explore the catalogue</p>
            <h2 className="mt-3 font-display text-[2.55rem] leading-[0.92] font-medium tracking-[-0.04em] text-ovia-ink sm:text-5xl" id="category-title">
              Shop by category
            </h2>
          </div>

          <div className="scrollbar-none -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto overscroll-x-contain px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:gap-7">
            {categoryCards.map(({ label, href, product }) => (
              <motion.a
                className="group block w-[43vw] max-w-[11.25rem] shrink-0 snap-start sm:w-auto sm:max-w-none"
                href={href}
                key={label}
                whileTap={{ scale: 0.985 }}
              >
                <div className="overflow-hidden bg-[#e8d9cf]">
                  <img alt="" className="aspect-[4/5] w-full object-cover transition-transform duration-500 group-hover:scale-[1.025]" loading="lazy" src={product.images[0]} />
                </div>
                <div className="mt-3 flex min-h-10 items-center justify-between border-b border-ovia-line pb-2.5 text-ovia-ink transition-colors group-hover:text-ovia-primary">
                  <span className="font-display text-[1.35rem] font-medium sm:text-2xl">{label}</span>
                  <ArrowRight aria-hidden="true" size={16} />
                </div>
              </motion.a>
            ))}
          </div>
        </section>

        <ProductSection
          compactTop
          description="Necklaces, earrings and rings from the supplied Jewellgalleria catalogue."
          eyebrow="From the catalogue"
          id="featured"
          onOpenCart={openCart}
          products={featuredProducts}
          title="Jewellgalleria highlights"
        />
      </Container>

      <JewelleryEditorialSection
        anchorIds={['necklaces']}
        detailProduct={pearlClimber}
        featuredProduct={jhumkaEarrings}
        secondaryProduct={statementNecklace}
      />

      <BusinessRevealSection />

      <Container>
        <ProductSection
          description="Floral, fan-shaped and cascading silhouettes across the supplied front-facing pieces."
          eyebrow="Framed closely"
          id="earrings"
          onOpenCart={openCart}
          products={earrings}
          title="Earrings in focus"
        />
      </Container>

      <JewelleryDetailsSection
        anchorIds={['bracelets', 'rings']}
        items={[
          { imageIndex: 2, product: chandelierEarring },
          { imageIndex: 2, product: statementRing },
          { imageIndex: 2, product: marquiseBracelet },
        ]}
      />

      {activeCreatedProducts.length > 0 && (
        <Container>
          <ProductSection
            description="Products published through the private business preview."
            eyebrow="Recently published"
            id="just-added"
            onOpenCart={openCart}
            products={activeCreatedProducts}
            title="Just added"
          />
        </Container>
      )}

    </>
  )
}
