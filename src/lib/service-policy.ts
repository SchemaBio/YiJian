import { api } from './api';

export const SERVICE_POLICY_VERSION = 'research-service-2026-10-29-v1';
export interface ServicePolicy {
  version: string; service_url: string; terms_url: string; refund_url: string;
  operator: string; contact: string; address: string; configured: boolean;
}
export function getServicePolicy() {
  return api.get<ServicePolicy>('/v1/service-policy', { coreApi: false });
}
