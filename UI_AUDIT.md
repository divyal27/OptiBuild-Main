# OptiBuild UI/UX Comprehensive Audit & Taste-Skill Redesign Findings

> **Audit Status**: Initial Baseline Complete  
> **Source of Truth**: `DESIGN.md`  
> **Target Branch**: `ui-polish`  
> **Skills Used**: `taste-skill` (redesign-skill audit + app-screens rules) & `ui_ux_pro_max` (design system tokens)  
> **Dials**: Design Variance LOW, Motion Intensity MEDIUM, Visual Density HIGH (Engineering CAD / Blueprint OS)

---

## 1. Taste-Skill Redesign Audit Findings

The `taste-skill` audit of the existing OptiBuild interface evaluated against the 23-product app-screen benchmarks identified the following critical rules and areas for refinement:

1. **Colour On Data, Not Chrome**:
   - *Audit finding*: Nav bars and buttons were occasionally competing with data alerts.
   - *Fix*: Limit saturated Safety Orange (`#E8590C`) strictly to data signals, statutory warnings, critical path bars, and primary CTAs. Chrome (sidebar, top bar, table headers) must remain neutral blueprint carbon (`#14181F`, `#1A2029`, `#283243`).
2. **KPIs As Pure Type & Monospace**:
   - *Audit finding*: Metrics were rendered in variable-width sans fonts, causing visual jitter during data updates.
   - *Fix*: Every KPI, penalty figure, delay day count, and cost must be rendered in `font-mono` (IBM Plex Mono) with animated count-up.
3. **Flat Surfaces & 1px Blueprint Rules**:
   - *Audit finding*: Inconsistent border radii and subtle default shadows.
   - *Fix*: Strictly enforce `4px` maximum radius (`rounded-[4px]`) and `1px` thin blueprint borders (`border-border`), eliminating decorative box shadows in favor of surface contrast.
4. **Substance Over Chrome in Charts**:
   - *Audit finding*: Recharts used default styling with heavy tooltips and un-themed gridlines.
   - *Fix*: Use `--grid-line` faint rules (3-5 lines), flat `#1A2029` carbon tooltip with 1px border, and align series strokes with DESIGN.md tokens.
5. **Table Alignment & Container Isolation**:
   - *Audit finding*: Tables risked overflowing page width on small devices (< 768px).
   - *Fix*: Every table must live in a dedicated `<div className="overflow-x-auto">` container with right-aligned numeric data in `font-mono`.
6. **Role Experience & Shell Identity**:
   - *Audit finding*: The top bar lacked indication of which of the 7 roles is currently active, making demo handoffs confusing.
   - *Fix*: Show `[ROLE] User Name` in TopBar with 1-click role switcher demo presets.
7. **Mobile Viewport (375px)**:
   - *Audit finding*: Desktop sidebar took up 256px on mobile viewports.
   - *Fix*: Mobile drawer toggle in TopBar with responsive slide-out drawer on `< 768px`.

---

## 2. Page-by-Page Audit & Planned Polish

### 2.1 Login Page (`app/login/page.tsx`)
- **Taste-Skill Audit**:
  - Missing background texture; feels like a generic form rather than an engineering OS.
  - Buttons lack tactile feedback.
- **Planned Polish**:
  - Add signature `blueprint-grid-bg`.
  - Micro-press feedback (`whileTap={{ scale: 0.98 }}`) for 1-click demo role tiles.
  - Crisp focus rings on inputs (`focus-visible:ring-1 focus-visible:ring-primary`).

### 2.2 Global Layout Chrome (`TopBar.tsx`, `Sidebar.tsx`, `ClientLayoutWrapper.tsx`)
- **Taste-Skill Audit**:
  - TopBar lacks active user identity and role badge.
  - Fixed 256px sidebar crowds mobile devices (375px).
- **Planned Polish**:
  - Display `[ROLE] User Name` with role badge in TopBar.
  - Add quick role-switch dropdown trigger for fast demo switching.
  - Add hamburger button with responsive slide-out drawer for screens < 768px.
  - Framer-motion entrance for dropdowns (< 250ms).

