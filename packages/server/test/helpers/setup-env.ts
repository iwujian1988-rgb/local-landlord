/**
 * Runs BEFORE any module imports — including AppModule. Critical that this
 * file is listed in jest-e2e.json setupFiles (not setupFilesAfterEnv), because
 * AppModule's @Module decorator reads these env vars at import time.
 */

// Pin admin password so loginAsAdmin can authenticate.
process.env.ADMIN_DEFAULT_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || 'admin123';

// Disable rate-limiting globally. The e2e suite logs in as a fresh landlord
// per test for isolation; the auth endpoint's @Throttle(5/min) would otherwise
// blow past the limit around test #5.
process.env.DISABLE_THROTTLE = '1';

// NODE_ENV=development triggers synchronize=true in AppModule (required so
// sqljs creates the schema). Any other value skips schema creation and tests
// fail with "no such table".
process.env.NODE_ENV = 'development';
process.env.DB_TYPE = 'sqljs';
// Allow CI/local callers to provide an isolated database per run. Reusing one
// persisted sql.js file across interrupted suites can leave a malformed test
// image and create false product failures.
process.env.DB_LOCATION = process.env.DB_LOCATION || 'data/test_e2e.sqlite';
