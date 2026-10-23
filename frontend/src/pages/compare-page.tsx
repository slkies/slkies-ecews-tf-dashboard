import { ArrowDown, ArrowRight, ArrowUp, CalendarRange, GitCompareArrows, Layers, Minus, UserMinus, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from 'cn'
import FilterBar, { PinFiltersToggle } from '@/components/filter-bar'
import { KpiTile } from '@/components/kpi-tile'
import { SortHead, useSort } from '@/components/sortable'
import { StatusBadge } from '@/components/status-badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import {
  Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from '@/components/ui/empty'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { api } from '@/core/api'
import { useFilters } from '@/core/filters'
import { fmt, fmtDate } from '@/core/format'

export interface Upload {
  id: number; filename: string | null; as_of: string; uploaded_at: string
  status: string; is_current?: boolean; n_cohort?: number | null
}
export interface Comparison {
  ok: boolean; reason?: string
  a?: { id: number; filename: string | null; as_of: string; n: number }
  b?: { id: number; filename: string | null; as_of: string; n: number }
  days_between?: number; back_dated?: boolean
  flow?: { new: number; gone: number; carried: number }
  metrics?: { metric: string; a: number; b: number; delta: number; retreat: boolean; explained_by_date: boolean }[]
}

const label = (u: Upload) =>
  `${fmtDate(u.as_of)} · ${(u.filename ?? '').slice(0, 34)}${u.is_current ? ' (current)' : ''}`

export default function ComparePage() {
  const { query, options } = useFilters()
  const [ups, setUps] = useState<Upload[] | null>(null)
  const [a, setA] = useState<string | null>(null)
  const [b, setB] = useState<string | null>(null)
  const [d, setD] = useState<Comparison | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // The snapshots, newest first. Default: the newest against the most recent
  // list with a DIFFERENT as-of date - the previous upload is often a re-load
  // of the same workbook, and comparing it with itself shows only zeros.
  useEffect(() => {
    let off = false
    api<Upload[]>('/uploads')
      .then((r) => {
        if (off) return
        const ready = r.filter((u) => u.status === 'ready')
        setUps(ready)
        const newest = ready[0]
        const prior = newest && (ready.find((u) => u.as_of !== newest.as_of) ?? ready[1])
        if (newest && prior) { setB(String(newest.id)); setA(String(prior.id)) }
      })
      .catch((e: unknown) => { if (!off) setErr(e instanceof Error ? e.message : 'Could not load the line lists') })
    return () => { off = true }
  }, [])

  useEffect(() => {
    if (!options || !a || !b || a === b) { setD(null); return }
    let off = false
    setLoading(true)
    api<Comparison>(`/compare${query}${query ? '&' : '?'}a=${a}&b=${b}`)
      .then((r) => { if (!off) { setD(r); setErr(null) } })
      .catch((e: unknown) => { if (!off) setErr(e instanceof Error ? e.message : 'The comparison failed') })
      .finally(() => { if (!off) setLoading(false) })
    return () => { off = true }
  }, [a, b, query, options])

  const items = (ups ?? []).map((u) => ({ value: String(u.id), label: label(u) }))
  const picker = (title: string, value: string | null, set: (v: string) => void) => (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs text-muted-foreground sm:max-w-md">
      {title}
      <Select items={items} value={value} onValueChange={(v) => v && set(String(v))}>
        <SelectTrigger aria-label={title} className="w-full"><SelectValue placeholder="Choose a line list" /></SelectTrigger>
        <SelectContent>
          {items.map((it) => <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </label>
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-balance">Line list changes</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Every upload is kept as a dated snapshot, so the movement between any two can be read
            directly. For a given episode these steps only ever move forward, so a fall is either a
            snapshot dated earlier or something worth investigating. The filters below apply.
          </p>
        </div>
        <PinFiltersToggle />
      </div>
      <FilterBar />

      {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}

      {ups === null ? (
        <Skeleton className="h-24 w-full rounded-xl" />
      ) : ups.length < 2 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><GitCompareArrows /></EmptyMedia>
            <EmptyTitle>Only one line list so far</EmptyTitle>
            <EmptyDescription>A comparison needs two. The next upload will make this page work.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-wrap items-end gap-3">
              {picker('Earlier line list', a, setA)}
              <ArrowRight className="mb-2 hidden size-4 text-muted-foreground sm:block" aria-hidden />
              {picker('Later line list', b, setB)}
            </CardContent>
          </Card>

          {a === b ? (
            <Alert><AlertTitle>Same line list twice</AlertTitle>
              <AlertDescription>Pick two different snapshots to see the movement.</AlertDescription></Alert>
          ) : !d ? (
            <Skeleton className="h-80 w-full rounded-xl" />
          ) : !d.ok ? (
            <Alert><AlertTitle>Nothing to compare</AlertTitle><AlertDescription>{d.reason}</AlertDescription></Alert>
          ) : (
            <div className={cn('flex flex-col gap-6 transition-opacity', loading && 'opacity-60')} aria-busy={loading}>
              {/* A back-dated pair is the likeliest cause of a fall, so it is said first. */}
              {d.back_dated && (
                <Alert>
                  <AlertTitle>The later list is dated earlier</AlertTitle>
                  <AlertDescription>
                    These snapshots run backwards in time by {Math.abs(d.days_between ?? 0)} days. Steps
                    that need elapsed time - completed EAC above all, which needs 30 days since session
                    3 - will fall for that reason alone. That is arithmetic, not lost data.
                  </AlertDescription>
                </Alert>
              )}
              <section aria-label="Movement between the line lists" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiTile icon={CalendarRange} label="Days apart" value={fmt(d.days_between)}
                         note={`${fmtDate(d.a!.as_of)} to ${fmtDate(d.b!.as_of)}`} />
                <KpiTile icon={Layers} label="Episodes carried over" value={fmt(d.flow!.carried)}
                         note="present in both lists" />
                <KpiTile icon={UserPlus} label="New episodes" value={fmt(d.flow!.new)}
                         note="only in the later list" />
                <KpiTile icon={UserMinus} label="No longer present" value={fmt(d.flow!.gone)}
                         note="only in the earlier list"
                         status={d.flow!.gone ? <StatusBadge tone="warn">Check why</StatusBadge> : undefined} />
              </section>
              <Movement d={d} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Movement({ d }: { d: Comparison }) {
  const rows = d.metrics ?? []
  const { sorted, sort, toggle } = useSort(rows, (r, k) => r[k as keyof typeof r] as unknown)
  const span = Math.max(1, ...rows.map((r) => Math.abs(r.delta)))
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Cascade movement</CardTitle>
        <CardDescription>
          The number of episodes at each step in each line list, under the current filters. A step
          that went backwards is marked; where the later list is dated earlier, that is said too.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <Table className="text-xs">
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                <SortHead label="Step" k="metric" sort={sort} onSort={toggle} text />
                <SortHead label={fmtDate(d.a!.as_of)} k="a" sort={sort} onSort={toggle} align="right" />
                <SortHead label={fmtDate(d.b!.as_of)} k="b" sort={sort} onSort={toggle} align="right" />
                <SortHead label="Change" k="delta" sort={sort} onSort={toggle} align="right" />
                <TableHead className="w-44" />
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((m) => {
                const Icon = m.delta > 0 ? ArrowUp : m.delta < 0 ? ArrowDown : Minus
                // Only a retreat is coloured: a rise in "still >= 1,000" is not good news,
                // so green for every increase would mislead.
                const tone = m.retreat ? 'text-bad' : m.delta === 0 ? 'text-muted-foreground' : ''
                return (
                  <TableRow key={m.metric}>
                    <TableCell className="font-medium">{m.metric}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(m.a)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(m.b)}</TableCell>
                    <TableCell className={cn('text-right font-medium tabular-nums', tone)}>
                      <span className="inline-flex items-center gap-1">
                        <Icon className="size-3" aria-hidden />{m.delta > 0 ? '+' : ''}{fmt(m.delta)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {/* change drawn from a centre line: right is a gain, left a fall */}
                      <span className="relative block h-3 w-full rounded-[3px] bg-muted" aria-hidden>
                        <span className="absolute inset-y-0 left-1/2 w-px bg-border" />
                        <span className="absolute inset-y-0 rounded-[3px]"
                              style={{
                                left: m.delta >= 0 ? '50%' : `${50 - Math.abs(m.delta) / span * 50}%`,
                                width: `${Math.abs(m.delta) / span * 50}%`,
                                background: m.retreat ? 'var(--bad)' : 'var(--icon)',
                              }} />
                      </span>
                    </TableCell>
                    <TableCell>
                      {m.retreat && (
                        <span className="inline-flex flex-wrap gap-1.5">
                          <StatusBadge tone="bad">Went backwards</StatusBadge>
                          {m.explained_by_date && <span className="text-muted-foreground">explained by the date</span>}
                        </span>
                      )}
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
