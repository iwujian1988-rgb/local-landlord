import { ShareService } from '../src/modules/share/share.service';

describe('房间介绍分享', () => {
  const jwt = { sign: jest.fn(), verify: jest.fn() };
  const roomRepo = { findOne: jest.fn() };
  const propertyRepo = { findOne: jest.fn() };
  const landlordRepo = { findOne: jest.fn() };

  const createService = () => new ShareService(
    jwt as any,
    {} as any,
    {} as any,
    {} as any,
    roomRepo as any,
    propertyRepo as any,
    landlordRepo as any,
    {} as any,
    {} as any,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    roomRepo.findOne.mockResolvedValue({
      id: 12, status: 0, propertyId: 3, name: '主卧', rent: 2000,
      area: '25㎡', floor: '2楼', orientation: '朝南',
      facilities: ['洗衣机'], images: ['/room.jpg'], note: '私密备注',
    });
    propertyRepo.findOne.mockResolvedValue({ id: 3, landlordId: 7 });
    landlordRepo.findOne.mockResolvedValue({ id: 7, status: 1 });
    jwt.sign.mockReturnValue('room-token');
    jwt.verify.mockReturnValue({ rid: 12, kind: 'share-room-v1' });
  });

  it('只给可用房间签发 30 天分享凭证', async () => {
    expect((await createService().generateForRoom(12)).token).toBe('room-token');
    expect(jwt.sign).toHaveBeenCalledWith(
      { rid: 12, kind: 'share-room-v1' }, { expiresIn: 30 * 24 * 60 * 60 },
    );
    roomRepo.findOne.mockResolvedValueOnce({ id: 12, status: 2 });
    await expect(createService().generateForRoom(12)).rejects.toThrow('房间不存在或已归档');
  });

  it('访客只看到房间介绍，不泄露租客和房东备注', async () => {
    await expect(createService().resolveRoom('room-token')).resolves.toEqual({
      name: '主卧', rent: 2000, area: '25㎡', floor: '2楼',
      orientation: '朝南', facilities: ['洗衣机'], images: ['/room.jpg'],
    });
  });

  it('拒绝无效凭证与已归档房间', async () => {
    jwt.verify.mockReturnValueOnce({ rid: 12, kind: 'share-bill-v1' });
    await expect(createService().resolveRoom('room-token')).rejects.toThrow('无效的房间分享');
    roomRepo.findOne.mockResolvedValueOnce({ id: 12, status: 2 });
    await expect(createService().resolveRoom('room-token')).rejects.toThrow('房间已下架');
  });
});
