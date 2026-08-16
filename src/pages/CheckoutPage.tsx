import { motion } from 'motion/react'
import { ArrowLeft, Check, LockKeyhole, PackageCheck, ShieldCheck } from 'lucide-react'
import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'

import { Container } from '../components/layout/LayoutPrimitives'
import { sellableProducts } from '../data/products'
import { formatInr } from '../lib/currency'
import { useDemoStore } from '../store/demoStore'

const inputClasses =
  'min-h-14 w-full rounded-xl border border-ovia-line bg-white px-4 text-base text-ovia-ink placeholder:text-ovia-muted/65 transition-colors hover:border-ovia-primary/50 focus:border-ovia-primary focus:outline-none focus-visible:ring-3 focus-visible:ring-ovia-primary/25 sm:min-h-12 sm:text-sm'

export function CheckoutPage() {
  const cart = useDemoStore((state) => state.cart)
  const createdProducts = useDemoStore((state) => state.createdProducts)
  const commerceProducts = [...sellableProducts, ...createdProducts]
  const clearCart = useDemoStore((state) => state.clearCart)
  const [isComplete, setIsComplete] = useState(false)
  const [firstName, setFirstName] = useState('')
  const subtotal = cart.reduce((sum, line) => {
    const product = commerceProducts.find((item) => item.id === line.productId)
    return sum + (product?.priceInPaise ?? 0) * line.quantity
  }, 0)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsComplete(true)
    clearCart()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (isComplete) {
    return (
      <motion.div
        className="min-h-[75vh] bg-[#f6ecf2]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <Container className="flex flex-col items-center justify-center py-20 text-center sm:py-28">
          <motion.span
            className="flex size-20 items-center justify-center rounded-full bg-ovia-primary text-white shadow-[0_16px_35px_rgb(166_79_140/0.28)]"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          >
            <Check aria-hidden="true" size={35} strokeWidth={2.2} />
          </motion.span>
          <p className="mt-7 text-[0.68rem] font-bold tracking-[0.16em] text-ovia-primary uppercase">Demo order confirmed</p>
          <h1 className="mt-3 max-w-2xl font-display text-4xl tracking-[-0.035em] sm:text-6xl">
            Thank you{firstName ? `, ${firstName}` : ''}.
          </h1>
          <p className="mt-5 max-w-lg text-sm leading-7 text-ovia-muted sm:text-base">
            Your mock checkout is complete. No order was submitted and no payment was taken.
          </p>
          <div className="mt-7 rounded-2xl border border-ovia-primary/20 bg-white/75 px-6 py-4">
            <p className="text-xs text-ovia-muted">Demo reference</p>
            <p className="mt-1 font-semibold text-ovia-plum">OVIA-DEMO-2026</p>
          </div>
          <Link
            className="mt-8 inline-flex min-h-12 items-center rounded-full bg-ovia-primary px-7 text-sm font-bold text-white hover:bg-ovia-plum"
            to="/"
          >
            Return to the Ovia edit
          </Link>
        </Container>
      </motion.div>
    )
  }

  if (cart.length === 0) {
    return (
      <Container className="flex min-h-[65vh] flex-col items-center justify-center py-16 text-center">
        <PackageCheck aria-hidden="true" className="text-ovia-primary" size={50} strokeWidth={1.4} />
        <h1 className="mt-5 font-display text-4xl">Your checkout is ready when you are</h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-ovia-muted">Add a catalogue piece to your bag to begin the mock checkout.</p>
        <Link className="mt-7 inline-flex min-h-12 items-center rounded-full bg-ovia-primary px-6 text-sm font-bold text-white hover:bg-ovia-plum" to="/">
          Return to shop
        </Link>
      </Container>
    )
  }

  return (
    <div className="bg-[#fffdfb]">
      <Container className="py-6 sm:py-10 lg:py-14">
        <Link className="inline-flex items-center gap-2 text-sm font-semibold text-ovia-muted hover:text-ovia-primary" to="/cart">
          <ArrowLeft aria-hidden="true" size={16} />
          Back to bag
        </Link>
        <div className="mt-6 grid gap-9 lg:grid-cols-[1fr_25rem] lg:gap-16">
          <section>
            <p className="text-[0.68rem] font-bold tracking-[0.16em] text-ovia-primary uppercase">Secure mock checkout</p>
            <h1 className="mt-2 font-display text-[2.35rem] leading-[1.02] tracking-[-0.035em] sm:text-5xl">Complete your details</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-ovia-muted">Visualize the complete customer journey. This form is local to the demo and does not process a real order.</p>

            <form className="mt-8 space-y-0" id="checkout-form" onSubmit={handleSubmit}>
              <fieldset className="border-t border-ovia-line py-7">
                <legend className="font-display text-2xl">Contact</legend>
                <div className="mt-4">
                  <label className="mb-2 block text-sm font-semibold" htmlFor="email">Email address</label>
                  <input autoComplete="email" className={inputClasses} id="email" name="email" placeholder="you@example.com" required type="email" />
                </div>
              </fieldset>

              <fieldset className="border-t border-ovia-line py-7">
                <legend className="font-display text-2xl">Delivery details</legend>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold" htmlFor="first-name">First name</label>
                    <input autoComplete="given-name" className={inputClasses} id="first-name" name="firstName" onChange={(event) => setFirstName(event.target.value)} required />
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

              <fieldset className="border-y border-ovia-line py-7">
                <legend className="font-display text-2xl">Payment preview</legend>
                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-ovia-primary bg-ovia-blush/25 p-4">
                  <input defaultChecked className="mt-1 accent-ovia-primary" name="payment" type="radio" value="demo-card" />
                  <span>
                    <span className="flex items-center gap-2 font-semibold"><LockKeyhole aria-hidden="true" size={16} /> Demo payment</span>
                    <span className="mt-1 block text-sm leading-6 text-ovia-muted">No card details required. No charge will occur.</span>
                  </span>
                </label>
              </fieldset>
            </form>
          </section>

          <aside className="-mx-4 h-fit border-y border-ovia-line bg-ovia-ivory p-5 sm:mx-0 sm:rounded-[1.5rem] sm:border sm:p-6 sm:shadow-card lg:sticky lg:top-28">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-display text-2xl">Your order</h2>
              <span className="flex items-center gap-1 text-xs font-semibold text-ovia-success"><ShieldCheck aria-hidden="true" size={14} /> Demo safe</span>
            </div>
            <div className="mt-5 max-h-80 space-y-4 overflow-y-auto pr-1">
              {cart.map((line) => {
                const product = commerceProducts.find((item) => item.id === line.productId)
                if (!product) return null
                return (
                  <div className="grid grid-cols-[4rem_1fr_auto] gap-3" key={line.id}>
                    <img alt="" className="aspect-[4/5] w-full rounded-xl object-cover" src={product.image} />
                    <div className="min-w-0">
                      <p className="text-sm leading-snug font-semibold">{product.catalogueName}</p>
                      <p className="mt-1 text-xs text-ovia-muted">Size {line.size} · Qty {line.quantity}</p>
                    </div>
                    <p className="text-sm font-semibold text-ovia-plum">{formatInr(product.priceInPaise * line.quantity)}</p>
                  </div>
                )
              })}
            </div>
            <dl className="mt-6 space-y-3 border-t border-ovia-line pt-5 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-ovia-muted">Subtotal</dt><dd>{formatInr(subtotal)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-ovia-muted">Delivery</dt><dd>Demo calculation</dd></div>
              <div className="flex justify-between gap-4 border-t border-ovia-line pt-4"><dt className="font-semibold">Total</dt><dd className="font-display text-2xl text-ovia-plum">{formatInr(subtotal)}</dd></div>
            </dl>
            <button
              className="customer-primary-action mt-6 min-h-14 w-full rounded-full bg-ovia-primary px-5 text-sm font-bold text-white hover:bg-ovia-plum"
              data-testid="place-demo-order"
              form="checkout-form"
              type="submit"
            >
              Place demo order
            </button>
            <p className="mt-3 text-center text-[0.7rem] leading-5 text-ovia-muted">By continuing, you confirm this is a simulated checkout.</p>
          </aside>
        </div>
      </Container>
    </div>
  )
}
