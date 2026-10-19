#!/usr/bin/env bash
# 每日数据库备份：SQLite 在线快照（VACUUM INTO），保留 14 天。
# 安装：crontab -e 加一行
#   10 3 * * * /opt/gearflow/infra/ops/backup.sh >> /var/log/gearflow-backup.log 2>&1
set -euo pipefail

cd /opt/gearflow
mkdir -p backups
stamp=$(date +%Y%m%d-%H%M%S)
compose="docker compose -f infra/docker-compose.prod.yml"

$compose exec -T server node -e "
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync('/data/gearflow.sqlite', { readOnly: true });
  db.prepare('VACUUM INTO ?').run('/data/backup-$stamp.sqlite');
  db.close();
"
docker cp "$($compose ps -q server):/data/backup-$stamp.sqlite" "backups/gearflow-$stamp.sqlite"
$compose exec -T server rm -f "/data/backup-$stamp.sqlite"

# 只保留最近 14 份
ls -1t backups/gearflow-*.sqlite 2>/dev/null | tail -n +15 | xargs -r rm -f

echo "$(date '+%F %T') backup ok: backups/gearflow-$stamp.sqlite ($(du -h "backups/gearflow-$stamp.sqlite" | cut -f1))"
