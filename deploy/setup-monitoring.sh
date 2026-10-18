#!/usr/bin/env bash
# Live server monitoring at https://<site>/ops/ (password-protected):
#   /ops/netdata/   Netdata — real-time CPU, memory, disk, network, nginx requests/s and errors, PM2/Node processes
#   /ops/requests/  GoAccess — live request analytics from the nginx log (pages, API endpoints, status codes, slow requests)
# Neither listens on a public port: Netdata and GoAccess bind to 127.0.0.1 and nginx serves them behind basic auth.
# Safe to run again. Usage (on the server): sudo bash deploy/setup-monitoring.sh getcompanio.in
set -euo pipefail
SITE="${1:-getcompanio.in}"
OPS=/var/www/companio-ops
HTPASSWD=/etc/nginx/companio-ops.htpasswd
SNIPPET=/etc/nginx/snippets/companio-ops.conf
LOG=/var/log/nginx/companio.log

echo "== nginx: a request log with timings, and a local-only status page for Netdata"
cat > /etc/nginx/conf.d/companio-logging.conf <<'EOF'
# Companio request log: the usual "combined" fields + request time, upstream time and host (for GoAccess and Netdata)
log_format companio '$remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent "$http_referer" "$http_user_agent" $request_time $upstream_response_time $host';
access_log /var/log/nginx/companio.log companio;

# nginx's own counters for Netdata — reachable from this machine only
server {
    listen 127.0.0.1:8081;
    server_name localhost;
    location = /stub_status { stub_status; allow 127.0.0.1; deny all; }
}
EOF

echo "== password for /ops/"
if [ ! -s "$HTPASSWD" ]; then
  PASS=$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)
  printf 'ops:%s\n' "$(openssl passwd -apr1 "$PASS")" > "$HTPASSWD"
  printf 'https://%s/ops/\nuser: ops\npassword: %s\n' "$SITE" "$PASS" > /root/companio-ops-login.txt
  chmod 600 /root/companio-ops-login.txt
fi
chown root:www-data "$HTPASSWD"; chmod 640 "$HTPASSWD"

echo "== Netdata"
if ! command -v netdata >/dev/null && [ ! -x /opt/netdata/bin/netdata ]; then
  curl -fsSL https://get.netdata.cloud/kickstart.sh -o /tmp/netdata-kickstart.sh
  sh /tmp/netdata-kickstart.sh --non-interactive --stable-channel --disable-telemetry
fi
NDCONF=/etc/netdata; [ -d /opt/netdata/etc/netdata ] && NDCONF=/opt/netdata/etc/netdata
# local only: nginx is the way in
if ! grep -q "^\s*bind to = 127.0.0.1" "$NDCONF/netdata.conf" 2>/dev/null; then
  printf '\n[web]\n    bind to = 127.0.0.1\n' >> "$NDCONF/netdata.conf"
fi
# no Netdata Cloud: the data stays on this server and the dashboard needs no Netdata account
mkdir -p "$NDCONF/cloud.d"
printf '[global]\n    enabled = no\n' > "$NDCONF/cloud.d/cloud.conf"
mkdir -p "$NDCONF/go.d"
cat > "$NDCONF/go.d/nginx.conf" <<'EOF'
jobs:
  - name: companio
    url: http://127.0.0.1:8081/stub_status
    autodetection_retry: 30
EOF
cat > "$NDCONF/go.d/web_log.conf" <<EOF
jobs:
  - name: companio
    path: $LOG
    autodetection_retry: 30
    log_type: csv
    csv_config:
      format: '\$remote_addr - \$remote_user [\$time_local] "\$request" \$status \$body_bytes_sent "\$http_referer" "\$http_user_agent" \$request_time \$upstream_response_time \$host'
EOF
usermod -aG adm netdata 2>/dev/null || true   # read the nginx logs

echo "== GoAccess"
command -v goaccess >/dev/null || (apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq goaccess)
mkdir -p "$OPS/requests" /var/lib/goaccess-companio
touch "$LOG"
# note: in systemd unit files % is special (%h = home dir…), so every % in GoAccess's formats is written as %%
cat > /etc/systemd/system/goaccess-companio.service <<EOF
[Unit]
Description=GoAccess live request analytics for Companio (/ops/requests/)
After=network.target nginx.service

