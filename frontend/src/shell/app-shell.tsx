import { CircleAlert, Hammer } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppSidebar } from '@/components/app-sidebar'
import { ClientRecordPage, ClientRecordProvider } from '@/components/client-record'
import ErrorBoundary from '@/components/error-boundary'
import { SiteHeader } from '@/components/site-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button'
import {
  Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from '@/components/ui/empty'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { api } from '@/core/api'
import { useFilters } from '@/core/filters'
import { useSession } from '@/core/session'
import { fmt, fmtDate } from '@/core/format'
import type { Overview as Ov, TimeMetrics } from '@/core/overview'
import type { Summary } from '@/core/types'
import { useTrend } from '@/core/use-trend'
import AdminPage from '@/pages/admin-page'
import AdvancedPage from '@/pages/advanced-page'
import CascadePage from '@/pages/cascade-page'
import ClientSearchPage from '@/pages/client-search-page'
import ComparePage from '@/pages/compare-page'
import DataQualityPage from '@/pages/data-quality-page'
import DeepDivePage from '@/pages/deep-dive-page'
import DtcPage from '@/pages/dtc-page'
import GuidelinesPage from '@/pages/guidelines-page'
import MethodologyPage from '@/pages/methodology-page'
import TimeMetricsPage from '@/pages/time-metrics-page'
import OverviewPage from '@/pages/overview-page'
import PlansPage from '@/pages/plans-page'
import WorklistsPage from '@/pages/worklists-page'
import { NAV } from './nav'

export default function AppShell() {
  const { query, options } = useFilters()
  const { me } = useSession()
  const [view, setView] = useState('overview')
  // Which worklist to open when arriving from another page (a cascade step).
  const [worklistFlag, setWorklistFlag] = useState<string | null>(null)
  // A client's record opens as a page OVER the current one, which stays
  // mounted underneath (hidden), so Back returns to the same worklist, search
  // and scroll position rather than a fresh page. The browser's Back does the
  // same: opening a record pushes one history entry.
  const [clientSn, setClientSn] = useState<string | null>(null)
  const openSn = useRef<string | null>(null)
  const scrollBack = useRef(0)
  const openClient = useCallback((sn: string) => {
    if (openSn.current === null) {
      scrollBack.current = window.scrollY
      window.history.pushState({ ecewsClient: sn }, '')
    } else {
      window.history.replaceState({ ecewsClient: sn }, '')
    }
    openSn.current = sn
    setClientSn(sn)
    window.scrollTo(0, 0)
  }, [])
  const closeClient = useCallback(() => {
    openSn.current = null
    setClientSn(null)
    requestAnimationFrame(() => window.scrollTo(0, scrollBack.current))
  }, [])
  useEffect(() => {
    const onPop = () => closeClient()
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [closeClient])

  const navigate = (v: string) => { openSn.current = null; setClientSn(null); setWorklistFlag(null); setView(v); window.scrollTo(0, 0) }
  const openWorklist = (flag: string) => { openSn.current = null; setClientSn(null); setWorklistFlag(flag); setView('worklists'); window.scrollTo(0, 0) }
  const [summary, setSummary] = useState<Summary | null>(null)
  const [overview, setOverview] = useState<Ov | null>(null)
  const [times, setTimes] = useState<TimeMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const trend = useTrend(query, !!options)

  // Re-fetch whenever the filter query changes. `query` is a string, so an
  // identical selection reached another way does not refetch.
  useEffect(() => {
    if (!options) return          // wait for the filters, or the first call is unfiltered
    let cancelled = false
    setLoading(true)
    Promise.all([
      api<Summary>(`/summary${query}`),
      api<Ov>(`/overview${query}`),
      api<TimeMetrics>(`/time-metrics${query}`),
    ])
      .then(([s, o, t]) => {
        if (cancelled) return
        setSummary(s); setOverview(o); setTimes(t); setErr(null)
      })
      .catch((e: unknown) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Could not load')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [query, options])

  const label = NAV.find((n) => n.id === view)?.label ?? 'Overview'

  return (
    <ClientRecordProvider onOpen={openClient}>
    <SidebarProvider>
      <AppSidebar view={view} onNavigate={navigate}
                  asof={fmtDate(summary?.as_of)} episodes={fmt(summary?.n)}
                  clients={fmt(summary?.clients)} />
      <SidebarInset>
        <SiteHeader title={clientSn ? 'Client record' : label} onOpenDq={() => navigate('dq')} />
        <div className="flex w-full flex-1 flex-col gap-6 p-4 lg:p-6">
          {err && (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>The dashboard could not load</AlertTitle>
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          )}
          {clientSn && (
            <ErrorBoundary name="Client record">
              {/* Back goes through history, so the browser's own Back agrees. */}
              <ClientRecordPage key={clientSn} sn={clientSn} backLabel={label} onBack={() => window.history.back()} />
            </ErrorBoundary>
          )}
          <div className={clientSn ? 'hidden' : 'contents'}>
          {view === 'overview' ? (
            <ErrorBoundary name="Overview">
              <OverviewPage data={overview} times={times} trend={trend} loading={loading} />
            </ErrorBoundary>
          ) : view === 'deep' ? (
            <ErrorBoundary name="Deep dive">
              <DeepDivePage onOpenWorklist={openWorklist} />
            </ErrorBoundary>
          ) : view === 'dtc' ? (
            <ErrorBoundary name="DTC review">
              <DtcPage onOpenWorklist={openWorklist} />
            </ErrorBoundary>
          ) : view === 'compare' ? (
            <ErrorBoundary name="Line list changes">
              <ComparePage />
            </ErrorBoundary>
          ) : view === 'search' ? (
            <ErrorBoundary name="Client search">
              <ClientSearchPage />
            </ErrorBoundary>
          ) : view === 'plans' ? (
            <ErrorBoundary name="Treatment plans">
              <PlansPage />
            </ErrorBoundary>
          ) : view === 'adv' ? (
            <ErrorBoundary name="Advanced analytics">
              <AdvancedPage />
            </ErrorBoundary>
          ) : view === 'dq' ? (
            <ErrorBoundary name="Data quality">
              <DataQualityPage />
            </ErrorBoundary>
          ) : view === 'guide' ? (
            <ErrorBoundary name="Guidelines">
              <GuidelinesPage />
            </ErrorBoundary>
          ) : view === 'method' ? (
            <ErrorBoundary name="Methodology">
              <MethodologyPage />
            </ErrorBoundary>
          ) : view === 'admin' && me?.role === 'admin' ? (
            <ErrorBoundary name="Admin">
              <AdminPage />
            </ErrorBoundary>
          ) : view === 'time' ? (
            <ErrorBoundary name="Time metrics">
              <TimeMetricsPage />
            </ErrorBoundary>
          ) : view === 'cascade' ? (
            <ErrorBoundary name="Cascade">
              <CascadePage onOpenWorklist={openWorklist} />
            </ErrorBoundary>
          ) : view === 'worklists' ? (
            <ErrorBoundary name="Worklists">
              <WorklistsPage key={worklistFlag ?? 'default'} initialFlag={worklistFlag} />
            </ErrorBoundary>
          ) : <NotPorted label={label} />}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
    </ClientRecordProvider>
  )
}

/**
 * Pages not yet rebuilt say so and point at the live dashboard, rather than
 * showing an empty panel that looks broken.
 */
function NotPorted({ label }: { label: string }) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon"><Hammer /></EmptyMedia>
        <EmptyTitle>{label} has not been rebuilt yet</EmptyTitle>
        <EmptyDescription>
          It is still live on the current dashboard, which is unchanged and remains
          the one to use for programme work.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <a href="/" className={buttonVariants({ variant: 'outline' })}>Open the current dashboard</a>
      </EmptyContent>
    </Empty>
  )
}
