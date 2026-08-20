import { buildTenantFormUrl } from '../src/utils/tenant-navigation';

describe('tenant form navigation', () => {
  it('TC-TENANT-NAV-001: rented room edit route includes tenantId', () => {
    expect(buildTenantFormUrl(17, 29))
      .toBe('/pages/add-tenant/index?roomId=17&tenantId=29');
  });

  it('TC-TENANT-NAV-002: vacant room registration route has no tenantId', () => {
    expect(buildTenantFormUrl(17, null))
      .toBe('/pages/add-tenant/index?roomId=17');
  });
});
