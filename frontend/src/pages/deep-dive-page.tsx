import type { ChartConfiguration } from 'chart.js'
import { ArrowRight, Microscope } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { cn } from 'cn'
import Chart from '@/components/Chart'
import FilterBar, { PinFiltersToggle } from '@/components/filter-bar'
import LgaMap, { type LgaCounts } from '@/components/lga-map'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import {
  Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { api } from '@/core/api'
import { useFilters } from '@/core/filters'
import { DASH, fmt, fmtMonYY, pc } from '@/core/format'
import { cssVar, useChartPalette } from '@/core/palette'
import { SortHead, useSort } from '@/components/sortable'
import { StatusBadge } from '@/components/status-badge'
import { WORKLISTS, type Priority } from './worklists-page'

/* ─────────────────────────────────── types ─────────────────────────────────── */

export interface Dist { level: string; n: number; pct: number; n_female?: number; n_male?: number }

/** Clients entering and leaving the unsuppressed cohort (indicators.cohort_flow). */
export interface Flow {
  months: string[]
  entered_new: number[]; entered_again: number[]
  left_resuppressed: number[]; left_care: number[]
  in_cohort: number[]; in_cohort_at_start: number
  undated_left_care: number; resuppression_dated_by_sample: number
}
interface Quart { n: number; median: number; q1: number; q3: number }

export interface Profile {
  n: number
  clients: number
  who: {
    median_age: number | null; female_pct: number; adolescent_pct: number; paed_pct: number
    sex: Dist[]; age_group: Dist[]; age_band: Dist[]; marital: Dist[]
    education: Dist[]; job: Dist[]; pregnancy: Dist[]
  }
  what: {
    median_years_art: number | null
    regimen: Dist[]; vl_magnitude: Dist[]; cd4: Dist[]; years_art: Dist[]
    eac_status: Dist[]; who_stage: Dist[]; bmi: Dist[]; plan: Dist[]
  }
  when: {
    monthly: { months: string[]; n: number[]; exits: number[] }
    flow?: Flow
    wait: (Quart & { pending: number }) | null
    quarter: Dist[]; time_to_first_vl: Dist[]; yrs_to_unsupp: Dist[]
    time_to_eac: Dist[]; months_unsupp: Dist[]
    ttfv_months: Quart | null; ttfu_years: Quart | null; mu_stats: Quart | null
  }
  care: {
    neg_total: number; neg_pct: number; neg_no_followup: number
    neg_no_post_eac: number; neg_dated: number
    status: Dist[]; exit_when: Dist[]
    breakdown: { level: string; n: number; no_followup_vl: number }[]
  } | null
  where: { state: Dist[]; lga: Dist[]; facility: Dist[]; lga_res: LgaCounts | null }
}

export interface FacilityRow {
  group: string; n: number; eac1_pct: number | null; post_result: number
  resupp_pct: number | null; still_unsuppressed: number; switched: number
}

/* ─────────────────────────────────── pieces ────────────────────────────────── */

function Stat({ label, value, note, tone }: {
  label: string; value: string; note: string; tone?: 'warn'
}) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={cn('text-2xl font-semibold', tone === 'warn' && 'text-warn')}>{value}</span>
        <span className="text-xs text-muted-foreground">{note}</span>
      </CardContent>
    </Card>
  )
}

/**
 * A distribution as labelled rows: level, a bar of its share, the count and the
 * percentage. Rows rather than a donut - the levels are ordered and often close
 * together, which a donut reads badly, and every value is on the page.
 */