### 2.3 MahaRERA Review & Registration (`app/rera-review/page.tsx`, `GuidedStepper.tsx`)
- **Taste-Skill Audit**:
  - Dropzone lacks clear blueprint dashed styling and drag-active state.
  - Confidence badges are inconsistent in typography.
- **Planned Polish**:
  - Blueprint dashed dropzone with hover highlight.
  - Animated step progress in `GuidedStepper`.
  - Standardized `font-mono` confidence tags.

### 2.4 Home & Gantt Timeline (`app/page.tsx`, `GanttSchedule.tsx`, `SiteWeatherWidget.tsx`)
- **Taste-Skill Audit**:
  - Key metrics (Makespan, Delay Risk, Critical Tasks) display static numbers.
  - Gantt chart mounts abruptly.
  - Site engineer progress table rows render simultaneously.
- **Planned Polish**:
  - Animated count-up (`<AnimatedNumber />`) for all summary metrics.
  - Smooth initial mount fade-in for Gantt schedule container.
  - Staggered row mount for progress table rows (`staggerChildren: 0.03s`).
  - 2-column mobile ribbon wrap for 375px screens.

### 2.5 Delay & Cost Optimizer (`app/optimizer/page.tsx`, `RecoverySidePanel.tsx`)
- **Taste-Skill Audit**:
  - Form controls and calculation results need crisp blueprint alignment.
- **Planned Polish** (Strict Constraint: Polish existing controls only; no new slider, no new API calls):
  - Format all penalty and savings amounts with `formatINR` in `font-mono`.
  - Add animated number count-ups to existing result metrics.
  - Polish crashing actions table with `font-mono` alignment and status badges.

### 2.6 Executive Dashboard (`app/dashboard/page.tsx`)
- **Taste-Skill Audit**:
  - Recharts look generic and do not inherit system colors.
- **Planned Polish** (Strict Constraint: Style existing charts only; do NOT add an S-curve or any new chart):
  - Style existing charts using DESIGN.md tokens: Safety Orange (`#E8590C`), Muted Slate (`#8A94A6`), flat carbon tooltip (`#1A2029`).
  - Add animated count-up for existing Planned, Actual, and Variance KPI cards.
  - Ensure chart containers resize cleanly down to 375px.

### 2.7 Material & Cost Log (`app/materials/page.tsx`)
- **Taste-Skill Audit**:
  - Material procurement log needs monospace data density and staggered row appearance.
- **Planned Polish**:
  - Staggered row mount on procurement table.
  - All unit rates and total costs in `font-mono` with `formatINR`.
  - MobileNetV2 classification badge in `font-mono`.
  - Locked rule strictly preserved: bill photos are attach-only and never parsed.

### 2.8 Drawing Vault (`app/drawings/page.tsx`)
- **Taste-Skill Audit**:
  - Download action buttons lack clear visual prominence.
- **Planned Polish** (Strict Constraint: Restyle existing download buttons only; keep existing download endpoint and logic unchanged):
  - Restyle download buttons with clean blueprint styling and Lucide icons.
  - Card grid layout with 1px blueprint borders and 4px radius.
  - Locked rule strictly preserved: drawings are attach-only view-only and never parsed.

### 2.9 WBS Generator & Cost Estimation (`app/wbs/page.tsx`)
- **Taste-Skill Audit**:
  - Cost breakdown table needs strict monospace alignment and horizontal containment.
- **Planned Polish**:
  - Strict `font-mono` and `formatINR` on all package breakdown rows.
  - Isolated horizontal scroll container for mobile screens.
  - Animated count-up for Total Estimated Cost card.

### 2.10 GA vs CP-SAT Benchmark (`app/benchmark/page.tsx`)
- **Taste-Skill Audit**:
  - Tab switching between Table and JSON is instantaneous.
  - Metrics cards lack animated number progression.
- **Planned Polish**:
  - Smooth tab switch transition with Framer Motion.
  - Animated count-ups for makespan and runtime ms metrics.
  - Dark carbon blueprint styling for JSON view with copy button feedback.

