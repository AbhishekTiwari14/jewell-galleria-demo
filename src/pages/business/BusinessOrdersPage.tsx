import { Check, CheckCircle2, ChevronRight, Circle, Package, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { BusinessPageHeader } from '../../components/business/BusinessPageHeader'
import { OrderStatusBadge } from '../../components/business/OrderStatusBadge'
import { Button } from '../../components/ui/Button'
import { Container } from '../../components/layout/LayoutPrimitives'
import { sellableProducts } from '../../data/products'
import {
  formatProductSelection,
  type CommerceProduct,
} from '../../data/productTypes'
import { classNames } from '../../lib/classNames'
import { formatInr } from '../../lib/currency'
import { orderStatusLabels } from '../../lib/orders'
import {
  type DemoOrder,
  type DemoPaymentStatus,
  type DemoOrderStatus,
  useDemoStore,
} from '../../store/demoStore'

type OrderFilter = 'all' | DemoOrderStatus

const orderStatuses = Object.keys(orderStatusLabels) as DemoOrderStatus[]

const fulfilmentTimeline: DemoOrderStatus[] = [
  'new',
  'confirmed',
  'packed',
  'shipped',
  'delivered',
]

const filters: Array<{ value: OrderFilter; label: string }> = [
  { value: 'all', label: 'All' },
  ...orderStatuses.map((status) => ({
    value: status,
    label: orderStatusLabels[status],
  })),
]

function formatOrderDate(value: string, detailed = false) {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(detailed ? { hour: 'numeric', minute: '2-digit' } : {}),
  }).format(new Date(value))
}

function itemCount(order: DemoOrder) {
  return order.items.reduce((total, item) => total + item.quantity, 0)
}

function itemSummary(
  order: DemoOrder,
  commerceProducts: readonly CommerceProduct[],
) {
  const names = order.items
    .map((item) =>
      commerceProducts.find((product) => product.id === item.productId)
        ?.catalogueName,
    )
    .filter((name): name is string => Boolean(name))

  if (names.length === 0) {
    const count = itemCount(order)
    return `${count} ${count === 1 ? 'item' : 'items'}`
  }
  return names.length === 1 ? names[0] : `${names[0]} +${names.length - 1} more`
}

