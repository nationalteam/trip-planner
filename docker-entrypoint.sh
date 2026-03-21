#!/bin/sh
set -e

# Run database migrations before starting the app
echo "Running database migrations..."
if ! npx prisma migrate deploy; then
  echo "ERROR: Database migration failed. Exiting." >&2
  exit 1
fi
echo "Migrations applied successfully."

exec "$@"
