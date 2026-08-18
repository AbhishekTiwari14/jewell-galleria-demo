import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import type { CommerceProduct } from '../../data/productTypes'

interface JewelleryEditorialSectionProps {
  anchorIds?: readonly string[]
  detailProduct: CommerceProduct
  featuredProduct: CommerceProduct
  secondaryProduct: CommerceProduct
}

export function JewelleryEditorialSection({
  anchorIds = [],
  detailProduct,
  featuredProduct,
  secondaryProduct,
}: JewelleryEditorialSectionProps) {
  return (
    <section className="relative overflow-hidden bg-[#efe3da]" id="editorial">
      {anchorIds.map((anchorId) => (
        <span aria-hidden="true" className="absolute -top-24" id={anchorId} key={anchorId} />
      ))}

      <div className="mx-auto w-full max-w-360 px-4 py-14 sm:px-6 sm:py-20 lg:hidden">
        <div className="max-w-[21rem]">
          <p className="type-eyebrow">Jewellgalleria, up close</p>
          <h2 className="mt-3 font-display text-[2.7rem] leading-[0.9] font-medium tracking-[-0.04em] text-ovia-ink">
            Jewellery in full colour.
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-6 text-ovia-muted">
            Ornate movement, delicate lines and expressive forms, framed in vivid colour.
          </p>
        </div>

        <div className="mt-7 grid h-[22rem] grid-cols-[1.18fr_0.82fr] gap-2.5 sm:h-[29rem] sm:gap-4">
          <Link className="group relative overflow-hidden bg-[#d8c3b6]" to={`/product/${featuredProduct.slug}`}>
            <img alt={featuredProduct.catalogueName} className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.025]" src={featuredProduct.images[0]} />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ovia-plum/78 to-transparent px-3 pt-14 pb-3 text-sm font-semibold text-white">
              {featuredProduct.catalogueName}
            </span>
          </Link>
          <div className="grid min-h-0 grid-rows-2 gap-2.5 sm:gap-4">
            <Link className="group overflow-hidden bg-[#d8c3b6]" to={`/product/${secondaryProduct.slug}`}>
              <img alt={secondaryProduct.catalogueName} className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.025]" src={secondaryProduct.images[3] ?? secondaryProduct.images[0]} />
            </Link>
            <Link className="group overflow-hidden bg-[#d8c3b6]" to={`/product/${detailProduct.slug}`}>
              <img alt={detailProduct.catalogueName} className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.025]" src={detailProduct.images[1] ?? detailProduct.images[0]} />
            </Link>
          </div>
        </div>

        <Link className="mt-6 inline-flex min-h-11 items-center gap-2 border-b border-ovia-primary/55 text-xs font-bold tracking-[0.08em] text-ovia-plum uppercase" to={`/product/${featuredProduct.slug}`}>
          View the earrings <ArrowRight aria-hidden="true" size={15} />
        </Link>
      </div>

      <div className="mx-auto hidden w-full max-w-360 grid-cols-12 gap-7 px-8 py-28 lg:grid xl:gap-9 xl:py-32">
        <div className="col-span-4 flex flex-col justify-center pr-8 xl:pr-14">
          <p className="type-eyebrow">Jewellgalleria, up close</p>
          <h2 className="mt-5 font-display text-[clamp(4rem,5vw,5.8rem)] leading-[0.86] font-medium tracking-[-0.045em] text-ovia-ink">
            Jewellery in full colour.
          </h2>
          <p className="mt-7 max-w-sm text-base leading-8 text-ovia-muted">
            Ornate movement, delicate lines and expressive forms, framed in vivid colour.
          </p>
          <Link className="mt-9 inline-flex w-fit min-h-11 items-center gap-2 border-b border-ovia-primary/55 text-xs font-bold tracking-[0.1em] text-ovia-plum uppercase" to={`/product/${featuredProduct.slug}`}>
            View the earrings <ArrowRight aria-hidden="true" size={15} />
          </Link>
        </div>

        <Link className="group relative col-span-5 h-[42rem] overflow-hidden bg-[#d8c3b6]" to={`/product/${featuredProduct.slug}`}>
          <img alt={featuredProduct.catalogueName} className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" src={featuredProduct.images[0]} />
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ovia-plum/78 to-transparent px-6 pt-24 pb-6 font-display text-2xl text-white">
            {featuredProduct.catalogueName}
          </span>
        </Link>

        <div className="col-span-3 grid h-[42rem] grid-rows-[0.9fr_1.1fr] gap-7">
          <Link className="group overflow-hidden bg-[#d8c3b6]" to={`/product/${secondaryProduct.slug}`}>
            <img alt={secondaryProduct.catalogueName} className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.025]" src={secondaryProduct.images[3] ?? secondaryProduct.images[0]} />
          </Link>
          <Link className="group overflow-hidden bg-[#d8c3b6]" to={`/product/${detailProduct.slug}`}>
            <img alt={detailProduct.catalogueName} className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.025]" src={detailProduct.images[1] ?? detailProduct.images[0]} />
          </Link>
        </div>
      </div>
    </section>
  )
}
