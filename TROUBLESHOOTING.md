# Cloud Run Deployment Troubleshooting

## Common Issue: Build Failing After 30-35 Seconds

### Quick Fixes

#### 1. Check Build Logs

```bash
# View the latest build logs
gcloud builds list --limit=1

# Get detailed logs for a specific build
BUILD_ID=$(gcloud builds list --limit=1 --format='value(id)')
gcloud builds log $BUILD_ID

# Or view in browser
open "https://console.cloud.google.com/cloud-build/builds?project=$(gcloud config get-value project)"
```

#### 2. Common Causes & Solutions

**A. Port Configuration Issue** ✅ (Your code looks good)
Your `index.js` correctly uses `process.env.PORT || 8080`

**B. Missing Dependencies**

Check your package.json includes all required dependencies:
```bash
# Verify all imports are in package.json
cat package.json | jq '.dependencies'
```

**C. Dockerfile Issues**

Test your Dockerfile locally:
```bash
# Build locally
docker build -t test-sneaker-api .

# Run locally
docker run -p 8080:8080 -e PORT=8080 test-sneaker-api

# Test in another terminal
curl http://localhost:8080/health
```

**D. Build Timeout**

If the build is timing out, increase timeout in `cloudbuild.yaml`:
```yaml
timeout: '1800s'  # 30 minutes instead of default
```

**E. Memory Issues During Build**

Add to `cloudbuild.yaml`:
```yaml
options:
  machineType: 'E2_HIGHCPU_8'  # More powerful build machine
  logging: CLOUD_LOGGING_ONLY
```

#### 3. Check Your Current Configuration

```bash
# Check if service exists
gcloud run services describe sneaker-api --region=us-central1 2>&1

# Check build configuration
cat cloudbuild.yaml

# Check Dockerfile
cat Dockerfile
```

### Specific Error Solutions

#### Error: "failed to build: Error building"

**Solution:** Your Dockerfile might have an issue. Test locally:
```bash
docker build -t test-sneaker-api .
```

Common Dockerfile fixes:
1. Use `npm ci` instead of `npm install` for faster, deterministic builds
2. Remove `--only=production` if you need devDependencies
3. Ensure all files are copied

**Updated Dockerfile:**
```dockerfile
FROM node:20-slim

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies if needed)
RUN npm ci

# Copy application code
COPY . ./

# Environment variables
ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

CMD ["npm", "start"]
```

#### Error: "ERROR: failed to initialize analyzer: Failed to retrieve metadata"

**Solution:** Permission issue. Grant Cloud Build permissions:
```bash
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")

gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

#### Error: "Container failed to start"

**Solution:** Application crashes on startup. Check:

1. Add health check logging to index.js
2. Ensure all required files are included (not in .dockerignore)
3. Check environment variables

**Add startup logging:**
```javascript
// In index.js, before app.listen()
console.log('Starting Sneaker API...');
console.log('Environment:', process.env.NODE_ENV);
console.log('Port:', port);

app.listen(port, '0.0.0.0', function() {
    console.log(`Sneaks app listening on port ${port}`);
    console.log('Server started successfully!');
});
```

#### Error: "Build timeout"

**Solution:** Increase timeout:
```bash
# In cloudbuild.yaml, add at the top level:
timeout: '1800s'
```

### Debug Your Deployment

#### Test Locally First

```bash
# 1. Build Docker image
docker build -t test-sneaker-api .

# 2. Run container
docker run -p 8080:8080 -e PORT=8080 -e NODE_ENV=production test-sneaker-api

# 3. Test endpoints (in another terminal)
curl http://localhost:8080/health
curl "http://localhost:8080/search/jordan?count=1"

# 4. Check logs
docker logs $(docker ps -lq)
```

#### Deploy with Verbose Logging

```bash
gcloud run deploy sneaker-api \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 60s \
  --set-env-vars NODE_ENV=production \
  --verbosity=debug
```

### Check Service Status

```bash
# View service details
gcloud run services describe sneaker-api --region=us-central1

# View recent logs
gcloud run services logs read sneaker-api --region=us-central1 --limit=50

# Stream logs in real-time
gcloud run services logs tail sneaker-api --region=us-central1
```

### Common Fixes Checklist

- [ ] Dockerfile uses correct Node version (20)
- [ ] `npm ci` instead of `npm install` in Dockerfile
- [ ] PORT environment variable is used in index.js
- [ ] App listens on `0.0.0.0` not `localhost`
- [ ] All dependencies are in package.json
- [ ] .dockerignore doesn't exclude required files
- [ ] Cloud Build has necessary permissions
- [ ] Build timeout is sufficient (at least 600s)
- [ ] Health check endpoint (/health) works
- [ ] No hardcoded secrets in code

### Manual Deploy (Bypass CI/CD)

To test if the issue is with CI/CD or the application:

```bash
# Deploy directly from your machine
gcloud run deploy sneaker-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

### Get Help from Logs

```bash
# Get the most recent build
BUILD_ID=$(gcloud builds list --limit=1 --format='value(id)')

# View full logs
gcloud builds log $BUILD_ID --stream

# Or get log URL
gcloud builds describe $BUILD_ID --format='value(logUrl)'
```

### Still Stuck?

1. **Check Cloud Console:**
   - Builds: https://console.cloud.google.com/cloud-build/builds
   - Cloud Run: https://console.cloud.google.com/run
   - Logs: https://console.cloud.google.com/logs

2. **Verify your region:**
   ```bash
   # List all Cloud Run services and their regions
   gcloud run services list
   ```

3. **Try a different region:**
   ```bash
   gcloud run deploy sneaker-api \
     --source . \
     --region us-east1 \
     --allow-unauthenticated
   ```

### Contact Support

If none of these work, provide these details:
- Full build logs: `gcloud builds log BUILD_ID`
- Service description: `gcloud run services describe sneaker-api --region=REGION`
- Your Dockerfile and cloudbuild.yaml
- Error message from Cloud Console

---

## Quick Fix Script

Save this as `fix-cloudrun.sh`:

```bash
#!/bin/bash
set -e

echo "Testing local Docker build..."
docker build -t test-sneaker-api .

echo "Testing local run..."
docker run -d -p 8080:8080 -e PORT=8080 test-sneaker-api
sleep 5

echo "Testing health endpoint..."
curl -f http://localhost:8080/health && echo "✓ Health check passed" || echo "✗ Health check failed"

docker stop $(docker ps -lq)

echo "Attempting Cloud Run deploy..."
gcloud run deploy sneaker-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --timeout 300s

echo "✓ Deployment complete!"
```

Run it:
```bash
chmod +x fix-cloudrun.sh
./fix-cloudrun.sh
```
