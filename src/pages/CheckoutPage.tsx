import { motion, useReducedMotion } from 'motion/react'
import { ArrowLeft, ArrowRight, Check, LockKeyhole, PackageCheck, ShieldCheck } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'

import { Container } from '../components/layout/LayoutPrimitives'
import { sellableProducts } from '../data/products'
import { formatProductSelection, type CommerceProduct } from '../data/productTypes'
import { formatInr } from '../lib/currency'
import { type CartLine, type DemoOrder, useDemoStore } from '../store/demoStore'

const inputClasses =
  'min-h-14 w-full rounded-control border border-ovia-line bg-white px-4 text-base text-ovia-ink placeholder:text-ovia-muted/60 transition-colors hover:border-ovia-primary/50 focus:border-ovia-primary focus:outline-none focus-visible:ring-3 focus-visible:ring-ovia-primary/20 sm:min-h-12 sm:text-sm'

interface OrderSummaryProps {
  cart: CartLine[]
  commerceProducts: readonly CommerceProduct[]
  subtotal: number
}

function OrderSummary({ cart, commerceProducts, subtotal }: OrderSummaryProps) {
  return (
    <div data-testid="checkout-order-summary">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-2xl">Order summary</h2>
        <span className="flex items-center gap-1 text-xs font-semibold text-ovia-success">
          <ShieldCheck aria-hidden="true" size={14} />
          Demo safe
        </span>
      </div>

      <div className="mt-5 space-y-4">
        {cart.map((line) => {
          const product = commerceProducts.find(
            (item) => item.id === line.productId,
          )
          if (!product) return null
          const selectionLabel = formatProductSelection(product, line.selection)

          return (
            <div
              className="grid grid-cols-[4.25rem_1fr_auto] gap-3"
              data-testid={`checkout-line-${product.slug}`}
              key={line.id}
            >
              <div className="relative">
                <img
                  alt=""
                  className="aspect-[4/5] w-full bg-[#eee3dc] object-cover"
                  src={product.images[0]}
                />
                <span className="absolute -top-1.5 -right-1.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-ovia-plum px-1 text-[0.62rem] font-bold text-white">
                  {line.quantity}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm leading-snug font-semibold">
                  {product.catalogueName}
                </p>
                <p className="mt-1 text-xs leading-5 text-ovia-muted">
                  {selectionLabel ? `${selectionLabel} · ` : ''}
                  Qty {line.quantity}
                </p>
              </div>
              <p className="text-sm font-semibold text-ovia-plum">
                {formatInr((product.priceInPaise ?? 0) * line.quantity)}
              </p>
            </div>
          )
        })}
      </div>

      <dl className="mt-6 space-y-3 border-t border-ovia-line pt-5 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-ovia-muted">Subtotal</dt>
          <dd>{formatInr(subtotal)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ovia-muted">Delivery</dt>
          <dd>Not calculated in demo</dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-ovia-line pt-4">
          <dt className="font-semibold">Demo total</dt>
          <dd className="font-display text-2xl text-ovia-plum">
            {formatInr(subtotal)}
          </dd>
        </div>
      </dl>
    </div>
  )
}

interface OrderConfirmationProps {
  commerceProducts: readonly CommerceProduct[]
  order: DemoOrder
}

function OrderConfirmation({ commerceProducts, order }: OrderConfirmationProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="min-h-[75vh] bg-[#f5ede6]"
      data-testid="checkout-success"
      initial={{ opacity: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
    >
      <Container className="py-12 sm:py-18 lg:py-22">
        <div className="mx-auto max-w-2xl text-center">
          <motion.span
            animate={{ opacity: 1, scale: 1 }}
            className="mx-auto flex size-18 items-center justify-center rounded-full bg-ovia-primary text-white shadow-[0_16px_35px_rgb(123_18_48/0.2)]"
            initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.94 }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { duration: 0.24, ease: 'easeOut' }
            }
          >
            <Check aria-hidden="true" size={32} strokeWidth={2.2} />
          </motion.span>
          <p className="mt-6 text-[0.66rem] font-bold tracking-[0.16em] text-ovia-primary uppercase">
            Demo order confirmed
          </p>
          <h1 className="mt-2 font-display text-[2.75rem] leading-none tracking-[-0.04em] sm:text-6xl">
            Order confirmed
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-ovia-muted sm:text-base">
            This order is saved only to the browser’s simulated business queue.
            No payment was taken and nothing was transmitted.
          </p>
          <div className="mx-auto mt-6 inline-block border border-ovia-primary/20 bg-white/70 px-6 py-3">
            <p className="text-xs text-ovia-muted">Demo order number</p>
            <p className="mt-1 font-semibold tracking-[0.06em] text-ovia-plum" data-testid="demo-order-number">
              {order.id}
            </p>
          </div>
        </div>

        <section className="mx-auto mt-9 max-w-2xl border border-ovia-line bg-ovia-ivory p-5 shadow-card sm:p-7" aria-labelledby="confirmed-items-title">
          <div className="flex items-end justify-between gap-4 border-b border-ovia-line pb-4">
            <div>
              <p className="text-[0.65rem] font-bold tracking-[0.13em] text-ovia-primary uppercase">Purchase summary</p>
              <h2 className="mt-1 font-display text-2xl" id="confirmed-items-title">Your pieces</h2>
            </div>
            <p className="text-right text-xs leading-5 text-ovia-muted">
              {order.customerName}<br />{order.shippingCity}
            </p>
          </div>

          <div className="divide-y divide-ovia-line">
            {order.items.map((item) => {
              const product = commerceProducts.find(
                (candidate) => candidate.id === item.productId,
              )
              if (!product) return null
              const selectionLabel = formatProductSelection(product, item.selection)

              return (
                <div
                  className="grid grid-cols-[4.5rem_1fr_auto] gap-3 py-4"
                  data-testid={`success-order-item-${product.slug}`}
                  key={`${item.productId}-${JSON.stringify(item.selection)}`}
                >
                  <img alt="" className="aspect-[4/5] w-full bg-[#eee3dc] object-cover" src={product.images[0]} />
                  <div className="min-w-0">
                    <p className="text-sm leading-snug font-semibold">{product.catalogueName}</p>
                    <p className="mt-1 text-xs leading-5 text-ovia-muted">
                      {selectionLabel ? `${selectionLabel} · ` : ''}Qty {item.quantity}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-ovia-plum">
                    {formatInr((product.priceInPaise ?? 0) * item.quantity)}
                  </p>
                </div>
              )
            })}
          </div>
          <div className="flex items-center justify-between border-t border-ovia-line pt-4">
            <span className="text-sm font-semibold">Demo total</span>
            <span className="font-display text-2xl text-ovia-plum" data-testid="success-total">
              {formatInr(order.amountInPaise)}
            </span>
          </div>
        </section>

        <div className="mx-auto mt-7 grid max-w-2xl gap-3 sm:grid-cols-2">
          <Link className="inline-flex min-h-12 items-center justify-center rounded-control border border-ovia-primary px-6 text-sm font-bold text-ovia-plum hover:bg-ovia-blush/40" to="/">
            Continue Shopping
          </Link>
          <Link
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-control bg-ovia-primary px-6 text-sm font-bold text-white hover:bg-ovia-plum"
            data-testid="view-demo-order"
            to={`/business/orders?order=${encodeURIComponent(order.id)}`}
          >
            View in Business Preview
            <ArrowRight aria-hidden="true" size={17} />
          </Link>
        </div>
      </Container>
    </motion.div>
  )
}

