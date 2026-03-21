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

# Full setup from scratch: install deps, copy env, and migrate the database
setup: install env db-migrate

# Build and start via Docker Compose
docker-up:
    docker compose up --build

# Stop Docker Compose services
docker-down:
    docker compose down
