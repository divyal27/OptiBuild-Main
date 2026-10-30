# Feature audit

## Autonomous release baseline (2026-10-30)

| Check | Result |
|---|---|
| Branch | `codex-stabilize` |
| Backend tests | PASS: 79 passed, 13 warnings using the project-pinned Python 3.12 environment. |
| Frontend build | PASS: `npm run build`; 13 routes generated. Existing middleware deprecation warning. |
| Current branch backend | PASS: `/health` returned 200 on port 8001; port 8000 was already held by Docker Desktop's proxy. |
| PM module chain | PASS on port 8001: detail, WBS, GA, CP-SAT, optimizer, Budget vs Actual, drawings all returned 200. PM roster returned 200; site engineer roster denial returned 403. |
| Port 8000 service | PARTIAL: PM login and project detail returned 200, but PM roster returned 403 and WBS returned 500. Server logs were unavailable; no code change was made based on that response. |

The Python 3.12 test environment is in `%TEMP%`. No `.env` values were read or printed.

## Baseline (2026-10-30)

| Check | Result |
|---|---|
| Branch | `codex-stabilize` |
| Backend start | PASS: user reports backend is running on port 8000; this audit did not start or restart it. |
| Full backend suite | User reports baseline suite passed; after F04 fix, user reports both targeted zero-membership test and full suite passed. Exact output lines not supplied. |
| Frontend start | PASS: `npm run dev -- --hostname 127.0.0.1` ready at `http://127.0.0.1:3000`. |
| Frontend build | PASS: `npm run build`; Next 16.4.0 compiled and generated 13 static pages. Existing middleware deprecation warning. |
| Demo credentials/API | PASS for login and API auth checks using the existing test fixture; UI flows not yet checked. Credentials and tokens were not printed. |

The backend is running and feature checks used the existing port 8000 service. The user reported the full suite passed before the F04 fix; targeted and full post-fix reruns remain pending. This audit did not start or restart the server.

