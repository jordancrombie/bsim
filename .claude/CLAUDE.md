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

---

## Critical: AWS Production Deployments

### ALWAYS Use --no-cache When Building for Production

When building Docker images for AWS ECR deployment, **ALWAYS use `--no-cache`** to ensure the latest code is included:

```bash
# CORRECT - Forces fresh build with latest code
docker build --no-cache --platform linux/amd64 -t <ecr-repo>:latest .

# WRONG - May use cached layers with stale code
docker build --platform linux/amd64 -t <ecr-repo>:latest .
```

**Why this matters:**
- Docker caches intermediate layers based on file checksums
- If only TypeScript source files changed (not package.json), Docker may reuse old `npm ci` and build layers
- This results in deploying outdated code even though the build "succeeded"
- Symptoms: New features/routes return 404, new env vars not recognized, recent bug fixes not applied

### Production Deployment Checklist

1. **Build with --no-cache**:
   ```bash
   cd /path/to/service
   docker build --no-cache --platform linux/amd64 -t 301868770392.dkr.ecr.ca-central-1.amazonaws.com/bsim/<service>:latest .
   ```

2. **Push to ECR**:
   ```bash
   aws ecr get-login-password --region ca-central-1 | docker login --username AWS --password-stdin 301868770392.dkr.ecr.ca-central-1.amazonaws.com
   docker push 301868770392.dkr.ecr.ca-central-1.amazonaws.com/bsim/<service>:latest
   ```

3. **Force new deployment**:
   ```bash
   aws ecs update-service --cluster bsim-cluster --service <service-name> --force-new-deployment --region ca-central-1
   ```

4. **Verify deployment**:
   ```bash
   # Wait for new task to be running
   aws ecs describe-services --cluster bsim-cluster --services <service-name> --region ca-central-1 \
     --query 'services[0].deployments[*].{status:status,running:runningCount}'
   ```

### ECR Repository Names

| Service | ECR Repository |
|---------|----------------|
| BSIM Backend | `bsim/backend` |
| BSIM Auth Server | `bsim/auth-server` |
| BSIM Frontend | `bsim/frontend` |
| BSIM Admin | `bsim/admin` |
| WSIM Backend | `bsim/wsim-backend` |
| WSIM Auth Server | `bsim/wsim-auth-server` |
| WSIM Frontend | `bsim/wsim-frontend` |
| SSIM | `bsim/ssim` |
| NSIM | `bsim/nsim` |
