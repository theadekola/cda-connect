#!/usr/bin/env bash
set -euo pipefail
umask 077
[ "$(id -u)" = 0 ] || { echo 'Run through start-ubuntu.sh or sudo.' >&2; exit 1; }
source_dir="$(realpath "${1:?Provide the built source release directory}")"
[ -f "$source_dir/backend/dist/server.js" ] && [ -f "$source_dir/frontend/dist/index.html" ]
for binary in /usr/bin/node /usr/bin/redis-server /usr/sbin/nginx /usr/bin/rsync; do
  [ -x "$binary" ] || { echo "Missing prerequisite: $binary" >&2; exit 1; }
done
/usr/bin/node -e 'const [a,b]=process.versions.node.split(".").map(Number);if(a<22||(a===22&&b<13))throw Error("System Node 22.13+ required")'
id cda-app >/dev/null 2>&1 || useradd --system --user-group --home-dir /var/lib/cda-connect --shell /usr/sbin/nologin cda-app
install -d -m 755 /etc/cda-connect /opt/cda-connect /opt/cda-connect/releases
install -d -o cda-app -g cda-app -m 700 /var/lib/cda-connect
install -d -o cda-app -g cda-app -m 700 /var/lib/cda-connect/uploads /var/lib/cda-connect/private-uploads
install -d -o redis -g redis -m 700 /var/lib/cda-connect-redis
# Generate secrets only for a new installation. Never rotate existing credentials silently.
python3 - "$source_dir" <<'PY'
import pathlib,secrets,sys
root=pathlib.Path('/etc/cda-connect')
env=root/'backend.env'; redis=root/'redis.conf'
if env.exists() != redis.exists():
    raise SystemExit('Both backend.env and redis.conf must exist together. Review the existing configuration; nothing was overwritten.')
if not env.exists():
    password=secrets.token_hex(32)
    text=(pathlib.Path(sys.argv[1])/'backend/.env.production.example').read_text()
    values={'HOST':'127.0.0.1','PORT':'4000','PUBLIC_BASE_URL':'https://cdaconnect.org','CORS_ORIGIN':'https://cdaconnect.org','REDIS_URL':f'redis://:{password}@127.0.0.1:6380','JWT_ACCESS_SECRET':secrets.token_hex(32),'JWT_REFRESH_SECRET':secrets.token_hex(32)}
    lines=[]
    for line in text.splitlines():
        key=line.split('=',1)[0]
        if key in values: line=key+'='+values.pop(key)
        lines.append(line)
    lines.extend(k+'='+v for k,v in values.items())
    with env.open('x') as f: f.write('\n'.join(lines)+'\n')
    env.chmod(0o600)
    with redis.open('x') as f:
        f.write(f'bind 127.0.0.1\nport 6380\nprotected-mode yes\ndaemonize no\nsupervised no\nlogfile ""\ndir /var/lib/cda-connect-redis\nappendonly yes\nappendfsync everysec\nmaxmemory-policy noeviction\nrequirepass {password}\n')
    redis.chmod(0o640)
