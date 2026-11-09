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
SUPPORT_EMAIL="${YIJIAN_SUPPORT_EMAIL:-${NEXT_PUBLIC_SUPPORT_EMAIL:-}}"
PASSWORD_RESET_ENABLED="${YIJIAN_PASSWORD_RESET_ENABLED:-${NEXT_PUBLIC_PASSWORD_RESET_ENABLED:-false}}"
DEFAULT_LOCALE="${YIJIAN_DEFAULT_LOCALE-${NEXT_PUBLIC_DEFAULT_LOCALE-zh-CN}}"
case "$DEFAULT_LOCALE" in
  zh-CN|zh-Hant|en|es-419) ;;
  *)
    echo "YIJIAN_DEFAULT_LOCALE must be zh-CN, zh-Hant, en, or es-419" >&2
    exit 1
    ;;
esac
export DEFAULT_LOCALE
case "$BACKEND" in
  octopus|squid) ;;
  *)
    echo "YIJIAN_BACKEND must be octopus or squid" >&2
    exit 1
    ;;
esac
export API_URL BACKEND SUPPORT_EMAIL PASSWORD_RESET_ENABLED

if [ "$BACKEND" = "squid" ] && [ "${YIJIAN_MANAGED_STORAGE:-}" = "true" ]; then
  YIJIAN_UPLOAD_ORIGINS="$(node <<'NODE'
(async () => {
  const base = process.env.YIJIAN_SERVER_API_URL.replace(/\/$/, '');
  const response = await fetch(base + '/v1/config/upload-origin', { signal: AbortSignal.timeout(5000), redirect: 'error' });
  if (!response.ok) throw new Error();
  const { origin } = await response.json();
  if (origin && !/^https:\/\/[a-z0-9-]+\.cos\.[a-z0-9-]+\.myqcloud\.com$/.test(origin)) throw new Error();
  process.stdout.write(origin || '');
})().catch(() => {
  process.stderr.write('Unable to load the managed upload origin from Squid\n');
  process.exitCode = 1;
});
NODE
)"
  export YIJIAN_UPLOAD_ORIGINS
fi

node <<'NODE' > /app/public/runtime-config.js
const clean = (value) => String(value || '').replace(/[\r\n]/g, '');
const config = {
  API_URL: clean(process.env.API_URL || '/api'),
  BACKEND: clean(process.env.BACKEND || 'octopus'),
  SUPPORT_EMAIL: clean(process.env.SUPPORT_EMAIL || ''),
  UPLOAD_ORIGINS: clean(process.env.YIJIAN_UPLOAD_ORIGINS || ''),
  PASSWORD_RESET_ENABLED: clean(process.env.PASSWORD_RESET_ENABLED || 'false'),
  RECHARGE_ANALYSIS_MINUTES: {
    singleExome: clean(process.env.YIJIAN_RECHARGE_SINGLE_EXOME_MINUTES),
    familyExome: clean(process.env.YIJIAN_RECHARGE_FAMILY_EXOME_MINUTES),
    baseline: clean(process.env.YIJIAN_RECHARGE_BASELINE_MINUTES),
  },
  DEFAULT_LOCALE: process.env.DEFAULT_LOCALE,
};
process.stdout.write(`window.__YIJIAN_CONFIG__ = ${JSON.stringify(config, null, 2)};\n`);
NODE

exec "$@"
