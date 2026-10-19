#!/usr/bin/env bash
# 健康巡检：每 5 分钟跑一次，连续 3 次失败就重启容器（自愈）。
# 安装：crontab -e 加一行
#   */5 * * * * /opt/gearflow/infra/ops/healthcheck.sh >/dev/null 2>&1
set -u

cd /opt/gearflow || exit 1
STATE=/var/tmp/gearflow-health-fails
LOG=/var/log/gearflow-health.log

if curl -fsS -m 5 http://127.0.0.1/api/health >/dev/null 2>&1; then
  rm -f "$STATE"
  exit 0
fi

fails=$(cat "$STATE" 2>/dev/null || echo 0)
fails=$((fails + 1))
echo "$fails" > "$STATE"
echo "$(date '+%F %T') health check failed (${fails}/3)" >> "$LOG"

if [ "$fails" -ge 3 ]; then
  echo "$(date '+%F %T') restarting server/web" >> "$LOG"
  docker compose -f infra/docker-compose.prod.yml restart server web >> "$LOG" 2>&1
  echo 0 > "$STATE"
fi