### 2.11 User & Team Management (`app/admin/page.tsx`)
- **Taste-Skill Audit**:
  - User table needs internal scroll for small devices.
  - Role badges lack token consistency.
- **Planned Polish**:
  - Horizontal scroll container for user roster table.
  - Unified role badges matching `DESIGN.md` role token matrix.
  - Tactile button press feedback on forms.

---

## 3. Task Execution & Skipped Items Log (Bounded Fix Loop)

All 13 tasks executed according to demo flow order. Zero tasks exceeded the 3-attempt fix threshold, and zero tasks were skipped.

| Task ID | Component / Page | Status | Fix Attempts | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Task 1** | Primitives & Tokens (`globals.css`, `AnimatedNumber`, `SkeletonLoader`) | **Completed** | 1 / 3 | Design system tokens, `ibm-plex-mono` KPIs, 4px radius |
| **Task 3** | Login Page (`app/login/page.tsx`) | **Completed** | 1 / 3 | Blueprint grid texture, 7 quick-role demo buttons, tactile tap |
| **Task 2** | Global Layout & Chrome (`TopBar`, `Sidebar`, `WakeupBanner`) | **Completed** | 1 / 3 | Role identity badge, demo switcher, 375px mobile drawer |
| **Task 5** | MahaRERA Review & Confirm (`app/rera-review/page.tsx`, `GuidedStepper`) | **Completed** | 1 / 3 | Blueprint dashed dropzone, confidence pill tags, hook order |
| **Task 4** | Home Overview & Gantt Schedule (`app/page.tsx`, `GanttSchedule`) | **Completed** | 1 / 3 | Animated KPIs, critical path Safety Orange styling, row stagger |
| **Task 7** | Delay & Cost Optimizer (`app/optimizer/page.tsx`, `RecoverySidePanel`) | **Completed** | 1 / 3 | Strict constraint: polished existing controls only, no new sliders/APIs |
| **Task 11** | Executive Dashboard (`app/dashboard/page.tsx`) | **Completed** | 1 / 3 | Strict constraint: styled existing charts only, no S-curve added |
| **Task 9** | Material & Cost Log (`app/materials/page.tsx`) | **Completed** | 2 / 3 | React-dropzone event props aligned; attach-only photos preserved |
| **Task 10** | Drawing Vault (`app/drawings/page.tsx`) | **Completed** | 1 / 3 | Strict constraint: restyled existing download buttons only |
| **Task 6** | Parametric WBS & Cost Estimation (`app/wbs/page.tsx`) | **Completed** | 1 / 3 | Monospace INR table alignment, horizontal containment |
| **Task 8** | GA vs CP-SAT Benchmark (`app/benchmark/page.tsx`) | **Completed** | 1 / 3 | Animated ms/makespan KPIs, smooth tab transition, carbon JSON view |
| **Task 12** | Admin & Team Management (`app/admin/page.tsx`) | **Completed** | 1 / 3 | User roster horizontal scroll, role badge tokens, form focus states |
| **Task 13** | Verification, Lint, Tests & Demo Checklist | **Completed** | 1 / 3 | All 4 verification criteria satisfied |

---

## 4. Task 13 Final Verification Matrix & Role Manual-Check List

### 4.1 Verification Criteria Confirmation
1. **Zero New Dependencies in `package.json`**:
   - `git diff origin/main..HEAD frontend/package.json` produced 0 diff lines.
   - All components, animations, and icons leverage existing libraries (`framer-motion`, `lucide-react`, `recharts`, `@fontsource/ibm-plex-mono`).
2. **`npm run lint` Status**:
   - Passed cleanly with **0 errors** across all TypeScript files.
3. **Backend Test Suite**:
   - Ran `docker-compose exec -T backend pytest`.
   - **74 passed**, 0 failed across all 12 backend test modules (`test_api`, `test_auth`, `test_benchmark`, `test_cpm`, `test_dashboard`, `test_ga`, `test_materials`, `test_optimizer`, `test_pdf_parser`, `test_roles`, `test_storage`, `test_wbs`).
