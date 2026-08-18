import type { DemoOrderStatus } from '../store/demoStore'

export const orderStatusLabels: Record<DemoOrderStatus, string> = {
  new: 'New',
  confirmed: 'Confirmed',
  packed: 'Packed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}
