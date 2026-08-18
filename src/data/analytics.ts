import type { AnalyticsPeriod } from '../store/demoStore'

export interface RevenuePoint {
  label: string
  revenueInPaise: number
}

export interface AnalyticsInsight {
  productId: string
  eyebrow: string
  title: string
  description: string
}

export interface AnalyticsSnapshot {
  label: string
  range: string
  revenueInPaise: number
  sessions: number
  productViews: number
  addToCart: number
  checkout: number
  orders: number
  conversionRate: number
  revenueSeries: RevenuePoint[]
  insights: AnalyticsInsight[]
}

export const analyticsPeriods: Array<{
  value: AnalyticsPeriod
  label: string
}> = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

export const analyticsSnapshots: Record<AnalyticsPeriod, AnalyticsSnapshot> = {
  daily: {
    label: 'Today',
    range: '17 August 2026',
    revenueInPaise: 276_600,
    sessions: 612,
    productViews: 392,
    addToCart: 87,
    checkout: 41,
    orders: 9,
    conversionRate: 1.47,
    revenueSeries: [
      { label: '9 am', revenueInPaise: 22_000 },
      { label: '12 pm', revenueInPaise: 51_000 },
      { label: '3 pm', revenueInPaise: 75_000 },
      { label: '6 pm', revenueInPaise: 63_100 },
      { label: '9 pm', revenueInPaise: 65_500 },
    ],
    insights: [
      {
        productId: 'jg-real-010',
        eyebrow: 'Product interest',
        title: 'Pear Drop Statement Necklace is receiving the highest demo product views.',
        description:
          'This illustrative signal uses fabricated browsing activity for the selected period.',
      },
      {
        productId: 'jg-real-008',
        eyebrow: 'Stock watch',
        title: 'Oval and Marquise Bracelet is approaching its demo low-stock threshold.',
        description:
          'This illustrative stock prompt uses demo inventory and is not a real Jewellgalleria alert.',
      },
      {
        productId: 'jg-real-009',
        eyebrow: 'Funnel opportunity',
        title: 'Demo drop-off is highest between product view and add to bag.',
        description:
          'This is a fabricated demo signal intended to illustrate a merchandising opportunity.',
      },
    ],
  },
  weekly: {
    label: 'This week',
    range: '11–17 August 2026',
    revenueInPaise: 1_864_200,
    sessions: 4_238,
    productViews: 2_870,
    addToCart: 624,
    checkout: 289,
    orders: 52,
    conversionRate: 1.23,
    revenueSeries: [
      { label: 'Mon', revenueInPaise: 229_400 },
      { label: 'Tue', revenueInPaise: 265_700 },
      { label: 'Wed', revenueInPaise: 198_800 },
      { label: 'Thu', revenueInPaise: 287_600 },
      { label: 'Fri', revenueInPaise: 316_200 },
      { label: 'Sat', revenueInPaise: 348_900 },
      { label: 'Sun', revenueInPaise: 217_600 },
    ],
    insights: [
      {
        productId: 'jg-real-009',
        eyebrow: 'Style momentum',
        title: 'Heritage Jhumka Earrings is receiving the highest demo product views.',
        description:
          'This illustrative signal uses fabricated browsing activity for the selected period.',
      },
      {
        productId: 'jg-real-008',
        eyebrow: 'Stock watch',
        title: 'Oval and Marquise Bracelet is approaching its demo low-stock threshold.',
        description:
          'This illustrative stock prompt uses demo inventory and is not a real Jewellgalleria alert.',
      },
      {
        productId: 'jg-real-001',
        eyebrow: 'Funnel opportunity',
        title: 'Demo drop-off is highest between product view and add to bag.',
        description:
          'This fabricated funnel pattern illustrates where a real team might investigate merchandising performance.',
      },
    ],
  },
  monthly: {
    label: 'This month',
    range: 'August 2026',
    revenueInPaise: 7_468_900,
    sessions: 18_420,
    productViews: 12_560,
    addToCart: 2_715,
    checkout: 1_214,
    orders: 213,
    conversionRate: 1.16,
    revenueSeries: [
      { label: 'Week 1', revenueInPaise: 1_746_300 },
      { label: 'Week 2', revenueInPaise: 1_832_800 },
      { label: 'Week 3', revenueInPaise: 2_011_400 },
      { label: 'Week 4', revenueInPaise: 1_878_400 },
    ],
    insights: [
      {
        productId: 'jg-real-010',
        eyebrow: 'Category interest',
        title: 'Pear Drop Statement Necklace is receiving the highest demo product views.',
        description:
          'This illustrative signal uses fabricated browsing activity for the selected period.',
      },
      {
        productId: 'jg-real-008',
        eyebrow: 'Stock watch',
        title: 'Oval and Marquise Bracelet is approaching its demo low-stock threshold.',
        description:
          'This illustrative stock prompt uses demo inventory and is not a real Jewellgalleria alert.',
      },
      {
        productId: 'jg-real-013',
        eyebrow: 'Funnel opportunity',
        title: 'Demo drop-off is highest between product view and add to bag.',
        description:
          'This fabricated funnel pattern illustrates where a real team might investigate merchandising performance.',
      },
    ],
  },
}
