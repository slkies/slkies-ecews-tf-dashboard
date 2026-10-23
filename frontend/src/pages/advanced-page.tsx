import type { ChartConfiguration } from 'chart.js'
import { Gauge, HeartPulse, Percent, Sigma, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { cn } from 'cn'
import Chart from '@/components/Chart'
import FilterBar, { PinFiltersToggle } from '@/components/filter-bar'
import { KpiTile } from '@/components/kpi-tile'
import { SortHead, useSort } from '@/components/sortable'
import { StatusBadge } from '@/components/status-badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { api } from '@/core/api'
import { useFilters } from '@/core/filters'
import { DASH, fmt } from '@/core/format'
import { useChartPalette } from '@/core/palette'

type Flag = 'pos' | 'neg' | 'ns' | 'ref' | null
export interface Level {
  level: string; n: number; resupp: number; rate: number | null; ref: boolean; flag: Flag
  or_: number | null; or_lo: number | null; or_hi: number | null; or_p: number | null
  aor: number | null; aor_lo: number | null; aor_hi: number | null; aor_p: number | null
}
export interface Variable {
  key: string; label: string; type: 'categorical' | 'ordered' | 'continuous'; test: string; test_p: number | null
  levels?: Level[]
  // continuous only
  aor?: number | null; aor_lo?: number | null; aor_hi?: number | null; aor_p?: number | null; flag?: Flag
  median_resupp?: number | null; median_not?: number | null; unit?: string
}
export interface DeepDive {
  ok: boolean; reason?: string; n_model?: number; resupp_pct?: number; variables?: Variable[]
  cd4?: { coverage_pct: number; n_known: number; levels: { level: string; n: number; resupp: number; rate: number | null }[]; test: string; test_p: number | null } | null
}
export interface Risk {
  ok: boolean; reason?: string; auc?: number; baseline?: number; n_train?: number; n_scored?: number
  n_left_care?: number
  calibration?: { predicted: number; observed: number; n: number }[]
  lowest_chance?: { sn: string; facility: string | null; state: string | null; age: number | null; idx_vl: number | null; sessions: number; plan: string | null; p_resupp: number }[]
}
export interface Mortality {
  ok: boolean; n?: number; deaths?: number; crude_pct?: number
  by_eac?: { group: string; n: number; deaths: number; pct: number }[]
}

const pTxt = (p: number | null | undefined) => (p == null ? DASH : p < 0.001 ? '<0.001' : p.toFixed(3))
const ci = (o: number | null | undefined, lo: number | null | undefined, hi: number | null | undefined) =>
  o == null ? DASH : lo == null || hi == null ? '1.00 (ref)' : `${o.toFixed(2)} (${lo.toFixed(2)}–${hi.toFixed(2)})`
const FLAG_COLOUR: Record<string, string> = { pos: 'var(--good)', neg: 'var(--bad)' }

/** Every non-reference effect, one row each: the forest plot and the callouts read from this. */
function effects(vars: Variable[]) {
  return vars.flatMap((v) => v.type === 'continuous'
    ? v.aor != null ? [{ label: v.label, sub: `per ${v.unit ?? 'year'}`, aor: v.aor, lo: v.aor_lo!, hi: v.aor_hi!, flag: v.flag ?? null, or: null as Level | null }] : []
    : (v.levels ?? []).filter((L) => !L.ref && L.aor != null)
        .map((L) => ({ label: v.label, sub: L.level, aor: L.aor!, lo: L.aor_lo!, hi: L.aor_hi!, flag: L.flag, or: L })))
}

export default function AdvancedPage() {
  const { query, options } = useFilters()
  const [dd, setDd] = useState<DeepDive | null>(null)
  const [risk, setRisk] = useState<Risk | null>(null)
  const [mort, setMort] = useState<Mortality | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!options) return
    let off = false
    Promise.all([api<DeepDive>(`/deep-dive${query}`), api<Risk>(`/risk${query}`), api<Mortality>(`/mortality${query}`)])
      .then(([d, r, m]) => { if (!off) { setDd(d); setRisk(r); setMort(m); setErr(null) } })
      .catch((e: unknown) => { if (!off) setErr(e instanceof Error ? e.message : 'Could not load the models') })
    return () => { off = true }
  }, [query, options])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-balance">Advanced analytics</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Two jobs, kept apart. The first half asks which factors move re-suppression, with
            confidence intervals. The second scores the clients still awaiting a repeat viral load,
            so the least likely to re-suppress can be seen first.
          </p>
        </div>
        <PinFiltersToggle />
      </div>
      <FilterBar />
      {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}
      {dd === null ? <Skeleton className="h-96 w-full rounded-xl" /> : <Factors dd={dd} />}
      {risk === null ? <Skeleton className="h-80 w-full rounded-xl" /> : <RiskModel risk={risk} />}
      {mort?.ok && <MortalityCard m={mort} />}
    </div>
  )
}

