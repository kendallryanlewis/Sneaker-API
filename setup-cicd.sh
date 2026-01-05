#!/bin/bash

# Setup CI/CD with Google Cloud Build and GitHub
# This script automates the Cloud Build + GitHub integration

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}CI/CD Setup for Sneaker API${NC}"
echo -e "${GREEN}================================${NC}"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI is not installed${NC}"
    exit 1
fi

# Get project ID
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Error: No GCP project configured${NC}"
    exit 1
fi

echo -e "${BLUE}Project ID:${NC} $PROJECT_ID"
echo ""

# Enable required APIs
echo -e "${YELLOW}Step 1: Enabling required APIs...${NC}"
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
echo -e "${GREEN}✓ APIs enabled${NC}"
echo ""

# Get project number
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

# Grant permissions to Cloud Build service account
echo -e "${YELLOW}Step 2: Granting permissions to Cloud Build...${NC}"
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/run.admin" \
  --condition=None \
  --quiet

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser" \
  --condition=None \
  --quiet

echo -e "${GREEN}✓ Permissions granted${NC}"
echo ""

# Check for GitHub repository info
echo -e "${YELLOW}Step 3: GitHub Repository Setup${NC}"
read -p "Enter your GitHub username: " GITHUB_USER
read -p "Enter your repository name [Sneaker-API]: " REPO_NAME
REPO_NAME=${REPO_NAME:-Sneaker-API}

echo ""
echo -e "${BLUE}Repository:${NC} $GITHUB_USER/$REPO_NAME"
echo ""

# Ask which method to use
echo -e "${YELLOW}Choose CI/CD method:${NC}"
echo "  1) Cloud Build (Recommended - integrated with GCP)"
echo "  2) GitHub Actions (More flexible, runs on GitHub)"
echo ""
read -p "Enter choice (1 or 2): " CICD_CHOICE

if [ "$CICD_CHOICE" = "1" ]; then
    echo ""
    echo -e "${GREEN}Setting up Cloud Build...${NC}"
    echo ""
    echo -e "${YELLOW}Manual steps required:${NC}"
    echo "1. Open: ${BLUE}https://console.cloud.google.com/cloud-build/triggers${NC}"
    echo "2. Click 'Connect Repository'"
    echo "3. Select 'GitHub' and authenticate"
    echo "4. Select repository: ${BLUE}$GITHUB_USER/$REPO_NAME${NC}"
    echo "5. Click 'Connect'"
    echo ""
    echo "Then run this command to create the trigger:"
    echo ""
    echo -e "${BLUE}gcloud builds triggers create github \\
  --name=\"deploy-sneaker-api\" \\
  --repo-name=\"$REPO_NAME\" \\
  --repo-owner=\"$GITHUB_USER\" \\
  --branch-pattern=\"^main$\" \\
  --build-config=\"cloudbuild.yaml\"${NC}"
    echo ""
    
elif [ "$CICD_CHOICE" = "2" ]; then
    echo ""
    echo -e "${GREEN}Setting up GitHub Actions...${NC}"
    
    # Create service account for GitHub Actions
    SA_NAME="github-actions"
    SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
    
    echo ""
    echo -e "${YELLOW}Creating service account...${NC}"
    
    # Check if service account exists
    if gcloud iam service-accounts describe $SA_EMAIL &>/dev/null; then
        echo -e "${YELLOW}Service account already exists${NC}"
    else
        gcloud iam service-accounts create $SA_NAME \
          --display-name="GitHub Actions" \
          --quiet
        echo -e "${GREEN}✓ Service account created${NC}"
    fi
    
    # Grant permissions
    echo -e "${YELLOW}Granting permissions...${NC}"
    gcloud projects add-iam-policy-binding $PROJECT_ID \
      --member="serviceAccount:${SA_EMAIL}" \
      --role="roles/run.admin" \
      --condition=None \
      --quiet
    
    gcloud projects add-iam-policy-binding $PROJECT_ID \
      --member="serviceAccount:${SA_EMAIL}" \
      --role="roles/storage.admin" \
      --condition=None \
      --quiet
    
    gcloud projects add-iam-policy-binding $PROJECT_ID \
      --member="serviceAccount:${SA_EMAIL}" \
      --role="roles/iam.serviceAccountUser" \
      --condition=None \
      --quiet
    
    echo -e "${GREEN}✓ Permissions granted${NC}"
    
    # Create key
    echo ""
    echo -e "${YELLOW}Creating service account key...${NC}"
    KEY_FILE="gcp-key.json"
    gcloud iam service-accounts keys create $KEY_FILE \
      --iam-account=$SA_EMAIL \
      --quiet
    
    echo -e "${GREEN}✓ Key created: $KEY_FILE${NC}"
    echo ""
    echo -e "${RED}⚠️  IMPORTANT: Add these secrets to GitHub:${NC}"
    echo ""
    echo "1. Go to: ${BLUE}https://github.com/$GITHUB_USER/$REPO_NAME/settings/secrets/actions${NC}"
    echo ""
    echo "2. Add secret: ${YELLOW}GCP_PROJECT_ID${NC}"
    echo "   Value: ${BLUE}$PROJECT_ID${NC}"
    echo ""
    echo "3. Add secret: ${YELLOW}GCP_SA_KEY${NC}"
    echo "   Value: Copy the entire contents of ${BLUE}$KEY_FILE${NC}"
    echo ""
    echo "   To display the key file:"
    echo "   ${BLUE}cat $KEY_FILE${NC}"
    echo ""
    echo -e "${RED}⚠️  Keep this key file secure! Add it to .gitignore${NC}"
    echo ""
    
    # Add to gitignore
    if ! grep -q "gcp-key.json" .gitignore 2>/dev/null; then
        echo "gcp-key.json" >> .gitignore
        echo -e "${GREEN}✓ Added $KEY_FILE to .gitignore${NC}"
    fi
else
    echo -e "${RED}Invalid choice${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Setup Complete! 🎉${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Commit your changes (including .github/workflows/deploy.yml)"
echo "2. Push to GitHub: ${BLUE}git push origin main${NC}"
echo "3. Watch the deployment in:"
if [ "$CICD_CHOICE" = "1" ]; then
    echo "   ${BLUE}https://console.cloud.google.com/cloud-build/builds${NC}"
else
    echo "   ${BLUE}https://github.com/$GITHUB_USER/$REPO_NAME/actions${NC}"
fi
echo ""
echo -e "${YELLOW}Test your deployment:${NC}"
echo "   ${BLUE}curl https://YOUR-SERVICE-URL/health${NC}"
echo ""
