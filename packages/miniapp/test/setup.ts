// Defines the build-time globals declared in src/global.d.ts. Jest runs
// against raw TS, so the webpack DefinePlugin step that would normally inject
// these is never run; we set sane defaults here.
(globalThis as any).API_BASE = 'https://example.test/api';
(globalThis as any).APP_USE_CLOUD = false;
(globalThis as any).APP_CLOUD_ENV_ID = 'test-env';
(globalThis as any).APP_CLOUD_SVC = 'test-svc';
(globalThis as any).APP_H5_BASE = '';
