'use client';

import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar, Tooltip } from '@schema/ui-kit';
import { LogOut, Settings, User } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';

interface UserMenuProps {
  collapsed?: boolean;
}

interface UserData {
  id: string;
  username: string;
  name: string;
  role: string;
  avatar: string | null;
}

export function UserMenu({ collapsed = false }: UserMenuProps) {
  const [open, setOpen] = React.useState(false);
  const { user, logout, isPlatformAdmin } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    setOpen(false);
    router.push('/login');
  };

  const displayUser: UserData = user ? {
    id: user.id,
    username: user.email,
    name: user.name,
    role: user.systemRole,
    avatar: null,
  } : {
    id: '',
    name: '未登录',
    username: '',
    role: 'guest',
    avatar: null,
  };

  const triggerButton = (
    <PopoverPrimitive.Trigger asChild>
      <button
        className={`
          flex items-center gap-2 rounded-md px-2 py-2
          transition-colors duration-fast hover:bg-[var(--yj-panel-subtle)]
          ${collapsed ? 'justify-center' : 'w-full'}
        `}
        aria-label="用户菜单"
      >
        <Avatar
          src={displayUser.avatar || undefined}
          name={displayUser.name}
          size="small"
          className="bg-accent-emphasis text-white"
        />
        {!collapsed && (
          <div className="min-w-0 text-left">
            <div className="truncate text-sm font-medium text-fg-default">{displayUser.name}</div>
            <div className="truncate text-[11px] text-fg-muted">{displayUser.role}</div>
          </div>
        )}
      </button>
    </PopoverPrimitive.Trigger>
  );

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      {collapsed ? (
        <Tooltip content={displayUser.name} placement="right" variant="nav">
          {triggerButton}
        </Tooltip>
      ) : (
        triggerButton
      )}
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side={collapsed ? 'right' : 'top'}
          align={collapsed ? 'start' : 'center'}
          sideOffset={8}
          className="z-50 w-60 overflow-hidden rounded-xl border border-[var(--yj-border-subtle)] bg-white shadow-[var(--yj-shadow-raised)]"
        >
          <div className="border-b border-[var(--yj-border-subtle)] bg-[var(--yj-panel-subtle)] px-4 py-3">
            <p className="text-sm font-semibold text-fg-default">{displayUser.name}</p>
            <p className="mt-0.5 text-xs text-fg-muted">@{displayUser.username || 'guest'}</p>
          </div>

          <div className="border-b border-[var(--yj-border-subtle)] p-1.5">
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-fg-default transition-colors hover:bg-[var(--yj-panel-subtle)]"
            >
              <User className="h-4 w-4 text-fg-muted" />
              个人设置
            </Link>
            {isPlatformAdmin() && (
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-fg-default transition-colors hover:bg-[var(--yj-panel-subtle)]"
              >
                <Settings className="h-4 w-4 text-fg-muted" />
                系统设置
              </Link>
            )}
          </div>

          <div className="p-1.5">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-danger-fg transition-colors hover:bg-danger-subtle"
            >
              <LogOut className="h-4 w-4" />
              退出登录
            </button>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
