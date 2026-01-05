# CI/CD Setup - Auto Deploy on Git Push

This guide shows how to automatically deploy your Sneaker API to Google Cloud when you push to GitHub.

## Option 1: Cloud Build with GitHub (Recommended)

This is the easiest and most integrated with Google Cloud.

### Step 1: Connect GitHub to Cloud Build

```bash
# Enable Cloud Build API
gcloud services enable cloudbuild.googleapis.com
gcloud services enable cloudscheduler.googleapis.com

# Open Cloud Build in browser to connect GitHub
gcloud builds repositories list 2>/dev/null || \
  echo "Visit: https://console.cloud.google.com/cloud-build/triggers/connect"
```

**In the Cloud Console:**
1. Go to: https://console.cloud.google.com/cloud-build/triggers
2. Click **"Connect Repository"**
3. Select **"GitHub"**
4. Authenticate with GitHub
5. Select your repository: `Sneaker-API`
6. Click **"Connect"**

### Step 2: Create Build Trigger

**Option A: Using the Console (Easiest)**

1. Go to: https://console.cloud.google.com/cloud-build/triggers
2. Click **"Create Trigger"**
3. Fill in:
   - **Name:** `deploy-sneaker-api`
   - **Event:** Push to a branch
   - **Source:** Your connected GitHub repo
   - **Branch:** `^main$` (or `^master$`)
   - **Configuration:** Cloud Build configuration file (YAML)
   - **Location:** `cloudbuild.yaml`
4. Click **"Create"**

**Option B: Using gcloud CLI**

```bash
# List available repositories
gcloud builds repositories list

# Create trigger (replace REPO_NAME with your GitHub repo)
gcloud builds triggers create github \
  --name="deploy-sneaker-api" \
  --repo-name="Sneaker-API" \
  --repo-owner="YOUR-GITHUB-USERNAME" \
  --branch-pattern="^main$" \
  --build-config="cloudbuild.yaml" \
  --description="Auto-deploy on push to main branch"
```

### Step 3: Grant Permissions

```bash
# Get your project number
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) \
  --format="value(projectNumber)")

# Grant Cloud Run Admin role to Cloud Build
gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/run.admin"

# Grant Service Account User role
gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

### Step 4: Test the Pipeline

```bash
# Make a change to your code
echo "# CI/CD test" >> README.md

# Commit and push
git add .
git commit -m "Test CI/CD pipeline"
git push origin main

# Watch the build
gcloud builds list --ongoing
gcloud builds log $(gcloud builds list --limit=1 --format="value(id)")
```

### Step 5: Verify Deployment

```bash
# Get your Cloud Run URL
SERVICE_URL=$(gcloud run services describe sneaker-api \
  --region us-central1 \
  --format 'value(status.url)')

# Test the deployment
curl $SERVICE_URL/health
```

**That's it!** Now every push to `main` branch will automatically deploy.

---

## Option 2: GitHub Actions

If you prefer GitHub Actions instead of Cloud Build:

### Step 1: Create Service Account

```bash
# Create service account
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions"

# Grant permissions
gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member="serviceAccount:github-actions@$(gcloud config get-value project).iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member="serviceAccount:github-actions@$(gcloud config get-value project).iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member="serviceAccount:github-actions@$(gcloud config get-value project).iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# Create and download key
gcloud iam service-accounts keys create key.json \
  --iam-account=github-actions@$(gcloud config get-value project).iam.gserviceaccount.com
