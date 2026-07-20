/**
 * Minimal Taro mock. Real @tarojs/taro is a 1MB native-binding bundle that
 * can't run under node — we expose only the surface our pure-logic tests use.
 *
 * Tests that need to assert specific call sequences override these via
 * `jest.spyOn` from inside the test body.
 */
type StorageMap = Record<string, any>;

const memoryStorage: StorageMap = {};

const Taro = {
  storage: memoryStorage,

  getStorageSync(key: string): any {
    return memoryStorage[key] ?? '';
  },
  setStorageSync(key: string, value: any): void {
    memoryStorage[key] = value;
  },
  removeStorageSync(key: string): void {
    delete memoryStorage[key];
  },
  clearStorageSync(): void {
    for (const k of Object.keys(memoryStorage)) delete memoryStorage[k];
  },

  showToast: jest.fn(),
  showModal: jest.fn(),
  showActionSheet: jest.fn(),
  setClipboardData: jest.fn(),
  navigateTo: jest.fn(),
  navigateBack: jest.fn(),
  reLaunch: jest.fn(),
  redirectTo: jest.fn(),

  request: jest.fn(),
  login: jest.fn(),
  checkSession: jest.fn(),

  chooseMedia: jest.fn(),
  chooseImage: jest.fn(),
};

export default Taro;
