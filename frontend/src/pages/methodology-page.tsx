import { useEffect, useState } from 'react'
import { Callout, Doc, RefTable } from '@/components/doc'
import { api } from '@/core/api'
import { fmt } from '@/core/format'
import type { Summary } from '@/core/types'

/** Data Analysis Plan v3.0: the unit of analysis, the cohort, the definitions, the known gaps. */
export default function MethodologyPage() {
  const [s, setS] = useState<Summary | null>(null)
  useEffect(() => {
    let off = false
    api<Summary>('/summary').then((r) => { if (!off) setS(r) }).catch(() => {})
    return () => { off = true }
  }, [])
  // Every episode beyond a client's first is a second (or later) failure.
  const repeats = s ? s.n - s.clients : null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-balance">Methodology</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          How the figures are built: what is counted, from which cohort, and by which definitions.
        </p>
      </div>

      <Doc eyebrow="Data Analysis Plan v3.0" title="The unit of analysis is a failure episode">
        <p>
          A client may fail, complete EAC, re-suppress, and fail again. That is two index events and
          two trips through the cascade: one client, two episodes. The key is the client S/N, the
          index VL date and the index VL value together, never the S/N alone.
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
          A snapshot of clients whose current VL is 1,000 or more, drawn on the same day as the line
          list, cannot support the outcome half of the cascade. A post-EAC VL becomes the current VL,
          so a client who re-suppresses leaves the cohort, and one who is still failing has no later
          result. Steps 7 to 10 would compute to exactly zero.
        </p>
        <p>
          Building the index list quarterly freezes each index event in the quarter it occurred, so a
          post-EAC VL can land after it. That is why the cascade has an outcome arm at all.
        </p>
      </Doc>

      <Doc title="Who is counted as a gap">
        <p>
          A client who left care (interrupted treatment, stopped, lost to follow-up, died,
          transferred out or discontinued) before a repeat VL is not a gap a team can close. They are
          shown as their own cascade step and worklist, and left out of every gap measure: the
          cascade steps after it, the Overview rates, the facility and state tables, the gap
          worklists and the risk list. A client who left care after being retested stays in, because
          their outcome is known.
        </p>
        <p>
          Worklists are ranked by clinical urgency. High: a decision is overdue. Medium: the next
          step has not happened. Low: wider nets that overlap the lists above, and clients who have
          left care. Data checks are not ranked.
        </p>
      </Doc>

      <Doc title="Definitions">
        <RefTable head={['Term', 'Definition']} rows={[
          ['Unsuppressed', 'VL 1,000 copies/mL or more'],
          ['Low-level viraemia', 'VL 50 to 999 copies/mL'],
          ['Undetectable', 'VL below 50 copies/mL'],
          ['Re-suppressed', 'Post-EAC VL below 1,000, including low-level viraemia'],
          ['Valid EAC cycle', 'Session 1 on or after the index VL date'],
          ['EAC completed', 'Sessions 1, 2 and 3 all recorded, and 30 days or more since session 3'],
          ['Post-EAC VL', 'Sessions 1 to 3 recorded and a VL sample collected on or after session 3, whatever the 30-day rule'],
          ['Failure episode', 'One index VL of 1,000 or more and everything that follows from it'],
          ['Left care before a repeat VL', 'A negative ART outcome and no follow-up VL result'],
          ['Fiscal year', '1 October to 30 September. Q1 is October to December, Q4 is July to September'],
        ]} />
      </Doc>

      <Doc title="Known data gaps">
        <p>Raised with the HI team. The dashboard says so where these apply, rather than hiding them.</p>
        <RefTable head={['Gap', 'Effect']} rows={[
          ['No switch date in the export', 'Time to switch cannot be measured, and step 10 cannot be attributed to a cycle'],
          ['Some EAC lists are success-censored', 'Their outcomes are unusable; the sheets are excluded automatically and listed on Data quality'],
          ['The client key is exported as a number', 'Joins break silently after an Excel re-save; it is handled as text here'],
          ['State names are cased inconsistently', 'Normalised when a line list is loaded'],
        ]} />
      </Doc>
    </div>
  )
}
