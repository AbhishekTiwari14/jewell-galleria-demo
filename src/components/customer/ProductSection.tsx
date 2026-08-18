import type { CommerceProduct } from '../../data/productTypes'
import { ProductCard } from './ProductCard'

interface ProductSectionProps {
  badge?: string
  compactTop?: boolean
  eyebrow?: string
  id: string
  onOpenCart?: () => void
  products: readonly CommerceProduct[]
  title: string
  description?: string
}

export function ProductSection({
  badge,
  compactTop = false,
  eyebrow,
  id,
  onOpenCart,
  products,
  title,
  description,
}: ProductSectionProps) {
  return (
    <section className={compactTop ? 'scroll-mt-24 pt-8 pb-14 sm:scroll-mt-28 sm:pt-10 sm:pb-20 lg:pt-12 lg:pb-28' : 'scroll-mt-24 py-14 sm:scroll-mt-28 sm:py-20 lg:py-28'} id={id}>
      <div className="mb-7 flex flex-col justify-between gap-3 sm:mb-10 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          {eyebrow && (
            <p className="type-eyebrow mb-2.5">
              {eyebrow}
            </p>
          )}
          <h2 className="type-section-title">
            {title}
          </h2>
          {description && (
            <p className="type-supporting mt-3 max-w-xl">
              {description}
            </p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-6 sm:gap-y-10 md:grid-cols-4 md:gap-x-5 lg:gap-x-7 lg:gap-y-14">
        {products.map((product, index) => (
          <ProductCard
            badge={badge}
            key={product.id}
            onOpenCart={onOpenCart}
            priority={index < 2}
            product={product}
          />
        ))}
      </div>
    </section>
  )
}
