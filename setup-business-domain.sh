#!/usr/bin/env bash
set -euo pipefail

FILE="zbQbvEaGmB.txt"
SRC="/tmp/${FILE}"
DEST_DIR="/var/www/api-verification"
DEST="${DEST_DIR}/${FILE}"
CFG="/etc/nginx/sites-enabled/local-landlord"

test -s "${SRC}"
sudo install -d -m 755 "${DEST_DIR}"
sudo install -m 644 "${SRC}" "${DEST}"

# The exact location is added only once. It is served directly by Nginx,
# before the API reverse proxy, so WeChat can verify the business domain.
if ! sudo grep -Fq "location = /${FILE}" "${CFG}"; then
  sudo sed -i "/^[[:space:]]*location \/ {/i\\    location = /${FILE} { alias ${DEST}; }" "${CFG}"
fi

sudo nginx -t
sudo systemctl reload nginx

RESULT="$(curl -fsS "https://api.wulianzhijia.cn/${FILE}")"
if [ "${RESULT}" != "7ffedf54c9b468cd427806d42af02bbd" ]; then
  echo "校验文件内容不匹配：${RESULT}"
  exit 1
fi

rm -f "${SRC}" "/tmp/setup-business-domain.sh"
echo "验证成功：${RESULT}"
