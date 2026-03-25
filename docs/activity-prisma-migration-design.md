# Activity Prisma Migration Design

## Purpose

Define a safe migration path from legacy Prisma naming (`LegacyActivity`, `legacyActivityId`) to activity-first naming while preserving data integrity and rollbackability.

This document is design-only. No schema or runtime implementation is performed in this phase.

## Current State

- Prisma model name: `LegacyActivity`
- Itinerary foreign key field: `legacyActivityId`
- SQL table/column naming aligns with legacy `LegacyActivity`
- App/API naming is already activity-first in most runtime paths

## Target State

- Prisma model name: `Activity`
- Itinerary foreign key field: `activityId`
- Database table/column naming:
  - Option A (safer): keep physical SQL names as-is and use Prisma `@@map` / `@map`
  - Option B (full rename): rename physical SQL table/columns in a controlled migration

Recommended default: Option A first, Option B later only if there is clear operational value.

## Migration Principles

- Keep each migration PR small and independently revertible.
- Never combine schema rename, data backfill, and app behavior changes in one PR.
- Keep one compatibility release where both old/new read paths are validated if physical DB rename is executed.
- Always validate against a production-like data snapshot before rollout.

## Phased Plan

### Phase A: Prisma Logical Rename (No Physical DB Rename)

1. Rename Prisma model `LegacyActivity` -> `Activity`.
2. Rename relation fields (`legacyActivityId` -> `activityId`) in schema.
3. Use `@@map("LegacyActivity")` and `@map("legacyActivityId")` to keep DB objects unchanged.
4. Regenerate Prisma Client and update compile-time call sites.

Acceptance:
- Generated Prisma client uses activity-first names.
- SQL schema stays unchanged.
- App behavior remains unchanged.

### Phase B: Optional Physical DB Rename (Only If Needed)

1. Add SQL migration to create/rename `LegacyActivity` -> `Activity`.
2. Rename foreign key columns/indexes (`legacyActivityId` -> `activityId`) and constraints.
3. Update Prisma mapping to remove now-unnecessary `@map`/`@@map`.
4. Re-run integration tests and data consistency checks.

Acceptance:
- No legacy SQL table/column names remain.
- Query plans and indexes remain equivalent.
- No data loss or orphaned itinerary rows.

## Rollback Strategy

### Rollback for Phase A

- Revert schema/model rename commit.
- Regenerate Prisma client to legacy names.
- No DB rollback required (physical schema unchanged).

### Rollback for Phase B

- Prepare reverse SQL migration before rollout.
- If failure occurs:
  - stop writes,
  - run reverse migration,
  - redeploy previous app version,
  - run referential integrity checks.

Rollback exit checks:
- row counts match pre-migration snapshot,
- foreign keys valid,
- read/write smoke tests pass.

## Test and Verification Plan

- Unit tests:
  - Prisma query wrappers and serializers under activity naming.
- Integration tests:
  - CRUD for activities,
  - itinerary add/update/delete with `activityId`,
  - chat execute flows that persist activities.
- Migration validation:
  - row-count parity (`Activity`/`ItineraryItem`),
  - nullability and FK checks,
  - index existence and cardinality checks.

## Risks and Mitigations

- Risk: implicit raw SQL references still use `LegacyActivity`.
  - Mitigation: run codebase scan for raw SQL/table names before Phase B.
- Risk: relation rename breaks serializers or API payload builders.
  - Mitigation: add compile-time checks and integration tests before rollout.
- Risk: long migration lock on large datasets.
  - Mitigation: prefer Phase A mapping-first approach; schedule Phase B in low-traffic window.

## Decision Record

- Decision: proceed with Phase A (logical rename with `@map`/`@@map`) first.
- Decision owner: maintainers of API + persistence boundaries.
- Revisit Phase B only after observing sustained operational need.
