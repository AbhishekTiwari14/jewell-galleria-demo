import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { sellableProducts } from '../data/products'
import type {
  DemoProduct,
  DemoProductStatus,
  ProductCategory,
  ProductColor,
  ProductSize,
} from '../data/productTypes'

export type AnalyticsPeriod = 'daily' | 'weekly' | 'monthly'
export type DemoOrderStatus =
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
export type DemoPaymentStatus = 'paid' | 'cod'

export interface CartLine {
  id: string
  productId: string
  quantity: number
  size: ProductSize
  color?: string
}

export interface DemoOrderLine {
  productId: string
  quantity: number
  size: ProductSize
}

export interface DemoOrder {
  id: string
  customerName: string
  createdAt: string
  shippingCity: string
  paymentStatus: DemoPaymentStatus
  status: DemoOrderStatus
  items: DemoOrderLine[]
  amountInPaise: number
}

export interface DemoData {
  cart: CartLine[]
  createdProducts: DemoProduct[]
  wishlistProductIds: string[]
  inventoryByVariant: Record<string, number>
  orders: DemoOrder[]
  analyticsPeriod: AnalyticsPeriod
}

interface DemoActions {
  addToCart: (line: Omit<CartLine, 'id'>) => string
  createProduct: (input: CreateDemoProductInput) => DemoProduct
  clearCart: () => void
  removeFromCart: (lineId: string) => void
  resetDemo: () => void
  setAnalyticsPeriod: (period: AnalyticsPeriod) => void
  setCartQuantity: (lineId: string, quantity: number) => void
  setVariantInventory: (
    productId: string,
    size: ProductSize,
    quantity: number,
    color?: string,
  ) => void
  toggleWishlist: (productId: string) => void
  updateOrderStatus: (orderId: string, status: DemoOrderStatus) => void
  updateProduct: (productId: string, input: UpdateDemoProductInput) => void
}

export type DemoStore = DemoData & DemoActions

export const LOW_STOCK_THRESHOLD = 8

export interface ProductVariantStock {
  color: string
  size: ProductSize
  quantity: number
}

export interface CreateDemoProductInput {
  catalogueName: string
  category: ProductCategory
  priceInPaise: number
  description: string
  image: string
  colors: ProductColor[]
  sizes: ProductSize[]
  publicationStatus: DemoProductStatus
  variants: ProductVariantStock[]
}

export type UpdateDemoProductInput = Omit<CreateDemoProductInput, 'variants'> & {
  variants: ProductVariantStock[]
}

export function getVariantKey(
  productId: string,
  size: ProductSize,
  color?: string,
) {
  return color ? `${productId}:${color}:${size}` : `${productId}:${size}`
}

function slugifyProductName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'demo-product'
}

function uniqueProductSlug(name: string, products: DemoProduct[]) {
  const base = slugifyProductName(name)
  const existing = new Set([
    ...sellableProducts.map((product) => product.slug),
    ...products.map((product) => product.slug),
  ])
  if (!existing.has(base)) return base

  let suffix = 2
  while (existing.has(`${base}-${suffix}`)) suffix += 1
  return `${base}-${suffix}`
}

function getCartLineId(line: Omit<CartLine, 'id'>) {
  return [line.productId, line.size, line.color ?? 'default'].join(':')
}

function createInitialInventory() {
  const quantities: Record<string, number> = {
    [getVariantKey('ovia-001', 'S')]: 15,
    [getVariantKey('ovia-001', 'M')]: 12,
    [getVariantKey('ovia-001', 'L')]: 10,
    [getVariantKey('ovia-002', 'S')]: 14,
    [getVariantKey('ovia-002', 'M')]: 12,
    [getVariantKey('ovia-002', 'L')]: 9,
    [getVariantKey('ovia-002', 'XL')]: 11,
    [getVariantKey('ovia-002', 'XXL')]: 7,
    [getVariantKey('ovia-003', 'M')]: 13,
    [getVariantKey('ovia-003', 'L')]: 10,
    [getVariantKey('ovia-003', 'XL')]: 9,
    [getVariantKey('ovia-003', 'XXL')]: 6,
    [getVariantKey('ovia-004', 'Free size')]: 5,
    [getVariantKey('ovia-005', 'S')]: 9,
    [getVariantKey('ovia-005', 'M')]: 7,
    [getVariantKey('ovia-006', 'S')]: 8,
    [getVariantKey('ovia-006', 'M')]: 4,
    [getVariantKey('ovia-007', 'S')]: 10,
    [getVariantKey('ovia-008', 'S')]: 11,
    [getVariantKey('ovia-009', 'S')]: 6,
    [getVariantKey('ovia-010', 'S')]: 12,
  }

  for (const product of sellableProducts) {
    for (const size of product.sizes) {
      const key = getVariantKey(product.id, size)
      quantities[key] ??= 10
    }
  }

  return quantities
}

function getOrderAmount(items: DemoOrderLine[]) {
  return items.reduce((total, item) => {
    const product = sellableProducts.find(
      (candidate) => candidate.id === item.productId,
    )
    return total + (product?.priceInPaise ?? 0) * item.quantity
  }, 0)
}

