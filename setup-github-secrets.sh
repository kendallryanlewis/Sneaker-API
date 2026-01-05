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
