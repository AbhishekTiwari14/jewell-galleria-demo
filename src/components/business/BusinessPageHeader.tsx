import type { ReactNode } from 'react'

interface BusinessPageHeaderProps {
  eyebrow: string
  title: string
  description: string
  actions?: ReactNode
}

export function BusinessPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: BusinessPageHeaderProps) {
  return (
    <div className="flex flex-col gap-5 border-b border-ovia-line pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <p className="text-xs font-bold tracking-[0.14em] text-ovia-primary uppercase">
          {eyebrow} · Simulated business data
        </p>
        <h1 className="mt-2 font-display text-3xl leading-tight font-medium tracking-[-0.025em] text-ovia-ink sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-ovia-muted sm:text-base">
          {description}
        </p>
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  )
}
