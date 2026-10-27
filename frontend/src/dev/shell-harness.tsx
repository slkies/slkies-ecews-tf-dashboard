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

const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { 'Content-Type': 'application/json' } })
window.fetch = async (input: RequestInfo | URL) => {
  const url = String(input)
  if (url.includes('/api/me')) return json({ username: 'harness', email: 'h@example.org', name: 'Harness Admin', role: 'admin', scope_state: null, scope_facility: null })
  if (url.includes('/api/version')) return json({ version: '2.0', commit: 'harness', dirty: true, label: 'v2.0+' })
  if (url.includes('/api/filters')) return json({ states: ['Delta', 'Osun'], lgas: [], lga_res: [], facilities: ['Delta Facility A'], age_bands: [], quarters: [], fys: [], months: [], plans: [], lga_state: {}, facility_state: {} })
  if (url.includes('/api/summary')) return json({ n: ROWS.length, clients: ROWS.length, as_of: '2026-10-16' })
  if (url.includes('/api/worklists')) return json(WORKLISTS.map((w) => ({ flag: w.flag, n: w.flag === 'eac_incomplete' ? ROWS.length : 0 })))
  if (url.includes('/api/clients')) return json(ROWS)
  if (url.includes('/api/client-search')) return json({ n: MATCHES.length, shown: MATCHES.length, limit: 50, clients: MATCHES })
  if (url.includes('/api/client/')) return json(RECORD)
  if (url.includes('/api/uploads')) return json([])
  if (url.includes('/api/dq')) return json([])
  return json({ n: 0 })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider><TooltipProvider><SessionProvider><FilterProvider>
      <AppShell />
    </FilterProvider></SessionProvider></TooltipProvider></ThemeProvider>
  </StrictMode>,
)
