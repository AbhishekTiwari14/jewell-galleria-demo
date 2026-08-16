import { createBrowserRouter } from 'react-router-dom'

import { BusinessLayout } from './BusinessLayout'
import { CustomerLayout } from './CustomerLayout'
import { CartPage } from '../pages/CartPage'
import { CheckoutPage } from '../pages/CheckoutPage'
import { FoundationPage } from '../pages/FoundationPage'
import { HomePage } from '../pages/HomePage'
import { ProductRoutePage } from '../pages/ProductRoutePage'
import { BusinessDashboardPage } from '../pages/business/BusinessDashboardPage'
import { BusinessInventoryPage } from '../pages/business/BusinessInventoryPage'
import { BusinessOrdersPage } from '../pages/business/BusinessOrdersPage'
import { BusinessProductEditorPage } from '../pages/business/BusinessProductEditorPage'
import { BusinessProductsPage } from '../pages/business/BusinessProductsPage'

export const router = createBrowserRouter([
  {
    element: <CustomerLayout />,
    children: [
      {
        path: '/',
        element: <HomePage />,
      },
      { path: '/product/:slug', element: <ProductRoutePage /> },
      { path: '/cart', element: <CartPage /> },
      { path: '/checkout', element: <CheckoutPage /> },
    ],
  },
  {
    path: '/business',
    element: <BusinessLayout />,
    children: [
      {
        index: true,
        element: <BusinessDashboardPage />,
      },
      {
        path: 'products',
        element: <BusinessProductsPage />,
      },
      {
        path: 'products/new',
        element: <BusinessProductEditorPage />,
      },
      {
        path: 'products/:productId',
        element: <BusinessProductEditorPage />,
      },
      {
        path: 'inventory',
        element: <BusinessInventoryPage />,
      },
      {
        path: 'orders',
        element: <BusinessOrdersPage />,
      },
      {
        path: 'analytics',
        lazy: async () => {
          const { BusinessAnalyticsPage } = await import(
            '../pages/business/BusinessAnalyticsPage'
          )
          return { Component: BusinessAnalyticsPage }
        },
      },
    ],
  },
  {
    path: '*',
    element: (
      <FoundationPage
        area="customer"
        description="The page you’re looking for isn’t available. Return to the Ovia edit to keep browsing."
        title="Page not found"
      />
    ),
  },
])
