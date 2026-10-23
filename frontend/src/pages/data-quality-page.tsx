import { CircleCheck, FileSpreadsheet, ListChecks, ShieldAlert, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from 'cn'
import { KpiTile } from '@/components/kpi-tile'
import { SortHead, useSort } from '@/components/sortable'
import { StatusBadge } from '@/components/status-badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHeader, TableRow,
} from '@/components/ui/table'
import { api } from '@/core/api'
import { fmt } from '@/core/format'

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'clear'
export interface DqRow { sheet: string | null; check_name: string; severity: Severity; n_records: number; detail: string | null }

export const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, clear: 4 }

export function SeverityMark({ s }: { s: Severity }) {
  if (s === 'critical') return <StatusBadge tone="bad">Critical</StatusBadge>
  if (s === 'high') return <StatusBadge tone="bad">High</StatusBadge>
  if (s === 'medium') return <StatusBadge tone="warn">Medium</StatusBadge>
  if (s === 'clear') return <StatusBadge tone="good">Clear</StatusBadge>
  return <span className="text-muted-foreground">Low</span>
}

/**
 * The checks run on every upload, from the current snapshot. Not filtered:
 * a check describes the data as loaded, not a slice of it.
 */
export default function DataQualityPage() {
  const [rows, setRows] = useState<DqRow[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let off = false
    api<DqRow[]>('/dq')
      .then((r) => { if (!off) setRows(r) })
      .catch((e: unknown) => { if (!off) setErr(e instanceof Error ? e.message : 'Could not load the checks') })
    return () => { off = true }
  }, [])

  const found = (rows ?? []).filter((r) => r.severity !== 'clear' && r.n_records > 0)
  const critical = found.filter((r) => r.severity === 'critical')
  const high = found.filter((r) => r.severity === 'high')

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-balance">Data quality</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Checks run automatically on every upload. This page is how the HI team learns what to fix.
          Checks on the assembled cohort affect the figures; checks on the source files are export
          mechanics the pipeline has already handled.
        </p>
      </div>

      {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}

      {rows === null ? <Skeleton className="h-96 w-full rounded-xl" /> : (
        <>
          {critical.length > 0 && (
            <Alert variant="destructive">
              <ShieldAlert />
              <AlertTitle>{critical.length} critical {critical.length === 1 ? 'issue' : 'issues'}</AlertTitle>
              <AlertDescription>
                <ul className="flex flex-col gap-2">
                  {critical.map((r, i) => (
                    <li key={i}>{r.check_name}{r.sheet && ` (${r.sheet})`}: {fmt(r.n_records)} records. {r.detail}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          <section aria-label="Checks at a glance" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiTile icon={ListChecks} label="Checks run" value={fmt(rows.length)} note="on the current snapshot" />
            <KpiTile icon={CircleCheck} label="Clear" value={fmt(rows.length - found.length)} note="nothing found" />
            <KpiTile icon={ShieldAlert} label="Critical" value={fmt(critical.length)} note="checks with findings"
                     status={critical.length ? <StatusBadge tone="bad">Fix first</StatusBadge> : undefined} />
            <KpiTile icon={TriangleAlert} label="High" value={fmt(high.length)} note="checks with findings" />
          </section>
          <Checks title="In the assembled cohort" icon={ListChecks}
                  description="Problems in the episodes the dashboard counts. These change the figures, so they are the ones to raise with facilities."
                  rows={rows.filter((r) => !r.sheet)} />
          <Checks title="In the source files" icon={FileSpreadsheet}
                  description="Per-sheet findings from reading the workbook: renamed or missing columns, censored sheets, date corruption. The pipeline has already corrected or excluded these."
                  rows={rows.filter((r) => r.sheet)} showSheet />
        </>
      )}
    </div>
  )
}

function Checks({ title, description, rows, showSheet = false, icon: Icon }: {
  title: string; description: string; rows: DqRow[]; showSheet?: boolean; icon: typeof ListChecks
}) {
  const [showClear, setShowClear] = useState(false)
  const data = rows.map((r) => ({ ...r, rank: SEVERITY_RANK[r.severity] ?? 9 }))
  const { sorted, sort, toggle } = useSort(data, (r, k) => r[k as keyof typeof r] as unknown, { key: 'rank', dir: 'asc' })
  const clear = data.filter((r) => r.severity === 'clear').length
  const shown = showClear ? sorted : sorted.filter((r) => r.severity !== 'clear')
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Icon className="size-4 text-[var(--icon)]" aria-hidden />{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        {clear > 0 && (
          <CardAction>
            <Button variant="outline" size="sm" onClick={() => setShowClear((v) => !v)} aria-pressed={showClear}>
              {showClear ? 'Hide' : 'Show'} {fmt(clear)} clear {clear === 1 ? 'check' : 'checks'}
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="px-0">
        {!shown.length ? (
          <p className="px-6 py-6 text-sm text-muted-foreground">Every check here is clear.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table className="text-xs">
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <SortHead label="Check" k="check_name" sort={sort} onSort={toggle} text />
                  {showSheet && <SortHead label="Sheet" k="sheet" sort={sort} onSort={toggle} text />}
                  <SortHead label="Records" k="n_records" sort={sort} onSort={toggle} align="right" />
                  <SortHead label="Severity" k="rank" sort={sort} onSort={(k) => toggle(k, 'asc')} />
                  <SortHead label="What it means" k="detail" sort={sort} onSort={toggle} text />
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((r, i) => (
                  <TableRow key={`${r.sheet}${r.check_name}${i}`}>
                    <TableCell className="font-medium">{r.check_name}</TableCell>
                    {showSheet && <TableCell className="text-muted-foreground">{r.sheet}</TableCell>}
                    <TableCell className={cn('text-right tabular-nums', r.n_records ? 'font-medium' : 'text-muted-foreground')}>{fmt(r.n_records)}</TableCell>
                    <TableCell><SeverityMark s={r.severity} /></TableCell>
                    <TableCell className="max-w-xl min-w-[18rem] whitespace-normal text-muted-foreground">{r.detail}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
