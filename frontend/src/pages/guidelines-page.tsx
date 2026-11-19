import { Callout, Cite, Doc, DocGrid, H3, RefTable } from '@/components/doc'
import { Card, CardContent } from '@/components/ui/card'

/**
 * 2024 Nigerian National Guidelines for HIV Prevention, Treatment and Care: EAC.
 *
 * Every statement carries its section and page (CDC session, 4 Nov 2026), checked
 * against the guideline PDF on 6 Nov 2026. Page numbers are the printed ones. The
 * wording follows the guideline; where the dashboard applies a rule of its own,
 * the table at the end says so rather than presenting it as guidance.
 */

/** The sections cited on this page, in the order they appear in the guideline. */
export const SOURCES: [string, string, string][] = [
  ['1.1.2', 'Guiding principles (the HIV continuum of care)', '2'],
  ['3.6.2', 'Monitoring children and adolescents on ART (repeat VL after EAC)', '35'],
  ['3.7.1', 'Definition of HIV treatment failure (EAC steps, repeat VL)', '35–37'],
  ['3.7.2', 'Substitution and switch of ARVs (switch committee)', '38'],
  ['3.7.4', 'Management of suppressed but detectable viral load (ABCDE)', '40–41'],
  ['3.8.1', 'Criteria for switch to third-line ART', '41'],
  ['3.10.6', 'Factors associated with poor adherence (aim of EAC)', '61–63'],
  ['8.1.4', 'Differentiated service delivery by clinical characteristics (virtual EAC)', '186–187'],
  ['9.2.2', 'Data collection (EAC Form, EAC Monitoring Register)', '226–228'],
]

