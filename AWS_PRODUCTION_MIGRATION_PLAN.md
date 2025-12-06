# AWS Production Migration Plan - WSIM & SSIM Integration

## Executive Summary

This plan adds **WSIM (Wallet Simulator)** and **SSIM (Store Simulator)** services to the existing BSIM production infrastructure on AWS. The migration prioritizes **data safety** with proper database migrations.

---

## Current Production State

| Service | Status | ECR Repository | Subdomain |
|---------|--------|----------------|-----------|
| backend | Running | bsim/backend | api.banksim.ca |
| frontend | Running | bsim/frontend | banksim.ca |
| admin | Running | bsim/admin | admin.banksim.ca |
| auth-server | Running | bsim/auth-server | auth.banksim.ca |
| openbanking | Running | bsim/openbanking | openbanking.banksim.ca |
| payment-network (NSIM) | Running | bsim/payment-network | payment.banksim.ca |

## New Services to Deploy

| Service | Port | ECR Repository | Subdomain |
|---------|------|----------------|-----------|
| wsim-backend | 3003 | bsim/wsim-backend | wsim.banksim.ca/api |
| wsim-auth-server | 3005 | bsim/wsim-auth-server | wsim-auth.banksim.ca |
| wsim-frontend | 3000 | bsim/wsim-frontend | wsim.banksim.ca |
| ssim | 3005 | bsim/ssim | ssim.banksim.ca |

---

## Phase 1: Database Preparation (CRITICAL - DATA SAFETY)

### 1.1 Create WSIM Database (Separate from BSIM)

WSIM requires its own database schema to avoid conflicts. Create a new database in the existing RDS instance:

```bash
# Connect to RDS (from bastion or local with port forwarding)
PGPASSWORD='8O9MwSmoA1IUQfOZyw7H4L2lDoeA2M8w' psql \
  -h bsim-db.cb80gi4u4k7g.ca-central-1.rds.amazonaws.com \
  -U bsimadmin \
  -d postgres \
  -c "CREATE DATABASE wsim;"

# Grant permissions
PGPASSWORD='8O9MwSmoA1IUQfOZyw7H4L2lDoeA2M8w' psql \
  -h bsim-db.cb80gi4u4k7g.ca-central-1.rds.amazonaws.com \
  -U bsimadmin \
  -d postgres \
  -c "GRANT ALL PRIVILEGES ON DATABASE wsim TO bsimadmin;"
```

### 1.2 Run WSIM Prisma Migrations

Create a one-time ECS task to initialize the WSIM schema:

```bash
# After WSIM backend image is pushed, run migration task
aws ecs run-task \
  --cluster bsim-cluster \
  --task-definition bsim-wsim-backend \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}" \
  --overrides '{
    "containerOverrides": [{
      "name": "wsim-backend",
      "command": ["npx", "prisma", "db", "push", "--skip-generate"]
    }]
  }'
```

### 1.3 SSIM - No Database Required

SSIM uses in-memory storage for orders and products. No database migrations needed.

---

## Phase 2: ECR Repository Setup

```bash
# Create ECR repositories for new services
aws ecr create-repository --repository-name bsim/wsim-backend --region ca-central-1
aws ecr create-repository --repository-name bsim/wsim-auth-server --region ca-central-1
aws ecr create-repository --repository-name bsim/wsim-frontend --region ca-central-1
aws ecr create-repository --repository-name bsim/ssim --region ca-central-1

# Get ECR login
aws ecr get-login-password --region ca-central-1 | \
  docker login --username AWS --password-stdin 301868770392.dkr.ecr.ca-central-1.amazonaws.com
```

---

## Phase 3: Build and Push Docker Images

### 3.1 WSIM Backend

```bash
cd ../wsim/backend
docker build --platform linux/amd64 -t bsim/wsim-backend .
docker tag bsim/wsim-backend:latest 301868770392.dkr.ecr.ca-central-1.amazonaws.com/bsim/wsim-backend:latest
docker push 301868770392.dkr.ecr.ca-central-1.amazonaws.com/bsim/wsim-backend:latest
```

