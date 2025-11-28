# Docker & AWS Deployment - BSIM Banking Simulator

## Quick Start with Docker

### Local Development with Docker Compose

```bash
# Build and start all services
docker compose up --build

# Access the application
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- PostgreSQL: localhost:5432
```

### Individual Container Builds

#### Build Backend
```bash
cd backend
docker build -t bsim/backend .
docker run -p 3001:3001 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/bsim" \
  -e JWT_SECRET="your-secret" \
  bsim/backend
```

#### Build Frontend
```bash
cd frontend
docker build -t bsim/frontend .
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL="http://localhost:3001/api" \
  bsim/frontend
```

## Project Structure

```
bsim/
├── backend/
│   ├── Dockerfile                 # Multi-stage production build
│   ├── .dockerignore              # Exclude unnecessary files
│   ├── src/                       # TypeScript source
│   └── prisma/                    # Database schema
│
├── frontend/
│   ├── Dockerfile                 # Next.js standalone build
│   ├── .dockerignore              # Exclude unnecessary files
│   ├── next.config.js             # Updated with output: 'standalone'
│   └── app/                       # Next.js application
│
├── docker-compose.yml             # Local development stack
└── AWS_DEPLOYMENT.md              # Complete AWS deployment guide
```

## Docker Features

### Backend Dockerfile
- **Multi-stage build** for optimal image size
- **Non-root user** for security
- **Health check** on /health endpoint
- **Alpine Linux** for minimal footprint
- **Prisma Client** pre-generated
- **Production-ready** TypeScript build

### Frontend Dockerfile
- **Next.js standalone output** for smallest possible image
- **Static asset optimization**
- **Non-root user** for security
- **Health check** on root endpoint
- **Alpine Linux** base image
- **Environment variable** configuration at runtime

### Docker Compose
- **PostgreSQL 15** with persistent volumes
- **Automatic health checks** and dependencies
- **Isolated network** for service communication
- **Environment configuration** for local testing
- **Database migration** on backend startup

## Environment Variables

### Backend Container
```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://user:pass@host:5432/bsim
JWT_SECRET=your-production-secret
USE_HTTPS=false                      # true for HTTPS with certificates
DOMAIN=yourdomain.com
CORS_ORIGIN=https://yourdomain.com
RP_ID=yourdomain.com
ORIGIN=https://yourdomain.com
```

### Frontend Container
```env
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_DOMAIN=yourdomain.com
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
```

## Cloud Deployment Options

### ✅ Recommended: AWS ECS Fargate
- **Pros**: Managed, scalable, no server management
- **Cost**: ~$60-80/month for production setup
- **Complexity**: Medium
- **Guide**: See [AWS_DEPLOYMENT.md](AWS_DEPLOYMENT.md)

### Alternative Options

#### AWS App Runner
- **Pros**: Simplest deployment, automatic scaling
- **Cost**: ~$50/month
- **Complexity**: Low
- Limited customization

#### AWS EKS (Kubernetes)
- **Pros**: Maximum flexibility, industry standard
- **Cost**: ~$150+/month
- **Complexity**: High
- Best for large-scale applications

#### DigitalOcean App Platform
- **Pros**: Simple, affordable
- **Cost**: ~$40/month
- **Complexity**: Low
- Limited AWS integration

#### Fly.io
- **Pros**: Edge deployment, simple
- **Cost**: ~$30/month
- **Complexity**: Low
- Global edge network

## Testing Docker Builds Locally

```bash
# Test backend build
cd backend
docker build -t bsim-backend-test .
docker run --rm bsim-backend-test node -v

# Test frontend build
cd frontend
docker build -t bsim-frontend-test .
docker run --rm -p 3000:3000 bsim-frontend-test

# Test full stack with docker compose
docker compose up --build
docker compose down
```

## Production Considerations

### Security
- ✅ Non-root users in containers
- ✅ Minimal base images (Alpine Linux)
- ✅ No secrets in images (use environment variables)
- ✅ Health checks enabled
- ⚠️ Use AWS Secrets Manager for production secrets
- ⚠️ Enable container scanning in ECR

### Performance
- ✅ Multi-stage builds minimize image size
- ✅ Layer caching optimized
- ✅ Static assets served efficiently
- ⚠️ Configure auto-scaling policies
- ⚠️ Set appropriate CPU/memory limits

### Monitoring
- ⚠️ Enable CloudWatch logs
- ⚠️ Set up CloudWatch alarms
- ⚠️ Configure APM tools (DataDog, New Relic, etc.)
- ⚠️ Monitor container health checks

## Common Commands

```bash
# Build images
docker compose build

# Start services
docker compose up -d

# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Stop services
docker compose down

# Remove volumes (⚠️ deletes database)
docker compose down -v

# Rebuild specific service
docker compose build backend
docker compose up -d backend

# Execute commands in running container
docker compose exec backend npx prisma studio
docker compose exec db psql -U bsim -d bsim

# Clean up Docker system
docker system prune -a
```

## Troubleshooting

### Backend won't start
- Check DATABASE_URL is correct
- Verify PostgreSQL is running and accessible
- Review logs: `docker compose logs backend`
- Ensure Prisma migrations ran: `docker compose exec backend npx prisma migrate status`

### Frontend can't reach backend
- Verify NEXT_PUBLIC_API_URL environment variable
- Check backend health: `curl http://localhost:3001/health`
- Ensure both services on same Docker network
- Review CORS configuration in backend

### Database connection refused
- PostgreSQL container running: `docker compose ps db`
- Health check passing: `docker compose ps`
- Correct credentials in DATABASE_URL
- Port 5432 not conflicting with local PostgreSQL

### Image build fails
- Check .dockerignore isn't excluding required files
- Verify all dependencies in package.json
- Ensure Node version compatibility (20-alpine)
- Review build logs for specific errors

## Next Steps

1. ✅ Test Docker builds locally
2. ✅ Review AWS deployment guide
3. ⬜ Set up AWS account and configure CLI
4. ⬜ Create ECR repositories
5. ⬜ Deploy RDS PostgreSQL instance
6. ⬜ Deploy ECS Fargate services
7. ⬜ Configure ALB and SSL certificates
8. ⬜ Set up CI/CD pipeline
9. ⬜ Configure monitoring and alerts
10. ⬜ Implement backup strategy

## Support

For AWS deployment details, see [AWS_DEPLOYMENT.md](AWS_DEPLOYMENT.md)

For application setup, see [README.md](README.md)
