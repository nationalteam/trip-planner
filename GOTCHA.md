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
