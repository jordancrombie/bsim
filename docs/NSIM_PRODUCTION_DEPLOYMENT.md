# NSIM Production Deployment Plan

**Date:** December 3, 2025
**Status:** ✅ Complete

## Overview

This document outlines the deployment plan for NSIM (Payment Network Simulator) to AWS production infrastructure alongside BSIM.

> **Note:** NSIM is maintained in a separate repository at https://github.com/jordancrombie/nsim but is deployed as part of the BSIM AWS infrastructure. The BSIM repository serves as the orchestrator for all AWS deployments. See [AWS_DEPLOYMENT.md](../AWS_DEPLOYMENT.md) for the full multi-repository architecture.

## Architecture

```
                                 ┌─────────────────────────────────────────────────┐
                                 │            Application Load Balancer             │
                                 │   payment.banksim.ca → nsim-payment-network-tg   │
                                 └────────────────────────┬────────────────────────┘
                                                          │
                                                          ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                                     ECS Fargate                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │  Frontend   │  │   Backend   │  │ Auth Server │  │ OpenBanking │  │ Payment Network │ │
│  │   :3000     │  │    :3001    │  │    :3003    │  │    :3004    │  │     (NSIM)      │ │
│  │             │  │             │  │             │  │             │  │      :3006      │ │
│  └─────────────┘  └──────┬──────┘  └─────────────┘  └─────────────┘  └────────┬────────┘ │
│                          │                                                     │          │
│                          │  Internal HTTP: /api/payment-network/*             │          │
│                          ◄────────────────────────────────────────────────────┤          │
│                                                                                          │
│                                     ┌──────────────┐                                     │
│                                     │ ElastiCache  │                                     │
│                                     │   (Redis)    │                                     │
│                                     │    :6379     │◄─────────────────────────────────── │
│                                     └──────────────┘                                     │
└──────────────────────────────────────────────────────────────────────────────────────────┘
                                              │
                                              ▼
                                     ┌──────────────┐
                                     │     RDS      │
                                     │ PostgreSQL   │
                                     └──────────────┘
```

## New AWS Resources Required

### 1. ECR Repository
- **Repository Name:** `bsim/payment-network` (or `nsim/payment-network`)
- **Repository URI:** `301868770392.dkr.ecr.ca-central-1.amazonaws.com/bsim/payment-network`

### 2. CloudWatch Log Group
- **Log Group Name:** `/ecs/bsim-payment-network`

### 3. ECS Task Definition
- **Family:** `bsim-payment-network`
- **CPU:** 256 (0.25 vCPU)
- **Memory:** 512 MB
- **Port:** 3006

### 4. Target Group
- **Name:** `nsim-payment-network-tg`
- **Port:** 3006
- **Health Check:** `/health`
- **Protocol:** HTTP

### 5. ALB Listener Rule
- **Host:** `payment.banksim.ca`
- **Target:** `nsim-payment-network-tg`
- **Priority:** 6 (after existing services)

### 6. Security Group Update
- Add port 3006 to `bsim-ecs-sg` (sg-06aaaf996187d82fc)

### 7. ElastiCache Redis (Production Option)
**Option A: ElastiCache Serverless (Recommended for simplicity)**
- Pay-per-use, no sizing decisions
- ~$0.125/GB-hr for data storage
- ~$6/million ECPUs

**Option B: ElastiCache Node**
- **Instance Type:** cache.t4g.micro
- **Cost:** ~$12/month
- **Security Group:** New `bsim-redis-sg`

**Option C: Self-managed Redis container**
- Run Redis as another ECS Fargate task
- Ephemeral storage (data lost on restart)
- Suitable for dev/staging, NOT for production webhooks

---

## Deployment Steps

### Step 1: Create ECR Repository

```bash
aws ecr create-repository \
  --repository-name bsim/payment-network \
  --region ca-central-1
```

### Step 2: Create CloudWatch Log Group

```bash
aws logs create-log-group \
  --log-group-name /ecs/bsim-payment-network \
  --region ca-central-1
```

### Step 3: Build and Push Docker Image

```bash
# Login to ECR
aws ecr get-login-password --region ca-central-1 | \
  docker login --username AWS --password-stdin 301868770392.dkr.ecr.ca-central-1.amazonaws.com

# Build NSIM (from bsim directory, since that's where docker-compose references it)
cd /Users/jcrombie/ai/nsim
docker build --platform linux/amd64 -t bsim/payment-network .

# Tag and push
docker tag bsim/payment-network:latest \
  301868770392.dkr.ecr.ca-central-1.amazonaws.com/bsim/payment-network:latest
docker push 301868770392.dkr.ecr.ca-central-1.amazonaws.com/bsim/payment-network:latest
```

