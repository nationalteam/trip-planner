# trip-planner justfile
# Run `just` to see available recipes, or `just <recipe>` to run one.

# Install dependencies
install:
    npm install

# Copy .env.example to .env (will not overwrite an existing file)
env:
    cp -n .env.example .env

# Apply database migrations (development)
db-migrate:
    npx prisma migrate dev

# Generate Prisma client
db-generate:
    npx prisma generate

# Start the development server
dev:
    npm run dev

# Build for production
build:
    npm run build

# Start the production server (requires a prior build)
start:
    npm run start

# Run ESLint
lint:
    npm run lint

# Run unit tests
test:
    npm run test

# Run CI tests with coverage
test-ci:
    npm run test:ci

# Install dependencies with lockfile (CI style)
ci-install:
    npm ci

# Build with placeholder OpenAI key (CI style)
ci-build:
    OPENAI_API_KEY=sk-placeholder npm run build

# Run the same checks as .github/workflows/ci.yml
ci: ci-install lint test-ci ci-build

# Full setup from scratch: install deps, copy env, and migrate the database
setup: install env db-migrate

# Build and start via Docker Compose
docker-up:
    docker compose up --build

# Stop Docker Compose services
docker-down:
    docker compose down
