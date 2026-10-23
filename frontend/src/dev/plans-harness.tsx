/**
 * Development only: the Treatment plans page in the real frame with synthetic
 * figures and no backend. /app/harness-plans.html (add ?theme=dark). Not a
 * production build entry.
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
import PlansPage from '@/pages/plans-page'
import { PLAN_ROWS, PLANS } from './plans-fixture'
import '@/styles/fonts.css'
import '@/index.css'
import '@/styles/merged-theme.css'

try {
  sessionStorage.setItem('ecews.session', 'harness')
  const theme = new URLSearchParams(location.search).get('theme')
  if (theme === 'light' || theme === 'dark') localStorage.setItem('ecews.theme', theme)
} catch { /* ignore */ }

const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { 'Content-Type': 'application/json' } })
window.fetch = async (input: RequestInfo | URL) => {
  const url = String(input)
  if (url.includes('/api/me')) return json({ username: 'harness', email: 'h@x', name: 'Harness Admin', role: 'admin', scope_state: null, scope_facility: null })
  if (url.includes('/api/version')) return json({ version: '1.0', commit: 'harness', dirty: true, label: 'v1.0+' })
  if (url.includes('/api/filters')) return json({ states: ['Delta', 'Ekiti', 'Osun'], lgas: [], lga_res: [], facilities: [], age_bands: [], quarters: [], fys: ['FY26'], months: [], plans: [], lga_state: {}, facility_state: {} })
  if (url.includes('/api/plans')) return json(PLANS)
  if (url.includes('/api/clients')) return json(PLAN_ROWS)
  return json({})
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider><TooltipProvider><SessionProvider><FilterProvider>
      <SidebarProvider>
        <AppSidebar view="plans" onNavigate={() => {}} asof="12 Sep 2026" episodes="4,633" clients="4,180" />
        <SidebarInset>
          <SiteHeader title="Treatment plans" />
          <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 p-4 lg:p-6">
            <PlansPage />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </FilterProvider></SessionProvider></TooltipProvider></ThemeProvider>
  </StrictMode>,
)
