/**
 * Add several accounts from one list.
 *
 * Three steps, and nothing is saved until the last: paste the list, see what
 * the server makes of every row, then create them all. The server makes each
 * first password and returns it once, so no password is typed into a
 * spreadsheet beforehand. One bad row stops the whole list, so a list is never
 * left half-loaded.
 */
import { Copy, Download, FileUp } from 'lucide-react'
import { useRef, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/core/api'
import { DASH } from '@/core/format'

export interface BulkRowIn {
  full_name: string; email: string; role: string; scope_state: string; scope_facility: string
}
export interface BulkRowOut {
  row: number; email: string; username: string | null; full_name: string; role: string
  scope_state: string | null; scope_facility: string | null; errors: string[]; password?: string
}
interface BulkResponse { ok: boolean; created: number; errors: number; rows: BulkRowOut[] }

export const BULK_MAX = 200
const COLUMNS = ['Full name', 'Email', 'Role', 'State', 'Facility'] as const

/** One line of a CSV, allowing a quoted cell to hold a comma. */
function splitCsv(line: string): string[] {
  const out: string[] = []
  let cur = '', quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') quoted = false
      else cur += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out
}

/**
 * Rows from pasted text: tab-separated as Excel copies them, or comma-separated
 * as a CSV file holds them. Columns in order: full name, email, role, state,
 * facility. A heading row is skipped, blank lines ignored.
 */
export function parseList(text: string): BulkRowIn[] {
  const rows: BulkRowIn[] = []
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue
    const cells = (raw.includes('\t') ? raw.split('\t') : splitCsv(raw)).map((c) => c.trim())
    // a heading row names the email column and holds no address
    if (!rows.length && !raw.includes('@') && /e-?mail/i.test(raw)) continue
    const [full_name = '', email = '', role = '', scope_state = '', scope_facility = ''] = cells
    rows.push({ full_name, email, role, scope_state, scope_facility })
  }
  return rows
}

const csvCell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

/** The created accounts with their first passwords, as CSV text. */
export function credentialsCsv(rows: BulkRowOut[]): string {
  const head = ['Full name', 'Username', 'Email', 'Role', 'State', 'Facility', 'First password']
  const body = rows.map((r) => [r.full_name, r.username ?? '', r.email, r.role,
    r.scope_state ?? 'All states', r.scope_facility ?? 'All facilities', r.password ?? ''])
  return [head, ...body].map((line) => line.map(csvCell).join(',')).join('\r\n')
}

