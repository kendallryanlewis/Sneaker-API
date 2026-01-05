# GitHub Actions Setup for Cloud Run Deployment

## The Error You're Seeing

```
ERROR: failed to build: invalid tag "gcr.io//sneaker-api:..."
```

The double slash (`//`) means `$PROJECT_ID` is empty because GitHub Secrets aren't configured.

## Quick Fix - Set Your GitHub Secrets

### Option 1: Use GitHub CLI (Fastest)

```bash
# Set your project ID
gh secret set GCP_PROJECT_ID --body "kndl-3663b"

# Set your service account key
# First, create the service account key (if you haven't already)
gcloud iam service-accounts keys create ~/gcp-key.json \
  --iam-account=github-actions@kndl-3663b.iam.gserviceaccount.com

# Then set it as a secret
gh secret set GCP_SA_KEY < ~/gcp-key.json

# Clean up the key file
rm ~/gcp-key.json
```

### Option 2: Use GitHub Web Interface

1. **Go to your repository on GitHub**
   - Navigate to: `https://github.com/YOUR_USERNAME/YOUR_REPO`

2. **Open Settings**
   - Click on **Settings** tab
   - Click on **Secrets and variables** → **Actions**

3. **Add GCP_PROJECT_ID**
   - Click **New repository secret**
   - Name: `GCP_PROJECT_ID`
   - Secret: `kndl-3663b`
   - Click **Add secret**

4. **Add GCP_SA_KEY**
   - Click **New repository secret**
   - Name: `GCP_SA_KEY`
   - Secret: (paste the entire JSON key - see below)
   - Click **Add secret**

### Creating the Service Account Key

If you don't have the service account key JSON:

```bash
# 1. Create service account (if it doesn't exist)
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions" \
  --project=kndl-3663b

# 2. Grant necessary permissions
gcloud projects add-iam-policy-binding kndl-3663b \
  --member="serviceAccount:github-actions@kndl-3663b.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding kndl-3663b \
  --member="serviceAccount:github-actions@kndl-3663b.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding kndl-3663b \
  --member="serviceAccount:github-actions@kndl-3663b.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# 3. Create and download key
gcloud iam service-accounts keys create ~/gcp-key.json \
  --iam-account=github-actions@kndl-3663b.iam.gserviceaccount.com \
  --project=kndl-3663b

# 4. Display the key (to copy for GitHub)
cat ~/gcp-key.json

# 5. Copy the ENTIRE JSON output and paste it as GCP_SA_KEY secret in GitHub

# 6. Delete the local file for security
rm ~/gcp-key.json
```

## Verify Your Setup

### Check if secrets are set (GitHub CLI):

```bash
gh secret list
```

You should see:
```
GCP_PROJECT_ID  Updated YYYY-MM-DD
GCP_SA_KEY      Updated YYYY-MM-DD
```

### Test the workflow:

```bash
# Trigger a manual workflow run
gh workflow run deploy.yml

# Or push to trigger automatically
git add .
git commit -m "Test GitHub Actions deployment"
git push
```

## Alternative: Deploy Without Secrets (Fallback)

I've updated the workflow to use `kndl-3663b` as a fallback if the secret isn't set. However, you still need `GCP_SA_KEY` for authentication.

## Complete Setup Script

Save this as `setup-github-secrets.sh`:

```bash
#!/bin/bash
set -e

PROJECT_ID="kndl-3663b"
SERVICE_ACCOUNT="github-actions"
KEY_FILE="gcp-key.json"

echo "🔐 Setting up GitHub Actions secrets for Cloud Run deployment"
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed."
    echo "Install it with: brew install gh"
    exit 1
fi

# Check if logged in to GitHub
if ! gh auth status &> /dev/null; then
    echo "🔑 Please login to GitHub CLI:"
    gh auth login
fi

# Create service account if it doesn't exist
echo "1️⃣ Creating service account..."
gcloud iam service-accounts create $SERVICE_ACCOUNT \
  --display-name="GitHub Actions" \
  --project=$PROJECT_ID \
  2>/dev/null || echo "   Service account already exists"

# Grant permissions
echo "2️⃣ Granting permissions..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.admin" \
  --quiet

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/storage.admin" \
  --quiet

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser" \
  --quiet

# Create key
echo "3️⃣ Creating service account key..."
gcloud iam service-accounts keys create $KEY_FILE \
  --iam-account="${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --project=$PROJECT_ID

# Set GitHub secrets
echo "4️⃣ Setting GitHub secrets..."
gh secret set GCP_PROJECT_ID --body "$PROJECT_ID"
gh secret set GCP_SA_KEY < $KEY_FILE

# Clean up
echo "5️⃣ Cleaning up..."
rm $KEY_FILE

echo ""
echo "✅ Setup complete!"
echo ""
echo "Your GitHub secrets are now configured:"
gh secret list

echo ""
echo "🚀 Next steps:"
echo "  1. Push your code: git push"
echo "  2. Watch the workflow: gh run watch"
echo "  3. Or view in browser: gh run list --web"
```

Run it:

```bash
chmod +x setup-github-secrets.sh
./setup-github-secrets.sh
```

## Monitor Your Deployment

### View workflow runs:

```bash
# List recent runs
gh run list

# Watch the latest run
gh run watch

# View in browser
gh run list --web
```

### View deployment logs:

```bash
# View workflow logs
gh run view --log

# View Cloud Run logs
gcloud run services logs tail sneaker-api --region us-central1
```

## Troubleshooting

### "Resource not accessible by integration"
- Your GitHub token needs the `workflow` scope
- Run: `gh auth refresh -s workflow`

### "Service account does not exist"
- Make sure you ran the service account creation commands
- Check: `gcloud iam service-accounts list --project=kndl-3663b`

### "Permission denied"
- The service account needs proper IAM roles
- Re-run the permission grant commands above

### "Invalid credentials"
- Regenerate the service account key
- Update the GCP_SA_KEY secret in GitHub

## Manual Deployment (If GitHub Actions Fails)

You can always deploy manually:

```bash
./quick-deploy.sh
```

Or use Cloud Build:

```bash
gcloud builds submit --config cloudbuild.yaml
```

---

## Summary

**Required GitHub Secrets:**
- `GCP_PROJECT_ID`: `kndl-3663b`
- `GCP_SA_KEY`: Service account JSON key

**Quick Setup:**
```bash
./setup-github-secrets.sh
```

**Verify:**
```bash
gh secret list
```

**Deploy:**
```bash
git push
```
