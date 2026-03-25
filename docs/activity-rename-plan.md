# Activity Rename Migration Plan

## 1. Purpose

This document defines a phased migration from `proposal` naming to `activity` naming.

The plan is designed to:
- avoid a single high-risk PR,
- preserve API compatibility during migration,
- keep implementation decisions explicit and enforceable.

This plan is the single source of truth for migration sequencing.

## 2. Goals and Non-goals

### Goals
- Adopt `activity` as the primary public term in API and UI.
- Keep existing clients working for one compatibility version.
- Complete migration with measurable acceptance criteria per phase.

### Non-goals
- Do not rename physical SQLite table/column names in this migration.
- Do not introduce new dependencies for migration only.
- Do not change business behavior unrelated to naming.

## 3. Current State Inventory

The repository currently uses `proposal` broadly across:
- Prisma model and relation fields (`Proposal`, `proposalId`),
- API paths (`/api/proposals/*`, `/api/trips/[id]/proposals/*`),
- chat action contracts (`proposal.generate`, `proposal.create`, ...),
- UI labels and component types,
- tests and fixtures.

Because naming spans storage, APIs, and UI, migration must be phased.

## 4. Compatibility Policy

- Compatibility window: one released version.
- New primary APIs: `/api/activities/*` and `/api/trips/[id]/activities/*`.
- Legacy APIs remain available during the compatibility window:
  - `/api/proposals/*`
  - `/api/trips/[id]/proposals/*`
- Legacy routes must remain behaviorally equivalent to activity routes.
- Legacy endpoints must be marked deprecated in docs and responses.
- Legacy routes are removed only after all cutover checklist items pass.

## 5. Migration Phases

## Phase 1: Documentation Baseline

Deliverables:
- This plan document.
- Changelog entry referencing the migration plan.

Acceptance criteria:
- Plan is decision-complete.
- Future phases can be implemented without redefining migration policy.

## Phase 2: Domain Naming in Application Layer

Scope:
- Move TypeScript domain naming from proposal-centric to activity-centric.
- Keep existing physical DB names via Prisma mapping (`@map`, `@@map`) where needed.

Required decisions:
- External/public types use `Activity` and `activityId`.
- Internal compatibility aliases may exist only during migration window.

Acceptance criteria:
- Core services compile with activity-centric naming.
- Existing behavior remains unchanged.

## Phase 3: API Dual-Route Support

Scope:
- Add activities route tree.
- Keep proposals route tree as compatibility alias.

Acceptance criteria:
- New and legacy routes return equivalent status codes and payload semantics.
- Deprecation signal is present for legacy routes.

## Phase 4: UI and Docs Cutover

Scope:
- Replace user-facing wording from proposal(s) to activity/activities.
- Update README and API docs to activity-first wording.

Acceptance criteria:
- No proposal wording remains in user-visible product surfaces unless explicitly marked legacy.

## Phase 5: Compatibility Removal

Scope:
- Remove legacy proposals routes and compatibility aliases.

Acceptance criteria:
- Cutover checklist passes in full.
- Changelog includes explicit breaking-change note.

## 6. Test Strategy (TDD Required)

For each non-trivial phase:
- Follow red -> green -> refactor strictly.
- Add failing tests first.
- Implement minimal behavior to pass.
- Refactor without behavior change.

Minimum required scenarios:
- Activities routes and proposals legacy routes are equivalent during compatibility window.
- Approve/reject and itinerary linking remain correct under new naming.
- Chat action validation and execution remain deterministic.
- UI renders activity naming consistently.

Quality gates per implementation PR:
- `npm run test`
- `npm run lint`
- `prek run -a` (fallback: `pre-commit run -a`)

## 7. Rollback Strategy

- Each phase must be independently revertible.
- If dual-route behavior diverges, revert the phase introducing divergence.
- Do not proceed to a later phase when current phase acceptance criteria fail.

## 8. Cutover Checklist

All items must be true before removing legacy names:
- No active clients depend on `/proposals*`.
- Docs point to activity routes only.
- Observability/logging confirms no legacy route traffic above agreed threshold.
- Regression suite passes with legacy aliases disabled.

## 9. Ownership and Execution Rules

- Implement migration in small PRs only.
- Each PR must reference this document and the exact phase.
- Any deviation from this plan requires updating this document first.
