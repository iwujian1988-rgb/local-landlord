import { INestApplication } from '@nestjs/common';
import { apiCall, createTestApp, loginAsAdmin, loginAsLandlord } from './helpers/app';

describe('First-use guide server switch (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('defaults off, supports admin on/off without a release, and exposes only the public boolean', async () => {
    const read = () => apiCall(app, 'get', '/api/public-config/usage-guide', null);
    const initial = await read();
    expect(initial.status).toBe(200);
    expect(initial.body.data).toEqual({ enabled: false });

    const admin = await loginAsAdmin(app);
    const landlord = await loginAsLandlord(app);
    const denied = await apiCall(app, 'put', '/api/admin/settings/params', landlord, { enableFirstUseGuide: true });
    expect(denied.status).toBe(403);

    const invalid = await apiCall(app, 'put', '/api/admin/settings/params', admin, { enableFirstUseGuide: 'true' });
    expect(invalid.status).toBe(400);

    const enabled = await apiCall(app, 'put', '/api/admin/settings/params', admin, { enableFirstUseGuide: true });
    expect(enabled.status).toBe(200);
    expect((await read()).body.data).toEqual({ enabled: true });

    const disabled = await apiCall(app, 'put', '/api/admin/settings/params', admin, { enableFirstUseGuide: false });
    expect(disabled.status).toBe(200);
    expect((await read()).body.data).toEqual({ enabled: false });
  });
});
