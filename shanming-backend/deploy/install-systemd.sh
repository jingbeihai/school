#!/bin/bash
set -euo pipefail

SERVICE_NAME=shanming-api
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
UNIT_DST="/etc/systemd/system/${SERVICE_NAME}.service"
NODE_BIN="$(command -v node)"

if [[ ! -f "${REPO_DIR}/app.js" ]]; then
  echo "找不到 ${REPO_DIR}/app.js，请在 shanming-backend 目录下运行此脚本"
  exit 1
fi

if [[ -z "${NODE_BIN}" ]]; then
  echo "找不到 node，请先安装 Node.js"
  exit 1
fi

pkill -f "${REPO_DIR}/app.js" 2>/dev/null || pkill -f "node app.js" 2>/dev/null || true

cat > "${UNIT_DST}" << EOF
[Unit]
Description=Shanming Mini-Program Backend (Node.js)
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=${REPO_DIR}
Environment=PATH=/usr/local/bin:/usr/bin:/bin
EnvironmentFile=-${REPO_DIR}/.env
ExecStart=${NODE_BIN} app.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"
systemctl restart "${SERVICE_NAME}"
systemctl status "${SERVICE_NAME}" --no-pager

echo ""
echo "安装完成。目录: ${REPO_DIR}"
echo "验证: curl http://127.0.0.1:8001/api/health"
echo "  systemctl status ${SERVICE_NAME}"
echo "  journalctl -u ${SERVICE_NAME} -f"
