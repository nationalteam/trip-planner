# AGENTS.md

This file provides guidance for AI coding agents working in this repository.

## Communication

- Documentation MUST be written in clear, standard language.
- Ask at most one clarifying question at a time.
- Do not ask a clarifying question when a reasonable assumption allows safe progress.
- When presenting multiple options, enumerate them explicitly.

## Engineering Principles

- Language MUST be concise and precise.
- Design and structure MUST NOT introduce unnecessary complexity.
- Scope and responsibility boundaries MUST be explicit.
- Each document MUST have a single, well-defined purpose.
- Rules MUST be stated in enforceable terms and avoid ambiguity.
- Foundational rules MUST NOT be duplicated across documents.
- Do not assume external APIs; verify behavior or constraints when uncertain.

## Architectural Constraints

- Architectural boundaries defined by the project MUST NOT be violated.
- New dependencies MUST NOT be introduced without explicit justification.
- New abstractions MUST be introduced only to solve a concrete, current problem.
- Abstract interfaces MUST NOT be added for speculative future use alone.

## Project Overview

**trip-planner** is an AI-powered collaborative trip planning application built with Next.js. It generates personalized restaurant and place proposals from traveler preferences, supports approve/reject voting, automatically builds a day-by-day itinerary, and renders approved locations on an interactive OpenStreetMap map.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript) |
| Styling | Tailwind CSS |
| Database | SQLite via Prisma ORM with `better-sqlite3` adapter |
| LLM | OpenAI `gpt-5-mini` by default (`src/lib/llm.ts`) |
| Map | Leaflet / react-leaflet / OpenStreetMap |
| Testing | Jest + Testing Library |

## Repository Structure

```
src/
  app/
    page.tsx                          # Home – list & create trips
    layout.tsx                        # Root layout with navigation bar
    globals.css                       # Global styles
    trips/[id]/
      page.tsx                        # Trip detail (Proposals / Itinerary / Map tabs)
      preferences/page.tsx            # Per-traveler preference management
    api/
      trips/route.ts                  # GET /api/trips, POST /api/trips
      trips/[id]/route.ts             # GET /api/trips/[id]
      trips/[id]/proposals/route.ts   # GET & POST (LLM generation)
      trips/[id]/itinerary/route.ts   # GET itinerary items
      proposals/[id]/approve/route.ts # POST – approve & schedule
      proposals/[id]/reject/route.ts  # POST – reject
      users/route.ts                  # GET & POST users
      users/[id]/preferences/route.ts # GET & POST preferences
  components/
    ProposalCard.tsx      # Proposal card with approve/reject buttons
    ItineraryView.tsx     # Day-by-day itinerary grouped by time block
    MapView.tsx           # Leaflet map (client-only, dynamically imported)
    TripCard.tsx          # Trip summary card shown on home page
  lib/
    prisma.ts             # Prisma client singleton (better-sqlite3 adapter)
    llm.ts                # OpenAI proposal generation logic
prisma/
  schema.prisma           # Data model definitions
  migrations/             # Prisma migration history
```

## Data Model

| Model | Key Fields |
|---|---|
| `Trip` | `id`, `name`, `cities` (JSON-serialized `string[]`, e.g. `'["Paris","Tokyo"]'`), `createdAt` |
| `User` | `id`, `name` |
| `Preference` | `id`, `userId`, `likes`, `dislikes`, `budget` |
| `Proposal` | `id`, `tripId`, `type` (`food`/`place`), `title`, `description`, `reason`, `lat`, `lng`, `city`, `suggestedTime`, `durationMinutes`, `status` (`pending`/`approved`/`rejected`) |
| `ItineraryItem` | `id`, `tripId`, `proposalId`, `day`, `timeBlock` (`morning`/`afternoon`/`dinner`) |

## Environment Variables

Defined in `.env` (copy from `.env.example`):

```env
OPENAI_API_KEY=sk-...                    # Required for standard OpenAI
OPENAI_MODEL=gpt-5-mini                  # Optional model override
DATABASE_URL="file:./dev.db"             # SQLite database path

# Optional: Azure OpenAI mode (used when AZURE_OPENAI_API_KEY is present)
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT=...
AZURE_OPENAI_API_VERSION=2025-01-01-preview
```

## Development Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Set OPENAI_API_KEY (or AZURE_OPENAI_* variables)

# Apply database migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# Start development server (http://localhost:9527)
npm run dev
```

## Key Commands

```bash
npm run dev      # Start Next.js development server with hot reload
npm run build    # Type-check and produce optimized production build
npm run start    # Run production server (requires npm run build first)
npm run lint     # Run ESLint (next/core-web-vitals + next/typescript rules)
npm run test     # Run Jest test suite
npm run test:ci  # Run Jest in CI mode with coverage
just ci          # Run CI-equivalent checks locally
```

## Code Quality Checks

Install `prek`:

```bash
# Using uv (recommended)
uv tool install prek
```

- If `.pre-commit-config.yaml` exists and the task changes code or configuration files, all changes MUST pass `prek run -a` before completion.
- If `prek` is unavailable, `pre-commit run -a` MUST be used instead.
- If checks fail, the failure MUST be reported explicitly.

## Architecture & Conventions

- **App Router**: All pages live under `src/app/`. API routes use `route.ts` files alongside pages.
- **Server Components by default**: Only mark components `"use client"` when browser APIs are required. `MapView.tsx` is a client-only component loaded via `next/dynamic`.
- **Prisma singleton**: Always import the Prisma client from `src/lib/prisma.ts`. Never instantiate `PrismaClient` directly.
- **LLM calls**: Keep OpenAI interactions in `src/lib/llm.ts`. `generateProposals()` is the single proposal-generation entry point.
- **Tailwind CSS**: Use Tailwind utility classes. Do not add external CSS files.
- **TypeScript**: Strict mode is enabled. Avoid `any`; define interfaces or types for all data shapes.
- **Path alias**: `@/*` resolves to `./src/*` (configured in `tsconfig.json`).
- **Database migrations**: Use `npx prisma migrate dev` in development and `npx prisma migrate deploy` in production. Never edit migration files directly.
- **Prisma in CI**: In clean environments, run `npx prisma generate` before lint/test/build.

## GOTCHA and TASTE Auto-Update Workflow

Follow these rules every session:

1. Session start checks:
   - Check whether `GOTCHA.md` and `TASTE.md` exist in the project root.
   - If present, read relevant entries before proposing fixes or recommendations.
2. Auto-create `GOTCHA.md` on mistakes:
   - If an implementation/debugging mistake happens and `GOTCHA.md` does not exist, create it immediately.
   - Add a new entry in the same session describing only non-obvious, experience-derived pitfalls.
   - Keep each entry actionable: symptom, root cause, and prevention rule.
3. Auto-create or update `TASTE.md` on stable preferences:
   - If the user expresses a reusable preference and `TASTE.md` does not exist, create it immediately.
   - Add or update entries in the same session with concrete decision rules.
   - Store only stable, repeatable preferences (not one-off requests).
4. Scope and quality:
   - Do not duplicate foundational rules already defined in `AGENTS.md`.
   - Keep entries concise and enforceable.
