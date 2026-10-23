import { FileUp, RefreshCw, Trash2, Upload } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from 'cn'
import { SortHead, useSort } from '@/components/sortable'
import { StatusBadge } from '@/components/status-badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api, getToken } from '@/core/api'
import { DASH, fmt, fmtDate } from '@/core/format'
import UsersPanel from './admin-users'
import type { Upload as UploadRow } from './compare-page'

export const when = (iso: string | null | undefined) => (iso
  ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : DASH)

/** Friendly names for the API paths the usage log records. */
const PAGE_NAME: Record<string, string> = {
  '/api/summary': 'Overview (headline figures)', '/api/overview': 'Overview', '/api/cascade': 'Cascade',
  '/api/breakdown': 'Breakdowns', '/api/plans': 'Treatment plans', '/api/clients': 'Client worklist',
  '/api/export': 'CSV export', '/api/deep-dive': 'Advanced analytics (factors)', '/api/profile': 'Deep dive',
  '/api/dtc': 'DTC review', '/api/time-metrics': 'Time metrics', '/api/survival': 'Time metrics (survival)',
  '/api/unsupp-curve': 'Time metrics (time to unsuppression)', '/api/risk': 'Advanced analytics (risk)',
  '/api/mortality': 'Advanced analytics (mortality)', '/api/dq': 'Data quality', '/api/uploads': 'Admin: uploads',
  '/api/users': 'Admin: users', '/api/audit': 'Admin: audit trail', '/api/usage': 'Admin: usage',
  '/api/feedback': 'Feedback', '/api/filters': '(filter lists)', '/api/me': '(session check)',
  '/api/worklists': 'Worklists', '/api/compare': 'Line list changes', '/api/trend': 'Overview (trend)',
}
const pageName = (p: string) => PAGE_NAME[p] ?? PAGE_NAME[p.replace(/\/[^/]+$/, '')] ?? p

export default function AdminPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-balance">Admin</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Load line lists, manage accounts, and see who is using the dashboard. Every action here is
          recorded in the audit trail.
        </p>
      </div>
      <Tabs defaultValue="data" className="gap-4">
        <TabsList>
          <TabsTrigger value="data">Line lists</TabsTrigger>
          <TabsTrigger value="users">Users and access</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
          <TabsTrigger value="audit">Audit trail</TabsTrigger>
        </TabsList>
        <TabsContent value="data" className="flex flex-col gap-6"><DataPanel /></TabsContent>
        <TabsContent value="users"><UsersPanel /></TabsContent>
        <TabsContent value="usage"><UsagePanel /></TabsContent>
        <TabsContent value="feedback"><FeedbackPanel /></TabsContent>
        <TabsContent value="audit"><AuditPanel /></TabsContent>
      </Tabs>
    </div>
  )
}

// ── line lists ───────────────────────────────────────────────────────
interface IngestResult {
  upload_id: number; cohort: number; primary_eac_sheet: string; warnings: string[]
  sheets: { name: string; kind: string; rows: number; censored: boolean }[]
}

