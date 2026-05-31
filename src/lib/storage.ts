/**
 * Unified localStorage key constants.
 * Cookie-backed auth stores only non-sensitive UI session state here.
 */

const PREFIX = 'schema';

export const STORAGE_KEYS = {
  /** Legacy pre-cookie token cache key, removed on auth/session changes. */
  LEGACY_AUTH_TOKENS: `${PREFIX}_auth_tokens`,
  /** Current user profile */
  USER: `${PREFIX}_auth_user`,
  /** User's organizations */
  ORGANIZATIONS: `${PREFIX}_auth_orgs`,
  /** Currently active organization */
  CURRENT_ORG: `${PREFIX}_auth_current_org`,
  /** AI configuration (encrypted) */
  AI_CONFIG: `${PREFIX}_ai_config`,
  /** AI chat history */
  AI_HISTORY: `${PREFIX}_ai_history`,
  /** Sidebar collapsed state */
  SIDEBAR_STATE: `${PREFIX}_sidebar_state`,
  /** UI theme */
  THEME: `${PREFIX}_ui_theme`,
} as const;
