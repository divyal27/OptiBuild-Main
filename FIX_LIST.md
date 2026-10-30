# Fix list

- [ ] **Demo-blocking F04 — load the project-access fix into the backend used by the demo.** Commit `748e590` passes the workspace suite, but the existing port 8000 service is not running this checkout.
  Verify: an unassigned user gets 403 for project detail and an empty project list; assigned members can access only their projects.
- [ ] **Demo-blocking F08 — run the PM roster fix on the backend used by the demo.** The current branch allows PM roster access and assignment on port 8001; the port 8000 service still returns 403 for PM `/users`.
  Verify: PM can list users and add an existing user; site engineer and other non-admin/non-PM roles remain denied.
- [ ] **Demo-blocking F09 — resolve the port 8000 WBS failure.** Current branch WBS persistence and the downstream chain all return 200 on port 8001; the port 8000 service returns 500 and its server traceback is unavailable here.
  Verify: `POST /api/v1/projects/{id}/wbs` returns 200 and stores tasks on the backend used by the demo; then GA schedule, CP-SAT benchmark, and optimizer return 200.
