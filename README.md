# trip-planner

An AI-powered collaborative trip planner. Generate restaurant and place proposals via LLM, let users vote on them, and automatically build a day-by-day itinerary with a map view.

## Features

- **AI Proposal Generation** – Hit "Generate Proposals" to get personalized restaurant/place suggestions powered by GPT-4o-mini
- **Approve / Reject** – Each traveler can thumbs-up or thumbs-down every proposal
- **Auto Itinerary** – Approved proposals are automatically scheduled into a day-by-day itinerary grouped by time block (morning / afternoon / evening)
- **Interactive Map** – Approved proposals appear as markers on an OpenStreetMap map
- **Multi-traveller Preferences** – Each traveller can record their likes, dislikes, and budget so the AI can tailor suggestions

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| Styling | Tailwind CSS |
| Database | SQLite via Prisma ORM |
| LLM | OpenAI `gpt-4o-mini` |
| Map | Leaflet / OpenStreetMap |

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the example env file and add your OpenAI API key:

```bash
cp .env.example .env
# Edit .env and set OPENAI_API_KEY=sk-...
```

### 3. Set up the database

```bash
npx prisma migrate dev
```

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
  app/
    page.tsx                      # Home – list & create trips
    trips/[id]/page.tsx           # Trip detail (Proposals / Itinerary / Map tabs)
    trips/[id]/preferences/       # Per-traveller preference management
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
    llm.ts                        # OpenAI proposal generation
prisma/
  schema.prisma                   # Data model
```

## Data Model

| Entity | Key fields |
|---|---|
| `Trip` | name, cities (JSON array) |
| `User` | name |
| `Preference` | userId, likes, dislikes, budget |
| `Proposal` | tripId, type, title, description, reason, lat/lng, suggestedTime, status |
| `ItineraryItem` | tripId, proposalId, day, timeBlock |

## Running with Docker

```bash
cp .env.example .env
# Edit .env and set OPENAI_API_KEY=sk-...

docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint
```
