declare const process: {
  env: {
    NODE_ENV: string;
    TARO_APP_API_BASE?: string;
    TARO_APP_CLOUD_ENV_ID?: string;
    [key: string]: string | undefined;
  };
};
