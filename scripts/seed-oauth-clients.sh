#!/bin/bash

# OAuth Client Seeding Script for BSIM
# This script creates OAuth clients for development

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
    seed-wsim)
        echo "============================================"
        echo "  BSIM OAuth Client: WSIM (Wallet Simulator)"
        echo "============================================"
        echo ""
        echo "Creating WSIM OAuth client for wallet:enroll scope..."
        echo ""

        run_prisma_command "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const wsimClient = {
  clientId: 'wsim-wallet',
  clientSecret: 'wsim-dev-secret',
  clientName: 'Wallet Simulator',
  redirectUris: [
    'https://wsim.banksim.ca/api/enrollment/callback/bsim',
    'https://wsim-dev.banksim.ca/api/enrollment/callback/bsim'
  ],
  postLogoutRedirectUris: [
    'https://wsim.banksim.ca',
    'https://wsim-dev.banksim.ca'
  ],
  grantTypes: ['authorization_code'],
  responseTypes: ['code'],
  scope: 'openid profile email wallet:enroll',
  logoUri: null,
  policyUri: null,
  tosUri: null,
  contacts: [],
  isActive: true
};

p.oAuthClient.upsert({
  where: { clientId: 'wsim-wallet' },
  update: wsimClient,
  create: wsimClient
})
  .then(r => console.log('WSIM OAuth client created/updated:', r.clientId))
  .catch(e => console.error('Error:', e.message))
  .finally(() => p.\$disconnect());
"

        echo ""
        echo "============================================"
        echo "WSIM OAuth client seeded successfully."
        echo ""
        echo "Client ID: wsim-wallet"
        echo "Client Secret: wsim-dev-secret"
        echo "Scope: openid profile email wallet:enroll"
        echo "============================================"
        ;;

    seed-ssim)
        echo "============================================"
        echo "  BSIM OAuth Client: SSIM (Store Simulator)"
        echo "============================================"
        echo ""
        echo "Creating SSIM OAuth client for payment:authorize scope..."
        echo ""

        run_prisma_command "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const ssimClient = {
  clientId: 'ssim-client',
  clientSecret: process.env.SSIM_CLIENT_SECRET || 'ece9c837b17bface1df34fe89d8c8e13bcf4f9e77c7a7681442952ebd9dd7015',
  clientName: 'Store Simulator',
  redirectUris: [
    'https://ssim.banksim.ca/auth/callback',
    'https://ssim-dev.banksim.ca/auth/callback',
    'http://localhost:3005/auth/callback'
  ],
  postLogoutRedirectUris: [
    'https://ssim.banksim.ca',
    'https://ssim-dev.banksim.ca',
    'http://localhost:3005'
  ],
  grantTypes: ['authorization_code'],
  responseTypes: ['code'],
  scope: 'openid profile email payment:authorize',
  logoUri: null,
  policyUri: null,
  tosUri: null,
  contacts: [],
  isActive: true
};

p.oAuthClient.upsert({
  where: { clientId: 'ssim-client' },
  update: ssimClient,
  create: ssimClient
})
  .then(r => console.log('SSIM OAuth client created/updated:', r.clientId))
  .catch(e => console.error('Error:', e.message))
  .finally(() => p.\$disconnect());
"

        echo ""
        echo "============================================"
        echo "SSIM OAuth client seeded successfully."
        echo ""
        echo "Client ID: ssim-client"
        echo "Client Secret: ssim-dev-secret"
        echo "Scope: openid profile email payment:authorize"
        echo "============================================"
        ;;

    seed-all)
        echo "Seeding all OAuth clients..."
        echo ""
        "$0" seed-ssim
        echo ""
        "$0" seed-wsim
        ;;

    list)
        echo "============================================"
        echo "  BSIM OAuth Clients"
        echo "============================================"
        echo ""

        run_prisma_command "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.oAuthClient.findMany({
  select: {
    clientId: true,
    clientName: true,
    scope: true,
    redirectUris: true,
    isActive: true,
    createdAt: true
  }
})
  .then(r => {
    if (r.length === 0) {
      console.log('No OAuth clients found.');
    } else {
      r.forEach(c => {
        console.log('---');
        console.log('Client ID:', c.clientId);
        console.log('Name:', c.clientName);
        console.log('Scope:', c.scope);
        console.log('Redirect URIs:', c.redirectUris.join(', '));
        console.log('Active:', c.isActive);
        console.log('Created:', c.createdAt);
      });
    }
  })
  .catch(e => console.error('Error:', e.message))
  .finally(() => p.\$disconnect());
"
        ;;

    *)
        echo "BSIM OAuth Client Management"
        echo ""
        echo "Usage: ./scripts/seed-oauth-clients.sh [command]"
        echo ""
        echo "Commands:"
        echo "  seed-wsim   - Create/update WSIM (Wallet Simulator) OAuth client"
        echo "  seed-ssim   - Create/update SSIM (Store Simulator) OAuth client"
        echo "  seed-all    - Seed all OAuth clients"
        echo "  list        - List all OAuth clients"
        echo ""
        echo "Examples:"
        echo "  ./scripts/seed-oauth-clients.sh seed-all    # Seed all clients"
        echo "  ./scripts/seed-oauth-clients.sh list        # List existing clients"
        echo ""
        echo "Note: These commands run against the local dev database (localhost:5432)."
        echo "      Make sure docker-compose dev environment is running."
        exit 1
        ;;
esac
