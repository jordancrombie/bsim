# AWS Deployment Guide - BSIM Banking Simulator

This guide walks you through deploying BSIM to AWS using ECS Fargate, RDS PostgreSQL, and Application Load Balancer.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         AWS Cloud                            │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │          Application Load Balancer (ALB)             │   │
│  │              with AWS Certificate Manager            │   │
│  └──────────────┬──────────────────────┬────────────────┘   │
│                 │                      │                     │
│        ┌────────▼─────────┐   ┌───────▼──────────┐          │
│        │  ECS Fargate     │   │  ECS Fargate     │          │
│        │  Frontend        │   │  Backend API     │          │
│        │  (Next.js)       │   │  (Express.js)    │          │
│        └────────┬─────────┘   └───────┬──────────┘          │
│                 │                     │                      │
│                 │             ┌───────▼──────────┐           │
│                 └─────────────►  RDS PostgreSQL  │           │
│                               │   (Managed DB)   │           │
│                               └──────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

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
# Create ECR repositories
aws ecr create-repository --repository-name bsim/backend
aws ecr create-repository --repository-name bsim/frontend

# Get ECR login credentials
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Build and push backend
cd backend
docker build -t bsim/backend .
docker tag bsim/backend:latest ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/bsim/backend:latest
docker push ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/bsim/backend:latest

# Build and push frontend
cd ../frontend
docker build -t bsim/frontend .
docker tag bsim/frontend:latest ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/bsim/frontend:latest
docker push ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/bsim/frontend:latest
```

### 3. Create ECS Cluster

```bash
# Create ECS cluster
aws ecs create-cluster --cluster-name bsim-cluster

# Create CloudWatch log groups
aws logs create-log-group --log-group-name /ecs/bsim/backend
aws logs create-log-group --log-group-name /ecs/bsim/frontend
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
          "value": "banksim.ca"
        },
        {
          "name": "CORS_ORIGIN",
          "value": "https://banksim.ca"
        },
        {
          "name": "RP_ID",
          "value": "banksim.ca"
        },
        {
          "name": "ORIGIN",
          "value": "https://banksim.ca"
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
          "value": "banksim.ca"
        },
        {
          "name": "NEXT_PUBLIC_API_URL",
          "value": "https://api.banksim.ca/api"
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

Register task definitions:

```bash
aws ecs register-task-definition --cli-input-json file://backend-task-definition.json
aws ecs register-task-definition --cli-input-json file://frontend-task-definition.json
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

# Create target groups
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
```

### 7. Request SSL Certificate (AWS Certificate Manager)

```bash
# Request certificate for banksim.ca and *.banksim.ca
aws acm request-certificate \
  --domain-name banksim.ca \
  --subject-alternative-names *.banksim.ca \
  --validation-method DNS

# Follow DNS validation instructions in AWS Console
# Add the CNAME records to your DNS provider
```

### 8. Create ALB Listeners

```bash
# Get certificate ARN
CERT_ARN=$(aws acm list-certificates --query "CertificateSummaryList[?DomainName=='banksim.ca'].CertificateArn" --output text)

# Create HTTPS listener for frontend (default)
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:... \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=$CERT_ARN \
  --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:.../bsim-frontend-tg

# Create rule for backend API (api.banksim.ca)
aws elbv2 create-rule \
  --listener-arn arn:aws:elasticloadbalancing:... \
  --priority 1 \
  --conditions Field=host-header,Values=api.banksim.ca \
  --actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:.../bsim-backend-tg

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

# Allow traffic from ALB
aws ec2 authorize-security-group-ingress \
  --group-id sg-ecs-xxxxxxxxx \
  --protocol tcp \
  --port 3001 \
  --source-group sg-alb-xxxxxxxxx

aws ec2 authorize-security-group-ingress \
  --group-id sg-ecs-xxxxxxxxx \
  --protocol tcp \
  --port 3000 \
  --source-group sg-alb-xxxxxxxxx

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
# banksim.ca -> ALB (A record alias)
# api.banksim.ca -> ALB (A record alias)
```

## Monitoring and Logs

```bash
# View backend logs
aws logs tail /ecs/bsim/backend --follow

# View frontend logs
aws logs tail /ecs/bsim/frontend --follow

# Check service status
aws ecs describe-services \
  --cluster bsim-cluster \
  --services bsim-backend-service bsim-frontend-service
```

## Cost Optimization

- **Fargate Tasks**: ~$20-40/month for 2 backend + 2 frontend tasks (256 CPU, 512 MB)
- **RDS t3.micro**: ~$15/month
- **ALB**: ~$20/month
- **Data Transfer**: Variable based on usage
- **Total Estimated**: ~$60-80/month

### Cost Saving Tips

1. Use fewer Fargate tasks (1 backend + 1 frontend) for development
2. Use RDS t4g.micro with Reserved Instance pricing
3. Enable auto-scaling to scale down during low traffic
4. Use CloudWatch to monitor and optimize resource usage

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

```bash
# Build and push new images
docker build -t bsim/backend ./backend
docker tag bsim/backend:latest ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/bsim/backend:latest
docker push ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/bsim/backend:latest

# Force new deployment
aws ecs update-service \
  --cluster bsim-cluster \
  --service bsim-backend-service \
  --force-new-deployment
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

## Next Steps

1. Set up CI/CD pipeline with GitHub Actions or AWS CodePipeline
2. Configure auto-scaling policies for ECS services
3. Set up CloudWatch dashboards for monitoring
4. Implement backup and disaster recovery procedures
5. Add AWS WAF rules for additional security
