# OptiBuild UI Polish Implementation Plan (Demo Flow Order)

> **Branch**: `ui-polish`  
> **Source of Truth**: `DESIGN.md` and `UI_AUDIT.md`  
> **Methodology**: 1 Task = 1 Page or Component Group. Run `npm run build` and lint after each task, then commit (`ui: <page> - <what changed>`) and push. Max 3 retries per task before reverting and marking Skipped.

---

## Demo Flow Execution Sequence

### Task 1: Primitives & Design Tokens
- **Files**:
  - `DESIGN.md` (authoritative tokens: colors, type scale, spacing, 4px radius, chart styles, motion rules)
  - `UI_AUDIT.md` (taste-skill redesign audit findings & component logs)
  - `frontend/src/app/globals.css` (tokens consolidation, blueprint-grid, a11y focus)
  - `frontend/src/components/ui/AnimatedNumber.tsx` (smooth count-up primitive respecting `prefers-reduced-motion`)
  - `frontend/src/components/ui/SkeletonLoader.tsx` (blueprint card and table shimmer placeholders)
- **Validation**: `npm.cmd run build` in `frontend/`
- **Commit**: `ui: primitives - add AnimatedNumber and SkeletonLoader tokens`

---

### Task 3: Login Page (`/login`)
- **Files**:
  - `frontend/src/app/login/page.tsx`
- **Scope**:
  - Blueprint grid canvas backdrop.
  - Page entrance animation (< 250ms).
  - Micro-press feedback (`whileTap={{ scale: 0.98 }}`) for 1-click demo role tiles and submit button.
  - Input styling with high-contrast safety-orange focus ring.
- **Validation**: `npm.cmd run build` in `frontend/`
- **Commit**: `ui: login - blueprint grid styling, button press motion, and a11y focus rings`

---

### Task 2: Layout & Global Navigation Chrome
- **Files**:
  - `frontend/src/components/layout/TopBar.tsx` (user name + role badge, quick role demo switch dropdown, mobile hamburger, button press feedback)
  - `frontend/src/components/layout/Sidebar.tsx` (responsive mobile drawer for 375px screens, framer-motion dropdown, active nav indicator)
  - `frontend/src/components/layout/ClientLayoutWrapper.tsx` (integrate mobile drawer state, replace spinner with blueprint skeleton)
  - `frontend/src/components/layout/WakeupBanner.tsx` (slide-down entrance animation < 250ms)
- **Validation**: `npm.cmd run build` in `frontend/`
- **Commit**: `ui: layout - add role indicator, mobile drawer, and smooth transitions`

---

### Task 5: MahaRERA Review & Registration (`/rera-review`)
- **Files**:
  - `frontend/src/app/rera-review/page.tsx`
  - `frontend/src/components/project/GuidedStepper.tsx`
- **Scope**:
  - Dropzone blueprint dashed border, hover glow, and drag-active state.
  - Stepper smooth progress bar animation between steps.
  - Confidence badges in standardized `font-mono` status tags.
  - Confirm banner transition to next guided step.
- **Validation**: `npm.cmd run build` in `frontend/`
- **Commit**: `ui: rera-review - dropzone polish, stepper animation, and confidence badge alignment`

---

### Task 4: Home Overview & Gantt Schedule (`/`)
- **Files**:
  - `frontend/src/app/page.tsx`
  - `frontend/src/components/schedule/GanttSchedule.tsx`
  - `frontend/src/components/weather/SiteWeatherWidget.tsx`
- **Scope**:
  - Metric ribbons: animated count-up (`<AnimatedNumber />`) for Makespan, Delay Risk, Critical Tasks.
  - Responsive 2-column wrap for 375px mobile screens.
  - Gantt schedule container initial mount fade-in (< 250ms).
  - Progress table staggered row entrance and strict `font-mono` numbers.
  - Weather widget blueprint styling.
- **Validation**: `npm.cmd run build` in `frontend/`
- **Commit**: `ui: home - animated metric count-ups, Gantt mount animation, and responsive layout`

---

### Task 7: Delay & Cost Optimizer (`/optimizer`)
- **Constraint**: Polish EXISTING controls only. Do NOT add new slider or new interactive logic. No new API calls.
- **Files**:
  - `frontend/src/app/optimizer/page.tsx`
  - `frontend/src/components/optimizer/RecoverySidePanel.tsx`
