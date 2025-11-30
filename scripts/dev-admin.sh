#!/bin/bash

# Local Dev Admin Management Script for BSIM
# This script helps manage admin users in the local development environment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# Database configuration for local dev
DATABASE_URL="postgresql://bsim:bsim_dev_password@localhost:5432/bsim"

run_prisma_command() {
    local command="$1"

    cd "$PROJECT_ROOT/admin"
    DATABASE_URL="$DATABASE_URL" node -e "$command"
}

case "$1" in
    reset-admin)
        echo "============================================"
        echo "  BSIM Dev Admin Reset"
        echo "============================================"
        echo ""
        echo "This will DELETE all admin users from the local dev database."
        echo "After this, visiting admin-dev.banksim.ca will show the first-user setup screen."
        echo ""

        if [ "$2" != "-y" ] && [ "$2" != "--yes" ]; then
            read -p "Are you sure you want to continue? (yes/no): " confirm
            if [ "$confirm" != "yes" ]; then
                echo "Cancelled."
                exit 0
            fi
        fi

        echo ""
        echo "Deleting admin users..."
        run_prisma_command "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.adminUser.deleteMany({})
  .then(r => console.log('Deleted', r.count, 'admin users'))
  .catch(e => console.error('Error:', e.message))
  .finally(() => p.\$disconnect());
"

        echo ""
        echo "============================================"
        echo "Admin users have been deleted."
        echo "Visit https://admin-dev.banksim.ca to create a new admin user."
        echo "============================================"
        ;;

    delete-passkeys)
        echo "============================================"
        echo "  BSIM Dev Admin Passkey Cleanup"
        echo "============================================"
        echo ""
        echo "This will DELETE all admin passkeys from the local dev database."
        echo "Admin users will remain but will need to re-register passkeys."
        echo ""

        if [ "$2" != "-y" ] && [ "$2" != "--yes" ]; then
            read -p "Are you sure you want to continue? (yes/no): " confirm
            if [ "$confirm" != "yes" ]; then
                echo "Cancelled."
                exit 0
            fi
        fi

        echo ""
        echo "Deleting passkeys..."
        run_prisma_command "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.adminPasskey.deleteMany({})
  .then(r => console.log('Deleted', r.count, 'passkeys'))
  .catch(e => console.error('Error:', e.message))
  .finally(() => p.\$disconnect());
"

        echo ""
        echo "============================================"
        echo "Passkeys have been deleted."
        echo "Admin users will need to re-register passkeys."
        echo "============================================"
        ;;

    list-admins)
        echo "============================================"
        echo "  BSIM Dev Admin Users"
        echo "============================================"
        echo ""

        run_prisma_command "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.adminUser.findMany({
  select: {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    role: true,
    createdAt: true,
    _count: { select: { passkeys: true } }
  }
})
  .then(r => {
    if (r.length === 0) {
      console.log('No admin users found.');
    } else {
      console.log(JSON.stringify(r, null, 2));
    }
  })
  .catch(e => console.error('Error:', e.message))
  .finally(() => p.\$disconnect());
"
        ;;

    *)
        echo "BSIM Dev Admin Management"
        echo ""
        echo "Usage: ./scripts/dev-admin.sh [command] [options]"
        echo ""
        echo "Commands:"
        echo "  reset-admin      - Delete all admin users (triggers first-user setup)"
        echo "  delete-passkeys  - Delete all admin passkeys (keeps users)"
        echo "  list-admins      - List all admin users"
        echo ""
        echo "Options:"
        echo "  -y, --yes        - Skip confirmation prompts"
        echo ""
        echo "Examples:"
        echo "  ./scripts/dev-admin.sh reset-admin       # Reset admin for testing"
        echo "  ./scripts/dev-admin.sh reset-admin -y    # Reset without confirmation"
        echo "  ./scripts/dev-admin.sh delete-passkeys   # Re-register passkeys"
        echo "  ./scripts/dev-admin.sh list-admins       # Check current admin users"
        echo ""
        echo "Note: These commands run against the local dev database (localhost:5432)."
        echo "      Make sure docker-compose dev environment is running."
        exit 1
        ;;
esac
