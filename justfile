# trip-planner justfile
# Run `just` to see available recipes, or `just <recipe>` to run one.
set dotenv-load := true

# Default: show available recipes
default:
    @just --list

# Install dependencies
[group('dev')]
install:
    npm install

# Copy .env.example to .env (will not overwrite an existing file)
[group('dev')]
env:
    cp -n .env.example .env

# Apply database migrations (development)
[group('database')]
db-migrate:
    npx prisma migrate dev

# Validate DATABASE_URL for SQLite usage
[group('database')]
assert-db-url:
    @bash -lc 'url="${DATABASE_URL:-}"; if [[ ! "$url" =~ ^file: ]]; then echo "ERROR: DATABASE_URL must start with file:, e.g. file:./dev.db"; exit 1; fi; path="${url#file:}"; path_no_query="${path%%\?*}"; if [[ -z "$path_no_query" || "$path_no_query" =~ ^[[:space:]]*$ ]]; then echo "ERROR: DATABASE_URL must include a non-empty SQLite file path after file:, e.g. file:./dev.db"; exit 1; fi'

# Generate Prisma client
[group('database')]
db-generate:
    npx prisma generate

# Prepare local DB for runtime usage
[group('database')]
db-prepare: assert-db-url db-migrate db-generate

# Ensure critical tables are present in the target DB file
[group('database')]
db-health:
    node -e "const Database=require('better-sqlite3'); const url=process.env.DATABASE_URL||''; if(!url.startsWith('file:')){console.error('ERROR: DATABASE_URL must start with file:, e.g. file:./dev.db'); process.exit(1);} const filename=url.replace(/^file:/,'').replace(/\?.*$/,''); if(!filename.trim()){console.error('ERROR: DATABASE_URL must include a non-empty SQLite file path after file:'); process.exit(1);} const db=new Database(filename,{fileMustExist:true}); const row=db.prepare(\"SELECT name FROM sqlite_master WHERE type='table' AND name='Trip'\").get(); if(!row){console.error('ERROR: Trip table missing in '+filename); process.exit(1);} console.log('DB OK: Trip table exists in '+filename);"

# Start the development server
[group('dev')]
dev:
    npm run dev

# Start dev server after DB safety checks
[group('dev')]
dev-safe: db-prepare db-health
    npm run dev

# Build for production
[group('dev')]
build:
    npm run build

# Start the production server (requires a prior build)
[group('dev')]
start:
    npm run start

# Run ESLint
[group('quality')]
lint:
    npm run lint

# Run unit tests
[group('quality')]
test:
    npm run test

# Run CI tests with coverage
[group('quality')]
test-ci:
    npm run test:ci

# Install dependencies with lockfile (CI style)
[group('ci')]
ci-install:
    npm ci

# Build with placeholder OpenAI key (CI style)
[group('ci')]
ci-build:
    OPENAI_API_KEY=sk-placeholder npm run build

# Run the same checks as .github/workflows/ci.yml
[group('ci')]
ci: ci-install lint test-ci ci-build

# Full setup from scratch: install deps, copy env, and migrate the database
[group('dev')]
setup: install env db-prepare db-health

# Build and start via Docker Compose
[group('docker')]
docker-up:
    docker compose up --build

# Stop Docker Compose services
[group('docker')]
docker-down:
    docker compose down
