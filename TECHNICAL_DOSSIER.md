# ECEWS-SPEED Treatment Failure Monitoring Dashboard
## Technical Architecture, Data Flow and Security Dossier

**Prepared for:** ECEWS IT and Data Governance review, ahead of hosting on the
ECEWS domain and integration with the ECEWS Central Data Repository.

| | |
|---|---|
| Document version | 1.2 |
| Date | 2 November 2026 |
| Application version | 2.2, commit `63fc149` |
| Prepared by | Data Analytics Lead, ECEWS/SPEED Program |
| Status | For review |

**Changes since 1.1 (3 August 2026):** the dashboard is now a React application
built into the same image (version 2.0, 23 October); the repository is public
so that ECEWS IT can deploy from it, and holds no data or credentials; there are
no default passwords (an unset seed password means the account is not created);
client search and the client record were added, both audited and scoped
(version 2.1); administrators can change an account's role and scope and delete
it; test counts, routes, configuration and figures are brought up to date.

This document answers the five items requested, in the order requested
(sections 1–5). Sections 6–8 cover the security controls, known limitations and
hosting requirements referenced in the covering request. Everything stated here
is drawn from the current source tree and can be verified against it.

---

## 0. Overview

### 0.1 What the application does

The dashboard monitors the HIV treatment-failure and Enhanced Adherence
Counselling (EAC) cascade across three supported states (Delta, Osun, Ekiti).
It ingests the routine bi-weekly clinical line-list export, derives a fixed set
of programme indicators, and presents them as a read-only web dashboard.

It is an **analytical layer over an existing export**. It is not a clinical
system, not a register of record, and it does not write back to any EMR or
source system. It creates no new patient data.

### 0.2 Unit of analysis

The unit is the **treatment-failure episode**, not the client. A client who is
unsuppressed, undergoes EAC, re-suppresses and later fails again represents two
episodes. Episodes are keyed on `(S/N, index VL date)`. In the line list of
24 October 2026, 4,301 distinct clients account for 4,860 episodes.

### 0.3 Data classification

This is the single most important framing point for the review.

- The application holds **patient-level clinical records**: viral load results,
  ART regimen, EAC session dates, care outcomes and residence at LGA level.
- Personally identifying information (name, contact details, unique identifiers
  other than the pseudonymous `S/N`) is **removed upstream, before the export
  reaches this application**. The application never receives, requests or stores
  direct identifiers.
- The removal is done by the de-identification pipeline
  (`docs/RUNBOOK_pipeline.md`), run weekly on one secured machine. It replaces
  each client's DATIM code and PEPID with a random S/N held in a key vault that
  is never uploaded, removes 13 identifier fields, checks again after removal,
  and publishes nothing if an identifier survives or the key match falls below
  95%.
- The data nevertheless remains **sensitive and potentially re-identifiable in
  context**, since it combines facility, LGA of residence, age, sex and clinical
  timeline. It is treated throughout as confidential PEPFAR/CDC programme data.
- Consequently: all access is authenticated, row-level scoping is enforced
  server-side, bulk extraction is role-restricted, and every access to
  patient-level rows is recorded in an audit trail (sections 4 and 6).

### 0.4 Architecture at a glance

```
   De-identified line list (.parquet.zip, or .xlsx)
                │
                │  HTTPS upload, administrator only
                ▼
   ┌──────────────────────────────────────────┐
   │  FastAPI application (Python 3.12)       │
   │                                          │
   │   ingest.py    parse, classify sheets,   │
   │                data-quality checks       │
   │   indicators.py  derive the cohort       │
   │                                          │
   └───────────────────┬──────────────────────┘
                       │  derived rows only
                       ▼
   ┌──────────────────────────────────────────┐
   │  PostgreSQL 16                           │
   │  users · uploads · cohort · dq_findings  │
   │  feedback · audit_log · usage_log        │
   └───────────────────┬──────────────────────┘
                       │  aggregated, scope-filtered
                       ▼
   React dashboard, built into the same image and served at /
```

Three processes in total: application container, database, browser. There is no
message queue, no background worker, no external API call at runtime, and no
third-party analytics or telemetry.

---

## 1. Application source code and deployment files

### 1.1 Repository

