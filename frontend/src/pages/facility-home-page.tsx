/**
 * The page a facility account lands on (CDC session, 4 Nov 2026: "facilities
 * will see a module specific to them"; the full dashboard was called too busy
 * for facility staff). Top to bottom: what needs doing this week, the full
 * cascade, the facility's own data-quality findings, and a way to tell the team.
 *
 * The server already limits a facility account to its own rows, so the filters
 * here only narrow within the facility, and state, LGA of service and facility
 * are not offered.
 */
import { ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { FeedbackForm } from '@/components/account-dialogs'
import { ClientKey } from '@/components/client-record'
import FilterBar, { PinFiltersToggle } from '@/components/filter-bar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/core/api'
import { useFilters, type FilterKey } from '@/core/filters'
import { DASH, fmt, fmtDate } from '@/core/format'
import { useSession } from '@/core/session'
import CascadePage from '@/pages/cascade-page'
import { SEVERITY_RANK, SeverityMark, type DqRow } from '@/pages/data-quality-page'
import { PriorityMark, WORKLISTS, type ClientRow } from '@/pages/worklists-page'

/** The filters that still mean something inside one facility. */
export const FACILITY_FILTERS: FilterKey[] = ['fy', 'quarter', 'month', 'lga_res', 'sex', 'age_band', 'plan']

interface Counts { flag: string; n: number | null }

const NEEDS_ACTION = WORKLISTS.filter((w) => w.group === 'Needs action')
  .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
/** The longest-waiting clients are drawn from the most urgent list with anyone on it, High or Medium only. */
const URGENT = NEEDS_ACTION.filter((w) => w.priority === 'High' || w.priority === 'Medium')
const SHOW_CLIENTS = 5

export default function FacilityHomePage({ onOpenWorklist }: { onOpenWorklist: (flag: string) => void }) {
  const { me } = useSession()
  const { query, options } = useFilters()
  const [counts, setCounts] = useState<Counts[] | null>(null)
  const [dq, setDq] = useState<DqRow[] | null>(null)
  const [longest, setLongest] = useState<{ key: string; rows: ClientRow[] } | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!options) return            // wait for the filters, or the first call is unfiltered
    let off = false
    api<Counts[]>(`/worklists${query}`)
      .then((c) => { if (!off) { setCounts(c); setErr(null) } })
      .catch((e: unknown) => { if (!off) setErr(e instanceof Error ? e.message : 'Could not load') })
    api<DqRow[]>(`/dq/scoped${query}`)
      .then((r) => { if (!off) setDq(Array.isArray(r) ? r : []) })
      .catch(() => { if (!off) setDq([]) })
    return () => { off = true }
  }, [query, options])

  const n = (flag: string) => counts?.find((c) => c.flag === flag)?.n ?? 0
  const first = counts ? URGENT.find((w) => n(w.flag) > 0) : undefined
  const longestKey = first ? `${first.flag}${query}` : null

  useEffect(() => {
    if (!first || !longestKey) return
    let off = false
    const sep = query ? '&' : '?'
    api<ClientRow[]>(`/clients${query}${sep}flag=${first.flag}&limit=5000`)
      .then((rows) => {
        if (off) return
        const sorted = [...rows].sort((a, b) => (b.months_unsuppressed ?? -1) - (a.months_unsuppressed ?? -1))
        setLongest({ key: longestKey, rows: sorted.slice(0, SHOW_CLIENTS) })
      })
      .catch(() => { if (!off) setLongest(null) })
    return () => { off = true }
  }, [first, longestKey, query])

  const onList = NEEDS_ACTION.filter((w) => n(w.flag) > 0)
  const empty = NEEDS_ACTION.length - onList.length
  const findings = (dq ?? []).filter((r) => r.n_records > 0)
    .sort((a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9) || b.n_records - a.n_records)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">Facility home</span>
          <h1 className="text-2xl font-bold tracking-tight text-balance">{me?.scope_facility ?? 'Your facility'}</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            What needs doing at this facility, the cascade from an unsuppressed result to its outcome,
            and the records to correct. Everything follows the filters below.
          </p>
        </div>
        <PinFiltersToggle />
      </div>

      <FilterBar fields={FACILITY_FILTERS} />
      {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Needs action</CardTitle>
          <CardDescription>
            {counts === null ? 'Loading the lists.'
              : onList.length === 0 ? 'No client is on any action list. Nothing is overdue.'
              : `${onList.length} of ${NEEDS_ACTION.length} lists have clients on them, most urgent first.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {counts === null ? <div className="px-6 pb-6"><Skeleton className="h-40 w-full" /></div> : (
            <ul className="divide-y border-t">
              {onList.map((w) => (
                <li key={w.flag}>
                  <button type="button" onClick={() => onOpenWorklist(w.flag)}
                          className="grid w-full grid-cols-[4.5rem_minmax(0,1fr)_auto_auto] items-center gap-3 px-6 py-3 text-left hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none">
                    <PriorityMark priority={w.priority} />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm font-medium">{w.label}</span>
                      <span className="text-xs text-muted-foreground">{w.next}</span>
                    </span>
                    <span className="text-lg font-semibold tabular-nums">{fmt(n(w.flag))}</span>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  </button>
                </li>
              ))}
              {empty > 0 && onList.length > 0 && (
                <li className="px-6 py-3 text-xs text-muted-foreground">
                  {empty === 1 ? 'One other list is' : `${empty} other lists are`} empty.
                </li>
              )}
            </ul>
          )}
        </CardContent>
      </Card>

      {first && longest?.key === longestKey && longest.rows.length > 0 && (
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Longest unsuppressed: {first.label.charAt(0).toLowerCase() + first.label.slice(1)}</CardTitle>
            <CardDescription>
              The {longest.rows.length === 1 ? 'client' : `${longest.rows.length} clients`} on the most urgent list who
              have been unsuppressed longest. Open a client for their record.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <ul className="divide-y rounded-lg border">
              {longest.rows.map((r) => (
                <li key={r.episode} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-sm sm:grid-cols-[8rem_minmax(0,1fr)_auto]">
                  <ClientKey sn={r.sn} />
                  <span className="hidden text-muted-foreground sm:inline">
                    {[r.sex, r.age == null ? null : `${r.age} years`].filter(Boolean).join(', ') || DASH}
                    {r.next_visit ? ` · next visit ${fmtDate(r.next_visit)}` : ''}
                  </span>
                  <span className="tabular-nums">
                    {r.months_unsuppressed == null ? DASH : `${fmt(r.months_unsuppressed)} months`}
                  </span>
                </li>
              ))}
            </ul>
            <Button variant="outline" size="sm" className="self-start" onClick={() => onOpenWorklist(first.flag)}>
              Open the full list ({fmt(n(first.flag))})
            </Button>
          </CardContent>
        </Card>
      )}

      <section aria-labelledby="facility-cascade" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="facility-cascade" className="text-xl font-semibold tracking-tight">The treatment failure cascade</h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            From an unsuppressed viral load through EAC, the follow-up viral load and its outcome.
            Where a worklist holds the clients in a gap, open it from the step.
          </p>
        </div>
        <CascadePage embedded onOpenWorklist={onOpenWorklist} />
      </section>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Data quality at this facility</CardTitle>
          <CardDescription>
            {dq === null ? 'Checking the records.'
              : findings.length === 0 ? 'No record problem found in this selection.'
              : `${findings.length} ${findings.length === 1 ? 'check finds' : 'checks find'} records to look at. Correct them in the EMR; they clear on the next weekly refresh. Data-quality follow-up is coordinated by the HQ-HI team.`}
          </CardDescription>
        </CardHeader>
        {findings.length > 0 && (
          <CardContent className="p-0">
            <ul className="divide-y border-t">
              {findings.map((r) => (
                <li key={r.check_name} className="grid gap-1 px-6 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-6">
                  <span className="flex flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-2 text-sm font-medium">{r.check_name}<SeverityMark s={r.severity} /></span>
                    <span className="text-xs text-muted-foreground">{r.detail}</span>
                  </span>
                  <span className="text-sm tabular-nums sm:text-right">{fmt(r.n_records)} {r.n_records === 1 ? 'record' : 'records'}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        )}
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Send feedback</CardTitle>
          <CardDescription>
            Tell the TF Monitor team about a problem with this page, a figure that looks wrong, or
            something your facility needs. It reaches the dashboard admins. Please do not include
            client identifiers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FeedbackForm page={`Facility home (${me?.scope_facility ?? 'facility'})`} />
        </CardContent>
      </Card>
    </div>
  )
}
