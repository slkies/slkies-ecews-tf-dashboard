import { ClipboardList } from 'lucide-react'
import { useEffect, useState } from 'react'
import FilterBar, { PinFiltersToggle } from '@/components/filter-bar'
import { SexLegend, SexSegments } from '@/components/sex-bar'
import { SortHead, useSort } from '@/components/sortable'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import {
  Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHeader, TableRow,
} from '@/components/ui/table'
import { api } from '@/core/api'
import { useFilters } from '@/core/filters'
import { DASH, fmt } from '@/core/format'
import { useChartPalette } from '@/core/palette'
import { ClientTable, type ClientRow } from './worklists-page'

export interface PlanCount { plan: string; n: number; pct: number; n_female?: number; n_male?: number }

/**
 * Why an episode lands on each plan. These restate the conditions in _plan()
 * (indicators.py, spec section 6) in clinical terms. The tree is checked in
 * the order H, E, F, D, A, B, C, G, so each episode gets exactly one plan;
 * the page lists them by letter, which follows the clinical flow.
 */
export const PLAN_WHY: Record<string, string> = {
  A: 'Index VL within the last 6 months, and no EAC session on record.',
  B: 'Index VL within the last 6 months; EAC started but not completed.',
  C: 'Index VL more than 6 months ago, with no follow-up result to act on.',
  D: 'Follow-up VL below 1,000 copies/mL: re-suppressed.',
  E: 'A recoverable negative outcome: interrupted, stopped, lost to follow-up or discontinued.',
  F: 'Follow-up VL still 1,000 copies/mL or more after completed EAC.',
  G: 'Meets none of the conditions above, usually because the index VL date is missing.',
  H: 'Died or transferred out, so no clinical action is possible at this facility.',
}

const ROW_LIMIT = 5000
const letter = (plan: string) => (/^[A-H]\./.test(plan) ? plan[0]! : 'G')
const action = (plan: string) => plan.replace(/^[A-H]\.\s*/, '')

export default function PlansPage() {
  const { query, options } = useFilters()
  const [plans, setPlans] = useState<PlanCount[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [rows, setRows] = useState<ClientRow[] | null>(null)
  const [loadingRows, setLoadingRows] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!options) return
    let off = false
    api<PlanCount[]>(`/plans${query}`)
      .then((r) => { if (!off) { setPlans(r); setErr(null) } })
      .catch((e: unknown) => { if (!off) setErr(e instanceof Error ? e.message : 'Could not load the plans') })
    return () => { off = true }
  }, [query, options])

  // The clients on the open plan: the same filtered query, narrowed to it.
  const planQuery = open ? `${query}${query ? '&' : '?'}plan=${encodeURIComponent(open)}` : ''
  useEffect(() => {
    if (!open || !options) { setRows(null); return }
    let off = false
    setLoadingRows(true)
    api<ClientRow[]>(`/clients${planQuery}&limit=${ROW_LIMIT}`)
      .then((r) => { if (!off) { setRows(r); setErr(null) } })
      .catch((e: unknown) => { if (!off) setErr(e instanceof Error ? e.message : 'Could not load the clients') })
      .finally(() => { if (!off) setLoadingRows(false) })
    return () => { off = true }
  }, [open, planQuery, options])

  const total = plans?.find((p) => p.plan === open)?.n ?? null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-balance">Treatment plans</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Every episode receives exactly one plan from a priority-ordered decision tree. Each row
            gives the reason the plan applies, then the action it calls for. Choose a plan to see
            its clients.
          </p>
        </div>
        <PinFiltersToggle />
      </div>
      <FilterBar />

      {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}

      {plans === null ? (
        <Skeleton className="h-96 w-full rounded-xl" />
      ) : !plans.length ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><ClipboardList /></EmptyMedia>
            <EmptyTitle>No episodes in this selection</EmptyTitle>
            <EmptyDescription>Widen the filters to see the plans.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <PlanTable plans={plans} open={open} onOpen={(p) => setOpen((cur) => (cur === p ? null : p))} />
      )}

      {/* A grid track of minmax(0, 1fr) keeps the wide client table to the
          page width; it scrolls inside its card instead of widening the page. */}
      {open && (
        <div className="grid grid-cols-[minmax(0,1fr)]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-balance">{action(open)}</CardTitle>
            <CardDescription>
              Plan {letter(open)} · {total == null ? DASH : `${fmt(total)} ${total === 1 ? 'episode' : 'episodes'}`}
              {total != null && total > ROW_LIMIT && ` · the table shows the first ${fmt(ROW_LIMIT)}; export for the full list`}
            </CardDescription>
            <CardAction><ClipboardList className="size-5 text-muted-foreground" aria-hidden /></CardAction>
          </CardHeader>
          <CardContent>
            {rows === null || (loadingRows && !rows.length) ? (
              <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading the clients">
                {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-9 w-full" />)}
              </div>
            ) : !rows.length ? (
              <p className="text-sm text-muted-foreground">No client is on this plan under the current filters.</p>
            ) : (
              <ClientTable key={planQuery} rows={rows} loading={loadingRows}
                           exportPath={`/export${planQuery}`} caption={open} />
            )}
          </CardContent>
        </Card>
        </div>
      )}
    </div>
  )
}

