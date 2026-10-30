PHASE 0 — SAFETY: complete.
Done: confirmed clean codex-stabilize worktree and created backup-main-autonomous / backup-codex-autonomous tags.
Found: local main has no commits missing from codex-stabilize; DEBUGGING.md is absent.
Fixed: added test-docs/ and ralph-logs/ to .gitignore; neither directory existed yet.
Next: run local backend/frontend baseline without reading or changing .env.
PHASE 1 — LOCAL BASELINE: complete.
Done: frontend build passed; backend suite passed 79 tests; branch health/home returned HTTP 200.
Found: port 8000 is held by Docker Desktop proxy; its service differs from this checkout.
Fixed: used a temporary Python 3.12 environment; no manifest or .env changes.
Next: finish priority audit and leave demo-data cleanup untouched.
PHASE 2 — PRIORITY FIXES: partial.
Done: F02 fixed in 3306379; F04 fix is committed in 748e590; F08 roster and assignment tests pass in 286a4c0.
Found: port 8000 service still denies PM roster access; current branch passes on port 8001.
Fixed: corrected login NameError and updated stale PM role test to match DEMO.md.
Next: validate the RERA sample and current-branch module chain; retain port 8000 items in FIX_LIST.md.
PHASE 3 — MAHARERA PREFILL: complete.
Done: extracted 15 pages and 29,851 characters; sample has a real text layer and table-heavy application layout.
Found: old parser selected a generic header/co-promoter and payment amount; carpet total is not present as an aggregate.
Fixed: parser now handles table pairs, wrapped labels, units, dates, no generic project-name inference, and safe OCR fallback; commit 77787c0.
Next: review the P2 chain against the backend used by the demo.
PHASE 4 — PM MODULE CHAIN: partial.
Done: current branch on port 8001 returned 200 for project detail, WBS, GA, CP-SAT, optimizer, dashboard, and drawings; PM roster 200/site engineer denial 403.
Found: existing port 8000 returned WBS 500, PM roster 403, benchmark/optimizer 400 with Generate WBS first, dashboard/drawings 200; no backend traceback available.
Fixed: no code change made without confirming the port 8000 WBS root cause; port 8001 verifies the checked-out source.
Next: user must run the current branch backend on the demo port and verify F04/F08/F09 before release.
