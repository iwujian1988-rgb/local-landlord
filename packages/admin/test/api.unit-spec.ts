/**
 * Tests for admin/src/services/api.ts (typed wrappers around `request`).
 *
 * Strategy: mock services/request so we can capture the URL + payload each
 * api.* call makes, and inject canned responses. This catches URL typos,
 * payload shape drift, and the unwrap/unwrapPaginated/handleApiError logic.
 *
 * We're NOT exercising axios here — that's covered by request.unit-spec.ts.
 */
type Method = 'get' | 'post' | 'put' | 'delete';

interface CapturedCall {
  method: Method;
  url: string;
  data?: any;
  params?: any;
}

const calls: CapturedCall[] = [];
let nextResponse: any = { code: 0, data: null, message: 'success' };
let nextError: any = null;

jest.mock('../src/services/request', () => ({
  __esModule: true,
  default: {
    get: jest.fn(async (url: string, config?: any) => {
      calls.push({ method: 'get', url, params: config?.params });
      if (nextError) throw nextError;
      return nextResponse;
    }),
    post: jest.fn(async (url: string, data?: any) => {
      calls.push({ method: 'post', url, data });
      if (nextError) throw nextError;
      return nextResponse;
    }),
    put: jest.fn(async (url: string, data?: any) => {
      calls.push({ method: 'put', url, data });
      if (nextError) throw nextError;
      return nextResponse;
    }),
    delete: jest.fn(async (url: string) => {
      calls.push({ method: 'delete', url });
      if (nextError) throw nextError;
      return nextResponse;
    }),
  },
}));

import { propertyApi, roomApi, tenantApi, billApi, contractApi, adminApi, landlordApi } from '../src/services/api';

describe('services/api — 通用配置', () => {
  beforeEach(() => {
    calls.length = 0;
    nextResponse = { code: 0, data: null, message: 'success' };
    nextError = null;
  });

  it('TC-AAPI-001: handleApiError 透传 err.response.data.message（优先级最高）', async () => {
    nextError = { response: { data: { message: '服务端特定错误' } }, message: '网络错误' };
    await expect(propertyApi.list()).rejects.toMatchObject({
      response: { data: { message: '服务端特定错误' } },
    });
  });

  it('TC-AAPI-002: handleApiError 退化到 err.message', async () => {
    nextError = { message: '网络错误' };
    await expect(propertyApi.list()).rejects.toMatchObject({ message: '网络错误' });
  });

  it('TC-AAPI-003: handleApiError 完全空 → "网络请求失败，请稍后重试"（仅靠 console，不抛默认 msg，但 throw 自身）', async () => {
    nextError = {};
    // 不抛"网络请求失败"消息 — throw 原始 err。文档化：handleApiError 不构造默认 message。
    await expect(propertyApi.list()).rejects.toEqual({});
  });
});

describe('services/api — unwrap 拆包', () => {
  beforeEach(() => {
    calls.length = 0;
    nextError = null;
  });

  it('TC-AAPI-UNWRAP-001: unwrap 取 res.data', async () => {
    nextResponse = { code: 0, data: { id: 7, name: 'p' }, message: 'ok' };
    const out = await propertyApi.detail(7);
    expect(out).toEqual({ id: 7, name: 'p' });
    expect(calls[0]).toEqual({ method: 'get', url: '/admin/properties/7', params: undefined });
  });

  it('TC-AAPI-UNWRAP-002: unwrapPaginated 拆 {list,total,page,pageSize}', async () => {
    nextResponse = {
      code: 0,
      data: { list: [{ id: 1 }], total: 1, page: 1, pageSize: 20 },
      message: 'ok',
    };
    const out = await propertyApi.list({ page: 1, keyword: 'x' });
    expect(out.list).toHaveLength(1);
    expect(calls[0]).toEqual({ method: 'get', url: '/admin/properties', params: { page: 1, keyword: 'x' } });
  });
});

describe('services/api — property 路由', () => {
  beforeEach(() => {
    calls.length = 0;
    nextResponse = { code: 0, data: null, message: 'success' };
    nextError = null;
  });

  it('TC-AAPI-P-001: list → GET /admin/properties', async () => {
    await propertyApi.list({ page: 1 });
    expect(calls[0].method).toBe('get');
    expect(calls[0].url).toBe('/admin/properties');
  });

  it('TC-AAPI-P-002: detail(id) → GET /admin/properties/:id', async () => {
    await propertyApi.detail(42);
    expect(calls[0]).toEqual({ method: 'get', url: '/admin/properties/42', params: undefined });
  });

  it('TC-AAPI-P-003: create → POST /admin/properties + body', async () => {
    await propertyApi.create({ name: 'p', landlordId: 1 } as any);
    expect(calls[0]).toEqual({ method: 'post', url: '/admin/properties', data: { name: 'p', landlordId: 1 } });
  });

  it('TC-AAPI-P-004: update → PUT /admin/properties/:id', async () => {
    await propertyApi.update(5, { name: 'renamed' } as any);
    expect(calls[0]).toEqual({ method: 'put', url: '/admin/properties/5', data: { name: 'renamed' } });
  });

  it('TC-AAPI-P-005: remove → DELETE /admin/properties/:id', async () => {
    await propertyApi.remove(9);
    expect(calls[0]).toEqual({ method: 'delete', url: '/admin/properties/9' });
  });
});