function createOrder(
  order: Omit<DemoOrder, 'amountInPaise'>,
): DemoOrder {
  return { ...order, amountInPaise: getOrderAmount(order.items) }
}

function createInitialOrders(): DemoOrder[] {
  return [
    createOrder({
      id: 'OVD-260813-018',
      customerName: 'Neha Kapoor',
      createdAt: '2026-08-13T08:35:00+05:30',
      shippingCity: 'Mumbai',
      paymentStatus: 'paid',
      status: 'confirmed',
      items: [{ productId: 'ovia-006', size: 'S', quantity: 1 }],
    }),
    createOrder({
      id: 'OVD-260813-017',
      customerName: 'Isha Mehta',
      createdAt: '2026-08-13T07:52:00+05:30',
      shippingCity: 'Pune',
      paymentStatus: 'cod',
      status: 'processing',
      items: [
        { productId: 'ovia-002', size: 'M', quantity: 1 },
        { productId: 'ovia-007', size: 'S', quantity: 1 },
      ],
    }),
    createOrder({
      id: 'OVD-260812-016',
      customerName: 'Rhea Nair',
      createdAt: '2026-08-12T18:20:00+05:30',
      shippingCity: 'Bengaluru',
      paymentStatus: 'paid',
      status: 'shipped',
      items: [{ productId: 'ovia-005', size: 'S', quantity: 1 }],
    }),
    createOrder({
      id: 'OVD-260812-015',
      customerName: 'Tara Shah',
      createdAt: '2026-08-12T16:08:00+05:30',
      shippingCity: 'Ahmedabad',
      paymentStatus: 'paid',
      status: 'delivered',
      items: [
        { productId: 'ovia-001', size: 'S', quantity: 1 },
        { productId: 'ovia-010', size: 'S', quantity: 1 },
      ],
    }),
    createOrder({
      id: 'OVD-260812-014',
      customerName: 'Maya Joshi',
      createdAt: '2026-08-12T13:45:00+05:30',
      shippingCity: 'Delhi',
      paymentStatus: 'cod',
      status: 'processing',
      items: [{ productId: 'ovia-003', size: 'M', quantity: 2 }],
    }),
    createOrder({
      id: 'OVD-260811-013',
      customerName: 'Sara Dsouza',
      createdAt: '2026-08-11T17:12:00+05:30',
      shippingCity: 'Goa',
      paymentStatus: 'paid',
      status: 'delivered',
      items: [{ productId: 'ovia-006', size: 'M', quantity: 1 }],
    }),
    createOrder({
      id: 'OVD-260811-012',
      customerName: 'Avni Rao',
      createdAt: '2026-08-11T11:30:00+05:30',
      shippingCity: 'Hyderabad',
      paymentStatus: 'paid',
      status: 'shipped',
      items: [
        { productId: 'ovia-004', size: 'Free size', quantity: 1 },
        { productId: 'ovia-008', size: 'S', quantity: 1 },
      ],
    }),
    createOrder({
      id: 'OVD-260810-011',
      customerName: 'Kiara Singh',
      createdAt: '2026-08-10T15:05:00+05:30',
      shippingCity: 'Chandigarh',
      paymentStatus: 'paid',
      status: 'delivered',
      items: [{ productId: 'ovia-009', size: 'S', quantity: 1 }],
    }),
    createOrder({
      id: 'OVD-260810-010',
      customerName: 'Diya Menon',
      createdAt: '2026-08-10T10:18:00+05:30',
      shippingCity: 'Kochi',
      paymentStatus: 'cod',
      status: 'cancelled',
      items: [{ productId: 'ovia-002', size: 'XL', quantity: 1 }],
    }),
  ]
}

export function createInitialDemoData(): DemoData {
  return {
    cart: [],
    createdProducts: [],
    wishlistProductIds: [],
    inventoryByVariant: createInitialInventory(),
    orders: createInitialOrders(),
    analyticsPeriod: 'daily',
  }
}

function migratePersistedData(
  persistedState: unknown,
  persistedVersion: number,
): DemoData {
  const defaults = createInitialDemoData()

  if (!persistedState || typeof persistedState !== 'object') {
    return defaults
  }

  const previous = persistedState as Partial<DemoData>
  return {
    ...defaults,
    cart: Array.isArray(previous.cart) ? previous.cart : defaults.cart,
    createdProducts:
      persistedVersion >= 4 && Array.isArray(previous.createdProducts)
        ? previous.createdProducts
        : defaults.createdProducts,
    wishlistProductIds: Array.isArray(previous.wishlistProductIds)
      ? previous.wishlistProductIds
      : defaults.wishlistProductIds,
    analyticsPeriod:
      persistedVersion >= 3 &&
      (previous.analyticsPeriod === 'daily' ||
        previous.analyticsPeriod === 'monthly' ||
        previous.analyticsPeriod === 'weekly')
        ? previous.analyticsPeriod
        : defaults.analyticsPeriod,
    inventoryByVariant:
      previous.inventoryByVariant &&
      typeof previous.inventoryByVariant === 'object'
        ? previous.inventoryByVariant
        : defaults.inventoryByVariant,
    orders:
      Array.isArray(previous.orders) &&
      previous.orders.every(
        (order) =>
          order &&
          typeof order === 'object' &&
          Array.isArray((order as DemoOrder).items),
      )
        ? previous.orders
        : defaults.orders,
  }
}

