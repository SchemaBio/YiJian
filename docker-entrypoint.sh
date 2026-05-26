#!/bin/sh
set -eu

API_URL="${YIJIAN_API_URL:-${NEXT_PUBLIC_API_URL:-/api}}"
ESCAPED_API_URL=$(printf '%s' "$API_URL" | sed 's/\\/\\\\/g; s/"/\\"/g')

cat > /app/public/runtime-config.js <<EOF
window.__YIJIAN_CONFIG__ = {
  API_URL: "${ESCAPED_API_URL}"
};
EOF

exec "$@"