export function BulkUsersDialog({ open, onOpenChange, onCreated }: {
  open: boolean; onOpenChange: (o: boolean) => void; onCreated: (n: number) => void
}) {
  const [text, setText] = useState('')
  const [checked, setChecked] = useState<BulkResponse | null>(null)
  const [made, setMade] = useState<BulkRowOut[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const file = useRef<HTMLInputElement>(null)

  const rows = parseList(text)
  const tooMany = rows.length > BULK_MAX

  function reset() { setText(''); setChecked(null); setMade(null); setErr(null); setCopied(false) }

  async function send(dryRun: boolean) {
    setBusy(true); setErr(null)
    try {
      const r = await api<BulkResponse>('/users/bulk', { method: 'POST', body: JSON.stringify({ users: rows, dry_run: dryRun }) })
      if (!dryRun && r.created > 0) { setMade(r.rows); setChecked(null); onCreated(r.created) }
      else setChecked(r)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not check the list') }
    finally { setBusy(false) }
  }

  function download() {
    if (!made) return
    const url = URL.createObjectURL(new Blob([credentialsCsv(made)], { type: 'text/csv' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `new_accounts_${new Date().toISOString().slice(0, 10)}.csv` })
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
  }

  async function copy() {
    if (!made) return
    try {
      await navigator.clipboard.writeText(made.map((r) => [r.full_name, r.username, r.email, r.password].join('\t')).join('\n'))
      setCopied(true)
    } catch { setErr('Could not copy. Use Download instead.') }
  }

  const shown = made ?? checked?.rows ?? null

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent className="sm:max-w-4xl">
        <div className="flex max-h-[80vh] flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{made ? `${made.length} accounts created` : 'Add several users'}</DialogTitle>
            <DialogDescription>
              {made
                ? 'These first passwords are shown once and cannot be shown again. Download or copy them now, hand each one over directly, and ask each person to change theirs from the account menu.'
                : 'Paste one person per line, copied from Excel or a CSV file. Nothing is saved until you have checked the list. The dashboard makes each first password.'}
            </DialogDescription>
          </DialogHeader>
          {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}

          {!made && (
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="bulk-list">Columns, in this order: {COLUMNS.join(', ')}</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => file.current?.click()}><FileUp />Choose a CSV file</Button>
                <input ref={file} type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" aria-label="CSV file of users"
                       onChange={async (e) => {
                         const f = e.target.files?.[0]
                         if (f) { setText(await f.text()); setChecked(null) }
                         e.target.value = ''
                       }} />
              </div>
              <Textarea id="bulk-list" rows={6} spellCheck={false} value={text} className="font-mono text-xs"
                        placeholder={'Ada Example\tada@example.org\tViewer\tEkiti\tFacility name as on the dashboard'}
                        onChange={(e) => { setText(e.target.value); setChecked(null) }} />
              <span className="text-xs text-muted-foreground">
                Role is Viewer, Analyst or Admin; blank means Viewer. Leave Facility blank for a
                state-wide account, and both State and Facility blank for all states. Facility names
                must match the dashboard's. Up to {BULK_MAX} at a time.
                {rows.length > 0 && <> {rows.length} {rows.length === 1 ? 'row' : 'rows'} read.</>}
              </span>
            </div>
          )}

          {checked && !made && (
            <p role="status" className={checked.ok ? 'text-sm text-good' : 'text-sm text-bad'}>
              {checked.ok
                ? `All ${checked.rows.length} rows are ready. Nothing has been saved yet.`
                : `${checked.errors} of ${checked.rows.length} rows need correcting. Nothing has been saved.`}
            </p>
          )}

          {shown && (
            <div className="min-h-0 overflow-auto rounded-lg border">
              <Table className="text-xs">
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Row</TableHead><TableHead>Name</TableHead><TableHead>Username</TableHead>
                    <TableHead>Role</TableHead><TableHead>State</TableHead><TableHead>Facility</TableHead>
                    <TableHead>{made ? 'First password' : 'Check'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((r) => (
                    <TableRow key={r.row}>
                      <TableCell className="tabular-nums">{r.row}</TableCell>
                      <TableCell>
                        <span className="flex flex-col"><span className="font-medium">{r.full_name}</span>
                          <span className="text-muted-foreground">{r.email || DASH}</span></span>
                      </TableCell>
                      <TableCell>{r.username ?? DASH}</TableCell>
                      <TableCell className="capitalize">{r.role}</TableCell>
                      <TableCell>{r.scope_state ?? 'All states'}</TableCell>
                      <TableCell>{r.scope_facility ?? 'All facilities'}</TableCell>
                      <TableCell>
                        {made ? <span className="font-mono">{r.password}</span>
                          : r.errors.length ? <span className="text-bad">{r.errors.join('; ')}</span>
                          : <span className="text-good">Ready</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <DialogFooter>
            {made ? (
              <>
                <Button type="button" variant="outline" onClick={copy}><Copy />{copied ? 'Copied' : 'Copy'}</Button>
                <Button type="button" variant="outline" onClick={download}><Download />Download as CSV</Button>
                <Button type="button" onClick={() => { onOpenChange(false); reset() }}>Done</Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => { onOpenChange(false); reset() }}>Cancel</Button>
                {checked?.ok
                  ? <Button type="button" disabled={busy} onClick={() => send(false)}>{busy && <Spinner />}Create {checked.rows.length} accounts</Button>
                  : <Button type="button" disabled={busy || !rows.length || tooMany} onClick={() => send(true)}>{busy && <Spinner />}Check the list</Button>}
              </>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
