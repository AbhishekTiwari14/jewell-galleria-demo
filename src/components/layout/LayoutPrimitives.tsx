import type { HTMLAttributes, ReactNode } from 'react'

import { classNames } from '../../lib/classNames'

export interface LayoutProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function Container({ children, className, ...props }: LayoutProps) {
  return (
    <div
      className={classNames(
        'mx-auto w-full max-w-360 px-4 sm:px-6 lg:px-8',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function PageSection({ children, className, ...props }: LayoutProps) {
  return (
    <section
      className={classNames('py-8 sm:py-12 lg:py-16', className)}
      {...props}
    >
      {children}
    </section>
  )
}

export function Stack({ children, className, ...props }: LayoutProps) {
  return (
    <div
      className={classNames('flex flex-col gap-4 sm:gap-6', className)}
      {...props}
    >
      {children}
    </div>
  )
}

export function ResponsiveGrid({
  children,
  className,
  ...props
}: LayoutProps) {
  return (
    <div
      className={classNames(
        'grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