function Factors({ dd }: { dd: DeepDive }) {
  if (!dd.ok || !dd.variables) {
    return <Alert><AlertTitle>The factor model is not available</AlertTitle><AlertDescription>{dd.reason ?? 'No data in this selection.'}</AlertDescription></Alert>
  }
  const eff = effects(dd.variables)
  // Adjusted significance first; a level significant only unadjusted is still
  // shown, marked as such, because it is a lead worth following.
  const pick = (dir: 'pos' | 'neg') => eff.flatMap((e) => {
    if (e.flag === dir) return [{ text: `${e.label}: ${e.sub}`, metric: 'AOR', v: e.aor, lo: e.lo, hi: e.hi, adjusted: true }]
    const L = e.or
    const uni = L && L.or_lo != null && L.or_hi != null && (dir === 'pos' ? L.or_lo > 1 : L.or_hi < 1)
    return uni ? [{ text: `${e.label}: ${e.sub}`, metric: 'OR', v: L.or_!, lo: L.or_lo!, hi: L.or_hi!, adjusted: false }] : []
  })
  return (
    <section aria-label="What moves re-suppression" className="flex flex-col gap-4">
      <Alert>
        <AlertTitle>Outcome: re-suppression among the retested</AlertTitle>
        <AlertDescription>
          Modelled on the {fmt(dd.n_model)} episodes with a follow-up VL, of whom {dd.resupp_pct}%
          re-suppressed. Only the retested enter the model, so it describes who re-suppresses among
          those who were tested, not everyone. Repeat failure is left out as a predictor because it
          is the outcome restated.
        </AlertDescription>
      </Alert>
      <div className="grid gap-4 lg:grid-cols-2">
        <Callout title="Protective: more re-suppression" tone="good" items={pick('pos')}
                 empty="No factor was significantly protective." />
        <Callout title="Lower re-suppression: focus here" tone="bad" items={pick('neg')}
                 empty="No factor significantly lowered re-suppression." />
      </div>
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>What moves re-suppression: adjusted odds ratios</CardTitle>
          <CardDescription>
            Each factor's adjusted odds ratio from one logistic model, holding the others constant.
            Right of the line is more likely to re-suppress, left is less. A whisker that crosses 1
            is not statistically significant. The scale is logarithmic.
          </CardDescription>
        </CardHeader>
        <CardContent><Forest eff={eff} /></CardContent>
      </Card>
      <VariableTable dd={dd} />
      {dd.cd4 && <Cd4Card c={dd.cd4} />}
    </section>
  )
}

