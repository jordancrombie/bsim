#!/bin/bash

# Database management script for BSIM

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

case "$1" in
  start)
    echo "Starting PostgreSQL container..."
    docker compose up -d postgres
    echo "Waiting for PostgreSQL to be ready..."
    sleep 5
    docker compose ps
    echo ""
    echo "✅ PostgreSQL is running!"
    echo "Connection string: postgresql://bsim:bsim_dev_password@localhost:5432/bsim"
    ;;

  stop)
    echo "Stopping PostgreSQL container..."
    docker compose down
    echo "✅ PostgreSQL stopped"
    ;;

  restart)
    echo "Restarting PostgreSQL container..."
    docker compose restart postgres
    echo "✅ PostgreSQL restarted"
    ;;

  logs)
    echo "Showing PostgreSQL logs..."
    docker compose logs -f postgres
    ;;

  reset)
    echo "⚠️  This will delete all data in the database!"
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" = "yes" ]; then
      echo "Stopping containers..."
      docker compose down -v
      echo "Starting fresh database..."
      docker compose up -d postgres
      sleep 5
      cd backend
      echo "Running migrations..."
      npm run prisma:migrate
      echo "✅ Database reset complete!"
    else
      echo "Cancelled"
    fi
    ;;

  migrate)
    echo "Running database migrations..."
    cd backend
    npm run prisma:generate
    npm run prisma:migrate
    echo "✅ Migrations complete!"
    ;;

  studio)
    echo "Opening Prisma Studio..."
    cd backend
    npm run prisma:studio
    ;;

  psql)
    echo "Connecting to PostgreSQL..."
    docker compose exec postgres psql -U bsim -d bsim
    ;;

  status)
    echo "Database status:"
    docker compose ps postgres
    ;;

  *)
    echo "BSIM Database Management"
    echo ""
    echo "Usage: ./scripts/db.sh [command]"
    echo ""
    echo "Commands:"
    echo "  start    - Start PostgreSQL container"
    echo "  stop     - Stop PostgreSQL container"
    echo "  restart  - Restart PostgreSQL container"
    echo "  logs     - View PostgreSQL logs"
    echo "  reset    - Reset database (deletes all data)"
    echo "  migrate  - Run database migrations"
    echo "  studio   - Open Prisma Studio"
    echo "  psql     - Connect to PostgreSQL CLI"
    echo "  status   - Show container status"
    echo ""
    exit 1
    ;;
esac
