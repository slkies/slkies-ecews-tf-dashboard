/**
 * Development only: the whole dashboard shell on synthetic data, for checking
 * flows that cross pages - a client key in a worklist opening the record as a
 * page, and Back returning to the same list - without signing in to the real
 * app. /harness-shell.html. Not a production build entry.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { TooltipProvider } from '@/components/ui/tooltip'
import { FilterProvider } from '@/core/filters'
import { SessionProvider } from '@/core/session'
import { ThemeProvider } from '@/core/theme'
import { WORKLISTS } from '@/pages/worklists-page'
import AppShell from '@/shell/app-shell'
import { MATCHES, RECORD } from './client-fixture'
import { PLAN_ROWS } from './plans-fixture'
import '@/styles/fonts.css'
import '@/index.css'
import '@/styles/merged-theme.css'

try {
  sessionStorage.setItem('ecews.session', 'harness')
  const theme = new URLSearchParams(location.search).get('theme')
  if (theme === 'light' || theme === 'dark') localStorage.setItem('ecews.theme', theme)
} catch { /* ignore */ }

// Every row is the synthetic record's client, so any key opens a full record.
const ROWS = PLAN_ROWS.map((r, i) => ({ ...r, sn: i === 0 ? RECORD.sn : r.sn, facility: i === 0 ? 'Delta Facility A' : r.facility }))

// One facility's cascade, made up, for the facility view (?facility=1).
const fstep = (s: number, label: string, n: number, den: number, dl: string) => ({
  step: s, label, n, n_female: Math.round(n * 0.6), n_male: n - Math.round(n * 0.6),
  denominator: den, denominator_label: dl, pct: den ? Math.round(n / den * 1000) / 10 : null,
})
const STEPS = [
  fstep(1, 'Total unsuppressed', 48, 48, '-'), fstep(11, 'Left care before a repeat VL', 6, 48, '#1'),
  fstep(12, 'Still in care, or retested', 42, 48, '#1'), fstep(2, 'EAC commenced', 36, 42, '#1b'),
  fstep(3, 'EAC session 2', 31, 36, '#2'), fstep(4, 'EAC session 3', 27, 36, '#2'),
  fstep(6, 'EAC completed', 24, 36, '#2'), fstep(7, 'Follow-up VL sample', 26, 42, '#1b'),
  fstep(8, 'Follow-up VL result', 24, 42, '#1b'), fstep(9, 'Re-suppressed (<1,000)', 18, 24, '#8'),
  fstep(93, 'Still unsuppressed', 6, 24, '#8'), fstep(10, 'Switched to 2nd/3rd line', 1, 6, '#9b'),
]
const SCOPED_DQ = [
  { sheet: null, check_name: 'EAC completed, no post-EAC VL sample', severity: 'medium', n_records: 4, detail: 'Course finished but no post-EAC VL sample collected.' },
  { sheet: null, check_name: 'No ART status recorded', severity: 'medium', n_records: 1, detail: 'Without a status these clients cannot be triaged.' },
  { sheet: null, check_name: 'Implausible viral load', severity: 'clear', n_records: 0, detail: 'Index VL above 10,000,000 copies/mL.' },
]

const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { 'Content-Type': 'application/json' } })
window.fetch = async (input: RequestInfo | URL) => {
  const url = String(input)
  // ?facility=1 signs the harness in as a facility-scoped viewer, to see the facility view.
  if (url.includes('/api/me')) return json(new URLSearchParams(window.location.search).has('facility')
    ? { username: 'facility', email: 'f@example.org', name: 'Facility User', role: 'viewer', scope_state: 'Delta', scope_facility: 'Delta Facility A' }
    : { username: 'harness', email: 'h@example.org', name: 'Harness Admin', role: 'admin', scope_state: null, scope_facility: null })
  if (url.includes('/api/version')) return json({ version: '2.0', commit: 'harness', dirty: true, label: 'v2.0+' })
  if (url.includes('/api/filters')) return json({ states: ['Delta', 'Osun'], lgas: [], lga_res: [], facilities: ['Delta Facility A'], age_bands: [], quarters: [], fys: [], months: [], plans: [], lga_state: {}, facility_state: {} })
  if (url.includes('/api/summary')) return json({ n: ROWS.length, clients: ROWS.length, as_of: '2026-10-16' })
  if (url.includes('/api/worklists')) return json(WORKLISTS.map((w) => ({ flag: w.flag, n: w.flag === 'eac_incomplete' ? ROWS.length : 0 })))
  if (url.includes('/api/clients')) return json(ROWS)
  if (url.includes('/api/client-search')) return json({ n: MATCHES.length, shown: MATCHES.length, limit: 50, clients: MATCHES })
  if (url.includes('/api/client/')) return json(RECORD)
  if (url.includes('/api/uploads')) return json([{ id: 1, as_of: '2026-10-16', status: 'ready', is_current: true }])
  if (url.includes('/api/dq/scoped')) return json(SCOPED_DQ)
  if (url.includes('/api/dq')) return json([])
  if (url.includes('/api/cascade')) return json(STEPS)
  if (url.includes('/api/plans')) return json([])
  if (url.includes('/api/feedback')) return json({ ok: true })
  return json({ n: 0 })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider><TooltipProvider><SessionProvider><FilterProvider>
      <AppShell />
    </FilterProvider></SessionProvider></TooltipProvider></ThemeProvider>
  </StrictMode>,
)
