# transforma Studio design prototype

An interactive design exploration of the agreed trainer–client coaching MVP. This is a separate prototype; the existing frontend and backend are unchanged.

## Direction

An athletic coaching workspace with a deep ink sidebar, crisp white working surfaces, bright green primary actions, and restrained earthy accents for meal plans and fees. Geist typography, clear hierarchy, tabular metrics, initials-based client avatars, and generous spacing keep attention on people and their next action.

## Explore

Start in Trainer → Overview. Open Aarav to explore Workouts, Diet, Progress, and Fees. Assign a template with a personal note, then use Preview client view or the Trainer / Client switch. Complete a sample workout, update a weekly check-in, and return to the trainer to review the result. Fees remain unpaid after sample checkout until the trainer explicitly confirms receipt. Corrections preserve sample change history.

Invite client creates a nonfunctional example-domain link and offers an explicit sample acceptance action. A new sample client starts with empty plans. Assign their workout and diet from the trainer view. Reset restores the original six fictional clients.

## Boundaries

- Fictional sample data and a fixed preview date of 7 September 2026.
- State lasts only for this page session. Refresh or Reset clears edits.
- Role switching demonstrates navigation, not authentication or authorization.
- No real invitations, WhatsApp messages, payments, or health-data transfers occur.
- Checkout is a labeled simulation; no payment provider or trainer phone number is connected.
- Workout/diet assignment demonstrates template selection and personal notes. Full exercise editing, scheduling/rescheduling, account management, and production persistence remain implementation work.
- Personal routine history and strength trends are represented by sample workouts and weight charts. The existing progression engine is not connected.
- The responsive layouts and keyboard interactions use the installed accessible primitives. Mobile browser validation covered 320px and 390px viewports, navigation, client search, diet presentation, workout logging, check-in submission and trainer response, and unpaid status after sample checkout. A narrow-screen tab overflow was corrected. Physical-device Safari/Chrome testing remains outstanding.

## Source and verification

TypeScript validation and the production build cover the prototype source. A downloadable source archive contains the authored source, generated starter components, manifest, and dependency lockfile; credentials and build output are excluded. This prototype is distributed under the repository's AGPL-3.0 terms.
