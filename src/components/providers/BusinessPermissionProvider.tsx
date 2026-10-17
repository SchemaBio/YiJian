'use client';
import { createContext, useContext } from 'react';
import type { BusinessPermission } from '@/lib/permissions';

// Standalone component previews have no session. Production uses AuthProvider.
export const BusinessPermissionContext = createContext<((permission: BusinessPermission) => boolean) | null>(null);
const OperationContext = createContext<BusinessPermission | null>(null);
export function OperationScope({ permission, children }: { permission: BusinessPermission | null; children: React.ReactNode }) {
  return <OperationContext.Provider value={permission}>{children}</OperationContext.Provider>;
}
export function useBusinessPermissions() {
  const check = useContext(BusinessPermissionContext);
  return { hasPermission: check ?? (() => true) };
}
export function useOperationPermission() { return useContext(OperationContext); }
