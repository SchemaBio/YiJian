'use client';
import { useBusinessPermissions } from '@/components/providers/BusinessPermissionProvider';
import * as React from 'react';
export const InterpretationReadOnlyContext = React.createContext(false);
export function useInterpretationReadOnly(): boolean { const { hasPermission } = useBusinessPermissions(); return React.useContext(InterpretationReadOnlyContext) || !hasPermission('interpretation_reports.manage'); }
