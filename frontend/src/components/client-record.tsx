/**
 * One client's record, for facility review: every failure episode, newest
 * first, with its dates, EAC progress, follow-up result, plan, and the
 * worklists it sits on with the next step. Opened from Client search and from
 * any client key in a table. In the dashboard it opens as a full page (the
 * shell passes `onOpen`); where no shell is mounted, as a side panel.
 *
 * The S/N is the only identifier the dashboard holds; the PEPID stays in the
 * vault. Every opening is recorded in the audit trail by the server.
 */
import { ArrowLeft, Check, Copy, X } from 'lucide-react'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { cn } from 'cn'
import { StatusBadge } from '@/components/status-badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { api, ApiError } from '@/core/api'
import { DASH, fmt, fmtDate } from '@/core/format'
import { PriorityMark, WORKLISTS } from '@/pages/worklists-page'

export interface Episode {
  episode: string
  idx_vl: number | null; idx_samp: string | null; recv_date: string | null; idx_date: string | null
  fy_quarter: string | null
  s1_date: string | null
  s2_date?: string | null; s3_date?: string | null; s4_date?: string | null
  /** Completed EAC, no post-EAC sample, next scheduled visit within two months of completion. */
  vl_at_next_visit?: boolean | null
  eac1: boolean | null; eac2: boolean | null; eac3: boolean | null; eac_extended: boolean | null
  eac_completed: boolean | null; sessions: number | null; post_eac_vl: boolean | null
  fu_samp: string | null; fu_date: string | null; fu_vl: number | null
  awaiting_result: boolean | null; resuppressed: boolean | null; llv: boolean | null
  still_unsuppressed: boolean | null; switched: boolean | null
  months_unsuppressed: number | null; treatment_plan: string | null
  worklists: string[]
}
export interface ClientRecord {
  sn: string; state: string | null; lga: string | null; facility: string | null
  sex: string | null; age: number | null; art_status: string | null
  regimen_line: string | null; regimen: string | null; art_year: number | null; exit_date: string | null
  /** From the treatment line list: last ARV pickup, days dispensed, and the visit that implies. */
  last_pickup?: string | null; days_refill?: number | null; next_visit?: string | null
  first_vl: number | null; first_vl_date: string | null
  first_high_vl: number | null; first_high_date: string | null
  episodes: Episode[]
}

// ── opening the panel from anywhere ───────────────────────────────────
const OpenClient = createContext<((sn: string) => void) | null>(null)

/** Opens a client's record, or null where no panel is mounted (a page rendered on its own). */
export function useOpenClient() {
  return useContext(OpenClient)
}

/**
 * Makes client keys clickable. With `onOpen` the caller shows the record (the
 * dashboard opens it as a page); without, it opens in a side panel here.
 */
export function ClientRecordProvider({ children, onOpen }: { children: ReactNode; onOpen?: (sn: string) => void }) {
  const [sn, setSn] = useState<string | null>(null)
  return (
    <OpenClient.Provider value={onOpen ?? setSn}>
      {children}
      {!onOpen && <ClientRecordSheet sn={sn} onClose={() => setSn(null)} />}
    </OpenClient.Provider>
  )
}

/**
 * A client key in a table. Shortened for width, full on hover; a button that
 * opens the record wherever a panel is mounted, plain text otherwise.
 */
export function ClientKey({ sn, className }: { sn: string; className?: string }) {
  const open = useOpenClient()
  const short = `${sn.slice(0, 10)}…`
  if (!open) return <span className={cn('font-mono text-xs text-muted-foreground', className)} title={sn}>{short}</span>
  return (
    <button type="button" onClick={() => open(sn)} title={sn} aria-label={`Open the record for client ${sn}`}
            className={cn('rounded font-mono text-xs text-[var(--icon)] underline decoration-dotted underline-offset-2 hover:decoration-solid focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none', className)}>
      {short}
    </button>
  )
}

// ── loading a record ──────────────────────────────────────────────────
function useClientRecord(sn: string | null) {
  const [rec, setRec] = useState<ClientRecord | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    if (!sn) return
    let off = false
    setRec(null); setErr(null)
    api<ClientRecord>(`/client/${encodeURIComponent(sn)}`)
      .then((r) => { if (!off) setRec(r) })
      .catch((e: unknown) => {
        if (off) return
        setErr(e instanceof ApiError && e.status === 404 ? 'No client with that S/N in your area.'
               : e instanceof Error ? e.message : 'Could not load the record')
      })
    return () => { off = true }
  }, [sn])
  return { rec, err }
}

// ── the full page ─────────────────────────────────────────────────────
/** The record as a page: the client across the top, episodes side by side on a wide screen. */
export function ClientRecordPage({ sn, onBack, backLabel }: { sn: string; onBack: () => void; backLabel: string }) {
  const { rec, err } = useClientRecord(sn)
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Button variant="ghost" size="sm" className="-ml-2 w-fit" onClick={onBack}>
            <ArrowLeft />Back to {backLabel}
          </Button>
          <h1 className="text-2xl font-bold tracking-tight text-balance">Client record</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Everything the dashboard holds on this client, newest episode first. Opening a record is
            recorded in the audit trail.
          </p>
        </div>
      </div>
      {err ? <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>
        : !rec ? <div className="flex flex-col gap-3" aria-busy="true"><Skeleton className="h-32" /><Skeleton className="h-80" /></div>
        : <RecordBody rec={rec} wide />}
    </div>
  )
}