export default function GuidelinesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-balance">Guidelines</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          What the national guidelines require of enhanced adherence counselling, and where each
          rule is measured on this dashboard. Each statement gives its section and page in the 2024
          guidelines.
        </p>
      </div>

      <DocGrid>
        <Doc eyebrow="2024 Nigerian National Guidelines for HIV Prevention, Treatment and Care" title="Enhanced Adherence Counselling">
          <H3>Why it matters</H3>
          <p>
            The guidelines are built on the HIV continuum of care: diagnosis followed by timely
            initiation of ART, retention in care and sustained viral suppression, which reduces illness
            and death and improves quality of life.<Cite s="1.1.2" p="2" /> The longer a client stays
            on a failing regimen, the worse the clinical outcome, with more opportunity for drug
            resistance and a higher risk of transmission.<Cite s="3.7.2" p="38" />
          </p>
          <Callout>
            Before a switch to second-line ART, improved adherence must be reported and treatment
            failure confirmed by a repeat VL above 1,000 copies/mL.<Cite s="3.7.2" p="38" /> A switch
            to third-line requires 3 months of documented EAC.<Cite s="3.8.1" p="41" />
          </Callout>
          <H3>Who EAC is for</H3>
          <p>
            Non-stable recipients of care presenting with adherence issues, a poor treatment response,
            or signs of treatment failure.<Cite s="3.10.6" p="63" />
          </p>
        </Doc>

        <Doc title="Who needs EAC">
          <p>Any one of the following:</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {([
              ['≥ 1,000', 'Unsuppressed viral load (copies/mL): all such clients should undergo EAC', 'text-bad', '3.7.1', '37'],
              ['50 – 999', 'Suppressed but detectable, previously called low-level viraemia', 'text-warn', '3.7.4', '40'],
              ['WHO 3–4', 'Clinical failure: a new or recurrent stage 3 or 4 condition after 6 months of effective treatment', 'text-[var(--icon)]', '3.7.1', '35'],
            ] as const).map(([v, l, c, s, p]) => (
              <Card key={v} size="sm">
                <CardContent className="flex flex-col gap-1">
                  <span className={`text-2xl font-semibold tabular-nums ${c}`}>{v}</span>
                  <span className="text-xs text-muted-foreground">{l}<Cite s={s} p={p} /></span>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            The guideline writes the bands as above 1,000 and 50 to 1,000 copies/mL.<Cite s="3.7.1" p="35" /> The
            dashboard counts a result of exactly 1,000 as unsuppressed.
          </p>
        </Doc>

        <Doc title="The four-step process">
          <ol className="flex list-decimal flex-col gap-1.5 pl-5">
            <li>A structured assessment of ART adherence.</li>
            <li>Exploration of the specific barriers to adherence, including drug interactions, intercurrent infections and suboptimal dosing in children.</li>
            <li>Identification of potential solutions to those barriers.</li>
            <li>Joint development of an individualised adherence plan, and follow-up for improved adherence.<Cite s="3.7.1" p="37" /></li>
          </ol>
          <H3>The ABCDE framework</H3>
          <p>For a suppressed but detectable VL, assess the cause and consider:<Cite s="3.7.4" p="40" /></p>
          <ul className="grid gap-2">
            {[
              ['A', 'Adherence problems.'],
              ['B', 'Bugs: intercurrent infections.'],
              ['C', 'Incorrect ART dosage.'],
              ['D', 'Drug–drug interactions.'],
              ['E', 'rEsistance.'],
            ].map(([k, t]) => (
              <li key={k} className="flex items-start gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_oklch,var(--icon)_14%,transparent)] text-sm font-semibold text-[var(--icon)]">{k}</span>
                <span className="pt-1">{t}</span>
              </li>
            ))}
          </ul>
          <H3>Duration and modality</H3>
          <p>
            EAC for at least 3 sessions over 3 months.<Cite s="3.7.4" p="41" /> For a suppressed but
            detectable VL (50 to 1,000 copies/mL), EAC can be in person or virtual.<Cite s="8.1.4" p="187" />
          </p>
        </Doc>

        <Doc title="Expected outcomes and monitoring">
          <p>
            Repeat the VL 3 months after EAC, and review the client for a regimen switch if it is still
            unsuppressed.<Cite s="3.7.1" p="37" /> For a suppressed but detectable VL, repeat it after 3
            consecutive months of good adherence.<Cite s="3.7.4" p="41" /> Children and adolescents
            with a VL above 1,000 copies/mL receive EAC and a repeat VL only after three months of good
            adherence.<Cite s="3.6.2" p="35" />
          </p>
          <Callout tone="bad">
            Health facilities should constitute a multidisciplinary switch committee to review, track
            and decide on switches to second-line: ideally a doctor and a nurse who know the client,
            and the adherence counsellor who provided EAC.<Cite s="3.7.2" p="38" />
          </Callout>
          <H3>After the repeat VL, for a suppressed but detectable VL</H3>
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            <li>Above 1,000 copies/mL: manage as ART failure.<Cite s="3.7.4" p="41" /></li>
            <li>200 to 1,000 copies/mL: switch to second-line ART.<Cite s="3.7.4" p="41" /></li>
            <li>50 to 199 copies/mL: the likelihood of an undetectable VL is still high.<Cite s="3.7.4" p="41" /> Monitor more frequently.<Cite s="3.7.1" p="35" /></li>
          </ul>
          <p className="text-xs text-muted-foreground">
            A third-line switch also requires adherence above 95% during and after EAC.<Cite s="3.8.1" p="41" />
          </p>
          <H3>Documentation</H3>
          <p>
            Record EAC on the EAC Form and the EAC Monitoring Register, two of the standard PMM and PME
            tools.<Cite s="9.2.2" p="227–228" />
          </p>
        </Doc>

        <Doc title="How this dashboard applies the guidelines" wide>
          <p>Each rule above maps to something measured here, so the cascade is the guideline, counted.</p>
          <RefTable head={['Guideline', 'How it is measured here', 'Source']} rows={[
            ['Adherence confirmed before switching', 'Cascade step 6 (EAC completed) gates treatment plan F', '§3.7.2, p. 38'],
            ['At least 3 sessions over 3 months', 'Cascade steps 2 to 4; completion is sessions 1 to 3 plus 30 days or more since session 3', '§3.7.4, p. 41'],
            ['Repeat VL 3 months after EAC', 'Cascade steps 7 and 8, and the EAC lead time on Time metrics', '§3.7.1, p. 37'],
            ['Switch committee if the repeat VL is above 1,000', 'The "Still unsuppressed after EAC, awaiting DTC review" worklist', '§3.7.2, p. 38'],
            ['200 to 1,000 copies/mL after EAC: switch', 'Low-level viraemia is its own outcome band, never merged into "suppressed"', '§3.7.4, p. 41'],
            ['More than 2 EAC cycles, still unsuppressed', 'The "More than 2 EAC cycles, still failing" worklist', 'Programme rule, not in the guidelines'],
          ]} />
        </Doc>

        <Doc title="Source references" wide>
          <p className="text-xs text-muted-foreground">
            Federal Ministry of Health, National AIDS, STIs and Viral Hepatitis Control Programme.
            National Guidelines for HIV Prevention, Treatment and Care, 2024. Printed page numbers.
          </p>
          <RefTable head={['Section', 'Topic', 'Page']} right={[2]} rows={SOURCES} />
        </Doc>
      </DocGrid>
    </div>
  )
}