### Step 4: Create ElastiCache Redis

**Option A: ElastiCache Serverless**
```bash
aws elasticache create-serverless-cache \
  --serverless-cache-name bsim-redis \
  --engine redis \
  --security-group-ids sg-NEW_REDIS_SG \
  --subnet-ids subnet-0bb6a8a308c8e0671 subnet-002b78c53d968db85 \
  --region ca-central-1
```

**Option B: ElastiCache Node**
```bash
# Create cache subnet group
aws elasticache create-cache-subnet-group \
  --cache-subnet-group-name bsim-redis-subnet-group \
  --cache-subnet-group-description "BSIM Redis Subnet Group" \
  --subnet-ids subnet-0bb6a8a308c8e0671 subnet-002b78c53d968db85 \
  --region ca-central-1

# Create Redis security group
aws ec2 create-security-group \
  --group-name bsim-redis-sg \
  --description "Security group for BSIM Redis" \
  --vpc-id vpc-0c69941007c671517 \
  --region ca-central-1

# Allow Redis access from ECS tasks
aws ec2 authorize-security-group-ingress \
  --group-id sg-REDIS_SG_ID \
  --protocol tcp \
  --port 6379 \
  --source-group sg-06aaaf996187d82fc \
  --region ca-central-1

# Create Redis cluster
aws elasticache create-cache-cluster \
  --cache-cluster-id bsim-redis \
  --cache-node-type cache.t4g.micro \
  --engine redis \
  --engine-version 7.0 \
  --num-cache-nodes 1 \
  --cache-subnet-group-name bsim-redis-subnet-group \
  --security-group-ids sg-REDIS_SG_ID \
  --region ca-central-1
```

### Step 5: Update Security Group for Port 3006

```bash
aws ec2 authorize-security-group-ingress \
  --group-id sg-06aaaf996187d82fc \
  --protocol tcp \
  --port 3006 \
  --source-group sg-09c7dc697ef09a779 \
  --region ca-central-1
```

### Step 6: Create Target Group

```bash
aws elbv2 create-target-group \
  --name nsim-payment-network-tg \
  --protocol HTTP \
  --port 3006 \
  --vpc-id vpc-0c69941007c671517 \
  --target-type ip \
  --health-check-path /health \
  --health-check-interval-seconds 30 \
  --health-check-timeout-seconds 5 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --region ca-central-1
```

### Step 7: Create ECS Task Definition

Create `nsim-payment-network-task-definition.json`:

```json
{
  "family": "bsim-payment-network",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::301868770392:role/bsim-ecs-task-execution-role",
  "containerDefinitions": [
    {
      "name": "payment-network",
      "image": "301868770392.dkr.ecr.ca-central-1.amazonaws.com/bsim/payment-network:latest",
      "portMappings": [
        {
          "containerPort": 3006,
          "protocol": "tcp"
        }
      ],
      "essential": true,
      "environment": [
        { "name": "NODE_ENV", "value": "production" },
        { "name": "PORT", "value": "3006" },
        { "name": "BSIM_BASE_URL", "value": "http://backend.bsim-cluster.local:3001" },
        { "name": "BSIM_API_KEY", "value": "PRODUCTION_PAYMENT_API_KEY" },
        { "name": "REDIS_URL", "value": "redis://bsim-redis.xxxxxx.0001.cac1.cache.amazonaws.com:6379" },
        { "name": "AUTH_EXPIRY_HOURS", "value": "168" },
        { "name": "BSIM_RETRY_MAX_RETRIES", "value": "3" },
        { "name": "BSIM_RETRY_DELAY_MS", "value": "500" }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/bsim-payment-network",
          "awslogs-region": "ca-central-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "wget --quiet --tries=1 --spider http://localhost:3006/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 10
      }
    }
  ]
}
```

Register the task definition:
```bash
aws ecs register-task-definition \
  --cli-input-json file://nsim-payment-network-task-definition.json \
  --region ca-central-1
```

### Step 8: Create ECS Service

```bash
aws ecs create-service \
  --cluster bsim-cluster \
  --service-name bsim-payment-network-service \
  --task-definition bsim-payment-network \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-0bb6a8a308c8e0671,subnet-002b78c53d968db85],securityGroups=[sg-06aaaf996187d82fc],assignPublicIp=DISABLED}" \
  --load-balancers targetGroupArn=<payment-network-tg-arn>,containerName=payment-network,containerPort=3006 \
  --region ca-central-1
```

### Step 9: Add ALB Listener Rule