The complete source is a single Git repository of 201 tracked files, public on
GitHub (`slkies/slkies-ecews-tf-dashboard`) so that the ECEWS IT team can deploy
from it. Being public, it holds **no patient data, no credentials and no
identifiers**. The `.gitignore` excludes `*.xlsx`, `*.parquet`, `*.parquet.zip`
and `.env`; this is additionally enforced by a CI check that fails the build
(section 1.5), and it can be confirmed against the full commit history.
Credentials live only in `.env` (not tracked) or the host's secret store.

Two branches: `develop`, where work happens, and `main`, which holds only
released work and is what the host deploys. Each release is versioned and
tagged, and `/api/version` reports the version and commit being served.

For handover, the repository can be transferred to an ECEWS GitHub organisation
or supplied as a bundle, at ECEWS's preference.

### 1.2 Contents

| Path | Purpose |
|---|---|
| `backend/app/main.py` | HTTP API, authentication, authorisation, audit |
| `backend/app/indicators.py` | Cohort construction and all indicator logic |
| `backend/app/ingest.py` | Workbook parsing, sheet handling, DQ checks |
| `backend/app/security.py` | JWT issuing/verification, password hashing |
| `backend/app/schema.sql` | Complete database schema (idempotent) |
| `frontend/` | The dashboard (React, since version 2.0), built into the image and served at `/` |
| `backend/static/` | Fonts, logo and map boundaries shared by the dashboard and the backend |
| `backend/static/*.geojson` | Offline LGA/state boundaries for the map |
| `backend/scripts/to_parquet.py` | Workbook → Parquet converter (operator tool) |
| `backend/tests/test_indicators.py` | Unit tests for the indicator logic |
| `backend/tests/test_api.py` | API integration tests, incl. the security controls |
| `backend/tests/test_version.py` | Version reporting |
| `backend/tests/conftest.py` | Test fixtures and database setup |
| `frontend/src/**/*.test.tsx` | Dashboard tests, one file per page |
| `backend/scripts/deidentify.py` | The de-identification pipeline (operator tool, run offline) |
| `backend/scripts/bump_version.py`, `deploy.ps1` | Release and local deploy |
| `.github/workflows/ci.yml` | Continuous integration pipeline |
| `backend/Dockerfile` | Container image definition |
| `backend/requirements.txt` | Pinned dependencies |
| `docker-compose.yml` | Local/self-hosted two-container stack |
| `render.yaml` | Platform deployment descriptor |
| `.env.example` | Documented environment variables, no real values |
| `DEPLOY.md` | Deployment runbook |
| `EAC_Indicator_Definitions_..._v3_1.md` | Indicator definitions and analysis plan |

### 1.3 Runtime and dependencies

Base image `python:3.12-slim`. Thirteen pinned direct dependencies, of which
two (`pytest`, `httpx`) are used only by the test suite:

```
fastapi 0.115.6      uvicorn 0.34.0       psycopg 3.2.3
pandas 2.2.3         numpy 2.1.3          openpyxl 3.1.5
python-multipart 0.0.20                   bcrypt 4.2.1
PyJWT 2.10.1         pydantic 2.10.4      pyarrow 18.1.0
pytest 8.3.4         httpx 0.28.1
```

All are mainstream, actively maintained packages. There is deliberately **no
scipy, statsmodels or scikit-learn**: the statistical routines are implemented
directly in numpy to keep the dependency surface small and auditable.

The dashboard is React 19 with TypeScript, Vite, Tailwind CSS and Chart.js, its
packages pinned in `frontend/package-lock.json`. It is compiled in the first
stage of the Docker build (`node:22-slim`) and only the compiled files are
copied into the Python image; nothing is fetched from a third party at runtime.

### 1.4 Build and run

```bash
docker compose up --build        # local: http://localhost:8080
```

The container binds `$PORT` when the host injects one, and defaults to 8000
otherwise, so the same image runs unchanged on a platform host or behind an
ECEWS reverse proxy.

### 1.5 Testing and continuous integration

**363 automated tests** (2 November 2026): 150 server test functions expanding
to **215 test cases**, and **148 dashboard tests**.

| Suite | Covers |
|---|---|
| `test_indicators.py` | Indicator logic: the decision tree, temporal matching, negative-time exclusion, `S/N` precision, repeat episodes, schema drift between exports, success-censoring detection, and each EAC rule agreed with the programme (extended EAC, one EAC cycle per episode, cycles counted per client) |
| `test_api.py` | The API surface, and specifically **every security control claimed in section 6** |
| `test_version.py` | The version and commit reported by `/api/version` |
| Dashboard (`vitest`) | Each page and shared component, against synthetic data |

