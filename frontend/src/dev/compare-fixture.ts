/** Synthetic line-list snapshots and a comparison between two of them. No real data. */
import type { Comparison, Upload } from '@/pages/compare-page'

export const UPLOADS: Upload[] = [
  { id: 14, filename: 'TF_linelist_week41.xlsx', as_of: '2026-10-10', uploaded_at: '2026-10-11T08:12:00', status: 'ready', is_current: true, n_cohort: 4633 },
  { id: 13, filename: 'TF_linelist_week41.xlsx', as_of: '2026-10-10', uploaded_at: '2026-10-10T17:40:00', status: 'ready', n_cohort: 4633 },
  { id: 12, filename: 'TF_linelist_week37.xlsx', as_of: '2026-09-12', uploaded_at: '2026-09-13T09:02:00', status: 'ready', n_cohort: 4410 },
  { id: 11, filename: 'TF_linelist_broken.xlsx', as_of: '2026-09-05', uploaded_at: '2026-09-05T10:00:00', status: 'failed', n_cohort: null },
]

export const COMPARISON: Comparison = {
  ok: true,
  a: { id: 12, filename: 'TF_linelist_week37.xlsx', as_of: '2026-09-12', n: 4410 },
  b: { id: 14, filename: 'TF_linelist_week41.xlsx', as_of: '2026-10-10', n: 4633 },
  days_between: 28, back_dated: false,
  flow: { new: 241, gone: 18, carried: 4392 },
  metrics: [
    { metric: 'Commenced EAC', a: 3120, b: 3302, delta: 182, retreat: false, explained_by_date: false },
    { metric: 'Reached session 2', a: 2610, b: 2788, delta: 178, retreat: false, explained_by_date: false },
    { metric: 'Reached session 3', a: 2204, b: 2391, delta: 187, retreat: false, explained_by_date: false },
    { metric: 'Completed EAC', a: 1890, b: 2051, delta: 161, retreat: false, explained_by_date: false },
    { metric: 'Post-EAC VL taken', a: 1402, b: 1388, delta: -14, retreat: true, explained_by_date: false },
    { metric: 'Follow-up VL result', a: 1210, b: 1296, delta: 86, retreat: false, explained_by_date: false },
    { metric: 'Re-suppressed', a: 905, b: 978, delta: 73, retreat: false, explained_by_date: false },
    { metric: 'Still >= 1,000', a: 305, b: 318, delta: 13, retreat: false, explained_by_date: false },
    { metric: 'Switched regimen', a: 88, b: 88, delta: 0, retreat: false, explained_by_date: false },
  ],
}
