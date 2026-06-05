/** 云开发环境配置 */
export const CLOUD_ENV_ID = process.env.TARO_APP_CLOUD_ENV_ID || 'your-env-id';

/** Server API 地址 */
export const API_BASE = process.env.TARO_APP_API_BASE || 'http://localhost:3000';

/** 云开发环境配置 */
export const CLOUD_CONFIG = {
  env: CLOUD_ENV_ID,
  // 跟踪用户访问，用于云函数中获取用户身份
  traceUser: true,
};
