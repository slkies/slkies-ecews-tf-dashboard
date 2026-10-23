/** Synthetic plan counts and client rows. No real data; keys are placeholders. */
import type { PlanCount } from '@/pages/plans-page'
import type { ClientRow } from '@/pages/worklists-page'

export const PLANS: PlanCount[] = [
  { plan: 'D. Repeat VL in 6 months, continue adherence counselling', n: 1290, pct: 27.8, n_female: 840, n_male: 431 },
  { plan: 'C. Commence EAC, document register and EMR', n: 1012, pct: 21.8, n_female: 655, n_male: 350 },
  { plan: 'B. Complete EAC, update register and EMR', n: 688, pct: 14.8, n_female: 460, n_male: 221 },
  { plan: 'E. Track client', n: 540, pct: 11.7, n_female: 330, n_male: 204 },
  { plan: 'F. Refer to Drug Therapeutic Committee, update register and EMR', n: 412, pct: 8.9, n_female: 251, n_male: 158 },
  { plan: 'A. Commence EAC, update register and EMR', n: 377, pct: 8.1, n_female: 240, n_male: 135 },
  { plan: 'H. No further action, confirm outcome in register and EMR', n: 286, pct: 6.2, n_female: 170, n_male: 113 },
  { plan: 'G. Review manually', n: 28, pct: 0.6, n_female: 15, n_male: 10 },
]

export const PLAN_ROWS: ClientRow[] = Array.from({ length: 24 }, (_, i) => ({
  episode: `0.${String(800000000000 + i)}|2026-03-15`, sn: `0.${String(800000000000 + i)}`,
  state: ['Delta', 'Ekiti', 'Osun'][i % 3]!, lga: 'LGA 1', facility: `Facility ${String.fromCharCode(65 + (i % 7))}`,
  sex: i % 3 ? 'Female' : 'Male', age: 18 + i, art_status: 'Active', idx_vl: 2400 + i * 113,
  recv_date: '2026-03-28', idx_samp: '2026-03-15', idx_date: '2026-03-15', sessions: 3, eac_completed: true,
  fu_vl: 1500 + i * 41, fu_samp: '2026-07-02', fu_date: '2026-07-19', still_unsuppressed: true, switched: false,
  months_unsuppressed: 7, treatment_plan: 'F. Refer to Drug Therapeutic Committee, update register and EMR',
}))
