#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# scp preserves Windows line endings; Git attributes do not apply to uploaded files.
# Repair deployment scripts before spending time on builds or invoking sudo.
python3 - <<'PY'
from pathlib import Path
for script in sorted(Path('deploy').glob('*.sh')):
    original = script.read_bytes()
    normalized = original.removeprefix(b'\xef\xbb\xbf').replace(b'\r\n', b'\n')
    if normalized != original:
        script.write_bytes(normalized)
        print(f'Normalized Linux line endings: {script}')
PY
for script in deploy/*.sh; do
  bash -n "$script"
done
node -e 'const [a,b]=process.versions.node.split(".").map(Number);if(a<22||(a===22&&b<13))throw Error("Node 22.13+ required")'
command -v pnpm >/dev/null
command -v npm >/dev/null
# Build as the deployment user, before requesting root access to install services.
(cd backend && pnpm install --frozen-lockfile && pnpm run build && pnpm test)
(cd frontend && npm ci && VITE_API_URL=/api/v1 VITE_SOCKET_URL= VITE_PUBLIC_ORIGIN=https://cdaconnect.org npm run build && npm test)
python3 -c 'import sys; assert sys.version_info >= (3, 11), "Python 3.11+ is required for the AI service"'
python3 -m venv ai_service/.venv
ai_service/.venv/bin/python -m pip install -r ai_service/requirements.txt
ai_service/.venv/bin/python -m unittest discover -s ai_service -p 'test_*.py'
sudo bash deploy/install-native.sh "$PWD"
