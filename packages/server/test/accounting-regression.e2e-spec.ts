import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bill } from '../src/modules/bill/bill.entity';
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

describe('Accounting regressions (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  function previousMonthStr(): string {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - 1, 1)
      .toISOString()
      .slice(0, 7);
  }

  async function setup(rent = 1000) {
    const auth = await loginAsLandlord(app, `dev_accounting_${Date.now()}_${Math.random()}`);
    const propertyId = await createProperty(app, auth);
    const roomId = await createRoom(app, auth, propertyId, { rent, name: `账务回归-${Date.now()}` });
    return { auth, propertyId, roomId };
  }

  it('实际在本月收到上月账单，应计入本月实收', async () => {
    const { auth, roomId } = await setup();
    await createTenant(app, auth, roomId, {
      name: '跨月付款租客',
      phone: '13910000001',
      moveInDate: `${previousMonthStr()}-01`,
      rentDay: 1,
    });
    const billRepo = app.get<Repository<Bill>>(getRepositoryToken(Bill));
    const bill = await billRepo.findOneByOrFail({ roomId, period: previousMonthStr() });

    expectOk(await apiCall(app, 'put', `/api/bills/${bill.id}/confirm`, auth, { actualAmount: 1000 }));
    const stats = expectOk(await apiCall(app, 'get', `/api/stats/rent?period=${currentMonthStr()}`, auth));

    expect(stats.totalCollected).toBe(1000);
  });

  it('部分收款后退租，已收到的金额仍应保留在实收统计', async () => {
    const { auth, roomId } = await setup();
    const tenantId = await createTenant(app, auth, roomId, {
      name: '部分付款退租租客',
      phone: '13910000002',
      moveInDate: `${currentMonthStr()}-01`,
      rentDay: 1,
    });
    const billRepo = app.get<Repository<Bill>>(getRepositoryToken(Bill));
    const bill = await billRepo.findOneByOrFail({ roomId, period: currentMonthStr() });
    expectOk(await apiCall(app, 'put', `/api/bills/${bill.id}/confirm`, auth, { actualAmount: 400 }));

    expectOk(await apiCall(app, 'delete', `/api/tenants/${tenantId}`, auth, {
      moveOutDate: new Date().toISOString().slice(0, 10),
      prepaidRefundAmount: 0,
    }));
    const stats = expectOk(await apiCall(app, 'get', `/api/stats/rent?period=${currentMonthStr()}`, auth));

    expect(stats.totalCollected).toBe(400);
  });

  it('退还押金不能冲减租金实收', async () => {
    const { auth, roomId } = await setup();
    const tenantId = await createTenant(app, auth, roomId, {
      name: '退押金租客',
      phone: '13910000003',
      moveInDate: `${currentMonthStr()}-01`,
      rentDay: 1,
      deposit: 1000,
      initialPaymentMethod: 'cash',
      initialPaymentDate: `${currentMonthStr()}-01`,
      initialPaymentAmount: 1000,
      initialDepositAmount: 1000,
    });

    expectOk(await apiCall(app, 'delete', `/api/tenants/${tenantId}`, auth, {
      moveOutDate: new Date().toISOString().slice(0, 10),
      depositStatus: 1,
      depositRefundAmount: 1000,
      prepaidRefundAmount: 0,
    }));
    const stats = expectOk(await apiCall(app, 'get', `/api/stats/rent?period=${currentMonthStr()}`, auth));

    expect(stats.totalCollected).toBe(1000);
  });

  it('修改收租日不能改变已出账单的到期日', async () => {
    const { auth, roomId } = await setup();
    const tenantId = await createTenant(app, auth, roomId, {
      name: '到期日快照租客',
      phone: '13910000004',
      moveInDate: `${currentMonthStr()}-01`,
      rentDay: 8,
    });
    const billRepo = app.get<Repository<Bill>>(getRepositoryToken(Bill));
    const before = await billRepo.findOneByOrFail({ roomId, period: currentMonthStr() });
    expect(before.dueDate).toBe(`${currentMonthStr()}-08`);

    expectOk(await apiCall(app, 'put', `/api/tenants/${tenantId}`, auth, { rentDay: 20 }));
    const after = await billRepo.findOneByOrFail({ id: before.id });

    expect(after.dueDate).toBe(`${currentMonthStr()}-08`);
  });
});
