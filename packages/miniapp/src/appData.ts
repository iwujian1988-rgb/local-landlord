import { getAppData as storageGetAppData, setAppData as storageSetAppData } from './utils/storage';

export interface FeeSetting {
  name: string;
  type: 'fixed' | 'manual';
  amount: string;
  enabled: boolean;
  isRent: boolean;
}

export interface AppData {
  feeSettings: FeeSetting[];
}

export function getFeeConfig(): AppData {
  const appData = storageGetAppData();
  if (!appData.billSettings || !appData.billSettings.feeSettings) {
    return { feeSettings: [] };
  }
  return { feeSettings: appData.billSettings.feeSettings };
}

export function setFeeConfig(data: Partial<AppData>): AppData {
  const appData = storageGetAppData();
  appData.billSettings = appData.billSettings || {};
  appData.billSettings.feeSettings = data.feeSettings || appData.billSettings.feeSettings || [];
  storageSetAppData(appData);
  return { feeSettings: appData.billSettings.feeSettings };
}
