export const API_BASE_URL = API_BASE || 'https://local-landlord-265509-4-1439465517.sh.run.tcloudbase.com/api';
export const CLOUD_ENV_ID = APP_CLOUD_ENV_ID || 'prod-d6gpmvmbod40b5928';
export const CLOUD_SVC = APP_CLOUD_SVC || 'local-landlord';
export const WX_TEMPLATE_RENT = 'siY2jHZxVvfJmZgnrLEzkfYmc8FWt8DFlsdfAIvPGcM';
export const WX_TEMPLATE_OVERDUE = 'siY2jHZxVvfJmZgnrLEzkfYmc8FWt8DFlsdfAIvPGcM';

export const USE_CLOUD = !!APP_USE_CLOUD;

// Host portion of API_BASE_URL — used to prefix host-relative upload URLs
// (/uploads/xxx.png) returned by the backend. Stripping the trailing /api
// keeps the same host on both dev (http://127.0.0.1:3100) and prod.
export const ASSET_BASE_URL = API_BASE_URL.replace(/\/api$/, '');

function isPrivateLocalHost(hostname: string): boolean {
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname.startsWith('192.168.')
    || hostname.startsWith('10.')
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);
}

// Normalize old locally-stored absolute upload URLs. Some records were saved as
// http://127.0.0.1:3000/uploads/xxx.png or http://127.0.0.1:3100/uploads/xxx.png.
// Keep only the stable path so the current API host can be used at render time.
export function normalizeUploadUrlForStorage(url: string | undefined | null): string {
  if (!url) return '';
  const match = url.match(/^https?:\/\/([^/:?#]+)(?::\d+)?(\/uploads\/[^?#]*)(\?[^#]*)?/i);
  if (match && isPrivateLocalHost(match[1])) {
    return `${match[2]}${match[3] || ''}`;
  }
  return url;
}

// If an upload URL is host-relative (starts with /), prepend ASSET_BASE_URL.
// Old local absolute /uploads URLs are rewritten to the current host first.
// External URLs (for example COS/CDN URLs) are returned untouched.
export function resolveAsset(url: string | undefined | null): string {
  if (!url) return '';
  const normalized = normalizeUploadUrlForStorage(url);
  if (/^https?:\/\//.test(normalized)) return normalized;
  if (normalized.startsWith('/')) return `${ASSET_BASE_URL}${normalized}`;
  return normalized;
}

// Base URL for the H5 bill page. The miniapp's share-webview container loads
// this inside WeChat so tenants can long-press the QR code to pay. Switch on
// NODE_ENV so dev runs against localhost instead of the prod cloud-hosted domain.
export const H5_BASE_URL = (() => {
  if (APP_H5_BASE) return APP_H5_BASE;
  const env = process.env.NODE_ENV || 'production';
  if (env === 'development') return 'http://localhost:3000/h5';
  return 'https://prod-d6gpmvmbod40b5928.sh.run.tcloudbaseapp.com/h5';
})();
