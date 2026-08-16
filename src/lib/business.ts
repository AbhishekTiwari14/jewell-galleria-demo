import {
  isDemoProduct,
  isProductActive,
  type CommerceProduct,
} from '../data/productTypes'
import {
  getVariantKey,
  LOW_STOCK_THRESHOLD,
  type DemoOrder,
} from '../store/demoStore'

export interface LowStockVariant {
  product: CommerceProduct
  size: string
  color?: string
  quantity: number
}

export function getProductStock(
  product: CommerceProduct,
  inventoryByVariant: Record<string, number>,
) {
  if (isDemoProduct(product)) {
    return product.colors.reduce(
      (productTotal, color) =>
        productTotal + product.sizes.reduce(
          (colorTotal, size) =>
            colorTotal +
            (inventoryByVariant[
              getVariantKey(product.id, size, color.label)
            ] ?? 0),
          0,
        ),
      0,
    )
  }

  return product.sizes.reduce(
    (total, size) =>
      total + (inventoryByVariant[getVariantKey(product.id, size)] ?? 0),
    0,
  )
}

export function getLowStockVariants(
  products: readonly CommerceProduct[],
  inventoryByVariant: Record<string, number>,
): LowStockVariant[] {
  return products.filter(isProductActive).flatMap<LowStockVariant>((product) => {
    if (isDemoProduct(product)) {
      return product.colors.flatMap((color) =>
        product.sizes.flatMap((size) => {
          const quantity =
            inventoryByVariant[
              getVariantKey(product.id, size, color.label)
            ] ?? 0
          return quantity <= LOW_STOCK_THRESHOLD
            ? [{ product, size, color: color.label, quantity }]
            : []
        }),
      )
    }

    return product.sizes.flatMap((size) => {
      const quantity = inventoryByVariant[getVariantKey(product.id, size)] ?? 0
      return quantity <= LOW_STOCK_THRESHOLD
        ? [{ product, size, quantity }]
        : []
    })
  })
}

export function getBusinessMetrics(
  products: readonly CommerceProduct[],
  orders: DemoOrder[],
  inventoryByVariant: Record<string, number>,
) {
  const revenueOrders = orders.filter((order) => order.status !== 'cancelled')
  const revenue = revenueOrders.reduce(
    (total, order) => total + order.amountInPaise,
    0,
  )
  const inventoryUnits = Object.values(inventoryByVariant).reduce(
    (total, quantity) => total + quantity,
    0,
  )

  return {
    orders: orders.length,
    revenue,
    averageOrderValue:
      revenueOrders.length > 0 ? Math.round(revenue / revenueOrders.length) : 0,
    activeProducts: products.filter(isProductActive).length,
    inventoryUnits,
    lowStockVariants: getLowStockVariants(products, inventoryByVariant),
  }
}

export function getTopProducts(
  products: readonly CommerceProduct[],
  orders: DemoOrder[],
) {
  const unitsByProduct = new Map<string, number>()

  for (const order of orders) {
    if (order.status === 'cancelled') continue
    for (const item of order.items) {
      unitsByProduct.set(
        item.productId,
        (unitsByProduct.get(item.productId) ?? 0) + item.quantity,
      )
    }
  }

  return products
    .map((product) => ({
      product,
      units: unitsByProduct.get(product.id) ?? 0,
    }))
    .filter((item) => item.units > 0)
    .sort((a, b) => b.units - a.units)
}
