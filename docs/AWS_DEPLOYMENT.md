# AWS Deployment Guide - BSIM Banking Simulator

This guide walks you through deploying BSIM to AWS using ECS Fargate, RDS PostgreSQL, and Application Load Balancer.

---

## Multi-Repository Ecosystem

> **IMPORTANT:** The BSIM ecosystem spans multiple repositories. This repository (BSIM) serves as the **orchestrator** for AWS deployment, managing infrastructure for components that live in separate repos.

### Repository Structure

| Repository | Description | Deployed To |
|------------|-------------|-------------|
| **[bsim](https://github.com/jordancrombie/bsim)** | Core banking simulator (this repo) - Frontend, Admin, Auth Server, Open Banking, Backend | `yourbanksimdomain.com`, `admin.*`, `auth.*`, `openbanking.*`, `api.*` |
| **[ssim](https://github.com/jordancrombie/ssim)** | Store Simulator - Third-party merchant demo app | `ssim.yourbanksimdomain.com` |
| **[nsim](https://github.com/jordancrombie/nsim)** | Payment Network Simulator - Routes payments between merchants and banks | `payment.yourbanksimdomain.com` |

### How It Works

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              BSIM Ecosystem                                      │
│                                                                                  │
│   ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐          │
│   │   BSIM Repo     │     │   SSIM Repo     │     │   NSIM Repo     │          │
│   │  (This Repo)    │     │   (Separate)    │     │   (Separate)    │          │
│   │                 │     │                 │     │                 │          │
│   │  • Frontend     │     │  • Store UI     │     │  • Payment API  │          │
│   │  • Admin        │     │  • OAuth Client │     │  • Webhooks     │          │
│   │  • Auth Server  │     │  • Checkout     │     │  • Redis Queue  │          │
│   │  • Open Banking │     │                 │     │                 │          │
│   │  • Backend      │     │                 │     │                 │          │
│   │                 │     │                 │     │                 │          │
│   │  ─────────────  │     │                 │     │                 │          │
│   │  AWS Config:    │     │                 │     │                 │          │
│   │  • docker-compose│    │                 │     │                 │          │
│   │  • Task Defs    │     │                 │     │                 │          │
│   │  • ALB Rules    │     │                 │     │                 │          │
│   │  • All Services │     │                 │     │                 │          │
│   └────────┬────────┘     └────────┬────────┘     └────────┬────────┘          │
│            │                       │                       │                    │
│            └───────────────────────┴───────────────────────┘                    │
│                                    │                                            │
│                    ┌───────────────▼───────────────┐                            │
│                    │      Shared AWS Infrastructure │                            │
│                    │  • ECS Cluster (bsim-cluster)  │                            │
│                    │  • ALB (bsim-alb)              │                            │
│                    │  • RDS PostgreSQL              │                            │
│                    │  • ElastiCache Redis           │                            │
│                    │  • Route 53 (yourbanksimdomain.com)       │                            │
│                    └────────────────────────────────┘                            │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Key Points

1. **BSIM is the "showrunner"**: All AWS deployment configuration lives here, including:
   - Task definitions for all services (including SSIM and NSIM)
   - ALB listener rules
   - Security groups
   - docker-compose files that reference external repos

2. **Separate repos, unified deployment**: SSIM and NSIM have their own repos for development, but their Docker images are pushed to the same ECR and deployed to the same ECS cluster.

3. **Shared infrastructure**: All services share:
   - VPC and subnets
   - Application Load Balancer
   - RDS PostgreSQL database
   - ElastiCache Redis (for NSIM)
   - SSL certificate (*.yourbanksimdomain.com)

4. **Cross-repo references**: The `docker-compose.yml` in this repo references NSIM via relative path (`../nsim`). For local development, clone all repos as siblings.

### Local Development Setup

```bash
# Clone all repos as siblings
cd ~/projects
git clone https://github.com/jordancrombie/bsim
git clone https://github.com/jordancrombie/ssim
git clone https://github.com/jordancrombie/nsim

# Directory structure should be:
# ~/projects/
#   ├── bsim/        # This repo
#   ├── ssim/        # Store simulator
#   └── nsim/        # Payment network

# Start everything from BSIM
cd bsim
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                                      AWS Cloud                                            │
│                                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                         Application Load Balancer (ALB)                              │ │
│  │                           with AWS Certificate Manager                               │ │
│  │   Routes: yourbanksimdomain.com, admin.*, auth.*, openbanking.*, api.*, ssim.*, payment.*      │ │
│  └──┬────────┬──────────┬───────────────┬──────────────┬──────────────┬────────┬───────┘ │
│     │        │          │               │              │              │        │         │
│  ┌──▼───┐ ┌──▼───┐ ┌────▼────┐  ┌──────▼──────┐ ┌─────▼─────┐ ┌──────▼──────┐ ┌▼──────┐ │
│  │Front │ │Admin │ │Auth Srv │  │ OpenBanking │ │  Backend  │ │    SSIM     │ │ NSIM  │ │
│  │:3000 │ │:3002 │ │  :3003  │  │    :3004    │ │   :3001   │ │   :3005     │ │ :3006 │ │
│  │      │ │      │ │         │  │             │ │           │ │             │ │       │ │
│  │ BSIM │ │ BSIM │ │  BSIM   │  │    BSIM     │ │   BSIM    │ │ SSIM Repo   │ │ NSIM  │ │
│  │ Repo │ │ Repo │ │  Repo   │  │    Repo     │ │   Repo    │ │ (external)  │ │ Repo  │ │
│  └──┬───┘ └──┬───┘ └────┬────┘  └──────┬──────┘ └─────┬─────┘ └──────┬──────┘ └┬──────┘ │
│     │        │          │              │              │              │         │        │
│     └────────┴──────────┴──────────────┴──────────────┼──────────────┘         │        │
│                                                       │                        │        │
│                                        ┌──────────────▼───────────┐            │        │
│                                        │    RDS PostgreSQL        │            │        │
│                                        │     (Shared DB)          │            │        │
│                                        └──────────────────────────┘            │        │
│                                                                                │        │
│                                        ┌───────────────────────────────────────▼──────┐ │
│                                        │          ElastiCache Redis                   │ │
│                                        │      (NSIM Job Queue & Webhooks)             │ │
│                                        └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### Services Overview

| Service | Subdomain | Port | Repository | Description |
|---------|-----------|------|------------|-------------|
| Frontend | yourbanksimdomain.com | 3000 | bsim | Customer-facing Next.js app |
| Admin | admin.yourbanksimdomain.com | 3002 | bsim | Admin dashboard |
| Auth Server | auth.yourbanksimdomain.com | 3003 | bsim | OIDC Authorization Server |
| Open Banking | openbanking.yourbanksimdomain.com | 3004 | bsim | FDX-inspired resource API |
| Backend | api.yourbanksimdomain.com | 3001 | bsim | Core banking API |
| SSIM | ssim.yourbanksimdomain.com | 3005 | **ssim** (external) | Store Simulator merchant demo |
| NSIM | payment.yourbanksimdomain.com | 3006 | **nsim** (external) | Payment Network middleware |

> **External Repositories:**
> - **SSIM** (Store Simulator): https://github.com/jordancrombie/ssim - Demonstrates OAuth/OIDC integration and payment flows from a merchant perspective.
> - **NSIM** (Payment Network): https://github.com/jordancrombie/nsim - Routes payments between merchants (SSIM) and banks (BSIM), provides webhooks and retry logic.

---

## Prerequisites

- AWS Account with administrative access
- AWS CLI installed and configured
- Docker installed locally
- Domain name configured in Route 53 (or external DNS pointing to AWS)

## Step-by-Step Deployment

### 1. Set Up AWS Infrastructure

#### 1.1 Create VPC and Networking

```bash
# Use default VPC or create a new one
aws ec2 describe-vpcs

# Note your VPC ID, subnet IDs, and security group IDs
VPC_ID="vpc-xxxxxxxxx"
SUBNET_1="subnet-xxxxxxxxx"
SUBNET_2="subnet-xxxxxxxxx"
```

#### 1.2 Create RDS PostgreSQL Database

```bash
# Create DB subnet group
aws rds create-db-subnet-group \
  --db-subnet-group-name bsim-db-subnet-group \
  --db-subnet-group-description "BSIM Database Subnet Group" \
  --subnet-ids $SUBNET_1 $SUBNET_2

# Create security group for RDS
aws ec2 create-security-group \
  --group-name bsim-rds-sg \
  --description "Security group for BSIM RDS" \
  --vpc-id $VPC_ID

# Allow PostgreSQL access from ECS tasks (update CIDR as needed)
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxxxxxx \
  --protocol tcp \
  --port 5432 \
  --cidr 10.0.0.0/16

# Create RDS PostgreSQL instance
aws rds create-db-instance \
  --db-instance-identifier bsim-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 15.4 \
  --master-username bsim \
  --master-user-password YOUR_SECURE_PASSWORD \
  --allocated-storage 20 \
  --storage-type gp3 \
  --db-subnet-group-name bsim-db-subnet-group \
  --vpc-security-group-ids sg-xxxxxxxxx \
  --backup-retention-period 7 \
  --publicly-accessible false

# Wait for RDS to be available (this takes ~10 minutes)
aws rds wait db-instance-available --db-instance-identifier bsim-db

# Get RDS endpoint
aws rds describe-db-instances \
  --db-instance-identifier bsim-db \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text
```

### 2. Set Up Container Registry (ECR)

```bash
# Create ECR repositories for all services
aws ecr create-repository --repository-name bsim/backend
aws ecr create-repository --repository-name bsim/frontend
aws ecr create-repository --repository-name bsim/admin
aws ecr create-repository --repository-name bsim/auth-server
aws ecr create-repository --repository-name bsim/openbanking

# Get ECR login credentials
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Build and push all services
# IMPORTANT: ECS Fargate runs linux/amd64 - if building on Apple Silicon (M1/M2/M3),
# you MUST specify --platform linux/amd64 or tasks will fail with:
# "CannotPullContainerError: image Manifest does not contain descriptor matching platform"

# Build backend services (no build args needed)
# NOTE: Use --no-cache for subsequent rebuilds to ensure latest code is included!
for service in backend auth-server openbanking; do
  cd $service
  docker build --no-cache --platform linux/amd64 -t bsim/$service .
  docker tag bsim/$service:latest ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/bsim/$service:latest
  docker push ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/bsim/$service:latest
  cd ..
done

# Build frontend (Next.js - REQUIRES build args!)
# WARNING: NEXT_PUBLIC_* variables are baked in at BUILD TIME, not runtime!
# Forgetting these will cause 404 errors when the app tries to reach the API.
# NOTE: Use --no-cache for subsequent rebuilds to ensure latest code is included!
cd frontend
docker build --no-cache --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_API_URL=https://api.yourbanksimdomain.com/api \
  --build-arg NEXT_PUBLIC_DOMAIN=yourbanksimdomain.com \
  --build-arg NEXT_PUBLIC_BACKEND_PORT=443 \
  -t bsim/frontend .
docker tag bsim/frontend:latest ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/bsim/frontend:latest
docker push ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/bsim/frontend:latest
cd ..

# Build admin (Next.js - REQUIRES build args!)
# NOTE: Use --no-cache for subsequent rebuilds to ensure latest code is included!
cd admin
docker build --no-cache --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_API_URL=https://api.yourbanksimdomain.com/api \
  --build-arg NEXT_PUBLIC_DOMAIN=yourbanksimdomain.com \
  -t bsim/admin .
docker tag bsim/admin:latest ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/bsim/admin:latest
docker push ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/bsim/admin:latest
cd ..
```

> **Architecture Note:**
> - **AWS/ECS builds**: Always use `--platform linux/amd64` (Fargate runs x86_64)
> - **Local development**: Use native architecture (ARM64 on Apple Silicon, amd64 on Intel)

> **⚠️ Critical: Next.js Build Arguments**
>
> The `frontend` and `admin` services are Next.js apps that require `NEXT_PUBLIC_*` environment variables
> to be passed as **build arguments**. These values are baked into the JavaScript bundle at build time
> and cannot be changed at runtime. If you forget these build args:
> - The app will build successfully
> - But API calls will fail with 404 errors (hitting wrong endpoints)
> - The app will appear broken in production
>
> Always verify the build args match your production domain before deploying!

### 3. Create ECS Cluster

```bash
# Create ECS cluster
aws ecs create-cluster --cluster-name bsim-cluster

# Create CloudWatch log groups for all services
aws logs create-log-group --log-group-name /ecs/bsim/backend
aws logs create-log-group --log-group-name /ecs/bsim/frontend
aws logs create-log-group --log-group-name /ecs/bsim/admin
aws logs create-log-group --log-group-name /ecs/bsim/auth-server
aws logs create-log-group --log-group-name /ecs/bsim/openbanking
```

### 4. Create IAM Roles

```bash
# Create ECS Task Execution Role (for pulling images and logging)
cat > ecs-task-execution-role-trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs-tasks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

aws iam create-role \
  --role-name ecsTaskExecutionRole \
  --assume-role-policy-document file://ecs-task-execution-role-trust-policy.json

aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
```

### 5. Create ECS Task Definitions

Create `backend-task-definition.json`:

```json
{
  "family": "bsim-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::ACCOUNT_ID:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/bsim/backend:latest",
      "portMappings": [
        {
          "containerPort": 3001,
          "protocol": "tcp"
        }
      ],
      "essential": true,
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "PORT",
          "value": "3001"
        },
        {
          "name": "DATABASE_URL",
          "value": "postgresql://bsim:YOUR_PASSWORD@RDS_ENDPOINT:5432/bsim"
        },
        {
          "name": "JWT_SECRET",
          "value": "YOUR_PRODUCTION_JWT_SECRET"
        },
        {
          "name": "DOMAIN",
          "value": "yourbanksimdomain.com"
        },
        {
          "name": "CORS_ORIGIN",
          "value": "https://yourbanksimdomain.com"
        },
        {
          "name": "RP_ID",
          "value": "yourbanksimdomain.com"
        },
        {
          "name": "ORIGIN",
          "value": "https://yourbanksimdomain.com"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/bsim/backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "node -e \"require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})\""],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

Create `frontend-task-definition.json`:

```json
{
  "family": "bsim-frontend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::ACCOUNT_ID:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "frontend",
      "image": "ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/bsim/frontend:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "essential": true,
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "PORT",
          "value": "3000"
        },
        {
          "name": "NEXT_PUBLIC_DOMAIN",
          "value": "yourbanksimdomain.com"
        },
        {
          "name": "NEXT_PUBLIC_API_URL",
          "value": "https://api.yourbanksimdomain.com/api"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/bsim/frontend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "node -e \"require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})\""],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

Create `auth-server-task-definition.json`:

```json
{
  "family": "bsim-auth-server",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::ACCOUNT_ID:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "auth-server",
      "image": "ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/bsim/auth-server:latest",
      "portMappings": [
        {
          "containerPort": 3003,
          "protocol": "tcp"
        }
      ],
      "essential": true,
      "environment": [
        { "name": "NODE_ENV", "value": "production" },
        { "name": "PORT", "value": "3003" },
        { "name": "ISSUER", "value": "https://auth.yourbanksimdomain.com" },
        { "name": "DATABASE_URL", "value": "postgresql://bsim:YOUR_PASSWORD@RDS_ENDPOINT:5432/bsim" },
        { "name": "COOKIE_SECRET", "value": "YOUR_COOKIE_SECRET" }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/bsim/auth-server",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "node -e \"require('http').get('http://localhost:3003/.well-known/openid-configuration', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})\""],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

Create `openbanking-task-definition.json`:

```json
{
  "family": "bsim-openbanking",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::ACCOUNT_ID:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "openbanking",
      "image": "ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/bsim/openbanking:latest",
      "portMappings": [
        {
          "containerPort": 3004,
          "protocol": "tcp"
        }
      ],
      "essential": true,
      "environment": [
        { "name": "NODE_ENV", "value": "production" },
        { "name": "PORT", "value": "3004" },
        { "name": "DATABASE_URL", "value": "postgresql://bsim:YOUR_PASSWORD@RDS_ENDPOINT:5432/bsim" },
        { "name": "AUTH_SERVER_ISSUER", "value": "https://auth.yourbanksimdomain.com" },
        { "name": "JWKS_URI", "value": "https://auth.yourbanksimdomain.com/.well-known/jwks.json" },
        { "name": "CORS_ORIGIN", "value": "*" }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/bsim/openbanking",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "node -e \"require('http').get('http://localhost:3004/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})\""],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

Register task definitions:

```bash
aws ecs register-task-definition --cli-input-json file://backend-task-definition.json
aws ecs register-task-definition --cli-input-json file://frontend-task-definition.json
aws ecs register-task-definition --cli-input-json file://auth-server-task-definition.json
aws ecs register-task-definition --cli-input-json file://openbanking-task-definition.json
```

### 6. Create Application Load Balancer

```bash
# Create security group for ALB
aws ec2 create-security-group \
  --group-name bsim-alb-sg \
  --description "Security group for BSIM ALB" \
  --vpc-id $VPC_ID

# Allow HTTP and HTTPS
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxxxxxx \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxxxxxx \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0

# Create ALB
aws elbv2 create-load-balancer \
  --name bsim-alb \
  --subnets $SUBNET_1 $SUBNET_2 \
  --security-groups sg-xxxxxxxxx \
  --scheme internet-facing \
  --type application

# Create target groups for all services
aws elbv2 create-target-group \
  --name bsim-backend-tg \
  --protocol HTTP \
  --port 3001 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-path /health

aws elbv2 create-target-group \
  --name bsim-frontend-tg \
  --protocol HTTP \
  --port 3000 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-path /

aws elbv2 create-target-group \
  --name bsim-admin-tg \
  --protocol HTTP \
  --port 3002 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-path /

aws elbv2 create-target-group \
  --name bsim-auth-server-tg \
  --protocol HTTP \
  --port 3003 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-path /.well-known/openid-configuration

aws elbv2 create-target-group \
  --name bsim-openbanking-tg \
  --protocol HTTP \
  --port 3004 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-path /health
```

### 7. Request SSL Certificate (AWS Certificate Manager)

```bash
# Request certificate for yourbanksimdomain.com and *.yourbanksimdomain.com
aws acm request-certificate \
  --domain-name yourbanksimdomain.com \
  --subject-alternative-names *.yourbanksimdomain.com \
  --validation-method DNS

# Follow DNS validation instructions in AWS Console
# Add the CNAME records to your DNS provider
```

### 8. Create ALB Listeners

```bash
# Get certificate ARN
CERT_ARN=$(aws acm list-certificates --query "CertificateSummaryList[?DomainName=='yourbanksimdomain.com'].CertificateArn" --output text)

# Create HTTPS listener for frontend (default)
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:... \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=$CERT_ARN \
  --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:.../bsim-frontend-tg

# Create rule for backend API (api.yourbanksimdomain.com)
aws elbv2 create-rule \
  --listener-arn arn:aws:elasticloadbalancing:... \
  --priority 1 \
  --conditions Field=host-header,Values=api.yourbanksimdomain.com \
  --actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:.../bsim-backend-tg

# Create rule for admin (admin.yourbanksimdomain.com)
aws elbv2 create-rule \
  --listener-arn arn:aws:elasticloadbalancing:... \
  --priority 2 \
  --conditions Field=host-header,Values=admin.yourbanksimdomain.com \
  --actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:.../bsim-admin-tg

# Create rule for auth server (auth.yourbanksimdomain.com)
aws elbv2 create-rule \
  --listener-arn arn:aws:elasticloadbalancing:... \
  --priority 3 \
  --conditions Field=host-header,Values=auth.yourbanksimdomain.com \
  --actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:.../bsim-auth-server-tg

# Create rule for open banking API (openbanking.yourbanksimdomain.com)
aws elbv2 create-rule \
  --listener-arn arn:aws:elasticloadbalancing:... \
  --priority 4 \
  --conditions Field=host-header,Values=openbanking.yourbanksimdomain.com \
  --actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:.../bsim-openbanking-tg

# Create HTTP to HTTPS redirect
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:... \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=redirect,RedirectConfig="{Protocol=HTTPS,Port=443,StatusCode=HTTP_301}"
```

### 9. Create ECS Services

```bash
# Create security group for ECS tasks
aws ec2 create-security-group \
  --group-name bsim-ecs-sg \
  --description "Security group for BSIM ECS tasks" \
  --vpc-id $VPC_ID

# Allow traffic from ALB on all service ports
for port in 3000 3001 3002 3003 3004; do
  aws ec2 authorize-security-group-ingress \
    --group-id sg-ecs-xxxxxxxxx \
    --protocol tcp \
    --port $port \
    --source-group sg-alb-xxxxxxxxx
done

# Create backend service
aws ecs create-service \
  --cluster bsim-cluster \
  --service-name bsim-backend-service \
  --task-definition bsim-backend \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_1,$SUBNET_2],securityGroups=[sg-ecs-xxxxxxxxx],assignPublicIp=ENABLED}" \
  --load-balancers targetGroupArn=arn:aws:elasticloadbalancing:.../bsim-backend-tg,containerName=backend,containerPort=3001

# Create frontend service
aws ecs create-service \
  --cluster bsim-cluster \
  --service-name bsim-frontend-service \
  --task-definition bsim-frontend \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_1,$SUBNET_2],securityGroups=[sg-ecs-xxxxxxxxx],assignPublicIp=ENABLED}" \
  --load-balancers targetGroupArn=arn:aws:elasticloadbalancing:.../bsim-frontend-tg,containerName=frontend,containerPort=3000