function Callout({ title, tone, items, empty }: {
  title: string; tone: 'good' | 'bad'; empty: string
  items: { text: string; metric: string; v: number; lo: number; hi: number; adjusted: boolean }[]
}) {
  return (
    <Card size="sm" className="min-w-0">
      <CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent>
        {items.length ? (
          <ul className="flex flex-col gap-2 text-sm">
            {items.map((it) => (
              <li key={it.text} className="flex items-baseline gap-3">
                <span className={cn('w-12 shrink-0 text-right font-semibold tabular-nums', tone === 'good' ? 'text-good' : 'text-bad')}>
                  {it.v.toFixed(2)}
                </span>
                <span>
                  {it.text} <span className="text-muted-foreground">{it.metric} ({it.lo.toFixed(2)}–{it.hi.toFixed(2)}){!it.adjusted && ', unadjusted'}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">{empty}</p>}
      </CardContent>
    </Card>
  )
}

/** Log2 axis from 0.25 to 4, so halving and doubling sit the same distance from 1. */
const LO = 0.25, HI = 4
const xpos = (x: number) => ((Math.log2(Math.min(HI, Math.max(LO, x))) - Math.log2(LO)) / (Math.log2(HI) - Math.log2(LO))) * 100

function Forest({ eff }: { eff: ReturnType<typeof effects> }) {
  if (!eff.length) return <p className="text-sm text-muted-foreground">No adjusted effect could be estimated in this selection.</p>
  return (
    <div className="flex flex-col text-xs">
      <div className="grid grid-cols-[minmax(9rem,14rem)_1fr_8.5rem] items-end gap-3 pb-2 text-muted-foreground">
        <span>Factor</span>
        <span className="relative h-4">
          {[0.5, 1, 2].map((t) => (
            <span key={t} className="absolute -translate-x-1/2 tabular-nums" style={{ left: `${xpos(t)}%` }}>{t.toFixed(1)}</span>
          ))}
        </span>
        <span className="text-right">AOR (95% CI)</span>
      </div>
      {eff.map((e) => {
        const c = FLAG_COLOUR[e.flag ?? ''] ?? 'var(--muted-foreground)'
        const l = xpos(e.lo), h = xpos(e.hi)
        return (
          <div key={`${e.label}${e.sub}`} className="grid grid-cols-[minmax(9rem,14rem)_1fr_8.5rem] items-center gap-3 border-t border-border/60 py-1.5">
            <span className="min-w-0 truncate" title={`${e.label}: ${e.sub}`}>
              {e.label} <span className="text-muted-foreground">{e.sub}</span>
            </span>
            <span className="relative h-5" role="img"
                  aria-label={`${e.label} ${e.sub}: adjusted odds ratio ${e.aor.toFixed(2)}, 95% CI ${e.lo.toFixed(2)} to ${e.hi.toFixed(2)}${e.flag === 'pos' ? ', significantly higher re-suppression' : e.flag === 'neg' ? ', significantly lower re-suppression' : ', not significant'}`}>
              <span className="absolute inset-y-0 w-px bg-border" style={{ left: '50%' }} />
              <span className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full" style={{ left: `${l}%`, width: `${Math.max(0, h - l)}%`, background: c }} />
              <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card" style={{ left: `${xpos(e.aor)}%`, background: c }} />
            </span>
            <span className="text-right tabular-nums">{e.aor.toFixed(2)} <span className="text-muted-foreground">({e.lo.toFixed(2)}–{e.hi.toFixed(2)})</span></span>
          </div>
        )
      })}
    </div>
  )
}

function SigBadge({ flag }: { flag: Flag }) {
  if (flag === 'pos') return <StatusBadge tone="good">Higher</StatusBadge>
  if (flag === 'neg') return <StatusBadge tone="bad">Lower</StatusBadge>
  if (flag === 'ref') return <span className="text-muted-foreground">Reference</span>
  return <span className="text-muted-foreground">Not significant</span>
}

function VariableTable({ dd }: { dd: DeepDive }) {
  const rows = useMemo(() => (dd.variables ?? []).flatMap((v, vi) => v.type === 'continuous'
    ? [{ i: vi * 100, variable: v.label, test: v.test, test_p: v.test_p, level: `per ${v.unit ?? 'year'} on ART`,
         note: `median ${v.median_resupp ?? DASH} vs ${v.median_not ?? DASH}`, n: dd.n_model ?? null, rate: null as number | null,
         or_: null as number | null, or_lo: null as number | null, or_hi: null as number | null,
         aor: v.aor ?? null, aor_lo: v.aor_lo ?? null, aor_hi: v.aor_hi ?? null, p: v.aor_p ?? null, flag: v.flag ?? null, ref: false }]
    : (v.levels ?? []).map((L, li) => ({ i: vi * 100 + li, variable: v.label, test: v.test, test_p: v.test_p, level: L.level, note: '',
         n: L.n, rate: L.rate, or_: L.or_, or_lo: L.or_lo, or_hi: L.or_hi, aor: L.aor, aor_lo: L.aor_lo, aor_hi: L.aor_hi,
         p: L.aor_p, flag: L.ref ? 'ref' as Flag : L.flag, ref: L.ref }))), [dd])
  const { sorted, sort, toggle } = useSort(rows, (r, k) => r[k as keyof typeof r] as unknown, { key: 'i', dir: 'asc' })
  const grouped = sort?.key === 'i'
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Every variable, univariate and adjusted</CardTitle>
        <CardDescription>
          Group re-suppression rate, unadjusted odds ratio, and adjusted odds ratio with 95% CI. The
          per-variable test is chi-square (categorical), a Cochran-Armitage trend (ordered) or
          Mann-Whitney (continuous). The reference level in each variable has odds 1. Sorting a
          column lists the levels across variables; sort Variable to group them again.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <Table className="text-xs">
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                <SortHead label="Variable" k="i" sort={sort} onSort={(k) => toggle(k, 'asc')} text />
                <SortHead label="Level" k="level" sort={sort} onSort={toggle} text />
                <SortHead label="n" k="n" sort={sort} onSort={toggle} align="right" />
                <SortHead label="Re-suppressed" k="rate" sort={sort} onSort={toggle} align="right" />
                <SortHead label="Unadjusted OR" k="or_" sort={sort} onSort={toggle} align="right" />
                <SortHead label="Adjusted OR" k="aor" sort={sort} onSort={toggle} align="right" />
                <SortHead label="p (adjusted)" k="p" sort={sort} onSort={toggle} align="right" />
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((r, j) => {
                const first = !grouped || j === 0 || sorted[j - 1]!.variable !== r.variable
                return (
                  <TableRow key={r.i} className={cn(grouped && first && j > 0 && 'border-t-2')}>
                    <TableCell className="align-top">
                      {first && (
                        <span className="flex flex-col">
                          <span className="font-medium">{r.variable}</span>
                          <span className="text-muted-foreground">{r.test}, p={pTxt(r.test_p)}</span>
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{r.level}{r.note && <span className="text-muted-foreground"> ({r.note})</span>}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(r.n)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.rate == null ? DASH : `${r.rate}%`}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.ref ? '1.00 (ref)' : ci(r.or_, r.or_lo, r.or_hi)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.ref ? '1.00 (ref)' : ci(r.aor, r.aor_lo, r.aor_hi)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.ref ? '' : pTxt(r.p)}</TableCell>
                    <TableCell><SigBadge flag={r.flag} /></TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

function Cd4Card({ c }: { c: NonNullable<DeepDive['cd4']> }) {
  const total = c.levels.reduce((a, b) => a + b.n, 0)
  const colour = (l: string) => (l === '<200' ? 'var(--bad)' : l === 'Not recorded' ? 'var(--muted-foreground)' : 'var(--icon)')
  const sig = c.test_p != null && c.test_p < 0.05
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Baseline CD4 at ART start</CardTitle>
        <CardDescription>
          Measured at ART initiation, so it predates the index viral load and cannot have been
          caused by this failure. The quantitative assay and the semi-quantitative VISITEC LFA are
          merged onto a split at 200 cells/mm³. It is not in the model: only {c.coverage_pct}% of
          episodes carry a CD4 ({fmt(c.n_known)} of {fmt(total)}), so modelling it would shrink the
          sample or add a "missing" group. Crude rates only.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {c.levels.map((L) => (
          <div key={L.level} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span>{L.level}{L.level !== 'Not recorded' && <span className="text-muted-foreground"> cells/mm³</span>}</span>
              <span className="tabular-nums"><span className="font-medium">{L.rate == null ? DASH : `${L.rate}%`}</span>
                <span className="text-muted-foreground"> re-suppressed, {fmt(L.resupp)} of {fmt(L.n)}</span></span>
            </div>
            <span className="h-[18px] w-full overflow-hidden rounded-[5px] bg-muted" aria-hidden>
              <span className="block h-full rounded-[5px]" style={{ width: `${Math.min(L.rate ?? 0, 100)}%`, background: colour(L.level) }} />
            </span>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          {c.test} across the recorded bands: p={pTxt(c.test_p)}.{' '}
          {sig ? 'Lower baseline CD4 goes with lower re-suppression. Worth confirming once CD4 coverage improves.'
               : 'No significant difference between the bands.'}
        </p>
      </CardContent>
    </Card>
  )
}

function RiskModel({ risk }: { risk: Risk }) {
  const C = useChartPalette()
  const cal = useMemo<ChartConfiguration | null>(() => {
    if (!risk.calibration?.length) return null
    return {
      type: 'scatter',
      data: { datasets: [
        { label: 'Observed', data: risk.calibration.map((c) => ({ x: c.predicted, y: c.observed })),
          backgroundColor: C.flowIn, borderColor: C.flowIn, pointRadius: 5, pointHoverRadius: 7 },
        { type: 'line', label: 'Perfect calibration', data: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
          borderColor: C.provisional, borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0 },
      ] },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { filter: (i) => i.datasetIndex === 0, callbacks: {
            label: (i) => `Predicted ${(i.parsed.x ?? 0).toFixed(1)}%, observed ${(i.parsed.y ?? 0).toFixed(1)}%`,
          } },
        },
        scales: {
          x: { type: 'linear', min: 0, max: 100, border: { display: false }, title: { display: true, text: 'Predicted re-suppression' }, ticks: { callback: (v) => `${v}%` } },
          y: { min: 0, max: 100, border: { display: false }, title: { display: true, text: 'Observed re-suppression' }, ticks: { callback: (v) => `${v}%` } },
        },
      },
    }
  }, [risk, C])

  if (!risk.ok) {
    return <Alert><AlertTitle>The scoring model was not fitted</AlertTitle><AlertDescription>{risk.reason}</AlertDescription></Alert>
  }
  const auc = risk.auc ?? 0
  return (
    <section aria-label="Scoring the clients awaiting a repeat VL" className="flex flex-col gap-4">
      <Alert>
        <AlertTitle>Read this before acting on the scores</AlertTitle>
        <AlertDescription>
          The model is fitted only on the {fmt(risk.n_train)} episodes that have a post-EAC VL
          result, so it describes who re-suppresses among those who were retested. Clients who left
          care before a repeat VL are not scored{risk.n_left_care ? ` (${fmt(risk.n_left_care)} in this selection)` : ''}:
          no sample can be drawn from them.
        </AlertDescription>
      </Alert>
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiTile icon={Gauge} label="Model AUC" value={auc.toFixed(3)} note="how well it separates the two outcomes"
                 status={<StatusBadge tone={auc > 0.7 ? 'good' : auc > 0.6 ? 'warn' : 'bad'}>{auc > 0.7 ? 'Good' : auc > 0.6 ? 'Modest' : 'Weak'}</StatusBadge>} />
        <KpiTile icon={Percent} label="Baseline re-suppression" value={`${risk.baseline}%`} note={`${fmt(risk.n_train)} episodes with a result`} />
        <KpiTile icon={Users} label="Episodes scored" value={fmt(risk.n_scored)} note="in care, awaiting a post-EAC VL" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Model calibration</CardTitle>
            <CardDescription>
              Predicted against observed re-suppression, by tenth of predicted chance. Points on
              the dashed diagonal mean the model is honest about its own uncertainty.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {cal ? <Chart config={cal} height={300} ariaLabel="Scatter of observed against predicted re-suppression by decile, with the diagonal of perfect calibration" />
                 : <p className="py-10 text-center text-sm text-muted-foreground">No calibration in this selection.</p>}
          </CardContent>
        </Card>
        <LowestChance rows={risk.lowest_chance ?? []} />
      </div>
    </section>
  )
}

function LowestChance({ rows }: { rows: NonNullable<Risk['lowest_chance']> }) {
  const data = rows.map((r) => ({ ...r, code: r.plan?.slice(0, 1) ?? null }))
  const { sorted, sort, toggle } = useSort(data, (r, k) => r[k as keyof typeof r] as unknown, { key: 'p_resupp', dir: 'asc' })
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Least likely to re-suppress, still awaiting a post-EAC VL</CardTitle>
        <CardDescription>
          Scored by the model. Chase these for a repeat sample first, and prepare them for switch
          review. The {fmt(rows.length)} lowest are listed.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {!rows.length ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">Every episode here already has a post-EAC VL.</p>
        ) : (
          <div className="max-h-[420px] overflow-auto">
            <Table className="text-xs">
              <TableHeader className="sticky top-0 z-10 bg-muted">
                <TableRow className="hover:bg-transparent">
                  <SortHead label="Client" k="sn" sort={sort} onSort={toggle} text />
                  <SortHead label="Facility" k="facility" sort={sort} onSort={toggle} text />
                  <SortHead label="Age" k="age" sort={sort} onSort={toggle} align="right" />
                  <SortHead label="Index VL" k="idx_vl" sort={sort} onSort={toggle} align="right" />
                  <SortHead label="Sessions" k="sessions" sort={sort} onSort={toggle} align="right" />
                  <SortHead label="Plan" k="code" sort={sort} onSort={toggle} text />
                  <SortHead label="Chance" k="p_resupp" sort={sort} onSort={toggle} className="w-40" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((r) => {
                  const col = r.p_resupp < 70 ? 'var(--bad)' : r.p_resupp < 88 ? 'var(--warn)' : 'var(--icon)'
                  return (
                    <TableRow key={r.sn}>
                      {/* S/N is a pseudonymous key, shortened for width as on the worklists. */}
                      <TableCell className="font-mono text-muted-foreground" title={r.sn}>{r.sn.slice(0, 10)}…</TableCell>
                      <TableCell className="max-w-[14rem] truncate" title={r.facility ?? undefined}>{r.facility ?? DASH}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.age ?? DASH}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(r.idx_vl)}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.sessions}</TableCell>
                      <TableCell title={r.plan ?? undefined}>{r.code ?? DASH}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <span className="w-10 text-right font-medium tabular-nums" style={{ color: col }}>{r.p_resupp}%</span>
                          <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                            <span className="block h-full rounded-full" style={{ width: `${r.p_resupp}%`, background: col }} />
                          </span>
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function MortalityCard({ m }: { m: Mortality }) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Mortality in the unsuppressed cohort</CardTitle>
        <CardDescription>
          Deaths recorded against the episodes in this selection. These are crude rates, not
          adjusted for time in care: completing EAC takes months, so the two EAC groups were
          followed for different lengths of time and are not directly comparable.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <section aria-label="Mortality" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiTile icon={HeartPulse} label="Deaths" value={fmt(m.deaths)} note={`of ${fmt(m.n)} episodes`} />
          <KpiTile icon={Sigma} label="Crude mortality" value={`${m.crude_pct}%`} note="in the unsuppressed cohort" />
          {(m.by_eac ?? []).map((g) => (
            <KpiTile key={g.group} icon={HeartPulse} label={g.group} value={`${g.pct}%`} note={`${fmt(g.deaths)} of ${fmt(g.n)}`} />
          ))}
        </section>
      </CardContent>
    </Card>
  )
}
