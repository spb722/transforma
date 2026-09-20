# Claude Code prompt: Spec Kit responsive UI redesign

Copy everything below the divider and paste it into Claude Code from the repository root.

---

You are implementing the approved Transforma UI redesign in this existing repository.

Repository:
`/Users/sachinpb/PycharmProjects/transforma`

Use GitHub Spec Kit for the complete specification, planning, implementation, and verification workflow. Use the existing `graphify-out/` knowledge graph as the primary architecture map.

Do not start changing application code until the specification, clarification, plan, checklist, tasks, and analysis stages are complete.

## 1. Read the project instructions

Read and follow:

- `AGENTS.md`
- `.specify/`
- `.specify/memory/constitution.md`
- `design/ui-audit/CLAUDE-DESIGN-GUIDE.md`
- The approved Claude Design HTML exports
- The current UI screenshots under:
  - `design/ui-audit/current-mobile/client/`
  - `design/ui-audit/current-mobile/trainer/`
  - `design/ui-audit/current-web/`

Locate the Claude Design HTML exports under `design/claude-export/`.

If they are not there, search inside `design/`. If you still cannot find them, stop and ask me for their path. Do not begin implementation without inspecting them.

## 2. Use Graphify before browsing the codebase

Use `graphify-out/` to understand the architecture before reading source files broadly.

Start with focused queries such as:

```bash
graphify query "How are the React frontend routes, layouts, personal app, coaching workspace, and trainer studio connected?"
graphify query "Which components and state modules control personal plans, coach-assigned plans, scheduled workout occurrences, and starting workouts?"
graphify query "Which components implement trainer templates, recurring plan editing, publishing, and the schedule manager?"
```

Use these when a relationship needs more detail:

```bash
graphify explain "<concept-or-symbol>"
graphify path "<component-or-concept-A>" "<component-or-concept-B>"
```

Use `graphify-out/wiki/index.md` for broad navigation if it exists.

Do not manually modify anything inside `graphify-out/`. After implementation, run:

```bash
graphify update .
```

## 3. Use GitHub Spec Kit end to end

Prefer the official Claude Code commands if they are registered:

1. `/speckit.constitution`
2. `/speckit.specify`
3. `/speckit.clarify`
4. `/speckit.plan`
5. `/speckit.checklist`
6. `/speckit.tasks`
7. `/speckit.analyze`
8. `/speckit.implement`
9. `/speckit.converge`

This repository also contains the local workflow definitions under:

- `.agents/skills/speckit-constitution/SKILL.md`
- `.agents/skills/speckit-specify/SKILL.md`
- `.agents/skills/speckit-clarify/SKILL.md`
- `.agents/skills/speckit-plan/SKILL.md`
- `.agents/skills/speckit-checklist/SKILL.md`
- `.agents/skills/speckit-tasks/SKILL.md`
- `.agents/skills/speckit-analyze/SKILL.md`
- `.agents/skills/speckit-implement/SKILL.md`
- `.agents/skills/speckit-converge/SKILL.md`

If the slash commands are not registered in Claude Code, follow these local workflow definitions and `.specify/scripts/` directly. Do not invent a different planning workflow.

## 4. Establish the constitution first

The current `.specify/memory/constitution.md` is still an unfilled template.

Create a practical constitution for this project with these non-negotiable principles:

1. Preserve working business behavior during UI changes.
2. Mobile-first responsive design, with desktop support.
3. Accessible, reusable components and consistent design tokens.
4. Coach-assigned plans are authoritative and read-only for clients.
5. Started and completed workout occurrences must not be destructively replaced.
6. Existing authentication, passkey, coaching, invitation, scheduling, workout, progress, diet, check-in, and fee flows must remain functional.
7. Every implementation phase requires tests, build verification, and responsive visual verification.
8. Use `localhost:8080`, never `127.0.0.1:8080`.
9. No API contract, database, or data-model changes unless the specification proves they are required and I explicitly approve them.
10. Preserve unrelated existing work in the dirty worktree.

Complete the constitution workflow before creating the feature specification.

## 5. Create a new Spec Kit feature

Create a new feature such as:

`responsive-ui-redesign`

Do not overwrite or reuse `specs/001-trainer-client-coaching/`. This redesign must receive its own feature directory and Spec Kit artifacts.

## 6. Feature objective

Implement the approved Claude Design visual direction across the Transforma application while preserving the existing React architecture and all established behavior.

The redesign must cover:

### Client experience

- Personal home
- Coach-assigned home
- Personal plan
- Coach-assigned read-only plan
- Start workout
- Active workout
- Exercise library and exercise details
- Personal statistics
- Coaching overview and workspace
- Weekly check-in
- Progress
- Fees
- Settings
- Empty, loading, error, disabled, success, and offline states

### Trainer experience

- Client overview
- Invitations
- Studio settings
- Client workspace
- Workout plan and template selection
- Recent and saved plans
- Recurring plan editor
- Schedule manager
- Individual workout editor
- Day off, restore, and reschedule flows
- Diet assignment
- Check-in review
- Progress review
- Fee management
- Empty, loading, error, disabled, success, and conflict states

## 7. Design implementation rules

Treat the exported HTML as the visual specification, not as replacement application architecture.

Do not:

- Replace the React application with exported static HTML.
- Embed the export in an iframe.
- Copy generated JavaScript that duplicates existing application state or routing.
- Replace functioning APIs, stores, or domain logic only to match the mockup.
- Introduce Tailwind or a new UI framework unless the plan proves it is necessary and I approve it.

Translate the approved design into:

- Reusable React components
- Shared layout primitives
- CSS design tokens
- Responsive component variants
- Accessible interaction states
- Existing SVG/icon conventions where possible

