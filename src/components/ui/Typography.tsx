import type { HTMLAttributes, ReactNode } from 'react'

import { classNames } from '../../lib/classNames'

type HeadingLevel = 1 | 2 | 3 | 4

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode
  level?: HeadingLevel
}

const headingClasses: Record<HeadingLevel, string> = {
  1: 'text-4xl leading-tight sm:text-5xl',
  2: 'text-3xl leading-tight sm:text-4xl',
  3: 'text-2xl leading-snug sm:text-3xl',
  4: 'text-xl leading-snug sm:text-2xl',
}

export function Heading({
  children,
  className,
  level = 1,
  ...props
}: HeadingProps) {
  const Element = `h${level}` as const

  return (
    <Element
      className={classNames(
        'font-display font-medium tracking-[-0.02em] text-ovia-ink',
        headingClasses[level],
        className,
      )}
      {...props}
    >
      {children}
    </Element>
  )
}

export interface TextProps extends HTMLAttributes<HTMLParagraphElement> {
  children: ReactNode
  tone?: 'default' | 'muted'
}

export function Text({
  children,
  className,
  tone = 'default',
  ...props
}: TextProps) {
  return (
    <p
      className={classNames(
        'leading-7',
        tone === 'muted' ? 'text-ovia-muted' : 'text-ovia-ink',
        className,
      )}
      {...props}
    >
      {children}
    </p>
  )
}