# Create admin service
aws ecs create-service \
  --cluster bsim-cluster \
  --service-name bsim-admin-service \
  --task-definition bsim-admin \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_1,$SUBNET_2],securityGroups=[sg-ecs-xxxxxxxxx],assignPublicIp=ENABLED}" \
  --load-balancers targetGroupArn=arn:aws:elasticloadbalancing:.../bsim-admin-tg,containerName=admin,containerPort=3002

# Create auth server service
aws ecs create-service \
  --cluster bsim-cluster \
  --service-name bsim-auth-server-service \
  --task-definition bsim-auth-server \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_1,$SUBNET_2],securityGroups=[sg-ecs-xxxxxxxxx],assignPublicIp=ENABLED}" \
  --load-balancers targetGroupArn=arn:aws:elasticloadbalancing:.../bsim-auth-server-tg,containerName=auth-server,containerPort=3003

# Create open banking service
aws ecs create-service \
  --cluster bsim-cluster \
  --service-name bsim-openbanking-service \
  --task-definition bsim-openbanking \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_1,$SUBNET_2],securityGroups=[sg-ecs-xxxxxxxxx],assignPublicIp=ENABLED}" \
  --load-balancers targetGroupArn=arn:aws:elasticloadbalancing:.../bsim-openbanking-tg,containerName=openbanking,containerPort=3004
