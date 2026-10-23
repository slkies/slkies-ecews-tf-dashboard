import { ClipboardList, FileSpreadsheet, HeartPulse, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Callout, Doc, DocGrid, H3, RefTable } from '@/components/doc'
import { SortHead, useSort } from '@/components/sortable'
import { StatusBadge } from '@/components/status-badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHeader, TableRow,
} from '@/components/ui/table'
import { api } from '@/core/api'
import { fmt, fmtDate } from '@/core/format'
import type { Overview, Source } from '@/core/overview'

/** The three kinds of sheet a line list carries, in the order they are read. */
const KINDS: { kind: string; label: string; role: string; icon: LucideIcon }[] = [
  { kind: 'total', label: 'Total Unsuppressed register', role: 'Who is in the cohort: every index VL of 1,000 or more.', icon: ClipboardList },
  { kind: 'treatment', label: 'Treatment line lists', role: 'Every viral load, index and follow-up, plus ART status and outcome.', icon: HeartPulse },
  { kind: 'eac', label: 'EAC line lists', role: 'The EAC session dates. Never used for a viral load.', icon: FileSpreadsheet },
]
const kindLabel = (k: string) => KINDS.find((x) => x.kind === k)?.label ?? k

/**
 * Data Analysis Plan v3.0: how the figures are built, then the line list they
 * are built from. Moved here from the foot of the Overview (Es, 23 Oct 2026),
 * with the sources kept apart from the definitions.
 */
export default function MethodologyPage() {
  // The whole current snapshot, unfiltered: the methods describe the data as loaded.
  const [ov, setOv] = useState<Overview | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let off = false
    api<Overview>('/overview').then((r) => { if (!off) setOv(r) }).catch(() => { if (!off) setFailed(true) })
    return () => { off = true }
  }, [])
  // Every episode beyond a client's first is a second (or later) failure.
  const repeats = ov && ov.clients ? ov.n - ov.clients : null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-balance">Methodology</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          How the figures are built, what each term means, and the line list they come from.
        </p>
      </div>

      <DocGrid>
        <Doc eyebrow="Data Analysis Plan v3.0" title="The unit of analysis is a failure episode">
          <p>
            A client may fail, complete EAC, re-suppress, and fail again. That is two index events and
            two trips through the cascade: one client, two episodes. The key is the client S/N, the
            index VL date and the index VL value together, never the S/N alone.
            {ov?.repeat_clients ? ` In the current line list, ${fmt(ov.repeat_clients)} clients were unsuppressed more than once.` : ''}
          </p>
          <Callout>
            De-duplicating on the S/N would delete {repeats == null ? 'every' : `the ${fmt(repeats)}`} second
            and later failures in the current line list, the highest-priority switch candidates in the
            programme.
          </Callout>
          <p>
            Rates are computed per episode. Distinct client counts are shown alongside, so no headline
            double-counts a person.
          </p>
        </Doc>

        <Doc title="The index cohort is an open cohort with quarterly enrolment">
          <p>
            The cohort is drawn quarterly from the Total Unsuppressed register. A snapshot of clients
            whose current VL is 1,000 or more, drawn on the same day as the line list, cannot support
            the outcome half of the cascade: a post-EAC VL becomes the current VL, so a client who
            re-suppresses leaves the cohort, and one who is still failing has no later result. Steps
            7 to 10 would compute to exactly zero.
          </p>
          <p>
            Building the index list quarterly freezes each index event in the quarter it occurred, so a
            post-EAC VL can land after it. That is why the cascade has an outcome arm at all.
          </p>
        </Doc>

        <Doc title="Who is counted as a gap">
          <p>
            A client who left care before a repeat VL is not a gap a team can close. They are counted
            in the cohort, shown as their own cascade step and worklist, and left out of every gap
            measure: the cascade steps after it, the Overview rates, the facility and state tables,
            the gap worklists and the risk list. A client who left care after being retested stays
            in, because their outcome is known.
          </p>
          <p>
            Worklists are ranked by clinical urgency. High: a decision is overdue. Medium: the next
            step has not happened. Low: wider nets that overlap the lists above, and clients who have
            left care. Data checks are not ranked.
          </p>
        </Doc>

        <Doc title="Known data gaps">
          <p>Raised with the HI team. The dashboard says so where these apply, rather than hiding them.</p>
          <RefTable head={['Gap', 'Effect']} rows={[
            ['No switch date in the export', 'Time to switch cannot be measured, and step 10 cannot be attributed to a cycle'],
            ['Some EAC lists are success-censored', 'Their outcomes are unusable; the sheets are excluded automatically and marked in Data sources below'],
            ['The client key is exported as a number', 'Joins break silently after an Excel re-save; it is handled as text here'],
            ['State names are cased inconsistently', 'Normalised when a line list is loaded'],
          ]} />
        </Doc>

        <Doc title="Definitions" wide>
          <RefTable head={['Term', 'Definition']} rows={[
            ['Failure episode', 'One index VL of 1,000 copies/mL or more, and everything that follows from it'],
            ['Unsuppressed', 'VL 1,000 copies/mL or more'],
            ['Low-level viraemia', 'VL 50 to 999 copies/mL'],
            ['Undetectable', 'VL below 50 copies/mL'],
            ['Viral loads', 'Index and follow-up both come from the treatment line lists, never the EAC sheet'],
            ['Follow-up VL', 'The next VL sampled after the index result was received'],
            ['Re-suppressed', 'Follow-up VL below 1,000 copies/mL, including low-level viraemia'],
            ['Valid EAC cycle', 'Session 1 on or after the index VL date'],
            ['EAC completed', 'Sessions 1, 2 and 3 recorded, and 30 days or more since session 3'],
            ['Post-EAC VL', 'Among episodes that completed EAC: sessions 1 to 3 recorded and a VL sample collected on or after session 3, whatever the 30-day rule. A different indicator from the follow-up VL, which is any VL sampled after the index result'],
            ['Left care before a repeat VL', 'An ART status of LTFU, IIT, stopped, died, transferred out or discontinued, with no follow-up VL'],
            ['Fiscal year', '1 October to 30 September. Q1 is October to December, Q4 is July to September'],
          ]} />
        </Doc>

        <DataSources ov={ov} failed={failed} />
      </DocGrid>

    </div>
  )
}