| ID | Feature | Roles | Backend endpoint(s) | Frontend page | How tested | Status | Last error | Fix commit |
|---|---|---|---|---|---|---|---|---|
| F01 | Health endpoint and database connection | Public health; DB-backed authenticated routes | `GET /health`, `GET /api/v1/auth/me` | N/A | Health returned healthy; PM login then `/auth/me` returned profile from DB | PASS | — | — |
| F02 | Login JWT, logout, wrong-password error | All 7 roles | `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me` | `/login` | Auth endpoint test and full backend suite passed after missing `os` import fix | PASS | `NameError: name 'os' is not defined` on login; fixed | `3306379` |
| F03 | Role-based page and endpoint access | admin, project_manager, site_engineer, store_keeper, architect, accountant, owner | Role guards across `/api/v1/*` | `/`, `/admin`, `/benchmark`, `/dashboard`, `/drawings`, `/login`, `/materials`, `/optimizer`, `/rera-review`, `/wbs` | All 7 fixture logins passed; API user-list returned admin 200 and six non-admin 403. UI: PM sees workspace navigation; owner sees Dashboard only; PM `/admin` page is intentionally allowed but live roster call fails. Other role pages not all checked. | PARTIAL | Live PM user-list denial conflicts with demo PM assignment flow and workspace route declaration; complete 7-role page matrix pending | — |
| F04 | Project-level membership access | All project members; admin bypass | `GET /api/v1/projects`, `GET /api/v1/projects/{id}` and project-scoped routes | `/` (project switcher) | Full backend suite passed isolated-user and membership checks; current branch detail returned 200 for PM on port 8001. | BLOCKED | Port 8000 service is stale; project membership behavior there remains unverified against this commit. | `748e590` |
| F05 | MahaRERA PDF upload and file storage | admin, project_manager | `POST /api/v1/rera/upload-parse` | `/rera-review` | PM sent temporary `.txt`; endpoint rejected with 400 before storage. Valid PDF upload/storage not attempted. | PARTIAL | Valid file persistence and private retrieval not runtime verified | — |
| F06 | PDF parse draft and scanned/corrupt fallback | admin, project_manager | `POST /api/v1/rera/upload-parse` | `/rera-review` | 15 pages, 29,851 characters. Parsed project `Paranjape Abhiruchi Parisar - T1, T2, T3, M1A, M1B and M2`; RERA `REA52100004083`; promoter `PARANJAPE SCHEMES (CONSTRUCTION) LTD`; completion `31/12/2020`; plot `289,604.34 sq.ft`; built-up `492,285.03 sq.ft`; floors `15`; basements `1`; cost `₹3,555,764,622`. Parser and full suite passed. | PASS | Carpet area total not present; apartment table lists per-unit values, so left unset. | `77787c0` |
| F07 | Explicit confirm before project creation | admin, project_manager | `POST /api/v1/rera/confirm` | `/rera-review` | User-reported full suite pass includes confirm API and draft confirmation flags; parse endpoint/no-project-before-confirm integration not tested live. | PARTIAL | Live Confirm creates persistent project/certificate/membership records; no safe live test on shared demo DB | — |
| F08 | Team assignment and project roles | admin, project_manager | `GET/POST /api/v1/users`, `POST /api/v1/projects/{id}/members` | `/admin` | Current branch PM roster and assignment test passed; site engineer roster returned 403. | BLOCKED | Port 8000 service still returns 403 for PM roster; current branch passes on port 8001. | `286a4c0` |
| F09 | Building parameters and WBS generation | admin, project_manager | `GET /api/v1/wbs/default-ratios`, `POST /api/v1/wbs/generate`, `POST /api/v1/projects/{id}/wbs` | `/wbs` | Current branch saved WBS and generated downstream schedule data; WBS, GA, benchmark, optimizer all returned 200 on port 8001. | BLOCKED | Port 8000 WBS returned 500; no server traceback was available. Current branch source passes on port 8001. | — |
| F10 | Rate-table cost estimate and INR lakh/crore formatting | admin, project_manager | `POST /api/v1/wbs/generate`, `POST /api/v1/projects/{id}/wbs` | `/wbs` | PM API estimate for 100,000 sqft at ₹2,800/sqft returned ₹280,000,000 (28 crore); UI formatting not verified | PARTIAL | Currency presentation not checked in browser | — |
| F11 | CPM critical path and float | Authenticated; project roles per route | `POST /api/v1/schedule/cpm`, `POST /api/v1/projects/{id}/schedule` | `/` | Current branch persisted schedule returned 200 after WBS generation; full suite passed CPM and float tests. | PARTIAL | Port 8000 schedule disconnected after its WBS 500; current branch passed on port 8001. | — |
| F12 | GA resource-constrained schedule and Gantt | admin, project_manager | `POST /api/v1/schedule/optimize`, `POST /api/v1/projects/{id}/schedule` | `/` | Current branch project schedule returned 200 after WBS generation. Gantt UI not visually checked. | PARTIAL | Port 8000 WBS prerequisite remains unresolved; Gantt page UI not verified. | — |
| F13 | OR-Tools CP-SAT benchmark versus GA | admin, project_manager | `GET /api/v1/benchmark/presets`, `POST /api/v1/benchmark/run`, `POST /api/v1/projects/{id}/benchmark` | `/benchmark` | Current branch project benchmark returned 200 after WBS generation; frontend route returned 200. | PARTIAL | Port 8000 benchmark reports `Generate WBS first` because its WBS request fails; current branch passes on port 8001. | — |
| F14 | MahaRERA penalty versus crash-cost optimizer | admin, project_manager | `POST /api/v1/optimizer/evaluate`, `POST /api/v1/projects/{id}/optimizer` | `/optimizer` | Current branch project optimizer returned 200 after WBS generation; frontend route returned 200. | PARTIAL | Port 8000 optimizer reports `Generate WBS first` because its WBS request fails; current branch passes on port 8001. | — |
| F15 | Attach-only architectural drawings | admin, architect, project_manager, site_engineer (membership checks also apply) | `GET/POST /api/v1/projects/{id}/drawings` | `/drawings` | User-reported full suite includes assigned-architect upload/permission tests and storage assertions; PM GET drawings for active project returned 200 with 0 entries. | PASS | — | — |
| F16 | Site photo classifier and manual override | admin, site_engineer, project_manager | `POST /api/v1/materials/classify-photo`, `GET/POST /api/v1/projects/{id}/photos` | `/materials` | PM uploaded a temporary 1x1 PNG to non-persistent classify endpoint; response FINISHING_STAGE, confidence 0.90, human_verified=false. Temp file removed. | PARTIAL | Manual override on persisted project photo not tested | — |
| F17 | Material/cost log and unparsed bill photo | admin, store_keeper, project_manager | `GET/POST /api/v1/materials/log`, `POST /api/v1/materials/upload-bill` | `/materials` | User-reported full suite includes material quantity × rate and unparsed evidence assertions plus bill-storage metadata checks; live Store Keeper GET returned 14 rows with evidence flags set. | PASS | — | — |
| F18 | Crash-cost recalibration from material log | admin, accountant, project_manager | `POST /api/v1/dashboard/recalibrate-crash-costs` | `/dashboard` | Accountant POST returned RECALIBRATED and 5 material factors for project with 14 logs; its one task had 0% slope change because task factor was 1.00 while Cement factor was 1.06. No state mutation observed in handler. | PARTIAL | This project data did not demonstrate a changed crash slope; matching material/task behavior remains unverified | — |
| F19 | Budget vs actual, S-curve, delay risk | admin, accountant, owner, project_manager | `GET /api/v1/dashboard/budget-vs-actual` | `/dashboard` | PM GET for active project returned 200 with six categories; earlier owner UI and accountant API checks also passed. | PASS | — | — |
| F20 | Admin user list/create and role assignment | admin; project_manager may list users | `GET/POST /api/v1/users` | `/admin` | Admin GET `/users` returned 200; non-admin roles returned 403 as test_roles.py expects. UI create-user and role assignment not exercised because they persist changes. | PARTIAL | User creation and role assignment not verified | — |
| F21 | Projects overview and project switcher | All authenticated users; results scoped to creator/member; admin sees all | `GET /api/v1/projects` | `/` | PM API and overview showed 17 projects; owner saw 1 assigned project in selector. Switching project not attempted. | PARTIAL | Project switch action not exercised; zero-membership isolation edge case not reproduced | — |
| F22 | Guided setup stepper from project data | admin, project_manager; team membership for counts | `GET /api/v1/projects/{id}`, `POST /api/v1/projects/{id}/members`, WBS/schedule routes | `/`, `/rera-review` | PM overview UI showed live setup stepper with 25% and step statuses alongside project data. Changing underlying project state not tested. | PARTIAL | State transition behavior not exercised | — |
| F23 | Private storage, signed URLs, upload type and size limits | Role and membership checks vary by upload route | Drawing/photo/bill upload and retrieval routes under `/api/v1/projects/{id}/*`, `/api/v1/materials/upload-bill` | `/drawings`, `/materials`, `/rera-review` | PM invalid extension and invalid PDF magic were rejected with 400 before storage. Private bucket policy, signed URL expiry, and size limits not live verified; candidate storage tests unavailable. | PARTIAL | Storage privacy/expiry and size boundaries remain unverified | — |
| F24 | Slow-server handling (waking-up message and retry) | All users | Frontend proxy `/api/*`; backend `GET /health` | All API-backed pages; wake banner component | Static source confirms a 5-second wake banner trigger and up to 3 retries for network errors / 502-504; cold-start behavior not simulated | PARTIAL | Retry and wake banner runtime behavior not tested | — |
| F25 | Weather widget fails gracefully offline | All users | External Open-Meteo API (no backend route) | `/` | Static source has fetch error handling and loading reset; offline behavior not simulated | PARTIAL | Offline rendering not runtime verified | — |
| F26 | Task progress update | Project members; project_manager/site_engineer allowed by route check | `PATCH /api/v1/projects/{id}/tasks/{task_id}/progress` | `/` | Architect PATCH against an admin-visible foreign project returned 403; authorized positive update not attempted because it persists progress | PARTIAL | Authorized update and persistence not verified | — |

