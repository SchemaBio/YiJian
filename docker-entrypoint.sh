#!/bin/sh
set -eu

if [ "${NODE_ENV:-}" = "production" ] && [ "${NEXT_PUBLIC_DEV_MOCK_AUTH:-}" = "true" ]; then
  echo "NEXT_PUBLIC_DEV_MOCK_AUTH=true is not allowed in production" >&2
  exit 1
fi

API_URL="${YIJIAN_API_URL:-${NEXT_PUBLIC_API_URL:-/api}}"
# Prefer the canonical variable, but keep the deployed legacy flavor variable
# authoritative when it is explicitly present. Older compose files set a
# Dockerfile default for YIJIAN_BACKEND and override only BACKEND_FLAVOR.
BACKEND="${YIJIAN_BACKEND_FLAVOR:-${YIJIAN_BACKEND:-octopus}}"
SUPPORT_EMAIL="${YIJIAN_SUPPORT_EMAIL:-${NEXT_PUBLIC_SUPPORT_EMAIL:-support@schemabio.com}}"
PASSWORD_RESET_ENABLED="${YIJIAN_PASSWORD_RESET_ENABLED:-${NEXT_PUBLIC_PASSWORD_RESET_ENABLED:-false}}"
case "$BACKEND" in
  octopus|squid) ;;
  *)
    echo "YIJIAN_BACKEND must be octopus or squid" >&2
    exit 1
    ;;
esac
export API_URL BACKEND SUPPORT_EMAIL PASSWORD_RESET_ENABLED

node <<'NODE' > /app/public/runtime-config.js
const clean = (value) => String(value || '').replace(/[\r\n]/g, '');
const config = {
  API_URL: clean(process.env.API_URL || '/api'),
  BACKEND: clean(process.env.BACKEND || 'octopus'),
  SUPPORT_EMAIL: clean(process.env.SUPPORT_EMAIL || 'support@schemabio.com'),
  UPLOAD_ORIGINS: clean(process.env.YIJIAN_UPLOAD_ORIGINS || ''),
  PASSWORD_RESET_ENABLED: clean(process.env.PASSWORD_RESET_ENABLED || 'false'),
};
process.stdout.write(`window.__YIJIAN_CONFIG__ = ${JSON.stringify(config, null, 2)};\n`);
NODE

exec "$@"
