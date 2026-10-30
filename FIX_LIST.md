# Fix list

- [ ] **Demo-blocking F08 — align the running backend with the workspace role rule for PM team assignment.** Workspace permissions are already committed, but the live PM roster request still returns 403.
  Verify: PM can load users and assign an existing user; other roles remain denied.
- [ ] **Demo-blocking F09 — fix persisted WBS generation.** Pure WBS generation returned 13 tasks, but saving WBS to the active project returned 500. The project remains without WBS/tasks; the response was generic and the backend traceback is needed before changing code.
  Verify: active project WBS save returns 200, stores tasks, and subsequent schedule, benchmark, and optimizer routes run.
- [ ] **Demo-blocking F04 — load the committed project-isolation fix into a backend process.** Commit `0c82e16` removes the fallback and targeted/full tests passed, but the current server process still shows the pre-fix leak.
  Verify: a backend using this commit returns an empty `/api/v1/auth/me` projects array for an isolated user.
