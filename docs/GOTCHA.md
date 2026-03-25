# GOTCHA

## CI build fails with `@prisma/client` missing `PrismaClient`

- Context:
  GitHub Actions runs `npm ci` and then `npm run build` on a clean runner.
- Symptom:
  `next build` fails during type checking with:
  `Module '"@prisma/client"' has no exported member 'PrismaClient'.`
- Root cause:
  Prisma Client was not generated in CI before TypeScript checks.
  On a clean environment, `@prisma/client` type exports depend on generated artifacts.
- Fix:
  Add an explicit CI step before lint/test/build:
  `npx prisma generate`
- Preventive rule:
  Any clean-environment pipeline that compiles TypeScript against Prisma models must run `prisma generate` after dependency installation.

## OpenAI `gpt-5-mini` rejects custom `temperature`

- Context:
  LegacyActivity generation uses OpenAI Chat Completions in `src/lib/llm.ts`.
- Symptom:
  API returns HTTP 400 with:
  `Unsupported value: 'temperature' does not support 0.7 with this model. Only the default (1) value is supported.`
- Root cause:
  The request explicitly set `temperature: 0.7` while the selected model (`gpt-5-mini`) only accepts the default temperature behavior.
- Fix:
  Remove the explicit `temperature` parameter for this call.
- Preventive rule:
  For GPT-5-series models, do not set `temperature` unless model docs explicitly confirm non-default values are supported.

## SQLite `DATABASE_URL` format and path base mismatch can silently create wrong DB target

- Context:
  API runtime uses `@prisma/adapter-better-sqlite3` while schema/migrations use `prisma.config.ts`.
- Symptom:
  `POST /api/trips` fails with `P2021` (`main.Trip` does not exist) even though migrations exist.
- Root cause:
  `DATABASE_URL` was set to plain `./dev.db` (invalid for Prisma CLI), and path handling between runtime/CLI can diverge if `file:` URLs are not normalized consistently.
- Fix:
  Use a valid SQLite URL (`DATABASE_URL="file:./dev.db"`), run `npx prisma migrate dev`, and normalize runtime adapter path from `DATABASE_URL` before creating `PrismaClient`.
- Preventive rule:
  Always keep `DATABASE_URL` in Prisma URL form (`file:...`) and verify runtime + migration commands point to the same physical DB file.

## Lat/Lng swap can remain undetected when both values are still in valid ranges

- Context:
  Map marker placement and legacy-activity persistence previously normalized coordinates only when one orientation was out of range.
- Symptom:
  Some places still appear in the wrong region even after "swap obvious lat/lng" handling, especially for cities where both `(lat, lng)` and `(lng, lat)` are numerically valid (for example around Europe/North America).
- Root cause:
  Validation based only on coordinate range cannot detect ambiguous swaps; both orders can pass bounds checks.
- Fix:
  Add batch normalization with anchor/reference centroid heuristics on API writes, using existing trip legacy-activities as anchors for ambiguous points. Note that ambiguous swaps without such contextual anchors will not be corrected at render time.
- Preventive rule:
  Coordinate normalization must handle three cases explicitly: invalid numbers, obvious swaps, and ambiguous swaps that require contextual anchors.

## Next dev server can keep stale Prisma Client after schema change

- Context:
  Added a new Prisma field and generated client while `next dev` was already running.
- Symptom:
  API returns 500 with Prisma validation error like `Unknown argument <newField>` even after `npx prisma generate`.
- Root cause:
  The running Next.js dev process may still use the previously loaded Prisma Client build.
- Fix:
  Restart `next dev` after schema + client generation changes.
- Preventive rule:
  Any time Prisma schema fields are added/removed, run `npx prisma generate` and restart the dev server before manual API/UI verification.

## `gh pr create --body` can break when Markdown backticks are passed in double quotes

- Context:
  Creating a PR from shell with `gh pr create --body "..."` and Markdown inline code.
- Symptom:
  Shell errors like `command not found` for words inside backticks (for example `map-legacy-activities`), and PR creation fails.
- Root cause:
  Backticks inside double-quoted shell strings trigger command substitution before `gh` receives the body text.
- Fix:
  Use `--body-file` (or single-quoted safe text) to avoid shell interpolation.
- Preventive rule:
  For multiline PR bodies containing Markdown backticks, always write to a temp file and pass `--body-file`.

## SQLite migration can partially apply before failing on unsupported `ALTER INDEX ... RENAME`

- Context:
  Hard-cut rename from `LegacyActivity`/`legacyActivityId` to `Activity`/`activityId` in a Prisma SQLite migration.
- Symptom:
  `prisma migrate deploy` fails with `near "INDEX": syntax error`, but schema is already partially changed (table/column renamed).
- Root cause:
  SQLite in this environment does not support `ALTER INDEX ... RENAME TO ...`; earlier statements in the same migration had already executed.
- Fix:
  Remove index-rename statements from the migration SQL, then reconcile migration state with `prisma migrate resolve --applied <migration_name>`.
- Preventive rule:
  For SQLite rename migrations, avoid index renames; keep old index names or recreate indexes via explicit `DROP INDEX` + `CREATE INDEX` in a verified compatible SQL script.

## Historical migrations must keep original naming even after domain rename

- Context:
  App/runtime naming converged from `proposal` to `activity` after hard-cut migration.
- Symptom:
  Global text replacement attempts can touch old `prisma/migrations/*` SQL and make migration history inconsistent with what actually ran.
- Root cause:
  Historical migration files are immutable records, not active domain code.
- Fix:
  Keep legacy names in historical migration SQL unchanged and only rename current schema/runtime code.
- Preventive rule:
  During terminology refactors, exclude `prisma/migrations/*` and keep prior migration snapshots verbatim.
