import { ArrowLeft, ArrowRight, ShoppingBag } from 'lucide-react'
import { Link } from 'react-router-dom'

import { CartLineItem } from '../components/customer/CartLineItem'
import { Container } from '../components/layout/LayoutPrimitives'
import { sellableProducts } from '../data/products'
import { formatInr } from '../lib/currency'
import { useDemoStore } from '../store/demoStore'

export function CartPage() {
  const cart = useDemoStore((state) => state.cart)
  const createdProducts = useDemoStore((state) => state.createdProducts)
  const commerceProducts = [...sellableProducts, ...createdProducts]
  const subtotal = cart.reduce((sum, line) => {
    const product = commerceProducts.find((item) => item.id === line.productId)
    return sum + (product?.priceInPaise ?? 0) * line.quantity
  }, 0)
  const cartCount = cart.reduce((count, line) => count + line.quantity, 0)

  if (cart.length === 0) {
    return (
      <Container className="flex min-h-[65vh] flex-col items-center justify-center py-16 text-center">
        <span className="flex size-20 items-center justify-center rounded-full bg-ovia-blush/65 text-ovia-plum">
          <ShoppingBag aria-hidden="true" size={31} strokeWidth={1.45} />
        </span>
        <h1 className="mt-6 font-display text-4xl tracking-[-0.03em] sm:text-5xl">Your bag is empty</h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-ovia-muted sm:text-base">
          Your next Ovia piece is waiting in the private edit.
        </p>
        <Link
          className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-ovia-primary px-6 text-sm font-bold text-white hover:bg-ovia-plum"
          to="/"
        >
          Explore the collection
          <ArrowRight aria-hidden="true" size={17} />
        </Link>
      </Container>
    )
  }

  return (
    <Container className="py-6 sm:py-12 lg:py-16">
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-ovia-muted hover:text-ovia-primary" to="/">
        <ArrowLeft aria-hidden="true" size={16} />
        Continue shopping
      </Link>
      <div className="mt-5 grid gap-8 lg:mt-6 lg:grid-cols-[1fr_23rem] lg:gap-14">
        <section aria-labelledby="bag-title">
          <div className="flex items-end justify-between gap-4 border-b border-ovia-line pb-5">
            <div>
              <p className="text-[0.68rem] font-bold tracking-[0.16em] text-ovia-primary uppercase">Your selection</p>
              <h1 className="mt-2 font-display text-[2.35rem] tracking-[-0.03em] sm:text-5xl" id="bag-title">Shopping bag</h1>
            </div>
            <span className="pb-1 text-sm text-ovia-muted">{cartCount} {cartCount === 1 ? 'item' : 'items'}</span>
          </div>
          <div>
            {cart.map((line) => <CartLineItem key={line.id} line={line} />)}
          </div>
        </section>

        <aside className="-mx-4 h-fit border-y border-ovia-line bg-white p-5 sm:mx-0 sm:rounded-[1.5rem] sm:border sm:p-6 sm:shadow-card lg:sticky lg:top-28">
          <h2 className="font-display text-2xl">Order summary</h2>
          <dl className="mt-5 space-y-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-ovia-muted">Subtotal</dt>
              <dd className="font-semibold">{formatInr(subtotal)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-ovia-muted">Delivery</dt>
              <dd className="font-semibold">Calculated at checkout</dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-ovia-line pt-4">
              <dt className="font-semibold">Estimated total</dt>
              <dd className="font-display text-2xl text-ovia-plum">{formatInr(subtotal)}</dd>
            </div>
          </dl>
          <Link
            className="customer-primary-action mt-6 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-ovia-primary px-5 text-sm font-bold text-white hover:bg-ovia-plum"
            to="/checkout"
          >
            Proceed to checkout
            <ArrowRight aria-hidden="true" size={17} />
          </Link>
          <p className="mt-4 text-center text-xs leading-5 text-ovia-muted">
            This is a private demonstration. No payment will be collected.
          </p>
        </aside>
      </div>
    </Container>
  )
}
