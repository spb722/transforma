# Phase 1 Contract: Shared Design Tokens & Component Props

This feature has no network/API surface to contract (constitution Principle IX — no API changes). Per the plan template's guidance to use "UI contracts for applications," this document is the contract other tasks and future screens must honor: the token names and shared-component prop shapes every migrated screen depends on.

## 1. Token contract (`frontend/src/index.css`)

Every migrated screen/component MUST read colors, spacing, radii, and motion **only** via these existing custom-property names (values change with this feature; names do not, so no component needs a rename):

```
Surface:    --bg  --bg-el  --surface  --surface-2  --surface-3
Text:       --label  --label-2  --label-3  --label-4
Separator:  --sep  --sep-op  --hair
Accent:     --acc  --acc-2  --on-acc  --acc-soft  --acc-line
Semantic:   --blue --green --red --orange --yellow --teal --indigo --pink --purple --mint --brown --grey
Shape:      --r-sm  --r  --r-lg  --r-xl  --r-card
Spacing:    --pad
Icon:       --icon-stroke
Motion:     --ease  --fast  --med
Safe area:  --sab  --sat
```

**New token group** (added by this feature, confirmed via research.md §1a — does not rename or replace anything above): a dedicated "trainer-authority" set, kept separate from the user-selectable `--acc`/8-accent personalization system on purpose. Per the approved export, green specifically signals "the primary action and anything the trainer authored" — that signal must stay consistent regardless of which of the 8 personal accent colors a client has chosen, so it cannot live on `--acc`.

```
--trainer-fill:     #0a6b43   (same value both themes)
--trainer-on-fill:  #ffffff   (white type on the fill, 5.9:1 confirmed contrast, same both themes)
--trainer-text:     #3ecb8e on the ink (dark) theme, #0a6b43 on the paper (light) theme
--trainer-data:     #10a86a   (reserved for chart/data marks only — never UI/text, same both themes)
```

`StatusBadge`/read-only banners for coach-assigned/trainer-authored state MUST use this group, not `--acc`, so the signal reads consistently across every personal accent choice.

**Rule**: `frontend/src/components/coaching/*.css` MUST NOT define a new hardcoded color, radius, or spacing value once migrated — any coaching-specific value must resolve to one of the tokens above (directly or via `color-mix()` on one of them, matching the existing `--acc-soft`/`--acc-line` pattern). A local override variable (e.g. today's `--coach-border`, `--coach-green`) is permitted only as an alias that itself resolves to a token above, never to a new literal color.

**Rule**: theme switching continues to work via `:root[data-theme='light']` — any component-level style MUST work under both `data-theme` values without a separate code path.

## 2. Shared component props (`frontend/src/components/ui.jsx`)

Existing components and their current contract, retained as-is (props unchanged) unless a new optional prop is listed:

| Component | Existing props (unchanged) | New optional prop this feature may add |
|---|---|---|
| `Button` | `variant, size, icon, trailingIcon, children, className, ...rest` | none required — new visual variant values (if any) are additive string options, not a breaking change |
| `Row` | `icon, iconTint, title, subtitle, value, accessory, onClick, danger, children, className` | `disabled?: boolean` + `disabledReason?: string` — for FR-026 disabled-state requirement, additive |
| `Section` | `title, footer, children, className` | none |
| `SelectRow` | `icon, iconTint, title, value, options, onChange, sheetTitle` | none |
| `TextField` / `TextArea` / `SearchField` / `NumberField` / `Switch` / `Segmented` / `Stepper` / `Slider` / `Check` | as currently defined | none required |

**New shared components this feature adds to `ui.jsx`** (net-new, not replacing anything — required by FR-025/026/027 and Constitution III):

- `StatusBadge({ status, label })` — renders one of the spec's Key-Entity occurrence states (scheduled/customized/rescheduled/day-off/in-progress/completed/draft/published/saving/error) with both an icon/shape AND color (FR-025: never color alone).
- `EmptyState({ icon, title, description, action? })` — shared empty-state block (FR-026).
- `Skeleton` / `SkeletonRow` — shared loading placeholder (FR-026).
- `ConflictBanner({ message, onReload })` — shared conflict surface wired to the existing `expectedVersion()` optimistic-concurrency rejection (FR-027, data-model.md §"UI state model").
- `OfflineBanner()` — shared offline indicator reading existing service-worker/online state (FR-028).

Each new component's actual prop shape is finalized during the Foundation rollout group (research.md §7, group 1) and MUST be documented here before any screen group consumes it, keeping this file the single source of truth for shared-component contracts.

## 3. Screen-level behavioral contract (unchanged — restated for traceability)

Every restyled screen MUST continue to call the exact same store actions / API functions it calls today. Concretely, redesign tasks MUST NOT modify the call signatures or behavior of (non-exhaustive, representative set confirmed via Graphify):

- `useCoachingStore`: `bindUser`, `refreshOwnCoaching`, `startOwnRevalidation`/`stopOwnRevalidation`, `ownWorkspace`
- `frontend/src/lib/coaching/schedule.js`: `hasActiveCoachPlan()`
- `frontend/src/lib/coaching/plan-sources.js`: `personalPlanSource()`, `starterPlanSource()`, `convertExercise()`, `freshId()`
- `frontend/src/lib/coaching/dates.js` / `api/coaching/dates.js`: `dateInZone()`, `mondayOf()`, `addDays()`
- `api/coaching/access.js`: `authorizeRelationship()`, `requireUser()` (backend — untouched, listed for traceability of what the restyled UI still relies on)

If a task believes a call signature must change to support the new UI, it MUST stop and flag it for explicit user approval (constitution Principle IX) rather than proceeding.
