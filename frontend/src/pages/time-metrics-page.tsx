import type { ChartConfiguration } from 'chart.js'
import { CircleAlert, Clock, Hourglass, Timer, TrendingDown } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { cn } from 'cn'
import Chart from '@/components/Chart'
import FilterBar, { PinFiltersToggle } from '@/components/filter-bar'
import { KpiTile } from '@/components/kpi-tile'
import { StatusBadge } from '@/components/status-badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/core/api'
import { useFilters } from '@/core/filters'
import { DASH, fmt } from '@/core/format'
import type { Dist, TimeMetrics } from '@/core/overview'
import { cssVar, useChartPalette } from '@/core/palette'

/** One point of the Kaplan-Meier curve (indicators.kaplan_meier). */
export interface KmPoint { t: number; survival: number; at_risk: number }
/** Cumulative % reaching the first unsuppressed VL by years on ART, per ART-start era. */
export type UnsuppCurve = Record<string, { n: number; median: number; points: { t: number; pct: number }[] }>

const withQuery = (path: string, query: string) => `${path}${query}`

/**
 * The six intervals the programme is timed on, each on its own scale. A target
 * is drawn where national guidance sets one; the box turns green or red only
 * against a target, never on its own.
 */
const BOXES: { key: keyof TimeMetrics; label: string; from: string; unit: string; target?: number }[] = [
  { key: 'time_to_eac', label: 'Time to EAC start', from: 'index result to session 1', unit: 'days', target: 30 },
  { key: 'eac_lead_time', label: 'EAC lead time', from: 'session 1 to the follow-up sample', unit: 'days' },
  { key: 'time_to_resuppression', label: 'Time to re-suppression', from: 'session 1 to a suppressed VL', unit: 'days' },
  { key: 'months_unsuppressed', label: 'Months unsuppressed', from: 'index VL to the line-list date', unit: 'months' },
  { key: 'time_to_first_vl', label: 'ART start to first VL', from: 'the 6-month guideline clock', unit: 'months', target: 6 },
  { key: 'time_to_first_unsupp', label: 'ART start to first unsuppressed VL', from: 'how long treatment held', unit: 'years' },
]