### 3.2 WSIM Auth Server

```bash
cd ../wsim/auth-server
docker build --platform linux/amd64 -t bsim/wsim-auth-server .
docker tag bsim/wsim-auth-server:latest 301868770392.dkr.ecr.ca-central-1.amazonaws.com/bsim/wsim-auth-server:latest
docker push 301868770392.dkr.ecr.ca-central-1.amazonaws.com/bsim/wsim-auth-server:latest
```

### 3.3 WSIM Frontend (Build Args Required!)

```bash
cd ../wsim/frontend
docker build --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_API_URL=https://wsim.banksim.ca/api \
  --build-arg NEXT_PUBLIC_AUTH_URL=https://wsim-auth.banksim.ca \
  -t bsim/wsim-frontend .
docker tag bsim/wsim-frontend:latest 301868770392.dkr.ecr.ca-central-1.amazonaws.com/bsim/wsim-frontend:latest
docker push 301868770392.dkr.ecr.ca-central-1.amazonaws.com/bsim/wsim-frontend:latest
```

### 3.4 SSIM

```bash
cd ../ssim
docker build --platform linux/amd64 -t bsim/ssim .
docker tag bsim/ssim:latest 301868770392.dkr.ecr.ca-central-1.amazonaws.com/bsim/ssim:latest
docker push 301868770392.dkr.ecr.ca-central-1.amazonaws.com/bsim/ssim:latest
```

---

## Phase 4: Create CloudWatch Log Groups

```bash
aws logs create-log-group --log-group-name /ecs/bsim-wsim-backend --region ca-central-1
aws logs create-log-group --log-group-name /ecs/bsim-wsim-auth-server --region ca-central-1
aws logs create-log-group --log-group-name /ecs/bsim-wsim-frontend --region ca-central-1
aws logs create-log-group --log-group-name /ecs/bsim-ssim --region ca-central-1
```

---

## Phase 5: Generate Production Secrets

Generate secure random values for WSIM:

```bash
# Generate secrets (run locally, save securely)
echo "WSIM_JWT_SECRET: $(openssl rand -base64 32)"
echo "WSIM_SESSION_SECRET: $(openssl rand -base64 32)"
echo "WSIM_COOKIE_SECRET: $(openssl rand -base64 32)"
echo "WSIM_ENCRYPTION_KEY: $(openssl rand -hex 16)"  # Must be exactly 32 hex chars
echo "WSIM_INTERNAL_API_SECRET: $(openssl rand -base64 32)"
echo "WSIM_BSIM_CLIENT_SECRET: $(openssl rand -base64 32)"
```

For SSIM WSIM integration:

```bash
echo "SSIM_WSIM_CLIENT_SECRET: $(openssl rand -base64 32)"
echo "SSIM_WSIM_API_KEY: $(openssl rand -base64 32)"
```

---

## Phase 6: ECS Task Definitions

### 6.1 WSIM Backend Task Definition

Create `aws/wsim-backend-task-definition.json`:

