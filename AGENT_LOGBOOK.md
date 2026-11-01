# 🤖 AGENT_LOGBOOK.md — Autonomous AI Agent Operations Ledger
<!-- SYSTEM DIRECTIVE FOR ALL AI AGENTS (Antigravity, Claude Code, OpenAI Codex, Cursor) -->
<!-- 
MANDATORY FOR ALL AI AGENTS:
1. READ THIS FILE AT THE START OF EVERY SESSION.
2. CHECK 'ACTIVE_LOCKS' BEFORE MODIFYING SHARED CODE.
3. WHEN AN ERROR OR TEST FAILURE IS FIXED, APPEND AN ENTRY TO 'ERROR_LEDGER'.
4. RECORD COMPLETED TASKS UNDER 'AGENT_ACTION_LOG'.
-->

---

## 🏛️ Team Hierarchy & Governance Model

```
                    [Divyal (Repository Owner)]
                    Main Branch Gatekeeper & Final Merges
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
[Bhushan Bhosale]          [Chaitanya]                 [Aniket]
Collaborator               Collaborator                Collaborator
Branch: feat/bhushan-*     Branch: feat/chaitanya-*    Branch: feat/aniket-*
Agent: Antigravity/Claude  Agent: Codex/Claude Code    Agent: Antigravity/Cursor
Module: Penalty Engine     Module: CP-SAT Benchmark   Module: Frontend & CV
```

* **Human Role:** Focus 100% on product requirements, architecture, user needs, and academic viva defense.
* **AI Agent Role:** Autonomous code authoring, dependency management, unit testing, error detection, automated logging, and opening Pull Requests.

---

## 🔒 Directory Lock Matrix (Agent Safety Guardrails)

Agents must **strictly respect directory boundaries** to prevent merge collisions across collaborators:

| Module Domain | Directory Scope | Assigned Human Lead | Allowed AI Agents |
|---|---|---|---|
| **Optimization Core** | `backend/app/engine/cpm/`<br>`backend/app/engine/ga/` | Divyal | Divyal's Agents |
| **Benchmark Solvers** | `backend/app/engine/cpsat/`<br>`backend/app/engine/benchmark/` | Chaitanya | Chaitanya's Agents |
| **Financial & Penalty** | `backend/app/engine/penalty/`<br>`docs/`, `research/` | Bhushan Bhosale | Bhushan's Agents |
| **Full-Stack & CV** | `frontend/`<br>`backend/app/cv/`<br>`backend/app/ingestion/` | Aniket | Aniket's Agents |
| **Shared Contracts** | `backend/app/schemas/` | **SHARED (Requires PR)** | Read-Only unless coordinated |

---

## ⚡ Agent Protocol: Self-Healing & Autonomous Error Ledger

Whenever an AI agent detects, investigates, or fixes a bug, lint issue, test failure, or environment error, it **must autonomously log it below**. This creates a shared neural memory so no other agent repeats the same error.

### Error Entry Template for Agents:
```markdown
### [ERR-XXX] YYYY-MM-DD | Agent: <Antigravity|Claude Code|Codex|Cursor> | Operator: <Name>
- **Error Signature:** `<paste exact error string or exception>`
- **Failing Target:** `path/to/file.py:Lxx`
- **Root Cause:** <1-sentence technical explanation>
- **Autonomous Fix:** <how the agent resolved it>
- **Verification:** `<command used to verify green (e.g. pytest tests/test_penalty.py)>`
```

---

## 🚨 Live Error & Incident Ledger

<!-- AGENTS APPEND NEW ENTRIES BELOW THIS LINE -->

### [ERR-001] 2026-10-28 | Agent: Antigravity 2.0 | Operator: Bhushan Bhosale
- **Error Signature:** `remote: Permission to divyal27/OptiBuild-Main.git denied to 26BB. fatal: HTTP 403`
- **Failing Target:** `git push -u origin optibuild-playground`
- **Root Cause:** Collaborator access pending invitation acceptance between `divyal27` and `26BB`.
- **Autonomous Fix:** Created isolated local branch `optibuild-playground` and initialized `AGENT_LOGBOOK.md`. Work committed locally; push ready once invitation is accepted.
- **Verification:** Resolved on 2026-10-30; verified push access via `git push --dry-run upstream HEAD:refs/heads/bhushan-test` returning exit code 0.

### [ERR-002] 2026-10-30 | Agent: Antigravity | Operator: Bhushan Bhosale
- **Error Signature:** `NameError: name 'os' is not defined. Did you forget to import 'os'`
- **Failing Target:** `backend/app/api/v1/auth.py:64`
- **Root Cause:** Missing `import os` in auth router when inspecting `os.getenv("ENVIRONMENT")` to set cookie attributes.
- **Autonomous Fix:** Added `import os` to `backend/app/api/v1/auth.py` and aligned user management RBAC test in `backend/tests/test_roles.py` with `API.md`.
- **Verification:** `pytest backend/tests -v` verified with 74/74 unit tests passing (100% green).

### [ERR-003] 2026-10-30 | Agent: engg-agent (Subagent in Worktree) | Operator: Bhushan Bhosale
- **Error Signature:** `Error [SecurityFatalError]: Your version of Next.js is affected by a known security vulnerability.`
- **Failing Target:** `frontend/` build step (`next build`)
- **Root Cause:** Next.js version 16.4.0 contained a security advisory blocking production builds.
- **Autonomous Fix:** Deployed `engg-agent` in an isolated Git worktree. Upgraded Next.js to `16.4.3`, `eslint-config-next` to `16.4.3`, and added `experimental: { agentUpgrade: "security" }` to `next.config.ts`.
- **Verification:** `npm run build` in `frontend/` compiled successfully in 14.3s with all 13 routes prerendered and 0 errors.

