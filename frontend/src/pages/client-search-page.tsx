import { Search, UserSearch } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { ClientKey, useOpenClient } from '@/components/client-record'
import { SortHead, useSort } from '@/components/sortable'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import {
  Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxTrigger,
} from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import {
  Table, TableBody, TableCell, TableHeader, TableRow,
} from '@/components/ui/table'
import { api } from '@/core/api'
import { useFilters } from '@/core/filters'
import { DASH, fmt, fmtDate } from '@/core/format'

export interface ClientMatch {
  sn: string; facility: string | null; state: string | null; sex: string | null; age: number | null
  art_status: string | null; idx_vl: number | null; recv_date: string | null; idx_date: string | null
  episodes: number
}
interface SearchResult { n: number; shown: number; limit: number; clients: ClientMatch[] }

export const SN_MIN = 4
const SEXES = [{ value: 'any', label: 'Any' }, { value: 'Female', label: 'Female' }, { value: 'Male', label: 'Male' }]
const BLANK = { facility: '', sex: 'any', age_min: '', age_max: '', idx_from: '', idx_to: '', vl_min: '', vl_max: '' }

/**
 * Find one client for facility review. By S/N, which staff have from the line
 * list, or by details when they do not: a facility plus at least one more, so
 * this finds a client rather than listing everyone (that is what the
 * worklists are for). Searches the whole current line list within the
 * account's area; the filter bar does not apply.
 */
export default function ClientSearchPage() {
  const { options } = useFilters()
  const open = useOpenClient()
  const [q, setQ] = useState('')
  const [d, setD] = useState(BLANK)
  const [res, setRes] = useState<SearchResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const detailCount = Object.entries(d).filter(([k, v]) => k !== 'facility' && v && v !== 'any').length
  const canFind = !!d.facility && detailCount > 0

  async function run(params: URLSearchParams, single: boolean) {
    setBusy(true); setErr(null)
    try {
      const r = await api<SearchResult>(`/client-search?${params.toString()}`)
      setRes(r)
      // One S/N, one client: go straight to the record.
      if (single && r.n === 1 && open) open(r.clients[0]!.sn)
    } catch (e) {
      setRes(null); setErr(e instanceof Error ? e.message : 'The search failed')
    } finally { setBusy(false) }
  }

  function bySn(e: FormEvent) {
    e.preventDefault()
    const v = q.trim()
    if (v.length < SN_MIN) return
    void run(new URLSearchParams({ q: v }), true)
  }

  function byDetails(e: FormEvent) {
    e.preventDefault()
    if (!canFind) return
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries(d)) if (v && v !== 'any') p.set(k, v)
    void run(p, false)
  }

  const set = (k: keyof typeof BLANK) => (v: string) => setD((cur) => ({ ...cur, [k]: v }))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-balance">Client search</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Find one client to review their record: every failure episode, the EAC sessions, the
          follow-up result, and the worklists they are on with the next step. Searches the whole
          current line list in your area; the filters on other pages do not apply. Each search and
          each record opened is recorded in the audit trail.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>By S/N</CardTitle>
            <CardDescription>
              The S/N is on the line list your facility receives. Part of it works too, at least {SN_MIN} characters.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={bySn} className="flex gap-2">
              <Label htmlFor="sn-q" className="sr-only">S/N</Label>
              <Input id="sn-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. 0.4815…"
                     inputMode="decimal" autoComplete="off" spellCheck={false} className="font-mono" />
              <Button type="submit" disabled={busy || q.trim().length < SN_MIN}>
                {busy ? <Spinner /> : <Search />}Find
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>By details</CardTitle>
            <CardDescription>Without the S/N: choose the facility and at least one more detail.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={byDetails} className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label>Facility</Label>
                <FacilityPick value={d.facility} items={options?.facilities ?? []} onChange={set('facility')} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Sex</Label>
                <Select items={SEXES} value={d.sex} onValueChange={(v) => v && set('sex')(String(v))}>
                  <SelectTrigger aria-label="Sex" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{SEXES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Range label="Age" from={d.age_min} to={d.age_max} onFrom={set('age_min')} onTo={set('age_max')} type="number" />
              <Range label="Index result received" from={d.idx_from} to={d.idx_to} onFrom={set('idx_from')} onTo={set('idx_to')} type="date" wide />
              <Range label="Index VL (copies/mL)" from={d.vl_min} to={d.vl_max} onFrom={set('vl_min')} onTo={set('vl_max')} type="number" wide />
              <div className="flex items-center gap-2 sm:col-span-2">
                <Button type="submit" disabled={busy || !canFind}>{busy ? <Spinner /> : <UserSearch />}Find clients</Button>
                <Button type="button" variant="ghost" onClick={() => setD(BLANK)}>Clear</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}
      {res && <Results res={res} />}
    </div>
  )
}

