import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { sellableProducts } from '../data/products'
import {
  getProductSelections,
  type DemoProduct,
  type DemoProductStatus,
  type ProductAttribute,
  type ProductCategory,
  type CommerceProduct,
  type ProductImageGallery,
  type ProductSelection,
  type ProductVariantOption,
} from '../data/productTypes'

export type AnalyticsPeriod = 'daily' | 'weekly' | 'monthly'
export type DemoOrderStatus =
  | 'new'
  | 'confirmed'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
export type DemoPaymentStatus = 'paid' | 'cod' | 'demo'

export interface CartLine {
  id: string
  productId: string
  quantity: number
  selection: ProductSelection
}

export interface DemoOrderLine {
  productId: string
  quantity: number
  selection: ProductSelection
}

export interface DemoOrder {
  id: string
  customerName: string
  createdAt: string
  shippingCity: string
  paymentStatus: DemoPaymentStatus
  status: DemoOrderStatus
  items: DemoOrderLine[]
  amountInPaise: number | null
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
  placeDemoOrder: (input: PlaceDemoOrderInput) => DemoOrder
  removeFromCart: (lineId: string) => void
  resetDemo: () => void
  setAnalyticsPeriod: (period: AnalyticsPeriod) => void
  setCartQuantity: (lineId: string, quantity: number) => void
  setVariantInventory: (
    productId: string,
    selection: ProductSelection,
    quantity: number,
  ) => void
  toggleWishlist: (productId: string) => void
  updateOrderStatus: (orderId: string, status: DemoOrderStatus) => void
  updateProduct: (productId: string, input: UpdateDemoProductInput) => void
}

export type DemoStore = DemoData & DemoActions

export const LOW_STOCK_THRESHOLD = 8

export interface ProductVariantStock {
  selection: ProductSelection
  quantity: number
}

export interface CreateDemoProductInput {
  catalogueName: string
  category: ProductCategory
  priceInPaise: number
  description: string
  images: string[]
  attributes: ProductAttribute[]
  variantOptions: ProductVariantOption[]
  publicationStatus: DemoProductStatus
  variants: ProductVariantStock[]
}

export interface PlaceDemoOrderInput {
  customerName: string
  shippingCity: string
}

export type UpdateDemoProductInput = CreateDemoProductInput

function canonicalSelection(selection: ProductSelection) {
  return Object.entries(selection)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([optionId, value]) =>
        `${encodeURIComponent(optionId)}=${encodeURIComponent(value)}`,
    )
    .join('&')
}

export function getVariantKey(
  productId: string,
  selection: ProductSelection = {},
) {
  return `${productId}:${canonicalSelection(selection) || 'base'}`
}

function slugifyProductName(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'demo-product'
  )
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
  return getVariantKey(line.productId, line.selection)
}

function createInitialInventory() {
  const quantities: Record<string, number> = {}

  sellableProducts.forEach((product, productIndex) => {
    getProductSelections(product).forEach((selection, selectionIndex) => {
      quantities[getVariantKey(product.id, selection)] =
        7 + ((productIndex * 3 + selectionIndex * 2) % 9)
    })
  })

  return quantities
}

function getOrderAmount(
  items: DemoOrderLine[],
  commerceProducts: readonly CommerceProduct[] = sellableProducts,
) {
  return items.reduce<number | null>((total, item) => {
    if (total === null) return null
    const product = commerceProducts.find(
      (candidate) => candidate.id === item.productId,
    )
    if (product?.priceInPaise === null || product?.priceInPaise === undefined) {
      return null
    }
    return total + product.priceInPaise * item.quantity
  }, 0)
}

function createDemoOrderId(orders: DemoOrder[], createdAt: Date) {
  const date = [
    createdAt.getFullYear().toString().slice(-2),
    String(createdAt.getMonth() + 1).padStart(2, '0'),
    String(createdAt.getDate()).padStart(2, '0'),
  ].join('')
  const prefix = `JGD-D${date}-`
  const sequence =
    orders.filter((order) => order.id.startsWith(prefix)).length + 1
  return `${prefix}${String(sequence).padStart(3, '0')}`
}