function OrderTimeline({ status }: { status: DemoOrderStatus }) {
  const statuses: DemoOrderStatus[] =
    status === 'cancelled' ? ['new', 'cancelled'] : fulfilmentTimeline
  const currentIndex = statuses.indexOf(status)

  return (
    <ol className="mt-4" data-testid="order-timeline">
      {statuses.map((timelineStatus, index) => {
        const completed = index < currentIndex
        const current = timelineStatus === status
        return (
          <li className="relative flex gap-3 pb-5 last:pb-0" data-testid={`timeline-status-${timelineStatus}`} key={timelineStatus}>
            {index < statuses.length - 1 && (
              <span aria-hidden="true" className={classNames('absolute top-6 left-[0.6875rem] h-[calc(100%-0.35rem)] w-px', completed ? 'bg-ovia-primary' : 'bg-ovia-line')} />
            )}
            <span className={classNames('relative z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-white', completed || current ? 'text-ovia-primary' : 'text-ovia-muted/45')}>
              {completed ? <CheckCircle2 aria-hidden="true" size={20} /> : <Circle aria-hidden="true" fill={current ? 'currentColor' : 'none'} size={current ? 14 : 18} />}
            </span>
            <span>
              <span className={classNames('block text-sm font-bold', current ? 'text-ovia-primary' : completed ? 'text-ovia-ink' : 'text-ovia-muted')}>{orderStatusLabels[timelineStatus]}</span>
              <span className="mt-0.5 block text-xs text-ovia-muted">{current ? 'Current demo status' : completed ? 'Completed demo stage' : 'Pending'}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function paymentStatusLabel(status: DemoPaymentStatus, detailed = false) {
  if (status === 'cod') return 'Cash on delivery'
  if (status === 'demo') {
    return detailed ? 'Demo payment — no charge' : 'Demo payment'
  }
  return detailed ? 'Paid online' : 'Paid'
}

export function BusinessOrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const orders = useDemoStore((state) => state.orders)
  const createdProducts = useDemoStore((state) => state.createdProducts)
  const updateOrderStatus = useDemoStore((state) => state.updateOrderStatus)
  const initialOrderId = searchParams.get('order')
  const [filter, setFilter] = useState<OrderFilter>('all')
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(
    orders.some((order) => order.id === initialOrderId) ? initialOrderId : null,
  )
  const selectedOrder = orders.find((order) => order.id === selectedOrderId)
  const [draftStatus, setDraftStatus] = useState<DemoOrderStatus>(
    selectedOrder?.status ?? 'new',
  )
  const [toast, setToast] = useState<string | null>(null)

  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [orders],
  )
  const commerceProducts = useMemo(
    () => [...sellableProducts, ...createdProducts],
    [createdProducts],
  )
  const visibleOrders =
    filter === 'all'
      ? sortedOrders
      : sortedOrders.filter((order) => order.status === filter)

  const openOrder = (order: DemoOrder) => {
    setSelectedOrderId(order.id)
    setDraftStatus(order.status)
    setSearchParams({ order: order.id }, { replace: true })
  }

  const closeOrder = () => {
    setSelectedOrderId(null)
    setSearchParams({}, { replace: true })
  }

  const saveStatus = () => {
    if (!selectedOrder) return
    updateOrderStatus(selectedOrder.id, draftStatus)
    setToast(`${selectedOrder.id} updated to ${orderStatusLabels[draftStatus]}`)
    window.setTimeout(() => setToast(null), 3000)
  }

  return (
    <Container className="py-7 sm:py-10">
      <BusinessPageHeader
        description="Filter the simulated fulfilment queue, inspect an order, and update its demo status."
        eyebrow="Orders"
        title="Order management"
      />

      <section className="mt-6 overflow-hidden rounded-card border border-ovia-line bg-white shadow-card">
        <div className="border-b border-ovia-line p-4 sm:px-6 sm:py-5">
          <p className="text-xs font-bold tracking-[0.12em] text-ovia-muted uppercase">Filter status</p>
          <div aria-label="Filter orders by status" className="mt-3 flex gap-2 overflow-x-auto pb-1" role="group">
            {filters.map(({ value, label }) => {
              const count = value === 'all' ? orders.length : orders.filter((order) => order.status === value).length
              return (
                <button
                  aria-pressed={filter === value}
                  className={classNames(
                    'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-bold transition-colors',
                    filter === value
                      ? 'border-ovia-primary bg-ovia-primary text-white'
                      : 'border-ovia-line bg-white text-ovia-muted hover:border-ovia-logo hover:text-ovia-plum',
                  )}
                  data-testid={`order-filter-${value}`}
                  key={value}
                  onClick={() => setFilter(value)}
                  type="button"
                >
                  {label}
                  <span className={classNames('text-xs', filter === value ? 'text-white/75' : 'text-ovia-muted/70')}>{count}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="hidden grid-cols-[1.05fr_1fr_1.3fr_0.72fr_0.75fr_0.8fr_1rem] gap-4 border-b border-ovia-line bg-ovia-ivory/60 px-6 py-3 text-[0.68rem] font-bold tracking-[0.1em] text-ovia-muted uppercase md:grid">
          <span>Order ID</span><span>Customer</span><span>Items</span><span className="text-right">Total</span><span>Status</span><span>Date</span><span />
        </div>

        <div className="divide-y divide-ovia-line">
          {visibleOrders.map((order) => {
            const summary = itemSummary(order, commerceProducts)
            return (
              <button
                aria-label={`Open order ${order.id}`}
                className="w-full px-4 py-4 text-left transition-colors hover:bg-ovia-ivory md:grid md:grid-cols-[1.05fr_1fr_1.3fr_0.72fr_0.75fr_0.8fr_1rem] md:items-center md:gap-4 md:px-6"
                data-testid={`open-order-${order.id}`}
                key={order.id}
                onClick={() => openOrder(order)}
                type="button"
              >
                <span className="block md:hidden">
                  <span className="flex items-start justify-between gap-3">
                    <span>
                      <span className="block text-sm font-bold text-ovia-ink">{order.id}</span>
                      <span className="mt-1 block text-xs text-ovia-muted">{formatOrderDate(order.createdAt)}</span>
                    </span>
                    <OrderStatusBadge status={order.status} />
                  </span>
                  <span className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-ovia-line pt-4">
                    <span>
                      <span className="block text-[0.68rem] font-bold tracking-[0.08em] text-ovia-muted uppercase">Customer</span>
                      <span className="mt-1 block text-sm font-semibold text-ovia-ink">{order.customerName}</span>
                    </span>
                    <span>
                      <span className="block text-[0.68rem] font-bold tracking-[0.08em] text-ovia-muted uppercase">Total</span>
                      <span className="mt-1 block text-sm font-bold text-ovia-ink">{formatInr(order.amountInPaise)}</span>
                    </span>
                    <span className="col-span-2">
                      <span className="block text-[0.68rem] font-bold tracking-[0.08em] text-ovia-muted uppercase">Items</span>
                      <span className="mt-1 block line-clamp-2 text-sm font-semibold text-ovia-ink">{summary}</span>
                      <span className="mt-1 block text-xs text-ovia-muted">{itemCount(order)} {itemCount(order) === 1 ? 'item' : 'items'} · {order.shippingCity} · {paymentStatusLabel(order.paymentStatus)}</span>
                    </span>
                  </span>
                </span>

                <span className="hidden text-sm font-bold text-ovia-ink md:block">{order.id}</span>
                <span className="hidden md:block">
                  <span className="block text-sm font-semibold text-ovia-ink">{order.customerName}</span>
                  <span className="mt-1 block text-xs text-ovia-muted">{order.shippingCity}</span>
                </span>
                <span className="hidden min-w-0 md:block">
                  <span className="block truncate text-sm font-semibold text-ovia-ink">{summary}</span>
                  <span className="mt-1 block text-xs text-ovia-muted">{itemCount(order)} {itemCount(order) === 1 ? 'item' : 'items'}</span>
                </span>
                <span className="hidden text-right text-sm font-bold text-ovia-ink md:block">{formatInr(order.amountInPaise)}</span>
                <span className="hidden md:block"><OrderStatusBadge status={order.status} /></span>
                <span className="hidden text-xs text-ovia-muted md:block">{formatOrderDate(order.createdAt)}</span>
                <ChevronRight aria-hidden="true" className="hidden text-ovia-muted/60 md:block" size={17} />
              </button>
            )
          })}
          {visibleOrders.length === 0 && (
            <div className="px-5 py-14 text-center">
              <Package aria-hidden="true" className="mx-auto text-ovia-logo" size={28} />
              <p className="mt-3 font-bold text-ovia-ink">No orders in this status</p>
              <p className="mt-1 text-sm text-ovia-muted">Choose another filter to continue.</p>
            </div>
          )}
        </div>
      </section>

      <AnimatePresence>
        {selectedOrder && (
          <motion.div
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-ovia-ink/45 p-0 sm:items-center sm:p-5"
            data-testid="order-detail-overlay"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeOrder()
            }}
          >
            <motion.section
              animate={{ opacity: 1, y: 0 }}
              aria-labelledby="order-detail-title"
              aria-modal="true"
              className="max-h-[92vh] w-full overflow-y-auto rounded-t-sheet bg-white shadow-floating sm:max-w-xl sm:rounded-sheet"
              data-testid="order-detail"
              exit={{ opacity: 0, y: 18 }}
              initial={{ opacity: 0, y: 24 }}
              role="dialog"
              transition={{ duration: 0.24 }}
            >
              <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-ovia-line bg-white px-5 py-5 sm:px-6">
                <div>
                  <p className="text-xs font-bold tracking-[0.12em] text-ovia-primary uppercase">Simulated order</p>
                  <h2 className="mt-1 font-display text-2xl text-ovia-ink" id="order-detail-title">{selectedOrder.id}</h2>
                  <p className="mt-1 text-xs text-ovia-muted">Placed {formatOrderDate(selectedOrder.createdAt, true)}</p>
                </div>
                <button aria-label="Close order details" className="flex size-11 shrink-0 items-center justify-center rounded-full text-ovia-muted hover:bg-ovia-blush/40 hover:text-ovia-plum" onClick={closeOrder} type="button">
                  <X aria-hidden="true" size={19} />
                </button>
              </div>

              <div className="p-5 sm:p-6">
                <h3 className="text-sm font-bold text-ovia-ink">Customer details</h3>
                <div className="mt-3 grid gap-3 rounded-2xl bg-ovia-ivory p-4 sm:grid-cols-2">
                  <div><p className="text-xs text-ovia-muted">Customer</p><p className="mt-1 text-sm font-bold text-ovia-ink">{selectedOrder.customerName}</p></div>
                  <div><p className="text-xs text-ovia-muted">Delivery city</p><p className="mt-1 text-sm font-bold text-ovia-ink">{selectedOrder.shippingCity}</p></div>
                  <div><p className="text-xs text-ovia-muted">Payment</p><p className="mt-1 text-sm font-bold text-ovia-ink">{paymentStatusLabel(selectedOrder.paymentStatus, true)}</p></div>
                  <div><p className="text-xs text-ovia-muted">Current status</p><div className="mt-1"><OrderStatusBadge status={selectedOrder.status} /></div></div>
                </div>

                <div className="mt-6">
                  <h3 className="text-sm font-bold text-ovia-ink">Order items</h3>
                  <div className="mt-3 divide-y divide-ovia-line border-y border-ovia-line">
                    {selectedOrder.items.map((item) => {
                      const product = commerceProducts.find((candidate) => candidate.id === item.productId)
                      if (!product) return null
                      return (
                        <div className="grid grid-cols-[4rem_minmax(0,1fr)] gap-3 py-3 sm:grid-cols-[4rem_minmax(0,1fr)_auto] sm:items-center" data-testid={`order-detail-item-${product.slug}`} key={`${item.productId}-${JSON.stringify(item.selection)}`}>
                          <img alt="" className="size-16 rounded-xl bg-ovia-ivory object-cover object-top" src={product.images[0]} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-ovia-ink">{product.catalogueName}</p>
                            <p className="mt-1 text-xs text-ovia-muted">
                              {formatProductSelection(product, item.selection)
                                ? `${formatProductSelection(product, item.selection)} · `
                                : ''}
                              Qty {item.quantity}
                            </p>
                            <p className="mt-1 text-xs text-ovia-muted">{formatInr(product.priceInPaise)} each</p>
                          </div>
                          <p className="col-start-2 text-sm font-bold text-ovia-ink sm:col-start-auto">
                            {formatInr(
                              product.priceInPaise === null
                                ? null
                                : product.priceInPaise * item.quantity,
                            )}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-ovia-muted">Order total</span>
                    <span className="text-lg font-bold text-ovia-ink">{formatInr(selectedOrder.amountInPaise)}</span>
                  </div>
                </div>

                <section className="mt-7 rounded-2xl border border-ovia-line p-4" aria-labelledby="order-timeline-heading">
                  <h3 className="text-sm font-bold text-ovia-ink" id="order-timeline-heading">Order timeline</h3>
                  <p className="mt-1 text-xs leading-5 text-ovia-muted">Illustrative fulfilment stages only. No physical shipment is taking place.</p>
                  <OrderTimeline status={selectedOrder.status} />
                </section>

                <div className="mt-7 rounded-2xl border border-ovia-line p-4">
                  <label className="block text-sm font-bold text-ovia-ink" htmlFor="demo-order-status">Update demo status</label>
                  <p className="mt-1 text-xs text-ovia-muted">This change is simulated and saved only in this browser.</p>
                  <select
                    className="mt-3 h-12 w-full rounded-xl border border-ovia-line bg-white px-3 text-sm font-semibold text-ovia-ink outline-none focus:border-ovia-primary"
                    data-testid="order-status-select"
                    id="demo-order-status"
                    onChange={(event) => setDraftStatus(event.target.value as DemoOrderStatus)}
                    value={draftStatus}
                  >
                    {orderStatuses.map((status) => <option key={status} value={status}>{orderStatusLabels[status]}</option>)}
                  </select>
                  <Button className="mt-3" data-testid="save-order-status" disabled={draftStatus === selectedOrder.status} fullWidth onClick={saveStatus}>
                    Save Status
                  </Button>
                </div>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            aria-live="polite"
            className="fixed right-4 bottom-4 left-4 z-[60] flex items-center gap-3 rounded-2xl bg-ovia-ink px-4 py-3.5 text-sm text-white shadow-floating sm:right-6 sm:left-auto"
            data-testid="order-success-toast"
            exit={{ opacity: 0, y: 12 }}
            initial={{ opacity: 0, y: 12 }}
            role="status"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ovia-success"><Check aria-hidden="true" size={15} /></span>
            <span><strong className="block">Order updated</strong><span className="text-xs text-white/70">{toast}</span></span>
          </motion.div>
        )}
      </AnimatePresence>
    </Container>
  )
}