The API suite runs against a real PostgreSQL instance rather than a mock.
Row-level scoping, the lockout counter and `ON DELETE CASCADE` are database
behaviours; a mock would only ever confirm that the mock works. It asserts,
among other things, that:

- protected endpoints reject anonymous callers, and administrative endpoints
  reject a non-administrator;
- the sign-in response does not reveal whether an account exists;
- lockout triggers on the fifth failure, blocks even a *correct* password
  thereafter, resets on a successful sign-in, and applies per account;
- **a scoped user cannot reach another state by requesting it as a filter**,
  and the same restriction governs the CSV export;
- bulk export is refused to a viewer and the refusal is audited;
- the audit trail exposes no write route;
- a failed upload leaves the previous snapshot current and intact.

**Continuous integration** (`.github/workflows/ci.yml`) runs on every push to
`main` and `develop` and on every pull request: the server suite against a
PostgreSQL 16 service container, then the dashboard's type check, its tests and
a full production build. Two additional guards fail the build outright:

1. **No patient data may be tracked in git.** `.gitignore` covers this, but a
   forced add or a renamed extension would slip past it, and the data is
   PEPFAR clinical records.
2. **The JWT fallback must remain gated by `APP_ENV`.** Removing that guard
   while leaving the fallback string present would silently return every
   deployment to a signing key that is in this repository.

---

## 2. Database

### 2.1 Engine

PostgreSQL 16 (currently 16.14). Connection via `psycopg` 3 with a pooled
connection (1–10 connections), configured entirely through the `DATABASE_URL`
environment variable. No database credentials appear in source.

### 2.2 Tables

Seven tables. The complete definition is `backend/app/schema.sql`.

| Table | Contents | Sensitivity |
|---|---|---|
| `users` | Accounts, bcrypt password hashes, role, row scope | Credentials |
| `uploads` | One immutable row per ingest: filename, as-of date, counts, warnings, source-sheet manifest | Metadata |
| `cohort` | **The derived patient-level cohort** — one row per failure episode, 88 columns | Patient data |
| `dq_findings` | Data-quality findings per upload | Metadata |
| `feedback` | In-app user feedback | Low |
| `usage_log` | One row per authenticated request, for the usage panel | Operational |
| `audit_log` | Append-only security audit trail | Security record |

`cohort` is the only table holding patient-level data. It stores the
pseudonymous `S/N`, never a name or direct identifier.

### 2.3 Key design points

- **`S/N` is `TEXT` everywhere.** The values require 12+ decimal places to stay
  unique; storing them as a float collides roughly 164 clients and silently
  corrupts every join. This is enforced at parse time and in the schema.
- **Uploads are immutable snapshots.** Exactly one row has `is_current = TRUE`,
  guaranteed by a partial unique index. This means the dashboard can always
  state what it showed on a given date — important for programme reporting.
- **Referential integrity with cascade.** `cohort` and `dq_findings` reference
  `uploads` with `ON DELETE CASCADE`, so removing a snapshot removes its
  patient rows atomically, leaving no orphans.
- **`audit_log` is append-only**, with `user_id` nulling on account deletion
  while the email recorded at the time is retained.

### 2.4 Migrations

