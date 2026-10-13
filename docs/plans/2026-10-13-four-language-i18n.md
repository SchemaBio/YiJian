# YiJian four-language i18n

The interface supports `zh-CN`, `zh-Hant`, `en`, and `es-419`, with Simplified
Chinese as the default. The language control is exclusively under personal
settings and applies after Save. No backend account preference or migration is
required.

## Language lifecycle

The root server layout resolves the `yijian-locale` cookie, then
`YIJIAN_DEFAULT_LOCALE` (or `NEXT_PUBLIC_DEFAULT_LOCALE` in local development),
then `zh-CN`. The same locale initializes the client provider. Saving a preference
writes a one-year, path-wide, SameSite=Lax cookie (Secure on HTTPS), checks that
the browser accepted it, updates the provider, and refreshes server rendering.
Providers are not keyed by locale: form state and running work remain mounted.

## Translation boundaries

The `next-intl` message catalogs share functional namespaces. Interpolation is
handled as a complete message, not by replacing substrings. Display descriptors
are localized without changing their values, IDs, accessors or renderer functions.
Runtime business content, reports, AI output and raw downloads remain original.
Traditional Chinese uses neutral terminology; Spanish uses Latin American
terminology. Privacy deep links may override document language without changing
the browser preference.

## Deployment

The Docker entrypoint validates supported language codes before creating the
runtime configuration. Octopus production and Squid production/local Compose
forward the variable. Runtime configuration responses are not cached.

## Acceptance

Validate locale precedence, cookie failure, explicit Save, state preservation,
catalog parity and ICU formatting, unchanged wire values, multilingual policy
links, Docker defaults/invalid values, and long-label layouts. Run the full test
suite, TypeScript validation and production build before delivery.
