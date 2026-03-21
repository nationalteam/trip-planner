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
