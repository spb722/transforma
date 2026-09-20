# UX Requirements Quality Checklist: Responsive UI Redesign

**Purpose**: Validate that spec.md's requirements — not the eventual implementation — are complete, unambiguous, measurable, responsive, accessible, and consistent, before planning/implementation proceeds.
**Created**: 2026-09-18
**Feature**: [spec.md](../spec.md) (evaluated against the version including the 2026-09-18 clarification session and the two remediations noted below)

## Requirement Completeness

- [x] CHK001 Is the full set of in-scope screens explicitly enumerated, including screens outside the original design manifest? [Completeness, Spec §FR-001, Clarifications]
- [x] CHK002 Are requirements defined for both the "coach plan active" and "no coach plan" client states, not just one? [Completeness, Spec §FR-007–010]
- [x] CHK003 Are all nine distinct trainer plan-management actions individually named rather than grouped as one generic "edit plan" requirement? [Completeness, Spec §FR-011]
- [x] CHK004 Are loading, empty, error, disabled, conflict, and offline states each addressed as their own requirement rather than folded into a single generic "handle errors" line? [Completeness, Spec §FR-026–028]
- [x] CHK005 Does the spec state what is explicitly excluded (API/schema changes, new UI framework, unrelated screens like `Admin.jsx`), not just what is included? [Completeness, Spec §Out of Scope]
- [x] CHK006 Are accessibility requirements enumerated per concern (keyboard, focus, contrast, text scaling, motion, color-independence) rather than a single umbrella "must be accessible" statement? [Completeness, Spec §FR-020–025]

## Requirement Clarity & Ambiguity

- [x] CHK007 Is "read-only" for a coach-assigned plan defined in terms of specific disallowed actions (modify/reorder/delete) rather than left as an unquantified adjective? [Clarity, Spec §Acceptance Scenario 2 under User Story 1]
- [x] CHK008 Is "text scaling" support quantified with a specific percentage/standard rather than left as an open-ended claim? [Clarity, Spec §FR-023] *(remediated 2026-09-18: now cites 200% / WCAG 1.4.4)*
- [x] CHK009 Is "no unintended horizontal overflow" given a concrete definition (which viewports, what counts as "unintended") rather than a vague visual-quality claim? [Clarity, Spec §FR-017, §SC-001]
- [x] CHK010 Is "unresolved layout break" in the visual-comparison success criterion defined with concrete failure examples rather than left to subjective judgment? [Clarity, Spec §SC-005]
- [x] CHK011 Is the minimum touch target given a specific, checkable number rather than a qualitative "big enough" statement? [Clarity, Spec §FR-018]

## Requirement Consistency

- [x] CHK012 Do the client plan-authority requirements (read-only coach plan, editable personal plan) avoid contradicting each other across the two mutually exclusive states? [Consistency, Spec §FR-007–009]
- [x] CHK013 Are the four required responsive viewports stated identically everywhere they appear (spec, and by extension the constitution)? [Consistency, Spec §FR-014; Constitution Principle II]
- [x] CHK014 Do the "existing capabilities must remain functional" list (Spec) and the constitution's Principle VI list match without omission or contradiction? [Consistency, Spec §FR-003]
- [x] CHK015 Is the scope-confirmed screen list (Clarifications) reflected consistently in both FR-001 and the new User Story 6, without a screen appearing in one but not the other? [Consistency, Spec §FR-001, §User Story 6]

## Acceptance Criteria Quality / Measurability

- [x] CHK016 Can each Measurable Outcome (SC-001–007) be objectively pass/failed without needing implementation knowledge to interpret it? [Measurability, Spec §Success Criteria]
- [x] CHK017 Does the spec avoid unquantified qualitative claims (e.g., "feels modern", "intuitive") in its functional requirements in favor of testable statements? [Measurability, Spec §Functional Requirements]
- [x] CHK018 Is "zero regressions" for plan-authority enforcement (SC-002) tied to a specific, repeatable test action rather than a general assurance? [Measurability, Spec §SC-002]
- [x] CHK019 Is the keyboard-navigation success criterion (SC-004) scoped to a specific, enumerable path rather than "the whole app must be keyboard accessible" left unbounded? [Measurability, Spec §SC-004]

## Responsive Requirement Coverage

- [x] CHK020 Are navigation-model requirements defined separately for mobile vs. tablet/desktop rather than assumed identical? [Coverage, Spec §FR-015]
- [x] CHK021 Is "reflow, not stretch" given a concrete contrast (grids/multi-column/side-by-side vs. single-column stretch) rather than left as a slogan? [Clarity, Spec §FR-016]
- [x] CHK022 Are mobile-keyboard-obstruction requirements specified for forms, not just general "usability" claims? [Coverage, Spec §FR-019]
- [x] CHK023 Are responsive requirements for long/overflowing content (names, plan titles) specified as their own edge case rather than assumed away? [Edge Case, Spec §Edge Cases]

## Accessibility Requirement Coverage

- [x] CHK024 Are focus-visibility requirements specified as their own requirement, not merged into a general keyboard-access statement that could be satisfied without a visible indicator? [Coverage, Spec §FR-020–021]
- [x] CHK025 Is a specific contrast standard (not just "good contrast") cited? [Measurability, Spec §FR-022]
- [x] CHK026 Is color-independence (not relying on color alone for state) stated as an explicit, standalone requirement? [Coverage, Spec §FR-025]
- [x] CHK027 Is `prefers-reduced-motion` behavior specified as a requirement rather than left to implementer discretion? [Coverage, Spec §FR-024]

## Scenario & Edge Case Coverage

- [x] CHK028 Does the spec address what happens when a coach plan's active/inactive state changes while a client session is already open? [Edge Case, Spec §Edge Cases]
- [x] CHK029 Does the spec address the case where a trainer edits a recurring plan while a client has already started today's occurrence? [Edge Case, Spec §Edge Cases]
- [x] CHK030 Does the spec address cross-time-zone client/trainer pairs for "today" resolution? [Edge Case, Spec §Edge Cases, §FR-010]
- [x] CHK031 Does the spec address zero-history states (new client, no check-ins/progress yet) separately from the general "empty state" requirement? [Edge Case, Spec §Edge Cases]
- [x] CHK032 Does the spec require confirmation before every destructive/plan-replacing trainer action, rather than leaving some actions ambiguous on this point? [Coverage, Spec §FR-013, §Edge Cases]

## Dependencies & Assumptions

- [x] CHK033 Is the assumption that the single Claude Design export represents the final approved direction (not one of several unreviewed options) stated explicitly rather than left implicit? [Assumption, Spec §Clarifications]
- [x] CHK034 Is the treatment of the unrelated `design/coaching-prototype/` folder stated explicitly so implementers don't treat it as a visual reference by default? [Assumption, Spec §Clarifications]
- [x] CHK035 Is the source of test fixtures for regression verification identified rather than left to implementer discretion? [Dependency, Spec §Clarifications]
- [x] CHK036 Is the constraint against introducing a new UI framework/library stated as a requirement (not just a plan preference) so it's testable at the requirements level? [Consistency, Spec §FR-005]

## Notes

- Two gaps were found and remediated directly in `spec.md` during this checklist pass (2026-09-18): FR-023 text-scaling requirement lacked a quantified target (now cites 200% / WCAG 1.4.4), and the general `Admin.jsx` platform admin panel was undifferentiated from the in-scope `AdminCoach.jsx` AI Coach admin screen (now explicit in Out of Scope).
- No outstanding gaps identified. All items pass against the current spec.md. Ready to proceed to `/speckit.tasks`.
