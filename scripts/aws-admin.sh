#!/bin/bash

# AWS Admin Management Script for BSIM
# This script helps manage admin users in the AWS production environment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# AWS Configuration
AWS_REGION="ca-central-1"
ECS_CLUSTER="bsim-cluster"
ADMIN_IMAGE="301868770392.dkr.ecr.ca-central-1.amazonaws.com/bsim/admin:latest"
EXECUTION_ROLE="arn:aws:iam::301868770392:role/bsim-ecs-task-execution-role"
LOG_GROUP="/ecs/bsim-admin"
DATABASE_URL="postgresql://bsimadmin:8O9MwSmoA1IUQfOZyw7H4L2lDoeA2M8w@bsim-db.cb80gi4u4k7g.ca-central-1.rds.amazonaws.com:5432/bsim"

# Network configuration (from admin service)
SUBNETS="subnet-0a02b8f394914dabd,subnet-03d015986a76a2677"
SECURITY_GROUPS="sg-06aaaf996187d82fc"

run_ecs_task() {
    local task_name="$1"
    local command="$2"
    local log_prefix="$3"

    # Create task definition
    local task_def=$(cat <<EOF
{
    "family": "bsim-admin-${task_name}",
    "executionRoleArn": "${EXECUTION_ROLE}",
    "networkMode": "awsvpc",
    "containerDefinitions": [
        {
            "name": "${task_name}",
            "image": "${ADMIN_IMAGE}",
            "cpu": 0,
            "essential": true,
            "environment": [
                {
                    "name": "DATABASE_URL",
                    "value": "${DATABASE_URL}"
                }
            ],
            "command": ["node", "-e", "${command}"],
            "logConfiguration": {
                "logDriver": "awslogs",
                "options": {
                    "awslogs-group": "${LOG_GROUP}",
                    "awslogs-region": "${AWS_REGION}",
                    "awslogs-stream-prefix": "${log_prefix}"
                }
            }
        }
    ],
    "requiresCompatibilities": ["FARGATE"],
    "cpu": "256",
    "memory": "512"
}
EOF
)

    # Register task definition
    echo "Registering task definition..."
    local task_def_arn=$(echo "$task_def" | aws ecs register-task-definition \
        --cli-input-json file:///dev/stdin \
        --region "$AWS_REGION" \
        --query 'taskDefinition.taskDefinitionArn' \
        --output text)

    echo "Task definition: $task_def_arn"

    # Run task
    echo "Running task..."
    local task_arn=$(aws ecs run-task \
        --cluster "$ECS_CLUSTER" \
        --task-definition "$task_def_arn" \
        --launch-type FARGATE \
        --network-configuration "awsvpcConfiguration={subnets=[${SUBNETS}],securityGroups=[${SECURITY_GROUPS}],assignPublicIp=ENABLED}" \
        --region "$AWS_REGION" \
        --query 'tasks[0].taskArn' \
        --output text)

    local task_id=$(echo "$task_arn" | rev | cut -d'/' -f1 | rev)
    echo "Task started: $task_id"

    # Wait for task to complete
    echo "Waiting for task to complete..."
    local max_wait=60
    local waited=0
    while [ $waited -lt $max_wait ]; do
        local status=$(aws ecs describe-tasks \
            --cluster "$ECS_CLUSTER" \
            --tasks "$task_id" \
            --region "$AWS_REGION" \
            --query 'tasks[0].lastStatus' \
            --output text)

        if [ "$status" = "STOPPED" ]; then
            break
        fi

        sleep 5
        waited=$((waited + 5))
        echo "  Status: $status (waited ${waited}s)"
    done

    # Get logs
    echo ""
    echo "Task output:"
    sleep 2  # Wait for logs to be available
    aws logs get-log-events \
        --log-group-name "$LOG_GROUP" \
        --log-stream-name "${log_prefix}/${task_name}/${task_id}" \
        --region "$AWS_REGION" \
        --query 'events[*].message' \
        --output text 2>/dev/null || echo "  (logs not yet available, check CloudWatch)"
}

