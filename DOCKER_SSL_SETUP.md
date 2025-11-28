# Docker SSL/HTTPS Setup

This document explains how SSL/HTTPS is configured for local Docker development and how it maps to AWS deployment.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│ Local Development (Docker Compose)                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Browser (HTTPS) → nginx (SSL Termination)              │
│                      ↓                                   │
│                   Backend (HTTP:3001) ← Frontend (HTTP:3000)
│                      ↓                                   │
│                   PostgreSQL (5432)                      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ AWS Production (ECS Fargate)                            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Browser (HTTPS) → ALB (SSL Termination with ACM)       │
│                      ↓                                   │
│                   Backend (HTTP:3001) ← Frontend (HTTP:3000)
│                      ↓                                   │
│                   RDS PostgreSQL                         │
└─────────────────────────────────────────────────────────┘
```

## Key Principles

1. **SSL Termination at Load Balancer Level**
   - Local: nginx handles SSL termination
   - AWS: Application Load Balancer (ALB) handles SSL termination
   - Backend and Frontend containers always run HTTP-only

2. **Certificate Management**
   - Local: Self-signed certificates in `certs/` directory (not committed to git)
   - AWS: AWS Certificate Manager (ACM) provides free SSL certificates

3. **Same Container Images**
   - Containers are identical for local and AWS deployment
   - Environment variables control CORS, domain, etc.

## Local Development Setup

### Prerequisites

You need SSL certificates in the `certs/` directory:
- `banksim.ca.crt` - SSL certificate
- `banksim.ca.key` - Private key

If you don't have certificates, generate self-signed ones:

```bash
# Using OpenSSL
openssl req -x509 -newkey rsa:4096 -keyout certs/banksim.ca.key \
  -out certs/banksim.ca.crt -days 365 -nodes \
  -subj "/CN=localhost"

# Or using mkcert (recommended for local development)
mkcert -install
mkcert -key-file certs/banksim.ca.key \
  -cert-file certs/banksim.ca.crt \
  localhost banksim.ca "*.banksim.ca"
```

### Running with SSL

```bash
# Start the complete stack
docker compose up -d

