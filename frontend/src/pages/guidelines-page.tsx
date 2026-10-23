import { Callout, Doc, DocGrid, H3, RefTable } from '@/components/doc'
import { Card, CardContent } from '@/components/ui/card'

/** 2024 Nigerian National Guidelines for HIV Prevention, Treatment and Care: EAC. */
export default function GuidelinesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-balance">Guidelines</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          What the national guidelines require of enhanced adherence counselling, and where each
          rule is measured on this dashboard.
        </p>
      </div>

      <DocGrid>
        <Doc eyebrow="2024 Nigerian National Guidelines for HIV Prevention, Treatment and Care" title="Enhanced Adherence Counselling">
          <H3>Why it matters</H3>
          <p>
            EAC is a critical part of the HIV continuum of care. It makes sure diagnosis is followed by
            retention and sustained viral suppression, which reduces illness, death and transmission.
            It addresses adherence problems early, to prevent treatment failure, HIV drug resistance
            and opportunistic infections.
          </p>
          <Callout>EAC is a mandatory intervention before any clinical decision to switch ART regimens.</Callout>
          <H3>Definition</H3>
          <p>
            An intensive, individualised adherence support intervention for non-stable recipients of
            care who have adherence issues, a poor treatment response, or clinical or virological
            signs of treatment failure.
          </p>
        </Doc>

        <Doc title="Who needs EAC">
          <p>Any one of the following:</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['≥ 1,000', 'Unsuppressed viral load (copies/mL)', 'text-bad'],
              ['50 – 999', 'Suppressed but detectable: low-level viraemia', 'text-warn'],
              ['WHO 3–4', 'Clinical failure: new or recurrent stage 3 or 4 after 6 months or more on effective ART', 'text-[var(--icon)]'],
            ].map(([v, l, c]) => (
              <Card key={v} size="sm">
                <CardContent className="flex flex-col gap-1">
                  <span className={`text-2xl font-semibold tabular-nums ${c}`}>{v}</span>
                  <span className="text-xs text-muted-foreground">{l}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </Doc>

        <Doc title="The four-step process">
          <ol className="flex list-decimal flex-col gap-1.5 pl-5">
            <li>Structured assessment: a formal evaluation of current ART adherence.</li>
            <li>Exploration of barriers, using the ABCDE framework.</li>
            <li>Identifying solutions together with the client.</li>
            <li>Jointly developing an individualised adherence plan.</li>
          </ol>
          <H3>The ABCDE framework</H3>
          <ul className="grid gap-2">
            {[
              ['A', 'Adherence problems: missed doses, timing, and other lapses.'],
              ['B', 'Bugs: intercurrent or opportunistic infections.'],
              ['C', 'Correct ART dosage, especially weight-based dosing in children.'],
              ['D', 'Drug–drug interactions.'],
              ['E', 'rEsistance: possible HIV drug resistance.'],
            ].map(([k, t]) => (
              <li key={k} className="flex items-start gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_oklch,var(--icon)_14%,transparent)] text-sm font-semibold text-[var(--icon)]">{k}</span>
                <span className="pt-1">{t}</span>
              </li>
            ))}
          </ul>
          <H3>Duration and modality</H3>
          <p>
            A minimum of 3 structured sessions over a 3-month period. For clients with low-level
            viraemia (50 to 999 copies/mL), sessions may be delivered in person or virtually, by
            telephone or similar.
          </p>
        </Doc>

        <Doc title="Expected outcomes and monitoring">
          <p>
            A repeat viral load is taken only after 3 consecutive months of documented good adherence
            (more than 95% of doses taken) following EAC completion.
          </p>
          <Callout tone="bad">
            If the repeat VL remains at or above 1,000 copies/mL, a multidisciplinary switch committee
            is required: doctor, nurse and adherence counsellor.
          </Callout>
          <H3>Managing persistent low-level viraemia</H3>
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            <li>200 to 999 copies/mL: high risk of treatment failure. Switching to second line is recommended.</li>
            <li>50 to 199 copies/mL: a high likelihood of re-suppression. Continue frequent monitoring.</li>
          </ul>
          <H3>Documentation</H3>
          <p>Use the standard PMM tools: the EAC Form and the EAC Monitoring Register.</p>
        </Doc>

        <Doc title="How this dashboard applies the guidelines" wide>
          <p>Each rule above maps to something measured here, so the cascade is the guideline, counted.</p>
          <RefTable head={['Guideline', 'How it is measured here']} rows={[
            ['EAC is mandatory before switching', 'Cascade step 6 (EAC completed) gates treatment plan F'],
            ['A minimum of 3 sessions over 3 months', 'Cascade steps 2 to 4; completion is sessions 1 to 3 plus 30 days or more since session 3'],
            ['Repeat VL only after documented adherence', 'Cascade steps 7 and 8, and the EAC lead time on Time metrics'],
            ['Switch committee if the repeat VL is 1,000 or more', 'The "Still unsuppressed after EAC, awaiting DTC review" worklist'],
            ['200 to 999 copies/mL: recommend a switch', 'Low-level viraemia is its own outcome band, never merged into "suppressed"'],
            ['More than 2 EAC cycles, still unsuppressed', 'The "More than 2 EAC cycles, still failing" worklist'],
          ]} />
        </Doc>

        <Doc title="Source references" wide>
          <RefTable head={['Section', 'Topic', 'Page']} right={[2]} rows={[
            ['3.6.2', 'Monitoring children and adolescents (EAC triggers)', '35'],
            ['3.7.2', 'Management of HIV treatment failure (EAC steps)', '37'],
            ['3.7.4', 'Management of a suppressed but detectable VL (ABCDE)', '41'],
            ['3.8.1', 'Criteria for a switch to third-line ART', '41'],
            ['3.10.4', 'Aim and focus of EAC for special populations', '63–64'],
            ['8.1.3', 'Differentiated ART service delivery (virtual EAC)', '187'],
            ['9.2.1', 'Patient management and monitoring tools (EAC forms)', '227'],
          ]} />
        </Doc>
      </DocGrid>
    </div>
  )
}