// ── the side panel (pages rendered outside the dashboard shell) ───────
function ClientRecordSheet({ sn, onClose }: { sn: string | null; onClose: () => void }) {
  const { rec, err } = useClientRecord(sn)

  return (
    <Sheet open={sn !== null} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent className="w-full overflow-y-auto data-[side=right]:sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Client record</SheetTitle>
          <SheetDescription>
            Everything the dashboard holds on this client, newest episode first. Opening a record is
            recorded in the audit trail.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-5 px-4 pb-6">
          {err ? <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>
            : !rec ? <div className="flex flex-col gap-3" aria-busy="true"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>
            : <RecordBody rec={rec} />}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function CopyKey({ sn }: { sn: string }) {
  const [done, setDone] = useState(false)
  return (
    <Button variant="outline" size="sm" aria-label="Copy the S/N"
            onClick={() => { void navigator.clipboard?.writeText(sn).then(() => { setDone(true); setTimeout(() => setDone(false), 1500) }) }}>
      {done ? <Check /> : <Copy />}{done ? 'Copied' : 'Copy'}
    </Button>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{children}</dd>
    </div>
  )
}

export function RecordBody({ rec, wide = false }: { rec: ClientRecord; wide?: boolean }) {
  const active = rec.art_status?.trim().toLowerCase() === 'active'
  return (
    <>
      <section aria-label="Client" className={cn('flex flex-col gap-4 rounded-xl border p-4', wide && 'bg-card')}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">S/N</span>
            <span className="font-mono text-sm break-all">{rec.sn}</span>
          </div>
          <CopyKey sn={rec.sn} />
        </div>
        <dl className={cn('grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3', wide && 'lg:grid-cols-4 xl:grid-cols-7')}>
          <Fact label="Facility">{rec.facility ?? DASH}</Fact>
          <Fact label="State">{rec.state ?? DASH}{rec.lga ? ` · ${rec.lga}` : ''}</Fact>
          <Fact label="Sex and age">{rec.sex ?? DASH}, {rec.age ?? DASH}</Fact>
          <Fact label="ART status">
            {rec.art_status ? <StatusBadge tone={active ? 'good' : 'warn'}>{rec.art_status}</StatusBadge> : DASH}
          </Fact>
          <Fact label="Regimen">{rec.regimen_line ?? DASH}{rec.regimen ? <span className="block text-xs font-normal text-muted-foreground">{rec.regimen}</span> : null}</Fact>
          <Fact label="ART start">{rec.art_year ?? DASH}</Fact>
          {rec.exit_date && <Fact label="Outcome dated">{fmtDate(rec.exit_date)}</Fact>}
          <Fact label="Last ARV pickup">{fmtDate(rec.last_pickup)}</Fact>
          <Fact label="Dispensed for">{refill(rec.days_refill)}</Fact>
          <Fact label="Next scheduled visit">{fmtDate(rec.next_visit)}</Fact>
        </dl>
        {(rec.first_vl != null || rec.first_high_vl != null) && (
          <div className="flex flex-col gap-1 border-t pt-3 text-sm">
            <span className="text-xs text-muted-foreground">Earlier viral loads, from the EAC list</span>
            {rec.first_vl != null && <span>First ever VL: <span className="tabular-nums">{fmt(rec.first_vl)}</span> on {fmtDate(rec.first_vl_date)}</span>}
            {/* Named as the export names it: it is the first DETECTABLE result,
                floor 50, pending the HI team's definition. */}
            {rec.first_high_vl != null && <span>First high VL (as exported): <span className="tabular-nums">{fmt(rec.first_high_vl)}</span> on {fmtDate(rec.first_high_date)}</span>}
          </div>
        )}
      </section>

      <h3 className="text-sm font-semibold">
        {rec.episodes.length === 1 ? '1 failure episode' : `${rec.episodes.length} failure episodes`}
      </h3>
      <div className={cn('flex flex-col gap-5', wide && 'grid items-start xl:grid-cols-2')}>
        {rec.episodes.map((e, i) => (
          <EpisodeCard key={e.episode} e={e} n={rec.episodes.length - i} wide={wide}
                       nextVisit={i === 0 ? rec.next_visit : null} />
        ))}
      </div>
    </>
  )
}

/** Days of ARVs dispensed, with months where it is a whole number of them. */
function refill(days: number | null | undefined): string {
  if (days == null) return DASH
  const m = days / 30
  return Number.isInteger(m) ? `${fmt(days)} days (${m} month${m === 1 ? '' : 's'})` : `${fmt(days)} days`
}

function Step({ done, label, date }: { done: boolean | null; label: string; date?: string | null }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs',
                        done ? 'border-transparent bg-good-tint text-good' : 'text-muted-foreground')}>
      {done ? <Check className="size-3" aria-hidden /> : <X className="size-3" aria-hidden />}
      {label}{date ? <span className="tabular-nums opacity-80"> · {fmtDate(date)}</span> : null}
      <span className="sr-only">{done ? ': done' : ': not done'}</span>
    </span>
  )
}