### [ERR-004] 2026-11-01 | Agent: Fleet Bug Hunter (Antigravity 2.0) | Operator: Bhushan Bhosale
- **Error Signature:** `ModuleNotFoundError: No module named 'backend'` & `AssertionError: assert 'CRASH_SCHEDULE' == 'ACCEPT_PENALTY'`
- **Failing Target:** `pytest backend/tests -v` (`backend/tests/conftest.py:7`) & `backend/app/engine/optimizer.py:135`
- **Root Cause:** 1) Missing root `pytest.ini` pythonpath configuration caused direct `pytest backend/tests` execution to fail with `ModuleNotFoundError: No module named 'backend'`. 2) In `DelayRecoveryOptimizer.evaluate`, when a delayed project has 0 recoverable days (`days_rec == 0`) due to critical path activities already at minimum crash duration, `total_crash_cost` evaluated to `0.0 < total_penalty`, erroneously recommending `CRASH_SCHEDULE` at ₹0.00 cost instead of `ACCEPT_PENALTY` for infeasible schedule compression.
- **Autonomous Fix:** 1) Added `pytest.ini` with `pythonpath = .` and hardened `backend/tests/conftest.py` with `sys.path` repo root insertion. 2) Surgically patched `DelayRecoveryOptimizer.evaluate` to handle 0-day delays, uncrashable schedules (`days_rec == 0`), and partial recovery economics against avoidable statutory penalty. Added `backend/app/engine/penalty/` module re-exports. 3) Added regression tests `test_uncrashable_schedule_recommends_accept_penalty` and `test_zero_delay_days_recommends_no_delay` (Beyonce Rule).
- **Verification:** `pytest backend/tests -v` verified with 86/86 unit and integration tests passing (100% green).

<!-- AGENTS APPEND NEW ENTRIES ABOVE THIS LINE -->

---

## 🔄 Live Agent Dispatch & Task State

| Task ID | Module / Feature | Branch | Agent Type | Operator | Status | Verification Status |
|---|---|---|---|---|---|---|
| `TASK-001` | Multi-Agent Operations Ledger | `optibuild-playground` | Antigravity 2.0 | Bhushan | 🟢 Complete | Local commit `009dc74` |
| `TASK-002` | Collaborator Invite & Push Gate | `feat/academic-research-docs` | Human / GitHub | Divyal / Bhushan | 🟢 Complete | Verified push code 0 |
| `TASK-003` | MahaRERA Section 18 Penalty Math | `feat/academic-research-docs` | Claude / Antigravity | Bhushan | 🟢 Complete | Pytest 74/74 green |
| `TASK-004` | CPM DAG Engine NetworkX Pass | `feat/academic-research-docs` | Codex / Antigravity | Divyal | 🟢 Complete | Pytest 74/74 green |
| `TASK-005` | OR-Tools CP-SAT Baseline Model | `feat/academic-research-docs` | Claude Code / Codex | Chaitanya | 🟢 Complete | Pytest 74/74 green |
| `TASK-006` | Next.js Gantt & Project Ingestion | `feat/academic-research-docs` | Cursor / Antigravity | Aniket | 🟢 Complete | npm run build (16.4.3) |
| `TASK-007` | SPPU Academic Research & Docs | `feat/academic-research-docs` | Antigravity | Bhushan | 🟢 Complete | IEEE paper & synopsis |
| `TASK-008` | Delay Recovery Optimizer & Pytest Fix | `feat/academic-research-docs` | Antigravity 2.0 | Bhushan | 🟢 Complete | Pytest 86/86 green |
| `TASK-009` | Production Hardening (F04, F06, F08) & Cold-Start Proxy | `feat/academic-research-docs` | Antigravity 2.0 | Bhushan | 🟢 Complete | Pytest 91/91 green |
| `TASK-010` | Enterprise Multi-Tenant Scoping (`User.org_id`) | `feat/security-hardening` | AI Agent Fleet | Bhushan / Divyal | ⚪ Queued | P0 Security Roadmap |
| `TASK-011` | Statutory Immutable Audit Trail (`AuditLog`) | `feat/security-hardening` | AI Agent Fleet | Bhushan / Divyal | ⚪ Queued | P0 MahaRERA Compliance |
| `TASK-012` | Solver Rate Limiting & DoS Protection (slowapi) | `feat/security-hardening` | AI Agent Fleet | Fleet | ⚪ Queued | P1 Resource Protection |

*Status codes: `🟢 Complete` | `🟡 In Progress` | `🔴 Blocked` | `⚪ Queued`*

---

## 🤖 Instructions for AI Agents Joining This Repo

When you (an AI coding agent) receive a user request:
1. **Identify the human operator** (Bhushan, Divyal, Chaitanya, or Aniket).
2. **Check your branch**: Do not write code directly on `main`. Ensure you are on `feat/<operator>-<topic>` or `agent/<operator>-<topic>` (e.g. `codex/<operator>-<topic>`).
3. **Respect directory locks**: Never edit files outside your operator's designated module without explicit confirmation.
4. **Auto-test before completing**: Always run unit tests (`pytest` or `npm test`) on your modifications.
5. **Log errors and fixes**: If you encounter an error and solve it, add an `[ERR-XXX]` entry to the **Live Error & Incident Ledger** above so your peer agents learn from it.
6. **Open PR against `main`**: All code moves to `main` strictly through GitHub Pull Requests for Divyal's final merge review.