export function CheckoutPage() {
  const cart = useDemoStore((state) => state.cart)
  const createdProducts = useDemoStore((state) => state.createdProducts)
  const placeDemoOrder = useDemoStore((state) => state.placeDemoOrder)
  const commerceProducts = [...sellableProducts, ...createdProducts]
  const [completedOrder, setCompletedOrder] = useState<DemoOrder | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const subtotal = cart.reduce<number | null>((sum, line) => {
    if (sum === null) return null
    const product = commerceProducts.find((item) => item.id === line.productId)
    if (product?.priceInPaise === null || product?.priceInPaise === undefined) {
      return null
    }
    return sum + product.priceInPaise * line.quantity
  }, 0)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (subtotal === null || isSubmitting) return

    const formData = new FormData(event.currentTarget)
    const firstName = String(formData.get('firstName') ?? '').trim()
    const lastName = String(formData.get('lastName') ?? '').trim()
    const shippingCity = String(formData.get('city') ?? '').trim()
    setIsSubmitting(true)
    const order = placeDemoOrder({
      customerName: [firstName, lastName].filter(Boolean).join(' '),
      shippingCity,
    })
    setCompletedOrder(order)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (completedOrder) {
    return (
      <OrderConfirmation
        commerceProducts={commerceProducts}
        order={completedOrder}
      />
    )
  }

  if (cart.length === 0) {
    return (
      <Container className="flex min-h-[65vh] flex-col items-center justify-center py-16 text-center">
        <PackageCheck aria-hidden="true" className="text-ovia-primary" size={50} strokeWidth={1.4} />
        <h1 className="mt-5 font-display text-4xl">Your bag is empty</h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-ovia-muted">
          Add a catalogue piece to begin the mock checkout.
        </p>
        <Link className="mt-7 inline-flex min-h-12 items-center rounded-control bg-ovia-primary px-6 text-sm font-bold text-white hover:bg-ovia-plum" to="/">
          Continue Shopping
        </Link>
      </Container>
    )
  }

  if (subtotal === null) {
    return (
      <Container className="flex min-h-[65vh] flex-col items-center justify-center py-16 text-center">
        <LockKeyhole aria-hidden="true" className="text-ovia-primary" size={45} strokeWidth={1.4} />
        <h1 className="mt-5 font-display text-4xl">Checkout paused</h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-ovia-muted">
          One or more products require confirmed pricing before they can enter the mock checkout.
        </p>
        <Link className="mt-7 inline-flex min-h-12 items-center rounded-control bg-ovia-primary px-6 text-sm font-bold text-white hover:bg-ovia-plum" to="/cart">
          Return to bag
        </Link>
      </Container>
    )
  }

  return (
    <div className="bg-[#fffdfb]">
      <Container className="py-5 sm:py-9 lg:py-14">
        <Link className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ovia-muted hover:text-ovia-primary" to="/cart">
          <ArrowLeft aria-hidden="true" size={16} />
          Back to bag
        </Link>

        <div className="mt-4 grid gap-9 lg:mt-6 lg:grid-cols-[minmax(0,1fr)_25rem] lg:gap-14 xl:gap-18">
          <section>
            <p className="text-[0.66rem] font-bold tracking-[0.16em] text-ovia-primary uppercase">Safe mock checkout</p>
            <h1 className="mt-2 max-w-xl font-display text-[2.5rem] leading-[0.98] tracking-[-0.04em] sm:text-5xl">Complete your details</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-ovia-muted">
              Use sample details if preferred. Nothing is transmitted, and only the display name and city are retained in this browser’s demo order.
            </p>

            <form className="mt-7" id="checkout-form" onSubmit={handleSubmit}>
              <fieldset className="border-t border-ovia-line py-6 sm:py-7">
                <legend className="font-display text-2xl">Contact</legend>
                <div className="mt-4">
                  <label className="mb-2 block text-sm font-semibold" htmlFor="email">Email address</label>
                  <input autoComplete="email" className={inputClasses} id="email" name="email" placeholder="name@example.com" required type="email" />
                </div>
              </fieldset>

              <fieldset className="border-t border-ovia-line py-6 sm:py-7">
                <legend className="font-display text-2xl">Shipping details</legend>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold" htmlFor="first-name">First name</label>
                    <input autoComplete="given-name" className={inputClasses} id="first-name" name="firstName" required />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold" htmlFor="last-name">Last name</label>
                    <input autoComplete="family-name" className={inputClasses} id="last-name" name="lastName" required />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-sm font-semibold" htmlFor="address">Address</label>
                    <input autoComplete="street-address" className={inputClasses} id="address" name="address" placeholder="House number and street" required />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold" htmlFor="city">City</label>
                    <input autoComplete="address-level2" className={inputClasses} id="city" name="city" required />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold" htmlFor="postal-code">PIN code</label>
                    <input autoComplete="postal-code" className={inputClasses} id="postal-code" inputMode="numeric" name="postalCode" pattern="[0-9]{6}" placeholder="6 digits" required />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-sm font-semibold" htmlFor="phone">Phone number</label>
                    <input autoComplete="tel" className={inputClasses} id="phone" inputMode="tel" name="phone" required type="tel" />
                  </div>
                </div>
              </fieldset>

              <section className="-mx-4 border-y border-ovia-line bg-ovia-ivory px-4 py-6 sm:mx-0 sm:border sm:p-5 lg:hidden" aria-label="Mobile order summary">
                <OrderSummary cart={cart} commerceProducts={commerceProducts} subtotal={subtotal} />
              </section>

              <fieldset className="border-b border-ovia-line py-6 sm:py-7">
                <legend className="font-display text-2xl">Payment placeholder</legend>
                <div className="mt-4 flex items-start gap-3 border border-ovia-primary/25 bg-ovia-blush/25 p-4" role="note">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-ovia-plum"><LockKeyhole aria-hidden="true" size={17} /></span>
                  <span>
                    <span className="block font-semibold">Demo payment only</span>
                    <span className="mt-1 block text-sm leading-6 text-ovia-muted">No card, bank, or payment credentials are requested. No charge will occur.</span>
                  </span>
                </div>
              </fieldset>

              <div className="-mx-4 mt-3 border-t border-ovia-line bg-ovia-ivory px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden" data-testid="mobile-checkout-action">
                <div className="mx-auto flex max-w-lg items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.68rem] text-ovia-muted">Demo total</p>
                    <p className="truncate text-base font-bold text-ovia-plum">{formatInr(subtotal)}</p>
                  </div>
                  <button className="customer-primary-action min-h-13 min-w-[11rem] rounded-control bg-ovia-primary px-5 text-sm font-bold text-white shadow-[0_8px_22px_rgb(127_23_50/0.18)] disabled:cursor-wait disabled:opacity-65" data-testid="mobile-place-demo-order" disabled={isSubmitting} type="submit">
                    {isSubmitting ? 'Placing…' : 'Place Demo Order'}
                  </button>
                </div>
              </div>
            </form>
          </section>

          <aside className="hidden h-fit border border-ovia-line bg-ovia-ivory p-6 shadow-card lg:sticky lg:top-28 lg:block">
            <OrderSummary cart={cart} commerceProducts={commerceProducts} subtotal={subtotal} />
            <button className="customer-primary-action mt-6 min-h-14 w-full rounded-control bg-ovia-primary px-5 text-sm font-bold text-white hover:bg-ovia-plum disabled:cursor-wait disabled:opacity-65" data-testid="place-demo-order" disabled={isSubmitting} form="checkout-form" type="submit">
              {isSubmitting ? 'Placing demo order…' : 'Place Demo Order'}
            </button>
            <p className="mt-3 text-center text-[0.7rem] leading-5 text-ovia-muted">Simulated checkout. No payment or fulfilment occurs.</p>
          </aside>
        </div>
      </Container>

    </div>
  )
}
