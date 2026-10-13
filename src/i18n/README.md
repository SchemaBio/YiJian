# Interface localization

The four JSON catalogs share functional namespaces and semantic keys. Use
`useText()` in components and pass the translator or its `locale` explicitly
to display helpers. `next-intl` formats complete ICU messages; pass counts as
numbers when a message has plural rules. `sources.json` indexes legacy static
display labels. Add new UI messages using semantic keys directly.

Locale resolution never uses browser language. The server resolves the cookie
and deployment default; `LocaleProvider` initializes with that result. Personal
settings persist the preference before updating state and refreshing server
rendering. Do not key providers or forms by locale.

Only authored labels are localized. Keep enum values, user names, clinical
content, report bodies, AI output, raw downloads and log messages verbatim.
For dynamic selectors, translate static choices before combining them with
entity names; never run an entity name through the legacy label index.

Frontend errors use `LocalizedError` with an explicit message key. Unknown
backend errors use `errorText` and retain their original message. Worker
messages carry an explicit `errorKey` when the worker authored the error.

Privacy documents live in `privacy.json`, share version 2026-10-12, and expose
the same section IDs and paragraph structure. Query overrides affect only
the policy document.

Run `pnpm test`, `pnpm typecheck`, `pnpm build`, and `node scripts/check-i18n.cjs`.
Catalog tests check keys, ICU parameters, plural arguments and accidental
Chinese placeholders in English and Spanish. The source scanner checks JSX
display literals; review dynamic label sources and business data boundaries
when adding a page.

Shared UI Kit defaults are localized by the pnpm patch in `patches/`. Its
`UiKitLocaleProvider` receives the same translator as the application, so empty
tables, selector search prompts and accessibility labels also match SSR.
Keep the patch copied before Docker's frozen-lockfile install. Revalidate the
patch whenever upgrading UI Kit.

PageAgent 1.8.2 supports two native panel languages. The isolated
`page-agent-locale.ts` bridge supplies our four catalogs through its public
I18n API and refreshes its public panel controls without resetting execution.
It leaves original inputs, history, tool logs and generated content intact.
Revalidate its key map and control selectors when upgrading PageAgent.

Versioned task stages and known report error codes use explicit code mappings
in `task-labels.ts`. Unknown codes and custom workflow labels stay original.
