declare const API_BASE: string;

export const API_BASE_URL = API_BASE || 'http://192.168.3.84:3000/api';
export const CLOUD_ENV_ID = 'prod-d6gpmvmbod40b5928';
export const WX_TEMPLATE_RENT = 'siY2jHZxVvfJmZgnrLEzkfYmc8FWt8DFlsdfAIvPGcM';
export const WX_TEMPLATE_OVERDUE = 'siY2jHZxVvfJmZgnrLEzkfYmc8FWt8DFlsdfAIvPGcM';

// Whether to use wx.cloud.callContainer instead of Taro.request
export const USE_CLOUD = process.env.NODE_ENV === 'production';
