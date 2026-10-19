#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
test -f infra/.env || { echo 'Missing infra/.env; copy infra/.env.example and set a strong password.' >&2; exit 1; }
npm run build --workspace=@gearflow/server
docker compose -f infra/docker-compose.yml up -d --build
docker compose -f infra/docker-compose.yml ps
curl --fail --retry 10 --retry-delay 2 http://127.0.0.1/api/health
echo
echo 'GearFlow is running. Open http://SERVER_IP/'
