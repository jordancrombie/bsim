# BSIM Development Environment Notes

## Critical: Docker Development vs Production

This project uses **two docker-compose files** that MUST be used together for local development:

```bash
# CORRECT - Local development (uses *-dev.banksim.ca domains)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# WRONG - Will use production settings (banksim.ca)
docker compose up --build
```

### Build-Time vs Runtime Variables

**Frontend (Next.js)** uses `NEXT_PUBLIC_*` environment variables that are **baked in at build time**:
- `NEXT_PUBLIC_API_URL` - The API endpoint URL
- `NEXT_PUBLIC_DOMAIN` - The domain name
- These are set via `build.args` in docker-compose, NOT `environment`

If the frontend makes requests to the wrong domain (e.g., `banksim.ca` instead of `dev.banksim.ca`), the frontend image needs to be **rebuilt** with the dev compose file:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml build --no-cache frontend
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d frontend
```

### Quick Diagnostic

If you see CORS errors like:
```
Access to XMLHttpRequest at 'https://banksim.ca/api/...' from origin 'https://dev.banksim.ca' has been blocked
```

This means the frontend was built with production settings. Rebuild with dev settings.

### Verification Commands

Check which API URL is baked into frontend:
```bash
docker exec bsim-frontend sh -c "strings server.js | grep -o 'https://[^\"]*banksim.ca/api' | head -1"
```

Check backend environment:
```bash
docker exec bsim-backend printenv | grep -E "DOMAIN|CORS"
```

## Domain Patterns

| Environment | Frontend | API | Auth | Admin |
|-------------|----------|-----|------|-------|
| Development | dev.banksim.ca | dev.banksim.ca/api | auth-dev.banksim.ca | admin-dev.banksim.ca |
| Production | banksim.ca | banksim.ca/api | auth.banksim.ca | admin.banksim.ca |

## Common Issues

1. **Registration/Login fails with CORS error**: Frontend calling wrong domain - rebuild frontend
2. **Passkeys don't work**: Check `RP_ID` matches the domain (use parent domain for cross-subdomain)
3. **OAuth redirects fail**: Check `ISSUER` and redirect URIs match the environment
