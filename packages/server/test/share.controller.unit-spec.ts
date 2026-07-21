import { ShareController } from '../src/modules/share/share.controller';

describe('ShareController payment-link generation', () => {
  const shareService = {
    generateForBill: jest.fn(),
    generateForSingleCharge: jest.fn(),
  };
  const billService = { verifyBillOwnership: jest.fn() };
  const rentService = { verifySingleChargeOwnership: jest.fn() };
  const originalPublicBaseUrl = process.env.PUBLIC_BASE_URL;
  const originalBaseUrl = process.env.BASE_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    shareService.generateForBill.mockResolvedValue({ token: 'a b/中文', expiresAt: '2099-01-01' });
    billService.verifyBillOwnership.mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (originalPublicBaseUrl === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = originalPublicBaseUrl;
    if (originalBaseUrl === undefined) delete process.env.BASE_URL;
    else process.env.BASE_URL = originalBaseUrl;
  });

  function createController() {
    return new ShareController(shareService as any, billService as any, rentService as any);
  }

  it('TC-SHARE-SERVER-001: 正式环境优先使用 PUBLIC_BASE_URL，返回可直接发送的绝对地址', async () => {
    process.env.PUBLIC_BASE_URL = 'https://payment.example.com/';
    delete process.env.BASE_URL;
    const req = { headers: {}, protocol: 'http', get: jest.fn().mockReturnValue('localhost:3000') } as any;

    const result = await createController().generate({ id: 7 }, { billId: 12 } as any, req);

    expect(result.shareUrl).toBe('https://payment.example.com/h5/?token=a%20b%2F%E4%B8%AD%E6%96%87');
  });

  it('TC-SHARE-SERVER-002: 未配置域名时，从云托管反向代理头生成完整 HTTPS 地址', async () => {
    delete process.env.PUBLIC_BASE_URL;
    delete process.env.BASE_URL;
    const req = {
      headers: {
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'local-landlord.example.com',
      },
      protocol: 'http',
      get: jest.fn().mockReturnValue('internal:80'),
    } as any;

    const result = await createController().generate({ id: 7 }, { billId: 12 } as any, req);

    expect(result.shareUrl).toBe('https://local-landlord.example.com/h5/?token=a%20b%2F%E4%B8%AD%E6%96%87');
    expect(result.shareUrl).toMatch(/^https:\/\//);
  });
});
