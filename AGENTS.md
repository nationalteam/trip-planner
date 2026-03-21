# Repository Guidelines

## Project Structure & Module Organization
- Main code lives in `src/`.
- Routes and API handlers use Next.js App Router under `src/app/` (for example `src/app/api/trips/[id]/proposals/route.ts`).
- Reusable UI components are in `src/components/`.
- Shared infrastructure code is in `src/lib/` (`prisma.ts`, `llm.ts`).
- Database schema and migrations are in `prisma/`.
- Tests are in `src/__tests__/`.
- Static docs and templates live in `docs/`.

## Build, Test, and Development Commands
- `npm run dev`: start local app on `http://localhost:9527`.
- `npm run build`: production build with type checks.
- `npm run start`: run built app on port `9527`.
- `npm run lint`: run Next.js ESLint rules.
- `npm run test`: run Jest tests.
- `npm run test:ci`: run Jest in CI mode with coverage.
- `just ci`: run CI-equivalent local checks.
- If Prisma types are missing in clean environments, run `npx prisma generate` before build/test.

## Coding Style & Naming Conventions
- Language: TypeScript (strict mode), avoid `any`.
- Components: `PascalCase` file names (for example `TripCard.tsx`).
- Route handlers: `route.ts` inside the matching App Router folder.
- Prefer server components; add `"use client"` only when browser APIs are required.
- Use Tailwind utilities; do not introduce extra CSS files unless necessary.

## Testing Guidelines
- Framework: Jest + Testing Library (`jest.config.js`, `jest.setup.ts`).
- Place tests under `src/__tests__/` with `*.test.ts` or `*.test.tsx` naming.
- Cover API route behavior and key UI states.
- When changing code/config and `.pre-commit-config.yaml` exists, run `prek run -a` (fallback: `pre-commit run -a`).

## Commit & Pull Request Guidelines
- Follow Conventional Commit style seen in history (`feat:`, `fix:`, `docs:`, `test:`).
- Keep commit messages scoped and imperative; avoid placeholders like `Initial plan`.
- PRs should include: summary, impacted paths, test evidence (`npm run test`, `npm run lint`), and screenshots for UI changes.
- Link related issue/task IDs when applicable.

## Security & Configuration Tips
- Keep secrets in `.env`; never commit API keys.
- Use `DATABASE_URL="file:./dev.db"` format for SQLite.
- If using Azure OpenAI, `AZURE_OPENAI_ENDPOINT` is required when Azure key is set; deployment name can remain optional in local/dev.
