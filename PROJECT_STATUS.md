# ECEWS TF Monitor — Project Status & Handoff

**Last updated:** 23 Oct 2026
**Owner:** Es (Data Analytics Lead, ECEWS / SPEED Program — PEPFAR/CDC, Nigeria)
**Purpose:** Online, multi-user web app for HIV ART **treatment-failure (TF)** and
**EAC** monitoring across Delta, Osun, Ekiti. An admin loads the de-identified line
list; everyone else reads.

This document says where the project stands. **Why things are the way they are** —
the decisions that still bind and every incident that shaped them — is
`docs/DECISIONS_AND_INCIDENTS.md`; read its **Standing rules** before changing the
key, the export filter, or anything that prints. The clinical and analytical spec
is `EAC_Indicator_Definitions_and_Data_Analysis_Plan_v3_1.md`. The weekly pipeline
is `docs/RUNBOOK_pipeline.md`.

No password, key or identifier belongs in this file or anywhere in the repo. The
repo is public. Credentials live in `.env` (gitignored) or the host's secret store.

---

## 1. Where things run

| | Branch | Served at | Status |
|---|---|---|---|
| Live dashboard | `main` | `/` | The original single-file app. **IT deploys from `main`.** |
| React rebuild | `react` | `/app` | Every page rebuilt (23 Oct 2026). **Merge into `main` only when Es approves.** |

Both are served by the same FastAPI backend and database, so they always show the
same figures.

## 2. How to run (local)

```bash
# from the repo root; copy .env.example to .env and set every value first
docker compose up -d --build        # http://localhost:8080 (compose maps 8080 -> 8000)
```

- **Deploy locally:** `backend/scripts/deploy.ps1` rebuilds the image and reports the
  commit being served. Static files are baked into the image, so a restart alone
  does not pick up a change.
- **Seeded accounts:** the admin (and optional shared viewer) are created on first
  start only if `ADMIN_PASSWORD` / `VIEWER_PASSWORD` are set. There are no default
  passwords in the code: unset means the account is not created. Later changes go
  through Admin → Users and access.
- **Backend tests** run inside Docker (the image pins pandas 2.2; a local Python may
  differ):
  ```bash
  docker run --rm --network ecews_tf_monitor_default -e PYTHONPATH=/work \
    -e TEST_DATABASE_URL="postgresql://<user>:<password>@db:5432/ecews_test" \
    -v "$(pwd)/backend:/work" -w /work ecews_tf_monitor-api pytest -q
  ```
  **186 passing** (23 Oct 2026).
- **Frontend tests:** `cd frontend && npx vitest run` — **132 passing**. Type check:
  `npx tsc --noEmit`.
- **Harness pages** (`/app/harness-*.html` on the Vite dev server) render each page
  with synthetic data and no backend, for checking in a real browser without
  signing in.

**Loading a line list:** run the weekly pipeline (`docs/RUNBOOK_pipeline.md`), then
Admin → Line lists → load the de-identified parquet zip. **Set the line-list date to
the treatment line list's date**: it sets the fiscal quarter and the follow-up
windows.

## 3. Pages (React, `/app`)

| Page | What it shows |
|---|---|
| Overview | Headline tiles, time-to-event strip, narrative and cohort, EAC and outcome charts split by sex, monthly unsuppressed columns, quarterly cascade, facility league, zero-EAC facilities |
| Cascade | Every step against the whole cohort with its own rate and denominator, optional split by sex, where the cohort is lost, the outcome; each gap opens its worklist |
| Deep dive | Who / What / Care outcome / When / Where, bars split by sex, per-client cohort flow (entering and leaving), the clickable LGA residence map, facility league, flags ranked by priority |
| DTC review | Switch gap, VL response (log drop), laboratory queue, per-client VL trajectories, repeat-unsuppression odds ratios, DTC worklists |
| Time metrics | Four medians, six timed steps as box plots against targets, Kaplan-Meier to re-suppression, time on ART to first unsuppressed VL by ART-start era |
| Line list changes | Any two snapshots compared: days apart, episodes carried / new / gone, cascade movement with backwards steps marked |
| Worklists | Twelve lists ranked by clinical urgency, each with its next step; sortable table, server-side audited export (admin/analyst) |
| Treatment plans | Plans A–H with the reason each applies, split by sex; a plan opens its clients |
| Advanced analytics | Factors for re-suppression (forest plot, univariate and adjusted table), baseline CD4, the risk model with calibration and the lowest-chance list, mortality |
| Data quality | Every check from the current upload, cohort checks apart from source-file checks |
| Guidelines | 2024 national EAC guidance and where each rule is measured |
| Methodology | Unit of analysis, cohort, who counts as a gap, definitions, data sources (every sheet read), known gaps |
| Admin | Load line lists, upload history, deployment check, users and access (add, change role and scope, disable, delete, reset password), usage, feedback, audit trail |

