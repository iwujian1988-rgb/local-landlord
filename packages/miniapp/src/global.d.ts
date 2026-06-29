declare const process: {
  env: {
    NODE_ENV: string;
    TARO_APP_API_BASE?: string;
    TARO_APP_CLOUD_ENV_ID?: string;
    [key: string]: string | undefined;
  };
};

declare const API_BASE: string;
declare const APP_USE_CLOUD: boolean;
declare const APP_CLOUD_ENV_ID: string;
declare const APP_CLOUD_SVC: string;
declare const APP_H5_BASE: string;

declare const wx: any;

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.jpeg' {
  const src: string;
  export default src;
}

declare module '*.webp' {
  const src: string;
  export default src;
}

declare module '*.gif' {
  const src: string;
  export default src;
}
