# trip-planner justfile
# Run `just` to see available recipes, or `just <recipe>` to run one.

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

# Generate Prisma client
[group('database')]
db-generate:
    npx prisma generate

# Start the development server
[group('dev')]
dev:
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
setup: install env db-migrate

# Build and start via Docker Compose
[group('docker')]
docker-up:
    docker compose up --build

# Stop Docker Compose services
[group('docker')]
docker-down:
    docker compose down
