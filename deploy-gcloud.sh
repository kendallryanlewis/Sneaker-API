#!/bin/bash

# Sneaker API - Google Cloud Deployment Script
# This script helps deploy the API to Google Cloud Run

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DEFAULT_REGION="us-central1"
DEFAULT_SERVICE_NAME="sneaker-api"

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Sneaker API - Cloud Deployment${NC}"
echo -e "${GREEN}================================${NC}"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI is not installed${NC}"
    echo "Please install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Get project ID
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Error: No GCP project configured${NC}"
    echo "Run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo -e "${GREEN}Project ID:${NC} $PROJECT_ID"

# Get service name
read -p "Service name [$DEFAULT_SERVICE_NAME]: " SERVICE_NAME
SERVICE_NAME=${SERVICE_NAME:-$DEFAULT_SERVICE_NAME}

# Get region
read -p "Region [$DEFAULT_REGION]: " REGION
REGION=${REGION:-$DEFAULT_REGION}

echo ""
echo -e "${YELLOW}Deployment Configuration:${NC}"
echo "  Service Name: $SERVICE_NAME"
echo "  Region: $REGION"
echo "  Project: $PROJECT_ID"
echo ""

read -p "Continue with deployment? (y/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled"
    exit 0
fi

echo ""
echo -e "${GREEN}Step 1: Enabling required APIs...${NC}"
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com

echo ""
echo -e "${GREEN}Step 2: Building and deploying to Cloud Run...${NC}"
gcloud run deploy $SERVICE_NAME \
  --source . \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 10 \
  --min-instances 0 \
  --timeout 60s \
  --set-env-vars "NODE_ENV=production"

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}Deployment Successful! 🎉${NC}"
    echo -e "${GREEN}========================================${NC}"
    
    # Get service URL
    SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
      --region $REGION \
      --format 'value(status.url)')
    
    echo ""
    echo -e "${GREEN}Service URL:${NC} $SERVICE_URL"
    echo ""
    echo -e "${YELLOW}Test your API:${NC}"
    echo "  Health check: curl $SERVICE_URL/health"
    echo "  Search: curl \"$SERVICE_URL/search/jordan?count=5\""
    echo "  Popular: curl $SERVICE_URL/popular/10"
    echo ""
    echo -e "${YELLOW}View logs:${NC}"
    echo "  gcloud run services logs tail $SERVICE_NAME --region $REGION"
    echo ""
    echo -e "${YELLOW}Update service:${NC}"
    echo "  gcloud run services update $SERVICE_NAME --region $REGION [OPTIONS]"
    echo ""
else
    echo -e "${RED}Deployment failed!${NC}"
    exit 1
fi
