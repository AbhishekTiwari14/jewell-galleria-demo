import {
  ArrowLeft,
  BarChart3,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  PackageOpen,
  RotateCcw,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'

import { DemoModeIndicator } from '../components/business/DemoModeIndicator'
import { Container } from '../components/layout/LayoutPrimitives'
import { classNames } from '../lib/classNames'
import { useDemoStore } from '../store/demoStore'

const businessLinks = [
  { to: '/business', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/business/products', label: 'Products', icon: PackageOpen },
  { to: '/business/inventory', label: 'Inventory', icon: Boxes },
  { to: '/business/orders', label: 'Orders', icon: ClipboardList },
  { to: '/business/analytics', label: 'Analytics', icon: BarChart3 },
] as const

export function BusinessLayout() {
  const [resetMessage, setResetMessage] = useState(false)
  const [resetVersion, setResetVersion] = useState(0)
  const resetDemo = useDemoStore((state) => state.resetDemo)
  const location = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [location.pathname])

  const handleReset = () => {
    resetDemo()
    setResetVersion((version) => version + 1)
    setResetMessage(true)
    window.setTimeout(() => setResetMessage(false), 2400)
  }

  return (
    <div className="min-h-screen bg-[#fbf8f7]">
      <header className="border-b border-ovia-line bg-white">
        <Container className="flex min-h-18 items-center justify-between gap-3 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <img
              alt="Ovia"
              className="size-10 shrink-0 rounded-xl object-cover sm:size-11"
              height="44"
              src="/brand/ovia-logo.jpg"
              width="44"
            />
            <div className="min-w-0">
              <p className="truncate font-display text-lg text-ovia-plum">
                Ovia Business
              </p>
              <p className="hidden text-xs text-ovia-muted sm:block">
                Private operations preview
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Link
              aria-label="Return to storefront"
              className="inline-flex min-h-10 items-center gap-2 rounded-control px-2.5 text-sm font-semibold text-ovia-muted hover:bg-ovia-blush/35 hover:text-ovia-plum sm:px-3"
              to="/"
            >
              <ArrowLeft aria-hidden="true" size={16} />
              <span className="hidden sm:inline">Storefront</span>
            </Link>
            <button
              aria-label="Reset all simulated business data"
              className="inline-flex min-h-10 items-center gap-2 rounded-control px-2.5 text-sm font-semibold text-ovia-muted hover:bg-ovia-blush/35 hover:text-ovia-plum sm:px-3"
              onClick={handleReset}
              type="button"
            >
              <RotateCcw aria-hidden="true" size={15} />
              <span className="hidden sm:inline">Reset demo</span>
            </button>
          </div>
        </Container>
      </header>
      <div className="sticky top-0 z-30 border-b border-ovia-line bg-white/95 backdrop-blur-lg">
        <Container className="flex flex-col gap-2 py-2 lg:flex-row lg:items-center lg:justify-between">
          <nav aria-label="Business" className="grid w-full grid-cols-5 gap-0.5 lg:flex lg:w-auto lg:gap-1">
            {businessLinks.map(({ to, label, icon: Icon, ...linkProps }) => (
              <NavLink
                className={({ isActive }) =>
                  classNames(
                    'inline-flex min-h-10 min-w-0 shrink-0 items-center justify-center gap-2 rounded-control px-1 text-[0.68rem] font-semibold transition-colors sm:px-3 sm:text-sm',
                    isActive
                      ? 'bg-ovia-blush text-ovia-plum'
                      : 'text-ovia-muted hover:bg-ovia-blush/35 hover:text-ovia-plum',
                  )
                }
                key={to}
                to={to}
                {...linkProps}
              >
                <Icon aria-hidden="true" className="hidden lg:block" size={16} />
                {label}
              </NavLink>
            ))}
          </nav>
          <DemoModeIndicator />
        </Container>
      </div>
      <main>
        <Outlet key={resetVersion} />
      </main>
      {resetMessage && (
        <div
          aria-live="polite"
          className="fixed right-4 bottom-4 z-50 rounded-xl bg-ovia-ink px-4 py-3 text-sm font-semibold text-white shadow-floating"
          role="status"
        >
          Demo data reset
        </div>
      )}
    </div>
  )
}