```json
{
  "family": "bsim-wsim-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::301868770392:role/bsim-ecs-task-execution-role",
  "containerDefinitions": [{
    "name": "wsim-backend",
    "image": "301868770392.dkr.ecr.ca-central-1.amazonaws.com/bsim/wsim-backend:latest",
    "portMappings": [{"containerPort": 3003, "protocol": "tcp"}],
    "essential": true,
    "environment": [
      {"name": "NODE_ENV", "value": "production"},
      {"name": "PORT", "value": "3003"},
      {"name": "DATABASE_URL", "value": "postgresql://bsimadmin:8O9MwSmoA1IUQfOZyw7H4L2lDoeA2M8w@bsim-db.cb80gi4u4k7g.ca-central-1.rds.amazonaws.com:5432/wsim"},
      {"name": "APP_URL", "value": "https://wsim.banksim.ca"},
      {"name": "FRONTEND_URL", "value": "https://wsim.banksim.ca"},
      {"name": "AUTH_SERVER_URL", "value": "https://wsim-auth.banksim.ca"},
      {"name": "JWT_SECRET", "value": "<WSIM_JWT_SECRET>"},
      {"name": "SESSION_SECRET", "value": "<WSIM_SESSION_SECRET>"},
      {"name": "ENCRYPTION_KEY", "value": "<WSIM_ENCRYPTION_KEY>"},
      {"name": "INTERNAL_API_SECRET", "value": "<WSIM_INTERNAL_API_SECRET>"},
      {"name": "CORS_ORIGINS", "value": "https://wsim.banksim.ca,https://wsim-auth.banksim.ca,https://ssim.banksim.ca"},
      {"name": "WEBAUTHN_RP_NAME", "value": "WSIM Wallet"},
      {"name": "WEBAUTHN_RP_ID", "value": "banksim.ca"},
      {"name": "WEBAUTHN_ORIGINS", "value": "https://wsim.banksim.ca,https://wsim-auth.banksim.ca"},
      {"name": "BSIM_PROVIDERS", "value": "[{\"bsimId\":\"bsim\",\"name\":\"Bank Simulator\",\"issuer\":\"https://auth.banksim.ca\",\"apiUrl\":\"https://banksim.ca\",\"clientId\":\"wsim-wallet\",\"clientSecret\":\"<WSIM_BSIM_CLIENT_SECRET>\"}]"}
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/bsim-wsim-backend",
        "awslogs-region": "ca-central-1",
        "awslogs-stream-prefix": "ecs"
      }
    },
    "healthCheck": {
      "command": ["CMD-SHELL", "wget --quiet --tries=1 --spider http://localhost:3003/health || exit 1"],
      "interval": 30,
      "timeout": 5,
      "retries": 3,
      "startPeriod": 60
    }
  }]
}
```

### 6.2 WSIM Auth Server Task Definition

Create `aws/wsim-auth-server-task-definition.json`:

```json
{
  "family": "bsim-wsim-auth-server",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::301868770392:role/bsim-ecs-task-execution-role",
  "containerDefinitions": [{
    "name": "wsim-auth-server",
    "image": "301868770392.dkr.ecr.ca-central-1.amazonaws.com/bsim/wsim-auth-server:latest",
    "portMappings": [{"containerPort": 3005, "protocol": "tcp"}],
    "essential": true,
    "environment": [
      {"name": "NODE_ENV", "value": "production"},
      {"name": "PORT", "value": "3005"},
      {"name": "DATABASE_URL", "value": "postgresql://bsimadmin:8O9MwSmoA1IUQfOZyw7H4L2lDoeA2M8w@bsim-db.cb80gi4u4k7g.ca-central-1.rds.amazonaws.com:5432/wsim"},
      {"name": "ISSUER", "value": "https://wsim-auth.banksim.ca"},
      {"name": "BACKEND_URL", "value": "http://localhost:3003"},
      {"name": "FRONTEND_URL", "value": "https://wsim.banksim.ca"},
      {"name": "COOKIE_SECRET", "value": "<WSIM_COOKIE_SECRET>"},
      {"name": "INTERNAL_API_SECRET", "value": "<WSIM_INTERNAL_API_SECRET>"},
      {"name": "CORS_ORIGINS", "value": "https://wsim.banksim.ca,https://ssim.banksim.ca"},
      {"name": "WEBAUTHN_RP_NAME", "value": "WSIM Wallet"},
      {"name": "WEBAUTHN_RP_ID", "value": "banksim.ca"},
      {"name": "WEBAUTHN_ORIGINS", "value": "https://wsim.banksim.ca,https://wsim-auth.banksim.ca"},
      {"name": "ALLOWED_POPUP_ORIGINS", "value": "https://ssim.banksim.ca"},
      {"name": "ALLOWED_EMBED_ORIGINS", "value": "https://ssim.banksim.ca"}
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/bsim-wsim-auth-server",
        "awslogs-region": "ca-central-1",
        "awslogs-stream-prefix": "ecs"
      }
    },
    "healthCheck": {
      "command": ["CMD-SHELL", "wget --quiet --tries=1 --spider http://localhost:3005/.well-known/openid-configuration || exit 1"],
      "interval": 30,
      "timeout": 5,
      "retries": 3,
      "startPeriod": 60
    }
  }]
}
```

