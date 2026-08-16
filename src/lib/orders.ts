import type { DemoOrderStatus } from '../store/demoStore'

export const orderStatusLabels: Record<DemoOrderStatus, string> = {
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}
