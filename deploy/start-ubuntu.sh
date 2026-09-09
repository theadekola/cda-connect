#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node -e 'const [a,b]=process.versions.node.split(".").map(Number);if(a<22||(a===22&&b<13))throw Error("Node 22.13+ required")'
command -v pnpm >/dev/null
command -v npm >/dev/null
# Build as the deployment user, before requesting root access to install services.
(cd backend && pnpm install --frozen-lockfile && pnpm run build && pnpm test)
(cd frontend && npm ci && VITE_API_URL=/api/v1 VITE_SOCKET_URL= npm run build && npm test)
sudo bash deploy/install-native.sh "$PWD"
