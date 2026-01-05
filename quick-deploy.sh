#!/bin/bash

# Quick Deploy Script for Cloud Run
# This script deploys your app directly to Cloud Run

set -e

echo "🚀 Deploying Sneaker API to Cloud Run..."
echo ""

# Get project ID
PROJECT_ID=$(gcloud config get-value project)
echo "Project: $PROJECT_ID"
echo ""

# Deploy to Cloud Run
echo "Deploying to Cloud Run (this may take a few minutes)..."
gcloud run deploy sneaker-api \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300s \
  --max-instances 10 \
  --min-instances 0 \
  --set-env-vars NODE_ENV=production \
  --quiet

echo ""
echo "✅ Deployment complete!"
echo ""

# Get the service URL
SERVICE_URL=$(gcloud run services describe sneaker-api --region us-central1 --format='value(status.url)')

echo "🌐 Service URL: $SERVICE_URL"
echo ""
echo "Testing health endpoint..."
sleep 5

if curl -f "$SERVICE_URL/health" > /dev/null 2>&1; then
  echo "✅ Health check passed!"
else
  echo "⚠️  Health check failed - check logs:"
  echo "gcloud run services logs read sneaker-api --region us-central1 --limit=50"
fi

echo ""
echo "📝 Useful commands:"
echo "  View logs: gcloud run services logs tail sneaker-api --region us-central1"
echo "  View service: gcloud run services describe sneaker-api --region us-central1"
echo "  Test API: curl \"$SERVICE_URL/search/jordan?count=1\""