PY
chown root:root /etc/cda-connect/backend.env
chmod 600 /etc/cda-connect/backend.env
chown root:redis /etc/cda-connect/redis.conf
chmod 640 /etc/cda-connect/redis.conf
# Validate configuration without printing its credentials. No service switches on failure.
/usr/bin/node --input-type=module - "$source_dir" <<'JS'
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const base=process.argv[2];
try {
  const dotenv=(await import(pathToFileURL(base+'/backend/node_modules/dotenv/lib/main.js'))).default;
  Object.assign(process.env,dotenv.parse(fs.readFileSync('/etc/cda-connect/backend.env')));
  if(process.env.HOST!=='127.0.0.1'||process.env.PORT!=='4000'||!process.env.REDIS_URL?.endsWith('@127.0.0.1:6380'))throw Error('Native network settings do not match');
  await import(pathToFileURL(base+'/backend/dist/config/env.js'));
} catch {
  console.error('Configure /etc/cda-connect/backend.env with the real SQL password (8+ characters) and provider settings, then rerun. Native HOST=127.0.0.1, PORT=4000 and Redis port=6380 are required.');
  process.exit(2);
}
JS
release_id="$(date -u +%Y%m%dT%H%M%S)-$$"
release="/opt/cda-connect/releases/$release_id"
install -d -m 755 "$release/backend" "$release/frontend"
rsync -a "$source_dir/backend/dist" "$source_dir/backend/node_modules" "$source_dir/backend/package.json" "$source_dir/backend/data" "$release/backend/"
# Verify packaged location data before activating this release.
/usr/bin/node --input-type=module - "$release" <<'JS'
import {pathToFileURL} from 'node:url';
const {locations}=await import(pathToFileURL(process.argv[2]+'/backend/dist/services/communityLocations.js'));
const countries=await locations();
if(Object.keys(countries).length<200 || !countries.NG)throw Error('Incomplete community location data');
JS
rsync -a "$source_dir/frontend/dist" "$release/frontend/"
chown -R root:root "$release"
chmod -R u=rwX,go=rX "$release"
for unit in cda-api.service cda-worker.service cda-redis.service; do
  install -m 644 "$source_dir/deploy/$unit" "/etc/systemd/system/$unit"
done
# Save this application's previous Nginx config; do not modify other sites.
nginx_file=/etc/nginx/sites-available/cda-connect
if [ -e /etc/nginx/sites-enabled/cda-connect ] && [ "$(readlink -f /etc/nginx/sites-enabled/cda-connect)" != "$nginx_file" ]; then
  echo 'Existing cda-connect Nginx entry points elsewhere. Review it before installation.' >&2
  exit 1
fi
had_nginx=false
if [ -e "$nginx_file" ]; then
  cp -p "$nginx_file" "$release/nginx.previous.conf"
  had_nginx=true
fi
install -m 644 "$source_dir/deploy/nginx-cda-connect.conf" "$nginx_file"
if [ ! -e /etc/nginx/sites-enabled/cda-connect ]; then
  ln -s /etc/nginx/sites-available/cda-connect /etc/nginx/sites-enabled/cda-connect
fi
if ! nginx -t; then
  if $had_nginx; then cp -p "$release/nginx.previous.conf" "$nginx_file"; else rm /etc/nginx/sites-enabled/cda-connect; fi
  echo 'Nginx validation failed. Application release was not switched.' >&2
  exit 1
fi
previous="$(readlink -f /opt/cda-connect/current || true)"
ln -s "$release" /opt/cda-connect/current.next
mv -Tf /opt/cda-connect/current.next /opt/cda-connect/current
systemctl daemon-reload
systemctl enable --now cda-redis.service
systemctl enable cda-api.service cda-worker.service
systemctl restart cda-api.service
healthy=false
for attempt in $(seq 1 45); do
  if curl --silent --fail http://127.0.0.1:4000/health >/dev/null; then healthy=true; break; fi
  sleep 2
done
if ! $healthy; then
  if [ -n "$previous" ] && [ -d "$previous" ]; then
    ln -s "$previous" /opt/cda-connect/current.rollback
    mv -Tf /opt/cda-connect/current.rollback /opt/cda-connect/current
    systemctl restart cda-api.service cda-worker.service
  else systemctl stop cda-api.service; fi
  echo 'API health check failed. Inspect journalctl -u cda-api. Previous code restored when available.' >&2
  exit 1
fi
systemctl restart cda-worker.service
systemctl enable --now nginx
systemctl reload nginx
curl --fail http://127.0.0.1:8080/health
systemctl --no-pager --full status cda-api cda-worker cda-redis
echo "Installed native release $release. Cloudflare Tunnel origin: http://127.0.0.1:8080"
