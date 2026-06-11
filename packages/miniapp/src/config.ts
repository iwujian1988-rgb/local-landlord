declare const API_BASE: string;

export const API_BASE_URL = API_BASE || 'https://local-landlord-265509-4-1439465517.sh.run.tcloudbase.com/api';
export const CLOUD_ENV_ID = 'prod-d6gpmvmbod40b5928';
export const CLOUD_SVC = 'local-landlord';
export const WX_TEMPLATE_RENT = 'siY2jHZxVvfJmZgnrLEzkfYmc8FWt8DFlsdfAIvPGcM';
export const WX_TEMPLATE_OVERDUE = 'siY2jHZxVvfJmZgnrLEzkfYmc8FWt8DFlsdfAIvPGcM';

// Use Taro.request directly to cloud hosting URL (more reliable than callContainer)
export const USE_CLOUD = false;