## API route and authorization inventory (source inspection)

All paths below are under `/api/v1`. `admin` is implicitly allowed by `require_roles` and project-membership verification. Project-scoped routes also require membership/creator access unless stated otherwise.

| Method and route | Required role/access |
|---|---|
| `GET /health` | Public; reports DB status |
| `POST /auth/login` | Public |
| `POST /auth/logout` | No explicit auth dependency; clears cookie |
| `GET /auth/me` | Authenticated; currently falls back to all projects if user has no memberships (F04 failure) |
| `GET /users/` | admin, project_manager |
| `POST /users/` | admin |
| `GET /projects/` | Authenticated; list scoped to created/member projects; admin sees all |
| `GET /projects/{project_id}` | Authenticated project member/creator; admin bypass |
| `POST /projects/{project_id}/members` | admin or project_manager membership |
| `POST /projects/{project_id}/wbs` | project_manager or admin membership |
| `POST /projects/{project_id}/schedule` | project_manager or admin membership |
| `POST /projects/{project_id}/optimizer` | project_manager or admin membership |
| `POST /projects/{project_id}/benchmark` | project_manager or admin membership |
| `PATCH /projects/{project_id}/tasks/{task_id}/progress` | site_engineer, project_manager, admin membership |
| `GET /projects/{project_id}/drawings` | Authenticated project member/creator; admin bypass |
| `POST /projects/{project_id}/drawings` | architect or admin membership |
| `GET /projects/{project_id}/photos` | Authenticated project member/creator; admin bypass |
| `POST /projects/{project_id}/photos` | site_engineer, project_manager, admin membership |
| `POST /schedule/cpm` | Authenticated; no role restriction |
| `POST /schedule/optimize` | project_manager or admin |
| `GET /benchmark/presets` | Authenticated; no role restriction |
| `POST /benchmark/run` | project_manager or admin |
| `POST /optimizer/evaluate` | project_manager or admin |
| `GET /wbs/default-ratios` | Authenticated; no role restriction |
| `POST /wbs/generate` | project_manager or admin |
| `POST /rera/upload-parse` | project_manager or admin |
| `POST /rera/confirm` | project_manager or admin |
| `GET /materials/log` | Authenticated project member/creator; admin bypass |
| `POST /materials/log` | store_keeper, project_manager, admin membership |
| `POST /materials/upload-bill` | store_keeper, project_manager, admin membership |
| `POST /materials/classify-photo` | site_engineer, project_manager, admin membership |
| `GET /dashboard/budget-vs-actual` | accountant, owner, admin, project_manager membership |
| `POST /dashboard/recalibrate-crash-costs` | accountant, project_manager, admin membership |