### 6.3 WSIM Frontend Task Definition

Create `aws/wsim-frontend-task-definition.json`:

```json
{
  "family": "bsim-wsim-frontend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::301868770392:role/bsim-ecs-task-execution-role",
  "containerDefinitions": [{
    "name": "wsim-frontend",
    "image": "301868770392.dkr.ecr.ca-central-1.amazonaws.com/bsim/wsim-frontend:latest",
    "portMappings": [{"containerPort": 3000, "protocol": "tcp"}],
    "essential": true,
    "environment": [
      {"name": "NODE_ENV", "value": "production"},
      {"name": "PORT", "value": "3000"}
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/bsim-wsim-frontend",
        "awslogs-region": "ca-central-1",
        "awslogs-stream-prefix": "ecs"
      }
    },
    "healthCheck": {
      "command": ["CMD-SHELL", "wget --quiet --tries=1 --spider http://localhost:3000/ || exit 1"],
      "interval": 30,
      "timeout": 5,
      "retries": 3,
      "startPeriod": 60
    }
  }]
}
```

### 6.4 SSIM Task Definition

Create `aws/ssim-task-definition.json`:

```json
{
  "family": "bsim-ssim",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::301868770392:role/bsim-ecs-task-execution-role",
  "containerDefinitions": [{
    "name": "ssim",
    "image": "301868770392.dkr.ecr.ca-central-1.amazonaws.com/bsim/ssim:latest",
    "portMappings": [{"containerPort": 3005, "protocol": "tcp"}],
    "essential": true,
    "environment": [
      {"name": "NODE_ENV", "value": "production"},
      {"name": "PORT", "value": "3005"},
      {"name": "SESSION_SECRET", "value": "<SSIM_SESSION_SECRET>"},
      {"name": "BASE_URL", "value": "https://ssim.banksim.ca"},
      {"name": "BSIM_AUTH_URL", "value": "https://auth.banksim.ca"},
      {"name": "BSIM_API_URL", "value": "https://api.banksim.ca"},
      {"name": "BSIM_CLIENT_ID", "value": "ssim-store"},
      {"name": "BSIM_CLIENT_SECRET", "value": "<SSIM_BSIM_CLIENT_SECRET>"},
      {"name": "BSIM_REDIRECT_URI", "value": "https://ssim.banksim.ca/auth/callback"},
      {"name": "NSIM_API_URL", "value": "https://payment.banksim.ca"},
      {"name": "WSIM_AUTH_URL", "value": "https://wsim-auth.banksim.ca"},
      {"name": "WSIM_API_URL", "value": "https://wsim.banksim.ca/api"},
      {"name": "WSIM_CLIENT_ID", "value": "ssim-merchant"},
      {"name": "WSIM_CLIENT_SECRET", "value": "<SSIM_WSIM_CLIENT_SECRET>"},
      {"name": "WSIM_API_KEY", "value": "<SSIM_WSIM_API_KEY>"}
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/bsim-ssim",
        "awslogs-region": "ca-central-1",
        "awslogs-stream-prefix": "ecs"
      }
    },
    "healthCheck": {
      "command": ["CMD-SHELL", "wget --quiet --tries=1 --spider http://localhost:3005/health || exit 1"],
      "interval": 30,
      "timeout": 5,
      "retries": 3,
      "startPeriod": 60
    }
  }]
}
```

### Register Task Definitions

```bash
aws ecs register-task-definition --cli-input-json file://aws/wsim-backend-task-definition.json --region ca-central-1
aws ecs register-task-definition --cli-input-json file://aws/wsim-auth-server-task-definition.json --region ca-central-1
aws ecs register-task-definition --cli-input-json file://aws/wsim-frontend-task-definition.json --region ca-central-1
aws ecs register-task-definition --cli-input-json file://aws/ssim-task-definition.json --region ca-central-1
```

---

## Phase 7: Create Target Groups