```

### 10. Run Database Migrations

```bash
# Create a one-time task to run migrations
aws ecs run-task \
  --cluster bsim-cluster \
  --task-definition bsim-backend \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_1],securityGroups=[sg-ecs-xxxxxxxxx],assignPublicIp=ENABLED}" \
  --overrides '{
    "containerOverrides": [
      {
        "name": "backend",
        "command": ["npx", "prisma", "migrate", "deploy"]
      }
    ]
  }'
```

### 11. Configure DNS

Point your domain to the ALB:

```bash
# Get ALB DNS name
aws elbv2 describe-load-balancers \
  --names bsim-alb \
  --query 'LoadBalancers[0].DNSName' \
  --output text

# Create Route 53 records (or configure with your DNS provider)
# All subdomains point to the same ALB, routing is done by listener rules
# yourbanksimdomain.com -> ALB (A record alias)
# api.yourbanksimdomain.com -> ALB (A record alias)
# admin.yourbanksimdomain.com -> ALB (A record alias)
# auth.yourbanksimdomain.com -> ALB (A record alias)
# openbanking.yourbanksimdomain.com -> ALB (A record alias)
```

## Monitoring and Logs

```bash
# View logs for each service
aws logs tail /ecs/bsim/backend --follow
aws logs tail /ecs/bsim/frontend --follow
aws logs tail /ecs/bsim/admin --follow
aws logs tail /ecs/bsim/auth-server --follow
aws logs tail /ecs/bsim/openbanking --follow

