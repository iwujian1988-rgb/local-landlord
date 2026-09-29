import { ShareController } from '../src/modules/share/share.controller';

describe('ShareController payment-link generation', () => {
  const shareService = {
    generateForBill: jest.fn(),
    generateForSingleCharge: jest.fn(),
    generateForRoom: jest.fn(),
    resolveRoom: jest.fn(),
  };
  const billService = { verifyBillOwnership: jest.fn() };
  const rentService = { verifySingleChargeOwnership: jest.fn() };
  const roomService = { verifyRoomOwnership: jest.fn() };
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
    return new ShareController(shareService as any, billService as any, rentService as any, roomService as any);
  }

  it('房间分享先核对房东归属，再生成访问凭证', async () => {
    shareService.generateForRoom.mockResolvedValue({ token: 'room-token', expiresAt: '2099-01-01' });
    await expect(createController().generateRoom({ id: 7 }, 12)).resolves.toEqual({ token: 'room-token', expiresAt: '2099-01-01' });
    expect(roomService.verifyRoomOwnership).toHaveBeenCalledWith(12, 7);
    expect(shareService.generateForRoom).toHaveBeenCalledWith(12);
  });

  it('房间不属于当前房东时不能生成分享凭证', async () => {
    roomService.verifyRoomOwnership.mockRejectedValueOnce(new Error('无权访问'));
    await expect(createController().generateRoom({ id: 7 }, 12)).rejects.toThrow('无权访问');
    expect(shareService.generateForRoom).not.toHaveBeenCalled();
  });

  it('访客凭有效凭证查看房间介绍，不要求房东登录', async () => {
    const publicRoom = { name: '主卧', rent: 2000, facilities: ['洗衣机'], images: [] };
    shareService.resolveRoom.mockResolvedValue(publicRoom);
    await expect(createController().resolveRoom('room-token')).resolves.toEqual(publicRoom);
    expect(shareService.resolveRoom).toHaveBeenCalledWith('room-token');
  });

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