The header carries data notices (serious cohort problems), the theme toggle, and the
account menu: change your own password, send feedback, sign out. Every summary table
sorts; female and male keep one colour pair everywhere.

**Roles:** admin / analyst / viewer. Viewers and analysts see everything except
Admin; analysts can also export. A state or facility scope limits everything an
account sees, exports included.

## 4. Locked analytical rules (do not silently change)

Figures in brackets are as at the date each rule was agreed. The full reasoning is
in the spec and in `docs/DECISIONS_AND_INCIDENTS.md`.

1. **Unit of analysis = failure episode**, key `(S/N, index VL date, index VL value)`,
   never S/N alone. Rates use episodes as the denominator.
2. **Cohort = quarterly open cohort** from the cumulative Total Unsuppressed register.
3. **S/N is text end-to-end** (12+ decimal places to stay unique).
4. **No VL-validity window.** Episode age is expressed by the fiscal quarter, never by
   exclusion.
5. **FY25Q4 floor:** everything received on or before 30 Sep 2025 sits in FY25Q4.
6. **All viral loads come from the treatment line lists, never the EAC sheet.**
   Follow-up VL = the next VL sampled after the index result was received.
7. **A sample and a result are separate facts.** Quarter by date the result was
   received; follow-up by sample date.
8. **EAC dated before the index = not yet commenced** (kept, counted as no EAC).
9. **Switching:** numerator on 2nd/3rd line; denominator every episode still ≥ 1,000.
   No switch date in the export, so time to switch cannot be measured.
10. **`as_of` anchors to the line-list date**, not today.
11. **EAC completed** = sessions 1–3 plus ≥ 30 days since session 3. **Post-EAC VL** =
    sessions 1–3 plus a sample on or after session 3, no 30-day rule.
12. **Truncation is two cohorts:** sample before session 1 (`trunc_pre`) and before
    session 3 (`trunc_mid`). Flag only.
13. **Nomenclature:** "repeat unsuppression episode"; "Awaiting DTC review".
14. **Switch gap** needs the regimen line at the index VL: awaiting DTC review / prior
    switch / genuinely switched.
15. **CD4 is binary** (< 200 vs ≥ 200), quantitative and VISITEC LFA merged.
16. **Pregnancy** on a female denominator.
17. **Time to VL is confounded by ART-start era**; never pool ≤ 2017 and ≥ 2018 starters.
18. **The key is DATIM code + PEPID.** A client who transfers is linked to one S/N:
    keep the Active record's, else the transfer-in, else the latest pickup. Different
    people sharing a facility-assigned number are never linked (decision 19).
19. **Clients who left care before a repeat VL are not a gap** (decision 20): own
    cascade step and worklist, out of every gap measure.
20. **Worklists are ranked by clinical urgency** (decision 21).

**Recurring bugs to guard:** chain `.fillna(False).astype(bool)` after a merge; never
hold a `Series` across `sort_values().reset_index()` in `build_cohort`; cast a
categorical to object before filling it (pandas 2.2).

## 5. Current figures (line list of 16 Oct 2026, all episodes)

| Metric | Value |
|---|---|
| Episodes / clients | **4,824 / 4,275** — 469 clients unsuppressed more than once (549 repeat episodes) |
| Quarters | FY25Q4 1,283 · FY26Q1 850 · FY26Q2 885 · FY26Q3 975 · FY26Q4 787 · FY27Q1 44 |
| Left care before a repeat VL | 322 (6.7%) — out of every gap measure; 4,502 in care or retested |
| EAC commenced | **85.1%** (3,830) — 672 never started |
| EAC completed (S1–3 + 30 days) | 52.4% of those who commenced (2,008) |
| Post-EAC VL sample | 1,216 |
| Follow-up VL sample / result | 2,626 (58.3%) / 2,390 (53.1%) of those in care or retested |
| Re-suppressed | **77.6%** (1,855) — 1,540 undetectable, 315 low-level viraemia |
| Still ≥ 1,000 | 535 · **awaiting DTC review 478** · switched 26 (4.9%) |
| Medians | to EAC 25 d · EAC lead 167 d · to re-suppression 168 d · months unsuppressed 8.8 |
| Risk model | AUC 0.862 on 2,390 retested episodes |

