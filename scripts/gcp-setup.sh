#!/bin/bash
set -euo pipefail

# =============================================
# Muses — Google Cloud 首次初始化
# =============================================
# 运行一次即可，创建所有 GCP 基础设施
#
# 前置条件:
#   1. 安装 gcloud CLI: https://cloud.google.com/sdk/docs/install
#   2. 登录: gcloud auth login
#   3. 设置环境变量:
#      export GCP_PROJECT_ID="your-project-id"
#      export GCP_REGION="asia-east1"     # 可选，默认 asia-east1
#      export DB_PASSWORD="your-db-pass"  # Cloud SQL 密码

PROJECT_ID="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
REGION="${GCP_REGION:-asia-east1}"
DB_INSTANCE="muses-db"
DB_NAME="muses"
DB_USER="muses"
DB_PASSWORD="${DB_PASSWORD:?Set DB_PASSWORD}"
SA_NAME="muses-deploy"

echo "============================================="
echo "  Muses GCP Setup"
echo "  Project: ${PROJECT_ID}"
echo "  Region:  ${REGION}"
echo "============================================="

# ---------- 1. Enable APIs ----------
echo ""
echo "==> [1/6] Enabling GCP APIs..."
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  cloudbuild.googleapis.com \
  containerregistry.googleapis.com \
  secretmanager.googleapis.com \
  --project "${PROJECT_ID}"

# ---------- 2. Create Cloud SQL Instance ----------
echo ""
echo "==> [2/6] Creating Cloud SQL PostgreSQL instance..."
if gcloud sql instances describe "${DB_INSTANCE}" --project "${PROJECT_ID}" &>/dev/null; then
  echo "  Instance '${DB_INSTANCE}' already exists, skipping."
else
  gcloud sql instances create "${DB_INSTANCE}" \
    --project "${PROJECT_ID}" \
    --region "${REGION}" \
    --database-version POSTGRES_15 \
    --tier db-f1-micro \
    --storage-size 10GB \
    --storage-auto-increase \
    --availability-type zonal \
    --no-assign-ip \
    --network default

  echo "  Waiting for instance to be ready..."
  gcloud sql instances describe "${DB_INSTANCE}" \
    --project "${PROJECT_ID}" \
    --format "value(state)"
fi

# Create database and user
echo "  Creating database '${DB_NAME}'..."
gcloud sql databases create "${DB_NAME}" \
  --instance "${DB_INSTANCE}" \
  --project "${PROJECT_ID}" 2>/dev/null || echo "  Database already exists."

echo "  Creating user '${DB_USER}'..."
gcloud sql users create "${DB_USER}" \
  --instance "${DB_INSTANCE}" \
  --project "${PROJECT_ID}" \
  --password "${DB_PASSWORD}" 2>/dev/null || echo "  User already exists."

CLOUD_SQL_CONNECTION="${PROJECT_ID}:${REGION}:${DB_INSTANCE}"

# ---------- 3. Create Service Account ----------
echo ""
echo "==> [3/6] Creating service account for CI/CD..."
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

if gcloud iam service-accounts describe "${SA_EMAIL}" --project "${PROJECT_ID}" &>/dev/null; then
  echo "  Service account already exists."
else
  gcloud iam service-accounts create "${SA_NAME}" \
    --display-name "Muses Deploy" \
    --project "${PROJECT_ID}"
fi

# Grant roles
for role in roles/run.admin roles/cloudbuild.builds.editor roles/storage.admin roles/cloudsql.client roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member "serviceAccount:${SA_EMAIL}" \
    --role "${role}" \
    --quiet &>/dev/null
done
echo "  Roles granted."

# Generate key
SA_KEY_FILE="/tmp/muses-sa-key.json"
gcloud iam service-accounts keys create "${SA_KEY_FILE}" \
  --iam-account "${SA_EMAIL}" \
  --project "${PROJECT_ID}"
echo "  Service account key saved to: ${SA_KEY_FILE}"

# ---------- 4. Generate Secrets ----------
echo ""
echo "==> [4/6] Generating secrets..."
JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
ENCRYPTION_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@/${DB_NAME}?host=/cloudsql/${CLOUD_SQL_CONNECTION}"

# ---------- 5. Summary ----------
echo ""
echo "==> [5/6] Setup complete! Add these GitHub Secrets:"
echo ""
echo "  ┌─────────────────────────────────────────────────────────────┐"
echo "  │ GitHub Repo → Settings → Secrets and variables → Actions   │"
echo "  ├─────────────────────────────────────────────────────────────┤"
echo "  │ GCP_PROJECT_ID          = ${PROJECT_ID}"
echo "  │ GCP_SA_KEY              = (contents of ${SA_KEY_FILE})"
echo "  │ CLOUD_SQL_INSTANCE      = ${CLOUD_SQL_CONNECTION}"
echo "  │ DATABASE_URL            = ${DATABASE_URL}"
echo "  │ JWT_SECRET              = ${JWT_SECRET}"
echo "  │ ENCRYPTION_KEY          = ${ENCRYPTION_KEY}"
echo "  │ ENCRYPTION_SALT         = muses_production_salt"
echo "  │ OAUTH_GITHUB_CLIENT_ID  = (create new OAuth App)"
echo "  │ OAUTH_GITHUB_CLIENT_SECRET = (from OAuth App)"
echo "  │ OPENAI_API_KEY          = (your key)"
echo "  │ AIHUBMIX_API_KEY        = (your key)"
echo "  └─────────────────────────────────────────────────────────────┘"
echo ""
echo "  Also add Repository Variable (not secret):"
echo "  │ GCP_REGION              = ${REGION}"
echo ""

# ---------- 6. GitHub OAuth Reminder ----------
echo "==> [6/6] GitHub OAuth App setup:"
echo ""
echo "  1. Go to https://github.com/settings/developers"
echo "  2. Create new OAuth App:"
echo "     - Name: Muses Production"
echo "     - Homepage: (will be your frontend Cloud Run URL)"
echo "     - Callback: (will be your backend Cloud Run URL)/api/auth/github/callback"
echo "  3. After first deploy, update the callback URL with the real backend URL"
echo ""
echo "============================================="
echo "  Ready! Push to main to trigger deployment."
echo "============================================="
