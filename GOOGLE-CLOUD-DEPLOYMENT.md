# Google Cloud Deployment Guide

This guide covers deploying the Sneaker API to Google Cloud Platform (GCP) using multiple deployment options.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Deployment Options](#deployment-options)
3. [Option 1: Cloud Run (Recommended)](#option-1-cloud-run-recommended)
4. [Option 2: App Engine](#option-2-app-engine)
5. [Option 3: Compute Engine](#option-3-compute-engine)
6. [Environment Configuration](#environment-configuration)
7. [Monitoring & Logging](#monitoring--logging)
8. [Cost Optimization](#cost-optimization)

---

## Prerequisites

### 1. Google Cloud Account Setup

```bash
# Install Google Cloud SDK
# macOS
brew install --cask google-cloud-sdk

# Or download from: https://cloud.google.com/sdk/docs/install

# Initialize gcloud
gcloud init

# Login to your Google account
gcloud auth login

# Set your project
gcloud config set project YOUR_PROJECT_ID
```

### 2. Enable Required APIs

```bash
# Enable necessary Google Cloud APIs
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable appengine.googleapis.com
gcloud services enable compute.googleapis.com
```

### 3. Install Docker (for Cloud Run)

```bash
# macOS
brew install --cask docker

# Or download from: https://www.docker.com/products/docker-desktop
```

---

## Deployment Options

| Option | Best For | Pros | Cons | Cost |
|--------|----------|------|------|------|
| **Cloud Run** | Auto-scaling, containerized | Serverless, scales to zero, fast deployment | Container knowledge needed | Pay per use |
| **App Engine** | Simple deployment | Easiest setup, fully managed | Less control, always-on (standard) | $$ |
| **Compute Engine** | Full control | Complete control, any software | Manual management | $$$ |

---

## Option 1: Cloud Run (Recommended)

Cloud Run is the **recommended option** for this API because:
- Automatically scales based on traffic
- Scales to zero when not in use (cost-effective)
- Fast deployment with Docker
- Perfect for APIs with variable traffic

### Step 1: Update Dockerfile

The existing Dockerfile needs updating for production:

```dockerfile
# Update to Node.js 20 (latest LTS)
FROM node:20-slim

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies)
RUN npm ci

# Copy application code
COPY . ./

# Set environment variable for port
ENV PORT=8080

# Expose port
EXPOSE 8080

# Start application
CMD ["npm", "start"]
```

### Step 2: Create .dockerignore

```bash
# Create .dockerignore to reduce image size
cat > .dockerignore << EOF
node_modules
npm-debug.log
.git
.gitignore
.env
logs/*.log
Screenshots
cloudshell_open
README.md
*.md
.vscode
.DS_Store
EOF
```

### Step 3: Build and Deploy to Cloud Run

```bash
# Set environment variables
export PROJECT_ID="your-project-id"
export REGION="us-central1"
export SERVICE_NAME="sneaker-api"

# Build and deploy in one command
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

# Or build locally and push
docker build -t gcr.io/$PROJECT_ID/$SERVICE_NAME:latest .
docker push gcr.io/$PROJECT_ID/$SERVICE_NAME:latest
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME:latest \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated
```

### Step 4: Test Deployment

```bash
# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --format 'value(status.url)')

echo "Service URL: $SERVICE_URL"

# Test health endpoint
curl $SERVICE_URL/health

# Test search endpoint
curl "$SERVICE_URL/search/jordan?count=5"
```

### Step 5: Set Up Custom Domain (Optional)

```bash
# Map custom domain
gcloud run domain-mappings create \
  --service $SERVICE_NAME \
  --domain api.yourdomain.com \
  --region $REGION
```

---

## Option 2: App Engine

App Engine is simpler but less flexible. Good for always-on APIs.

### Step 1: Create app.yaml

```yaml
runtime: nodejs20

instance_class: F1

env_variables:
  NODE_ENV: 'production'
  PORT: '8080'

automatic_scaling:
  target_cpu_utilization: 0.65
  min_instances: 0
  max_instances: 10
  min_pending_latency: 30ms
  max_pending_latency: automatic
  max_concurrent_requests: 80

handlers:
- url: /.*
  script: auto
  secure: always
  redirect_http_response_code: 301
```

### Step 2: Create .gcloudignore

```bash
# Create .gcloudignore
cat > .gcloudignore << EOF
.git
.gitignore
node_modules/
.env
logs/*.log
Screenshots/
cloudshell_open/
*.md
.vscode/
.DS_Store
EOF
```

### Step 3: Deploy to App Engine

```bash
# Deploy to App Engine
gcloud app deploy

# View logs
gcloud app logs tail -s default

# Open in browser
gcloud app browse
```

### Step 4: Test Deployment

```bash
# Get App Engine URL
APP_URL=$(gcloud app describe --format='value(defaultHostname)')
echo "App URL: https://$APP_URL"

# Test endpoints
curl https://$APP_URL/health
curl "https://$APP_URL/search/yeezy?count=5"
```

---

## Option 3: Compute Engine

Full VM control - most expensive but most flexible.

### Step 1: Create VM Instance

```bash
# Create VM
gcloud compute instances create sneaker-api-vm \
  --zone=us-central1-a \
  --machine-type=e2-micro \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=10GB \
  --tags=http-server,https-server

# Create firewall rule
gcloud compute firewall-rules create allow-sneaker-api \
  --allow tcp:8080 \
  --target-tags http-server
```

### Step 2: SSH and Setup

```bash
# SSH into VM
gcloud compute ssh sneaker-api-vm --zone=us-central1-a

# On the VM:
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install git
sudo apt-get install -y git

# Clone your repository
git clone https://github.com/yourusername/Sneaker-API.git
cd Sneaker-API

# Install dependencies
npm install

# Install PM2 for process management
sudo npm install -g pm2

# Start the application
pm2 start index.js --name sneaker-api

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

### Step 3: Configure Nginx (Optional)

```bash
# Install Nginx
sudo apt-get install -y nginx

# Create Nginx configuration
sudo tee /etc/nginx/sites-available/sneaker-api << EOF
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/sneaker-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Environment Configuration

### Set Environment Variables

**Cloud Run:**
```bash
gcloud run services update sneaker-api \
  --region us-central1 \
  --set-env-vars "NODE_ENV=production,PORT=8080"
```

**App Engine:**
Add to `app.yaml`:
```yaml
env_variables:
  NODE_ENV: 'production'
  PORT: '8080'
```

**Compute Engine:**
```bash
# Create .env file on VM
cat > .env << EOF
NODE_ENV=production
PORT=8080
EOF
```

### Using Google Secret Manager (Recommended)

```bash
# Enable Secret Manager API
gcloud services enable secretmanager.googleapis.com

# Create secrets
echo -n "your-secret-value" | gcloud secrets create api-key \
  --data-file=-

# Grant access to Cloud Run
gcloud secrets add-iam-policy-binding api-key \
  --member=serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor

# Update Cloud Run to use secrets
gcloud run services update sneaker-api \
  --region us-central1 \
  --set-secrets="API_KEY=api-key:latest"
```

---

## Monitoring & Logging

### Cloud Logging

```bash
# View logs (Cloud Run)
gcloud run services logs read sneaker-api \
  --region us-central1 \
  --limit 50

# Stream logs in real-time
gcloud run services logs tail sneaker-api \
  --region us-central1

# Filter logs
gcloud logging read "resource.type=cloud_run_revision AND severity>=ERROR" \
  --limit 50 \
  --format json
```

### Cloud Monitoring

```bash
# Create uptime check
gcloud monitoring uptime create sneaker-api-health \
  --display-name="Sneaker API Health Check" \
  --resource-type=uptime-url \
  --url="https://YOUR-SERVICE-URL/health" \
  --check-interval=60s
```

### Set Up Alerts

```bash
# Create alert policy for high error rate
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="High Error Rate" \
  --condition-display-name="Error rate > 5%" \
  --condition-threshold-value=0.05 \
  --condition-threshold-duration=300s
```

---

## Cost Optimization

### Cloud Run Cost Optimization

```bash
# Set minimum instances to 0 for cost savings
gcloud run services update sneaker-api \
  --region us-central1 \
  --min-instances 0 \
  --max-instances 10

# Reduce memory if possible
gcloud run services update sneaker-api \
  --region us-central1 \
  --memory 256Mi

# Set request timeout
gcloud run services update sneaker-api \
  --region us-central1 \
  --timeout 60s
```

### Estimated Monthly Costs

**Cloud Run (Pay per use):**
- 1 million requests: ~$2-5/month
- 2 million requests: ~$5-10/month
- No traffic = $0

**App Engine:**
- F1 instance (always-on): ~$50/month
- B1 instance (scales to zero): ~$10-30/month

**Compute Engine:**
- e2-micro: ~$7/month (free tier eligible)
- e2-small: ~$14/month
- f1-micro: Free tier (1 instance)

---

## CI/CD with Cloud Build

### Create cloudbuild.yaml

```yaml
steps:
  # Install dependencies
  - name: 'node:20'
    entrypoint: npm
    args: ['install']
  
  # Run tests (if you have them)
  # - name: 'node:20'
  #   entrypoint: npm
  #   args: ['test']
  
  # Build Docker image
  - name: 'gcr.io/cloud-builders/docker'
    args: 
      - 'build'
      - '-t'
      - 'gcr.io/$PROJECT_ID/sneaker-api:$COMMIT_SHA'
      - '-t'
      - 'gcr.io/$PROJECT_ID/sneaker-api:latest'
      - '.'
  
  # Push to Container Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: 
      - 'push'
      - 'gcr.io/$PROJECT_ID/sneaker-api:$COMMIT_SHA'
  
  # Deploy to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'sneaker-api'
      - '--image'
      - 'gcr.io/$PROJECT_ID/sneaker-api:$COMMIT_SHA'
      - '--region'
      - 'us-central1'
      - '--platform'
      - 'managed'
      - '--allow-unauthenticated'

images:
  - 'gcr.io/$PROJECT_ID/sneaker-api:$COMMIT_SHA'
  - 'gcr.io/$PROJECT_ID/sneaker-api:latest'

timeout: '1200s'
```

### Set Up GitHub Integration

```bash
# Connect GitHub repository
gcloud builds triggers create github \
  --repo-name=Sneaker-API \
  --repo-owner=YOUR-GITHUB-USERNAME \
  --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml
```

---

## Quick Reference Commands

### Cloud Run
```bash
# Deploy
gcloud run deploy sneaker-api --source .

# Update
gcloud run services update sneaker-api --memory 512Mi

# Delete
gcloud run services delete sneaker-api

# Logs
gcloud run services logs tail sneaker-api
```

### App Engine
```bash
# Deploy
gcloud app deploy

# Logs
gcloud app logs tail

# Delete version
gcloud app versions delete VERSION_ID
```

### Compute Engine
```bash
# Start VM
gcloud compute instances start sneaker-api-vm

# Stop VM
gcloud compute instances stop sneaker-api-vm

# SSH
gcloud compute ssh sneaker-api-vm

# Delete VM
gcloud compute instances delete sneaker-api-vm
```

---

## Troubleshooting

### Common Issues

**Issue: "Permission Denied"**
```bash
# Ensure you're authenticated
gcloud auth login
gcloud auth application-default login
```

**Issue: "Port 8080 not responding"**
```bash
# Check if app is using correct PORT environment variable
# Update index.js to use process.env.PORT || 8080
```

**Issue: "Out of Memory"**
```bash
# Increase memory limit (Cloud Run)
gcloud run services update sneaker-api --memory 1Gi
```

**Issue: "Timeout exceeded"**
```bash
# Increase timeout (Cloud Run)
gcloud run services update sneaker-api --timeout 300s
```

---

## Production Checklist

- [ ] Environment variables configured
- [ ] Health check endpoint working (`/health`)
- [ ] Logging configured
- [ ] Monitoring/alerts set up
- [ ] Custom domain configured (optional)
- [ ] SSL/HTTPS enabled
- [ ] Rate limiting configured
- [ ] Caching enabled
- [ ] CI/CD pipeline set up
- [ ] Backup/disaster recovery plan
- [ ] Cost alerts configured
- [ ] Documentation updated

---

## Support & Resources

- [Google Cloud Run Documentation](https://cloud.google.com/run/docs)
- [App Engine Documentation](https://cloud.google.com/appengine/docs)
- [Cloud Build Documentation](https://cloud.google.com/build/docs)
- [Google Cloud Pricing Calculator](https://cloud.google.com/products/calculator)

For issues, check:
1. Cloud Console Logs
2. Error Reporting in Google Cloud Console
3. Service health in Cloud Console