- **Scope**:
  - Polish styling of existing input controls and buttons.
  - Format numbers and costs with `formatINR` and `font-mono`.
  - Add animated number count-ups to existing result metrics.
  - Crashing table `font-mono` alignment and badge polish.
- **Validation**: `npm.cmd run build` in `frontend/`
- **Commit**: `ui: optimizer - polish existing controls, format INR numbers, and crashing table styling`

---

### Task 11: Executive Dashboard (`/dashboard`)
- **Constraint**: Style EXISTING charts only. Do NOT add an S-curve or any new chart.
- **Files**:
  - `frontend/src/app/dashboard/page.tsx`
- **Scope**:
  - Budget vs Actual cards: animated count-up for Planned, Actual, and Variance numbers.
  - Existing Recharts: style with DESIGN.md color tokens (Safety Orange `#E8590C`, Muted Slate `#8A94A6`, flat carbon tooltip `#1A2029`).
  - Mobile responsiveness down to 375px.
- **Validation**: `npm.cmd run build` in `frontend/`
- **Commit**: `ui: dashboard - style existing charts with design tokens, tooltip styling, and KPI count-ups`

---

### Task 9: Material & Cost Log (`/materials`)
- **Files**:
  - `frontend/src/app/materials/page.tsx`
- **Scope**:
  - Procurement log table: staggered row mount, `font-mono` rates, and `formatINR`.
  - Animated count-up for Total Material Expenditure.
  - MobileNetV2 site photo classifier: confidence badge in `font-mono` and dropzone feedback.
  - Locked rule strictly preserved: bill photos are attach-only and never parsed.
- **Validation**: `npm.cmd run build` in `frontend/`
- **Commit**: `ui: materials - procurement table row transitions, animated spend KPI, and classifier badge polish`

---

### Task 10: Drawing Vault (`/drawings`)
- **Constraint**: Restyle existing download buttons only; keep existing download endpoint and logic unchanged.
- **Files**:
  - `frontend/src/app/drawings/page.tsx`
- **Scope**:
  - Restyle existing download button and action triggers with clean blueprint icon/text styling.
  - Card grid layout with 1px blueprint borders and 4px radius.
  - View-only statutory compliance badge.
  - Locked rule strictly preserved: drawings are attach-only and never parsed.
- **Validation**: `npm.cmd run build` in `frontend/`
- **Commit**: `ui: drawings - restyle download buttons, card grid layout, and view-only badges`

---

### Task 6: WBS Generator & Cost Estimation (`/wbs`)
- **Files**:
  - `frontend/src/app/wbs/page.tsx`
- **Scope**:
  - Package breakdown table: strict `font-mono` for all costs and rates with `formatINR`.
  - Self-contained horizontal scroll container for mobile screens (375px).
  - Animated count-up for Total Estimated Cost card.
- **Validation**: `npm.cmd run build` in `frontend/`
- **Commit**: `ui: wbs - INR formatting, font-mono alignment, and responsive table container`

---

### Task 8: GA vs CP-SAT Benchmark (`/benchmark`)
- **Files**:
  - `frontend/src/app/benchmark/page.tsx`
- **Scope**:
  - Solver metrics cards: animated numbers for runtime ms and makespan days.
  - Smooth tab switch animation with Framer Motion.
  - Blueprint code viewer for raw JSON with copy feedback.
- **Validation**: `npm.cmd run build` in `frontend/`
- **Commit**: `ui: benchmark - animated solver metrics, smooth tab transitions, and blueprint code viewer`

---

### Task 12: Admin & Team Management (`/admin`)
- **Files**:
  - `frontend/src/app/admin/page.tsx`
- **Scope**:
  - User roster table: dedicated horizontal scroll container, unified role badges.
  - Role assignment form: clean blueprint focus states, button press animation.
- **Validation**: `npm.cmd run build` in `frontend/`
- **Commit**: `ui: admin - user roster table scroll, role badge styling, and form focus states`

---

### Task 13: Final Verification & Confirmation
- **Scope**:
  - Confirm: zero new dependencies in `package.json`.
  - Confirm: `npm.cmd run lint` passes without errors.
  - Confirm: all 74 backend tests pass (`docker-compose exec -T backend pytest`).
  - Generate manual-check checklist for the 7 roles.
  - Final documentation update in `DESIGN.md` and `UI_AUDIT.md`.
- **Commit**: `ui: polish - finalize documentation and verified test suite`
