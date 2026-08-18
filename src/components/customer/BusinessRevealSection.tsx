import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  PackageOpen,
  ShoppingBag,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { sellableProducts } from '../../data/products'
import { getBusinessMetrics } from '../../lib/business'
import { useDemoStore } from '../../store/demoStore'
import { OrderStatusBadge } from '../business/OrderStatusBadge'
import { Container } from '../layout/LayoutPrimitives'

const capabilities = [
  { label: 'Products', icon: PackageOpen },
  { label: 'Inventory', icon: Boxes },
  { label: 'Orders', icon: ClipboardList },
  { label: 'Analytics', icon: BarChart3 },
] as const

export function BusinessRevealSection() {
  const inventory = useDemoStore((state) => state.inventoryByVariant)
  const orders = useDemoStore((state) => state.orders)
  const createdProducts = useDemoStore((state) => state.createdProducts)
  const businessProducts = [...sellableProducts, ...createdProducts]
  const metrics = getBusinessMetrics(businessProducts, orders, inventory)
  const recentOrders = [...orders]
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, 2)

  const previewMetrics = [
    { label: 'Orders', value: metrics.orders, icon: ShoppingBag },
    { label: 'Active products', value: metrics.activeProducts, icon: PackageOpen },
    { label: 'Low stock', value: metrics.lowStockVariants.length, icon: AlertTriangle },
  ]

  return (
    <section className="overflow-hidden bg-ovia-plum text-white" data-testid="business-reveal-section">
      <Container className="grid gap-8 py-12 sm:gap-12 sm:py-22 lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:gap-16 lg:py-28">
        <div className="max-w-xl">
          <p className="text-[0.65rem] font-bold tracking-[0.18em] text-ovia-logo uppercase">
            Beyond the storefront
          </p>
          <h2 className="mt-3.5 max-w-lg font-display text-[2.45rem] leading-[0.9] font-medium tracking-[-0.04em] sm:mt-4 sm:text-5xl lg:text-[4.4rem]">
            The storefront is only half the story.
          </h2>
          <p className="mt-4 max-w-lg text-sm leading-6 text-white/72 sm:mt-5 sm:text-base sm:leading-8">
            Manage products, inventory, orders and analytics in the same private demo, connected to the storefront you just explored.
          </p>

          <ul aria-label="Business Preview capabilities" className="mt-5 grid max-w-md grid-cols-2 gap-x-5 gap-y-2.5 sm:mt-6 sm:gap-y-3">
            {capabilities.map(({ label, icon: Icon }) => (
              <li className="flex items-center gap-2 text-xs font-semibold text-white/78 sm:text-sm" key={label}>
                <Icon aria-hidden="true" className="text-ovia-logo" size={15} />
                {label}
              </li>
            ))}
          </ul>

          <Link
            className="customer-primary-action mt-7 inline-flex min-h-12 items-center gap-2 border-b border-ovia-logo text-sm font-bold text-white sm:mt-8"
            data-testid="business-reveal-cta"
            to="/business"
          >
            Explore Business Preview
            <ArrowRight aria-hidden="true" size={17} />
          </Link>
        </div>

        <div className="relative" data-testid="business-reveal-preview">
          <div aria-hidden="true" className="absolute -top-10 -right-10 size-44 rounded-full border border-ovia-logo/18" />
          <div className="relative overflow-hidden rounded-[0.9rem] border border-white/12 bg-[#fbf7f0] text-ovia-ink shadow-[0_24px_58px_rgb(30_5_13/0.26)]">
            <div className="flex items-center justify-between border-b border-ovia-line px-4 py-3.5 sm:px-5 sm:py-4">
              <div className="flex min-w-0 items-center gap-3">
                <img alt="" className="size-9 shrink-0 object-cover" src="/brand/jewellgalleria-logo.png" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ovia-ink">Jewellgalleria Business</p>
                  <p className="mt-0.5 text-[0.63rem] text-ovia-muted">Private operations preview</p>
                </div>
              </div>
              <span className="ml-3 shrink-0 rounded-full border border-ovia-primary/20 bg-ovia-blush/45 px-2.5 py-1 text-[0.55rem] font-bold tracking-[0.1em] text-ovia-primary uppercase">Demo mode</span>
            </div>

            <div aria-label="Business Preview navigation" className="grid grid-cols-5 border-b border-ovia-line bg-white px-2 py-2 sm:px-4">
              <span className="flex min-h-9 items-center justify-center gap-1 rounded-lg bg-ovia-blush/70 px-1 text-[0.56rem] font-bold text-ovia-plum sm:text-[0.65rem]">
                <LayoutDashboard aria-hidden="true" className="hidden sm:block" size={12} /> Dashboard
              </span>
              {capabilities.map(({ label, icon: Icon }) => (
                <span className="flex min-h-9 items-center justify-center gap-1 px-1 text-[0.56rem] font-semibold text-ovia-muted sm:text-[0.65rem]" key={label}>
                  <Icon aria-hidden="true" className="hidden sm:block" size={12} /> {label}
                </span>
              ))}
            </div>

            <div className="p-3.5 sm:p-5">
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {previewMetrics.map(({ label, value, icon: Icon }) => (
                  <article className="min-w-0 rounded-xl border border-ovia-line bg-white p-3 sm:p-3.5" key={label}>
                    <div className="flex items-center justify-between gap-1.5">
                      <p className="text-[0.58rem] leading-3 font-semibold text-ovia-muted sm:text-[0.66rem]">{label}</p>
                      <Icon aria-hidden="true" className="shrink-0 text-ovia-primary" size={13} />
                    </div>
                    <p className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ovia-ink sm:text-2xl">{value}</p>
                    <p className="mt-0.5 text-[0.53rem] text-ovia-muted sm:text-[0.6rem]">Simulated</p>
                  </article>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-[1.18fr_0.82fr] gap-2.5 sm:grid-cols-[1.2fr_0.8fr] sm:gap-3">
                <article className="overflow-hidden rounded-xl border border-ovia-line bg-white" data-testid="reveal-preview-orders">
                  <div className="flex items-center justify-between border-b border-ovia-line px-3.5 py-3">
                    <div>
                      <h3 className="font-display text-base text-ovia-ink">Recent orders</h3>
                      <p className="text-[0.57rem] text-ovia-muted">Latest simulated activity</p>
                    </div>
                    <span className="text-[0.58rem] font-bold text-ovia-primary">View all</span>
                  </div>
                  <div className="divide-y divide-ovia-line">
                    {recentOrders.map((order, index) => {
                      const product = businessProducts.find((candidate) => candidate.id === order.items[0]?.productId)
                      return (
                        <div className={index === 0 ? 'flex items-center gap-2.5 px-3 py-2.5 sm:px-3.5' : 'hidden items-center gap-2.5 px-3.5 py-2.5 sm:flex'} key={order.id}>
                          {product && <img alt="" className="size-9 shrink-0 rounded-lg bg-ovia-ivory object-cover object-top" src={product.images[0]} />}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[0.65rem] font-bold text-ovia-ink">{product?.catalogueName ?? 'Jewellgalleria order'}</p>
                            <p className="mt-0.5 truncate text-[0.56rem] text-ovia-muted">{order.customerName} · {order.id}</p>
                          </div>
                          <span className="hidden sm:block"><OrderStatusBadge status={order.status} /></span>
                        </div>
                      )
                    })}
                  </div>
                </article>

                <article className="rounded-xl bg-ovia-plum p-3 text-white sm:p-4" data-testid="reveal-preview-stock">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[0.58rem] font-bold tracking-[0.11em] text-ovia-blush uppercase">Low stock alerts</p>
                      <p className="mt-2 text-3xl font-semibold">{metrics.lowStockVariants.length}</p>
                    </div>
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/12 text-ovia-blush">
                      <AlertTriangle aria-hidden="true" size={15} />
                    </span>
                  </div>
                  <p className="mt-1 text-[0.56rem] leading-4 text-white/65 sm:hidden">simulated alerts</p>
                  <div className="mt-3 hidden space-y-2 border-t border-white/12 pt-3 sm:block">
                    {metrics.lowStockVariants.slice(0, 2).map(({ product, quantity, selection }) => (
                      <div className="flex items-center justify-between gap-2 text-[0.61rem]" key={`${product.id}-${JSON.stringify(selection)}`}>
                        <span className="truncate text-white/75">{product.catalogueName}</span>
                        <span className="font-bold">{quantity}</span>
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