```bash
# Get VPC ID
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" --query 'Vpcs[0].VpcId' --output text --region ca-central-1)

# WSIM Backend (API routing via path)
aws elbv2 create-target-group \
  --name bsim-wsim-backend-tg \
  --protocol HTTP \
  --port 3003 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-path /health \
  --region ca-central-1

# WSIM Auth Server
aws elbv2 create-target-group \
  --name bsim-wsim-auth-tg \
  --protocol HTTP \
  --port 3005 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-path /.well-known/openid-configuration \
  --region ca-central-1

# WSIM Frontend
aws elbv2 create-target-group \
  --name bsim-wsim-frontend-tg \
  --protocol HTTP \
  --port 3000 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-path / \
  --region ca-central-1

# SSIM
aws elbv2 create-target-group \
  --name bsim-ssim-tg \
  --protocol HTTP \
  --port 3005 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-path /health \
  --region ca-central-1
```

---

## Phase 8: ALB Listener Rules

Get current ALB and listener ARNs:

```bash
# Get ALB ARN
ALB_ARN=$(aws elbv2 describe-load-balancers --names bsim-alb --query 'LoadBalancers[0].LoadBalancerArn' --output text --region ca-central-1)

# Get HTTPS Listener ARN
LISTENER_ARN=$(aws elbv2 describe-listeners --load-balancer-arn $ALB_ARN --query 'Listeners[?Port==`443`].ListenerArn' --output text --region ca-central-1)
```

Create routing rules (adjust priorities based on existing rules):

```bash
# WSIM Backend API (wsim.banksim.ca/api/*)
aws elbv2 create-rule \
  --listener-arn $LISTENER_ARN \
  --priority 10 \
  --conditions '[{"Field":"host-header","Values":["wsim.banksim.ca"]},{"Field":"path-pattern","Values":["/api/*"]}]' \
  --actions '[{"Type":"forward","TargetGroupArn":"<wsim-backend-tg-arn>"}]' \
  --region ca-central-1

# WSIM Auth Server (wsim-auth.banksim.ca)
aws elbv2 create-rule \
  --listener-arn $LISTENER_ARN \
  --priority 11 \
  --conditions '[{"Field":"host-header","Values":["wsim-auth.banksim.ca"]}]' \
  --actions '[{"Type":"forward","TargetGroupArn":"<wsim-auth-tg-arn>"}]' \
  --region ca-central-1

# WSIM Frontend (wsim.banksim.ca - default for host)
aws elbv2 create-rule \
  --listener-arn $LISTENER_ARN \
  --priority 12 \
  --conditions '[{"Field":"host-header","Values":["wsim.banksim.ca"]}]' \
  --actions '[{"Type":"forward","TargetGroupArn":"<wsim-frontend-tg-arn>"}]' \
  --region ca-central-1

# SSIM (ssim.banksim.ca)
aws elbv2 create-rule \
  --listener-arn $LISTENER_ARN \
  --priority 13 \
  --conditions '[{"Field":"host-header","Values":["ssim.banksim.ca"]}]' \
  --actions '[{"Type":"forward","TargetGroupArn":"<ssim-tg-arn>"}]' \
  --region ca-central-1
```

---

## Phase 9: Route 53 DNS Records

Add DNS records for new subdomains pointing to the ALB:

```bash
# Get hosted zone ID
ZONE_ID=$(aws route53 list-hosted-zones-by-name --dns-name banksim.ca --query 'HostedZones[0].Id' --output text)

# Get ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers --names bsim-alb --query 'LoadBalancers[0].DNSName' --output text --region ca-central-1)

# Create records for wsim.banksim.ca, wsim-auth.banksim.ca, ssim.banksim.ca
aws route53 change-resource-record-sets --hosted-zone-id $ZONE_ID --change-batch '{
  "Changes": [
    {
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "wsim.banksim.ca",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z0873002WND1F31PXPWG",
          "DNSName": "'$ALB_DNS'",
          "EvaluateTargetHealth": true
        }
      }
    },
    {
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "wsim-auth.banksim.ca",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z0873002WND1F31PXPWG",
          "DNSName": "'$ALB_DNS'",
          "EvaluateTargetHealth": true
        }
      }
    },
    {
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "ssim.banksim.ca",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z0873002WND1F31PXPWG",
          "DNSName": "'$ALB_DNS'",
          "EvaluateTargetHealth": true
        }
      }
    }
  ]
}'
```

