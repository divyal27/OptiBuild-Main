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

## 3. Skipped Items Log (Bounded Fix Loop)

| Task ID | Component / Page | Failure Reason | Attempts | Reversion Action |
| :--- | :--- | :--- | :--- | :--- |
| *None* | — | — | 0 / 3 | Baseline clean |