```bash
# Get listener ARN
LISTENER_ARN=$(aws elbv2 describe-listeners \
  --load-balancer-arn <ALB_ARN> \
  --query "Listeners[?Port==\`443\`].ListenerArn" \
  --output text \
  --region ca-central-1)

# Create rule for payment.banksim.ca
aws elbv2 create-rule \
  --listener-arn $LISTENER_ARN \
  --priority 6 \
  --conditions Field=host-header,Values=payment.banksim.ca \
  --actions Type=forward,TargetGroupArn=<payment-network-tg-arn> \
  --region ca-central-1
```

### Step 10: Add DNS Record

```bash
# Add A record (alias) for payment.banksim.ca → ALB
aws route53 change-resource-record-sets \
  --hosted-zone-id Z00354511TXC0NR2LH3WH \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "payment.banksim.ca",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "<ALB_HOSTED_ZONE_ID>",
          "DNSName": "<ALB_DNS_NAME>",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'
```

---

## BSIM Backend Updates Required

The BSIM backend needs the payment network handler enabled in production. Verify these are in place:

1. **Payment Network Routes:** `/api/payment-network/*` endpoints
2. **API Key Authentication:** `X-API-Key` header validation
3. **Environment Variable:** `PAYMENT_NETWORK_API_KEY` set in backend task

### Backend Task Definition Update

Add to backend environment variables:
```json
{
  "name": "PAYMENT_NETWORK_API_KEY",
  "value": "PRODUCTION_PAYMENT_API_KEY"
}
```

---

## Environment Variables Reference

### NSIM (Payment Network)

| Variable | Production Value | Description |
|----------|------------------|-------------|
| `NODE_ENV` | `production` | Environment mode |
| `PORT` | `3006` | HTTP server port |
| `BSIM_BASE_URL` | `http://backend.bsim-cluster.local:3001` | BSIM backend URL (service discovery) |
| `BSIM_API_KEY` | `<PRODUCTION_KEY>` | API key for BSIM authentication |
| `REDIS_URL` | `redis://bsim-redis.xxx.cache.amazonaws.com:6379` | ElastiCache Redis endpoint |
| `AUTH_EXPIRY_HOURS` | `168` | Hours until auth holds expire (7 days) |
| `BSIM_RETRY_MAX_RETRIES` | `3` | Max retries for BSIM calls |
| `BSIM_RETRY_DELAY_MS` | `500` | Base delay for exponential backoff |

---

## Service Discovery Options

### Option A: ALB Internal URL (Simple)
NSIM calls BSIM backend via ALB: `https://api.banksim.ca`
- Pro: Simple, works with existing setup
- Con: Extra hop through ALB, SSL termination overhead

### Option B: ECS Service Connect (Recommended)
Enable Cloud Map service discovery for direct container-to-container communication:
- NSIM calls: `http://backend.bsim-cluster.local:3001`
- Pro: Direct communication, lower latency
- Con: Requires Cloud Map setup

### Option C: Task IP Discovery
NSIM discovers backend task IPs via ECS API
- Pro: Direct communication
- Con: Complex, IPs change on deployment

**Recommendation:** Start with Option A (ALB) for simplicity. Migrate to Option B if latency becomes a concern.

---

## Cost Impact

| Resource | Monthly Cost |
|----------|-------------|
| ECS Fargate (256 CPU, 512 MB) | ~$10-15 |
| ElastiCache cache.t4g.micro | ~$12 |
| ALB (additional target group) | ~$1-2 |
| CloudWatch Logs | ~$1-2 |
| **Total Additional** | **~$25-30/month** |

---

## Verification Checklist

After deployment, verify:

- [ ] `https://payment.banksim.ca/health` returns 200 OK
- [ ] `https://payment.banksim.ca/api/v1/payments/authorize` accepts requests
- [ ] Webhook registration works
- [ ] Redis connection established (check CloudWatch logs)
- [ ] BSIM backend `/api/payment-network/*` endpoints respond
- [ ] End-to-end payment flow works (SSIM → NSIM → BSIM)

---

## Rollback Plan

If issues occur:

1. **Scale service to 0:** `aws ecs update-service --cluster bsim-cluster --service bsim-payment-network-service --desired-count 0`
2. **Remove ALB rule:** Delete the `payment.banksim.ca` listener rule
3. **Keep ECR image:** Don't delete - allows quick rollback
4. **Review logs:** `aws logs tail /ecs/bsim-payment-network --region ca-central-1`

---

## Next Steps After Deployment

1. Update SSIM production config to use `https://payment.banksim.ca`
2. Register production webhook URL for SSIM
3. Test end-to-end payment flow
4. Monitor CloudWatch for errors
5. Set up CloudWatch alarms for NSIM service
