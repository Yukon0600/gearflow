#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups
stamp=$(date +%Y%m%d-%H%M%S)
docker compose -f infra/docker-compose.yml exec -T server node -e "const {DatabaseSync}=require('node:sqlite'); const db=new DatabaseSync('/data/gearflow.sqlite',{readOnly:true}); db.prepare('VACUUM INTO ?').run('/data/backup-$stamp.sqlite'); db.close();"
docker cp "$(docker compose -f infra/docker-compose.yml ps -q server):/data/backup-$stamp.sqlite" "backups/gearflow-$stamp.sqlite"
echo "Created backups/gearflow-$stamp.sqlite"