Static inventory found CPM, GA, CP-SAT benchmark, optimizer, WBS, PDF parsing, classifier, and recalibration engines; S3 storage adapter; and SQLAlchemy DB session/models/init/seed. The user reports the backend suite passed before the F04 fix; post-fix verification is pending.
## Phase 4 repair notes

### F04 — project isolation

Problem: `/auth/me` returned every project to a non-admin user with no membership.

Ranked likely causes:
1. The explicit demo-convenience fallback queries all projects when the user's scoped query is empty. **Confirmed** by source and a live check: the isolated test account got 36 projects from `/auth/me` and 0 from `/projects`.
2. The ownership/membership query could be incorrectly omitting valid assignments. Existing seven-role comparisons matched `/auth/me` and `/projects`, making this less likely.
3. A stale client project cache could be mixing project lists across users. The discrepancy came directly from two authenticated API responses for the isolated account, so this was not the cause.

Smallest fix applied and committed as `0c82e16`: removed the fallback and added an assertion to the existing zero-membership role test. The user reports the targeted test and full suite both passed. The live backend was not restarted per instruction, so its existing process still has the old behavior.

### F08 — project manager team assignment

Problem: the PM Admin page renders, but its user roster request returns 403, blocking the documented PM assignment workflow.

Ranked likely causes:
1. The running backend process is serving an older/different route policy. **Confirmed**: the live response says admin-only, while workspace `users.py` permits admin and project_manager; `/auth/me` confirms the token user role is project_manager.
2. A redirect from `/users/` could strip the Authorization header. The canonical `/users` URL was tested directly and still returned 403, so this was not the cause.
3. The account could have a role mismatch. `/auth/me` returns `project_manager`, so this was not the cause.

No code change was needed in the workspace source; restarting the running backend is prohibited by the user. F08 remains blocked on the existing process behavior.

## Phase 5 finish status

| Status | Count |
|---|---:|
| BLOCKED | 2 |
| FAIL | 1 |
| PARTIAL | 17 |
| PASS | 6 |

BLOCKED: F04, the running process still has the pre-fix project leak; F08, PM user roster returns 403 on the running process. FAIL: F09, project-specific WBS save returns 500.

**Demo flow ready: no.** Exact failing steps: **Step 2, Add Team as Project Manager** and **Step 3, save WBS for the active project**.
