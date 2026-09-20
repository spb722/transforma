# Phase 0 Research: Responsive UI Redesign

All items below were resolved directly from repository evidence (Graphify queries + direct file inspection); no `NEEDS CLARIFICATION` markers remained in Technical Context, so this phase focuses on decisions needed before Phase 1 design, not unknowns.

## 1. How to extract exact tokens from the approved Claude Design export

- **Decision**: Treat `design/claude-export/Transforma Blackprint Green (1).html` as a bundled, self-contained React artifact (confirmed: `<title>Bundled Page</title>`, a loading/thumbnail shell, and a large embedded JS bundle — not raw markup/CSS). Extract exact token values by opening it in a browser during the design-token task and reading computed styles / the bundle's embedded palette, seeded by the palette already extracted via static scan: primary green `#3ecb8e`, deep green `#0a6b43`, mid green `#10a86a`, dark surfaces `#201e1d`/`#2d2b2b`/`#343130`, off-white `#f3f2f2`/`#f8f4f4`, neutral gray ramp `#4a4746`→`#eae9e9`/`#cfcdcb`, and a red/error ramp (`#ec3013`, `#ff8a80`, `#5c2b2e`, etc.).
- **Rationale**: The file is a minified bundle; regex/text extraction gets colors but not spacing, radii, or type scale reliably. A one-time in-browser inspection pass (during the token-foundation task) is cheap and accurate; hand-parsing the bundle is not.
- **Alternatives considered**: Fully static-parse the bundle for all CSS-in-JS values — rejected, high effort for a one-time extraction, and brittle if the bundler inlines computed styles at runtime.

### 1a. Addendum (2026-09-18, T005): confirmed values from in-browser inspection

Loading the export in a headless browser (Playwright, no visible-UI dependency) surfaced its own embedded design brief text, not just colors — this **supersedes** the radius/elevation assumption in §2 below and in `data-model.md`'s original draft:

- **Radius**: explicitly **zero** ("2px rules, zero radius") — this is a hard rule for the new theme, not a "re-tuned" version of the existing `--r-sm/--r/--r-lg/--r-xl/--r-card` scale. Those token names are kept (contract §1 requires it) but their **values** become `0` in the new default theme.
- **Rules/separators**: **2px** solid rules, replacing the existing `--hair:.5px` hairline for this theme.
- **Elevation**: **one flat card fill per theme**, not three (`--surface`/`--surface-2`/`--surface-3`). Confirmed text: "Neutral-900 is the only card fill on ink; surface is the only one on paper." The three-level tokens are kept for API compatibility but `--surface-2`/`--surface-3` collapse to the same value as `--surface` in this theme (no separate "pressed"/"nested" shade).
- **Accent semantics**: green is not a generic accent — it is specifically reserved for **the primary action and anything the trainer authored**. Fill `#0a6b43` with white text (5.9:1 contrast); `#3ecb8e` is accent *text* on the ink (dark) theme, `#0a6b43` is accent *text* on paper (light) theme; `#10a86a` is reserved for **data marks only** (charts), never for UI/text. This directly reinforces FR-007/FR-025: coach-assigned/trainer-authored content should visually key off green specifically, not just "the accent color."
- **Typography**: **Archivo** throughout (needs adding — not currently loaded; existing `-apple-system, BlinkMacSystemFont` stack is replaced for this theme). Confirmed scale: 36px screen titles, 15px body, 11px uppercase labels at `0.12em` letter-spacing, **tabular numerals** for every logged/numeric value (weights, reps, sets).
- **Theme naming**: the export calls its two themes "ink" (dark, default) and "paper" (light) rather than "dark"/"light" — cosmetic, existing `data-theme="dark"|"light"` attribute values are kept unchanged; "ink"/"paper" is just the export's descriptive language, not a code contract.
- **Business-rule copy already validated in the approved design**: exact strings worth reusing verbatim for consistency with the signed-off direction (not a scope-creep content rewrite — this text is lifted directly from the approved export): "COACH-ASSIGNED PLAN" section label, "Your trainer manages this plan and its schedule." subtext, "READ ONLY" badge, "TODAY · GIVEN BY YOUR TRAINER" / "GIVEN BY YOUR TRAINER" day-off framing, "YOU CONTROL THIS CLIENT'S SCHEDULE" trainer-side banner with "Assign days, set days off, and edit the plan. The client sees it read-only.", and the coach-rules summary: "Plans and schedules are trainer-authored and read-only to the client, days off are attributed and dated, extra sessions log separately, and the coach sees only what the client shared."
- **Card-fill/ground mapping** (best-effort from hex frequency in the bundle, to be confirmed visually during T027/US1 verification rather than blocking foundation work): ink ground `#201e1d`, ink card fill `#2d2b2b`, rule/border `#343130`; paper ground `#f3f2f2`, paper card fill `#f8f4f4`.

## 2. Token unification strategy (fixing the "two products" root cause)

- **Decision**: Extend `frontend/src/index.css`'s existing CSS-variable token layer (`--bg`, `--surface`, `--label*`, `--sep*`, `--acc*`, `--r-*`, `--pad`, `--ease`/`--fast`/`--med`, `--sab`/`--sat`) with the new "Blackprint Green" values as the new default theme, keep the existing `:root[data-theme='light']` override mechanism, then migrate the five coaching stylesheets (`coaching.css`, `editor.css`, `diet.css`, `checkin.css`, `fees.css`) to consume these same variables instead of their own hardcoded hexes (`#eef4ea`, `#203a29`, `#68756c`, etc.) and local variable `--coach-border`/`--coach-green`.
- **Rationale**: The personal app already fully runs on this token layer; the coaching subtree is the only place that reintroduced its own palette. Extending one file and migrating five is far lower risk than building a second token system or replacing both.
- **Alternatives considered**: New parallel token file for coaching only — rejected, perpetuates the two-products split the redesign exists to fix. Full CSS rewrite from scratch — rejected, unnecessary risk given the existing structure is sound (constitution Principle III/IX bias toward minimal, proven change).

