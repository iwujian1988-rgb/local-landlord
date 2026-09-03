#!/usr/bin/env bash
set -euo pipefail

FILE="zbQbvEaGmB.txt"
SRC="/tmp/${FILE}"
CFG="/etc/nginx/sites-enabled/local-landlord"

test -s "${SRC}"

# Return the verification value directly from Nginx. This avoids relying on
# a container filesystem or an upload directory that may not be mounted.
RULE="    location = /${FILE} { default_type text/plain; return 200 '7ffedf54c9b468cd427806d42af02bbd'; }"
if sudo grep -Fq "location = /${FILE}" "${CFG}"; then
  sudo sed -i "\|location = /${FILE}|c\\${RULE}" "${CFG}"
else
  sudo sed -i "/^[[:space:]]*location \/ {/i\\${RULE}" "${CFG}"
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