# Check all service statuses
aws ecs describe-services \
  --cluster bsim-cluster \
  --services bsim-backend-service bsim-frontend-service bsim-admin-service bsim-auth-server-service bsim-openbanking-service
```

## Cost Optimization

- **Fargate Tasks**: ~$50-80/month for all 5 services (256 CPU, 512 MB each)
  - Backend (2 tasks), Frontend (2 tasks), Admin (1 task), Auth Server (2 tasks), Open Banking (2 tasks)
- **RDS t3.micro**: ~$15/month
- **ALB**: ~$20/month
- **Data Transfer**: Variable based on usage
- **Total Estimated**: ~$90-120/month

### Cost Saving Tips

1. Use single Fargate task per service for development/staging
2. Use RDS t4g.micro with Reserved Instance pricing
3. Enable auto-scaling to scale down during low traffic
4. Use CloudWatch to monitor and optimize resource usage
5. Consider combining auth-server and openbanking services in dev environments

## Security Checklist

- [ ] RDS is in private subnet (not publicly accessible)
- [ ] Use AWS Secrets Manager for sensitive environment variables
- [ ] Enable RDS encryption at rest
- [ ] Configure WAF rules on ALB
- [ ] Enable CloudWatch alarms for monitoring
- [ ] Implement backup strategy for RDS
- [ ] Use IAM roles with least privilege
- [ ] Enable VPC Flow Logs for network monitoring

## Updating the Application

### ECR Repository Names

| Service | ECR Repository |
|---------|----------------|
| BSIM Backend | `bsim/backend` |
| BSIM Auth Server | `bsim/auth-server` |
| BSIM Frontend | `bsim/frontend` |
| BSIM Admin | `bsim/admin` |
| BSIM Open Banking | `bsim/openbanking` |
| WSIM Backend | `bsim/wsim-backend` |
| WSIM Auth Server | `bsim/wsim-auth-server` |
| WSIM Frontend | `bsim/wsim-frontend` |
| SSIM | `bsim/ssim` |
| NSIM | `bsim/nsim` |

### Build and Deploy Checklist

> **⚠️ CRITICAL: Always use `--no-cache` when building for production!**
>
> Docker caches intermediate build layers. If only TypeScript source files changed (not package.json),
> Docker may reuse old `npm ci` and build layers, resulting in **outdated code being deployed**.
>
> **Symptoms of stale cached builds:**
> - New features/routes return 404
> - New environment variables not recognized
> - Recent bug fixes not applied
> - Build "succeeds" but app behaves like old version

```bash
# 1. Build with --no-cache (REQUIRED for production!)
cd /path/to/service
docker build --no-cache --platform linux/amd64 \
  -t ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com/bsim/SERVICE:latest .