function PlanTable({ plans, open, onOpen }: {
  plans: PlanCount[]; open: string | null; onOpen: (plan: string) => void
}) {
  const C = useChartPalette()
  const rows = plans.map((p) => ({ ...p, code: letter(p.plan) }))
  const { sorted, sort, toggle } = useSort(rows, (r, k) => r[k as keyof typeof r] as unknown,
                                           { key: 'code', dir: 'asc' })
  const max = Math.max(1, ...rows.map((r) => r.n))
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Plan by plan</CardTitle>
        <CardDescription>Listed by letter, which follows the clinical flow. Every column sorts.</CardDescription>
        <div className="pt-1"><SexLegend /></div>
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <Table className="text-xs">
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                <SortHead label="Plan" k="code" sort={sort} onSort={(k) => toggle(k, 'asc')} className="w-16" text />
                <SortHead label="Reason and action" k="plan" sort={sort} onSort={toggle} text />
                <SortHead label="Episodes" k="n" sort={sort} onSort={toggle} align="right" />
                <SortHead label="Share" k="pct" sort={sort} onSort={toggle} align="right" />
                <SortHead label="By sex" k="n_female" sort={sort} onSort={toggle} className="w-[22%] min-w-36" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((p) => {
                const on = p.plan === open
                return (
                  <TableRow key={p.plan} data-state={on ? 'selected' : undefined}
                            className="cursor-pointer" onClick={() => onOpen(p.plan)}>
                    <TableCell>
                      <span className="flex size-7 items-center justify-center rounded-md bg-[color-mix(in_oklch,var(--icon)_14%,transparent)] text-sm font-semibold text-[var(--icon)]">
                        {p.code}
                      </span>
                    </TableCell>
                    <TableCell className="min-w-[22rem] whitespace-normal">
                      {/* The button carries the keyboard and screen-reader path;
                          the row click is a convenience for the mouse. */}
                      <button type="button" aria-pressed={on} className="flex flex-col gap-0.5 text-left"
                              onClick={(e) => { e.stopPropagation(); onOpen(p.plan) }}>
                        <span className="text-muted-foreground">{PLAN_WHY[p.code] ?? ''}</span>
                        <span className="text-sm font-medium">{action(p.plan)}</span>
                      </button>
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium tabular-nums">{fmt(p.n)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{p.pct}%</TableCell>
                    <TableCell>
                      <span className="flex h-[18px] w-full overflow-hidden rounded-[5px] bg-muted" aria-hidden>
                        <span className="flex h-full overflow-hidden rounded-[5px]" style={{ width: `${(p.n / max) * 100}%` }}>
                          <SexSegments n={p.n} f={p.n_female ?? 0} m={p.n_male ?? 0} C={C} />
                        </span>
                      </span>
                      <span className="sr-only">{fmt(p.n_female)} female, {fmt(p.n_male)} male</span>
                    </TableCell>
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
