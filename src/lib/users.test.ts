import { beforeEach, expect, it, vi } from 'vitest';
import { createUser, updateUser } from './users';
import { api } from './api';
import { hashPassword } from './crypto';
const runtime = vi.hoisted(() => ({ backend: 'octopus' as 'octopus' | 'squid' }));
vi.mock('./runtime-config', () => ({ getRuntimeBackendFlavor: () => runtime.backend }));
vi.mock('./api', () => ({ api: { post: vi.fn(), put: vi.fn() } }));
vi.mock('./crypto', () => ({ hashPassword: vi.fn(async () => 'prepared-password') }));
beforeEach(() => { vi.clearAllMocks(); runtime.backend = 'octopus'; });
const roles = [
  ['octopus', 'ORG_USER', 'USER'],
  ['octopus', 'PLATFORM_ADMIN', 'SUPER_ADMIN'],
  ['squid', 'ORG_USER', 'ORG_USER'],
  ['squid', 'PLATFORM_ADMIN', 'PLATFORM_ADMIN'],
] as const;
it.each(roles)('creates a %s %s using backend role %s', async (backend, uiRole, backendRole) => {
  runtime.backend = backend;
  vi.mocked(api.post).mockResolvedValue({ id: 7, email: 'user@example.invalid', name: 'User', system_role: backendRole, is_active: true });
  const result = await createUser({ email: ' User@Example.invalid ', name: ' User ', password: 'Temporary!2026', systemRole: uiRole });
  expect(hashPassword).toHaveBeenCalledWith('Temporary!2026', 'user@example.invalid');
  expect(api.post).toHaveBeenCalledWith('/v1/users', { email: 'user@example.invalid', name: 'User', password: 'prepared-password', system_role: backendRole }, { coreApi: false });
  expect(result).toMatchObject({ id: '7', systemRole: uiRole, isActive: true });
});
it.each(roles)('edits a %s %s using backend role %s', async (backend, uiRole, backendRole) => {
  runtime.backend = backend;
  vi.mocked(api.put).mockResolvedValue({ id: 7, email: 'user@example.invalid', name: 'User', system_role: backendRole, is_active: true });
  const result = await updateUser('7', { systemRole: uiRole, isActive: true });
  expect(api.put).toHaveBeenCalledWith('/v1/users/7', { system_role: backendRole, is_active: true }, { coreApi: false });
  expect(result.systemRole).toBe(uiRole);
});
it('leaves the role unchanged when only editing profile fields', async () => {
  vi.mocked(api.put).mockResolvedValue({ id: 7, email: 'user@example.invalid', name: 'Renamed', system_role: 'USER', is_active: true });
  await updateUser('7', { name: 'Renamed' });
  expect(api.put).toHaveBeenCalledWith('/v1/users/7', { name: 'Renamed' }, { coreApi: false });
});
