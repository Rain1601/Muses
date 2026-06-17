#!/usr/bin/env bash
# Push Muses-owned env vars from backend/.env to the linked Vercel project.
# Idempotent: removes existing var before adding (CLI has no upsert).
# Never echoes secret values.

set -euo pipefail

ENV_FILE="$(cd "$(dirname "$0")/.." && pwd)/../backend/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found" >&2
  exit 1
fi

# Load .env into shell, but DO NOT print values.
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

KEYS=(
  JWT_SECRET
  ENCRYPTION_KEY
  ENCRYPTION_SALT
  GITHUB_CLIENT_ID
  GITHUB_CLIENT_SECRET
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
)

ENVS=(development preview production)

for key in "${KEYS[@]}"; do
  value="${!key:-}"
  if [ -z "$value" ]; then
    echo "skip   $key (not set in backend/.env)"
    continue
  fi
  for env in "${ENVS[@]}"; do
    # Best-effort remove (silently ignore if missing)
    vercel env rm "$key" "$env" --yes >/dev/null 2>&1 || true
  done
  # Add to all three envs in one shot
  if printf "%s" "$value" | vercel env add "$key" development preview production >/dev/null 2>&1; then
    echo "push   $key (development preview production)"
  else
    # Some CLI versions only allow one env per add — fall back to one at a time.
    for env in "${ENVS[@]}"; do
      printf "%s" "$value" | vercel env add "$key" "$env" >/dev/null 2>&1 || true
    done
    echo "push   $key (one-by-one fallback)"
  fi
done

echo "---"
echo "Done. Run \`vercel env ls\` to verify (values stay encrypted)."