```

### Step 2: Add GitHub Secrets

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Add these secrets:

**GCP_PROJECT_ID:**
```bash
# Copy your project ID
gcloud config get-value project
```

**GCP_SA_KEY:**
```bash
# Copy the contents of key.json
cat key.json
# Paste the entire JSON content as the secret value
```

### Step 3: Create GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloud Run

on:
  push:
    branches:
      - main

env:
  PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
  SERVICE_NAME: sneaker-api
  REGION: us-central1

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v3

    - name: Setup Google Cloud SDK
      uses: google-github-actions/setup-gcloud@v1
      with:
        service_account_key: ${{ secrets.GCP_SA_KEY }}
        project_id: ${{ secrets.GCP_PROJECT_ID }}
        export_default_credentials: true

    - name: Configure Docker for GCR
      run: |
        gcloud auth configure-docker

    - name: Build Docker image
      run: |
        docker build -t gcr.io/$PROJECT_ID/$SERVICE_NAME:$GITHUB_SHA .
        docker tag gcr.io/$PROJECT_ID/$SERVICE_NAME:$GITHUB_SHA gcr.io/$PROJECT_ID/$SERVICE_NAME:latest

    - name: Push to Container Registry
      run: |
        docker push gcr.io/$PROJECT_ID/$SERVICE_NAME:$GITHUB_SHA
        docker push gcr.io/$PROJECT_ID/$SERVICE_NAME:latest

    - name: Deploy to Cloud Run
      run: |
        gcloud run deploy $SERVICE_NAME \
          --image gcr.io/$PROJECT_ID/$SERVICE_NAME:$GITHUB_SHA \
          --region $REGION \
          --platform managed \
          --allow-unauthenticated \
          --memory 512Mi \
          --cpu 1 \
          --max-instances 10 \
          --min-instances 0 \
          --timeout 60s \
          --set-env-vars NODE_ENV=production

    - name: Show service URL
      run: |
        gcloud run services describe $SERVICE_NAME \
          --region $REGION \
          --format 'value(status.url)'
```

### Step 4: Push and Test

```bash
# Create the workflow directory
mkdir -p .github/workflows

# Copy the workflow file (create it first)
git add .github/workflows/deploy.yml
git commit -m "Add GitHub Actions CI/CD"
git push origin main

# Watch the action in GitHub
# Go to: https://github.com/YOUR-USERNAME/Sneaker-API/actions
```

---

## Advanced: Deploy Different Branches to Different Services

### Multiple Environments

Update `cloudbuild.yaml` for branch-based deployments:

```yaml
steps:
  # Install dependencies
  - name: 'node:20'
    entrypoint: npm
    args: ['ci']
  
  # Build Docker image
  - name: 'gcr.io/cloud-builders/docker'
    args: 
      - 'build'
      - '-t'
      - 'gcr.io/$PROJECT_ID/sneaker-api:$COMMIT_SHA'
      - '-t'
      - 'gcr.io/$PROJECT_ID/sneaker-api:$BRANCH_NAME'
      - '.'
  
  # Push images
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/sneaker-api:$COMMIT_SHA']
  
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/sneaker-api:$BRANCH_NAME']
  
  # Deploy to environment based on branch
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: bash
    args:
      - '-c'
      - |
        if [ "$BRANCH_NAME" = "main" ]; then
          SERVICE_NAME="sneaker-api"
          ENV="production"
        elif [ "$BRANCH_NAME" = "develop" ]; then
          SERVICE_NAME="sneaker-api-dev"
          ENV="development"
        else
          SERVICE_NAME="sneaker-api-${BRANCH_NAME//\//-}"
          ENV="staging"
        fi
        
        gcloud run deploy $SERVICE_NAME \
          --image gcr.io/$PROJECT_ID/sneaker-api:$COMMIT_SHA \
          --region us-central1 \
          --platform managed \
          --allow-unauthenticated \
          --memory 512Mi \
          --timeout 60s \
          --set-env-vars NODE_ENV=$ENV

images:
  - 'gcr.io/$PROJECT_ID/sneaker-api:$COMMIT_SHA'
  - 'gcr.io/$PROJECT_ID/sneaker-api:$BRANCH_NAME'

timeout: '1200s'
```

Create separate triggers:
```bash
# Production (main branch)
gcloud builds triggers create github \
  --name="deploy-production" \
  --repo-name="Sneaker-API" \
  --repo-owner="YOUR-GITHUB-USERNAME" \
  --branch-pattern="^main$" \
  --build-config="cloudbuild.yaml"

# Development (develop branch)
gcloud builds triggers create github \
  --name="deploy-development" \
  --repo-name="Sneaker-API" \
  --repo-owner="YOUR-GITHUB-USERNAME" \
  --branch-pattern="^develop$" \
  --build-config="cloudbuild.yaml"
```

---

## Workflow Diagram

