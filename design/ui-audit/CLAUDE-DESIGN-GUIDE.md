# transforma responsive redesign with Claude Design

## Use Claude Design, not a normal chat

Open [claude.ai/design](https://claude.ai/design) or choose **Design** in Claude Desktop.
Claude Design is a canvas-based product for designs and interactive prototypes. It lets you
iterate through chat, edit on the canvas, and leave inline comments on specific elements.

It is currently a beta feature on Pro, Max, Team, and Enterprise plans. Enterprise admins may
need to enable it. If Design is unavailable, use a normal Claude conversation and explicitly ask
for an interactive React artifact, but treat that as a fallback.

## Context files

The screenshots are split into two upload batches so each stays below Claude's 20-file chat limit:

- `current-mobile/client/`: 14 client and personal-app screenshots
- `current-mobile/trainer/`: 15 trainer screenshots
- `current-web/`: 8 representative desktop web screenshots

All screenshots use a 390×844 CSS-pixel viewport and are exported as 1170×2532 PNGs.

## Recommended workflow

1. Create one Claude Design project named **transforma responsive redesign**.
2. Paste the project brief below.
3. Upload all 14 images from `current-mobile/client/`.
4. Ask for three visual directions applied to only these representative screens:
   - Client Home
   - Coach-assigned Plan
   - Active/Start Workout
5. Compare the three directions and choose one. Do not redesign every screen yet.
6. Ask Claude to formalize the chosen direction into design tokens and reusable components.
7. Upload all 15 images from `current-mobile/trainer/` in the same project.
8. Ask Claude to apply the approved system to the trainer Client Overview, Client Workspace,
   Workout Plan Editor, and Schedule Manager first.
9. Upload the 8 images from `current-web/` and ask Claude to define intentional responsive reflow
   between the approved mobile system and the representative desktop layouts.
10. Use inline comments for targeted corrections. Use chat only for changes affecting the whole
   system.
11. After the representative screens are approved, ask Claude to complete the remaining screens
    and include loading, empty, saving, error, disabled, destructive-confirmation, and offline states.
12. Request an interactive prototype and a developer handoff with tokens, component states,
    dimensions, and behaviour notes. Do not ask it to rewrite the production repository yet.

## Project brief to paste into Claude Design

Design a cohesive mobile product experience for **transforma**, a privacy-first fitness and
trainer-client coaching application.

The attached images show the current production UI. Treat them as workflow and content references,
not as a visual style to preserve. Keep all existing capabilities and information, but improve the
hierarchy, navigation, density, clarity, accessibility, and brand consistency.

### Product and audience

transforma connects two roles:

- A client follows assigned workouts, records sets, sees exercise demonstrations, tracks body
  weight and progress, completes check-ins, views diet guidance and fees, and contacts a trainer.
- A trainer manages clients, creates reusable workout templates, publishes recurring plans,
  adjusts individual scheduled workouts, gives or restores days off, reviews progress and
  check-ins, assigns diets, and manages fees.

The product should feel focused, motivating, trustworthy, and professional. Avoid aggressive
bodybuilding imagery and generic corporate dashboards.

### Critical product rules

- A coach-assigned workout plan is read-only for the client.
- When a coach plan is active, personal plan-building controls are hidden. The client sees and
  follows only the coach schedule.
- Without an active coach plan, the client can create and track a personal plan.
- Trainers can edit the recurring plan or adjust one future workout without changing the recurring
  plan.
- Individual future workouts can be edited, rescheduled, changed to a day off, restored, or returned
  to the recurring prescription.
- Started and completed workouts are locked.
- Clearly distinguish scheduled, customized, rescheduled, day-off, in-progress, completed, draft,
  published, saving, and error states.
- Never hide critical trainer actions behind gestures alone.
- Destructive actions require confirmation.

### Technical constraints

- Mobile-first responsive design. Mobile is the primary experience, but the same application must
  also work well in tablet and desktop web browsers.
- Design and validate at 390×844 and 360×800 for mobile, 768×1024 for tablet, and 1440×900 for
  desktop web.
- Responsive layouts should reflow intentionally instead of simply stretching mobile screens.
- Desktop may use additional horizontal space, denser grids, persistent contextual navigation, and
  side-by-side editing where those patterns make the trainer workflow easier.
- React 19 single-page application using JavaScript/JSX.
- Vite 8, React Router 7 with hash routes, and Zustand 5.
- Installable PWA and Capacitor 7 mobile wrapper.
- Custom React components and ordinary CSS with CSS variables.
- No Tailwind, Material UI, Bootstrap, Chakra, or other component library.
- Custom stroke-based SVG icon set.
- Bottom navigation is the primary mobile navigation model.
- Respect iOS and Android safe areas.
- Minimum interactive target: 44×44 CSS pixels.
- Forms must remain usable with the mobile keyboard open.
- Long workout plans and schedules must be easy to scan and edit.
- Support accessible contrast, visible focus states, reduced motion, and variable content lengths.

### Existing identity

- Product name: **transforma**. “Transforma” is repository lineage, not the user-facing brand.
- Current description: **Coaching, workouts, and progress.**
- Current palette: electric lime `#B9F34B`, deep forest `#13231A`, black `#000000`, warm off-white
  `#F4F6F1`, and success green `#30D158`.
- The current personal interface is dark and iOS-inspired.
- The current trainer interface is light with forest and lime accents.
- These currently feel like two different products. Unify them through typography, colour logic,
  spacing, components, icons, feedback, and navigation while allowing role-appropriate density.

### Visual-direction task

Create **three genuinely distinct visual directions** for the same three representative screens.
Show the mobile version of all three directions first, then include one representative desktop web
layout for each direction to demonstrate how its responsive system scales:

1. Client Home with today's coach status and weekly strip
2. Coach-assigned Plan with schedule and read-only state
3. Start/Active Workout with exercise details and set tracking

For each direction, provide:

- A short concept name and rationale
- Colour roles, not just a colour list
- Typography choices and hierarchy
- Spacing, radius, border, and elevation approach
- Navigation and primary-action treatment
- Status and feedback treatment
- How it will extend to the trainer experience

Avoid generic AI-generated aesthetics: purple gradients, excessive floating cards, oversized empty
space, glass effects without purpose, interchangeable dashboard layouts, and decorative charts.
Typography and visual motifs should have fitness-specific character without compromising workout
readability.

Do not generate production code yet. Do not remove functionality. Wait for a direction to be chosen
before redesigning all screens.

## Useful iteration prompts

### Compare directions

Compare these directions against one-handed use during a workout, information density for a busy
trainer, accessibility, and feasibility in our existing custom React/CSS system. Recommend one and
name its trade-offs.

### Formalize the chosen system

Turn the selected direction into a mobile-first responsive design system. Define semantic colour tokens, type scale,
spacing scale, radii, borders/elevation, icon rules, motion rules, and component variants for buttons,
fields, cards, list rows, status badges, navigation, bottom sheets, dialogs, timers, and exercise media.
Include light and dark behaviour where appropriate, plus breakpoint and reflow rules for mobile,
tablet, and desktop web.

### Apply it to trainer screens

Apply the approved system to the attached trainer screens. Start with Client Overview, Client
Workspace, Workout Plan Editor, and Schedule Manager. Preserve every existing action, reduce vertical
sprawl, keep dangerous actions explicit, and make recurring-plan actions visually distinct from
one-day schedule adjustments.

### Audit before handoff

Audit every completed screen at 390×844, 360×800, 768×1024, and 1440×900. Check text wrapping,
keyboard obstruction, safe areas, 44×44 targets, contrast, keyboard focus, scroll position,
navigation behaviour, bottom-navigation overlap, long names, empty/loading/error/saving states, and
destructive confirmations. List unresolved issues on the canvas.

## Screenshot manifest

### Client and personal UI

1. Personal Home
2. Coach-assigned Plan
3. Start Workout
4. Personal Stats, top
5. Personal Stats, lower content
6. Exercise Library
7. Exercise Details sheet
8. Settings
9. Coaching Overview
10. Client Workspace, top
11. Client Workspace, schedule
12. Weekly Check-in
13. Client Progress
14. Client Fees

### Trainer UI

1. Client Overview
2. Invitations
3. Studio Settings
4. Client Workspace, top
5. Client Workspace, schedule
6. Current Workout Plan
7. Recurring Plan Editor, sources
8. Recurring Plan Editor, training days
9. Schedule Manager
10. Manage One Workout
11. One-day Workout Editor
12. Diet Plan
13. Check-in Review
14. Client Progress
15. Fee Management

### Representative desktop web UI

1. Client Personal Home
2. Client Coach-assigned Plan
3. Client Coaching Workspace
4. Trainer Client Overview
5. Trainer Client Workspace
6. Trainer Workout Plan
7. Trainer Recurring Plan Editor
8. Trainer Schedule Manager
