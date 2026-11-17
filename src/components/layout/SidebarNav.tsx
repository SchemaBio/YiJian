'use client';
import { useAuth } from '@/components/providers/AuthProvider';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';
import { SidebarNavView } from './SidebarNavView';
import { UserMenu } from './UserMenu';
import { OrganizationSwitcher } from './OrganizationSwitcher';
export function SidebarNav(props: {collapsed:boolean;onCollapsedChange:(value:boolean)=>void}) { const {isPlatformAdmin,currentOrg}=useAuth(); return <SidebarNavView {...props} isAdmin={isPlatformAdmin()} isSaaS={getRuntimeBackendFlavor()==='squid'} currentOrg={currentOrg} UserMenu={UserMenu} OrganizationSwitcher={OrganizationSwitcher} />; }
