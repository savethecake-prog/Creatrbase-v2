#!/bin/bash
# deploy-live.sh — Deploy current main branch to production VPS
# Usage: bash scripts/deploy-live.sh [--skip-prerender]
#
# To override defaults:
#   CREATRBASE_VPS_HOST=1.2.3.4 bash scripts/deploy-live.sh
#   CREATRBASE_VPS_USER=deploy  bash scripts/deploy-live.sh
#
# TODO: create a non-root deploy user on VPS and update DEPLOY_USER below.

set -euo pipefail

# ── Config (override via environment) ────────────────────────────────────────

DEPLOY_HOST="${CREATRBASE_VPS_HOST:-153.92.208.28}"
DEPLOY_USER="${CREATRBASE_VPS_USER:-root}"
APP_DIR="${CREATRBASE_APP_DIR:-/root/creatrbase-v2}"
PM2_PROCESS="${CREATRBASE_PM2_PROCESS:-creatrbase}"
HEALTH_URL="https://creatrbase.com/health"
SKIP_PRERENDER="${1:-}"

VPS="${DEPLOY_USER}@${DEPLOY_HOST}"

# ── Pre-deploy checks ─────────────────────────────────────────────────────────

echo "==> Pre-deploy: checking for uncommitted changes..."
if ! git diff-index --quiet HEAD --; then
  echo "ERROR: Uncommitted changes detected. Commit or stash before deploying."
  exit 1
fi

echo "==> Pre-deploy: building client locally to catch errors early..."
(cd client && npm install --silent && npm run build -- --logLevel warn)
echo "    Client build OK"

# Record pre-deploy commit for rollback reference
PREV_COMMIT=$(git rev-parse HEAD)
echo "==> Current commit: $PREV_COMMIT (save this for rollback if needed)"

# ── Push ──────────────────────────────────────────────────────────────────────

echo "==> Pushing to origin main..."
git push origin main

# ── Deploy on VPS ─────────────────────────────────────────────────────────────

echo "==> Deploying on VPS..."
ssh "$VPS" bash << REMOTE
  set -euo pipefail
  cd "$APP_DIR"

  echo "  -> Pulling latest..."
  git pull --ff-only

  echo "  -> Installing server dependencies..."
  npm install --omit=dev --silent

  echo "  -> Building client..."
  cd client && npm install --silent && npm run build -- --logLevel warn && cd ..

  echo "  -> Restarting app..."
  pm2 restart "$PM2_PROCESS" --update-env

  echo "  -> Waiting for process to stabilise..."
  sleep 3

  STATUS=\$(pm2 jlist | python3 -c "import sys,json; procs=[p for p in json.load(sys.stdin) if p['name']=='$PM2_PROCESS']; print(procs[0]['pm2_env']['status'] if procs else 'not_found')" 2>/dev/null || echo "unknown")
  if [ "\$STATUS" != "online" ]; then
    echo "ERROR: pm2 process is '\$STATUS' after restart — rolling back"
    git reset --hard "$PREV_COMMIT"
    pm2 restart "$PM2_PROCESS"
    exit 1
  fi

  echo "  -> App is online"
REMOTE

# ── Health check ──────────────────────────────────────────────────────────────

echo "==> Health check..."
sleep 2
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" || echo "000")
if [ "$HTTP_STATUS" != "200" ]; then
  echo "WARNING: Health check returned HTTP $HTTP_STATUS. Check the app at $HEALTH_URL"
else
  echo "    Health check passed (HTTP $HTTP_STATUS)"
fi

# ── Pre-render ────────────────────────────────────────────────────────────────

if [ "$SKIP_PRERENDER" != "--skip-prerender" ]; then
  echo "==> Pre-rendering public pages..."
  ssh "$VPS" "cd $APP_DIR && node scripts/prerender.js"
  echo "    Pre-render complete"
fi

# ── Done ──────────────────────────────────────────────────────────────────────

echo ""
echo "✓ Deployed successfully at https://creatrbase.com"
echo ""
echo "  Rollback command if needed:"
echo "  ssh $VPS \"cd $APP_DIR && git reset --hard $PREV_COMMIT && pm2 restart $PM2_PROCESS\""