---

## Phase 10: Create ECS Services

Get subnet and security group IDs:

```bash
# Get existing BSIM service config for reference
aws ecs describe-services --cluster bsim-cluster --services bsim-backend-service --query 'services[0].networkConfiguration' --region ca-central-1
```

Create services:

```bash
# Get security group and subnets from existing service
SUBNETS="subnet-xxx,subnet-yyy"
SECURITY_GROUP="sg-xxx"

# WSIM Backend Service
aws ecs create-service \
  --cluster bsim-cluster \
  --service-name bsim-wsim-backend-service \
  --task-definition bsim-wsim-backend \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SECURITY_GROUP],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=<wsim-backend-tg-arn>,containerName=wsim-backend,containerPort=3003" \
  --region ca-central-1

# WSIM Auth Server Service
aws ecs create-service \
  --cluster bsim-cluster \
  --service-name bsim-wsim-auth-service \
  --task-definition bsim-wsim-auth-server \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SECURITY_GROUP],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=<wsim-auth-tg-arn>,containerName=wsim-auth-server,containerPort=3005" \
  --region ca-central-1

# WSIM Frontend Service
aws ecs create-service \
  --cluster bsim-cluster \
  --service-name bsim-wsim-frontend-service \
  --task-definition bsim-wsim-frontend \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SECURITY_GROUP],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=<wsim-frontend-tg-arn>,containerName=wsim-frontend,containerPort=3000" \
  --region ca-central-1

# SSIM Service
aws ecs create-service \
  --cluster bsim-cluster \
  --service-name bsim-ssim-service \
  --task-definition bsim-ssim \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SECURITY_GROUP],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=<ssim-tg-arn>,containerName=ssim,containerPort=3005" \
  --region ca-central-1
```

---

## Phase 11: OAuth Client Registration

### 11.1 Register WSIM as OAuth Client in BSIM

Run this against the BSIM database:

```sql
-- Insert WSIM as an OAuth client in BSIM's auth-server
INSERT INTO "OAuthClient" (
  id,
  "clientId",
  "clientSecret",
  name,
  "redirectUris",
  grants,
  scopes,
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid(),
  'wsim-wallet',
  '<WSIM_BSIM_CLIENT_SECRET_HASHED>',
  'WSIM Digital Wallet',
  '["https://wsim.banksim.ca/auth/callback"]',
  '["authorization_code", "refresh_token"]',
  '["openid", "profile", "accounts", "transactions", "payments"]',
  NOW(),
  NOW()
);
```

### 11.2 Register SSIM as OAuth Client in BSIM

```sql
-- Insert SSIM as an OAuth client in BSIM
INSERT INTO "OAuthClient" (
  id,
  "clientId",
  "clientSecret",
  name,
  "redirectUris",
  grants,
  scopes,
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid(),
  'ssim-store',
  '<SSIM_BSIM_CLIENT_SECRET_HASHED>',
  'SSIM Store Simulator',
  '["https://ssim.banksim.ca/auth/callback"]',
  '["authorization_code", "refresh_token"]',
  '["openid", "profile", "accounts", "payments"]',
  NOW(),
  NOW()
);
```

### 11.3 Register SSIM as OAuth Client in WSIM

Run this against the WSIM database:

```sql
-- Insert SSIM as an OAuth client in WSIM
INSERT INTO "OAuthClient" (
  id,
  "clientId",
  "clientSecret",
  name,
  "redirectUris",
  grants,
  scopes,
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid(),
  'ssim-merchant',
  '<SSIM_WSIM_CLIENT_SECRET_HASHED>',
  'SSIM Store - Wallet Payments',
  '["https://ssim.banksim.ca/wallet/callback"]',
  '["authorization_code"]',
  '["openid", "wallet:pay"]',
  NOW(),
  NOW()
);
```

---

## Phase 12: Security Group Updates

