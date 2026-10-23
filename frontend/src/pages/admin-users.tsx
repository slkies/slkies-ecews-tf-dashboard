import { KeyRound, Trash2, UserPlus, Wand2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { SortHead, useSort } from '@/components/sortable'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
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
import { api } from '@/core/api'
import { useFilters } from '@/core/filters'
import { DASH } from '@/core/format'
import { useSession } from '@/core/session'

export interface User {
  id: number; username: string | null; email: string; full_name: string | null
  role: 'admin' | 'analyst' | 'viewer'; scope_state: string | null; scope_facility: string | null
  is_active: boolean; created_at: string
}

const ROLES = [
  { value: 'viewer', label: 'Viewer' },
  { value: 'analyst', label: 'Analyst' },
  { value: 'admin', label: 'Admin' },
]
export const MIN_PASSWORD = 10

/** A random password that meets the policy, for an admin to hand over in person. */
export function generatePassword(length = 14): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789-'
  const bytes = new Uint32Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

/** State and facility choices from the filter lists, so a scope can only name a place in the data. */
function useScopeChoices(state: string | null) {
  const { options } = useFilters()
  return useMemo(() => {
    const states = [{ value: 'All', label: 'All states' }, ...(options?.states ?? []).map((s) => ({ value: s, label: s }))]
    const facs = (options?.facilities ?? []).filter((f) => !state || state === 'All' || options?.facility_state?.[f] === state)
    return { states, facilities: [{ value: 'All', label: 'All facilities' }, ...facs.map((f) => ({ value: f, label: f }))] }
  }, [options, state])
}

function Pick({ label, value, items, onChange, disabled, className }: {
  label: string; value: string; items: { value: string; label: string }[]
  onChange: (v: string) => void; disabled?: boolean; className?: string
}) {
  return (
    <Select items={items} value={value} onValueChange={(v) => v != null && onChange(String(v))} disabled={disabled}>
      <SelectTrigger size="sm" aria-label={label} className={className ?? 'w-full'}><SelectValue /></SelectTrigger>
      <SelectContent>{items.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
    </Select>
  )
}

type AccessPatch = Partial<Pick<User, 'role' | 'scope_state' | 'scope_facility'>>

/**
 * What one dropdown change sends: the account's whole access, with the change
 * applied, so a role change cannot quietly reset a scope. A new state clears
 * the facility, which may not be in it.
 */
export function accessPayload(u: User, patch: AccessPatch) {
  const next = { role: u.role, scope_state: u.scope_state ?? 'All', scope_facility: u.scope_facility ?? 'All', ...patch }
  if (patch.scope_state !== undefined) next.scope_facility = 'All'
  return next
}

export default function UsersPanel() {
  const { me } = useSession()
  const [users, setUsers] = useState<User[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [resetFor, setResetFor] = useState<User | null>(null)
  const [deleteFor, setDeleteFor] = useState<User | null>(null)

  const load = useCallback(() => {
    api<User[]>('/users').then((r) => { setUsers(r); setErr(null) })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Could not load the users'))
  }, [])
  useEffect(load, [load])

  // Role and scope are sent together, so one control cannot quietly undo what
  // another just set. On a refusal the table reloads to what the server holds.
  async function setAccess(u: User, patch: AccessPatch) {
    try {
      await api(`/users/${u.id}/access`, { method: 'POST', body: JSON.stringify(accessPayload(u, patch)) })
      setNote(`${u.username ?? u.email}: access updated.`); setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not change access'); setNote(null)
    }
    load()
  }

  async function toggle(u: User) {
    try { await api(`/users/${u.id}`, { method: 'PATCH' }); setNote(`${u.username ?? u.email} ${u.is_active ? 'disabled' : 'enabled'}.`) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Could not change the account') }
    load()
  }

  async function remove(u: User) {
    try { await api(`/users/${u.id}`, { method: 'DELETE' }); setNote(`${u.username ?? u.email} deleted.`); setErr(null) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Could not delete the account') }
    setDeleteFor(null); load()
  }

  const rows = (users ?? []).map((u) => ({ ...u, name: u.full_name ?? u.username ?? u.email, self: u.email === me?.email }))
  const { sorted, sort, toggle: sortBy } = useSort(rows, (r, k) => r[k as keyof typeof r] as unknown)

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Users and access</CardTitle>
        <CardDescription>
          Viewers and analysts see every page except Admin; analysts can also export line lists. Only
          admins upload and manage users. A state or facility scope limits everything an account
          sees, exports included. Changes take effect on the person's next click, without signing in again.
        </CardDescription>
        <CardAction><Button size="sm" onClick={() => setAdding(true)}><UserPlus />Add user</Button></CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-0">
        {err && <Alert variant="destructive" className="mx-6 w-auto"><AlertDescription>{err}</AlertDescription></Alert>}
        {note && !err && <p role="status" className="px-6 text-sm text-muted-foreground">{note}</p>}
        {users === null ? <Skeleton className="mx-6 h-40" /> : (
          <div className="overflow-x-auto">
            <Table className="text-xs">
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <SortHead label="Name" k="name" sort={sort} onSort={sortBy} text />
                  <SortHead label="Role" k="role" sort={sort} onSort={sortBy} text />
                  <SortHead label="State" k="scope_state" sort={sort} onSort={sortBy} text />
                  <SortHead label="Facility" k="scope_facility" sort={sort} onSort={sortBy} text />
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((u) => <UserRow key={u.id} u={u} self={u.self} onAccess={setAccess}
                                            onToggle={toggle} onReset={setResetFor} onDelete={setDeleteFor} />)}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <AddUserDialog open={adding} onOpenChange={setAdding} onAdded={(name) => { setNote(`${name} added.`); setErr(null); load() }} />
      <ResetPasswordDialog user={resetFor} onClose={() => setResetFor(null)} onDone={(name) => setNote(`Password reset for ${name}.`)} />
      <AlertDialog open={deleteFor !== null} onOpenChange={(o) => !o && setDeleteFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteFor?.full_name ?? deleteFor?.username ?? deleteFor?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              The account is removed for good and its sign-in stops working at once. What they did
              stays on record under their email: the audit trail and their feedback. If they may
              come back, disable the account instead; that can be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => deleteFor && remove(deleteFor)}>Delete account</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function UserRow({ u, self, onAccess, onToggle, onReset, onDelete }: {
  u: User; self: boolean
  onAccess: (u: User, p: AccessPatch) => void
  onToggle: (u: User) => void; onReset: (u: User) => void; onDelete: (u: User) => void
}) {
  const { states, facilities } = useScopeChoices(u.scope_state)
  const name = u.full_name ?? u.username ?? u.email
  return (
    <TableRow className={u.is_active ? undefined : 'text-muted-foreground'}>
      {/* Username and email under the name: as separate columns the table
          was too wide for a laptop and the actions fell off the right. */}
      <TableCell>
        <span className="flex flex-col">
          <span className="font-medium">{name}{self && <span className="ml-1.5 font-normal text-muted-foreground">(you)</span>}{!u.is_active && <span className="ml-1.5 font-normal text-muted-foreground">(disabled)</span>}</span>
          <span className="block max-w-52 truncate text-muted-foreground" title={u.email}>{u.username ?? DASH} · {u.email}</span>
        </span>
      </TableCell>
      {/* Your own row is read-only: the server refuses a change to your own
          role, so a control that always fails is worse than none. */}
      <TableCell className="w-28">
        {self ? <span className="capitalize">{u.role}</span>
              : <Pick label={`Role for ${name}`} value={u.role} items={ROLES} onChange={(v) => onAccess(u, { role: v as User['role'] })} />}
      </TableCell>
      <TableCell className="w-28">
        {self ? u.scope_state ?? 'All states'
              : <Pick label={`State for ${name}`} value={u.scope_state ?? 'All'} items={states} onChange={(v) => onAccess(u, { scope_state: v })} />}
      </TableCell>
      <TableCell className="w-36 max-w-36">
        {self ? u.scope_facility ?? 'All facilities'
              : <Pick label={`Facility for ${name}`} value={u.scope_facility ?? 'All'} items={facilities} onChange={(v) => onAccess(u, { scope_facility: v })} />}
      </TableCell>
      <TableCell>
        <span className="flex justify-end gap-1.5 whitespace-nowrap">
          <Button variant="outline" size="icon-sm" onClick={() => onReset(u)} aria-label={`Reset the password for ${name}`} title="Reset password"><KeyRound /></Button>
          {!self && <Button variant="outline" size="sm" onClick={() => onToggle(u)}>{u.is_active ? 'Disable' : 'Enable'}</Button>}
          {!self && <Button variant="ghost" size="icon-sm" onClick={() => onDelete(u)} aria-label={`Delete ${name}`}><Trash2 className="text-bad" /></Button>}
        </span>
      </TableCell>
    </TableRow>
  )
}

function PasswordField({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>Password</Label>
      <div className="flex gap-2">
        <Input id={id} type="text" autoComplete="new-password" spellCheck={false} value={value}
               onChange={(e) => onChange(e.target.value)} className="font-mono" />
        <Button type="button" variant="outline" onClick={() => onChange(generatePassword())}><Wand2 />Generate</Button>
      </div>
      <span className="text-xs text-muted-foreground">
        At least {MIN_PASSWORD} characters. Give it to the person directly, and ask them to change it
        from their account menu.
      </span>
    </div>
  )
}

function AddUserDialog({ open, onOpenChange, onAdded }: {
  open: boolean; onOpenChange: (o: boolean) => void; onAdded: (name: string) => void
}) {
  const blank = { full_name: '', username: '', email: '', role: 'viewer', scope_state: 'All', scope_facility: 'All', password: '' }
  const [f, setF] = useState(blank)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const { states, facilities } = useScopeChoices(f.scope_state)
  const set = (k: keyof typeof blank) => (v: string) => setF((cur) => ({ ...cur, [k]: v, ...(k === 'scope_state' ? { scope_facility: 'All' } : {}) }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      await api('/users', { method: 'POST', body: JSON.stringify(f) })
      onAdded(f.full_name || f.username); setF(blank); onOpenChange(false)
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : 'Could not add the user') }
    finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setErr(null) }}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Add a user</DialogTitle>
            <DialogDescription>The account can sign in straight away with the password below.</DialogDescription>
          </DialogHeader>
          {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}
          <div className="grid gap-3 sm:grid-cols-2">
            {([['full_name', 'Full name', 'text'], ['username', 'Username', 'text'], ['email', 'Email', 'email']] as const).map(([k, l, t]) => (
              <div key={k} className={k === 'email' ? 'flex flex-col gap-1.5 sm:col-span-2' : 'flex flex-col gap-1.5'}>
                <Label htmlFor={`nu-${k}`}>{l}</Label>
                <Input id={`nu-${k}`} type={t} required={k !== 'full_name'} value={f[k]} onChange={(e) => set(k)(e.target.value)} />
              </div>
            ))}
            <div className="flex flex-col gap-1.5">
              <Label>Role</Label>
              <Pick label="Role" value={f.role} items={ROLES} onChange={set('role')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>State</Label>
              <Pick label="State" value={f.scope_state} items={states} onChange={set('scope_state')} />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>Facility</Label>
              <Pick label="Facility" value={f.scope_facility} items={facilities} onChange={set('scope_facility')} />
            </div>
          </div>
          <PasswordField id="nu-password" value={f.password} onChange={set('password')} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy || f.password.length < MIN_PASSWORD}>{busy && <Spinner />}Add user</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ResetPasswordDialog({ user, onClose, onDone }: { user: User | null; onClose: () => void; onDone: (name: string) => void }) {
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const name = user ? user.full_name ?? user.username ?? user.email : ''

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setBusy(true); setErr(null)
    try {
      await api(`/users/${user.id}/password`, { method: 'POST', body: JSON.stringify({ password: pw }) })
      onDone(name); setPw(''); onClose()
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : 'Could not reset the password') }
    finally { setBusy(false) }
  }

  return (
    <Dialog open={user !== null} onOpenChange={(o) => { if (!o) { onClose(); setPw(''); setErr(null) } }}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Reset the password for {name}</DialogTitle>
            <DialogDescription>Their old password stops working as soon as this is saved.</DialogDescription>
          </DialogHeader>
          {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}
          <PasswordField id="reset-password" value={pw} onChange={setPw} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy || pw.length < MIN_PASSWORD}>{busy && <Spinner />}Reset password</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
