#!/bin/sh
set -eu

API_URL="${YIJIAN_API_URL:-${NEXT_PUBLIC_API_URL:-/api}}"
CORE_API_PREFIX="${YIJIAN_CORE_API_PREFIX:-${NEXT_PUBLIC_CORE_API_PREFIX:-}}"
BACKEND_FLAVOR="${YIJIAN_BACKEND_FLAVOR:-${NEXT_PUBLIC_BACKEND_FLAVOR:-auto}}"
SUPPORT_EMAIL="${YIJIAN_SUPPORT_EMAIL:-${NEXT_PUBLIC_SUPPORT_EMAIL:-support@schemabio.com}}"
export API_URL CORE_API_PREFIX BACKEND_FLAVOR SUPPORT_EMAIL

node <<'NODE' > /app/public/runtime-config.js
const clean = (value) => String(value || '').replace(/[\r\n]/g, '');
const config = {
  API_URL: clean(process.env.API_URL || '/api'),
  CORE_API_PREFIX: clean(process.env.CORE_API_PREFIX || ''),
  BACKEND_FLAVOR: clean(process.env.BACKEND_FLAVOR || 'auto'),
  SUPPORT_EMAIL: clean(process.env.SUPPORT_EMAIL || 'support@schemabio.com'),
};
process.stdout.write(`window.__YIJIAN_CONFIG__ = ${JSON.stringify(config, null, 2)};\n`);
NODE

exec "$@"
