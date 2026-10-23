/**
 * The two things anyone can do from the account menu: change their own
 * password, and send feedback to the admins.
 */
import { useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/core/api'

const MIN = 10

export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [cur, setCur] = useState('')
  const [pw, setPw] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const reset = () => { setCur(''); setPw(''); setAgain(''); setErr(null); setDone(false) }
  const mismatch = again.length > 0 && pw !== again

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      await api('/me/password', { method: 'POST', body: JSON.stringify({ current_password: cur, password: pw }) })
      setDone(true); setCur(''); setPw(''); setAgain('')
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : 'Could not change the password') }
    finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Change your password</DialogTitle>
            <DialogDescription>Use the new one next time you sign in. You stay signed in now.</DialogDescription>
          </DialogHeader>
          {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}
          {done ? (
            <p role="status" className="text-sm">Password changed.</p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pw-current">Current password</Label>
                <Input id="pw-current" type="password" autoComplete="current-password" required value={cur} onChange={(e) => setCur(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pw-new">New password</Label>
                <Input id="pw-new" type="password" autoComplete="new-password" required value={pw} onChange={(e) => setPw(e.target.value)} />
                <span className="text-xs text-muted-foreground">At least {MIN} characters.</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pw-again">New password again</Label>
                <Input id="pw-again" type="password" autoComplete="new-password" required value={again}
                       aria-invalid={mismatch || undefined} onChange={(e) => setAgain(e.target.value)} />
                {mismatch && <span className="text-xs text-bad">The two entries do not match.</span>}
              </div>
            </div>
          )}
          <DialogFooter>
            {done ? <Button type="button" onClick={() => onOpenChange(false)}>Close</Button> : (
              <>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit" disabled={busy || !cur || pw.length < MIN || pw !== again}>{busy && <Spinner />}Change password</Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function FeedbackDialog({ open, onOpenChange, page }: { open: boolean; onOpenChange: (o: boolean) => void; page: string }) {
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      await api('/feedback', { method: 'POST', body: JSON.stringify({ message: msg.trim(), page }) })
      setSent(true); setMsg('')
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : 'Could not send') }
    finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setSent(false); setErr(null) } }}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Send feedback</DialogTitle>
            <DialogDescription>
              Goes to the dashboard admins, noting that you were on {page}. Please do not include
              client identifiers.
            </DialogDescription>
          </DialogHeader>
          {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}
          {sent ? <p role="status" className="text-sm">Thank you, sent.</p> : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fb-msg">What should we know?</Label>
              <Textarea id="fb-msg" rows={5} value={msg} onChange={(e) => setMsg(e.target.value)} />
            </div>
          )}
          <DialogFooter>
            {sent ? <Button type="button" onClick={() => onOpenChange(false)}>Close</Button> : (
              <>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit" disabled={busy || !msg.trim()}>{busy && <Spinner />}Send</Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