function DataPanel() {
  const [ups, setUps] = useState<(UploadRow & { error?: string | null })[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const load = useCallback(() => {
    api<UploadRow[]>('/uploads').then((r) => { setUps(r); setErr(null) })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Could not load the uploads'))
  }, [])
  useEffect(load, [load])
  return (
    <>
      <UploadCard onLoaded={load} />
      <HistoryCard ups={ups} err={err} reload={load} />
      <DiagnosticsCard />
    </>
  )
}

function UploadCard({ onLoaded }: { onLoaded: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [asOf, setAsOf] = useState('')
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)
  const [res, setRes] = useState<IngestResult | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  // A FormData body, so not through api(): that sets a JSON content type,
  // which would break the multipart boundary.
  async function send() {
    if (!file || !asOf) return
    setBusy(true); setErr(null); setRes(null)
    const fd = new FormData()
    fd.append('file', file); fd.append('cohort_mode', 'snapshot'); fd.append('as_of', asOf)
    try {
      const r = await fetch('/api/uploads', { method: 'POST', headers: { Authorization: `Bearer ${getToken() ?? ''}` }, body: fd })
      const d = await r.json().catch(() => ({})) as IngestResult & { detail?: unknown }
      if (!r.ok) throw new Error(typeof d.detail === 'string' ? d.detail : `Upload failed (${r.status})`)
      setRes(d); setFile(null); onLoaded()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Upload failed') }
    finally { setBusy(false) }
  }

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Load a line list</CardTitle>
        <CardDescription>
          Parsed on the server; everyone else sees the result. Each upload becomes a dated snapshot
          and the current data. The de-identified parquet from the pipeline is preferred: it is far
          faster and carries no client identifiers.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
             onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) setFile(f) }}
             className={cn('flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors',
                           over ? 'border-[var(--icon)] bg-[color-mix(in_oklch,var(--icon)_8%,transparent)]' : 'border-border')}>
          <FileUp className="size-6 text-[var(--icon)]" aria-hidden />
          <p className="text-sm">{file ? file.name : 'Drop the file here, or choose one.'}</p>
          <input ref={input} type="file" accept=".xlsx,.xlsb,.zip,.parquet" hidden aria-label="Line list file"
                 onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); e.target.value = '' }} />
          <Button variant="outline" size="sm" onClick={() => input.current?.click()}>Choose file</Button>
          <span className="text-xs text-muted-foreground">.parquet, a .zip of parquets, or .xlsx</span>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="as-of">Line list date</Label>
            <Input id="as-of" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="w-44" />
          </div>
          <Button onClick={send} disabled={!file || !asOf || busy}>{busy ? <Spinner /> : <Upload />}Load line list</Button>
        </div>
        <p className="max-w-2xl text-xs text-muted-foreground">
          Use the date of the treatment line list. It sets the fiscal quarter and the follow-up
          windows, so a wrong date quietly moves clients in and out of the cohort.
        </p>
        {err && <Alert variant="destructive"><AlertTitle>Upload failed</AlertTitle><AlertDescription>{err}</AlertDescription></Alert>}
        {res && (
          <Alert>
            <AlertTitle>Loaded {fmt(res.cohort)} episodes</AlertTitle>
            <AlertDescription>
              <p>Outcomes computed from {res.primary_eac_sheet}.</p>
              <ul className="mt-1 list-disc pl-5">
                {res.sheets.map((s) => (
                  <li key={s.name}>{s.name}: {s.kind}, {fmt(s.rows)} rows{s.censored && ' (success-censored, excluded)'}</li>
                ))}
              </ul>
              {res.warnings.map((w, i) => <p key={i} className="mt-2">{w}</p>)}
              <Button size="sm" variant="outline" className="mt-3" onClick={() => window.location.reload()}>
                <RefreshCw />Reload to see the new figures
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

function HistoryCard({ ups, err, reload }: { ups: (UploadRow & { error?: string | null })[] | null; err: string | null; reload: () => void }) {
  const [del, setDel] = useState<UploadRow | 'all' | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const { sorted, sort, toggle } = useSort(ups ?? [], (r, k) => r[k as keyof typeof r] as unknown, { key: 'uploaded_at', dir: 'desc' })
  const previous = (ups ?? []).filter((u) => !u.is_current).length

  async function confirm() {
    try {
      if (del === 'all') { const r = await api<{ deleted: number }>('/uploads/prune', { method: 'POST' }); setMsg(`Deleted ${fmt(r.deleted)} previous ${r.deleted === 1 ? 'snapshot' : 'snapshots'}.`) }
      else if (del) { await api(`/uploads/${del.id}`, { method: 'DELETE' }); setMsg(`Deleted the snapshot dated ${fmtDate(del.as_of)}.`) }
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Could not delete') }
    setDel(null); reload()
  }

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Upload history</CardTitle>
        <CardDescription>
          Each upload is a fixed snapshot, and Line list changes compares any two. The current one
          is the live data and cannot be deleted.
        </CardDescription>
        {previous > 0 && <CardAction><Button variant="outline" size="sm" onClick={() => setDel('all')}>Delete all previous</Button></CardAction>}
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-0">
        {err && <Alert variant="destructive" className="mx-6 w-auto"><AlertDescription>{err}</AlertDescription></Alert>}
        {msg && <p role="status" className="px-6 text-sm text-muted-foreground">{msg}</p>}
        {ups === null ? <Skeleton className="mx-6 h-32" /> : (
          <div className="overflow-x-auto">
            <Table className="text-xs">
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <SortHead label="File" k="filename" sort={sort} onSort={toggle} text />
                  <SortHead label="As of" k="as_of" sort={sort} onSort={toggle} />
                  <SortHead label="Uploaded" k="uploaded_at" sort={sort} onSort={toggle} />
                  <SortHead label="Episodes" k="n_cohort" sort={sort} onSort={toggle} align="right" />
                  <SortHead label="Status" k="status" sort={sort} onSort={toggle} />
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.filename ?? DASH}{u.is_current && <StatusBadge tone="good" className="ml-2">Current</StatusBadge>}</TableCell>
                    <TableCell className="tabular-nums">{fmtDate(u.as_of)}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{when(u.uploaded_at)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(u.n_cohort)}</TableCell>
                    <TableCell title={u.error ?? undefined}>
                      {u.status === 'ready' ? <span>Ready</span> : u.status === 'failed' ? <StatusBadge tone="bad">Failed</StatusBadge> : <span className="capitalize">{u.status}</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      {!u.is_current && <Button variant="ghost" size="icon-sm" aria-label={`Delete the snapshot dated ${fmtDate(u.as_of)}`} onClick={() => setDel(u)}><Trash2 className="text-bad" /></Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <AlertDialog open={del !== null} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{del === 'all' ? `Delete all ${fmt(previous)} previous snapshots?` : `Delete the snapshot dated ${del ? fmtDate(del.as_of) : ''}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              The snapshot and its episodes are removed and cannot be recovered here, and it can no
              longer be used on Line list changes. The current data is not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirm}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

interface Diag {
  ok: boolean; reason?: string; label?: string
  snapshot?: { filename: string | null; as_of: string; rows: number }
  columns?: { column: string; label: string; powers: string; filled: number | null; pct: number | null; status: 'ok' | 'partial' | 'empty' | 'missing' }[]
}

function DiagnosticsCard() {
  const [d, setD] = useState<Diag | null>(null)
  useEffect(() => { api<Diag>('/diagnostics').then(setD).catch((e: unknown) => setD({ ok: false, reason: e instanceof Error ? e.message : 'Failed' })) }, [])
  const { sorted, sort, toggle } = useSort(d?.columns ?? [], (r, k) => r[k as keyof typeof r] as unknown)
  const anyEmpty = d?.columns?.some((c) => c.status === 'empty' || c.status === 'missing')
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Deployment check</CardTitle>
        <CardDescription>
          Whether each derived field holds data in the current snapshot. Fields are computed when a
          line list is loaded, so one can be empty because the file was loaded before the code that
          fills it; loading the same file again fixes that.
          {d?.snapshot && ` Snapshot ${d.snapshot.filename ?? ''}, dated ${fmtDate(d.snapshot.as_of)}, ${fmt(d.snapshot.rows)} episodes, app ${d.label ?? ''}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-0">
        {d === null ? <Skeleton className="mx-6 h-32" /> : !d.ok ? <p className="px-6 text-sm text-muted-foreground">{d.reason}</p> : (
          <>
            {anyEmpty && (
              <Alert className="mx-6 w-auto">
                <AlertTitle>One or more fields are empty</AlertTitle>
                <AlertDescription>An empty field shows as a blank filter or a missing breakdown. If it is one this version derives, loading the same file again fills it.</AlertDescription>
              </Alert>
            )}
            <div className="overflow-x-auto">
              <Table className="text-xs">
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <SortHead label="Field" k="label" sort={sort} onSort={toggle} text />
                    <SortHead label="Powers" k="powers" sort={sort} onSort={toggle} text />
                    <SortHead label="Filled" k="filled" sort={sort} onSort={toggle} align="right" />
                    <SortHead label="Share" k="pct" sort={sort} onSort={toggle} align="right" />
                    <SortHead label="Status" k="status" sort={sort} onSort={toggle} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((c) => (
                    <TableRow key={c.column}>
                      <TableCell className="font-medium">{c.label}</TableCell>
                      <TableCell className="text-muted-foreground">{c.powers}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(c.filled)}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.pct == null ? DASH : `${c.pct}%`}</TableCell>
                      <TableCell>{c.status === 'ok' ? <StatusBadge tone="good">Filled</StatusBadge>
                        : c.status === 'partial' ? <StatusBadge tone="warn">Partly filled</StatusBadge>
                        : <StatusBadge tone="bad">{c.status === 'empty' ? 'Empty' : 'Column absent'}</StatusBadge>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ── usage, feedback, audit ───────────────────────────────────────────
interface Usage {
  gap_minutes: number
  people: { username: string | null; email: string; role: string; scope_state: string | null; is_active: boolean; sessions: number; requests: number; active_days: number; last_seen: string; minutes: number }[]
  pages: { path: string; n: number; users: number }[]
  never_used: { username: string | null; email: string; role: string }[]
}

function UsagePanel() {
  const [days, setDays] = useState('30')
  const [d, setD] = useState<Usage | null>(null)
  useEffect(() => { setD(null); api<Usage>(`/usage?days=${days}`).then(setD).catch(() => setD({ gap_minutes: 30, people: [], pages: [], never_used: [] })) }, [days])
  const people = useSort((d?.people ?? []).map((p) => ({ ...p, who: p.username ?? p.email })), (r, k) => r[k as keyof typeof r] as unknown, { key: 'last_seen', dir: 'desc' })
  const pages = useSort((d?.pages ?? []).map((p) => ({ ...p, name: pageName(p.path) })), (r, k) => r[k as keyof typeof r] as unknown, { key: 'n', dir: 'desc' })
  const windows = [{ value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }]
  return (
    <div className="flex flex-col gap-6">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Who is using the dashboard</CardTitle>
          <CardDescription>
            A session ends after {d?.gap_minutes ?? 30} minutes without activity. The app holds no live
            connection and most people close the tab rather than signing out, so time is an
            estimate, and a visit to a single page reads as 0 minutes.
          </CardDescription>
          <CardAction>
            <Select items={windows} value={days} onValueChange={(v) => v && setDays(String(v))}>
              <SelectTrigger size="sm" aria-label="Time window"><SelectValue /></SelectTrigger>
              <SelectContent>{windows.map((w) => <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>)}</SelectContent>
            </Select>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 px-0">
          {d === null ? <Skeleton className="mx-6 h-32" /> : !d.people.length ? (
            <p className="px-6 py-4 text-sm text-muted-foreground">No activity recorded in this window.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="text-xs">
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <SortHead label="User" k="who" sort={people.sort} onSort={people.toggle} text />
                    <SortHead label="Role" k="role" sort={people.sort} onSort={people.toggle} text />
                    <SortHead label="Scope" k="scope_state" sort={people.sort} onSort={people.toggle} text />
                    <SortHead label="Sessions" k="sessions" sort={people.sort} onSort={people.toggle} align="right" />
                    <SortHead label="Days active" k="active_days" sort={people.sort} onSort={people.toggle} align="right" />
                    <SortHead label="Requests" k="requests" sort={people.sort} onSort={people.toggle} align="right" />
                    <SortHead label="Est. minutes" k="minutes" sort={people.sort} onSort={people.toggle} align="right" />
                    <SortHead label="Last seen" k="last_seen" sort={people.sort} onSort={people.toggle} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {people.sorted.map((p) => (
                    <TableRow key={p.email}>
                      <TableCell className="font-medium">{p.who}{!p.is_active && <span className="ml-1.5 text-muted-foreground">(disabled)</span>}</TableCell>
                      <TableCell className="capitalize">{p.role}</TableCell>
                      <TableCell>{p.scope_state ?? 'All states'}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(p.sessions)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(p.active_days)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(p.requests)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(p.minutes)}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">{when(p.last_seen)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {d && d.never_used.length > 0 && (
            <Alert className="mx-6 w-auto">
              <AlertTitle>Never signed in</AlertTitle>
              <AlertDescription>
                {d.never_used.map((n) => n.username ?? n.email).join(', ')}. These accounts exist but
                have not been used: worth a nudge, or remove them under Users and access.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
      <Card className="min-w-0">
        <CardHeader><CardTitle>Most-opened pages</CardTitle></CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table className="text-xs">
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <SortHead label="Page" k="name" sort={pages.sort} onSort={pages.toggle} text />
                  <SortHead label="Requests" k="n" sort={pages.sort} onSort={pages.toggle} align="right" />
                  <SortHead label="Users" k="users" sort={pages.sort} onSort={pages.toggle} align="right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pages.sorted.map((p) => (
                  <TableRow key={p.path}>
                    <TableCell>{p.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(p.n)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(p.users)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

interface FeedbackRow { email: string | null; page: string | null; message: string; created_at: string }

function FeedbackPanel() {
  const [rows, setRows] = useState<FeedbackRow[] | null>(null)
  const load = useCallback(() => { api<FeedbackRow[]>('/feedback').then(setRows).catch(() => setRows([])) }, [])
  useEffect(load, [load])
  const { sorted, sort, toggle } = useSort(rows ?? [], (r, k) => r[k as keyof typeof r] as unknown, { key: 'created_at', dir: 'desc' })
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Feedback</CardTitle>
        <CardDescription>Everything sent through Send feedback in the account menu, newest first.</CardDescription>
        <CardAction><Button variant="outline" size="sm" onClick={load}><RefreshCw />Refresh</Button></CardAction>
      </CardHeader>
      <CardContent className="px-0">
        {rows === null ? <Skeleton className="mx-6 h-32" /> : !rows.length ? (
          <p className="px-6 py-4 text-sm text-muted-foreground">No feedback yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table className="text-xs">
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <SortHead label="When" k="created_at" sort={sort} onSort={toggle} />
                  <SortHead label="From" k="email" sort={sort} onSort={toggle} text />
                  <SortHead label="Page" k="page" sort={sort} onSort={toggle} text />
                  <SortHead label="Message" k="message" sort={sort} onSort={toggle} text />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((f, i) => (
                  <TableRow key={i}>
                    <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{when(f.created_at)}</TableCell>
                    <TableCell>{f.email ?? DASH}</TableCell>
                    <TableCell>{f.page || DASH}</TableCell>
                    <TableCell className="min-w-[20rem] whitespace-pre-wrap">{f.message}</TableCell>
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

interface Audit {
  rows: { id: number; ts: string; actor: string | null; email: string | null; action: string; detail: string | null; ip: string | null }[]
  actions: { action: string; n: number }[]
}

function AuditPanel() {
  const [action, setAction] = useState('all')
  const [d, setD] = useState<Audit | null>(null)
  useEffect(() => {
    setD(null)
    api<Audit>(`/audit?limit=500${action === 'all' ? '' : `&action=${encodeURIComponent(action)}`}`)
      .then(setD).catch(() => setD({ rows: [], actions: [] }))
  }, [action])
  // The action list comes with every response; keep the first full one so
  // filtering to one action does not shrink the choices to that action.
  const [kinds, setKinds] = useState<Audit['actions']>([])
  useEffect(() => { if (d?.actions.length && !kinds.length) setKinds(d.actions) }, [d, kinds.length])
  const items = [{ value: 'all', label: 'Every action' }, ...kinds.map((k) => ({ value: k.action, label: `${k.action} (${fmt(k.n)})` }))]
  const { sorted, sort, toggle } = useSort(d?.rows ?? [], (r, k) => r[k as keyof typeof r] as unknown, { key: 'ts', dir: 'desc' })
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Audit trail</CardTitle>
        <CardDescription>
          Sign-ins, uploads, account changes, exports and every opening of client rows, newest
          first. Read-only: nothing can edit or delete an entry. The latest 500 are shown.
        </CardDescription>
        <CardAction>
          <Select items={items} value={action} onValueChange={(v) => v && setAction(String(v))}>
            <SelectTrigger size="sm" aria-label="Action" className="min-w-44"><SelectValue /></SelectTrigger>
            <SelectContent>{items.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        {d === null ? <Skeleton className="mx-6 h-40" /> : !d.rows.length ? (
          <p className="px-6 py-4 text-sm text-muted-foreground">Nothing recorded for this action.</p>
        ) : (
          <div className="max-h-[640px] overflow-auto">
            <Table className="text-xs">
              <TableHeader className="sticky top-0 z-10 bg-muted">
                <TableRow className="hover:bg-transparent">
                  <SortHead label="When" k="ts" sort={sort} onSort={toggle} />
                  <SortHead label="Who" k="actor" sort={sort} onSort={toggle} text />
                  <SortHead label="Action" k="action" sort={sort} onSort={toggle} text />
                  <SortHead label="Detail" k="detail" sort={sort} onSort={toggle} text />
                  <SortHead label="IP" k="ip" sort={sort} onSort={toggle} text />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{when(r.ts)}</TableCell>
                    <TableCell>{r.actor ?? r.email ?? DASH}</TableCell>
                    <TableCell className="font-mono">{r.action}</TableCell>
                    <TableCell className="min-w-[20rem] whitespace-normal">{r.detail}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">{r.ip ?? DASH}</TableCell>
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
