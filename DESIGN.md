# OptiBuild Engineering Design System & Specification

> **Single Source of Truth** for the OptiBuild Site Engine OS.  
> Derived from `ui_ux_pro_max` and `taste-skill` (dials: design variance LOW, motion intensity MEDIUM, visual density HIGH).  
> All components, pages, styles, colors, typography, and motion rules MUST conform strictly to this document.

---

## 1. Blueprint Identity & Visual Philosophy

OptiBuild is a mission-critical civil engineering construction management and statutory compliance platform.  
Its aesthetic is that of a **high-precision Site Office Terminal & Blueprint CAD Workstation**:
- **Flat surfaces & quiet chrome**: Information density is high; decorative clutter, AI purple/pink gradients, and emoji iconography are strictly forbidden.
- **Precision borders**: 1px crisp borders (`border-border`), subtle engineering grid backgrounds (`blueprint-grid-bg`), and razor-sharp 4px border radii (`rounded-[4px]`).
- **Data-first typography**: Every number, date, currency amount, task ID, and RERA registration code is rendered in monospace (`font-mono`).
- **High-contrast statutory signaling**: Safety Orange (`#E8590C`) is reserved for primary actions, statutory warnings, and critical path activities.

---

## 2. Color Palette & Semantic Tokens

Both Light Mode (Blueprint Paper) and Dark Mode (Site Office Terminal) are first-class, WCAG AA compliant (contrast ratio >= 4.5:1).

| Token | Light (Paper Blueprint) | Dark (Site Terminal) | Usage / Role |
| :--- | :--- | :--- | :--- |
| `--background` | `#F4F1EA` (Blueprint parchment) | `#14181F` (Carbon dark) | Main application canvas background |
| `--card` / `--surface` | `#FFFFFF` (Clean sheet) | `#1A2029` (Muted carbon tile) | Cards, panels, tables, modals |
| `--foreground` | `#1C2024` (Deep charcoal ink) | `#E8ECEF` (High-contrast white) | Primary headings, body copy, titles |
| `--muted-foreground` | `#5C6470` (Muted graphite) | `#8A94A6` (Muted silver) | Labels, subheaders, helper text |
| `--border` | `#D4CBBA` (Architectural rule) | `#283243` (Steel blueprint rule) | 1px borders, separators, table rules |
| `--grid-line` | `rgba(28, 32, 36, 0.05)` | `rgba(232, 236, 239, 0.04)` | Subtle 24px blueprint background grid |
| `--primary` / `--accent` | `#E8590C` (Safety Orange) | `#E8590C` (Safety Orange) | Primary CTA buttons, active state, badges |
| `--primary-hover` | `#D9480F` (Deep Orange) | `#FF7A1A` (Bright Safety) | Hover state for interactive primary items |
| `--secondary` | `#EAE4D5` (Soft parchment) | `#222935` (Dark slate) | Secondary buttons, active nav pills |
| `--status-success` | `#2B8A3E` (Forest Green) | `#2F9E44` (Vibrant Green) | On-schedule status, verified RERA, complete |
| `--status-warning` | `#E8590C` (Safety Orange) | `#F59E0B` (Amber Warning) | Approaching deadlines, delay risk exposure |
| `--destructive` | `#C92A2A` (Crimson Red) | `#FA5252` (Bright Red) | Critical path tasks, budget overruns, delete |

---

## 3. Typography Scale & Hierarchy

All fonts are loaded locally via `@fontsource` packages for zero external network dependency and instantaneous rendering.

| Font Family | CSS Variable / Utility | Purpose & Rules |
| :--- | :--- | :--- |
| **Space Grotesk Variable** | `var(--font-heading)` / `font-heading` | Page titles, major section headings (`h1`–`h4`), card titles. Letter spacing: `-0.02em`. |
| **IBM Plex Sans Variable** | `var(--font-sans)` / `font-sans` | Body text, descriptions, dialog explanations, instructions. Letter spacing: `-0.011em`. |
| **IBM Plex Mono** | `var(--font-mono)` / `font-mono` | **MANDATORY for all numerical data**, currency (₹), dates, percentages, task IDs, RERA numbers, badges, table headers, and KPI metrics. |

### Type Hierarchy
- **Page Titles (`h1`)**: `text-xl` or `text-2xl font-bold font-heading tracking-tight`
- **Section Headers (`h2`)**: `text-xs sm:text-sm font-semibold font-heading uppercase tracking-wider`
- **Card Subheaders (`h3`)**: `text-xs font-semibold font-heading`
- **Data Metrics / KPIs**: `text-2xl font-bold font-mono tracking-tight`
- **Table & Form Labels**: `text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-muted-foreground`
- **Badges & Tags**: `text-[9px] sm:text-[10px] font-mono uppercase font-semibold px-1.5 py-0.5`

---

## 4. Spacing, Geometry & Radius Rules

- **Border Radius**: Strict `4px` maximum across the entire system (`rounded-[4px]` or `rounded-none`). No round pills or large radii (`rounded-xl`, `rounded-2xl` are forbidden).
- **Border Width**: Uniform `1px` (`border border-border`). No heavy decorative drop shadows; separation is achieved by border contrast and surface elevation.
- **Visual Density**: HIGH. Compact padding (`p-3` to `p-4` on cards, `py-2 px-3` on tables) to accommodate data-heavy civil engineering parameters on screen without unnecessary scrolling.
- **Containers**: Responsive grid systems with max-width containment (`max-w-7xl` or fluid `w-full`).