Preserve the current stack unless the plan identifies a genuine blocker:

- React 19
- Vite 8
- JavaScript and JSX
- React Router 7 with hash routing
- Zustand
- Custom CSS
- PWA and Capacitor support

## 8. Responsive requirements

The application is mobile-first, not mobile-only.

At minimum, validate these viewports:

- 360 x 800
- 390 x 844
- 768 x 1024
- 1440 x 900

Mobile should remain the primary interaction model. Tablet and desktop should progressively use available space without becoming stretched mobile screens.

Define requirements for:

- Navigation transformations
- Content width and alignment
- Grid and card layout changes
- Modal, drawer, and form behavior
- Sticky actions and safe-area spacing
- Touch targets
- Keyboard navigation
- Visible focus states
- Text scaling
- Reduced motion
- Colour contrast
- Long names, long plan titles, and overflowing content

## 9. Business behavior that must remain correct

### Client plan authority

When an active coach-assigned workout plan exists:

- The coach plan is the primary plan.
- The client sees only the coach-managed schedule in the main Plan experience.
- The plan is clearly marked read-only.
- Personal plan creation and editing controls are hidden from the primary flow.
- The client cannot modify the coach's recurring plan or schedule.
- The home and Start screens must resolve the correct scheduled occurrence for the selected date and coaching time zone.

When no active coach plan exists:

- The client may create, edit, and track a personal plan.

### Trainer plan management

Preserve and clearly distinguish:

- Loading a starter template
- Loading a saved trainer template
- Loading a recent client plan
- Saving a plan as a new template
- Editing the recurring plan
- Replacing an existing recurring plan
- Editing one scheduled occurrence
- Rescheduling one occurrence
- Giving one day off
- Restoring or returning an occurrence to the recurring plan

Publishing a replacement recurring plan must replace eligible future scheduled occurrences. It must preserve started or completed occurrences according to existing business rules.

### Existing capabilities

Do not regress:

- Passkey authentication
- Trainer roles
- Invitations and consent
- One-trainer-per-client enforcement
- Coaching relationship lifecycle
- Workout animations and exercise repository
- Diets
- Weekly check-ins
- Progress and personal history
- Fees
- Personal workouts and weigh-ins
- Offline and synchronization behavior

## 10. Specification quality requirements

The specification must include:

- User stories for client and trainer experiences
- Acceptance scenarios for each major screen and workflow
- Loading, empty, error, conflict, disabled, success, and offline states
- Responsive behavior
- Accessibility requirements
- Preservation of domain behavior
- Explicit out-of-scope items
- Measurable success criteria
- Visual acceptance criteria tied to the approved HTML and screenshot references
- Regression criteria for existing coaching workflows

Use `/speckit.clarify` to resolve material uncertainties one question at a time.

Create a UX requirements-quality checklist using `/speckit.checklist`. The checklist must assess whether the requirements are complete, unambiguous, measurable, responsive, accessible, and consistent. It must evaluate the requirements, not test the implementation.

## 11. Planning requirements

The implementation plan must identify:

- Existing components that can be retained
- Components that should be restyled
- Components that should be split or consolidated
- Shared design tokens
- Shared client and trainer primitives
- Route and layout boundaries
- State ownership
- API and domain boundaries that must remain unchanged
- CSS migration strategy
- Responsive implementation strategy
- Accessibility strategy
- Visual regression strategy
- Unit and integration test coverage
- Safe incremental rollout order

Use Graphify evidence when explaining component relationships and implementation scope.

The plan should favour incremental screen groups instead of one large rewrite.

## 12. Tasks and analysis gate

Generate dependency-ordered tasks with exact file paths.

Tasks must include:

- Baseline verification before UI changes
- Design-token foundation
- Shared responsive primitives
- Client screen migration
- Trainer screen migration
- State and interaction preservation
- Accessibility validation
- Automated tests
- Build verification
- Responsive screenshot capture
- Critical coaching-flow verification
- Graphify update after implementation

Run `/speckit.analyze` after generating tasks.

Do not implement while any critical inconsistency, uncovered requirement, constitution violation, or incomplete requirements checklist remains.

Present the specification analysis and remediation recommendations before implementation.

## 13. Implementation and verification

After the Spec Kit artifacts pass analysis, implement tasks in dependency order and mark completed tasks in `tasks.md`.

Do not commit, push, reset, discard, or overwrite unrelated changes.

Use:

`http://localhost:8080`

Never use:

`http://127.0.0.1:8080`

Verification must include:

- Existing automated tests
- New or updated tests for affected behavior
- Production build
- Client and trainer critical workflows
- All four required responsive viewports
- Comparison with the approved Claude HTML
- Loading, empty, error, disabled, and success states
- Keyboard and focus behavior
- No unexpected horizontal overflow
- No regression in plan publishing or workout scheduling

Use safe fixtures or dedicated test accounts. Do not end live coaching relationships, revoke real invitations, or destructively mutate user data merely for visual testing.

## 14. Convergence

After `/speckit.implement`, run `/speckit.converge`.

If convergence appends tasks:

1. Run `/speckit.implement` again.
2. Run `/speckit.converge` again.
3. Repeat until the implementation is reported as converged.

Finally run:

```bash
graphify update .
```

Then report:

- Spec Kit feature directory
- Specification and planning artifacts created
- Tasks completed
- Components and files changed
- Tests and build results
- Responsive viewports verified
- Remaining visual differences or known limitations
- Final convergence result

Begin with the constitution and Graphify architecture review. Do not begin application implementation before completing the Spec Kit quality gates.
