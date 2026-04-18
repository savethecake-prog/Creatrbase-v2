#!/bin/bash
# deploy-live.sh — Deploy current main branch to production VPS
# Usage: bash scripts/deploy-live.sh

set -euo pipefail

VPS="root@153.92.208.28"
APP_DIR="/root/creatrbase-v2"

echo "==> Pushing to origin..."
git push origin main

echo "==> Deploying to VPS..."
ssh "$VPS" "cd $APP_DIR && git checkout -- . && git clean -fd && git pull && npm install --production && cd client && npm install && npm run build && cd .. && pm2 restart creatrbase"

echo "==> Waiting for server to start..."
sleep 3

echo "==> Pre-rendering public pages..."
ssh "$VPS" "cd $APP_DIR && node scripts/prerender.js"

echo ""
echo "✓ Deployed and pre-rendered at https://creatrbase.com"
