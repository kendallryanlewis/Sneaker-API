# Quick Start: Deploy to Google Cloud

## TL;DR - Deploy in 3 Commands

```bash
# 1. Install Google Cloud SDK
brew install --cask google-cloud-sdk

# 2. Login and set project
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# 3. Deploy!
./deploy-gcloud.sh
```

That's it! Your API will be live in ~5 minutes.

---

## What You Get

- ✅ **Live API URL** - `https://sneaker-api-xxxxx.run.app`
- ✅ **Auto-scaling** - Scales to zero when not used
- ✅ **HTTPS** - Automatic SSL certificate
- ✅ **Global CDN** - Fast worldwide access
- ✅ **Cost-effective** - Pay only for requests (~$2-5/month for 1M requests)

---

## Step-by-Step Instructions

### 1. Prerequisites

**Install Google Cloud SDK:**

macOS:
```bash
brew install --cask google-cloud-sdk
```

Windows:
- Download from: https://cloud.google.com/sdk/docs/install

Linux:
```bash
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
```

**Login:**
```bash
gcloud auth login
```

**Set your project:**
```bash
# Create new project (if needed)
gcloud projects create YOUR_PROJECT_ID

# Set active project
gcloud config set project YOUR_PROJECT_ID

# Enable billing (required)
# Go to: https://console.cloud.google.com/billing
```

### 2. Deploy to Cloud Run (Recommended)

**Option A: Using the deployment script**
```bash
./deploy-gcloud.sh
```

**Option B: Manual deployment**
```bash
gcloud run deploy sneaker-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

**That's it!** Your API is now live at the URL shown in the terminal.

### 3. Test Your Deployment

```bash
# Get your service URL
SERVICE_URL=$(gcloud run services describe sneaker-api \
  --region us-central1 \
  --format 'value(status.url)')

# Test endpoints
curl $SERVICE_URL/health
curl "$SERVICE_URL/search/jordan?count=5"
curl $SERVICE_URL/popular/10
curl $SERVICE_URL/news/latest
```

---

## Alternative: Deploy to App Engine

If you prefer App Engine (simpler but always-on):

```bash
# Deploy
gcloud app deploy

# That's it! Your URL will be:
# https://YOUR_PROJECT_ID.appspot.com
```

---

## Common Issues & Solutions

**Issue: "Permission denied"**
```bash
gcloud auth login
```

**Issue: "Billing not enabled"**
- Go to: https://console.cloud.google.com/billing
- Enable billing for your project

**Issue: "API not enabled"**
```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
```

**Issue: Port not responding**
- The API uses PORT environment variable (automatically set by Cloud Run)
- Local testing: `PORT=8080 npm start`

---

## What's Next?

### Monitor Your API
```bash
# View logs
gcloud run services logs tail sneaker-api

# Open Cloud Console
gcloud run services describe sneaker-api --region us-central1
```

### Custom Domain
```bash
gcloud run domain-mappings create \
  --service sneaker-api \
  --domain api.yourdomain.com \
  --region us-central1
```

### Update/Redeploy
```bash
# Make changes to your code, then:
gcloud run deploy sneaker-api --source .
```

### Scale Configuration
```bash
# Adjust memory/CPU
gcloud run services update sneaker-api \
  --memory 1Gi \
  --cpu 2

# Adjust instances
gcloud run services update sneaker-api \
  --min-instances 1 \
  --max-instances 50
```

---

## Cost Estimates

**Cloud Run (Pay per use):**
- First 2 million requests: FREE
- After that: $0.40 per million requests
- Typical cost: $2-10/month

**Always Free Tier:**
- 2 million requests/month
- 360,000 GB-seconds of memory
- 180,000 vCPU-seconds

**Example costs:**
- 1M requests/month: $0 (free tier)
- 5M requests/month: ~$5-8
- 10M requests/month: ~$12-16

**To reduce costs:**
- Set `min-instances: 0` (scales to zero)
- Reduce memory: `--memory 256Mi`
- Use caching (already implemented!)

---

## Support & Resources

**Documentation:**
- [Complete Deployment Guide](./GOOGLE-CLOUD-DEPLOYMENT.md)
- [API Features](./API-FEATURES.md)
- [News API Endpoints](./NEWS-API-ENDPOINTS.md)

**Google Cloud:**
- [Cloud Run Docs](https://cloud.google.com/run/docs)
- [Pricing Calculator](https://cloud.google.com/products/calculator)
- [Console](https://console.cloud.google.com)

**Commands Cheat Sheet:**
```bash
# View service
gcloud run services describe sneaker-api

# View logs
gcloud run services logs tail sneaker-api

# Update
gcloud run deploy sneaker-api --source .

# Delete
gcloud run services delete sneaker-api

# SSH (if using Compute Engine)
gcloud compute ssh instance-name
```

---

## Need Help?

1. Check [GOOGLE-CLOUD-DEPLOYMENT.md](./GOOGLE-CLOUD-DEPLOYMENT.md) for detailed instructions
2. View Cloud Console: https://console.cloud.google.com
3. Check logs: `gcloud run services logs tail sneaker-api`
4. Verify health: `curl YOUR-URL/health`

---

**That's it! You're now running a production sneaker API on Google Cloud! 🚀**
