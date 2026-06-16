import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { TransformInterceptor } from '../../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../../src/common/filters/http-exception.filter';
import request from 'supertest';

/**
 * Pin the default admin password for the e2e suite. AppModule reads this env on
 * first run when it auto-creates the admin account — without it, the password
 * is random and loginAsAdmin below can't authenticate.
 */
process.env.ADMIN_DEFAULT_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || 'admin123';

/**
 * Use a separate sqlite file for e2e so the dev DB isn't polluted.
 * NODE_ENV must be "development" — AppModule ties `synchronize` to that value,
 * and any other value (e.g. "test") skips schema creation, leaving us with an
 * empty in-memory database and "no such table" errors from SeedService.
 */
process.env.NODE_ENV = 'development';
process.env.DB_TYPE = 'sqljs';
process.env.DB_LOCATION = 'data/test_e2e.sqlite';

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
export async function loginAsLandlord(app: INestApplication, devCode = `dev_e2e_${Date.now()}`): Promise<() => { Authorization: string }> {
  const res = await request(app.getHttpServer())
    .post('/api/auth/wechat/login')
    .send({ code: devCode });
  if (!res.body?.data?.token) {
    throw new Error(`landlord login failed: ${JSON.stringify(res.body)}`);
  }
  const token: string = res.body.data.token;
  return () => ({ Authorization: `Bearer ${token}` });
}
