#!/bin/bash
# deploy.sh — Initial app deployment for Creatrbase
# Run as root on the VPS after vps-setup.sh has completed
# Usage: bash deploy.sh

set -euo pipefail

DB_PASSWORD="Cbx9mP2vKq7nRw4Tz8Qs"
APP_DIR="/var/www/creatrbase"
REPO="https://github.com/savethecake-prog/Creatrbase-v2.git"
SESSION_SECRET="$(cat /proc/sys/kernel/random/uuid)$(cat /proc/sys/kernel/random/uuid)"

echo "==> Resetting PostgreSQL password..."
sudo -u postgres psql -c "ALTER USER creatrbase WITH PASSWORD '${DB_PASSWORD}';"

echo "==> Cloning repository..."
cd "$APP_DIR"
if [ -d ".git" ]; then
  echo "  Repo exists — pulling latest..."
  git pull
else
  git clone "$REPO" .
fi

echo "==> Installing dependencies..."
npm install --production

echo "==> Writing .env..."
cat > .env << EOF
PORT=3000
NODE_ENV=production
DATABASE_URL=postgresql://creatrbase:${DB_PASSWORD}@localhost:5432/creatrbase
REDIS_URL=redis://127.0.0.1:6379
SESSION_SECRET=${SESSION_SECRET}

# Fill these in before using any features that require them:
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
# GOOGLE_CALLBACK_URL=https://creatrbase.com/auth/google/callback
# TWITCH_CLIENT_ID=
# TWITCH_CLIENT_SECRET=
# TWITCH_CALLBACK_URL=https://creatrbase.com/auth/twitch/callback
# YOUTUBE_API_KEY=
# ANTHROPIC_API_KEY=
# STRIPE_SECRET_KEY=
# STRIPE_WEBHOOK_SECRET=
# RESEND_API_KEY=
# ENCRYPTION_KEY=
EOF
chmod 600 .env

echo "==> Running database migrations..."
node scripts/migrate.js

echo "==> Starting app with PM2..."
if pm2 list | grep -q "creatrbase"; then
  pm2 restart creatrbase
else
  pm2 start src/app.js --name creatrbase
fi
pm2 save

echo ""
echo "════════════════════════════════════════════════════════"
echo "  Deploy complete."
echo ""
echo "  DB password: ${DB_PASSWORD}"
echo "  App:         https://creatrbase.com/health"
echo ""
echo "  Next: fill in API keys in /var/www/creatrbase/.env"
echo "        then: pm2 restart creatrbase"
echo "════════════════════════════════════════════════════════"
