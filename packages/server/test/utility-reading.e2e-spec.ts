import { INestApplication } from '@nestjs/common';
import {
  apiCall,
  createProperty,
  createRoom,
  createTenant,
  createTestApp,
  currentMonthStr,
  expectOk,
  loginAsLandlord,
} from './helpers/app';

describe('Utility readings and bill synchronization (e2e)', () => {
  let app: INestApplication;
  let auth: () => { Authorization: string };
  let roomId: number;
  let billId: number;
  const period = currentMonthStr();

  beforeAll(async () => {
    app = await createTestApp();
    auth = await loginAsLandlord(app);
    const propertyId = await createProperty(app, auth);
    roomId = await createRoom(app, auth, propertyId, { name: 'utility-room', rent: 2000 });
    await createTenant(app, auth, roomId, {
      name: 'utility-tenant',
      phone: '13911110000',
      moveInDate: `${period}-01`,
      payMonths: 1,
      feeItems: [
        { name: '房租', type: 'fixed', amount: 2000, enabled: true, isRent: true, cycleMode: 'rent' },
        { name: '水电费', type: 'manual', amount: 0, enabled: true, isRent: false, cycleMode: 'monthly' },
      ],
    });
    const currentBill = expectOk(await apiCall(app, 'get', `/api/rooms/${roomId}/bills`, auth));
    billId = Number(currentBill.billId);
    expect(billId).toBeGreaterThan(0);
  });

  afterAll(async () => {
    await app.close();
  });

  it('records water and electricity independently, retains evidence and synchronizes the unpaid bill', async () => {
    const save = await apiCall(app, 'put', `/api/rooms/${roomId}/utility-readings`, auth, {
      period,
      readings: [
        {
          utilityType: 0,
          mode: 'metered',
          previousReading: 120,
          currentReading: 136.5,
          unitPrice: 2.5,
          photos: ['/uploads/water-meter.jpg'],
          note: '水表照片已留存',
        },
        {
          utilityType: 1,
          mode: 'manual',
          amount: 88.8,
          photos: ['/uploads/electric-meter.jpg'],
        },
      ],
    });
    const readings = expectOk(save);
    expect(readings).toHaveLength(2);
    expect(readings.find((item: any) => item.utilityType === 0)).toMatchObject({
      mode: 'metered', usage: 16.5, amount: 41.25, photos: ['/uploads/water-meter.jpg'],
    });
    expect(readings.find((item: any) => item.utilityType === 1)).toMatchObject({
      mode: 'manual', amount: 88.8, photos: ['/uploads/electric-meter.jpg'],
    });

    const monthly = expectOk(await apiCall(app, 'get', `/api/rooms/${roomId}/utility-readings?period=${period}`, auth));
    expect(monthly.utilityTypes).toEqual([0, 1]);
    expect(monthly.records).toHaveLength(2);
    expect(monthly.records.find((item: any) => item.utilityType === 0).reading.previousReading).toBe(120);

    const bill = expectOk(await apiCall(app, 'get', `/api/bills/${billId}`, auth));
    expect(Number(bill.totalAmount)).toBe(2130.05);
    expect(bill.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ feeName: '房租', amount: 2000 }),
      expect.objectContaining({ feeName: '水费', amount: 41.25 }),
      expect.objectContaining({ feeName: '电费', amount: 88.8 }),
    ]));
  });

  it('does not expose the utility flow when the tenancy has no utility fee rule', async () => {
    const propertyId = await createProperty(app, auth);
    const noUtilityRoomId = await createRoom(app, auth, propertyId, { name: 'no-utility-room', rent: 1800 });
    await createTenant(app, auth, noUtilityRoomId, {
      name: 'no-utility-tenant',
      phone: '13911110001',
      moveInDate: `${period}-01`,
      payMonths: 1,
    });

    const bill = expectOk(await apiCall(app, 'get', `/api/rooms/${noUtilityRoomId}/bills`, auth));
    expect(bill.utilityTypes).toEqual([]);
    const readings = await apiCall(app, 'get', `/api/rooms/${noUtilityRoomId}/utility-readings?period=${period}`, auth);
    expect(readings.status).toBe(400);
  });

  it('returns only water and rejects electricity when the tenancy only charges water', async () => {
    const propertyId = await createProperty(app, auth);
    const waterRoomId = await createRoom(app, auth, propertyId, { name: 'water-only-room', rent: 1600 });
    await createTenant(app, auth, waterRoomId, {
      name: 'water-only-tenant',
      phone: '13911110002',
      moveInDate: `${period}-01`,
      payMonths: 1,
      feeItems: [
        { name: '房租', type: 'fixed', amount: 1600, enabled: true, isRent: true, cycleMode: 'rent' },
        { name: '水费', type: 'manual', amount: 0, enabled: true, isRent: false, cycleMode: 'monthly' },
      ],
    });

    const monthly = expectOk(await apiCall(app, 'get', `/api/rooms/${waterRoomId}/utility-readings?period=${period}`, auth));
    expect(monthly.utilityTypes).toEqual([0]);
    expect(monthly.records.map((item: any) => item.utilityType)).toEqual([0]);

    const rejected = await apiCall(app, 'put', `/api/rooms/${waterRoomId}/utility-readings`, auth, {
      period,
      readings: [{ utilityType: 1, mode: 'manual', amount: 88 }],
    });
    expect(rejected.status).toBe(400);
  });

  it('does not allow readings to alter a partially paid bill', async () => {
    expectOk(await apiCall(app, 'put', `/api/bills/${billId}/confirm`, auth, { actualAmount: 100 }));
    const result = await apiCall(app, 'put', `/api/rooms/${roomId}/utility-readings`, auth, {
      period,
      readings: [{ utilityType: 0, mode: 'manual', amount: 10 }],
    });
    expect(result.status).toBe(400);
    expect(result.body.code).not.toBe(0);
  });
});
