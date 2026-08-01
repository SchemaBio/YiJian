#!/bin/sh
set -eu

API_URL="${YIJIAN_API_URL:-${NEXT_PUBLIC_API_URL:-/api}}"
BACKEND="${YIJIAN_BACKEND:-octopus}"
SUPPORT_EMAIL="${YIJIAN_SUPPORT_EMAIL:-${NEXT_PUBLIC_SUPPORT_EMAIL:-support@schemabio.com}}"
case "$BACKEND" in
  octopus|squid) ;;
  *)
    echo "YIJIAN_BACKEND must be octopus or squid" >&2
    exit 1
    ;;
esac
export API_URL BACKEND SUPPORT_EMAIL

node <<'NODE' > /app/public/runtime-config.js
const clean = (value) => String(value || '').replace(/[\r\n]/g, '');
const config = {
  API_URL: clean(process.env.API_URL || '/api'),
  BACKEND: clean(process.env.BACKEND || 'octopus'),
  SUPPORT_EMAIL: clean(process.env.SUPPORT_EMAIL || 'support@schemabio.com'),
};
process.stdout.write(`window.__YIJIAN_CONFIG__ = ${JSON.stringify(config, null, 2)};\n`);
NODE

exec "$@"