case "$1" in
    reset-admin)
        echo "============================================"
        echo "  BSIM Admin Reset"
        echo "============================================"
        echo ""
        echo "This will DELETE all admin users from the production database."
        echo "After this, visiting admin.banksim.ca will show the first-user setup screen."
        echo ""
        read -p "Are you sure you want to continue? (yes/no): " confirm
        if [ "$confirm" != "yes" ]; then
            echo "Cancelled."
            exit 0
        fi

        echo ""
        run_ecs_task "reset-admin" \
            "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.adminUser.deleteMany({}).then(r=>console.log('Deleted',r.count,'admin users')).catch(e=>console.error(e)).finally(()=>p.\$disconnect());" \
            "reset-admin"

        echo ""
        echo "============================================"
        echo "Admin users have been deleted."
        echo "Visit https://admin.banksim.ca to create a new admin user."
        echo "============================================"
        ;;

    delete-passkeys)
        echo "============================================"
        echo "  BSIM Admin Passkey Cleanup"
        echo "============================================"
        echo ""
        echo "This will DELETE all admin passkeys from the production database."
        echo "Admin users will remain but will need to re-register passkeys."
        echo ""
        read -p "Are you sure you want to continue? (yes/no): " confirm
        if [ "$confirm" != "yes" ]; then
            echo "Cancelled."
            exit 0
        fi

        echo ""
        run_ecs_task "delete-passkeys" \
            "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.adminPasskey.deleteMany({}).then(r=>console.log('Deleted',r.count,'passkeys')).catch(e=>console.error(e)).finally(()=>p.\$disconnect());" \
            "delete-passkeys"

        echo ""
        echo "============================================"
        echo "Passkeys have been deleted."
        echo "Admin users will need to re-register passkeys."
        echo "============================================"
        ;;

    list-admins)
        echo "============================================"
        echo "  BSIM Admin Users"
        echo "============================================"
        echo ""

        run_ecs_task "list-admins" \
            "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.adminUser.findMany({select:{id:true,email:true,firstName:true,lastName:true,role:true,createdAt:true,_count:{select:{passkeys:true}}}}).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>console.error(e)).finally(()=>p.\$disconnect());" \
            "list-admins"
        ;;

    cleanup-test-users)
        echo "============================================"
        echo "  BSIM Test User Cleanup"
        echo "============================================"
        echo ""
        echo "This will DELETE all test users (@testuser.banksim.ca) from the production database."
        echo "These are users created during E2E test runs."
        echo ""

        # First, count the users
        echo "Counting test users..."
        run_ecs_task "count-test-users" \
            "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.user.count({where:{email:{endsWith:'@testuser.banksim.ca'}}}).then(r=>console.log('Found',r,'test users')).catch(e=>console.error(e)).finally(()=>p.\$disconnect());" \
            "count-test-users"

        echo ""
        read -p "Do you want to delete these test users? (yes/no): " confirm
        if [ "$confirm" != "yes" ]; then
            echo "Cancelled."
            exit 0
        fi

        echo ""
        echo "Deleting test users..."
        run_ecs_task "delete-test-users" \
            "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.user.deleteMany({where:{email:{endsWith:'@testuser.banksim.ca'}}}).then(r=>console.log('Deleted',r.count,'test users')).catch(e=>console.error(e)).finally(()=>p.\$disconnect());" \
            "delete-test-users"

        echo ""
        echo "============================================"
        echo "Test users have been cleaned up."
        echo "============================================"
        ;;

    count-test-users)
        echo "============================================"
        echo "  BSIM Test User Count"
        echo "============================================"
        echo ""

        run_ecs_task "count-test-users" \
            "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.user.count({where:{email:{endsWith:'@testuser.banksim.ca'}}}).then(r=>console.log('Found',r,'test users with @testuser.banksim.ca')).catch(e=>console.error(e)).finally(()=>p.\$disconnect());" \
            "count-test-users"
        ;;

    *)
        echo "BSIM AWS Admin Management"
        echo ""
        echo "Usage: ./scripts/aws-admin.sh [command]"
        echo ""
        echo "Commands:"
        echo "  reset-admin        - Delete all admin users (triggers first-user setup)"
        echo "  delete-passkeys    - Delete all admin passkeys (keeps users)"
        echo "  list-admins        - List all admin users"
        echo "  cleanup-test-users - Delete all E2E test users (@testuser.banksim.ca)"
        echo "  count-test-users   - Count E2E test users without deleting"
        echo ""
        echo "Examples:"
        echo "  ./scripts/aws-admin.sh reset-admin        # Reset admin for testing"
        echo "  ./scripts/aws-admin.sh delete-passkeys    # Re-register passkeys with new RP_ID"
        echo "  ./scripts/aws-admin.sh list-admins        # Check current admin users"
        echo "  ./scripts/aws-admin.sh cleanup-test-users # Clean up E2E test users"
        echo ""
        echo "Note: These commands run against the AWS production database."
        echo "      Make sure you have AWS CLI configured with appropriate credentials."
        exit 1
        ;;
esac
