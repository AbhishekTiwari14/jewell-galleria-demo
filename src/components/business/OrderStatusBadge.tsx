import { classNames } from '../../lib/classNames'
import { orderStatusLabels } from '../../lib/orders'
import type { DemoOrderStatus } from '../../store/demoStore'

const statusClasses: Record<DemoOrderStatus, string> = {
  confirmed: 'bg-[#f2e9f1] text-ovia-plum',
  processing: 'bg-[#fff3dc] text-ovia-warning',
  shipped: 'bg-[#e7eff8] text-[#355f8a]',
  delivered: 'bg-[#e6f2eb] text-ovia-success',
  cancelled: 'bg-[#f9e8ea] text-ovia-danger',
}

export function OrderStatusBadge({ status }: { status: DemoOrderStatus }) {
  return (
    <span
      className={classNames(
        'inline-flex rounded-full px-2.5 py-1 text-xs font-bold',
        statusClasses[status],
      )}
    >
      {orderStatusLabels[status]}
    </span>
  )
}
