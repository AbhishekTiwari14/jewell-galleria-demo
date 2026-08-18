import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Container } from '../layout/LayoutPrimitives'

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-ovia-plum text-white">
      <Container className="grid gap-10 py-12 sm:grid-cols-[1.4fr_1fr_1fr] sm:py-16 lg:py-20">
        <div className="max-w-sm">
          <img
            alt="Jewellgalleria"
            className="size-16 object-cover ring-1 ring-white/18"
            height="64"
            src="/brand/jewellgalleria-logo.png"
            width="64"
          />
          <p className="mt-5 font-display text-3xl tracking-[0.01em]">Jewellgalleria</p>
          <p className="mt-3 text-sm leading-6 text-white/70">
            A private storefront concept shaped around Jewellgalleria’s supplied jewellery catalogue.
          </p>
        </div>
        <div>
          <p className="text-xs font-bold tracking-[0.14em] text-ovia-logo uppercase">
            Catalogue
          </p>
          <div className="mt-4 flex flex-col items-start gap-3 text-sm text-white/80">
            <a className="hover:text-white" href="/#necklaces">Necklaces</a>
            <a className="hover:text-white" href="/#earrings">Earrings</a>
            <a className="hover:text-white" href="/#bracelets">Bracelets</a>
            <a className="hover:text-white" href="/#rings">Rings</a>
          </div>
        </div>
        <div>
          <p className="text-xs font-bold tracking-[0.14em] text-ovia-logo uppercase">
            Private concept
          </p>
          <Link
            className="mt-4 inline-flex items-center gap-2 text-sm text-white/80 hover:text-white"
            to="/business"
          >
            Business Preview
            <ArrowUpRight aria-hidden="true" size={15} />
          </Link>
          <p className="mt-6 text-xs leading-5 text-white/50">
            Business activity and checkout are simulated. No payment is taken.
          </p>
        </div>
      </Container>
      <div className="border-t border-white/10">
        <Container className="flex flex-wrap items-center justify-between gap-2 py-5 text-xs text-white/50">
          <span>Private concept for Jewellgalleria</span>
          <span>Product information is limited to the supplied reference material.</span>
        </Container>
      </div>
    </footer>
  )
}
