# AGENTS.md

This file provides guidance for AI coding agents working in this repository.

## Project Overview

**trip-planner** is an AI-powered collaborative trip planning application built with Next.js. It uses OpenAI GPT-4o-mini to generate personalized restaurant and place proposals based on traveler preferences, supports approve/reject voting, auto-builds a day-by-day itinerary, and renders approved locations on an interactive OpenStreetMap map.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router, TypeScript) |
| Styling | Tailwind CSS |
| Database | SQLite via Prisma ORM with `better-sqlite3` adapter |
| LLM | OpenAI `gpt-4o-mini` (`src/lib/llm.ts`) |
| Map | Leaflet / react-leaflet / OpenStreetMap |

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

```
OPENAI_API_KEY=sk-...   # Required – OpenAI API key
DATABASE_URL="file:./dev.db"  # SQLite database path (default: ./dev.db)
```

## Development Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Set OPENAI_API_KEY in .env

# Apply database migrations
npx prisma migrate dev

# Start development server (http://localhost:3000)
npm run dev
```

## Key Commands

```bash
npm run dev     # Start Next.js development server with hot reload
npm run build   # Type-check and produce optimized production build
npm run start   # Run production server (requires npm run build first)
npm run lint    # Run ESLint (next/core-web-vitals + next/typescript rules)
```

There are currently no automated tests in this project. When adding tests, use a framework compatible with Next.js (e.g., Jest + `@testing-library/react` or Vitest).

## Architecture & Conventions

- **App Router**: All pages live under `src/app/`. API routes use `route.ts` files alongside pages.
- **Server Components by default**: Only mark components `"use client"` when browser APIs (e.g., `useState`, `useEffect`, Leaflet) are required. `MapView.tsx` is a notable client-only component loaded via `next/dynamic`.
- **Prisma singleton**: Always import the Prisma client from `src/lib/prisma.ts` – never instantiate `PrismaClient` directly.
- **LLM calls**: All OpenAI interactions are encapsulated in `src/lib/llm.ts`. The `generateProposals()` function accepts a city name and traveler preferences, and returns structured proposal objects.
- **Tailwind CSS**: All styling uses Tailwind utility classes. Do not add external CSS files; extend `tailwind.config.ts` if needed.
- **TypeScript**: Strict mode is enabled. Avoid `any`; define interfaces or types for all data shapes.
- **Path alias**: `@/*` resolves to `./src/*` (configured in `tsconfig.json`).
- **Database migrations**: Use `npx prisma migrate dev` during development and `npx prisma migrate deploy` for production schema changes. Never edit migration files directly.
- **ESLint**: Run `npm run lint` before committing. The project follows Next.js core web vitals and TypeScript rules.
