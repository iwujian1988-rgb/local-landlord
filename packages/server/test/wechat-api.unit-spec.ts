import { WechatApiService } from '../src/common/wx/wechat-api.service';

describe('WechatApiService', () => {
  const originalFetch = global.fetch;
  const originalAppId = process.env.WX_APPID;
  const originalSecret = process.env.WX_SECRET;

  beforeEach(() => {
    process.env.WX_APPID = 'wx-test-app';
    process.env.WX_SECRET = 'test-secret';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.WX_APPID = originalAppId;
    process.env.WX_SECRET = originalSecret;
    jest.restoreAllMocks();
  });

  it('TC-WX-API-001: exchanges phone code and reuses one cached access token', async () => {
    const service = new WechatApiService();
    jest.spyOn(service, 'resolveApi').mockResolvedValue({ base: 'https://api.weixin.qq.com', injected: false });
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'access-1', expires_in: 7200 }),
      })
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          errcode: 0,
          phone_info: { phoneNumber: '8613800000000', purePhoneNumber: '13800000000', countryCode: '86' },
        }),
      });
    global.fetch = fetchMock as any;

    await expect(service.getPhoneNumber('phone-code-1')).resolves.toBe('13800000000');
    await expect(service.getPhoneNumber('phone-code-2')).resolves.toBe('13800000000');

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toContain('/wxa/business/getuserphonenumber?access_token=access-1');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ code: 'phone-code-1' });
  });

  it('TC-WX-API-002: rejects an expired or invalid phone authorization code', async () => {
    const service = new WechatApiService();
    jest.spyOn(service, 'resolveApi').mockResolvedValue({ base: 'https://api.weixin.qq.com', injected: false });
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'access-1', expires_in: 7200 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ errcode: 40029, errmsg: 'invalid code' }),
      }) as any;

    await expect(service.getPhoneNumber('expired-code')).rejects.toThrow(/40029/);
  });
});
