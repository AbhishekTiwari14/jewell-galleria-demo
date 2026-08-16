import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { classNames } from '../../lib/classNames'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-ovia-primary text-white shadow-sm hover:bg-ovia-plum disabled:bg-ovia-muted/40',
  secondary:
    'border border-ovia-primary bg-transparent text-ovia-plum hover:bg-ovia-blush/55 disabled:border-ovia-line disabled:text-ovia-muted/50',
  ghost:
    'bg-transparent text-ovia-plum hover:bg-ovia-blush/45 disabled:text-ovia-muted/50',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3 py-1.5 text-sm',
  md: 'min-h-11 px-4 py-2.5 text-sm',
  lg: 'min-h-12 px-6 py-3 text-base',
}

export function Button({
  children,
  className,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      className={classNames(
        'inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-[background-color,border-color,color,transform] duration-200 active:translate-y-px disabled:cursor-not-allowed disabled:translate-y-0',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className,
      )}
      type={type}
      {...props}
    >
      {children}
    </button>
  )
}
