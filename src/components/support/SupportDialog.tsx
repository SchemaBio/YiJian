'use client';
import { useText } from '@/i18n/useText';


import { ActionButton as Button } from '@/components/shared/ActionButton';

import { HoverHint } from '@/components/shared/HoverHint';


import * as React from 'react';

import { LifeBuoy, Mail, UserRoundX } from 'lucide-react';
import { AppModal, ModalSectionHeading } from '@/components/shared';
import { useAuth } from '@/components/providers/AuthProvider';
import { getRuntimeSupportEmail } from '@/lib/runtime-config';

interface SupportDialogProps {
  trigger?: 'icon' | 'button';
  context?: 'general' | 'billing' | 'account';
}

export function SupportDialog({ trigger = 'icon', context = 'general' }: SupportDialogProps) {
  const t = useText();
  const { user, currentOrg } = useAuth();
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [copyError, setCopyError] = React.useState('');
  const supportEmail = getRuntimeSupportEmail();

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(supportEmail);
      setCopied(true);
      setCopyError('');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError(t("common.unableToCopySelectTheEmailManually1da5b3"));
    }
  };

  const openDialog = () => {
    setCopied(false);
    setCopyError('');
    setOpen(true);
  };

  return <>
    {trigger === 'icon' ? (
      <HoverHint content={t("common.helpAndSupport66b5e6")}><button
        type="button"
        onClick={openDialog}
        className="p-2 rounded-md text-fg-muted hover:text-fg-default hover:bg-[var(--yj-panel-muted)] transition-colors"
        aria-label={t("common.helpAndSupport66b5e6")}

      >
        <LifeBuoy className="h-5 w-5" />
      </button></HoverHint>
    ) : (
      <Button
        variant="secondary"
        leftIcon={context === 'account' ? <UserRoundX className="h-4 w-4" /> : <LifeBuoy className="h-4 w-4" />}
        onClick={openDialog}
      >
        {context === 'account' ? t("common.contactSupportToDeleteAccount7cb0dc") : t("common.viewContactInformation40c878")}
      </Button>
    )}

    <AppModal
      open={open}
      onOpenChange={setOpen}
      title={t("common.helpAndSupport66b5e6")}
      size="medium"
      footer={<><Button action="close" variant="secondary" onClick={() => setOpen(false)}>{t("tasks.close6c14bd")}</Button><Button action={copied ? 'copied' : 'copy'} variant="primary"  onClick={() => void copyEmail()}>{copied ? t("common.emailCopied43ae26") : t("common.copyEmaile442de")}</Button></>}
    >
      <div className="space-y-5">
        {context === 'account' && <ModalSectionHeading icon={<UserRoundX className="h-4 w-4" />} title={t("common.requestAccountDeletion0a1735")} />}
        <p className="text-sm leading-6 text-fg-muted">{t("common.contactOurSupportEmailForCreditsBilling607251")}</p>

        <div className="rounded-md border border-warning-muted bg-warning-subtle px-4 py-3">
          <div className="flex items-start gap-3">
            <UserRoundX className="mt-0.5 h-4 w-4 shrink-0 text-warning-fg" />
            <div>
              <p className="text-sm font-medium text-warning-fg">{t("common.accountDeletionAndBalanceRefunds36f625")}</p>
              <p className="mt-1 text-xs leading-5 text-fg-muted">{t("common.accountDeletionMayInvolveUnusedCreditRefunds52e137")}</p>
            </div>
          </div>
        </div>

        <div className="rounded-md border border-accent-muted bg-accent-subtle px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-medium text-fg-muted"><Mail className="h-4 w-4" />{t("common.supportEmaile05010")}</div>
          <button type="button" onClick={() => void copyEmail()} className="mt-1 break-all text-left text-base font-semibold text-accent-fg hover:underline">{supportEmail}</button>
          {copyError && <p role="alert" className="mt-1 text-xs text-danger-fg">{copyError}</p>}
        </div>

        <div>
          <p className="text-sm font-medium text-fg-default">{t("common.includeWhenContactingSupportfee073")}</p>
          <ul className="mt-2 space-y-1.5 break-words text-xs leading-5 text-fg-muted">
            <li>{t("common.currentOrganization463d71")}{currentOrg?.name ?? '-'}（{currentOrg?.id ?? '-'}）</li>
            <li>{t("common.currentAccountb32033")}{user?.email ?? '-'}</li>
            <li>{t("common.timeSymptomsAndExpectedResolutiondac8c3")}</li>
            <li>{t("common.relevantTaskTransactionSampleOrDataUuide72d61")}</li>
          </ul>
        </div>
      </div>
    </AppModal>
  </>;
}
