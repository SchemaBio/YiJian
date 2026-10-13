# UI Kit locale adapter

`@schema__ui-kit@0.1.0.patch` adds an optional `UiKitLocaleProvider` to the
existing UI Kit dependency. It translates library-owned empty states, search
prompts and accessibility labels during React rendering. Consumers without
the provider retain the library's original defaults. Options, selected values,
row IDs, callbacks and user content are unchanged.

YiJian supplies the four `uiKit` catalogs through its locale provider. The
patch is registered under `pnpm.patchedDependencies` for the project's pinned
pnpm 9.15.9 and covered by `UiKitLocale.test.tsx`. Docker copies patches before
installing dependencies. On a UI Kit upgrade, regenerate the patch against the
new version and run its SSR, interaction and language-state tests.
