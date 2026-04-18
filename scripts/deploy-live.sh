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

echo ""
echo "✓ Deployed to https://creatrbase.com"
