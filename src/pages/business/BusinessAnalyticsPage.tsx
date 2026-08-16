import {
  ArrowDown,
  CreditCard,
  Eye,
  IndianRupee,
  PackageCheck,
  ShoppingBag,
  Sparkles,
  Users,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts'

import { BusinessPageHeader } from '../../components/business/BusinessPageHeader'
import { Container } from '../../components/layout/LayoutPrimitives'
import {
  analyticsPeriods,
  analyticsSnapshots,
} from '../../data/analytics'
import { sellableProducts } from '../../data/products'
import { classNames } from '../../lib/classNames'
import { formatInr } from '../../lib/currency'
import {
  type AnalyticsPeriod,
  useDemoStore,
} from '../../store/demoStore'

const LOADING_DURATION = 420

interface AnimatedNumberProps {
  formatter?: (value: number) => string
  value: number
}

function AnimatedNumber({
  formatter = (value) => Math.round(value).toLocaleString('en-IN'),
  value,
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    const startedAt = performance.now()
    let animationFrame = 0

    const update = (now: number) => {
      const progress = Math.min((now - startedAt) / 680, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayValue(value * eased)
      if (progress < 1) animationFrame = window.requestAnimationFrame(update)
    }

    animationFrame = window.requestAnimationFrame(update)
    return () => window.cancelAnimationFrame(animationFrame)
  }, [value])

  return <>{formatter(displayValue)}</>
}

function AnalyticsSkeleton() {
  return (
    <div aria-label="Loading simulated analytics" aria-live="polite" className="mt-6 animate-pulse" data-testid="analytics-loading" role="status">
      <span className="sr-only">Loading simulated analytics</span>
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div className="h-34 rounded-card border border-ovia-line bg-white p-5" key={item}>
            <div className="h-3 w-24 rounded-full bg-ovia-blush/65" />
            <div className="mt-5 h-8 w-32 rounded-lg bg-ovia-line" />
            <div className="mt-3 h-3 w-20 rounded-full bg-ovia-line/75" />
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="h-100 rounded-card border border-ovia-line bg-white p-6">
          <div className="h-5 w-32 rounded bg-ovia-line" />
          <div className="mt-12 h-58 rounded-2xl bg-ovia-blush/30" />
        </div>
        <div className="h-100 rounded-card border border-ovia-line bg-white p-6">
          <div className="h-5 w-28 rounded bg-ovia-line" />
          <div className="mt-8 space-y-5">
            {[100, 76, 52, 34, 16].map((width) => (
              <div className="h-8 rounded-lg bg-ovia-line" key={width} style={{ width: `${width}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function BusinessAnalyticsPage() {
  const selectedPeriod = useDemoStore((state) => state.analyticsPeriod)
  const setAnalyticsPeriod = useDemoStore((state) => state.setAnalyticsPeriod)
  const [renderedPeriod, setRenderedPeriod] = useState(selectedPeriod)
  const [isLoading, setIsLoading] = useState(false)
  const timeoutRef = useRef<number | null>(null)
  const snapshot = analyticsSnapshots[renderedPeriod]

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    },
    [],
  )

  const changePeriod = (period: AnalyticsPeriod) => {
    if (period === selectedPeriod && !isLoading) return
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)

    setAnalyticsPeriod(period)
    setIsLoading(true)
    timeoutRef.current = window.setTimeout(() => {
      setRenderedPeriod(period)
      setIsLoading(false)
      timeoutRef.current = null
    }, LOADING_DURATION)
  }

  const topMetrics = [
    {
      label: 'Revenue',
      value: snapshot.revenueInPaise,
      formatter: (value: number) => formatInr(Math.round(value)),
      helper: `${snapshot.label} simulated total`,
      icon: IndianRupee,
      testId: 'analytics-revenue',
    },
    {
      label: 'Sessions / visitors',
      value: snapshot.sessions,
      formatter: (value: number) => Math.round(value).toLocaleString('en-IN'),
      helper: 'Fabricated visits',
      icon: Users,
      testId: 'analytics-sessions',
    },
    {
      label: 'Conversion rate',
      value: snapshot.conversionRate,
      formatter: (value: number) => `${value.toFixed(2)}%`,
      helper: 'Orders divided by sessions',
      icon: PackageCheck,
      testId: 'analytics-conversion',
    },
  ]

  const funnel = [
    { label: 'Sessions', value: snapshot.sessions, icon: Users },
    { label: 'Product views', value: snapshot.productViews, icon: Eye },
    { label: 'Add to cart', value: snapshot.addToCart, icon: ShoppingBag },
    { label: 'Checkout', value: snapshot.checkout, icon: CreditCard },
    { label: 'Orders', value: snapshot.orders, icon: PackageCheck },
  ]

  return (
    <Container className="py-7 sm:py-10">
      <BusinessPageHeader
        actions={(
          <div aria-label="Analytics period" className="grid grid-cols-3 rounded-xl border border-ovia-line bg-white p-1 shadow-sm" role="tablist">
            {analyticsPeriods.map(({ label, value }) => (
              <button
                aria-controls="analytics-content"
                aria-selected={selectedPeriod === value}
                className={classNames(
                  'min-h-10 rounded-lg px-3 text-sm font-bold transition-colors sm:px-5',
                  selectedPeriod === value
                    ? 'bg-ovia-primary text-white shadow-sm'
                    : 'text-ovia-muted hover:bg-ovia-blush/35 hover:text-ovia-plum',
                )}
                data-testid={`analytics-tab-${value}`}
                id={`analytics-tab-${value}`}
                key={value}
                onClick={() => changePeriod(value)}
                role="tab"
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        )}
        description="Explore fabricated traffic, revenue, and conversion patterns designed only to demonstrate the reporting experience."
        eyebrow="Analytics"
        title="Store performance"
      />

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ovia-primary/20 bg-ovia-blush/30 px-4 py-3 text-xs text-ovia-plum">
        <span className="font-bold tracking-[0.08em] uppercase">Demo analytics only</span>
        <span>All events, metrics, trends, and insights below are simulated—not Ovia customer data.</span>
      </div>

      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            exit={{ opacity: 0 }}
            initial={{ opacity: 0.7 }}
            key="analytics-loading"
            transition={{ duration: 0.08 }}
          >
            <AnalyticsSkeleton />
          </motion.div>
        ) : (
          <motion.div
            animate={{ opacity: 1 }}
            aria-labelledby={`analytics-tab-${renderedPeriod}`}
            data-period={renderedPeriod}
            data-testid="analytics-content"
            id="analytics-content"
            initial={{ opacity: 0 }}
            key={renderedPeriod}
            role="tabpanel"
            transition={{ duration: 0.22 }}
          >
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {topMetrics.map(({ label, value, formatter, helper, icon: Icon, testId }, index) => (
                <motion.article
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-card border border-ovia-line bg-white p-5 shadow-card"
                  initial={{ opacity: 0, y: 8 }}
                  key={label}
                  transition={{ delay: 0.06 + index * 0.07, duration: 0.34 }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-ovia-muted">{label}</p>
                    <span className="flex size-9 items-center justify-center rounded-full bg-ovia-blush/55 text-ovia-plum"><Icon aria-hidden="true" size={17} /></span>
                  </div>
                  <p className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-ovia-ink" data-testid={testId}>
                    <AnimatedNumber formatter={formatter} value={value} />
                  </p>
                  <p className="mt-1 text-xs text-ovia-muted">{helper}</p>
                </motion.article>
              ))}
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
              <article className="min-w-0 rounded-card border border-ovia-line bg-white p-5 shadow-card sm:p-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold tracking-[0.12em] text-ovia-primary uppercase">Simulated revenue</p>
                    <h2 className="mt-1 font-display text-2xl text-ovia-ink">Revenue over time</h2>
                  </div>
                  <p className="text-xs text-ovia-muted">{snapshot.range}</p>
                </div>
                <div aria-label={`${snapshot.label} simulated revenue chart`} className="mt-5 h-64 w-full sm:h-76" data-testid="revenue-chart" role="img">
                  <ResponsiveContainer height="100%" width="100%">
                    <AreaChart data={snapshot.revenueSeries} margin={{ top: 12, right: 6, bottom: 0, left: 6 }}>
                      <defs>
                        <linearGradient id={`revenue-fill-${renderedPeriod}`} x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#A64F8C" stopOpacity={0.28} />
                          <stop offset="100%" stopColor="#A64F8C" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#eee5e9" strokeDasharray="3 5" vertical={false} />
                      <XAxis
                        axisLine={false}
                        dataKey="label"
                        interval={renderedPeriod === 'weekly' ? 1 : 0}
                        minTickGap={4}
                        padding={{ left: 8, right: 8 }}
                        tick={{ fill: '#756B70', fontSize: 11 }}
                        tickLine={false}
                        tickMargin={12}
                      />
                      <Tooltip
                        contentStyle={{ border: '1px solid #e9dfe4', borderRadius: '12px', boxShadow: '0 12px 30px rgba(41,35,39,.1)' }}
                        formatter={(value) => [formatInr(Number(value)), 'Simulated revenue']}
                        labelStyle={{ color: '#673453', fontWeight: 700 }}
                      />
                      <Area
                        animationBegin={80}
                        animationDuration={760}
                        dataKey="revenueInPaise"
                        fill={`url(#revenue-fill-${renderedPeriod})`}
                        fillOpacity={1}
                        isAnimationActive
                        stroke="#A64F8C"
                        strokeLinecap="round"
                        strokeWidth={3}
                        type="monotone"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </article>

              <article className="rounded-card border border-ovia-line bg-white p-5 shadow-card sm:p-6">
                <p className="text-xs font-bold tracking-[0.12em] text-ovia-primary uppercase">Demo funnel</p>
                <h2 className="mt-1 font-display text-2xl text-ovia-ink">Customer journey</h2>
                <p className="mt-1 text-xs leading-5 text-ovia-muted">Fabricated counts showing how a funnel could be monitored.</p>
                <div className="mt-5 space-y-3" data-testid="analytics-funnel">
                  {funnel.map(({ label, value, icon: Icon }, index) => {
                    const width = Math.max((value / snapshot.sessions) * 100, 7)
                    return (
                      <motion.div
                        animate={{ opacity: 1, x: 0 }}
                        className="relative"
                        initial={{ opacity: 0, x: 8 }}
                        key={label}
                        transition={{ delay: 0.35 + index * 0.09, duration: 0.35 }}
                      >
                        <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                          <span className="inline-flex items-center gap-1.5 font-semibold text-ovia-muted"><Icon aria-hidden="true" size={13} />{label}</span>
                          <span className="font-bold text-ovia-ink"><AnimatedNumber value={value} /></span>
                        </div>
                        <div className="h-7 overflow-hidden rounded-lg bg-ovia-blush/28">
                          <motion.div
                            animate={{ width: `${width}%` }}
                            className="h-full rounded-lg bg-ovia-primary"
                            initial={{ width: 0 }}
                            transition={{ delay: 0.32 + index * 0.09, duration: 0.62, ease: 'easeOut' }}
                          />
                        </div>
                        {index < funnel.length - 1 && (
                          <ArrowDown aria-hidden="true" className="mx-auto mt-1 text-ovia-logo/55" size={12} />
                        )}
                      </motion.div>
                    )
                  })}
                </div>
              </article>
            </div>

            <motion.section
              animate={{ opacity: 1, y: 0 }}
              aria-label="Demo insights"
              className="mt-4"
              data-testid="analytics-insights"
              initial={{ opacity: 0, y: 10 }}
              transition={{ delay: 0.9, duration: 0.4 }}
            >
              <div className="flex items-center gap-2">
                <Sparkles aria-hidden="true" className="text-ovia-primary" size={18} />
                <h2 className="font-display text-2xl text-ovia-ink">Demo insights</h2>
              </div>
              <p className="mt-1 text-xs text-ovia-muted">Illustrative prompts only—not analysis of Ovia’s real customers.</p>
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {snapshot.insights.map((insight, index) => {
                  const product = sellableProducts.find((candidate) => candidate.id === insight.productId)
                  return (
                    <motion.article
                      animate={{ opacity: 1, y: 0 }}
                      className="flex gap-4 rounded-card border border-ovia-line bg-white p-4 shadow-card"
                      initial={{ opacity: 0, y: 8 }}
                      key={insight.title}
                      transition={{ delay: 0.98 + index * 0.08, duration: 0.36 }}
                    >
                      {product && <img alt="" className="h-24 w-18 shrink-0 rounded-xl bg-ovia-ivory object-cover object-top" src={product.image} />}
                      <div className="min-w-0">
                        <p className="text-[0.66rem] font-bold tracking-[0.1em] text-ovia-primary uppercase">Demo insight · {insight.eyebrow}</p>
                        <h3 className="mt-1.5 text-sm leading-5 font-bold text-ovia-ink">{insight.title}</h3>
                        <p className="mt-1.5 text-xs leading-5 text-ovia-muted">{insight.description}</p>
                      </div>
                    </motion.article>
                  )
                })}
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </Container>
  )
}
