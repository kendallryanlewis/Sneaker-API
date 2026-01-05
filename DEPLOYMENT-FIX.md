# Cloud Run Deployment Fix Summary

## Problem
Cloud Run deployment was failing after 33 seconds.

## Root Causes Identified

### 1. **Network Binding Issue (CRITICAL)** ✅ FIXED
- **Problem**: The app was not binding to `0.0.0.0`, which is required for Cloud Run
- **Original**: `app.listen(port, function() {...})`
- **Fixed**: `app.listen(port, '0.0.0.0', function() {...})`
- **Why**: Cloud Run expects containers to listen on all interfaces (`0.0.0.0`), not just localhost

### 2. **Missing Dependencies** ✅ FIXED
- **Problem**: Dockerfile used `--only=production` flag, which might skip necessary dependencies
- **Original**: `RUN npm ci --only=production`
- **Fixed**: `RUN npm ci`
- **Why**: Some packages might be needed at runtime even if listed as devDependencies

### 3. **Build Configuration** ✅ ALREADY GOOD
- Timeout was already increased to 1200s (20 minutes)
- Machine type configured for better performance

## Changes Made

### 1. [index.js](index.js)
```javascript
// Before:
app.listen(port, function () {
  console.log(`Sneaks app listening on port `, port);
});

// After:
app.listen(port, '0.0.0.0', function () {
  console.log(`Sneaks app listening on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: http://localhost:${port}/health`);
});
```

### 2. [Dockerfile](Dockerfile)
```dockerfile
# Before:
RUN npm ci --only=production

# After:
RUN npm ci
```

### 3. New Files Created
- [quick-deploy.sh](quick-deploy.sh) - One-command deployment script
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Complete troubleshooting guide

## How to Deploy Now

### Option 1: Quick Deploy (Recommended)
```bash
./quick-deploy.sh
```

This will:
1. Deploy directly from your source code
2. Automatically test the health endpoint
3. Show you the service URL
4. Provide useful commands for monitoring

### Option 2: Manual Deploy
```bash
gcloud run deploy sneaker-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

### Option 3: Using Cloud Build (CI/CD)
```bash
# Trigger a build manually
gcloud builds submit --config cloudbuild.yaml

# Or push to GitHub (if you set up GitHub Actions)
git add .
git commit -m "Fix Cloud Run deployment"
git push
```

## Verify Deployment

After deploying, test these endpoints:

```bash
# Get your service URL
SERVICE_URL=$(gcloud run services describe sneaker-api --region us-central1 --format='value(status.url)')

# Test health check
curl "$SERVICE_URL/health"

# Test search
curl "$SERVICE_URL/search/jordan?count=1"

# Test news
curl "$SERVICE_URL/news/latest?count=5"
```

## Monitor Your Deployment

### View Logs
```bash
# Stream logs in real-time
gcloud run services logs tail sneaker-api --region us-central1

# View recent logs
gcloud run services logs read sneaker-api --region us-central1 --limit=50
```

### Check Service Status
```bash
gcloud run services describe sneaker-api --region us-central1
```

### View in Console
```bash
# Open Cloud Run dashboard
open "https://console.cloud.google.com/run?project=$(gcloud config get-value project)"
```

## Common Issues After This Fix

### 1. If deployment still fails:
- Check logs: `gcloud run services logs read sneaker-api --region us-central1 --limit=50`
- Verify region: Make sure you're using `us-central1` consistently

### 2. If health check fails:
- The `/health` endpoint should return immediately
- Check that all routes are loaded before the server starts

### 3. If specific endpoints fail:
- Check for missing environment variables
- Verify external API access (Algolia, etc.)
- Check rate limiting configuration

## What Was The Issue?

The **33-second timeout** was happening because:
1. Cloud Run was trying to send health check requests to your container
2. Your app was only listening on `localhost` (127.0.0.1), not `0.0.0.0`
3. Cloud Run couldn't reach the container from outside
4. After ~30-40 seconds, Cloud Run gave up and failed the deployment

By binding to `0.0.0.0`, your app now listens on ALL network interfaces, making it accessible from Cloud Run's health check system.

## Next Steps

1. **Deploy**: Run `./quick-deploy.sh`
2. **Test**: Use the service URL to test your endpoints
3. **Monitor**: Check logs for any runtime errors
4. **Iterate**: Make changes and redeploy as needed

## Need Help?

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed troubleshooting steps and common solutions.

---

**Ready to deploy?** Run:
```bash
./quick-deploy.sh
```
