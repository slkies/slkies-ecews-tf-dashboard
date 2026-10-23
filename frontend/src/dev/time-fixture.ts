/** Synthetic time-metrics figures for the harness and tests. */
import type { TimeMetrics } from '@/core/overview'
import type { KmPoint, UnsuppCurve } from '@/pages/time-metrics-page'

const d = (median: number, q1: number, q3: number, wlo: number, whi: number, n: number) =>
  ({ n, median, q1, q3, wlo, whi, mean: median, min: wlo, max: whi })

export const TIME: TimeMetrics = {
  time_to_eac: d(25, 9, 61, 0, 140, 3239),
  eac_lead_time: d(170, 110, 240, 10, 420, 2104),
  time_to_resuppression: d(173, 120, 250, 40, 440, 1479),
  months_unsuppressed: d(8, 3.1, 13.4, 0, 28, 4228),
  time_to_first_vl: d(8.7, 5.6, 16.1, 0, 32, 4070),
  time_to_first_unsupp: d(2.4, 0.9, 6.1, 0, 14, 4029),
}

export const KM: KmPoint[] = Array.from({ length: 73 }, (_, i) => {
  const t = i * 5
  return { t, survival: Math.max(0.2, Math.exp(-Math.max(0, t - 60) / 240)), at_risk: 3239 - i * 30 }
})

export const UC: UnsuppCurve = {
  'Started ART ≤2017 (pre / early T&T)': { n: 1375, median: 5.8,
    points: Array.from({ length: 61 }, (_, i) => ({ t: i / 4, pct: Math.min(100, 100 * (1 - Math.exp(-(i / 4) / 7))) })) },
  'Started ART ≥2018 (VL era)': { n: 2654, median: 1.4,
    points: Array.from({ length: 61 }, (_, i) => ({ t: i / 4, pct: Math.min(100, 100 * (1 - Math.exp(-(i / 4) / 1.8))) })) },
}
