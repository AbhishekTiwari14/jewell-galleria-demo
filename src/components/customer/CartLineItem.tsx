import { Minus, Plus, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'

import { sellableProducts } from '../../data/products'
import { formatProductSelection } from '../../data/productTypes'
import { formatInr } from '../../lib/currency'
import { useDemoStore, type CartLine } from '../../store/demoStore'

interface CartLineItemProps {
  line: CartLine
  compact?: boolean
}

export function CartLineItem({ line, compact = false }: CartLineItemProps) {
  const removeFromCart = useDemoStore((state) => state.removeFromCart)
  const setCartQuantity = useDemoStore((state) => state.setCartQuantity)
  const createdProducts = useDemoStore((state) => state.createdProducts)
  const product = [...sellableProducts, ...createdProducts].find(
    (item) => item.id === line.productId,
  )

  if (!product) {
    return null
  }

  return (
    <article
      className="grid grid-cols-[5.5rem_1fr] gap-3 border-b border-ovia-line py-5 last:border-b-0 xs:grid-cols-[6.25rem_1fr] xs:gap-3.5 sm:grid-cols-[7rem_1fr] sm:gap-4 sm:py-6"
      data-testid={`cart-line-${product.slug}`}
    >
      <Link
        className="aspect-[4/5] self-start overflow-hidden rounded-xl bg-ovia-blush/25"
        to={`/product/${product.slug}`}
      >
        <img
          alt={product.catalogueName}
          className="size-full object-cover"
          src={product.images[0]}
        />
      </Link>
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Link
              className="text-[0.95rem] leading-snug font-semibold text-ovia-ink hover:text-ovia-primary sm:text-base"
              to={`/product/${product.slug}`}
            >
              {product.catalogueName}
            </Link>
            {formatProductSelection(product, line.selection) ? (
              <p className="mt-1 text-sm text-ovia-muted">
                {formatProductSelection(product, line.selection)}
              </p>
            ) : null}
          </div>
          <button
            aria-label={`Remove ${product.catalogueName} from bag`}
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-ovia-muted transition-colors hover:bg-ovia-blush/55 hover:text-ovia-plum"
            onClick={() => removeFromCart(line.id)}
            type="button"
          >
            <Trash2 aria-hidden="true" size={17} />
          </button>
        </div>
        <p className="mt-2 font-semibold text-ovia-plum" data-testid="cart-line-total">
          {formatInr(
            product.priceInPaise === null
              ? null
              : product.priceInPaise * line.quantity,
          )}
        </p>
        <div
          aria-label={`Quantity for ${product.catalogueName}`}
          className="mt-3 inline-flex items-center rounded-full border border-ovia-line bg-white"
        >
          <button
            aria-label="Decrease quantity"
            className="flex size-11 items-center justify-center rounded-full text-ovia-plum hover:bg-ovia-blush/45"
            onClick={() => setCartQuantity(line.id, line.quantity - 1)}
            type="button"
          >
            <Minus aria-hidden="true" size={15} />
          </button>
          <span
            aria-live="polite"
            className="min-w-8 text-center text-sm font-semibold"
            data-testid="cart-line-quantity"
          >
            {line.quantity}
          </span>
          <button
            aria-label="Increase quantity"
            className="flex size-11 items-center justify-center rounded-full text-ovia-plum hover:bg-ovia-blush/45"
            onClick={() => setCartQuantity(line.id, line.quantity + 1)}
            type="button"
          >
            <Plus aria-hidden="true" size={15} />
          </button>
        </div>
        {!compact && product.status === 'sellable' && product.source.kind === 'real-screenshot' && (
          <span className="sr-only">
            Catalogue reference {product.source.fileName}
          </span>
        )}
      </div>
    </article>
  )
}
