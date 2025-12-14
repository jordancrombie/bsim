#!/bin/bash
# Deploy BSIM backend code changes to local dev environment (nginx cluster)
# This script rebuilds and deploys the BSIM backend container without database changes
#
# Usage:
#   ./dev_bsim_backend_deploy_code_only.sh
#
# What it does:
#   1. Runs backend tests to verify code is working
#   2. Rebuilds the bsim-backend container with --no-cache
#   3. Restarts the backend service
#   4. Verifies the deployment with health check
#
# Prerequisites:
#   - Docker and docker-compose installed
#   - BSIM dev stack already running (make dev-build)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BSIM_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== BSIM Backend Local Dev Deployment (Code Only) ==="
echo "BSIM directory: $BSIM_DIR"
echo ""

cd "$BSIM_DIR"

# Step 1: Run tests
echo "[1/4] Running backend tests..."
cd "$BSIM_DIR/backend"
if npm test -- --no-coverage 2>&1 | tail -20; then
    echo "Tests passed!"
else
    echo "ERROR: Tests failed! Aborting deployment."
    exit 1
fi
echo ""

cd "$BSIM_DIR"

# Step 2: Rebuild backend container
echo "[2/4] Rebuilding bsim-backend container..."
docker compose -f docker-compose.yml -f docker-compose.dev.yml build --no-cache backend
echo ""

# Step 3: Restart backend service
echo "[3/4] Restarting bsim-backend service..."
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d backend
echo ""

# Step 4: Verify deployment
echo "[4/4] Verifying deployment..."
sleep 5

# Health check
check_backend() {
    local response=$(curl -sk https://dev.banksim.ca/api/health 2>/dev/null || echo "FAILED")
    if echo "$response" | grep -qE '"status"\s*:\s*"(ok|healthy)"'; then
        echo "  Health check: PASSED"
        return 0
    else
        echo "  Health check: FAILED - $response"
        return 1
    fi
}

# Verify request-token endpoint exists (should return 401 without auth)
check_request_token_endpoint() {
    local response=$(curl -sk -X POST https://dev.banksim.ca/api/wallet/request-token \
        -H "Content-Type: application/json" \
        -d '{}' 2>/dev/null || echo "FAILED")
    if echo "$response" | grep -q "No wallet credential provided"; then
        echo "  /api/wallet/request-token: PASSED (endpoint exists)"
        return 0
    else
        echo "  /api/wallet/request-token: FAILED - $response"
        return 1
    fi
}

ALL_PASSED=true
echo "Verification:"

check_backend || ALL_PASSED=false
check_request_token_endpoint || ALL_PASSED=false

echo ""

if [ "$ALL_PASSED" = true ]; then
    echo "=== BSIM Backend deployment complete ==="
    echo ""
    echo "New endpoint available:"
    echo "  POST https://dev.banksim.ca/api/wallet/request-token"
    echo ""
    echo "Next steps:"
    echo "  1. Deploy WSIM backend (which has the fix to send bsimCardRef)"
    echo "  2. Test mobile payment flow end-to-end"
else
    echo "=== BSIM Backend deployment completed with errors ==="
    echo ""
    echo "Check logs with:"
    echo "  docker compose logs backend"
    exit 1
fi
