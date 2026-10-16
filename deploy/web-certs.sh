#!/usr/bin/env bash
# Waits (up to 3 days) for each domain to point at this server, then gets its HTTPS certificate. Run by setup-web.sh.
LOG=/var/log/companio-certs.log
ME=$(curl -s -m 10 ifconfig.me)
pending=("$@")
for _ in $(seq 1 4320); do
  next=()
  for d in "${pending[@]}"; do
    zone=$(echo "$d" | awk -F. '{print (NF>2 && $(NF-1)!="co") ? $(NF-1)"."$NF : (NF>3 ? $(NF-2)"."$(NF-1)"."$NF : $0)}')
    ns=$(dig +short NS "$zone" | head -1)
    ip=$(dig +short A "$d" ${ns:+@$ns} | tail -1)
    if [[ "$ip" == "$ME" ]]; then
      if certbot --nginx --non-interactive --redirect --keep-until-expiring -d "$d" >>"$LOG" 2>&1; then
        echo "$(date '+%F %T') ✅ HTTPS ready for $d" >>"$LOG"
      else
        echo "$(date '+%F %T') ❌ certificate failed for $d (will retry)" >>"$LOG"; next+=("$d")
      fi
    else
      next+=("$d")
    fi
  done
  pending=("${next[@]}")
  [[ ${#pending[@]} -eq 0 ]] && { echo "$(date '+%F %T') all certificates done" >>"$LOG"; exit 0; }
  sleep 60
done
echo "$(date '+%F %T') gave up waiting for: ${pending[*]}" >>"$LOG"
