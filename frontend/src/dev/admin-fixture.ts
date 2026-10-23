/** Synthetic admin data: placeholder accounts at example.org, no real people or clients. */
import type { User } from '@/pages/admin-users'
import type { DqRow } from '@/pages/data-quality-page'

export const ME_EMAIL = 'admin@example.org'

export const USERS: User[] = [
  { id: 1, username: 'admin', email: ME_EMAIL, full_name: 'Harness Admin', role: 'admin', scope_state: null, scope_facility: null, is_active: true, created_at: '2026-01-05T09:00:00' },
  { id: 2, username: 'analyst.one', email: 'analyst.one@example.org', full_name: 'Analyst One', role: 'analyst', scope_state: null, scope_facility: null, is_active: true, created_at: '2026-02-01T09:00:00' },
  { id: 3, username: 'viewer.delta', email: 'viewer.delta@example.org', full_name: 'Viewer Delta', role: 'viewer', scope_state: 'Delta', scope_facility: null, is_active: true, created_at: '2026-03-01T09:00:00' },
  { id: 4, username: 'leaver', email: 'leaver@example.org', full_name: 'Former Staff', role: 'viewer', scope_state: 'Osun', scope_facility: 'Osun Facility B', is_active: false, created_at: '2026-03-09T09:00:00' },
]

export const DQ: DqRow[] = [
  { sheet: 'EAC_May', check_name: 'Success-censored follow-up VL', severity: 'critical', n_records: 4120, detail: 'Every follow-up VL on this sheet is below 1,000, so failures were removed before export. Outcomes from it are excluded.' },
  { sheet: null, check_name: 'Sample drawn before EAC session 1', severity: 'high', n_records: 357, detail: 'The follow-up sample predates EAC, so it cannot measure the effect of EAC.' },
  { sheet: null, check_name: 'Implausible viral load', severity: 'high', n_records: 14, detail: 'Values above 10 million copies/mL, usually a data-entry error.' },
  { sheet: null, check_name: 'EAC completed, no post-EAC VL sample', severity: 'medium', n_records: 683, detail: 'Completed 30 or more days ago with no repeat sample.' },
  { sheet: 'EAC_June', check_name: 'Header casing drift (tolerated)', severity: 'low', n_records: 4, detail: 'Column names differ only in case; read correctly.' },
  { sheet: null, check_name: 'EAC session dates out of order', severity: 'clear', n_records: 0, detail: 'Session 2 dated before session 1.' },
  { sheet: 'EAC_July', check_name: 'Missing client key (S/N)', severity: 'clear', n_records: 0, detail: 'Rows with no client key cannot be joined.' },
]

export const UPLOADS = [
  { id: 9, filename: 'tf_deidentified_2026-10-17.zip', as_of: '2026-10-17', uploaded_at: '2026-10-18T08:12:00', status: 'ready', n_cohort: 4633, is_current: true, error: null },
  { id: 8, filename: 'tf_deidentified_2026-10-03.zip', as_of: '2026-10-03', uploaded_at: '2026-10-04T09:40:00', status: 'ready', n_cohort: 4410, is_current: false, error: null },
  { id: 7, filename: 'broken.xlsx', as_of: '2026-09-20', uploaded_at: '2026-09-21T10:00:00', status: 'failed', n_cohort: null, is_current: false, error: 'Ingest failed: no treatment sheet' },
]

export const DIAG = {
  ok: true, label: 'v1.0+harness', snapshot: { filename: 'tf_deidentified_2026-10-17.zip', as_of: '2026-10-17', rows: 4633 },
  columns: [
    { column: 'lga_res', label: 'LGA of residence', powers: 'the map and the LGA filter', filled: 4410, pct: 95.2, status: 'ok' },
    { column: 'fu_samp', label: 'Follow-up sample date', powers: 'Time metrics, DTC review', filled: 1900, pct: 41.0, status: 'partial' },
    { column: 'switch_date', label: 'Switch date', powers: 'time to switch', filled: 0, pct: 0, status: 'empty' },
  ],
}

export const USAGE = {
  gap_minutes: 30,
  people: [
    { username: 'analyst.one', email: 'analyst.one@example.org', role: 'analyst', scope_state: null, is_active: true, sessions: 14, requests: 620, active_days: 9, last_seen: '2026-10-22T16:05:00', minutes: 212 },
    { username: 'viewer.delta', email: 'viewer.delta@example.org', role: 'viewer', scope_state: 'Delta', is_active: true, sessions: 5, requests: 140, active_days: 4, last_seen: '2026-10-20T11:30:00', minutes: 48 },
  ],
  pages: [{ path: '/api/overview', n: 310, users: 3 }, { path: '/api/clients', n: 122, users: 2 }, { path: '/api/cascade', n: 90, users: 2 }],
  never_used: [{ username: 'new.starter', email: 'new.starter@example.org', role: 'viewer' }],
}

export const FEEDBACK = [
  { email: 'viewer.delta@example.org', page: 'Worklists', message: 'Could the worklist show the follow-up sample date?', created_at: '2026-10-19T10:00:00' },
]

export const AUDIT = {
  rows: [
    { id: 3, ts: '2026-10-22T16:00:00', actor: 'analyst.one', email: 'analyst.one@example.org', action: 'clients.view', detail: '42 client rows; no filters; flag=awaiting_switch', ip: '10.0.0.4' },
    { id: 2, ts: '2026-10-18T08:12:00', actor: 'admin', email: ME_EMAIL, action: 'upload.create', detail: 'upload 9, as_of 2026-10-17, 4633 cohort rows', ip: '10.0.0.2' },
    { id: 1, ts: '2026-10-18T08:00:00', actor: 'admin', email: ME_EMAIL, action: 'login.ok', detail: null, ip: '10.0.0.2' },
  ],
  actions: [{ action: 'clients.view', n: 120 }, { action: 'login.ok', n: 40 }, { action: 'upload.create', n: 6 }],
}
