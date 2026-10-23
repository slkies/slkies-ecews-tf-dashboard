/**
 * Development only: Data quality, Guidelines, Methodology and Admin in the real
 * frame with synthetic data and no backend. /app/harness-admin.html?page=admin
 * (or dq, guide, method; add &theme=dark). Writes are answered with ok and
 * change nothing. Not a production build entry.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { FilterProvider } from '@/core/filters'
import { SessionProvider } from '@/core/session'
import { ThemeProvider } from '@/core/theme'
import AdminPage from '@/pages/admin-page'
import DataQualityPage from '@/pages/data-quality-page'
import GuidelinesPage from '@/pages/guidelines-page'
import MethodologyPage from '@/pages/methodology-page'
import { AUDIT, DIAG, DQ, FEEDBACK, ME_EMAIL, UPLOADS, USAGE, USERS } from './admin-fixture'
import '@/styles/fonts.css'
import '@/index.css'
import '@/styles/merged-theme.css'

const params = new URLSearchParams(location.search)
try {
  sessionStorage.setItem('ecews.session', 'harness')
  const theme = params.get('theme')
  if (theme === 'light' || theme === 'dark') localStorage.setItem('ecews.theme', theme)
} catch { /* ignore */ }

const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { 'Content-Type': 'application/json' } })
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  if (init?.method && init.method !== 'GET') {
    return json({ ok: true, deleted: 2, cohort: 4700, upload_id: 10, primary_eac_sheet: 'EAC_Oct', warnings: [], sheets: [] })
  }
  if (url.includes('/api/me')) return json({ username: 'admin', email: ME_EMAIL, name: 'Harness Admin', role: 'admin', scope_state: null, scope_facility: null })
  if (url.includes('/api/version')) return json({ version: '1.0', commit: 'harness', dirty: true, label: 'v1.0+' })
  if (url.includes('/api/filters')) {
    return json({ states: ['Delta', 'Ekiti', 'Osun'], lgas: [], lga_res: [], facilities: ['Delta Facility A', 'Osun Facility B'],
                  age_bands: [], quarters: [], fys: [], months: [], plans: [], lga_state: {},
                  facility_state: { 'Delta Facility A': 'Delta', 'Osun Facility B': 'Osun' } })
  }
  if (url.includes('/api/summary')) return json({ n: 4633, clients: 4180, as_of: '2026-10-17' })
  if (url.includes('/api/dq')) return json(DQ)
  if (url.includes('/api/users')) return json(USERS)
  if (url.includes('/api/uploads')) return json(UPLOADS)
  if (url.includes('/api/diagnostics')) return json(DIAG)
  if (url.includes('/api/usage')) return json(USAGE)
  if (url.includes('/api/feedback')) return json(FEEDBACK)
  if (url.includes('/api/audit')) return json(AUDIT)
  return json({})
}

const PAGES = {
  dq: ['Data quality', <DataQualityPage />], guide: ['Guidelines', <GuidelinesPage />],
  method: ['Methodology', <MethodologyPage />], admin: ['Admin', <AdminPage />],
} as const
const key = (params.get('page') ?? 'admin') as keyof typeof PAGES
const [title, page] = PAGES[key] ?? PAGES.admin

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider><TooltipProvider><SessionProvider><FilterProvider>
      <SidebarProvider>
        <AppSidebar view={key} onNavigate={() => {}} asof="17 Oct 2026" episodes="4,633" clients="4,180" />
        <SidebarInset>
          <SiteHeader title={title} />
          <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 p-4 lg:p-6">{page}</div>
        </SidebarInset>
      </SidebarProvider>
    </FilterProvider></SessionProvider></TooltipProvider></ThemeProvider>
  </StrictMode>,
)
