# Phase 1 Data Model: Responsive UI Redesign

This feature is presentation-layer only (constitution Principle IX). **No database schema, API contract, or Zustand store shape changes.** This document exists to (a) confirm the domain entities the redesigned UI reads from are unchanged, and (b) define the one genuinely new "entity" this feature introduces: the shared design-token set.

## Existing domain entities (read-only reference — unchanged)

Sourced from `api/coaching/*.js` and `frontend/src/store/useCoachingStore.js` / `useStore.js`, confirmed via Graphify (`occurrences.js`, `plans.js`, `relationships.js`, `workspaces.js`, `dates.js`, `plan-sources.js`, `schedule.js`).

- **Workout Occurrence** (`api/coaching/occurrences.js`): a scheduled instance of a workout on a date, states include scheduled/customized/rescheduled/day-off/in-progress/completed. The redesigned UI reads this exact shape (no new fields) to render status badges and lock started/completed occurrences from destructive controls.
- **Recurring Plan / Plan Prescription** (`api/coaching/plans.js`, `frontend/src/lib/coaching/plan-sources.js`): trainer-authored repeating prescription. UI reads `personalPlanSource()` / `starterPlanSource()` outputs unchanged to render template/source badges.
- **Coaching Relationship** (`api/coaching/relationships.js`, `workspaces.js`): trainer↔client link, lifecycle state, and (via `dates.js` `dateInZone()`) the coaching time zone used to resolve "today." UI reads `hasActiveCoachPlan(ownWorkspace)` (already used in `App.jsx` for routing) unchanged.
- **Diet Assignment, Check-In, Fee, Invitation**: each already modeled in `api/coaching/*.js` and rendered by the corresponding existing view/component; redesign changes only how these render, not their shape.

## New entity: Design Token Set

The single source of truth both client and trainer surfaces draw from after migration. Lives as CSS custom properties in `frontend/src/index.css` (`:root` default + `:root[data-theme='light']` override), consumed by `ui.jsx`, `Icon.jsx`, and (post-migration) the five `components/coaching/*.css` files.

| Token group | Existing examples (kept) | New "Blackprint Green" additions |
|---|---|---|
| Surface | `--bg`, `--bg-el`, `--surface`, `--surface-2`, `--surface-3` | Dark surface ramp seeded from export: `#201e1d`, `#2d2b2b`, `#343130` |
| Label/text | `--label`, `--label-2/3/4` | Off-white text ramp: `#f3f2f2`, `#f8f4f4`, gray ramp `#4a4746`→`#cfcdcb` |
| Separator | `--sep`, `--sep-op` | Derived from new neutral ramp via existing `color-mix()` pattern |
| Accent | `--acc`, `--acc-2`, `--on-acc`, `--acc-soft`, `--acc-line` | Primary green `#3ecb8e`, deep green `#0a6b43`, mid green `#10a86a` |
| Semantic status | existing `--red`/`--green`/`--orange`/etc. | Error ramp from export (`#ec3013`, `#ff8a80`, `#5c2b2e`) mapped onto existing `--red` role; success mapped onto `--green` role — **no new semantic roles invented**, existing role names reused so components don't need prop changes |
| Shape/spacing/motion | `--r-sm/--r/--r-lg/--r-xl/--r-card`, `--pad`, `--ease`, `--fast`/`--med`, `--sab`/`--sat` | Confirmed via in-browser inspection (research.md §1a): all radius tokens become `0` (export is explicitly "zero radius"); `--hair` becomes a 2px rule instead of 0.5px; token **names** unchanged so no component code needs to change, only values |
| Elevation | `--surface`, `--surface-2`, `--surface-3` | Confirmed: one flat **card** fill (`--surface`) per theme, not multiple card tones. `--surface-2`/`--surface-3` are a different concern (pressed/nested feedback, control-track chrome per their original token comments) and stay derived-but-distinct (`color-mix` off `--surface`) rather than collapsing to it — collapsing them would silently remove all `:active` press feedback app-wide |
| Typography | (none existed as tokens before — currently hardcoded `-apple-system, BlinkMacSystemFont` per-component) | New: Archivo throughout, loaded as a web font; scale confirmed as 36px screen titles / 15px body / 11px uppercase labels at 0.12em letter-spacing / tabular-nums for all logged numeric values |

**Validation rule**: every new/changed token value must maintain WCAG AA contrast for `--label` on `--bg`/`--surface` and for `--on-acc` on `--acc` (FR-022) — checked as part of the foundation task, not deferred. Confirmed contrast from the export: `#0a6b43` fill with white text is 5.9:1 (passes AA).

**Confirmed accent semantics** (research.md §1a): green (`--acc` family) is reserved specifically for the primary action and for anything trainer-authored/coach-assigned — not a generic decorative accent. `#3ecb8e` is accent text on the ink (dark) theme, `#0a6b43` is accent text on paper (light) theme, `#10a86a` is reserved for chart/data marks only and MUST NOT be used for UI text or controls.

## UI state model (per FR-026/027/028)

Applies uniformly across every migrated screen via shared components, not a new store:

| State | Source of truth | Shared presentation |
|---|---|---|
| Loading | existing async flags in `useStore`/`useCoachingStore` (e.g., request-in-flight booleans already used per view) | New shared skeleton/spinner treatment added to `ui.jsx` |
| Empty | existing "no data" conditions per list/collection (e.g., no occurrences, no check-ins) | New shared empty-state block (icon + message + optional primary action) added to `ui.jsx` |
| Error | existing catch/error state per fetch already surfaced via `Toast.jsx` / inline messages | Consistent inline error treatment + reuse of `Toast.jsx` for transient errors |
| Disabled | existing read-only/locked conditions (e.g., `coachPlanActive`, started/completed occurrence) | `Button`/`Row`/form controls gain a consistent disabled visual + reason text where one doesn't already exist |
| Conflict | recurring-plan publish / concurrent schedule edit (existing `expectedVersion()` optimistic-concurrency check in `api/coaching/validation.js`) | New shared conflict banner/dialog surfaces the existing 409-style rejection instead of a generic error |
| Offline | existing `frontend/public/sw.js` cache behavior | New shared offline indicator reflecting existing `navigator.onLine`/cache state, no new caching logic |

No new entity, field, or store slice is introduced to track these states — they are derived from data/flags that already exist per view.