Previous snapshot: 14 Aug 2026 (4,228 episodes). Line list changes compares the two.

## 6. Repo layout

```
├── PROJECT_STATUS.md                 ← this file
├── EAC_Indicator_Definitions_and_Data_Analysis_Plan_v3_1.md   ← the spec
├── docs/DECISIONS_AND_INCIDENTS.md   ← standing rules, decisions 1–21
├── docs/RUNBOOK_pipeline.md          ← the weekly de-identification routine
├── docker-compose.yml, .env.example, DEPLOY.md
├── backend/
│   ├── Dockerfile                    ← builds frontend/ in a first stage, serves it at /app
│   ├── app/indicators.py             ← the indicator engine (cohort, cascade, flags, models)
│   ├── app/main.py                   ← FastAPI routes, auth, audit, exports
│   ├── app/ingest.py, schema.sql, security.py
│   ├── scripts/deidentify.py, weekly.ps1, deploy.ps1, inspect_export.py, diagnose_key.py
│   └── static/index.html             ← the original single-file dashboard (served at /)
└── frontend/                         ← React 19 + Vite + Tailwind v4 + shadcn (Base UI)
    ├── src/pages/                    ← one file per page, each with a test
    ├── src/components/, src/core/    ← shared UI, API client, filters, palette, theme
    ├── src/dev/                      ← synthetic fixtures and harness pages
    └── src/styles/merged-theme.css   ← the Octet + LearnUI merged theme
```

## 7. Pending

**Build**
1. **Merge `react` into `main`** for IT to deploy — on Es's approval.
2. **Deep dive: a box plot of the wait for a follow-up VL.** How long clients wait
   between the index result and their repeat sample: median, middle half and range,
   so a few very long waits do not hide the typical one. Built in August and
   withdrawn because the data under it was empty at the time; the data is now there.
   Optional.
3. **EAC uptake by month** — withdrawn. If rebuilt, recent months must be marked
   provisional: uptake in a young month is low because commencing takes a median of
   25 days, not because teams stopped.
4. **Per-client hover timeline** (ART start, every VL, regimen changes, interruptions,
   missed appointments on one date axis) — waits for the drug, VL history and
   appointment file (Es to locate).

**Dropped (Es, 23 Oct 2026):** click-to-filter cards (the clickable map is enough);
bulk user creation by spreadsheet (the HI team will handle accounts).

**For the HI / EMR team**
1. **`EAC_Cycle_Number` is unusable.** In the 16 Oct line list every episode reads
   cycle 1 (or 0, or a corrupted `1/0/1900`), so the High-priority worklist "More than
   2 EAC cycles, still failing" can never fill: it shows 0. Fixing the column, or
   agreeing to count cycles another way, is needed before that list means anything.
2. **14 people are Active at more than one facility** (22 Oct pipeline run). They are
   not linked; the list is `SN_Key-TWO-ACTIVE.csv` on Es's machine. HI to close the
   duplicate record.
3. **Switch date and "reason not switched"** — unlock time to switch.
4. **`First_High_VL_Value` is the first detectable VL** (floor at 50, not 1,000), and
   68 rows have it below `First_Ever_VL`. The label stays until HI confirms the
   definition.
5. Baseline CD4 coverage; EAC session dates out of order; blank S/Ns in EAC lists
   (2–41 rows per sheet); state casing.

**Resolved on our side, nothing for HI to do:** the PEPIDs found under more than one
DATIM code (5,893 on 22 Oct). The key concatenates the DATIM code and PEPID, so no
two people are merged. Of these, 3,529 are one person at two facilities after a
transfer and are linked to one S/N; 2,350 are different people who happen to share a
facility-assigned number and stay apart. Only the 14 above remain.

**For Es:** check `SN_Key-NEAR-MATCH.csv` and `SN_Key-PEPID-BLANK.csv` beside the
vault; locate the drug, VL history and appointment file.

## 8. Workflow preferences (Es)

- Plan → confirm → execute; explicit sign-off before major builds.
- Positives first, then gaps, then actionable next steps.
- Granular LGA and facility breakdowns; eligibility-based denominators; 1-decimal
  rounding.
- **No hallucinated figures** — every number is checked against the data.
- Work only from de-identified parquet, logs and the dashboard database; diagnostics
  print counts and shapes, never identifiers.
- Changes ship live to `/app` for Es to judge, not as mock-ups.
