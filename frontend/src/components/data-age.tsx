/**
 * How old the data on screen is. The dashboard is refreshed from a weekly
 * line list, not in real time, so every page says which list it shows and how
 * many days old it is - and turns amber once a weekly refresh has been missed.
 * Asked for at the CDC session (4 Nov 2026): a user deciding who needs urgent
 * follow-up must be able to see that the list may already be out of date.
 */
import { CalendarClock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from 'cn'
import { api } from '@/core/api'
import { fmtDate } from '@/core/format'

/** A weekly refresh plus a day's grace: older than this, a refresh was missed. */
export const STALE_AFTER_DAYS = 7

interface UploadRow { as_of: string | null; status: string; is_current: boolean }

export interface DataAge { asOf: string; days: number; stale: boolean; label: string }

/** Whole calendar days between two dates, read as local dates (no time zone drift). */
function daysBetween(fromIso: string, to: Date): number {
  const [y, m, d] = fromIso.slice(0, 10).split('-').map(Number)
  const from = Date.UTC(y!, m! - 1, d!)
  const today = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.round((today - from) / 86_400_000)
}

/** The age of the line list dated `asOf`, as of `today`. Null for a missing or unreadable date. */
export function dataAge(asOf: string | null | undefined, today: Date = new Date()): DataAge | null {
  if (!asOf || !/^\d{4}-\d{2}-\d{2}/.test(asOf)) return null
  const days = daysBetween(asOf, today)
  if (Number.isNaN(days)) return null
  const age = days <= 0 ? 'today' : days === 1 ? '1 day old' : `${days} days old`
  return { asOf, days, stale: days > STALE_AFTER_DAYS, label: `Line list of ${fmtDate(asOf)} · ${age}` }
}

export function DataAgeLine({ today }: { today?: Date }) {
  const [asOf, setAsOf] = useState<string | null>(null)
  useEffect(() => {
    let off = false
    api<UploadRow[]>('/uploads')
      .then((rows) => {
        const cur = Array.isArray(rows) ? rows.find((r) => r.is_current && r.status === 'ready') : undefined
        if (!off && cur?.as_of) setAsOf(cur.as_of)
      })
      .catch(() => {})
    return () => { off = true }
  }, [])
  const a = dataAge(asOf, today)
  if (!a) return null
  const note = a.stale
    ? `More than ${STALE_AFTER_DAYS} days old: a weekly refresh has been missed. Check recent results in the EMR before acting on a list.`
    : 'Refreshed weekly from the line list, not in real time. Urgent cases follow the clinic’s usual route.'
  return (
    <span title={note} data-stale={a.stale || undefined}
          className={cn('hidden items-center gap-1.5 rounded-md border px-2 py-1 text-xs tabular-nums md:inline-flex',
            a.stale ? 'border-warn/40 bg-warn-tint text-warn' : 'border-border text-muted-foreground')}>
      <CalendarClock className="size-3.5" aria-hidden />
      {a.label}
      <span className="sr-only">. {note}</span>
    </span>
  )
}