[Service]
ExecStart=/usr/bin/goaccess $LOG \\
  --log-format='%%h - %%^ [%%d:%%t %%^] "%%r" %%s %%b "%%R" "%%u" %%T %%^ %%v' --date-format=%%d/%%b/%%Y --time-format=%%T \\
  --output=$OPS/requests/index.html --real-time-html --addr=127.0.0.1 --port=7890 \\
  --ws-url=wss://$SITE:443/ops/requests/ws --origin=https://$SITE \\
  --persist --restore --db-path=/var/lib/goaccess-companio \\
  --anonymize-ip --html-report-title='Companio — live requests' --tz=Asia/Kolkata
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
# after nginx rotates its logs at night, start reading the new file (history is kept in --db-path)
cat > /etc/cron.d/goaccess-companio <<'EOF'
15 0 * * * root systemctl restart goaccess-companio
EOF
systemctl daemon-reload
systemctl enable --now goaccess-companio >/dev/null
systemctl restart goaccess-companio

echo "== /ops/ landing page"
cat > "$OPS/index.html" <<'EOF'
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Companio · ops</title>
<style>body{margin:0;font-family:system-ui,sans-serif;background:#FFF8EE;color:#141414;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:16px}
.c{max-width:460px;width:100%}h1{font-size:28px}a{display:block;margin:12px 0;padding:18px 20px;border:3px solid #141414;border-radius:20px;background:#fff;box-shadow:4px 4px 0 #141414;color:inherit;text-decoration:none}
b{font-size:18px}span{display:block;color:#555;font-size:14px;margin-top:4px}</style></head>
<body><div class="c"><h1>🛠️ Companio ops</h1>
<a href="/ops/netdata/"><b>📈 Server — Netdata</b><span>Live CPU, memory, disk, network, nginx requests/s and errors, PM2/Node processes.</span></a>
<a href="/ops/requests/"><b>🌐 Requests — GoAccess</b><span>Live visitors, pages and API endpoints, status codes, slow requests, bots.</span></a>
</div></body></html>
EOF

echo "== nginx: serve /ops/ behind the password"
mkdir -p /etc/nginx/snippets
cat > "$SNIPPET" <<EOF
# Companio ops dashboards (deploy/setup-monitoring.sh) — password-protected, never indexed
location /ops/ {
    auth_basic "Companio ops";
    auth_basic_user_file $HTPASSWD;
    add_header X-Robots-Tag "noindex, nofollow" always;
    add_header Cache-Control "no-store" always;
    alias $OPS/;
    index index.html;
}
location /ops/requests/ws {
    auth_basic "Companio ops";
    auth_basic_user_file $HTPASSWD;
    proxy_pass http://127.0.0.1:7890;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 1h;
}
location /ops/netdata/ {
    auth_basic "Companio ops";
    auth_basic_user_file $HTPASSWD;
    add_header X-Robots-Tag "noindex, nofollow" always;
    proxy_pass http://127.0.0.1:19999/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header Connection "keep-alive";
    proxy_pass_request_headers on;
}
EOF
WEB=/etc/nginx/sites-enabled/companio-web
# include it in the main site's HTTPS block (the one with the certificate for $SITE)
if ! grep -q "snippets/companio-ops" "$WEB"; then
  python3 - "$WEB" "$SITE" <<'PY'
import sys, re
p, site = sys.argv[1], sys.argv[2]
s = open(p).read()
m = re.search(r'server \{\n\s*server_name ' + re.escape(site) + r';', s)
assert m, 'main site server block not found'
i = s.index('\n', m.end())
s = s[:i] + '\n    include /etc/nginx/snippets/companio-ops*.conf;' + s[i:]
open(p, 'w').write(s)
PY
fi
nginx -t
systemctl reload nginx
# Netdata last, once nginx serves the status page and writes the new log (its collectors check them at start)
sleep 2
systemctl restart netdata

echo
echo "✅ Monitoring is up: https://$SITE/ops/"
cat /root/companio-ops-login.txt 2>/dev/null || echo "(password set earlier: /root/companio-ops-login.txt)"
