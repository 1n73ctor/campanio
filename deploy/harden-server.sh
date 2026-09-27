#!/usr/bin/env bash
# Hardens the Ubuntu server. Run once (again any time — it's safe to repeat):
#   ./deploy/harden-server.sh
# What it does:
#   1. SSH: key-only login (no passwords), no root login, 3 tries per connection
#   2. fail2ban: bans IPs that keep failing SSH logins
#   3. Automatic security updates (unattended-upgrades)
#   4. Nginx: stop advertising its version
# SAFETY: it refuses to turn off password login unless this user has an SSH key installed, so you can't lock
# yourself out. Keep your current SSH window open until you've confirmed a new key-based login works.
set -euo pipefail
step() { printf '\n\033[1;35m==> %s\033[0m\n' "$*"; }
[[ $EUID -ne 0 ]] || { echo "Run as your normal user (with sudo), not root." >&2; exit 1; }

step "Checking you have an SSH key installed (so disabling passwords can't lock you out)"
if [[ ! -s "$HOME/.ssh/authorized_keys" ]] || ! grep -qE '^(ssh-(ed25519|rsa)|ecdsa-sha2-|sk-)' "$HOME/.ssh/authorized_keys"; then
  cat >&2 <<EOF
No SSH key found for $USER. Nothing was changed.
On your Mac run:   ssh-keygen -t ed25519   then   ssh-copy-id $USER@<server-ip>
Check that 'ssh $USER@<server-ip>' logs in without a password, then run this script again.
EOF
  exit 1
fi
echo "Found $(grep -cE '^(ssh-|ecdsa-|sk-)' "$HOME/.ssh/authorized_keys") key(s) for $USER"

step "SSH: key-only, no root login"
sudo tee /etc/ssh/sshd_config.d/99-companio-hardening.conf >/dev/null <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
MaxAuthTries 3
LoginGraceTime 30
X11Forwarding no
EOF
sudo sshd -t # refuses to continue if the config is invalid
sudo systemctl reload ssh 2>/dev/null || sudo systemctl reload sshd

step "fail2ban: ban IPs that keep failing SSH logins"
sudo apt-get install -y fail2ban >/dev/null
sudo tee /etc/fail2ban/jail.d/companio.local >/dev/null <<'EOF'
[sshd]
enabled  = true
maxretry = 5
findtime = 10m
bantime  = 1h
EOF
sudo systemctl enable --now fail2ban >/dev/null
sudo systemctl restart fail2ban

step "Automatic security updates"
sudo apt-get install -y unattended-upgrades >/dev/null
echo 'APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";' | sudo tee /etc/apt/apt.conf.d/20auto-upgrades >/dev/null

step "Nginx: hide version"
echo 'server_tokens off;' | sudo tee /etc/nginx/conf.d/companio-security.conf >/dev/null
sudo nginx -t && sudo systemctl reload nginx

printf '\n\033[1;32mServer hardened.\033[0m Before closing this window, open a NEW terminal and check:  ssh %s@<server-ip>\n' "$USER"
echo "It should log you in with your key. If it doesn't, fix it from this still-open session."
