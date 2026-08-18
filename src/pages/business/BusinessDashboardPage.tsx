import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  IndianRupee,
  PackageCheck,
  ShoppingBag,
} from 'lucide-react'
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'

import { BusinessPageHeader } from '../../components/business/BusinessPageHeader'
import { OrderStatusBadge } from '../../components/business/OrderStatusBadge'
import { Container } from '../../components/layout/LayoutPrimitives'
import { sellableProducts } from '../../data/products'
import { formatInr } from '../../lib/currency'
import { getBusinessMetrics, getTopProducts } from '../../lib/business'
import { useDemoStore } from '../../store/demoStore'

function formatOrderDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export function BusinessDashboardPage() {
  const inventory = useDemoStore((state) => state.inventoryByVariant)
  const orders = useDemoStore((state) => state.orders)
  const createdProducts = useDemoStore((state) => state.createdProducts)
  const businessProducts = [...sellableProducts, ...createdProducts]
  const metrics = getBusinessMetrics(businessProducts, orders, inventory)
  const topProducts = getTopProducts(businessProducts, orders).slice(0, 4)
  const recentOrders = [...orders]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 5)

  const metricCards = [
    {
      label: 'Revenue',
      value: formatInr(metrics.revenue),
      context: 'Simulated, excluding cancelled',
      icon: IndianRupee,
    },
    {
      label: 'Orders',
      value: metrics.orders.toString(),
      context: 'Simulated order records',
      icon: ShoppingBag,
    },
    {
      label: 'Average order value',
      value: formatInr(metrics.averageOrderValue),
      context: 'Simulated non-cancelled orders',
      icon: PackageCheck,
    },
    {
      label: 'Active products',
      value: metrics.activeProducts.toString(),
      context: `${metrics.inventoryUnits} simulated units`,
      icon: Boxes,
    },
    {
      label: 'Low stock',
      value: metrics.lowStockVariants.length.toString(),
      context: 'Variants at 8 units or fewer',
      icon: AlertTriangle,
    },
  ]

  return (
    <Container className="py-7 sm:py-10">
      <BusinessPageHeader
        description="A simulated view of the storefront, fulfilment queue, and stock requiring attention. All figures are demo data."
        eyebrow="Dashboard"
        title="Good morning, Jewellgalleria"
      />

      <section aria-label="Business metrics" className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-5">
        {metricCards.map(({ label, value, context, icon: Icon }, index) => (
          <motion.article
            animate={{ opacity: 1, y: 0 }}
            className="rounded-card border border-ovia-line bg-white p-4 shadow-card last:col-span-2 sm:p-5 xl:last:col-span-1"
            initial={{ opacity: 0, y: 8 }}
            key={label}
            transition={{ delay: index * 0.05, duration: 0.35 }}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ovia-muted">{label}</p>
              <span className="flex size-9 items-center justify-center rounded-full bg-ovia-blush/55 text-ovia-plum">
                <Icon aria-hidden="true" size={17} />
              </span>
            </div>
            <p className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-ovia-ink sm:text-3xl">{value}</p>
            <p className="mt-1 text-xs text-ovia-muted">{context}</p>
          </motion.article>
        ))}
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1.45fr_0.85fr]">
        <article className="overflow-hidden rounded-card border border-ovia-line bg-white shadow-card">
          <div className="flex items-center justify-between gap-3 border-b border-ovia-line px-5 py-4 sm:px-6">
            <div>
              <h2 className="font-display text-2xl text-ovia-ink">Recent orders</h2>
              <p className="mt-1 text-xs text-ovia-muted">Latest simulated order activity</p>
            </div>
            <Link className="inline-flex items-center gap-1 text-sm font-bold text-ovia-primary hover:text-ovia-plum" to="/business/orders">
              View all <ArrowUpRight aria-hidden="true" size={15} />
            </Link>
          </div>
          <div className="divide-y divide-ovia-line">
            {recentOrders.map((order) => (
              <Link
                className="grid gap-2 px-5 py-4 transition-colors hover:bg-ovia-ivory sm:grid-cols-[1fr_0.8fr_auto] sm:items-center sm:px-6"
                key={order.id}
                to={`/business/orders?order=${order.id}`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ovia-ink">{order.customerName}</p>
                  <p className="mt-0.5 text-xs text-ovia-muted">{order.id} · {formatOrderDate(order.createdAt)}</p>
                </div>
                <OrderStatusBadge status={order.status} />
                <p className="text-sm font-bold text-ovia-ink sm:text-right">{formatInr(order.amountInPaise)}</p>
              </Link>
            ))}
          </div>
        </article>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <article className="rounded-card border border-ovia-line bg-ovia-plum p-5 text-white shadow-card sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold tracking-[0.12em] text-ovia-blush uppercase">Low stock alerts</p>
                <p className="mt-3 text-4xl font-semibold" data-testid="low-stock-count">
                  {metrics.lowStockVariants.length}
                </p>
                <p className="mt-1 text-sm text-white/70">low-stock variants at 8 units or fewer</p>
              </div>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/12 text-ovia-blush">
                <AlertTriangle aria-hidden="true" size={19} />
              </span>
            </div>
            <div className="mt-5 space-y-2">
              {metrics.lowStockVariants.slice(0, 3).map(({ product, label, selection, quantity }) => (
                <div className="flex items-center justify-between gap-3 text-sm" key={`${product.id}-${JSON.stringify(selection)}`}>
                  <span className="truncate text-white/80">{product.catalogueName} · {label}</span>
                  <span className="font-bold">{quantity}</span>
                </div>
              ))}
            </div>
            <Link className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-control bg-white px-4 text-sm font-bold text-ovia-plum hover:bg-ovia-ivory" to="/business/inventory">
              Manage inventory <ArrowUpRight aria-hidden="true" size={15} />
            </Link>
          </article>

          <article className="rounded-card border border-ovia-line bg-white p-5 shadow-card sm:p-6">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl text-ovia-ink">Top products</h2>
                <p className="mt-1 text-xs text-ovia-muted">By simulated units ordered</p>
              </div>
              <Link className="text-sm font-bold text-ovia-primary" to="/business/products">Catalogue</Link>
            </div>
            <div className="mt-5 space-y-4">
              {topProducts.map(({ product, units }, index) => (
                <div className="flex items-center gap-3" key={product.id}>
                  <span className="w-4 text-xs font-bold text-ovia-muted">{index + 1}</span>
                  <img alt="" className="size-12 rounded-xl bg-ovia-ivory object-cover object-top" src={product.images[0]} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ovia-ink">{product.catalogueName}</p>
                    <p className="text-xs text-ovia-muted">{formatInr(product.priceInPaise)}</p>
                  </div>
                  <span className="text-right text-xs font-bold text-ovia-plum sm:text-sm">{units} demo units</span>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>
    </Container>
  )
}
