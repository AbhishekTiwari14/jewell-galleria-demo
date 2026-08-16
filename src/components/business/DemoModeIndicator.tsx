import { FlaskConical } from 'lucide-react'

export function DemoModeIndicator() {
  return (
    <div
      aria-label="Business data is simulated"
      className="inline-flex items-center gap-1.5 rounded-full border border-ovia-primary/25 bg-ovia-blush/45 px-2.5 py-1 text-[0.6875rem] font-semibold tracking-[0.08em] text-ovia-plum uppercase"
      role="status"
    >
      <FlaskConical aria-hidden="true" size={12} strokeWidth={1.8} />
      <span>Demo mode</span>
      <span aria-hidden="true">•</span>
      <span className="font-medium normal-case tracking-normal">
        Simulated business data
      </span>
    </div>
  )
}