```
┌─────────────────┐
│   Git Push to   │
│   GitHub main   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Cloud Build    │
│  Trigger Runs   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Run Tests      │
│  (Optional)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Build Docker   │
│  Image          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Push to GCR    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Deploy to      │
│  Cloud Run      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  🎉 Live!       │
└─────────────────┘
```

---

## Monitoring Builds

### View Build History

```bash
# List recent builds
gcloud builds list --limit=10

# View specific build
gcloud builds describe BUILD_ID

# Stream logs of latest build
gcloud builds log $(gcloud builds list --limit=1 --format="value(id)")

# View in browser
gcloud builds list --uri
```

### Build Notifications

Set up Slack/Email notifications:

```bash
# Create Pub/Sub topic
gcloud pubsub topics create cloud-builds

# Subscribe to build updates
gcloud pubsub subscriptions create build-notifications \
  --topic=cloud-builds

# Or use Cloud Functions to send to Slack
# See: https://cloud.google.com/build/docs/configuring-notifications/notifiers
```

---

## Rollback

If a deployment fails, rollback to previous version:

```bash
# List revisions
gcloud run revisions list --service sneaker-api --region us-central1

# Rollback to specific revision
gcloud run services update-traffic sneaker-api \
  --region us-central1 \
  --to-revisions=REVISION_NAME=100
```

---

## Testing Before Production

### Add Health Check to Build

Update `cloudbuild.yaml` to test before deploying:

```yaml
steps:
  # ... previous steps ...
  
  # Deploy to staging first
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'sneaker-api-staging'
      - '--image'
      - 'gcr.io/$PROJECT_ID/sneaker-api:$COMMIT_SHA'
      - '--region'
      - 'us-central1'
      - '--platform'
      - 'managed'
      - '--no-traffic'  # Don't route traffic yet
  
  # Test staging deployment
  - name: 'gcr.io/cloud-builders/curl'
    entrypoint: bash
    args:
      - '-c'
      - |
        STAGING_URL=$(gcloud run services describe sneaker-api-staging \
          --region us-central1 --format='value(status.url)')
        
        # Test health endpoint
        curl -f $STAGING_URL/health || exit 1
        
        # Test search endpoint
        curl -f "$STAGING_URL/search/test?count=1" || exit 1
  
  # If tests pass, deploy to production
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
```

---

## Cost Optimization

### Prevent Unnecessary Builds

Create `.gcloudignore` to exclude files:
```
.git/
node_modules/
*.md
.vscode/
.DS_Store
```

### Build Caching

Cloud Build automatically caches Docker layers, but you can optimize:

```dockerfile
# In Dockerfile - copy package.json first for better caching
COPY package*.json ./
RUN npm ci --only=production
COPY . ./
```

---

## Troubleshooting

**Issue: Permission denied during deployment**
```bash
# Grant permissions to Cloud Build service account
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) \
  --format="value(projectNumber)")

gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/run.admin"
```

**Issue: Build times out**
```yaml
# Increase timeout in cloudbuild.yaml
timeout: '1800s'  # 30 minutes
```

**Issue: GitHub webhook not triggering**
```bash
# Reconnect repository
gcloud builds repositories delete REPO_NAME
# Then reconnect via console
```

**Issue: Docker build fails**
```bash
# Test locally first
docker build -t test-image .
docker run -p 8080:8080 test-image
```

---

## Quick Reference

### Cloud Build Commands
```bash
# List triggers
gcloud builds triggers list

# Run trigger manually
gcloud builds triggers run TRIGGER_NAME

# Delete trigger
gcloud builds triggers delete TRIGGER_NAME

# View logs
gcloud builds log BUILD_ID

# Cancel build
gcloud builds cancel BUILD_ID
```

### Useful Links
- Cloud Build Console: https://console.cloud.google.com/cloud-build
- Build History: https://console.cloud.google.com/cloud-build/builds
- Triggers: https://console.cloud.google.com/cloud-build/triggers
- GitHub App: https://github.com/apps/google-cloud-build

---

## Next Steps

1. ✅ Set up CI/CD (you just did this!)
2. Add automated tests to the pipeline
3. Set up staging/production environments
4. Configure monitoring and alerts
5. Add security scanning (e.g., Snyk, Trivy)
6. Set up automated backups

---

**You now have automatic deployment! Every push to GitHub will deploy to Cloud Run automatically.** 🚀