function DataSources({ ov, failed }: { ov: Overview | null; failed: boolean }) {
  const sources: Source[] = ov?.sources ?? []
  const rows = sources.map((s) => ({ ...s, type: kindLabel(s.kind), order: KINDS.findIndex((k) => k.kind === s.kind), excluded: !!s.censored }))
  const { sorted, sort, toggle } = useSort(rows, (r, k) => r[k as keyof typeof r] as unknown, { key: 'order', dir: 'asc' })

  return (
    <Doc title="Data sources" wide>
      <p>
        {ov?.as_of
          ? `The current line list is dated ${fmtDate(ov.as_of)}${ov.filename ? ` (${ov.filename})` : ''}. That date sets the fiscal quarter and the follow-up windows. It holds ${fmt(ov.n)} episodes from ${fmt(ov.clients)} clients.`
          : 'The line list loaded on the Admin page, read sheet by sheet.'}
      </p>
      {failed ? <p className="text-muted-foreground">The sheet list could not be loaded.</p>
        : ov === null ? <Skeleton className="h-40 w-full" /> : (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            {KINDS.map((k) => {
              const of = sources.filter((s) => s.kind === k.kind)
              const used = of.filter((s) => !s.censored)
              const Icon = k.icon
              return (
                <Card key={k.kind} size="sm">
                  <CardContent className="flex flex-col gap-1.5">
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      <span className="flex size-7 items-center justify-center rounded-md bg-[color-mix(in_oklch,var(--icon)_14%,transparent)] text-[var(--icon)] [&_svg]:size-4"><Icon aria-hidden /></span>
                      {k.label}
                    </span>
                    <span className="text-2xl font-semibold tabular-nums text-foreground">{fmt(used.reduce((a, s) => a + s.rows, 0))}<span className="ml-1 text-xs font-normal text-muted-foreground">rows used</span></span>
                    <span className="text-xs text-muted-foreground">
                      {fmt(of.length)} {of.length === 1 ? 'sheet' : 'sheets'}{of.length > used.length ? `, ${fmt(of.length - used.length)} excluded` : ''}
                    </span>
                    <span className="text-xs text-muted-foreground">{k.role}</span>
                  </CardContent>
                </Card>
              )
            })}
          </div>
          {rows.length > 0 && (
            <>
              <H3>Every sheet read</H3>
              <div className="overflow-x-auto rounded-lg border">
                <Table className="text-xs">
                  <TableHeader className="bg-muted/50">
                    <TableRow className="hover:bg-transparent">
                      <SortHead label="Type" k="order" sort={sort} onSort={(k) => toggle(k, 'asc')} text />
                      <SortHead label="Sheet" k="name" sort={sort} onSort={toggle} text />
                      <SortHead label="Rows" k="rows" sort={sort} onSort={toggle} align="right" />
                      <SortHead label="Used" k="excluded" sort={sort} onSort={toggle} />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.map((s) => (
                      <TableRow key={s.name}>
                        <TableCell>{s.type}</TableCell>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(s.rows)}</TableCell>
                        <TableCell>
                          {s.censored
                            ? <StatusBadge tone="warn">Excluded: success-censored</StatusBadge>
                            : <span className="text-muted-foreground">Used</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </>
      )}
    </Doc>
  )
}
