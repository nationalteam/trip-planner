# trip-planner

AI-powered collaborative trip planning with proposal voting, auto itinerary scheduling, and map visualization.

## Features

- Email/password authentication with secure cookie sessions
- Per-trip access control (owner/viewer) with sharing by email
- AI proposal generation for places and food based on traveler preferences
- Approve/reject flow for collaborative decision making
- Automatic day-by-day itinerary construction from approved proposals
- OpenStreetMap map view for approved locations
- Per-traveler preferences (likes, dislikes, budget)

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript) |
| Styling | Tailwind CSS |
| Database | SQLite via Prisma ORM + `better-sqlite3` adapter |
| LLM | OpenAI `gpt-5-mini` (default), Azure OpenAI / Bifrost optional |
| Map | Leaflet / react-leaflet / OpenStreetMap |
| Testing | Jest + Testing Library |

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Set OPENAI_API_KEY=...
```

Optional: override model for non-Azure OpenAI.

```env
OPENAI_MODEL=gpt-5-mini
```

Optional: use Google Maps Geocoding API for proposal coordinates.

```env
GOOGLE_MAPS_API_KEY=your-google-maps-key
```

Optional: use Azure OpenAI instead of standard OpenAI.

```env
AZURE_OPENAI_API_KEY=your-azure-key
AZURE_OPENAI_ENDPOINT=https://<resource-name>.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT=your-deployment-name
AZURE_OPENAI_API_VERSION=2025-01-01-preview
```

Optional: use Bifrost OpenAI-compatible API provider.

```env
LLM_PROVIDER=bifrost
BIFROST_BASE_URL=http://127.0.0.1:8080
# BIFROST_API_KEY=optional-api-key
```

Behavior:

- If `LLM_PROVIDER` is set (`openai`, `azure`, `bifrost`), that provider is used.
- Without `LLM_PROVIDER`, provider auto-detection is used in this order: OpenAI (`OPENAI_API_KEY`) → Azure (`AZURE_OPENAI_API_KEY`) → Bifrost (`BIFROST_BASE_URL` or `BIFROST_API_KEY`).
- Bifrost uses OpenAI-compatible API calls via `BIFROST_BASE_URL`.
- `BIFROST_BASE_URL` accepts host-only values (for example `http://192.168.1.200:8080`) and is normalized to `/openai/v1`.
- If `BIFROST_BASE_URL` is not set, default is `http://127.0.0.1:8080/openai/v1`.
- `BIFROST_API_KEY` is optional and defaults to an empty string when unset.
- Bifrost model selection uses `OPENAI_MODEL` (default `gpt-5-mini`).
- Proposal `lat/lng` are resolved via Google Maps Geocoding when `GOOGLE_MAPS_API_KEY` is set.

Provider-specific error handling:

- Bifrost auth errors (`401/403`) return a clear `BIFROST_API_KEY` message.
- Bifrost endpoint errors (`404`, connection failures) return a clear `BIFROST_BASE_URL`/network message.
- Bifrost rate-limit and server errors (`429`, `5xx`) return retry-oriented messages.

### 3. Set up database

```bash
npx prisma migrate dev
npx prisma generate
```

### 4. Run development server

```bash
npm run dev
```

Open [http://localhost:9527](http://localhost:9527).

## Authentication (v1)

- Register/login at `/auth`
- All pages and APIs require authentication except `/auth` and `/api/auth/*`
- Trip sharing supports `owner -> viewer` by email:
  - `owner`: full read/write + delete/share
  - `viewer`: read-only
- Legacy endpoints are deprecated:
  - `/api/users`
  - `/api/users/[id]/preferences`
  - Use `/api/me` and `/api/me/preferences` instead

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint
npm run test     # Jest
npm run test:ci  # Jest (CI mode + coverage)
```

## CI

GitHub Actions workflow (`.github/workflows/ci.yml`) runs:

1. `npm ci`
2. `npx prisma generate`
3. `npm run lint`
4. `npm run test:ci`
5. `npm run build` (with placeholder `OPENAI_API_KEY`)

Run equivalent checks locally:

```bash
just ci
```

## Project Structure

```
src/
  app/
    page.tsx                      # Home – list & create trips
    trips/[id]/page.tsx           # Trip detail (Proposals / Itinerary / Map tabs)
    trips/[id]/preferences/       # Per-traveler preference management
    api/                          # REST API routes
      trips/                      # CRUD for trips
      proposals/[id]/approve|reject
      users/                      # CRUD for users & preferences
  components/
    ProposalCard.tsx              # Proposal with approve/reject buttons
    ItineraryView.tsx             # Day-by-day itinerary grouped by time block
    MapView.tsx                   # Leaflet map (client-only)
    TripCard.tsx                  # Trip summary card
  lib/
    prisma.ts                     # Prisma client singleton
    llm.ts                        # OpenAI/Azure OpenAI proposal generation
prisma/
  schema.prisma                   # Data model
```

## Data Model

| Entity | Key fields |
|---|---|
| `Trip` | `name`, `cities` (JSON array) |
| `User` | `name` |
| `Preference` | `userId`, `likes`, `dislikes`, `budget` |
| `Proposal` | `tripId`, `type`, `title`, `description`, `reason`, `lat/lng`, `city`, `suggestedTime`, `durationMinutes`, `status` |
| `ItineraryItem` | `tripId`, `proposalId`, `day`, `timeBlock` (`morning`/`afternoon`/`dinner`) |

## Demo Site (GitHub Pages)

A demo preview page is deployed to GitHub Pages on every push to `main` via `.github/workflows/deploy-pages.yml`.

- Preview URL: <https://nationalteam.github.io/trip-planner/>
- Manual deploy: run **Deploy demo site to GitHub Pages** in GitHub Actions

## Run with Docker

```bash
cp .env.example .env
# Set OPENAI_API_KEY or AZURE_OPENAI_* variables

docker compose up --build
```

Open [http://localhost:9527](http://localhost:9527).
