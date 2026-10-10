#!/bin/sh
set -e

echo "Starting TaskFlow Backend Container..."

if [ -n "$DATABASE_URL" ]; then
  echo "Deploying Prisma database schema..."
  npx prisma db push --skip-generate || echo "Prisma db push warning (continuing startup)"
fi

echo "Launching TaskFlow Express Server..."
exec "$@"