function DistCard({ title, dist, highlight, colors, note }: {
  title: string
  dist: Dist[] | undefined
  /** Levels that carry meaning of their own, e.g. a priority age group. */
  highlight?: Record<string, 'bad' | 'warn'>
  /** Fixed colours per level - sex uses the same female/male pair as every chart. */
  colors?: Record<string, string>
  note?: string
}) {
  const C = useChartPalette()
  return (
    <Card size="sm" className="min-w-0">
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
        {note && <CardDescription className="text-xs">{note}</CardDescription>}
      </CardHeader>
      <CardContent>
        {dist?.length ? (
          <ul className="flex flex-col gap-2.5">
            {dist.map((r) => {
              const tone = highlight?.[r.level]
              const quiet = r.level === 'Not recorded' || r.level === 'Unknown'
              return (
                <li key={r.level} className="flex flex-col gap-1">
                  {/* Label and figures on one line, the bar full width beneath - the main
                      dashboard's layout, so the bar gets the card's whole width. A priority
                      level (e.g. under 10) is marked on its label, so the bar can keep the
                      female / male colours every chart uses. */}
                  <div className="flex items-baseline justify-between gap-3">
                    <span className={cn('truncate text-xs',
                                        tone ? `font-medium text-${tone}` : quiet ? 'text-muted-foreground' : 'text-foreground')}
                          title={r.level}>
                      {r.level}
                    </span>
                    <span className="shrink-0 text-right text-xs tabular-nums">
                      {fmt(r.n)}<span className="ml-1.5 text-muted-foreground">{r.pct}%</span>
                    </span>
                  </div>
                  <span className="flex h-4 w-full overflow-hidden rounded-[4px] bg-muted" aria-hidden>
                    {r.n_female != null && r.n_male != null && !colors ? (
                      <span className="flex h-full overflow-hidden rounded-[4px]"
                            style={{ width: `${Math.min(r.pct, 100)}%`, opacity: quiet ? 0.6 : 1 }}>
                        <SexSegments n={r.n} f={r.n_female} m={r.n_male} C={C} />
                      </span>
                    ) : (
                      <span className="block h-full rounded-[4px]"
                            style={{ width: `${Math.min(r.pct, 100)}%`,
                                     background: colors?.[r.level] ? colors[r.level]
                                       : tone ? `var(--${tone})`
                                       : quiet ? 'var(--muted-foreground)' : 'var(--primary)',
                                     opacity: quiet ? 0.5 : 1 }} />
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        ) : <p className="py-4 text-center text-xs text-muted-foreground">Not available.</p>}
      </CardContent>
    </Card>
  )
}

/** Female, male, then not recorded, with a 2px surface gap between them. */
function SexSegments({ n, f, m, C }: { n: number; f: number; m: number; C: ReturnType<typeof useChartPalette> }) {
  const u = Math.max(0, n - f - m)
  const w = (v: number) => `${n ? (v / n) * 100 : 0}%`
  const gap = '2px 0 0 0 var(--card)'
  return (
    <>
      <span className="h-full" style={{ width: w(f), background: C.female, boxShadow: m || u ? gap : undefined }} />
      <span className="h-full" style={{ width: w(m), background: C.male, boxShadow: u ? gap : undefined }} />
      {u > 0 && <span className="h-full" style={{ width: w(u), background: C.unknown }} />}
    </>
  )
}

function SexLegend() {
  const C = useChartPalette()
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span>Bars are split by sex:</span>
      {[['Female', C.female], ['Male', C.male], ['Not recorded', C.unknown]].map(([l, c]) => (
        <span key={l} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: c }} aria-hidden />{l}
        </span>
      ))}
    </div>
  )
}

function Section({ eyebrow, title, description, children }: {
  eyebrow: string; title: string; description?: string; children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">{eyebrow}</span>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description && <p className="max-w-4xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  )
}

const GRID = 'grid gap-4 md:grid-cols-2 xl:grid-cols-3'

/* ──────────────────────────────────── page ─────────────────────────────────── */

export default function DeepDivePage({ onOpenWorklist }: { onOpenWorklist?: (flag: string) => void }) {
  const { query, options } = useFilters()
  const C = useChartPalette()
  const [p, setP] = useState<Profile | null>(null)
  const [fac, setFac] = useState<FacilityRow[] | null>(null)
  const [counts, setCounts] = useState<Record<string, number | null>>({})
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!options) return
    let off = false
    setLoading(true)
    Promise.all([
      api<Profile>(`/profile${query}`),
      api<FacilityRow[]>(`/breakdown/facility${query}`),
      api<{ flag: string; n: number | null }[]>(`/worklists${query}`),
    ])
      .then(([prof, facilities, wl]) => {
        if (off) return
        setP(prof); setFac(facilities)
        setCounts(Object.fromEntries(wl.map((w) => [w.flag, w.n])))
        setErr(null)
      })
      .catch((e: unknown) => { if (!off) setErr(e instanceof Error ? e.message : 'Could not load the profile') })
      .finally(() => { if (!off) setLoading(false) })
    return () => { off = true }
  }, [query, options])

  // Entering above the line, leaving below it; the line list is drawn
  // mid-month, so the last month is partial and drawn faded.
  const flowCharts = useMemo<{ flows: ChartConfiguration; stock: ChartConfiguration } | null>(() => {
    const f = p?.when?.flow   // an empty selection comes back as {"n": 0}
    if (!f?.months?.length) return null
    const last = f.months.length - 1
    const labels = f.months.map(fmtMonYY)
    const grey = cssVar('--muted-foreground', C.provisional)
    const fade = (c: string, a = 0.35) => c.startsWith('rgba(')
      ? c.replace(/,\s*[\d.]+\)$/, `, ${a})`)
      : `${c}${Math.round(a * 255).toString(16).padStart(2, '0')}`
    const col = (label: string, values: number[], color: string, out = false) => ({
      label, stack: 'flow',
      data: values.map((v) => (out ? -v : v)),
      backgroundColor: values.map((_, i) => (i === last ? fade(color) : color)),
      borderColor: cssVar('--card', '#ffffff'), borderWidth: 1, borderSkipped: false as const,
      maxBarThickness: 30, categoryPercentage: 0.78, barPercentage: 0.9,
    })
    const abs = (v: number | string) => fmt(Math.abs(Number(v)))
    return {
      flows: {
        type: 'bar',
        data: { labels, datasets: [
          col('Entered, first time', f.entered_new, C.flowIn),
          col('Entered again, after re-suppressing', f.entered_again, C.flowAgain),
          col('Left: re-suppressed', f.left_resuppressed, C.flowOut, true),
          col('Left care before a repeat VL', f.left_care, C.flowCare, true),
        ] },
        options: {
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: {
              title: (it) => `${it[0]?.label ?? ''}${it[0]?.dataIndex === last ? ' (partial month)' : ''}`,
              label: (i) => `${i.dataset.label}: ${abs(i.parsed.y)}`,
            } },
          },
          scales: {
            x: { stacked: true, grid: { display: false }, border: { display: false },
                 ticks: { maxRotation: 0, autoSkipPadding: 12 } },
            y: { stacked: true, border: { display: false },
                 ticks: { precision: 0, callback: (v) => abs(v) },
                 grid: { color: (c) => (c.tick.value === 0 ? grey : cssVar('--border', '#e6e5dd')) },
                 title: { display: true, text: 'Clients per month' } },
          },
        },
      },
      stock: {
        type: 'line',
        data: { labels, datasets: [{
          label: 'In the cohort at month end', data: f.in_cohort, borderColor: C.stock,
          backgroundColor: fade(C.stockFill, 0.35), fill: true, borderWidth: 2,
          segment: { borderDash: (c) => (c.p1DataIndex === last ? [5, 4] : undefined) },
        }] },
        options: {
          maintainAspectRatio: false,
          plugins: { legend: { display: false },
                     tooltip: { callbacks: { label: (i) => `${fmt(i.parsed.y)} clients in the cohort` } } },
          scales: {
            x: { grid: { display: false }, border: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 12 } },
            y: { beginAtZero: true, border: { display: false }, ticks: { precision: 0 } },
          },
        },
      },
    }
  }, [p, C])

  if (err) {
    return (
      <div className="flex flex-col gap-6">
        <Heading />
        <FilterBar />
        <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>
      </div>
    )
  }
  if (!p) {
    return (
      <div className="flex flex-col gap-6">
        <Heading />
        <FilterBar />
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-[26rem] w-full rounded-xl" />
      </div>
    )
  }
  if (!p.n) {
    return (
      <div className="flex flex-col gap-6">
        <Heading />
        <FilterBar />
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Microscope /></EmptyMedia>
            <EmptyTitle>No episodes in this selection</EmptyTitle>
            <EmptyDescription>Widen the filters to profile the cohort.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  const { who, what, when, care, where } = p
  const under20 = (who.paed_pct ?? 0) + (who.adolescent_pct ?? 0)

  return (
    <div className={cn('flex flex-col gap-8 transition-opacity', loading && 'opacity-60')}
         aria-busy={loading}>
      <Heading />
      <FilterBar />

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Episodes" value={fmt(p.n)} note={`${fmt(p.clients)} distinct clients`} />
        <Stat label="Median age" value={who.median_age == null ? DASH : `${fmt(who.median_age)} yr`}
              note="of the unsuppressed" />
        <Stat label="Female" value={`${who.female_pct}%`}
              note={`${fmt(who.sex.find((s) => s.level === 'Female')?.n)} episodes`} />
        <Stat label="Adolescents 10-19" value={`${who.adolescent_pct}%`}
              note={`${who.paed_pct}% are under 10`} tone={who.adolescent_pct > 10 ? 'warn' : undefined} />
        <Stat label="Median on ART" value={what.median_years_art == null ? DASH : `${what.median_years_art} yr`}
              note="at the index VL" />
        <Stat label="Median months unsuppressed" value={when.mu_stats ? String(when.mu_stats.median) : DASH}
              note="since the index VL" tone="warn" />
      </div>

      <SexLegend />

      <Section eyebrow="Who" title="The people behind the unsuppressed results"
               description="Composition of the cohort. Where a field is blank in the export it is shown as Not recorded rather than quietly dropped: the gap is itself a finding.">
        <div className={GRID}>
          <DistCard title="Sex" dist={who.sex} colors={{ Female: C.female, Male: C.male }} />
          {/* Age band only: the coarser age group repeated it. Its priority
              markings and the under-20 share moved here. */}
          <DistCard title="Age band" dist={who.age_band} note={`${under20.toFixed(1)}% are under 20`}
                    highlight={{ '0-9': 'bad', '10-19': 'warn' }} />
          <DistCard title="Marital status" dist={who.marital} />
          <DistCard title="Education" dist={who.education} />
          <DistCard title="Employment" dist={who.job} />
          <DistCard title="Pregnancy" dist={who.pregnancy} note="women only" />
        </div>
      </Section>

      <Section eyebrow="What" title="Their treatment and clinical picture"
               description="What they are on, how long for, how high the index viral load was, and how far through EAC they have moved.">
        <div className={GRID}>
          <DistCard title="Regimen line" dist={what.regimen} />
          <DistCard title="EAC status" dist={what.eac_status}
                    highlight={{ 'Never commenced': 'bad' }} />
          <DistCard title="Index VL magnitude" dist={what.vl_magnitude} />
          <DistCard title="Years on ART" dist={what.years_art} />
          <DistCard title="WHO stage" dist={what.who_stage} />
          <DistCard title="BMI" dist={what.bmi} />
          <DistCard title="Baseline CD4" dist={what.cd4}
                    note="measured at ART start, so it predates the index VL" />
          <DistCard title="Treatment plan" dist={what.plan} />
        </div>
      </Section>

      {care && (
        <Section eyebrow="Care outcome" title="Left care before a repeat VL"
                 description={`${fmt(care.neg_total)} episodes (${care.neg_pct}%) carry a negative ART status - LTFU, died, stopped, transferred out or discontinued. Of those, ${fmt(care.neg_no_followup)} have no follow-up VL at all and ${fmt(care.neg_no_post_eac)} have no post-EAC VL, so they can never re-suppress in this cohort. ${fmt(care.neg_dated)} of the exits are dated, which is what lets them be placed against the cascade.`}>
          <div className={GRID}>
            <DistCard title="When the exit happened" dist={care.exit_when} />
            <DistCard title="ART status, all episodes" dist={care.status} />
            <Card size="sm" className="min-w-0">
              <CardHeader><CardTitle className="text-sm">Never retested, by exit reason</CardTitle></CardHeader>
              <CardContent>
                {care.breakdown?.length ? (
                  <ul className="flex flex-col gap-2">
                    {care.breakdown.map((r) => (
                      <li key={r.level} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-3">
                        <span className="truncate text-xs" title={r.level}>{r.level}</span>
                        <span className="h-3 w-full rounded-[4px] bg-muted" aria-hidden>
                          <span className="block h-full rounded-[4px] bg-bad"
                                style={{ width: `${Math.min(r.no_followup_vl / (care.neg_no_followup || 1) * 100, 100)}%` }} />
                        </span>
                        <span className="text-right text-xs tabular-nums">
                          {fmt(r.no_followup_vl)}<span className="ml-1.5 text-muted-foreground">of {fmt(r.n)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="py-4 text-center text-xs text-muted-foreground">No negative outcomes recorded.</p>}
              </CardContent>
            </Card>
          </div>
          {onOpenWorklist && (
            <Button variant="link" size="sm" className="self-start px-0"
                    onClick={() => onOpenWorklist('exited_no_vl')}>
              Open worklist: left care with no follow-up VL ({fmt(care.neg_no_followup)})
              <ArrowRight />
            </Button>
          )}
        </Section>
      )}

      <Section eyebrow="When" title="Timing - when they entered and how long they wait"
               description="Dated by result received at the facility. The final month is partial, because the line list was drawn mid-month, so it is dashed rather than read as a fall.">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Clients entering and leaving the cohort</CardTitle>
              <CardDescription>
                A client enters on an unsuppressed result and leaves when it is resolved: a repeat VL
                below 1,000, or leaving care before one. A repeat result still at or above 1,000
                keeps them in. Entries above the line, exits below it.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {[['Entered, first time', C.flowIn], ['Entered again', C.flowAgain],
                  ['Left: re-suppressed', C.flowOut], ['Left care before a repeat VL', C.flowCare]]
                  .map(([l, c]) => (
                    <span key={l} className="inline-flex items-center gap-1.5">
                      <span className="size-2.5 rounded-[3px]" style={{ background: c }} aria-hidden />{l}
                    </span>
                  ))}
              </div>
              {flowCharts
                ? <Chart config={flowCharts.flows} height={280}
                         ariaLabel="Monthly clients entering the cohort above the line, and leaving it below by re-suppression or leaving care" />
                : <p className="py-10 text-center text-sm text-muted-foreground">No dated results in this selection.</p>}
              {when.flow && when.flow.resuppression_dated_by_sample > 0 && (
                <p className="text-xs text-muted-foreground">
                  {fmt(when.flow.resuppression_dated_by_sample)} re-suppressions are dated by the follow-up sample,
                  because the date the result reached the facility is blank in this upload.
                </p>
              )}
            </CardContent>
          </Card>
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>In the cohort at month end</CardTitle>
              <CardDescription>
                How many clients are still unsuppressed at the end of each month: last month's
                total, plus those who entered, minus those who re-suppressed or left care. It
                rises while more enter than leave and levels off when the two balance
                {when.flow ? `. It includes ${fmt(when.flow.in_cohort_at_start)} who entered before the first month shown` : ''}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {flowCharts
                ? <Chart config={flowCharts.stock} height={280} ariaLabel="Clients in the unsuppressed cohort at each month's end" />
                : <p className="py-10 text-center text-sm text-muted-foreground">No dated results in this selection.</p>}
            </CardContent>
          </Card>
        </div>
        <div className={GRID}>
          <DistCard title="Enrolment quarter" dist={when.quarter} />
          <DistCard title="Months unsuppressed" dist={when.months_unsupp} />
          <DistCard title="Time to EAC" dist={when.time_to_eac} />
          <DistCard title="ART start to first VL" dist={when.time_to_first_vl}
                    note={when.ttfv_months ? `median ${when.ttfv_months.median} months` : undefined} />
          <DistCard title="ART start to first unsuppressed VL" dist={when.yrs_to_unsupp}
                    note={when.ttfu_years ? `median ${when.ttfu_years.median} years` : undefined} />
          {when.wait && (
            <Card size="sm">
              <CardHeader><CardTitle className="text-sm">Wait for the repeat result</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-1 text-sm">
                <span className="text-2xl font-semibold">{when.wait.median} days</span>
                <span className="text-xs text-muted-foreground">
                  middle half {when.wait.q1} to {when.wait.q3} days, over {fmt(when.wait.n)} episodes
                  whose result is back; {fmt(when.wait.pending)} are still waiting
                </span>
              </CardContent>
            </Card>
          )}
        </div>
      </Section>

      <Section eyebrow="Where" title="Geography - where the burden sits"
               description="The map shades each LGA by where unsuppressed clients live. The cards beside it use the service LGA and facility, so comparing the two shows who travels for care.">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>LGA of residence</CardTitle>
              <CardDescription>Darker means more unsuppressed clients living there.</CardDescription>
            </CardHeader>
            <CardContent><LgaMap res={where.lga_res} /></CardContent>
          </Card>
          <div className="flex min-w-0 flex-col gap-4">
            <DistCard title="State (service)" dist={where.state} />
            <DistCard title="Top 10 LGAs (service)" dist={where.lga} />
            <DistCard title="Top 10 facilities" dist={where.facility} />
          </div>
        </div>
      </Section>

      <Section eyebrow="Facilities" title="Facility league table"
               description="Facilities with 20 or more episodes, weakest EAC commencement first. Click a heading to sort.">
        <LeagueTable fac={fac} />
      </Section>

      <Section eyebrow="Act" title="Actionable flags"
               description="Each row is a facility worklist under the current filters, most urgent first. Open one to work it.">
        <FlagsTable counts={counts} onOpenWorklist={onOpenWorklist} />
      </Section>
    </div>
  )
}

type LeagueRow = FacilityRow & { awaiting: number }

function LeagueTable({ fac }: { fac: FacilityRow[] | null }) {
  const rows: LeagueRow[] = (fac ?? []).filter((f) => f.n >= 20)
    .map((f) => ({ ...f, awaiting: Math.max(0, f.still_unsuppressed - f.switched) }))
  const { sorted, sort, toggle } = useSort(rows, (r, k) => r[k as keyof LeagueRow],
                                           { key: 'eac1_pct', dir: 'asc' })
  return (
    <Card className="min-w-0">
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <Table className="text-xs">
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                <SortHead label="Facility" k="group" sort={sort} onSort={toggle} text />
                <SortHead label="Episodes" k="n" sort={sort} onSort={toggle} align="right" />
                <SortHead label="EAC commenced" k="eac1_pct" sort={sort} onSort={toggle} align="right" className="w-44" />
                <SortHead label="Follow-up VL results" k="post_result" sort={sort} onSort={toggle} align="right" />
                <SortHead label="Re-suppressed" k="resupp_pct" sort={sort} onSort={toggle} align="right" />
                <SortHead label="Awaiting DTC review" k="awaiting" sort={sort} onSort={toggle} align="right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((f) => {
                const r = (f.eac1_pct ?? 0) / 100
                const tone = r < 0.5 ? 'var(--bad)' : r < 0.75 ? 'var(--warn)' : 'var(--good)'
                return (
                  <TableRow key={f.group}>
                    <TableCell className="font-medium">{f.group}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(f.n)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-medium tabular-nums" style={{ color: tone }}>{pc(f.eac1_pct)}</span>
                        <span className="h-2 w-20 rounded-[3px] bg-muted" aria-hidden>
                          <span className="block h-full rounded-[3px]"
                                style={{ width: `${Math.min(r * 100, 100)}%`, background: tone }} />
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(f.post_result)}</TableCell>
                    <TableCell className="text-right tabular-nums">{pc(f.resupp_pct)}</TableCell>
                    <TableCell className={cn('text-right tabular-nums', f.awaiting > 0 && 'font-medium text-bad')}>
                      {fmt(f.awaiting)}
                    </TableCell>
                  </TableRow>
                )
              })}
              {!rows.length && (
                <TableRow>
                  <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                    No facility has 20 or more episodes in this selection.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

const PRIORITY_TONE: Record<Priority, 'bad' | 'warn' | null> = { High: 'bad', Medium: 'warn', Low: null }

function FlagsTable({ counts, onOpenWorklist }: {
  counts: Record<string, number | null>
  onOpenWorklist?: (flag: string) => void
}) {
  const rows = WORKLISTS.map((w) => ({ ...w, n: counts[w.flag] ?? null }))
  const { sorted, sort, toggle } = useSort(rows, (r, k) => r[k as keyof typeof r] as unknown,
                                           { key: 'rank', dir: 'asc' })
  return (
    <Card className="min-w-0">
      <CardContent className="px-0">
        <Table className="text-xs">
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent">
              <SortHead label="Priority" k="rank" sort={sort} onSort={(k) => toggle(k, 'asc')} className="w-32" />
              <SortHead label="Worklist" k="label" sort={sort} onSort={toggle} text />
              <SortHead label="Episodes" k="n" sort={sort} onSort={toggle} align="right" />
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((w) => (
              <TableRow key={w.flag}>
                <TableCell>
                  {w.priority ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="w-4 text-muted-foreground tabular-nums">{w.rank}</span>
                      {PRIORITY_TONE[w.priority]
                        ? <StatusBadge tone={PRIORITY_TONE[w.priority]!}>{w.priority}</StatusBadge>
                        : <span className="text-muted-foreground">{w.priority}</span>}
                    </span>
                  ) : <span className="text-muted-foreground">Data check</span>}
                </TableCell>
                <TableCell className="font-medium">{w.label}</TableCell>
                <TableCell className={cn('text-right tabular-nums', !w.n && 'text-muted-foreground')}>
                  {w.n == null ? DASH : fmt(w.n)}
                </TableCell>
                <TableCell className="text-right">
                  {onOpenWorklist && (
                    <Button variant="outline" size="xs" onClick={() => onOpenWorklist(w.flag)}>Open</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function Heading() {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-balance">Deep dive</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Who the unsuppressed clients are, what treatment they are on, when they entered and
          how long they wait, and where they live and are served.
        </p>
      </div>
      <PinFiltersToggle />
    </div>
  )
}