Ensure the ECS security group allows traffic from ALB on new ports:

```bash
# Allow port 3003 (WSIM backend) from ALB
aws ec2 authorize-security-group-ingress \
  --group-id <ecs-sg-id> \
  --protocol tcp \
  --port 3003 \
  --source-group <alb-sg-id> \
  --region ca-central-1

# Port 3005 should already be open (used by SSIM and WSIM auth)
# Verify with:
aws ec2 describe-security-groups --group-ids <ecs-sg-id> --region ca-central-1
```

---

## Phase 13: Verification

### 13.1 Check Service Health

```bash
# List all services
aws ecs list-services --cluster bsim-cluster --region ca-central-1

# Check each new service
for svc in bsim-wsim-backend-service bsim-wsim-auth-service bsim-wsim-frontend-service bsim-ssim-service; do
  echo "=== $svc ==="
  aws ecs describe-services --cluster bsim-cluster --services $svc --query 'services[0].{status:status,running:runningCount,desired:desiredCount}' --region ca-central-1
done
```

### 13.2 Check Target Group Health

```bash
for tg in bsim-wsim-backend-tg bsim-wsim-auth-tg bsim-wsim-frontend-tg bsim-ssim-tg; do
  echo "=== $tg ==="
  TG_ARN=$(aws elbv2 describe-target-groups --names $tg --query 'TargetGroups[0].TargetGroupArn' --output text --region ca-central-1)
  aws elbv2 describe-target-health --target-group-arn $TG_ARN --region ca-central-1
done
```

### 13.3 Test Endpoints

```bash
# WSIM endpoints
curl -I https://wsim.banksim.ca/
curl -I https://wsim.banksim.ca/api/health
curl -I https://wsim-auth.banksim.ca/.well-known/openid-configuration

# SSIM endpoints
curl -I https://ssim.banksim.ca/
curl -I https://ssim.banksim.ca/health
```

### 13.4 Check Logs

```bash
aws logs tail /ecs/bsim-wsim-backend --follow --region ca-central-1
aws logs tail /ecs/bsim-wsim-auth-server --follow --region ca-central-1
aws logs tail /ecs/bsim-wsim-frontend --follow --region ca-central-1
aws logs tail /ecs/bsim-ssim --follow --region ca-central-1
```

---

## Rollback Plan

If issues occur, services can be stopped without affecting existing BSIM services:

```bash
# Scale down new services to 0
aws ecs update-service --cluster bsim-cluster --service bsim-wsim-backend-service --desired-count 0 --region ca-central-1
aws ecs update-service --cluster bsim-cluster --service bsim-wsim-auth-service --desired-count 0 --region ca-central-1
aws ecs update-service --cluster bsim-cluster --service bsim-wsim-frontend-service --desired-count 0 --region ca-central-1
aws ecs update-service --cluster bsim-cluster --service bsim-ssim-service --desired-count 0 --region ca-central-1
```

The WSIM database is completely separate from BSIM, so no data loss risk to existing banking data.

---

## Cost Estimate (Incremental)

| Resource | Monthly Cost |
|----------|-------------|
| 4 Fargate tasks (WSIM backend, auth, frontend, SSIM) | ~$40-50 |
| Additional ALB rules | $0 (included) |
| CloudWatch Logs | ~$5 |
| **Total Additional** | **~$45-55/month** |

---

## Execution Checklist

- [ ] Phase 1: Create WSIM database in RDS
- [ ] Phase 2: Create ECR repositories
- [ ] Phase 3: Build and push all Docker images
- [ ] Phase 4: Create CloudWatch log groups
- [ ] Phase 5: Generate and securely store production secrets
- [ ] Phase 6: Create and register ECS task definitions
- [ ] Phase 7: Create target groups
- [ ] Phase 8: Create ALB listener rules
- [ ] Phase 9: Create Route 53 DNS records
- [ ] Phase 10: Create ECS services
- [ ] Phase 11: Register OAuth clients (BSIM and WSIM databases)
- [ ] Phase 12: Verify security group rules
- [ ] Phase 13: Verification and testing