4. **Production Build**:
   - `npm run build` compiled all 13 routes cleanly (`/`, `/_not-found`, `/admin`, `/api/[...path]`, `/benchmark`, `/dashboard`, `/drawings`, `/login`, `/materials`, `/optimizer`, `/rera-review`, `/wbs`).

---

### 4.2 Manual-Check List for the 7 Roles

| Role | Demo Credentials Preset | Key Screen(s) to Verify | Expected UI Behavior & Verification Steps |
| :--- | :--- | :--- | :--- |
| **1. Admin** | `admin@optibuild.internal` | `/admin` | • TopBar shows `[ADMIN] Admin User` badge in `bg-purple-900/40 text-purple-300 border-purple-700/60`.<br>• View User Roster table with horizontal scroll on small viewports.<br>• Confirm Create User form fields have active blueprint focus rings and tactile button feedback.<br>• Full access permitted across all system routes. |
| **2. Project Manager** | `pm@optibuild.internal` | `/rera-review`<br>`/`<br>`/wbs`<br>`/optimizer` | • TopBar shows `[PROJECT_MANAGER] Project Manager` in `bg-blue-900/40 text-blue-300 border-blue-700/60`.<br>• **MahaRERA**: Drop certificate PDF into blueprint dashed dropzone, check confidence tags, click Confirm.<br>• **Home Gantt**: Verify animated count-up KPIs (Makespan, Delay Risk, Critical Tasks) and Safety Orange critical path bar.<br>• **WBS**: Run parametric generator, inspect monospace INR breakdown table.<br>• **Optimizer**: Run delay crash optimization, check crashing table in `font-mono`. |
| **3. Site Engineer** | `site@optibuild.internal` | `/`<br>`/materials` | • TopBar shows `[SITE_ENGINEER] Site Engineer` in `bg-emerald-900/40 text-emerald-300 border-emerald-700/60`.<br>• **Home**: Update task % completion in the progress table; verify staggered row mount.<br>• **Materials**: Upload site progress photo, observe MobileNetV2 classification badge in `font-mono`. |
| **4. Store Keeper** | `store@optibuild.internal` | `/materials` | • TopBar shows `[STORE_KEEPER] Store Keeper` in `bg-amber-900/40 text-amber-300 border-amber-700/60`.<br>• Add material delivery entry, verify unit rates format as `₹X,XX,XXX.XX` in `font-mono`.<br>• Attach weighbridge bill photo — verify it is stored as an attach-only file with **no OCR** triggered. |
| **5. Architect** | `arch@optibuild.internal` | `/drawings` | • TopBar shows `[ARCHITECT] Architect` in `bg-teal-900/40 text-teal-300 border-teal-700/60`.<br>• Browse Drawing Vault sheets.<br>• Verify restyled download buttons with Lucide icon styling.<br>• Verify drawings are attach/download-only with **no OCR** triggered. |
| **6. Accountant** | `accountant@optibuild.internal` | `/dashboard`<br>`/materials` | • TopBar shows `[ACCOUNTANT] Accountant` in `bg-indigo-900/40 text-indigo-300 border-indigo-700/60`.<br>• **Executive Dashboard**: Inspect Planned vs Actual spend KPI cards with animated count-up in INR monospace.<br>• Verify styled Recharts bar and line charts adhering to DESIGN.md palette tokens.<br>• Confirm unauthorized routes (like `/admin`) show the `PermissionDenied` guard. |
| **7. Owner** | `owner@optibuild.internal` | `/dashboard`<br>`/` | • TopBar shows `[OWNER] Owner` in `bg-rose-900/40 text-rose-300 border-rose-700/60`.<br>• **Executive Dashboard**: Inspect MahaRERA Section 18 statutory delay liability alert card.<br>• Review high-level project delay risk and cost variance KPIs.<br>• Verify mobile viewport responsiveness down to 375px via top bar mobile drawer. |

