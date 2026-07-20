/**
 * Runs BEFORE any module imports — switches the e2e suite to MySQL.
 *
 * This mirrors setup-env.ts but sets DB_TYPE=mysql pointing at the docker
 * compose service (see docker-compose.e2e-mysql.yml).
 *
 * If MySQL isn't running, the suite fails fast with a clear error so the
 * developer knows to start the container.
 */

process.env.ADMIN_DEFAULT_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || 'admin123';
process.env.DISABLE_THROTTLE = '1';
process.env.NODE_ENV = 'development'; // NOT 'production' — synchronize=true needed

// Use MySQL instead of sqljs. DSN matches docker-compose.e2e-mysql.yml.
process.env.DB_TYPE = 'mysql';
process.env.DB_HOST = process.env.DB_HOST || '127.0.0.1';
process.env.DB_PORT = process.env.DB_PORT || '13306';
process.env.DB_USERNAME = process.env.DB_USERNAME || 'e2e';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'e2e-pwd';
process.env.DB_DATABASE = process.env.DB_DATABASE || 'local_landlord_e2e';

// JWT_SECRET — dev default so AppModule's JwtModule factory doesn't throw.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'e2e-test-secret';