function Range({ label, from, to, onFrom, onTo, type, wide = false }: {
  label: string; from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void
  type: 'number' | 'date'; wide?: boolean
}) {
  return (
    <fieldset className={wide ? 'flex flex-col gap-1.5 sm:col-span-2' : 'flex flex-col gap-1.5'}>
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <div className="flex items-center gap-2">
        <Input type={type} aria-label={`${label} from`} value={from} onChange={(e) => onFrom(e.target.value)} min={type === 'number' ? 0 : undefined} />
        <span className="text-xs text-muted-foreground">to</span>
        <Input type={type} aria-label={`${label} to`} value={to} onChange={(e) => onTo(e.target.value)} min={type === 'number' ? 0 : undefined} />
      </div>
    </fieldset>
  )
}

/** One facility, searchable: the list runs to hundreds. Only facilities in the account's area are offered. */
function FacilityPick({ value, items, onChange }: { value: string; items: string[]; onChange: (v: string) => void }) {
  return (
    <Combobox items={items} value={value || null} autoHighlight onValueChange={(v) => onChange((v as string | null) ?? '')}>
      <ComboboxTrigger render={<Button variant="outline" aria-label={`Facility: ${value || 'choose one'}`} className="w-full justify-between px-2.5 font-normal" />}>
        <span className="truncate">{value || 'Choose a facility'}</span>
      </ComboboxTrigger>
      <ComboboxContent className="w-80">
        <ComboboxInput showTrigger={false} placeholder="Search facilities" />
        <ComboboxEmpty>No matches.</ComboboxEmpty>
        <ComboboxList>{(item: string) => <ComboboxItem key={item} value={item}>{item}</ComboboxItem>}</ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

function Results({ res }: { res: SearchResult }) {
  const open = useOpenClient()
  const rows = useMemo(() => res.clients.map((c) => ({ ...c, received: c.recv_date ?? c.idx_date })), [res])
  const { sorted, sort, toggle } = useSort(rows, (r, k) => r[k as keyof typeof r] as unknown, { key: 'received', dir: 'desc' })
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>{res.n === 0 ? 'No client matched' : `${fmt(res.n)} ${res.n === 1 ? 'client' : 'clients'} matched`}</CardTitle>
        <CardDescription>
          {res.n === 0 ? 'Check the S/N, or widen the details.'
            : res.n > res.shown ? `Showing the ${fmt(res.shown)} with the most recent index result. Add a detail to narrow it.`
            : 'Open a client to see their record.'}
        </CardDescription>
      </CardHeader>
      {res.n > 0 && (
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table className="text-xs">
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <SortHead label="Client" k="sn" sort={sort} onSort={toggle} text />
                  <SortHead label="Facility" k="facility" sort={sort} onSort={toggle} text />
                  <SortHead label="Sex" k="sex" sort={sort} onSort={toggle} text />
                  <SortHead label="Age" k="age" sort={sort} onSort={toggle} align="right" />
                  <SortHead label="Latest index VL" k="idx_vl" sort={sort} onSort={toggle} align="right" />
                  <SortHead label="Result received" k="received" sort={sort} onSort={toggle} />
                  <SortHead label="Episodes" k="episodes" sort={sort} onSort={toggle} align="right" />
                  <SortHead label="ART status" k="art_status" sort={sort} onSort={toggle} text />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((c) => (
                  <TableRow key={c.sn} className={open ? 'cursor-pointer' : undefined} onClick={() => open?.(c.sn)}>
                    <TableCell onClick={(e) => e.stopPropagation()}><ClientKey sn={c.sn} /></TableCell>
                    <TableCell className="max-w-[16rem] truncate" title={c.facility ?? undefined}>{c.facility ?? DASH}</TableCell>
                    <TableCell>{c.sex ?? DASH}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.age ?? DASH}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(c.idx_vl)}</TableCell>
                    <TableCell className="tabular-nums">{fmtDate(c.received)}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.episodes}</TableCell>
                    <TableCell>{c.art_status ?? DASH}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
