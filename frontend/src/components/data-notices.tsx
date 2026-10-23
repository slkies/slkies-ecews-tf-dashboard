/**
 * The header's data notices: serious problems in the assembled cohort, in a
 * side panel rather than pinned above every page. Per-sheet findings (censored
 * sheets, renamed columns) are export mechanics the pipeline has handled, so
 * they stay on the Data quality page and are not counted here.
 */
import { TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { api } from '@/core/api'
import { fmt } from '@/core/format'
import { SEVERITY_RANK, SeverityMark, type DqRow } from '@/pages/data-quality-page'

/** Cohort-level critical and high findings, worst and largest first. */
export function noticesFrom(rows: DqRow[]): DqRow[] {
  return rows
    .filter((r) => !r.sheet && r.n_records > 0 && (r.severity === 'critical' || r.severity === 'high'))
    .sort((a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9) || b.n_records - a.n_records)
}

export function DataNotices({ onOpenDq }: { onOpenDq?: () => void }) {
  const [items, setItems] = useState<DqRow[]>([])
  const [open, setOpen] = useState(false)
  useEffect(() => {
    let off = false
    api<DqRow[]>('/dq').then((r) => { if (!off && Array.isArray(r)) setItems(noticesFrom(r)) }).catch(() => {})
    return () => { off = true }
  }, [])
  if (!items.length) return null
  const critical = items.some((r) => r.severity === 'critical')
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}
              className={cn(critical ? 'border-bad/40 text-bad' : 'border-warn/40 text-warn')}>
        <TriangleAlert />{items.length} data {items.length === 1 ? 'notice' : 'notices'}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Data notices</SheetTitle>
            <SheetDescription>Serious problems in the episodes the dashboard counts, from the current line list.</SheetDescription>
          </SheetHeader>
          <ul className="flex flex-col gap-3 px-4">
            {items.map((r) => (
              <li key={r.check_name} className="flex flex-col gap-1.5 rounded-lg border p-3">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium">{r.check_name}</span>
                  <SeverityMark s={r.severity} />
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">{fmt(r.n_records)} records</span>
                <span className="text-sm text-muted-foreground">{r.detail}</span>
              </li>
            ))}
          </ul>
          {onOpenDq && (
            <div className="px-4 pb-4">
              <Button variant="outline" size="sm" onClick={() => { setOpen(false); onOpenDq() }}>See every check on Data quality</Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
