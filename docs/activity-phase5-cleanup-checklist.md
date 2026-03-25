# Activity Rename Phase 5 Cleanup Checklist

## Purpose

This checklist records the concrete removal steps for legacy `legacy-activity` naming after the compatibility window ended.

Phase 5 has been executed. Keep this document as an audit record and guardrail for future migrations.

## Entry Criteria (Satisfied)

- Legacy endpoint sunset date reached: **Tue, 30 Jun 2026 23:59:59 GMT**.
- Runtime logs showed no meaningful `/legacy-activities*` usage for at least two consecutive releases.
- README and API migration docs were published with deprecation and sunset notice.
- Frontend flows use `/activities*` only.

## Removal Scope (Completed)

1. API routes
- Remove legacy aliases under `src/app/api/legacy-activities/*`.
- Remove legacy aliases under `src/app/api/trips/[id]/legacy-activities*`.

2. API compatibility payloads
- Remove `legacy-activities` compatibility fields from response payloads.
- Keep only `activities` in chat execute and related responses.

3. Application naming
- Rename remaining symbols that still use `legacy-activity` for app-level concepts:
  - component names (`ActivityCard` only; remove legacy aliases)
  - prop names (`legacy-activity` -> `activity`) where safe
  - helper/type aliases that exist only for compatibility

4. Tests
- Remove tests that validate legacy legacy-activity aliases.
- Keep/expand tests that validate activities-only behavior.

5. Documentation
- Remove deprecation notes for legacy legacy-activity routes.
- Update structure sections to activities-only references.

## Execution Rules

- Execute in small PRs, one subsystem at a time.
- Keep each PR revertible.
- For each removal PR:
  - add/adjust tests first (red),
  - implement minimal removal (green),
  - refactor names and cleanup (refactor).

## Exit Criteria

- No `/legacy-activities*` route exists in the codebase. (completed)
- No deprecation helper usage remains for legacy-activity endpoints. (completed)
- `npm run test`, `npm run build`, and `prek run -a` pass. (completed in removal PRs; rerun as needed for follow-up slices)
