#!/bin/bash
set -euo pipefail

# =============================================
# Muses — 手动部署到 Google Cloud Run
# =============================================
# 前置: 先运行 scripts/gcp-setup.sh 完成 GCP 初始化
#
# Usage:
#   export GCP_PROJECT_ID="your-project"
#   ./deploy.sh                   # 部署全部
#   ./deploy.sh backend           # 只部署后端
#   ./deploy.sh frontend          # 只部署前端

PROJECT_ID="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID env var}"
REGION="${GCP_REGION:-asia-east1}"
CLOUD_SQL_INSTANCE="${CLOUD_SQL_INSTANCE:-${PROJECT_ID}:${REGION}:muses-db}"
TARGET="${1:-all}"

BACKEND_IMAGE="gcr.io/${PROJECT_ID}/muses-backend"
FRONTEND_IMAGE="gcr.io/${PROJECT_ID}/muses-frontend"

deploy_backend() {
  echo "==> Building backend..."
  docker build -t "${BACKEND_IMAGE}:latest" backend-python/
  docker push "${BACKEND_IMAGE}:latest"

  echo "==> Deploying backend to Cloud Run..."

  # 从本地 backend-python/.env 读取变量（如果存在 backend-env.yaml 则优先用它）
  if [ -f backend-env.yaml ]; then
    gcloud run deploy muses-backend \
      --image "${BACKEND_IMAGE}:latest" \
      --region "${REGION}" --project "${PROJECT_ID}" \
      --allow-unauthenticated \
      --add-cloudsql-instances "${CLOUD_SQL_INSTANCE}" \
      --memory 512Mi --cpu 1 \
      --min-instances 0 --max-instances 3 \
      --env-vars-file backend-env.yaml
  else
    echo "  No backend-env.yaml found."
    echo "  Copy backend-env.yaml.template → backend-env.yaml and fill in values."
    echo "  Or set env vars directly in Cloud Run console."
    exit 1
  fi

  BACKEND_URL=$(gcloud run services describe muses-backend \
    --region "${REGION}" --project "${PROJECT_ID}" \
    --format "value(status.url)")

  # 回填 BACKEND_URL
  gcloud run services update muses-backend \
    --region "${REGION}" --project "${PROJECT_ID}" \
    --update-env-vars "BACKEND_URL=${BACKEND_URL}" --quiet

  echo "==> Backend: ${BACKEND_URL}"
}

deploy_frontend() {
  # 获取后端 URL
  BACKEND_URL=$(gcloud run services describe muses-backend \
    --region "${REGION}" --project "${PROJECT_ID}" \
    --format "value(status.url)")

  echo "==> Building frontend (API → ${BACKEND_URL})..."
  docker build \
    --build-arg "NEXT_PUBLIC_API_URL=${BACKEND_URL}" \
    -t "${FRONTEND_IMAGE}:latest" frontend/
  docker push "${FRONTEND_IMAGE}:latest"

  echo "==> Deploying frontend to Cloud Run..."
  gcloud run deploy muses-frontend \
    --image "${FRONTEND_IMAGE}:latest" \
    --region "${REGION}" --project "${PROJECT_ID}" \
    --allow-unauthenticated \
    --memory 256Mi --cpu 1 \
    --min-instances 0 --max-instances 3 \
    --set-env-vars "BACKEND_INTERNAL_URL=${BACKEND_URL}"

  FRONTEND_URL=$(gcloud run services describe muses-frontend \
    --region "${REGION}" --project "${PROJECT_ID}" \
    --format "value(status.url)")

  # 更新后端 CORS
  gcloud run services update muses-backend \
    --region "${REGION}" --project "${PROJECT_ID}" \
    --update-env-vars "FRONTEND_URL=${FRONTEND_URL}" --quiet

  echo "==> Frontend: ${FRONTEND_URL}"
}

case "${TARGET}" in
  backend)  deploy_backend ;;
  frontend) deploy_frontend ;;
  all)
    deploy_backend
    deploy_frontend
    echo ""
    echo "============================================="
    echo "  Deployment Complete!"
    echo "============================================="
    echo "  Next: update GitHub OAuth callback URL to:"
    echo "  ${BACKEND_URL}/api/auth/github/callback"
    echo "============================================="
    ;;
  *) echo "Usage: $0 [all|backend|frontend]"; exit 1 ;;
esac
