# Activity Rename Phase 5 Cleanup Checklist

## Purpose

This checklist defines the concrete removal steps for legacy `proposal` naming after the compatibility window ends.

Do not start removal until all entry criteria pass.

## Entry Criteria

- Legacy endpoint sunset date reached: **Tue, 30 Jun 2026 23:59:59 GMT**.
- Runtime logs show no meaningful `/proposals*` usage for at least two consecutive releases.
- README and API migration docs have been published with deprecation and sunset notice.
- Frontend flows use `/activities*` only.

## Removal Scope

1. API routes:
- Remove legacy aliases under `src/app/api/proposals/*`.
- Remove legacy aliases under `src/app/api/trips/[id]/proposals*`.

2. API compatibility payloads:
- Remove `proposals` compatibility fields from response payloads.
- Keep only `activities` in chat execute and related responses.

3. Application naming:
- Rename remaining symbols that still use `proposal` for app-level concepts:
  - component names (`ProposalCard` -> `ActivityCard`)
  - prop names (`proposal` -> `activity`) where safe
  - helper/type aliases that exist only for compatibility

4. Tests:
- Remove tests that validate legacy proposal aliases.
- Keep/expand tests that validate activities-only behavior.

5. Documentation:
- Remove deprecation notes for legacy proposal routes.
- Update structure sections to activities-only references.

## Execution Rules

- Execute in small PRs, one subsystem at a time.
- Keep each PR revertible.
- For each removal PR:
  - add/adjust tests first (red),
  - implement minimal removal (green),
  - refactor names and cleanup (refactor).

## Exit Criteria

- No `/proposals*` route exists in the codebase.
- No deprecation helper usage remains for proposal endpoints.
- `npm run test`, `npm run build`, and `prek run -a` pass.