export const useDemoStore = create<DemoStore>()(
  persist(
    (set) => ({
      ...createInitialDemoData(),
      addToCart: (line) => {
        const id = getCartLineId(line)

        set((state) => {
          const existingLine = state.cart.find((item) => item.id === id)

          return {
            cart: existingLine
              ? state.cart.map((item) =>
                  item.id === id
                    ? { ...item, quantity: item.quantity + line.quantity }
                    : item,
                )
              : [...state.cart, { ...line, id }],
          }
        })

        return id
      },
      createProduct: (input) => {
        let createdProduct!: DemoProduct

        set((state) => {
          const now = new Date().toISOString()
          const id = `ovia-demo-${Date.now().toString(36)}`
          createdProduct = {
            id,
            slug: uniqueProductSlug(input.catalogueName, state.createdProducts),
            catalogueName: input.catalogueName.trim(),
            category: input.category,
            priceInPaise: Math.max(0, Math.trunc(input.priceInPaise)),
            description: input.description.trim(),
            image: input.image,
            colors: input.colors,
            sizes: input.sizes,
            publicationStatus: input.publicationStatus,
            status: 'demo-created',
            createdAt: now,
            updatedAt: now,
          }

          const variantInventory = Object.fromEntries(
            input.variants.map((variant) => [
              getVariantKey(id, variant.size, variant.color),
              Math.max(0, Math.trunc(variant.quantity)),
            ]),
          )

          return {
            createdProducts: [...state.createdProducts, createdProduct],
            inventoryByVariant: {
              ...state.inventoryByVariant,
              ...variantInventory,
            },
          }
        })

        return createdProduct
      },
      clearCart: () => set({ cart: [] }),
      removeFromCart: (lineId) =>
        set((state) => ({
          cart: state.cart.filter((line) => line.id !== lineId),
        })),
      resetDemo: () => set(createInitialDemoData()),
      setAnalyticsPeriod: (analyticsPeriod) => set({ analyticsPeriod }),
      setCartQuantity: (lineId, quantity) =>
        set((state) => ({
          cart:
            quantity <= 0
              ? state.cart.filter((line) => line.id !== lineId)
              : state.cart.map((line) =>
                  line.id === lineId
                    ? { ...line, quantity: Math.trunc(quantity) }
                    : line,
                ),
        })),
      setVariantInventory: (productId, size, quantity, color) =>
        set((state) => ({
          inventoryByVariant: {
            ...state.inventoryByVariant,
            [getVariantKey(productId, size, color)]: Math.max(
              0,
              Math.trunc(quantity),
            ),
          },
        })),
      toggleWishlist: (productId) =>
        set((state) => ({
          wishlistProductIds: state.wishlistProductIds.includes(productId)
            ? state.wishlistProductIds.filter((id) => id !== productId)
            : [...state.wishlistProductIds, productId],
        })),
      updateOrderStatus: (orderId, status) =>
        set((state) => ({
          orders: state.orders.map((order) =>
            order.id === orderId ? { ...order, status } : order,
          ),
        })),
      updateProduct: (productId, input) =>
        set((state) => {
          const retainedInventory = Object.fromEntries(
            Object.entries(state.inventoryByVariant).filter(
              ([key]) => !key.startsWith(`${productId}:`),
            ),
          )
          const variantInventory = Object.fromEntries(
            input.variants.map((variant) => [
              getVariantKey(productId, variant.size, variant.color),
              Math.max(0, Math.trunc(variant.quantity)),
            ]),
          )

          return {
            createdProducts: state.createdProducts.map((product) =>
              product.id === productId
                ? {
                    ...product,
                    catalogueName: input.catalogueName.trim(),
                    category: input.category,
                    priceInPaise: Math.max(0, Math.trunc(input.priceInPaise)),
                    description: input.description.trim(),
                    image: input.image,
                    colors: input.colors,
                    sizes: input.sizes,
                    publicationStatus: input.publicationStatus,
                    updatedAt: new Date().toISOString(),
                  }
                : product,
            ),
            inventoryByVariant: {
              ...retainedInventory,
              ...variantInventory,
            },
          }
        }),
    }),
    {
      name: 'ovia-demo:v1',
      storage: createJSONStorage(() => localStorage),
      version: 4,
      migrate: (persistedState, persistedVersion) =>
        migratePersistedData(persistedState, persistedVersion),
      partialize: ({
        cart,
        createdProducts,
        wishlistProductIds,
        inventoryByVariant,
        orders,
        analyticsPeriod,
      }) => ({
        cart,
        createdProducts,
        wishlistProductIds,
        inventoryByVariant,
        orders,
        analyticsPeriod,
      }),
    },
  ),
)
