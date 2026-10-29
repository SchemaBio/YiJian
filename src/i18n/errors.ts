import { chineseText, type TextTranslator, type TextValues } from './text';

/** An error authored by the frontend, with an explicit dictionary identity. */
export class LocalizedError extends Error {
  constructor(public readonly messageKey: string, public readonly values?: TextValues, originalMessage?: string) {
    super(originalMessage ?? chineseText(messageKey, values));
    this.name = 'LocalizedError';
  }
}

// Translate only known API messages; arbitrary server/user text stays intact.
const backendMessages: Record<string, string> = {
  'invalid parent affected status':'sampleParents.invalidStatus',
  'trio samples must belong to the same sample scope':'sampleParents.scopeMismatch',
  'parent internal ID exceeds 100 characters':'sampleParents.idTooLong',
  'father and mother must be different samples':'sampleParents.badRelation',
  'sample parent relationship contains a cycle':'sampleParents.badRelation',
  'download_ip_mismatch': 'downloadProtection.ipError',
  'download_ip_unavailable': 'downloadProtection.ipUnavailable',
  'download_traffic_threshold': 'downloadProtection.thresholdError',
  'download_usage_unavailable': 'downloadProtection.usageUnavailable',
  'download_rebind_wait': 'downloadProtection.state.rebind_wait',
  'download_issuance_paused': 'downloadProtection.unavailable',
  'download_grant_unavailable': 'downloadProtection.unavailable',
  'download_grant_not_found': 'downloadProtection.unavailable',
  'download_network_pending': 'downloadProtection.pending',
  'download_ip_unchanged': 'downloadProtection.unchanged',
  'download_legacy_grant': 'downloadProtection.legacy',
  'trio requires three different samples':'sampleParents.badRelation',
  'trio members must use six different FASTQ assets':'sampleParents.badRelation',
  'registration unavailable': 'registration.unavailable',
  'registration challenge failed': 'registration.challengeFailed',
  'registration rate limit exceeded': 'registration.retryLater',
  'organization storage quota exceeded': 'uploadCapacity.insufficient',
  'password is too common': 'backendErrors.passwordTooCommon',
  'password must be at least 8 characters': 'backendErrors.passwordTooShort',
  'password must be at least 12 characters': 'backendErrors.adminPasswordTooShort',
  'password must include at least 3 of: lowercase, uppercase, digit, symbol': 'backendErrors.passwordComplexity',
  'invalid email or password': 'backendErrors.invalidCredentials',
  'invalid old password': 'backendErrors.invalidOldPassword',
  'email already exists': 'backendErrors.emailExists',
  'invalid system role': 'backendErrors.invalidRole',
  'cannot delete your own account': 'backendErrors.cannotDeleteSelf',
  'cannot deactivate your own account': 'backendErrors.cannotDeactivateSelf',
  'cannot remove your own super-admin role': 'backendErrors.cannotDemoteSelf',
};

/** Known API errors follow the active locale; unknown messages remain verbatim. */
export function errorText(error: unknown, t: TextTranslator): string {
  if (error && typeof error === 'object' && 'data' in error && (error as { data?: { code?: string } }).data?.code === 'permission_denied') return t('permissions.denied');
  if (error instanceof LocalizedError) return t(error.messageKey, error.values);
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : undefined;
  if (message === undefined) return t('未知错误');
  const parentState=message.match(/^(proband|father|mother) sample (missing|ambiguous|unavailable)$/);
  if(parentState)return t('sampleParents.'+parentState[1])+': '+t('sampleParents.'+parentState[2]);
  const trioInput=message.match(/^(proband|father|mother) (sample (?:is missing, unavailable or ambiguous|is unavailable|not found|has expired)|requires complete R1\/R2 data|FASTQ asset (?:is unavailable|has invalid read type, size or expiry))$/);
  if(trioInput)return t('sampleParents.inputUnavailable',{p0:t('sampleParents.'+trioInput[1])});
  const key = Object.prototype.hasOwnProperty.call(backendMessages, message) ? backendMessages[message] : undefined;
  return key ? t(key) : message;
}