function outcome(e: Episode): ReactNode {
  if (e.fu_vl == null) {
    if (e.fu_samp) return <StatusBadge tone="warn">Awaiting result</StatusBadge>
    return <span className="text-muted-foreground">No follow-up VL yet</span>
  }
  if (e.still_unsuppressed) return <StatusBadge tone="bad">Still 1,000 or more</StatusBadge>
  if (e.llv) return <StatusBadge tone="warn">Re-suppressed, low-level viraemia</StatusBadge>
  if (e.resuppressed) return <StatusBadge tone="good">Re-suppressed</StatusBadge>
  return DASH
}

/** "in 12 days", "today", "9 days ago", from today. */
function fromToday(iso: string): string {
  const days = Math.round((new Date(`${iso.slice(0, 10)}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / 86_400_000)
  return days === 0 ? 'today' : days > 0 ? `in ${days} day${days === 1 ? '' : 's'}` : `${-days} day${days === -1 ? '' : 's'} ago`
}

function EpisodeCard({ e, n, wide = false, nextVisit = null }: {
  e: Episode; n: number; wide?: boolean
  /** The client's next scheduled visit; given to the current episode only. */
  nextVisit?: string | null
}) {
  // Completed EAC, no post-EAC sample yet: the visit is when it can be drawn,
  // so the health worker sees the date without opening the pharmacy record.
  const vlDue = !!e.eac_completed && !e.post_eac_vl
  const lists = WORKLISTS.filter((w) => e.worklists.includes(w.flag))
  return (
    <section aria-label={`Episode ${n}`} className={cn('flex flex-col gap-3 rounded-xl border p-4', wide && 'bg-card')}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium">Episode {n}</span>
        <span className="text-xs text-muted-foreground">{e.fy_quarter ?? ''}{e.months_unsuppressed != null ? ` · ${e.months_unsuppressed} months unsuppressed` : ''}</span>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
        <Fact label="Index VL"><span className="tabular-nums text-bad">{fmt(e.idx_vl)}</span></Fact>
        <Fact label="Index sample collected">{fmtDate(e.idx_samp)}</Fact>
        <Fact label="Index result received">{fmtDate(e.recv_date ?? e.idx_date)}</Fact>
      </dl>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">
          EAC, this cycle{e.sessions ? ` · ${e.sessions} sessions across all cycles` : ''}
        </span>
        <div className="flex flex-wrap gap-1.5">
          <Step done={e.eac1} label="Session 1" date={e.s1_date} />
          <Step done={e.eac2} label="Session 2" date={e.s2_date} />
          <Step done={e.eac3} label="Session 3" date={e.s3_date} />
          <Step done={e.eac_completed} label="Completed" />
          {e.eac_extended && <Step done label="Extended, session 4" date={e.s4_date} />}
        </div>
        {/* A session 4 more than 60 days after session 3 is not this cycle's
            extended EAC (decision 22), so it is shown but not counted. */}
        {!e.eac_extended && e.s4_date && (
          <span className="text-xs text-muted-foreground">
            Session 4 on {fmtDate(e.s4_date)}, more than 60 days after session 3: not counted as extended EAC.
          </span>
        )}
      </div>
      {vlDue && (
        <div className="flex flex-col gap-0.5 rounded-lg border border-warn/40 bg-warn-tint px-3 py-2 text-sm">
          <span className="font-medium text-warn">Post-EAC VL sample due</span>
          <span>
            {nextVisit
              ? <>Next scheduled visit: <span className="font-medium tabular-nums">{fmtDate(nextVisit)}</span> ({fromToday(nextVisit)})</>
              : 'No next scheduled visit on the treatment line list.'}
          </span>
        </div>
      )}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
        <Fact label="Follow-up sample collected">{fmtDate(e.fu_samp)}</Fact>
        <Fact label="Follow-up result received">{fmtDate(e.fu_date)}</Fact>
        <Fact label="Follow-up VL"><span className="tabular-nums">{fmt(e.fu_vl)}</span></Fact>
      </dl>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {outcome(e)}
        {e.switched && <StatusBadge tone="good">Switched regimen</StatusBadge>}
        {e.vl_at_next_visit && <StatusBadge tone="warn">VL expected at the next scheduled visit</StatusBadge>}
      </div>
      {e.treatment_plan && <p className="text-sm"><span className="text-muted-foreground">Plan: </span>{e.treatment_plan}</p>}
      {lists.length > 0 && (
        <div className="flex flex-col gap-2 border-t pt-3">
          <span className="text-xs text-muted-foreground">On {lists.length === 1 ? 'this worklist' : 'these worklists'}</span>
          <ul className="flex flex-col gap-2">
            {lists.map((w) => (
              <li key={w.flag} className="flex flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2 text-sm font-medium">{w.label}<PriorityMark priority={w.priority} /></span>
                <span className="text-sm text-muted-foreground">{w.next}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