The schema is **idempotent and self-applying**. `schema.sql` is executed at
application startup and uses `CREATE TABLE IF NOT EXISTS` throughout, with every
column added after v1 expressed as `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.

Consequences, stated plainly:

- Deploying a new version requires no manual migration step and no downtime for
  schema changes.
- Re-running against an existing database is safe and non-destructive.
- There is **no automatic down-migration**. Reversing a schema change requires a
  deliberate manual statement. This is a conscious trade-off in favour of
  never destroying data automatically.

---

## 3. Data upload process

### 3.1 Who uploads

Administrators only, through the authenticated Admin page. No other role can
upload, and there is no unauthenticated or API-key ingest path.

### 3.2 Expected file format

Either:

- an Excel workbook (`.xlsx`), or
- a zip of Parquet files, one per sheet (`.parquet.zip`) — **recommended**:
  roughly 7–10× smaller, far faster to parse, and it carries data types, so
  `S/N` remains text. `backend/scripts/to_parquet.py` produces this.

### 3.3 Required sheets and how they are identified

Sheets are identified **by content, not by position**, so column order is
irrelevant and additional columns are ignored.

| Sheet | Identified by | Role |
|---|---|---|
| Total Unsuppressed | Sheet name (`total unsuppressed`) | The cohort register — defines which episodes exist |
| Treatment Line List | Presence of `currentViralLoad` / `currentArtStatus` | Current clinical state |
| EAC Line List | Presence of `Session_1_Date` / `EAC_Cycle_Number` | EAC session dates |

**Multiple sheets of the same kind are handled deliberately**, because the three
exports behave differently:

- *Total Unsuppressed* is cumulative — one sheet, new episodes appended as rows.
- *Treatment Line List* is a current-state snapshot — the newest sheet is used;
  older ones are ignored and reported as such.
- *EAC Line List* is **not** cumulative; clients leave it once their cycle
  closes. All EAC sheets present are therefore **unioned**, newest first, so a
  client's session history is not lost when they drop out of a later export.

### 3.4 Required data elements

`EXPECTED_COLS` in `ingest.py` is the authoritative list: 6 columns on Total
Unsuppressed, 9 on the EAC list and 28 on the Treatment list, each documented
with the indicator it supports.

The ingest **audits every analysed sheet against this list on each upload** and
raises a finding for any column that is missing, or present under a different
name. Two mechanisms sit behind that:

- **Column names on the treatment list resolve case-insensitively.** This is
  not theoretical tidiness: the 24 July export renamed `lga` to `LGA`, which
  under exact matching would have emptied every geography field silently. The
  finding is still raised so the drift is fixed at source, but no data is lost
  in the meantime.
- **Geography falls back to the register.** Where the treatment list omits
  state, LGA or facility, those fields are taken from the Total Unsuppressed
  register instead, and the substitution is reported. An export that drops a
  column no longer empties the filters.

### 3.5 Residence LGA

Residence is the unit that matters epidemiologically — it is where onward
transmission occurs — as distinct from the LGA a facility sits in, which
describes service distribution. Both are available as filters and breakdowns.

The EMR records residence as **free text**, which produced 190 distinct spellings
for 71 real LGAs. Each value is therefore resolved at ingest to a canonical LGA
name, matched against the same boundary set the choropleth draws, with a
national LGA list behind it so residences outside the three programme states
still resolve. The raw text is retained alongside the resolved value, because an
unmatched entry can only be diagnosed if the original survives.

**Values that cannot be resolved confidently return nothing rather than a
guess**, and the unmatched share is reported. "Oshimili" was resolved to
Oshimili South only once the programme team confirmed that every facility there
sits in that LGA; "Ile-Ife", "Ilesa" and "Ede" remain unresolved because each
spans two or more LGAs. On the current dataset 97.4% of residences resolve. A
wrong LGA on a map used to target outreach is worse than a reported gap.

### 3.6 Validation

Twenty data-quality check definitions run on every upload, plus one at upload
time for a line list dated earlier than the current one (section 5.3). Several
are evaluated once per sheet, so the number of findings recorded depends on how
many sheets the workbook carries. They cover, among others:

- missing or blank client keys
- a post-EAC sample still at the laboratory, whose result columns therefore
  still carry the INDEX result: counted as a follow-up result until 19 Aug 2026,
  247 of 2,089 on the 15 August snapshot. The sample date now establishes the
  sample; the result columns establish the result; 241 episodes are reported as
  awaiting a result rather than as failed
- success-censored follow-up VL columns (an export defect that would otherwise
  fabricate a 100% re-suppression rate)
- Excel date corruption in EAC cycle numbers
- EAC sessions dated before the index viral load
- samples drawn before EAC session 1
- implausible viral load values
- switches recorded without a switch date
- expected columns missing or renamed
- inconsistent state casing

Findings are stored per upload in `dq_findings`, graded
`critical / high / medium / low / clear`, and surfaced on a dedicated Data
Quality page. **Findings are reported, not silently corrected**; the programme
sees the state of its own data.

An upload that cannot be parsed at all is marked `failed` with the error
retained, and the previous snapshot remains current. A failed upload never
becomes the active data set. This behaviour is covered by a regression test.

Optional columns that an export omits are treated as absent data, not as an
error: the affected indicator reports "not recorded" and the upload proceeds.

### 3.7 Processing steps

1. Administrator submits the file over HTTPS.
2. A row is written to `uploads` with status `processing`.
3. Sheets are read, classified and validated.
4. `build_cohort()` derives the episode-level cohort: index VL, EAC session
   flags, follow-up and post-EAC viral loads, re-suppression, regimen switching,
   care outcomes and exit dating, time-to-event metrics, and fiscal-year
   quarters.
5. Derived rows are inserted into `cohort`; findings into `dq_findings`.
6. The new snapshot atomically becomes current.
7. The upload event is written to `audit_log`.

### 3.8 How uploaded records are stored — and what is not stored

**Only derived records are persisted.** The submitted workbook is parsed and
discarded; it is never written to a durable volume, never committed to the
repository, and no copy is retained after ingest.

For completeness and accuracy: the web framework spools any upload larger than
1 MB to a **temporary file inside the container** (`/tmp`) for the duration of
the request, which the operating system removes when the request completes. This
is ephemeral container-local storage on a non-persistent layer. If ECEWS
requires that no plaintext clinical export ever touch a filesystem, this is the
one place to address, and it is configurable at the framework level.

---

## 4. User roles and access control

### 4.1 Authentication

- **Username** and password. An email address is also held for every account - required, but as contact and identity rather than as the way in, because an address tells an administrator reading the usage panel far less than a name does. Sign-in accepts either handle, so the change locked nobody out; accounts predating it had a username derived from their address. Usernames are unique case-insensitively, 3-32 characters.
- Passwords hashed with **bcrypt** (per-password salt).
  Inputs longer than 72 bytes are SHA-256 pre-hashed so a long passphrase cannot
  collide with its own prefix.
- Successful sign-in issues a **JWT** (HS256), default lifetime 12 hours,
  configurable. The signing key comes from the environment and is never in
  source. Rotating it invalidates every live session.
- Failure responses do not reveal whether an account exists.
- **Lockout:** 5 failed attempts for one address within 15 minutes blocks
  further attempts (both values configurable). The counter is derived from
  `audit_log`, so it survives restarts and applies across all workers, and it
  counts from the last successful sign-in rather than indefinitely.

### 4.2 Account provisioning

**Accounts are created by an administrator. There is no self-registration**, and
adding one is deliberately not possible from the sign-in page.

This is a design decision, not an omission. Every account carries a data scope
(section 4.4), and that scope is the access-control boundary — deciding whether
a given person may see Delta or Osun is a judgement an administrator makes, not
a dropdown the requester fills in for themselves. For a patient-level clinical
data set, provisioning has to be an explicit act by someone accountable for it.

Passwords are managed as follows:

- an administrator sets the username, email and initial password when creating the account, and can
  **reset** any account's password without knowing the old one, which is how a
  forgotten password is recovered;
- **users change their own** password from the header, and must supply their
  current one to do so, so an unattended signed-in browser cannot be used to
  lock the real owner out;
- minimum length is **10 characters**, configurable through
  `MIN_PASSWORD_LENGTH`; common defaults (such as `changeme` or `password`) are
  refused outright;
- **there are no default passwords in the code.** The administrator and the
  optional shared viewer account are created on first start only if
  `ADMIN_PASSWORD` / `VIEWER_PASSWORD` are set; unset means the account is not
  created;
- administrators can change an account's role and scope, disable it, or delete
  it when a member of staff leaves;
- every creation, reset, change, failed change attempt, role change and
  deletion is written to the audit trail.

### 4.3 Roles

| Role | Capabilities |
|---|---|
| `admin` | Everything below, plus upload/delete snapshots, manage user accounts, read the audit trail and feedback |
| `analyst` | Read all dashboards within scope; **may export the line list** |
| `viewer` | Read dashboards within scope only; **cannot export** |

### 4.4 Row-level scope

Each account may carry `scope_state` and/or `scope_facility`. Where set, the
account can only ever see rows matching that scope.

This is enforced at a **single chokepoint**: every query for cohort data passes
through one function (`_load`), used by every data endpoint, and **scope
overrides any filter the client requests**. A viewer scoped to Delta cannot
obtain Osun data by manipulating a request parameter, and the CSV export path
uses the same function, so it inherits the same restriction.

### 4.5 Authorisation of administrative functions

Administrative endpoints (upload, delete, prune, user management, audit,
feedback) are gated by a dependency that rejects any non-admin caller with HTTP
403. This is server-side; hiding controls in the interface is presentation only
and is never relied upon for enforcement.

### 4.6 Bulk extraction

Exporting the patient-level line list as CSV is restricted to `analyst` and
`admin`. Both successful and denied attempts are recorded in the audit trail,
including the exact filter slice and row count. Exporting rows chosen in a
table is the same server-side export, so it carries the same restriction and
the same audit; the browser never assembles a file of patient rows itself.

### 4.7 Client search and the client record

Since version 2.1, any role can find one client by S/N (or part of it), or by
facility plus one detail, and open that client's record: every failure episode,
viral load dates, EAC session dates, last pickup and next scheduled visit. Both
pass through the same scope chokepoint, so a facility account finds only its own
clients, and **every search and every record opened is written to the audit
trail**. The record holds no name or PEPID; the dashboard still holds none.

---

## 5. Generating, updating and refreshing dashboard outputs

### 5.1 Refresh model

The dashboard is **snapshot-based, not streaming**. It reflects exactly one
upload — the current snapshot — and changes only when an administrator uploads a
new workbook. There is no scheduled job, no polling of an external system and no
partial or incremental update.

The operational cycle is:

1. HI team produces the bi-weekly export.
2. Administrator converts it to Parquet (optional but recommended) and uploads.
3. The ingest derives the cohort and the new snapshot becomes current.
4. All users see the new figures on their next page load.

Nothing is cached beyond the request; every page computes from the current
snapshot, so there is no stale-cache class of error.

### 5.2 How indicators are produced

Indicators are computed **at ingest**, from the derived `cohort` table, using the
definitions in `EAC_Indicator_Definitions_and_Data_Analysis_Plan_v3_1.md`, which
accompanies this dossier. Aggregation and filtering happen per request; the
underlying derivations do not.

An important operational consequence: **changing an indicator definition requires
re-uploading the workbook**, because the derived columns are written at ingest.

### 5.3 The as-of date, and why it governs several indicators

Every upload carries an **as-of date**, which should match the newest line list
in the workbook. Time-dependent indicators are measured *from* it — most
importantly **completed EAC**, which requires 30 days to have elapsed since
session 3. A cycle is not finished on the day the last session happens.

The practical consequence is worth stating plainly, because it has already
caused a false alarm: **an upload dated earlier than the one it replaces makes
those indicators fall, on arithmetic alone.** In one instance a snapshot dated
26 July was replaced by one dated 24 July, and completed EAC dropped by ten —
which reads as clients un-completing a cycle, something that cannot happen.
Compared at a common date, completions had in fact risen.

Two guards now exist:

- an upload dated earlier than the current snapshot raises a warning on the
  upload result and a high-severity data-quality finding, naming the gap;
- the comparison view (5.4) flags any indicator that moves backwards, and
  marks it as explained by the date where the pair runs backwards in time.

### 5.4 Comparing snapshots

Because uploads are immutable, movement between any two line lists is
answerable directly. The **Line list changes** page reports, for any pair:

- the interval between their as-of dates;
- episode flow — carried by both, new in the later list, no longer present;
- nine cascade indicators side by side with the change between them.

Those indicators only ever ratchet upward for a given episode, so a fall is
flagged rather than left to be noticed by eye. The page is available to every
role and is scope-filtered through the same function as every other data view,
so a state-scoped user sees only their own state's movement. Managing uploads
remains administrator-only.

### 5.5 Auditability of outputs

Because uploads are immutable and dated, any figure the dashboard has ever shown
can be reproduced by pointing at the relevant snapshot. Each upload also records
its source-sheet manifest and the warnings raised, so it is always answerable
which sheets a given set of figures was built from.

---

## 6. Security controls summary

| Control | Status |
|---|---|
| Authentication on every endpoint except health and login | Implemented |
| Password hashing (bcrypt, salted) | Implemented |
| Session tokens (JWT HS256, 12 h, key from environment) | Implemented |
| Signing key fails closed if unset in production | Implemented |
| Brute-force lockout | Implemented (5 / 15 min) |
| Role-based authorisation, server-side | Implemented |
| Row-level scoping through a single chokepoint | Implemented |
| Bulk export restricted by role | Implemented |
| Audit trail of authentication and patient-data access | Implemented |
| Parameterised SQL throughout (no string interpolation of values) | Implemented |
| Secrets supplied by environment, never committed | Implemented |
| No patient data in source control | Implemented, and enforced by CI |
| Automated regression tests over the controls above | Implemented (see 1.5) |
| Password reset and self-service change | Implemented (see 4.2) |
| No default passwords in code | Implemented (see 4.2) |
| Client search and record views audited and scoped | Implemented (see 4.7) |
| Raw upload not persisted | Implemented (see 3.8) |
| Transport encryption | Provided by the hosting layer (see 8.3) |
| Encryption at rest | Provided by the database host (see 8.3) |

### 6.1 Audit trail detail

`audit_log` records: authentication successes, failures and lockouts;
patient-level record views, client searches and CSV exports, with the filter
slice and row count; and every upload, snapshot deletion, prune, user creation,
role or scope change, activation change, deletion and password reset. Each row carries timestamp, user id, email as written at the time,
action, detail and originating IP address (honouring the proxy header set by the
hosting layer).

The trail is readable only by administrators, through a read-only endpoint.
No application code updates or deletes an audit row.

### 6.2 Usage tracking, and what it means for staff

Separately from the security audit, the application records one row per
authenticated request (`usage_log`) so administrators can see whether the
dashboard is actually being used, by whom, and which pages matter. This is
**staff activity data**, and we would rather state it plainly here than have it
discovered:

- it records the user, the page and the time — never anything the user typed,
  and never patient data;
- session duration is **inferred** from gaps in activity, not measured. The
  application holds no live connection and most people close the tab rather than
  signing out, so a visit consisting of one page reads as zero minutes. It is
  sound for "is this being used"; it is not a timesheet and should not be read
  as one;
- it is visible to administrators only;
- if ECEWS policy requires staff to be notified that usage is recorded, or
  requires a retention limit on this table, both are straightforward — the table
  is independent of everything else and can be pruned on a schedule without
  affecting the dashboard or the audit trail.

---

## 7. Known limitations and remediation status

Stated openly, because a review is more useful when it starts from an honest
baseline.

| # | Item | Severity | Status |
|---|---|---|---|
| 1 | Signing key previously fell back to a hard-coded value | High | **Resolved** — now fails closed unless `APP_ENV` names a development host |
| 2 | No audit trail | High | **Resolved** — `audit_log` implemented |
| 3 | No brute-force protection on sign-in | Medium | **Resolved** — lockout implemented |
| 4 | Any authenticated user could export the full line list | Medium | **Resolved** — restricted to analyst/admin and logged |
| 5 | EMR free-text rendered unescaped into the DOM in six places | Medium | **Resolved** — all data-derived strings HTML-escaped; since version 2.0 the React dashboard escapes all rendered text by default. The vector was a malformed upload, not a public form |
| 6 | An export omitting an optional column aborted the whole upload with an opaque error | Medium | **Resolved** — missing optional columns now degrade to "not recorded"; found by the new API tests |
| 7 | Seed accounts were created with default passwords | High | **Resolved** — no defaults in code; an unset seed password means the account is not created (4.2) |
| 8 | Password policy | Medium | **Largely resolved** — 10-character floor (configurable), known defaults refused, admin reset and self-service change; complexity rules and expiry still pending ECEWS policy |
| 9 | Filter lists (LGA names) are not scope-filtered | Low | **Open** — exposes place names, no patient data |
| 10 | Uploads >1 MB spool briefly to container-local `/tmp` | Low | **Open** — see 3.8 |
| 11 | No automated schema down-migration | Low | Accepted by design |
| 12 | No multi-factor authentication | — | **Not implemented** — available if ECEWS requires it |

Items 8 and 12 are policy decisions rather than code defects, and we would
welcome ECEWS's standard on both.

---

## 8. Hosting and deployment requirements

### 8.1 Minimum environment

- Container runtime (Docker or equivalent), or a Python 3.12 host
- PostgreSQL 16 or later
- Outbound internet access is **not** required at runtime
- Approximate footprint: 1 vCPU, 1 GB RAM for the application; the database is
  small — the cohort is about 4,900 rows per line list (October 2026)

### 8.2 Configuration

All configuration is by environment variable; `.env.example` documents each one.
Required in production: `DATABASE_URL`, `JWT_SECRET`. The application **will not
start** without `JWT_SECRET` unless `APP_ENV` explicitly names a development
host.

### 8.3 Items ECEWS controls

- **TLS/HTTPS**: terminated by the ECEWS reverse proxy or platform. The
  application does not terminate TLS itself and should not be exposed directly.
- **Encryption at rest**: a property of the provisioned database.
- **Backup and retention**: to follow ECEWS policy; the application makes no
  independent backups.
- **Network placement**: the application needs only inbound HTTPS from its users
  and outbound access to the database.
- **`CORS_ORIGINS`** should be set to the hosting origin, replacing the
  permissive development default.

### 8.4 Pre-hosting checklist

1. Set `APP_ENV=production`.
2. Generate and set a strong `JWT_SECRET`.
3. Set `DATABASE_URL` to the ECEWS-provisioned database.
4. Set `ADMIN_PASSWORD` before first start, or the administrator account is not
   created. It applies only at creation; an account that already exists has its
   password changed through the interface. Leave `VIEWER_PASSWORD` unset unless
   a shared read-only account is wanted.
5. Once named accounts exist, delete any shared account that was created.
6. Set `CORS_ORIGINS` to the hosting origin.
7. Confirm TLS termination and HTTP→HTTPS redirection.
8. Confirm database backup schedule and retention.

---

## Appendix A — API endpoints

44 API routes. All require authentication except `/api/login`, `/api/health`
and `/api/version`.

**Authentication and own account:** `POST /api/login`, `GET /api/me`,
`POST /api/me/password`

**Patient-level (audited, scope-filtered):** `GET /api/clients`,
`GET /api/client-search`, `GET /api/client/{sn}`, `GET /api/risk` (its
lowest-chance list), `GET /api/dtc/awaiting`, `GET /api/dtc/trajectory`, `GET`
and `POST /api/export` *(export: analyst/admin)*

**Aggregate analytics (scope-filtered):** `/api/summary`, `/api/overview`,
`/api/cascade`, `/api/breakdown/{by}`, `/api/plans`, `/api/time-metrics`,
`/api/survival`, `/api/unsupp-curve`, `/api/mortality`, `/api/deep-dive`,
`/api/profile`, `/api/dtc`, `/api/worklists` (counts only), `/api/compare`,
`/api/filters`

**Data quality and line lists:** `GET /api/dq`, `GET /api/uploads` (the list of
loaded line lists, for comparison)

**Administration (admin only):** `POST /api/uploads`, `DELETE /api/uploads/{uid}`, `POST /api/uploads/prune`, `GET /api/users`,
`POST /api/users`, `PATCH /api/users/{uid}`, `DELETE /api/users/{uid}`,
`POST /api/users/{uid}/access`, `POST /api/users/{uid}/password`,
`GET /api/audit`, `GET /api/usage`, `GET /api/feedback`, `GET /api/diagnostics`

**Feedback:** `POST /api/feedback`

**Unauthenticated:** `GET /api/health` (liveness only, returns no data);
`GET /api/version` (version, commit and page hash only)

Outside `/api`, old `/app` links redirect permanently to `/`, and the two map
boundary files are served as static files.

## Appendix B — Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes in production | Session token signing key |
| `APP_ENV` | Recommended | `production` (default) enforces the above |
| `JWT_TTL_HOURS` | No | Session lifetime, default 12 |
| `ADMIN_PASSWORD` | First start | Seed administrator password; unset means the account is not created |
| `VIEWER_PASSWORD` | No | Optional shared viewer account; unset means it is not created |
| `MIN_PASSWORD_LENGTH` | No | Minimum password length, default 10 |
| `LOGIN_LOCKOUT_FAILS` | No | Failed attempts before lockout, default 5 |
| `LOGIN_LOCKOUT_MINUTES` | No | Lockout window, default 15 |
| `SESSION_GAP_MINUTES` | No | Inactivity gap that ends a session in the usage panel |
| `CORS_ORIGINS` | Recommended | Permitted browser origins |
| `DB_PASSWORD` | Docker Compose | Database password for the local two-container stack |
| `GIT_COMMIT` | Build | Commit reported by `/api/version`, set at image build |
| `PORT` | Platform | Injected by the host if applicable |

## Appendix C — Accompanying documents

- `EAC_Indicator_Definitions_and_Data_Analysis_Plan_v3_1.md` — indicator
  definitions, inclusion criteria and analysis plan
- `DEPLOY.md` — deployment runbook
- `docs/RUNBOOK_pipeline.md` — the weekly de-identification routine
- `docs/DECISIONS_AND_INCIDENTS.md` — standing rules, numbered decisions and incidents
- `PROJECT_STATUS.md` — current state, figures and pending work
- `README.md` — developer orientation
- `.env.example` — annotated configuration reference
