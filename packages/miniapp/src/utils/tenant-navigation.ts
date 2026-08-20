export function buildTenantFormUrl(roomId: number, tenantId?: number | null): string {
  const base = `/pages/add-tenant/index?roomId=${roomId}`;
  return tenantId && tenantId > 0 ? `${base}&tenantId=${tenantId}` : base;
}