describe('services/api — room 路由', () => {
  beforeEach(() => {
    calls.length = 0;
    nextResponse = { code: 0, data: null, message: 'success' };
    nextError = null;
  });

  it('TC-AAPI-R-001: updateStatus → PUT /admin/rooms/:id/status + { status }', async () => {
    await roomApi.updateStatus(3, 1);
    expect(calls[0]).toEqual({ method: 'put', url: '/admin/rooms/3/status', data: { status: 1 } });
  });

  it('TC-AAPI-R-002: remove → DELETE', async () => {
    await roomApi.remove(8);
    expect(calls[0].method).toBe('delete');
    expect(calls[0].url).toBe('/admin/rooms/8');
  });
});

describe('services/api — tenant 路由', () => {
  beforeEach(() => {
    calls.length = 0;
    nextResponse = { code: 0, data: null, message: 'success' };
    nextError = null;
  });

  it('TC-AAPI-T-001: moveOut → PUT /admin/tenants/:id/move-out', async () => {
    await tenantApi.moveOut(7, { moveOutDate: '2099-12-31' });
    expect(calls[0]).toEqual({
      method: 'put',
      url: '/admin/tenants/7/move-out',
      data: { moveOutDate: '2099-12-31' },
    });
  });
});

describe('services/api — bill 路由', () => {
  beforeEach(() => {
    calls.length = 0;
    nextResponse = { code: 0, data: null, message: 'success' };
    nextError = null;
  });

  it('TC-AAPI-B-001: confirm → PUT /admin/bills/:id/confirm', async () => {
    await billApi.confirm(11, { paidAt: '2099-01-01' } as any);
    expect(calls[0]).toEqual({
      method: 'put',
      url: '/admin/bills/11/confirm',
      data: { paidAt: '2099-01-01' },
    });
  });

  it('TC-AAPI-B-002: batchConfirm → POST + { ids, ...data }', async () => {
    await billApi.batchConfirm([1, 2, 3], { paidAt: '2099-01-01' } as any);
    expect(calls[0]).toEqual({
      method: 'post',
      url: '/admin/bills/batch-confirm',
      data: { ids: [1, 2, 3], paidAt: '2099-01-01' },
    });
  });

  it('TC-AAPI-B-003: batchConfirm 无 paidAt → 只发 ids', async () => {
    await billApi.batchConfirm([1, 2]);
    expect(calls[0].data).toEqual({ ids: [1, 2] });
  });

  it('TC-AAPI-B-004: batchRemind → POST + { ids }', async () => {
    await billApi.batchRemind([1, 2]);
    expect(calls[0]).toEqual({ method: 'post', url: '/admin/bills/batch-remind', data: { ids: [1, 2] } });
  });

  it('TC-AAPI-B-005: overdue → GET /admin/bills/overdue', async () => {
    await billApi.overdue();
    expect(calls[0]).toEqual({ method: 'get', url: '/admin/bills/overdue', params: undefined });
  });
});

describe('services/api — contract 路由', () => {
  beforeEach(() => {
    calls.length = 0;
    nextResponse = { code: 0, data: null, message: 'success' };
    nextError = null;
  });

  it('TC-AAPI-C-001: upload → POST /admin/contracts/upload', async () => {
    await contractApi.upload({ name: 'c', imageUrl: '/x.png', roomId: 1 } as any);
    expect(calls[0]).toEqual({
      method: 'post',
      url: '/admin/contracts/upload',
      data: { name: 'c', imageUrl: '/x.png', roomId: 1 },
    });
  });

  it('TC-AAPI-C-002: remove → DELETE /admin/contracts/:id', async () => {
    await contractApi.remove(7);
    expect(calls[0]).toEqual({ method: 'delete', url: '/admin/contracts/7' });
  });
});

describe('services/api — admin 路由', () => {
  beforeEach(() => {
    calls.length = 0;
    nextResponse = { code: 0, data: null, message: 'success' };
    nextError = null;
  });

  it('TC-AAPI-A-001: resetPassword → PUT /admin/admins/:id/reset-password + { password }', async () => {
    await adminApi.resetPassword(2, 'new-pwd');
    expect(calls[0]).toEqual({
      method: 'put',
      url: '/admin/admins/2/reset-password',
      data: { password: 'new-pwd' },
    });
  });

  it('TC-AAPI-A-002: create → POST /admin/admins', async () => {
    await adminApi.create({ username: 'op', password: 'p', name: 'n' } as any);
    expect(calls[0]).toEqual({
      method: 'post',
      url: '/admin/admins',
      data: { username: 'op', password: 'p', name: 'n' },
    });
  });
});

describe('services/api — landlord 路由', () => {
  beforeEach(() => {
    calls.length = 0;
    nextResponse = { code: 0, data: null, message: 'success' };
    nextError = null;
  });

  it('TC-AAPI-L-001: updateStatus → PUT /admin/landlords/:id/status', async () => {
    await landlordApi.updateStatus(5, 1);
    expect(calls[0]).toEqual({ method: 'put', url: '/admin/landlords/5/status', data: { status: 1 } });
  });

  it('TC-AAPI-L-002: detail → GET /admin/landlords/:id', async () => {
    await landlordApi.detail(5);
    expect(calls[0]).toEqual({ method: 'get', url: '/admin/landlords/5', params: undefined });
  });
});
