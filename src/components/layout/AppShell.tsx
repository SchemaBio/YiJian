'use client';
import { OperationScope } from '@/components/providers/BusinessPermissionProvider';
import { permissionForPath } from '@/lib/permissions';
import { usePathname } from 'next/navigation';
import { AppShellView } from './AppShellView';
import { AnnouncementsProvider, AnnouncementButton, AnnouncementBanners } from '@/components/announcements/Announcements';
import { SidebarNav } from './SidebarNav';
import { MobileNav } from './MobileNav';
import { BillingDisplay } from '@/components/BillingDisplay';
import { SupportDialog } from '@/components/support/SupportDialog';
export function AppShell({children}:{children:React.ReactNode}) { const pathname=usePathname(); return <OperationScope permission={permissionForPath(pathname)}><AnnouncementsProvider><AppShellView SidebarNav={SidebarNav} MobileNav={MobileNav} BillingDisplay={BillingDisplay} SupportDialog={SupportDialog} AnnouncementButton={AnnouncementButton} AnnouncementBanners={AnnouncementBanners}>{children}</AppShellView></AnnouncementsProvider></OperationScope>; }
