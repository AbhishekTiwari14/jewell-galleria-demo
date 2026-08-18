export function formatInr(priceInPaise: number | null) {
  if (priceInPaise === null) return 'Price unavailable'

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(priceInPaise / 100)
}