function createOrder(order: Omit<DemoOrder, 'amountInPaise'>): DemoOrder {
  return { ...order, amountInPaise: getOrderAmount(order.items) }
}

function createInitialOrders(): DemoOrder[] {
  return [
    createOrder({
      id: 'JGD-260817-018',
      customerName: 'Neha Kapoor',
      createdAt: '2026-08-17T08:35:00+05:30',
      shippingCity: 'Mumbai',
      paymentStatus: 'paid',
      status: 'confirmed',
      items: [{ productId: 'jg-real-010', selection: {}, quantity: 1 }],
    }),
    createOrder({
      id: 'JGD-260817-017',
      customerName: 'Isha Mehta',
      createdAt: '2026-08-17T07:52:00+05:30',
      shippingCity: 'Pune',
      paymentStatus: 'cod',
      status: 'packed',
      items: [
        { productId: 'jg-real-009', selection: {}, quantity: 1 },
        { productId: 'jg-real-001', selection: {}, quantity: 1 },
      ],
    }),
    createOrder({
      id: 'JGD-260816-016',
      customerName: 'Rhea Nair',
      createdAt: '2026-08-16T18:20:00+05:30',
      shippingCity: 'Bengaluru',
      paymentStatus: 'paid',
      status: 'shipped',
      items: [{ productId: 'jg-real-013', selection: {}, quantity: 1 }],
    }),
    createOrder({
      id: 'JGD-260816-015',
      customerName: 'Tara Shah',
      createdAt: '2026-08-16T16:08:00+05:30',
      shippingCity: 'Ahmedabad',
      paymentStatus: 'paid',
      status: 'delivered',
      items: [
        { productId: 'jg-real-005', selection: {}, quantity: 1 },
        { productId: 'jg-real-008', selection: {}, quantity: 1 },
      ],
    }),
    createOrder({
      id: 'JGD-260815-014',
      customerName: 'Maya Joshi',
      createdAt: '2026-08-15T13:45:00+05:30',
      shippingCity: 'Delhi',
      paymentStatus: 'cod',
      status: 'packed',
      items: [{ productId: 'jg-real-006', selection: {}, quantity: 2 }],
    }),
    createOrder({
      id: 'JGD-260815-013',
      customerName: 'Sara Dsouza',
      createdAt: '2026-08-15T11:12:00+05:30',
      shippingCity: 'Goa',
      paymentStatus: 'paid',
      status: 'delivered',
      items: [{ productId: 'jg-real-015', selection: {}, quantity: 1 }],
    }),
    createOrder({
      id: 'JGD-260814-012',
      customerName: 'Avni Rao',
      createdAt: '2026-08-14T11:30:00+05:30',
      shippingCity: 'Hyderabad',
      paymentStatus: 'paid',
      status: 'shipped',
      items: [
        { productId: 'jg-real-004', selection: {}, quantity: 1 },
        { productId: 'jg-real-011', selection: {}, quantity: 1 },
      ],
    }),
    createOrder({
      id: 'JGD-260814-011',
      customerName: 'Kiara Singh',
      createdAt: '2026-08-14T10:05:00+05:30',
      shippingCity: 'Chandigarh',
      paymentStatus: 'paid',
      status: 'delivered',
      items: [
        {
          productId: 'jg-demo-001',
          selection: { 'ring-size': '7' },
          quantity: 1,
        },
      ],
    }),
    createOrder({
      id: 'JGD-260813-010',
      customerName: 'Diya Menon',
      createdAt: '2026-08-13T10:18:00+05:30',
      shippingCity: 'Kochi',
      paymentStatus: 'cod',
      status: 'cancelled',
      items: [{ productId: 'jg-real-009', selection: {}, quantity: 1 }],
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

  if (
    (persistedVersion !== 2 && persistedVersion !== 3) ||
    !persistedState ||
    typeof persistedState !== 'object'
  ) {
    return defaults
  }

  const previous = persistedState as Partial<DemoData>
  return {
    ...defaults,
    cart: Array.isArray(previous.cart) ? previous.cart : defaults.cart,
    createdProducts: Array.isArray(previous.createdProducts)
      ? previous.createdProducts
      : defaults.createdProducts,
    wishlistProductIds: Array.isArray(previous.wishlistProductIds)
      ? previous.wishlistProductIds
      : defaults.wishlistProductIds,
    analyticsPeriod:
      previous.analyticsPeriod === 'daily' ||
      previous.analyticsPeriod === 'weekly' ||
      previous.analyticsPeriod === 'monthly'
        ? previous.analyticsPeriod
        : defaults.analyticsPeriod,
    inventoryByVariant:
      previous.inventoryByVariant &&
      typeof previous.inventoryByVariant === 'object'
        ? previous.inventoryByVariant
        : defaults.inventoryByVariant,
    orders: Array.isArray(previous.orders)
      ? previous.orders.map((order) => {
          const previousStatus = (order as unknown as { status: string }).status
          return {
            ...order,
            status: previousStatus === 'processing' ? 'packed' : previousStatus,
          } as DemoOrder
        })
      : defaults.orders,
  }
}

function asGallery(images: string[]): ProductImageGallery {
  const filtered = images.filter(Boolean)
  if (filtered.length === 0) {
    throw new Error('A demo product requires at least one image.')
  }
  return filtered as [string, ...string[]]
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
          const id = `jg-created-${Date.now().toString(36)}`
          const catalogueName = input.catalogueName.trim()
          const priceInPaise = Math.max(0, Math.trunc(input.priceInPaise))
          createdProduct = {
            id,
            slug: uniqueProductSlug(catalogueName, state.createdProducts),
            name: catalogueName,
            catalogueName,
            nameProvenance: 'generated-demo',
            category: input.category,
            price: priceInPaise / 100,
            priceInPaise,
            priceStatus: 'demo',
            description: input.description.trim(),
            images: asGallery(input.images),
            isDemoProduct: true,
            attributes: input.attributes,
            variantOptions: input.variantOptions,
            publicationStatus: input.publicationStatus,
            status: 'demo-created',
            createdAt: now,
            updatedAt: now,
          }

          const variantInventory = Object.fromEntries(
            input.variants.map((variant) => [
              getVariantKey(id, variant.selection),
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
      placeDemoOrder: (input) => {
        let placedOrder!: DemoOrder

        set((state) => {
          if (state.cart.length === 0) {
            throw new Error('A demo order requires at least one cart item.')
          }

          const createdAt = new Date()
          const items = state.cart.map(({ productId, quantity, selection }) => ({
            productId,
            quantity,
            selection,
          }))
          placedOrder = {
            id: createDemoOrderId(state.orders, createdAt),
            customerName: input.customerName.trim(),
            createdAt: createdAt.toISOString(),
            shippingCity: input.shippingCity.trim(),
            paymentStatus: 'demo',
            status: 'new',
            items,
            amountInPaise: getOrderAmount(items, [
              ...sellableProducts,
              ...state.createdProducts,
            ]),
          }

          return {
            cart: [],
            orders: [placedOrder, ...state.orders],
          }
        })

        return placedOrder
      },
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
      setVariantInventory: (productId, selection, quantity) =>
        set((state) => ({
          inventoryByVariant: {
            ...state.inventoryByVariant,
            [getVariantKey(productId, selection)]: Math.max(
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
              getVariantKey(productId, variant.selection),
              Math.max(0, Math.trunc(variant.quantity)),
            ]),
          )

          return {
            createdProducts: state.createdProducts.map((product) =>
              product.id === productId
                ? {
                    ...product,
                    name: input.catalogueName.trim(),
                    catalogueName: input.catalogueName.trim(),
                    category: input.category,
                    price:
                      Math.max(0, Math.trunc(input.priceInPaise)) / 100,
                    priceInPaise: Math.max(
                      0,
                      Math.trunc(input.priceInPaise),
                    ),
                    description: input.description.trim(),
                    images: asGallery(input.images),
                    attributes: input.attributes,
                    variantOptions: input.variantOptions,
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
      name: 'jewellgalleria-demo:v1',
      storage: createJSONStorage(() => localStorage),
      version: 3,
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
