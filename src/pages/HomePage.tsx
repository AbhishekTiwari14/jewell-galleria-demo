import { motion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'

import { EditorialProductSection } from '../components/customer/EditorialProductSection'
import { BusinessRevealSection } from '../components/customer/BusinessRevealSection'
import { HomeHeroCarousel, type HeroSlide } from '../components/customer/HomeHeroCarousel'
import { ProductSection } from '../components/customer/ProductSection'
import { Container } from '../components/layout/LayoutPrimitives'
import { sellableProducts } from '../data/products'
import { isProductActive } from '../data/productTypes'
import { useDemoStore } from '../store/demoStore'

const bySlug = Object.fromEntries(
  sellableProducts.map((product) => [product.slug, product]),
)

function requiredProduct(slug: string) {
  const product = bySlug[slug]
  if (!product) throw new Error(`Required Ovia product is missing: ${slug}`)
  return product
}

const brownDress = requiredProduct('brown-off-shoulder-dress')
const whiteOneShoulder = requiredProduct('white-one-shoulder-piece')
const beigeOnePiece = requiredProduct('beige-off-shoulder-one-piece')
const laceTop = requiredProduct('lace-trimmed-top')
const limeCorset = requiredProduct('lime-shells-corset-kurti')
const greenCorset = requiredProduct('green-heart-corset-kurti')
const purpleCorset = requiredProduct('purple-shell-kurti')

const newArrivals = [
  brownDress,
  whiteOneShoulder,
  laceTop,
  requiredProduct('red-ombre-top'),
]

const tops = sellableProducts.filter(
  (product) => product.category === 'top' || product.category === 'waistcoat',
)

const categoryCards = [
  { label: 'Dresses', href: '#dresses', product: brownDress },
  { label: 'Tops', href: '#tops', product: requiredProduct('red-ombre-top') },
  { label: 'Kurtis', href: '#kurtis', product: limeCorset },
  { label: 'Waistcoat', href: '#tops', product: requiredProduct('waist-coat') },
]

const heroSlides = [
  {
    product: brownDress,
    headline: 'THE AFTER-DARK EDIT',
    copy: 'Statement silhouettes for effortless evenings.',
    cta: 'Shop the Dress',
    surface: '#f0e1dd',
    imageSurface: '#d2bda9',
    mobileObjectPosition: 'center 47%',
    desktopObjectPosition: 'center 50%',
    imageFit: 'contain',
  },
  {
    product: laceTop,
    headline: 'SOFT STATEMENTS',
    copy: 'Feminine details. Everyday silhouettes.',
    cta: 'Explore Tops',
    surface: '#efdaec',
    imageSurface: '#cdb3a4',
    mobileObjectPosition: 'center 31%',
    desktopObjectPosition: 'center 38%',
    imageFit: 'cover',
  },
  {
    product: whiteOneShoulder,
    headline: 'MODERN MUSE',
    copy: 'Minimal shapes made to stand out.',
    cta: 'Shop One-Shoulder',
    surface: '#f5ede7',
    imageSurface: '#b8b5a1',
    mobileObjectPosition: 'center 47%',
    desktopObjectPosition: 'center 50%',
    imageFit: 'contain',
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
        <section aria-labelledby="category-title" className="pt-12 pb-4 sm:py-20 lg:py-24">
          <div className="mb-6 max-w-xl sm:mb-10">
            <p className="type-eyebrow">Find your silhouette</p>
            <h2 className="type-section-title mt-3" id="category-title">Shop by category</h2>
          </div>
          <div className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:gap-x-6 sm:overflow-visible sm:px-0 sm:pb-0">
            {categoryCards.map(({ label, href, product }) => (
              <motion.a className="group block w-[42vw] max-w-[11.5rem] shrink-0 snap-start sm:w-auto sm:max-w-none" href={href} key={label}>
                <div className="overflow-hidden bg-[#f0e5df]">
                  <img
                    alt=""
                    className="aspect-[4/5] w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.025]"
                    loading="lazy"
                    src={product.image}
                  />
                </div>
                <div className="mt-2.5 flex min-h-11 items-center justify-between border-b border-ovia-line pb-2.5 text-ovia-ink transition-colors group-hover:text-ovia-primary">
                  <span className="font-display text-xl font-medium sm:text-2xl">{label}</span>
                  <ArrowRight aria-hidden="true" size={17} />
                </div>
              </motion.a>
            ))}
          </div>
        </section>

        <ProductSection
          badge="New"
          description="A first look at the Ovia pieces leading this private storefront."
          eyebrow="The latest edit"
          id="new-arrivals"
          onOpenCart={openCart}
          products={newArrivals}
          title="New Arrivals"
        />
        {activeCreatedProducts.length > 0 && (
          <ProductSection
            description="Products newly published through the private business preview."
            eyebrow="Freshly published"
            id="just-added"
            onOpenCart={openCart}
            products={activeCreatedProducts}
            title="Just Added"
          />
        )}
      </Container>

      <EditorialProductSection
        anchorIds={['dresses', 'one-shoulder']}
        copy="Draped necklines and clean asymmetric shapes, composed for effortless evenings."
        eyebrow="The silhouette study"
        featuredProduct={brownDress}
        id="one-shoulder-edit"
        index="01"
        onOpenCart={openCart}
        supportingProducts={[whiteOneShoulder, beigeOnePiece]}
        title="The One-Shoulder Edit"
      />

      <Container>
        <ProductSection
          description="Lace details, rich ombré tones and clean tailoring for the everyday wardrobe."
          eyebrow="Soft structure"
          id="tops"
          onOpenCart={openCart}
          products={tops}
          title="Tops We’re Loving"
        />
      </Container>

      <EditorialProductSection
        anchorIds={['kurtis']}
        copy="Sculpted lines meet distinctive catalogue details in Ovia’s corset-led kurtis."
        eyebrow="Modern corsetry"
        featuredProduct={limeCorset}
        id="corset-edit"
        index="02"
        onOpenCart={openCart}
        supportingProducts={[greenCorset, purpleCorset]}
        title="The Corset Edit"
        tone="blush"
      />

      <BusinessRevealSection />
    </>
  )
}
