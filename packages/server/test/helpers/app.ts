import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { TransformInterceptor } from '../../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../../src/common/filters/http-exception.filter';
import request from 'supertest';

// Env vars (ADMIN_DEFAULT_PASSWORD, DISABLE_THROTTLE, NODE_ENV, DB_*) are set
// in helpers/setup-env.ts via jest setupFiles so they apply BEFORE AppModule
// is imported — AppModule's @Module decorator reads them at import time.

/**
 * Boot the full Nest application the same way main.ts does — global prefix,
 * validation pipe, exception filter, and the { code, data, message } response
 * wrapper. Tests that skip this see raw controller returns instead of the
 * wrapped envelope and fail every `res.body.code` assertion.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());
  await app.init();
  return app;
}

/**
 * Login as the default admin (auto-created on first run via ADMIN_DEFAULT_PASSWORD
 * which the test process sets in jest-e2e.json's env, or that we set explicitly here
 * as a fallback). Returns a Bearer header setter.
 */
export async function loginAsAdmin(app: INestApplication): Promise<() => { Authorization: string }> {
  const res = await request(app.getHttpServer())
    .post('/api/auth/admin/login')
    .send({ username: 'admin', password: process.env.ADMIN_DEFAULT_PASSWORD || 'admin123' });
  if (!res.body?.data?.token) {
    throw new Error(`admin login failed: ${JSON.stringify(res.body)}`);
  }
  const token: string = res.body.data.token;
  return () => ({ Authorization: `Bearer ${token}` });
}

/**
 * Login as a landlord via the dev_ code bypass. Each call uses a fresh openId
 * so the resulting account is a clean slate. Property/room endpoints require
 * role=1, so business-flow tests need this, not admin.
 */
export async function loginAsLandlord(app: INestApplication, devCode = `dev_e2e_${Date.now()}_${Math.random().toString(36).slice(2,8)}`): Promise<() => { Authorization: string }> {
  const res = await request(app.getHttpServer())
    .post('/api/auth/wechat/login')
    .send({ code: devCode });
  if (!res.body?.data?.token) {
    throw new Error(`landlord login failed: ${JSON.stringify(res.body)}`);
  }
  const token: string = res.body.data.token;
  return () => ({ Authorization: `Bearer ${token}` });
}

/**
 * Wrapped supertest helper. The API envelope is { code, data, message };
 * code===0 means success. Using this avoids repeating res.body.code checks
 * and surfaces readable failures (body is logged when code !== 0).
 */
export async function apiCall(
  app: INestApplication,
  method: 'get'|'post'|'put'|'delete'|'patch',
  path: string,
  auth: (() => { Authorization: string }) | null,
  body?: any,
): Promise<{ status: number; body: any }> {
  const req = request(app.getHttpServer())[method](path);
  if (auth) {
    req.set(auth());
  }
  // All methods except GET may carry a body. DELETE-with-body is unusual but
  // our tenant moveOut endpoint uses it (DELETE /tenants/:id with MoveOutDto).
  if (body !== undefined && method !== 'get') {
    req.send(body);
  }
  const res = await req;
  return { status: res.status, body: res.body };
}

/**
 * Assert the response is a successful API envelope (code===0) and return data.
 * Throws with the body attached when not — tests fail readably instead of
 * "expected undefined toBe X".
 */
export function expectOk(res: { status: number; body: any }): any {
  if (res.body?.code !== 0) {
    throw new Error(`API failed: ${JSON.stringify(res.body)}`);
  }
  return res.body.data;
}

/** Create a property for the given landlord. Returns propertyId. */
export async function createProperty(
  app: INestApplication,
  auth: () => { Authorization: string },
  overrides: Partial<{ name: string; address: string }> = {},
): Promise<number> {
  const res = await apiCall(app, 'post', '/api/properties', auth, {
    name: `房源-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    address: '测试地址',
    ...overrides,
  });
  const data = expectOk(res);
  if (!data?.id) throw new Error(`createProperty returned no id: ${JSON.stringify(res.body)}`);
  return data.id;
}

/** Create a room under a property. Returns roomId. */
export async function createRoom(
  app: INestApplication,
  auth: () => { Authorization: string },
  propertyId: number,
  overrides: Partial<{ name: string; rent: number; status: number }> = {},
): Promise<number> {
  const res = await apiCall(app, 'post', `/api/properties/${propertyId}/rooms`, auth, {
    name: `房间-${Math.random().toString(36).slice(2,6)}`,
    rent: 2000,
    ...overrides,
  });
  const data = expectOk(res);
  if (!data?.id) throw new Error(`createRoom returned no id: ${JSON.stringify(res.body)}`);
  return data.id;
}

/** Create a tenant for the given room. Returns tenantId. */
export async function createTenant(
  app: INestApplication,
  auth: () => { Authorization: string },
  roomId: number,
  overrides: Partial<{
    name: string; phone: string; moveInDate: string;
    rentDay: number; payMonths: number; deposit: number;
    initialPaymentMethod: string; initialPaymentDate: string; initialPaymentAmount: number; initialDepositAmount: number;
    feeItems: Array<Record<string, unknown>>;
    moveInReading: string;
  }> = {},
): Promise<number> {
  const defaults = {
    name: `租客-${Math.random().toString(36).slice(2,6)}`,
    phone: '13800000000',
    moveInDate: '2026-01-01',
    rentDay: 1,
    payMonths: 1,
  };
  const res = await apiCall(app, 'post', `/api/rooms/${roomId}/tenant`, auth, {
    ...defaults,
    ...overrides,
  });
  const data = expectOk(res);
  if (!data?.id) throw new Error(`createTenant returned no id: ${JSON.stringify(res.body)}`);
  return data.id;
}

/** Create a manual bill for the given room. Returns billId. */
export async function createBill(
  app: INestApplication,
  auth: () => { Authorization: string },
  roomId: number,
  overrides: Partial<{ period: string; items: any[]; tenantId: number; totalAmount: number }> = {},
): Promise<number> {
  const defaults = {
    period: '2026-01',
    items: [{ feeName: '房租', amount: 2000 }],
    totalAmount: 2000,
  };
  const res = await apiCall(app, 'post', `/api/rooms/${roomId}/bills`, auth, {
    ...defaults,
    ...overrides,
  });
  const data = expectOk(res);
  if (!data?.id) throw new Error(`createBill returned no id: ${JSON.stringify(res.body)}`);
  return data.id;
}

/** Get current YYYY-MM for "this month" computations in stats tests. */
export function currentMonthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