# 2. For frontend/admin, DON'T FORGET the build args!
docker build --no-cache --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_API_URL=https://api.yourbanksimdomain.com/api \
  --build-arg NEXT_PUBLIC_DOMAIN=yourbanksimdomain.com \
  --build-arg NEXT_PUBLIC_BACKEND_PORT=443 \
  -t ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com/bsim/frontend:latest ./frontend

# 3. Push to ECR
aws ecr get-login-password --region REGION | \
  docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com
docker push ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com/bsim/SERVICE:latest

# 4. Force new deployment
aws ecs update-service \
  --cluster bsim-cluster \
  --service SERVICE-service \
  --force-new-deployment \
  --region REGION

# 5. Verify deployment (wait for runningCount to match desiredCount)
aws ecs describe-services --cluster bsim-cluster --services SERVICE-service --region REGION \
  --query 'services[0].deployments[*].{status:status,running:runningCount,desired:desiredCount}'
```

## Troubleshooting

### Tasks not starting
- Check CloudWatch logs for errors
- Verify security groups allow ALB to reach tasks
- Ensure task execution role has ECR pull permissions

### Database connection failures
- Verify RDS security group allows access from ECS tasks
- Check DATABASE_URL environment variable
- Ensure RDS is in same VPC as ECS tasks

### Health check failures
- Verify container port mappings
- Check application health endpoint returns 200 OK
- Review CloudWatch logs for application errors

### OAuth client errors (invalid_client_metadata, authorization failures)

**Symptom:** OAuth flow fails with `invalid_client_metadata` or similar OIDC provider errors.

**Common Cause:** Invalid `grantTypes` in the OAuth client record.

**Valid Grant Types for oidc-provider:**
- `authorization_code` - Standard OAuth 2.0 authorization code flow
- `implicit` - Implicit flow (not recommended)
- `client_credentials` - Server-to-server authentication
- `urn:ietf:params:oauth:grant-type:device_code` - Device flow

**Invalid Grant Types:**
- `refresh_token` - This is a **token type**, not a grant type! Including it causes the OIDC provider to reject the client.

**How to check:**
```sql
SELECT "clientId", "grantTypes" FROM oauth_clients WHERE "clientId" = 'your-client-id';
```

**Fix:**
```sql
UPDATE oauth_clients
SET "grantTypes" = ARRAY['authorization_code']
WHERE "clientId" = 'your-client-id';
```

**Note:** To enable refresh tokens, the client must use `authorization_code` grant and request the `offline_access` scope - not by adding `refresh_token` to grantTypes.

### Next.js frontend API URL issues (404 errors, wrong domain)

**Symptom:** Frontend makes requests to wrong URL (e.g., `/api/api/...` or wrong domain)

**Root Cause:** `NEXT_PUBLIC_*` environment variables are **baked in at build time**. They cannot be changed at runtime.

**Common Mistakes:**

1. **Double `/api/` prefix**: If your frontend code already adds `/api/` to URLs, don't include it in `NEXT_PUBLIC_API_URL`:
   ```bash
   # WRONG - If frontend code does: fetch(`${API_URL}/api/users`)
   --build-arg NEXT_PUBLIC_API_URL=https://example.com/api  # Results in /api/api/users

   # CORRECT - Set to base URL only
   --build-arg NEXT_PUBLIC_API_URL=https://example.com      # Results in /api/users
   ```

2. **Forgot build args entirely**: The frontend builds successfully but calls `localhost` or relative paths in production.

3. **Used environment vars instead of build args**: Setting `environment:` in ECS task definition has NO effect on Next.js `NEXT_PUBLIC_*` vars.

**How to verify what URL is baked into the frontend:**
```bash
# Download a JS chunk and search for the API URL
curl -sL "https://your-frontend.com/_next/static/chunks/[hash].js" | grep -o 'https://[^"]*api[^"]*' | head -5
```

**Fix:** Rebuild the Docker image with correct `--build-arg` values, push to ECR, and force redeploy:
```bash
docker build --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_API_URL=https://correct-url.com \
  -t your-image .

docker push your-ecr-repo/your-image:latest

aws ecs update-service --cluster your-cluster \
  --service your-service --force-new-deployment
```

## Next Steps

1. Set up CI/CD pipeline with GitHub Actions or AWS CodePipeline
2. Configure auto-scaling policies for ECS services
3. Set up CloudWatch dashboards for monitoring
4. Implement backup and disaster recovery procedures
5. Add AWS WAF rules for additional security