## 3. Component reuse strategy

- **Decision**: Restyle `frontend/src/components/ui.jsx` primitives (`Button`, `Row`, `Section`, `TextField`, `SearchField`, `Switch`, `Segmented`, `Stepper`, `Slider`, `Check`, `SelectRow`, `NumberField`) in place. Add new variants/props only where the export introduces a genuinely new pattern with no existing analogue (e.g., a status badge component for scheduled/customized/rescheduled/day-off/in-progress/completed/draft/published/saving/error states — currently expressed ad hoc via `coaching-status` classes in `fees.css`). New shared components go in `ui.jsx` (cross-role) or `components/coaching/` (coaching-specific) — never duplicated per screen.
- **Rationale**: `ui.jsx` already covers most needed primitives; screens mostly need re-skinning + new status/badge/card primitives, not a new component architecture.
- **Alternatives considered**: New parallel component library — rejected per constitution (no new UI framework/library) and because it would duplicate, not consolidate.

## 4. Responsive breakpoint strategy

- **Decision**: Keep the existing breakpoint pattern already used in the codebase (`index.css` has a `min-width:1000px` desktop rule; coaching CSS uses `max-width:760px` for mobile nav collapse, `max-width:900px`/`480px`/`420px`/`340px` for editor/adherence grids). Add explicit checkpoints at 768px (tablet) and 1440px (desktop) to align with the four required viewports, expressed as plain CSS media queries (no CSS-in-JS, no container-query dependency) — consistent with the existing custom-CSS approach.
- **Rationale**: Matches constitution's "custom React components and ordinary CSS with CSS variables" constraint and the codebase's existing pattern; introducing container queries or a CSS-in-JS system would be new tooling for no proven benefit.
- **Alternatives considered**: CSS container queries per component — rejected as unnecessary added complexity for a codebase that has always used viewport media queries.

## 5. Icon strategy

- **Decision**: Extend `frontend/src/components/Icon.jsx`'s existing stroke-based icon set (`--icon-stroke:1.7` token already defined) with any new glyphs the export requires, following the same stroke conventions; no new icon library/dependency.
- **Rationale**: Constitution requires reusing existing SVG/icon conventions; the set is already centralized in one file.
- **Alternatives considered**: Adopt an icon package (e.g., lucide-react, already a dependency of the unrelated `design/coaching-prototype/` app) — rejected; that prototype is explicitly out of scope per Clarifications, and pulling in a new icon dependency isn't needed.

## 6. Visual regression / responsive verification approach

- **Decision**: Reuse and extend the existing `e2e/capture-design-screens.mjs` Playwright script. It already authenticates against local test accounts (`test_1`, cookie-signed via `data/secret`) against `http://localhost:8080` and captures the exact client/trainer/web screenshot sets now sitting in `design/ui-audit/`. Extend it to also capture 360×800 and 768×1024 (it currently only does 390×844 mobile and 1440×900 desktop), and re-run it after each rollout group to produce fresh comparison screenshots.
- **Rationale**: This is a purpose-built, already-working, non-destructive (read-only navigation, never publishes/saves/cancels) capture tool wired to the exact account and relationship IDs needed — reinventing it would violate the "favor reuse" instinct for no benefit and risks missing its safety guarantees (never mutates live coaching state).
- **Alternatives considered**: Manual screenshotting via browser devtools per task — rejected as slower and non-reproducible across the many rollout groups; a new screenshot tool — rejected, duplicates working infrastructure.

## 7. Rollout order (incremental screen groups)

- **Decision**: Six sequential groups, each independently verifiable end-to-end before the next starts:
  1. **Foundation**: token extension in `index.css`, `ui.jsx` restyle, `Icon.jsx` additions, coaching CSS migration onto shared tokens (no screen-visible change yet beyond shared chrome).
  2. **Client core loop** (User Story 1): `Login`, `Home`, `ClientHome`, `Plan`, `RoutineEdit`, `Workout`.
  3. **Trainer core loop** (User Story 2): `TrainerHome`, `ClientWorkspace` (mode="trainer"), `WorkoutPlans`, `WorkoutPlanEditor` (templates, recurring editor, schedule manager).
  4. **Remaining client screens** (User Story 3): `Library`, `Stats`, `ClientWorkspace` (mode="client"), `WeeklyCheckIn`, `Progress`(client), `Fees`(client), `Settings`.
  5. **Remaining trainer screens** (User Story 4): `Invitations`, `TrainerSettings`, `DietPlans`, `CheckInResponse`, `Progress`(trainer), `Fees`(trainer).
  6. **Login/Coach/Admin + system-wide states & accessibility pass** (User Stories 5–6): `Coach`, `CoachIntake`, `CoachProposal`, `AdminCoach`, plus a cross-cutting sweep of loading/empty/error/disabled/conflict/offline states and keyboard/contrast/reduced-motion verification across all groups.
- **Rationale**: Matches the spec's user-story priorities (P1 loops first), lets shared/mode="client"|"trainer" components (`ClientWorkspace`, `WeeklyCheckIn`, `Progress`, `Fees`) be finished once each in the group where they're most load-bearing, and keeps each group small enough to satisfy constitution Principle VII (test/build/viewport verification per phase, not deferred).
- **Alternatives considered**: One big-bang rewrite — explicitly rejected by the task brief and constitution Principle VII. Per-individual-screen groups (33 groups) — rejected as excessive overhead versus the six-group structure, which still keeps each group's blast radius small and testable.
