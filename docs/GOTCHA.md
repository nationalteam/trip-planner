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
  Proposal generation uses OpenAI Chat Completions in `src/lib/llm.ts`.
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
  Map marker placement and proposal persistence previously normalized coordinates only when one orientation was out of range.
- Symptom:
  Some places still appear in the wrong region even after "swap obvious lat/lng" handling, especially for cities where both `(lat, lng)` and `(lng, lat)` are numerically valid (for example around Europe/North America).
- Root cause:
  Validation based only on coordinate range cannot detect ambiguous swaps; both orders can pass bounds checks.
- Fix:
  Add batch normalization with anchor/reference centroid heuristics on API writes, using existing trip proposals as anchors for ambiguous points. Note that ambiguous swaps without such contextual anchors will not be corrected at render time.
- Preventive rule:
  Coordinate normalization must handle three cases explicitly: invalid numbers, obvious swaps, and ambiguous swaps that require contextual anchors.