---

## 5. Number & Currency Formatting Standards

- **Indian Rupee (INR) Representation**:
  - Always rendered in `font-mono`.
  - Format via `formatINR(amount, compact)` from `@/lib/utils`.
  - Standard: `₹15,00,000` (Indian numbering comma separators: 2, 2, 3 digits).
  - Compact: `₹15.00 L` (Lakhs) and `₹1.50 Cr` (Crores).
- **Days & Schedule Variance**:
  - Delays: `+14 days` in `text-status-warning` or `text-destructive font-mono`.
  - On-schedule: `0 days` or `On Schedule` in `text-status-success font-mono`.
- **Confidence Scores & Percentages**:
  - `98.4%` in `font-mono`.

---

## 6. Motion & Animation Standards (`framer-motion`)

- **Duration Limit**: All animations MUST complete within **250ms** (hard maximum: 400ms).
- **Properties Animated**: Animate `transform` (scale, translateY) and `opacity` **only** for 60fps GPU acceleration.
- **Accessibility**: Respect `prefers-reduced-motion` at all times.
- **Specific Interaction Patterns**:
  - **Page Mount**: Subtle fade and vertical slide (`opacity: 0, y: 6` to `opacity: 1, y: 0` in 200ms ease-out).
  - **Key Metric Numbers**: Smooth count-up on initial render using `<AnimatedNumber />` primitive.
  - **Table Rows**: Staggered fade-in on initial load (`staggerChildren: 0.03s`), once only.
  - **Button Interactions**: Micro-press feedback (`whileTap={{ scale: 0.98 }}`).
  - **Gantt & Stepper Progress**: Smooth width / step indicator interpolation.
  - **Skeleton Loaders**: Engineered shimmer cards (`<SkeletonCard />`, `<SkeletonTable />`) replacing blank screens and raw spinners.

---

## 7. Chart & Gantt Color Tokens

- **Recharts Tokens**:
  - Cumulative Planned Spend (S-Curve): `--muted-foreground` (`#8A94A6`), dashed stroke.
  - Cumulative Actual Spend: `--primary` (`#E8590C`), solid 2px stroke with active dot.
  - Monthly Spend Bars: Planned (`#283243`), Actual (`#E8590C`).
  - Gridlines: `var(--border)` or `var(--grid-line)` with `strokeDasharray="3 3"`.
  - Tooltip: Dark carbon background (`#1A2029`), 1px border (`#283243`), `font-mono` text, no drop shadows.
- **Gantt Schedule Tokens**:
  - Critical Path Activities: `#E8590C` (Safety Orange) with `#C92A2A` active border.
  - Float / Normal Activities: `#7C8594` (Muted Steel).
  - Bar Height: `22px`–`24px`, radius `2px`.
  - Today Marker: 1px vertical line in Safety Orange with timestamp pill.

---

## 8. Role-Based Navigation & Chrome Matrix

OptiBuild supports 7 distinct construction roles. The TopBar and Sidebar must communicate the active role clearly:

| Role Code | Role Display Name | Accessible Modules | Landing Focus |
| :--- | :--- | :--- | :--- |
| `admin` | System Administrator | All Modules + User & Team Mgmt | Complete system oversight |
| `project_manager` | Project Manager | Gantt, MahaRERA, WBS, Optimizer, Benchmark, Drawings, Dashboard | Schedule & statutory compliance |
| `site_engineer` | Site Engineer | Gantt Schedule, Material Log (Site Photos), Drawings | Daily site progress & visual inspection |
| `store_keeper` | Store Keeper | Material & Cost Log | Material receipt, stock, invoices |
| `architect` | Lead Architect | Drawing Vault (CAD/PDF Attachments) | Drawing repository (view/download) |
| `accountant` | Project Accountant | Material Log, Budget vs Actual Dashboard | Spend auditing & cost variance |
| `owner` | Owner / Developer | Budget vs Actual, Delayed Risk Summary | High-level financial & RERA exposure |

### TopBar Chrome Requirement:
- Displays active project name, RERA registration ID, and delay risk status.
- **Displays current logged-in user name and role badge** (e.g. `[PROJ_MGR] Priya Sharma`).
- Provides quick 1-click role switcher demo menu for rapid demonstration.

---

## 9. Accessibility (a11y) & Responsive Rules

1. **WCAG AA Compliance**: Text contrast minimum 4.5:1 against card and background surfaces.
2. **Keyboard Navigation**: All interactive elements (`button`, `input`, `select`, `a`) must feature visible focus rings (`focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none`).
3. **Responsive Width (375px–1440px)**:
   - Mobile breakpoint (`< 768px`): Sidebar collapses into a drawer; TopBar includes a hamburger toggle.
   - All tables wrapped in `<div className="overflow-x-auto">` with internal scrolling so the page body never scrolls horizontally.
   - Metric ribbons flex/grid dynamically (2-column on mobile, 4-column on desktop).
4. **Icons**: Lucide icons only. Zero emojis. All functional icon-only buttons include descriptive `aria-label` or `title`.
