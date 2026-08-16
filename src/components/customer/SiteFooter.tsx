import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Container } from '../layout/LayoutPrimitives'

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-ovia-plum text-white">
      <Container className="grid gap-10 py-12 sm:grid-cols-[1.4fr_1fr_1fr] sm:py-16">
        <div className="max-w-sm">
          <img
            alt="Ovia"
            className="size-16 rounded-2xl object-cover ring-1 ring-white/20"
            height="64"
            src="/brand/ovia-logo.jpg"
            width="64"
          />
          <p className="mt-5 font-display text-3xl">Ovia Closet</p>
          <p className="mt-3 text-sm leading-6 text-white/70">
            A private, contemporary edit of expressive silhouettes and everyday
            statement pieces.
          </p>
        </div>
        <div>
          <p className="text-xs font-bold tracking-[0.14em] text-ovia-blush uppercase">
            Discover
          </p>
          <div className="mt-4 flex flex-col items-start gap-3 text-sm text-white/80">
            <a className="hover:text-white" href="/#dresses">Dresses</a>
            <a className="hover:text-white" href="/#tops">Tops</a>
            <a className="hover:text-white" href="/#kurtis">Kurtis</a>
            <a className="hover:text-white" href="/#one-shoulder">One Shoulder</a>
          </div>
        </div>
        <div>
          <p className="text-xs font-bold tracking-[0.14em] text-ovia-blush uppercase">
            Demo
          </p>
          <Link
            className="mt-4 inline-flex items-center gap-2 text-sm text-white/80 hover:text-white"
            to="/business"
          >
            Business Preview
            <ArrowUpRight aria-hidden="true" size={15} />
          </Link>
          <p className="mt-6 text-xs leading-5 text-white/50">
            Private commerce concept. Checkout is simulated; no payment is taken.
          </p>
        </div>
      </Container>
      <div className="border-t border-white/10">
        <Container className="flex flex-wrap items-center justify-between gap-2 py-5 text-xs text-white/50">
          <span>Private concept for Ovia Closet</span>
          <span>Made for the Ovia edit</span>
        </Container>
      </div>
    </footer>
  )
}