export default function TimeMetricsPage() {
  const { query, options } = useFilters()
  const C = useChartPalette()
  const [t, setT] = useState<TimeMetrics | null>(null)
  const [km, setKm] = useState<KmPoint[] | null>(null)
  const [uc, setUc] = useState<UnsuppCurve | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!options) return
    let off = false
    setLoading(true)
    Promise.all([
      api<TimeMetrics>(withQuery('/time-metrics', query)),
      api<KmPoint[]>(withQuery('/survival', query)),
      api<UnsuppCurve>(withQuery('/unsupp-curve', query)),
    ])
      .then(([a, b, c]) => { if (!off) { setT(a); setKm(b); setUc(c); setErr(null) } })
      .catch((e: unknown) => { if (!off) setErr(e instanceof Error ? e.message : 'Could not load time metrics') })
      .finally(() => { if (!off) setLoading(false) })
    return () => { off = true }
  }, [query, options])

  const kmChart = useMemo<ChartConfiguration | null>(() => {
    if (!km?.length) return null
    const fill = C.stockFill
    return {
      type: 'line',
      data: { datasets: [{
        label: 'Not yet re-suppressed', data: km.map((p) => ({ x: p.t, y: p.survival * 100 })),
        borderColor: C.flowIn, backgroundColor: `${fill}55`, fill: true, stepped: 'after',
        borderWidth: 2, pointRadius: 0, cubicInterpolationMode: 'default',
      }] },
      options: {
        maintainAspectRatio: false,
        interaction: { mode: 'nearest', intersect: false, axis: 'x' },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: {
            title: (i) => `Day ${i[0]?.parsed.x ?? ''} since session 1`,
            label: (i) => `${(i.parsed.y ?? 0).toFixed(1)}% not yet re-suppressed`,
          } },
        },
        scales: {
          x: { type: 'linear', min: 0, max: 365, border: { display: false }, grid: { display: false },
               ticks: { stepSize: 60 }, title: { display: true, text: 'Days since the first EAC session' } },
          y: { min: 0, max: 100, border: { display: false }, ticks: { callback: (v) => `${v}%` } },
        },
      },
    }
  }, [km, C])

  const eraChart = useMemo<ChartConfiguration | null>(() => {
    const keys = uc ? Object.keys(uc) : []
    if (!keys.length) return null
    const cols = [C.series1, C.series2]
    return {
      type: 'line',
      data: { datasets: keys.map((k, i) => ({
        label: k, data: uc![k]!.points.map((p) => ({ x: p.t, y: p.pct })),
        borderColor: cols[i % 2], backgroundColor: cols[i % 2], borderWidth: 2, pointRadius: 0,
      })) },
      options: {
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: {
            title: (i) => `${i[0]?.parsed.x ?? ''} years on ART`,
            label: (i) => `${i.dataset.label}: ${(i.parsed.y ?? 0).toFixed(1)}%`,
          } },
        },
        scales: {
          x: { type: 'linear', min: 0, max: 15, border: { display: false }, grid: { display: false },
               title: { display: true, text: 'Years on ART' } },
          y: { min: 0, max: 100, border: { display: false }, ticks: { callback: (v) => `${v}%` },
               title: { display: true, text: 'Cumulative % unsuppressed' } },
        },
      },
    }
  }, [uc, C])

  const head = (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-balance">Time metrics</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            How long each step takes: from an unsuppressed result to EAC, through EAC to the repeat
            viral load and re-suppression, and how long treatment held before it failed.
          </p>
        </div>
        <PinFiltersToggle />
      </div>
      <FilterBar />
    </>
  )

  if (err) return <div className="flex flex-col gap-6">{head}<Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert></div>
  if (!t) {
    return (
      <div className="flex flex-col gap-6">{head}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    )
  }

  const med = (d: Dist | null | undefined, unit: string) => (d ? `${fmt(d.median)} ${unit}` : DASH)
  const tte = t.time_to_eac

  return (
    <div className={cn('flex flex-col gap-6 transition-opacity', loading && 'opacity-60')} aria-busy={loading}>
      {head}

      <section aria-label="Median times" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile icon={Timer} label="Median time to EAC" value={med(tte, 'days')}
                 note={tte ? `index result to session 1 · ${fmt(tte.n)} episodes` : undefined}
                 status={tte && <StatusBadge tone={tte.median <= 30 ? 'good' : 'warn'}>
                   {tte.median <= 30 ? 'Within 30 days' : 'Over 30 days'}</StatusBadge>} />
        <KpiTile icon={Clock} label="Median EAC lead time" value={med(t.eac_lead_time, 'days')}
                 note="session 1 to the follow-up sample" />
        <KpiTile icon={TrendingDown} label="Median time to re-suppression" value={med(t.time_to_resuppression, 'days')}
                 note="session 1 to a suppressed VL" />
        <KpiTile icon={Hourglass} label="Median months unsuppressed" value={med(t.months_unsuppressed, 'months')}
                 note="index VL to the line-list date" />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>The time each step takes</CardTitle>
          <CardDescription>
            The box is the middle half of episodes (25th to 75th percentile), the line inside is the
            median, and the whiskers span the typical range. Each row has its own scale. A dashed
            line marks the guideline target where there is one. A negative interval is not an
            error: a sample before EAC session 1 means that cycle never started.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
          {BOXES.map((b) => (
            <BoxRow key={b.key} label={b.label} from={b.from} unit={b.unit} target={b.target} d={t[b.key] ?? null} />
          ))}
        </CardContent>
      </Card>

      <Alert>
        <CircleAlert />
        <AlertTitle>Time to switch cannot be measured yet</AlertTitle>
        <AlertDescription>
          The export has no switch date: it records only a client's current regimen line. Until the
          HI team adds a switch date, the time from failing EAC to switching cannot be produced. It
          is the single most useful field they could add.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Time from the first EAC session to re-suppression</CardTitle>
            <CardDescription>
              The share of episodes not yet re-suppressed, day by day after EAC session 1
              (Kaplan-Meier). Episodes that have not re-suppressed are counted up to the line-list
              date, not dropped, so the curve does not flatter the programme.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {kmChart
              ? <Chart config={kmChart} height={300} ariaLabel="Step curve of the share of episodes not yet re-suppressed by days since the first EAC session" />
              : <p className="py-10 text-center text-sm text-muted-foreground">No episodes with EAC session 1 in this selection.</p>}
            {km?.length ? <KmMilestones km={km} /> : null}
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Time on ART to the first unsuppressed VL</CardTitle>
            <CardDescription>
              The cumulative share reaching their first unsuppressed result, by years on ART, split
              by when ART started. Routine viral load testing scaled up with Test and Treat around
              2017/18, so an earlier starter's long wait is partly late detection, not durable
              treatment. The two eras are kept apart for that reason.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {eraChart && (
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                {Object.entries(uc!).map(([k, v], i) => (
                  <span key={k} className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-[3px]" style={{ background: i % 2 ? C.series2 : C.series1 }} aria-hidden />
                    {k} <span className="text-foreground tabular-nums">median {v.median} yr</span> · n={fmt(v.n)}
                  </span>
                ))}
              </div>
            )}
            {eraChart
              ? <Chart config={eraChart} height={280} ariaLabel="Cumulative share reaching the first unsuppressed viral load by years on ART, for clients who started ART up to 2017 and from 2018" />
              : <p className="py-10 text-center text-sm text-muted-foreground">Too few episodes with an ART start date in this selection.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function BoxRow({ label, from, unit, target, d }: {
  label: string; from: string; unit: string; target?: number; d: Dist | null
}) {
  if (!d) {
    return (
      <div className="grid items-center gap-x-6 gap-y-2 py-3 md:grid-cols-[16rem_minmax(0,1fr)_10rem]">
        <span className="text-sm">{label}<span className="block text-xs text-muted-foreground">{from}</span></span>
        <span className="text-xs text-muted-foreground">No data in this selection.</span>
      </div>
    )
  }
  const top = Math.max(d.whi, d.median, target ?? 0) * 1.08 || 1
  const x = (v: number) => `${Math.max(0, Math.min(100, (v / top) * 100))}%`
  const met = target == null ? null : d.median <= target
  const fill = met === true ? 'var(--good)' : met === false ? 'var(--bad)' : 'var(--icon)'
  return (
    <div className="grid items-center gap-x-6 gap-y-2 py-3 md:grid-cols-[16rem_minmax(0,1fr)_10rem]">
      <span className="text-sm">
        {label}
        <span className="block text-xs text-muted-foreground">{from} · {unit} · n={fmt(d.n)}</span>
      </span>
      <div className="relative h-8" role="img"
           aria-label={`${label}: median ${d.median} ${unit}, middle half ${d.q1} to ${d.q3}${target != null ? `, target ${target}` : ''}`}>
        <span className="absolute top-1/2 h-px -translate-y-1/2 bg-muted-foreground/60"
              style={{ left: x(d.wlo), width: `calc(${x(d.whi)} - ${x(d.wlo)})` }} />
        <span className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-muted-foreground" style={{ left: x(d.wlo) }} />
        <span className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-muted-foreground" style={{ left: x(d.whi) }} />
        <span className="absolute top-1/2 h-[18px] -translate-y-1/2 rounded-[4px] opacity-80"
              style={{ left: x(d.q1), width: `max(3px, calc(${x(d.q3)} - ${x(d.q1)}))`, background: fill }} />
        <span className="absolute top-1/2 h-6 w-0.5 -translate-y-1/2 bg-foreground" style={{ left: x(d.median) }} />
        {target != null && (
          <span className="absolute inset-y-0 border-l-2 border-dashed border-bad" style={{ left: x(target) }}>
            <span className="absolute -top-1 left-1 text-[10px] whitespace-nowrap text-bad">target {target}</span>
          </span>
        )}
      </div>
      <span className="text-right text-sm tabular-nums">
        <span className="font-semibold">{d.median}</span> {unit}
        <span className="block text-xs text-muted-foreground">middle half {d.q1} to {d.q3}</span>
      </span>
    </div>
  )
}

/** The curve read at fixed points, so the numbers are on the page as well as in the hover. */
function KmMilestones({ km }: { km: KmPoint[] }) {
  const at = (day: number) => {
    let s: number | null = null
    for (const p of km) { if (p.t <= day) s = p.survival; else break }
    return s
  }
  const grey = cssVar('--muted-foreground', '#888')
  return (
    <dl className="grid grid-cols-4 gap-2 text-center text-xs" style={{ color: grey }}>
      {[90, 180, 270, 365].map((day) => {
        const s = at(day)
        return (
          <div key={day} className="rounded-lg bg-muted/60 px-2 py-1.5">
            <dt>Day {day}</dt>
            <dd className="text-sm font-medium text-foreground tabular-nums">{s == null ? DASH : `${(s * 100).toFixed(0)}%`}</dd>
            <dd>not yet re-suppressed</dd>
          </div>
        )
      })}
    </dl>
  )
}
