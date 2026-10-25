#!/usr/bin/env bash
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo 'Run with sudo.' >&2; exit 1; }
apt-get update
apt-get install -y clamav clamav-daemon
id cda-app >/dev/null 2>&1 || useradd --system --user-group --home-dir /var/lib/cda-connect --shell /usr/sbin/nologin cda-app
usermod -a -G clamav cda-app
python3 - <<'PY'
from pathlib import Path
path=Path('/etc/clamav/clamd.conf')
text=path.read_text()
values={'LocalSocket':'/run/clamav/clamd.ctl','LocalSocketGroup':'clamav','LocalSocketMode':'660','StreamMaxLength':'30M','MaxScanSize':'100M','MaxFileSize':'30M','AlertExceedsMax':'true'}
lines=[]
for line in text.splitlines():
    key=line.split()[0] if line.split() else ''
    if key in ('TCPSocket','TCPAddr'): continue
    if key in values: continue
    lines.append(line)
lines.extend(key+' '+value for key,value in values.items())
path.write_text('\n'.join(lines)+'\n')
PY
# The daemon needs an initial signature database before it can accept scans.
if ! find /var/lib/clamav -maxdepth 1 \( -name 'daily.cvd' -o -name 'daily.cld' \) -print -quit | grep -q .; then
  systemctl stop clamav-freshclam.service
  freshclam
fi
systemctl enable --now clamav-freshclam.service
systemctl enable clamav-daemon.service
systemctl restart clamav-daemon.service
for attempt in $(seq 1 30); do
  if [ -S /run/clamav/clamd.ctl ]; then
    runuser -u cda-app -- test -w /run/clamav/clamd.ctl
    echo 'Local scanner installed. Set CLAMAV_SOCKET=/run/clamav/clamd.ctl in /etc/cda-connect/backend.env, then deploy.'
    exit 0
  fi
  sleep 1
done
echo 'Scanner did not become ready. Check: journalctl -u clamav-daemon' >&2
exit 1