# Access the application
https://localhost             # Frontend
https://localhost/api/health  # Backend API
http://localhost              # Redirects to HTTPS
```

### Container Configuration

**nginx** (SSL Termination):
- Listens on ports 80 (HTTP) and 443 (HTTPS)
- Mounts certificates from `certs/` directory
- Proxies requests to backend:3001 and frontend:3000
- Handles HTTP → HTTPS redirects

**Backend**:
- Runs on HTTP only (port 3001)
- Environment: `USE_HTTPS=false`
- CORS configured for HTTPS origins
- No SSL certificates needed in container

**Frontend**:
- Runs on HTTP only (port 3000)
- Configured to call API via HTTPS through nginx
- No SSL certificates needed in container

## AWS Production Setup

### SSL Certificate Setup

1. Request a certificate in AWS Certificate Manager (ACM):
   ```bash
   # Using AWS CLI
   aws acm request-certificate \
     --domain-name yourdomain.com \
     --subject-alternative-names "*.yourdomain.com" \
     --validation-method DNS
   ```

2. Add DNS validation records to your domain provider

3. Attach certificate to Application Load Balancer

### Application Load Balancer Configuration

1. **HTTPS Listener (Port 443)**:
   - Protocol: HTTPS
   - Certificate: ACM certificate
   - Default action: Forward to Target Group (Backend or Frontend)
   - Security policy: ELBSecurityPolicy-TLS13-1-2-2021-06

2. **HTTP Listener (Port 80)**:
   - Protocol: HTTP
   - Default action: Redirect to HTTPS

3. **Target Groups**:
   - Backend: HTTP protocol, port 3001, health check: `/health`
   - Frontend: HTTP protocol, port 3000

### ECS Task Environment Variables

**Backend Task**:
```json
{
  "USE_HTTPS": "false",
  "DOMAIN": "yourdomain.com",
  "CORS_ORIGIN": "https://yourdomain.com",
  "RP_ID": "yourdomain.com",
  "ORIGIN": "https://yourdomain.com"
}
```

**Frontend Task**:
```json
{
  "NEXT_PUBLIC_API_URL": "https://yourdomain.com/api",
  "NEXT_PUBLIC_DOMAIN": "yourdomain.com"
}
```

## Security Considerations

### Local Development

- Self-signed certificates will show browser warnings (expected)
- Use mkcert to install local CA for trusted certificates
- Never commit certificates to git (see `.gitignore`)

### Production (AWS)

- ACM provides free, auto-renewing certificates
- Use Security Groups to restrict container access
- Backend/Frontend only accessible through ALB
- Enable AWS WAF on ALB for DDoS protection
- Use Secrets Manager for sensitive environment variables

## WebAuthn/Passkey Considerations

WebAuthn requires HTTPS in production. The SSL setup ensures:

1. **Local Development**:
   - HTTPS via nginx with self-signed certificate
   - RP ID matches domain (localhost)
   - Origin matches HTTPS URL

2. **Production**:
   - HTTPS via ALB with ACM certificate
   - RP ID matches production domain
   - Origin matches production URL

3. **Environment Variables**:
   ```bash
   # Local
   RP_ID=localhost
   ORIGIN=https://localhost

   # Production
   RP_ID=yourdomain.com
   ORIGIN=https://yourdomain.com
   ```

## Troubleshooting

### Container won't start - certificate not found

**Error**: `Error: ENOENT: no such file or directory, open '/certs/banksim.ca.key'`

**Solution**: This error should only occur if the backend has `USE_HTTPS=true`. Check:
1. Backend should have `USE_HTTPS=false` in docker-compose.yml
2. Only nginx container should mount the certs directory
3. Restart: `docker compose down && docker compose up -d`

### HTTPS not working

**Check**:
```bash
# Verify nginx is running
docker compose ps nginx

# Check nginx logs
docker compose logs nginx

# Test HTTPS endpoint
curl -k https://localhost/health
```

### Browser shows certificate warning

**Local Development**: This is expected with self-signed certificates
- Use mkcert to install a local CA
- Or accept the browser warning (safe for local development)

**Production**: Should never happen with ACM certificates
- Verify ACM certificate is attached to ALB
- Check domain DNS points to ALB
- Verify certificate includes domain and subdomains

## File Structure

```
bsim/
├── nginx/
│   └── nginx.conf              # nginx SSL configuration
├── certs/                      # SSL certificates (gitignored)
│   ├── .gitkeep
│   ├── banksim.ca.crt         # SSL certificate
│   └── banksim.ca.key         # Private key (secret!)
├── docker-compose.yml          # Local development stack
└── backend/src/server.ts       # Backend supports USE_HTTPS flag
```

## Migration Notes

### From No SSL to SSL

If you were running without SSL and want to add it:

1. Generate/obtain SSL certificates
2. Add nginx service to docker-compose.yml
3. Update backend environment: `USE_HTTPS=false`
4. Update CORS origins to HTTPS URLs
5. Restart stack: `docker compose down && docker compose up -d`

### From Backend SSL to nginx SSL

If your backend was handling SSL directly:

1. Move certificates to project root `certs/` directory
2. Remove certificate mounts from backend service
3. Add nginx service to docker-compose.yml
4. Set backend `USE_HTTPS=false`
5. Backend no longer needs to read certificates

## References

- [nginx SSL Termination](https://nginx.org/en/docs/http/configuring_https_servers.html)
- [AWS Certificate Manager](https://docs.aws.amazon.com/acm/)
- [AWS ALB HTTPS Listener](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/create-https-listener.html)
- [mkcert for Local Development](https://github.com/FiloSottile/mkcert)
- [WebAuthn Relying Party ID](https://www.w3.org/TR/webauthn-2/#relying-party-identifier)
