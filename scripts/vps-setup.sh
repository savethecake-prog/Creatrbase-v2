#!/bin/bash
# vps-setup.sh — Creatrbase initial VPS bootstrap
# Run as root on a fresh Ubuntu 22.04 LTS Hostinger VPS
# Usage: bash vps-setup.sh

set -euo pipefail

echo "==> Updating system packages..."
apt-get update -y && apt-get upgrade -y

echo "==> Installing base utilities..."
apt-get install -y curl git ufw fail2ban unzip

# ─── Node.js 20 LTS ───────────────────────────────────────────────────────────
echo "==> Installing Node.js 20 LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node --version
npm --version

# ─── PostgreSQL 15 ────────────────────────────────────────────────────────────
echo "==> Installing PostgreSQL 15..."
apt-get install -y postgresql postgresql-contrib
systemctl enable postgresql
systemctl start postgresql

echo "==> Creating database and user..."
sudo -u postgres psql <<'PSQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'creatrbase') THEN
    CREATE USER creatrbase WITH PASSWORD 'CHANGE_THIS_DB_PASSWORD';
  END IF;
END
$$;
CREATE DATABASE creatrbase OWNER creatrbase;
GRANT ALL PRIVILEGES ON DATABASE creatrbase TO creatrbase;
PSQL

# ─── Docker (for Redis 7) ─────────────────────────────────────────────────────
echo "==> Installing Docker..."
apt-get install -y docker.io
systemctl enable docker
systemctl start docker

echo "==> Starting Redis 7..."
docker run -d \
  --name redis \
  --restart unless-stopped \
  -p 127.0.0.1:6379:6379 \
  redis:7-alpine

# ─── Nginx ────────────────────────────────────────────────────────────────────
echo "==> Installing Nginx..."
apt-get install -y nginx
systemctl enable nginx
systemctl start nginx

# ─── PM2 ──────────────────────────────────────────────────────────────────────
echo "==> Installing PM2..."
npm install -g pm2
pm2 startup systemd -u root --hp /root

# ─── Certbot ──────────────────────────────────────────────────────────────────
echo "==> Installing Certbot..."
apt-get install -y certbot python3-certbot-nginx

# ─── Firewall ─────────────────────────────────────────────────────────────────
echo "==> Configuring UFW firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
ufw status

# ─── Deploy user ──────────────────────────────────────────────────────────────
echo "==> Creating deploy user..."
if ! id "deploy" &>/dev/null; then
  adduser --disabled-password --gecos "" deploy
  usermod -aG sudo deploy
  usermod -aG docker deploy
fi

mkdir -p /home/deploy/.ssh
chmod 700 /home/deploy/.ssh

# App directory
mkdir -p /var/www/creatrbase
chown deploy:deploy /var/www/creatrbase

echo ""
echo "════════════════════════════════════════════════════════"
echo "  VPS base setup complete."
echo ""
echo "  NEXT STEPS:"
echo "  1. Add your SSH public key:"
echo "     echo 'YOUR_PUBLIC_KEY' >> /home/deploy/.ssh/authorized_keys"
echo "     chmod 600 /home/deploy/.ssh/authorized_keys"
echo "     chown -R deploy:deploy /home/deploy/.ssh"
echo ""
echo "  2. Change the PostgreSQL password in this script"
echo "     and update DATABASE_URL in your .env"
echo ""
echo "  3. Configure Nginx (see scripts/nginx.conf)"
echo "  4. Run certbot after DNS propagates:"
echo "     certbot --nginx -d creatrbase.com -d www.creatrbase.com"
echo "════════════════════════════════════════════════════════"
