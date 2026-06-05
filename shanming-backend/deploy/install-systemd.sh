#!/bin/bash
set -euo pipefail

SERVICE_NAME=shanming-api
REPO_DIR="/opt/shanming-backend"
UNIT_SRC="${REPO_DIR}/deploy/shanming-api.service"
UNIT_DST="/etc/systemd/system/${SERVICE_NAME}.service"

if [[ ! -f "${UNIT_SRC}" ]]; then
  echo "找不到 ${UNIT_SRC}，请先在 ${REPO_DIR} 执行 git pull"
  exit 1
fi

pkill -f "node app.js" 2>/dev/null || true

cp "${UNIT_SRC}" "${UNIT_DST}"
systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"
systemctl restart "${SERVICE_NAME}"
systemctl status "${SERVICE_NAME}" --no-pager

echo ""
echo "安装完成。验证：curl http://127.0.0.1:8001/api/health"
echo "  systemctl status ${SERVICE_NAME}"
echo "  journalctl -u ${SERVICE_NAME} -f"
