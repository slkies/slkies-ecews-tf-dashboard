/** Synthetic clients for Client search and the record panel. Keys are made up; no real data. */
import type { ClientRecord } from '@/components/client-record'
import type { ClientMatch } from '@/pages/client-search-page'

export const MATCHES: ClientMatch[] = [
  { sn: '0.123456789012345678', facility: 'Delta Facility A', state: 'Delta', sex: 'Female', age: 34, art_status: 'Active', idx_vl: 48200, recv_date: '2026-08-21', idx_date: '2026-08-12', episodes: 2 },
  { sn: '0.223456789012345678', facility: 'Delta Facility A', state: 'Delta', sex: 'Female', age: 36, art_status: 'Active', idx_vl: 3100, recv_date: '2026-07-02', idx_date: '2026-06-25', episodes: 1 },
  { sn: '0.323456789012345678', facility: 'Delta Facility A', state: 'Delta', sex: 'Female', age: 31, art_status: 'Transferred out', idx_vl: 125000, recv_date: '2026-03-14', idx_date: '2026-03-05', episodes: 1 },
]

export const RECORD: ClientRecord = {
  sn: '0.123456789012345678', state: 'Delta', lga: 'Warri South', facility: 'Delta Facility A',
  sex: 'Female', age: 34, art_status: 'Active', regimen_line: '1st line', regimen: 'TDF-3TC-DTG',
  art_year: 2016, exit_date: null,
  last_pickup: '2026-09-02', days_refill: 180, next_visit: '2027-03-01',
  first_vl: 40, first_vl_date: '2017-04-11', first_high_vl: 640, first_high_date: '2023-02-08',
  episodes: [
    {
      episode: '0.123456789012345678|2026-08-12', idx_vl: 48200, idx_samp: '2026-08-12', recv_date: '2026-08-21', idx_date: '2026-08-12',
      fy_quarter: 'FY26Q4', s1_date: '2026-08-29', s2_date: '2026-09-26', s3_date: null, s4_date: null, eac1: true, eac2: true, eac3: false, eac_extended: false,
      eac_completed: false, sessions: 2, post_eac_vl: false, fu_samp: null, fu_date: null, fu_vl: null,
      awaiting_result: false, resuppressed: false, llv: false, still_unsuppressed: false, switched: false,
      months_unsuppressed: 2, treatment_plan: 'B. Complete EAC, update register and EMR', worklists: ['eac_incomplete'],
    },
    {
      episode: '0.123456789012345678|2025-09-03', idx_vl: 5400, idx_samp: '2025-09-03', recv_date: '2025-09-15', idx_date: '2025-09-03',
      fy_quarter: 'FY25Q4', s1_date: '2025-09-24', s2_date: '2025-10-22', s3_date: '2025-11-19', s4_date: '2026-03-02', eac1: true, eac2: true, eac3: true, eac_extended: false,
      eac_completed: true, sessions: 3, post_eac_vl: true, fu_samp: '2026-01-20', fu_date: '2026-02-02', fu_vl: 38,
      awaiting_result: false, resuppressed: true, llv: false, still_unsuppressed: false, switched: false,
      months_unsuppressed: null, treatment_plan: 'D. Repeat VL in 6 months, continue adherence counselling', worklists: [],
    },
  ],
}
