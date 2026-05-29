import { AppShell } from '@/components/layout';
import { AuthGate } from '@/components/auth/AuthGate';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGate>
      <AppShell>{children}</AppShell>
    </AuthGate>
  );
}
