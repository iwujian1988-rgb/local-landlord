export interface ApiResponse<T = any> {
  code: number;
  data: T;
  message: string;
}

export interface PaginatedData<T = any> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type PaginatedResponse<T = any> = ApiResponse<PaginatedData<T>>;

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export const ERROR_CODES = {
  SUCCESS: 0,
  VALIDATION_FAILED: 10001,
  UNAUTHORIZED: 10002,
  FORBIDDEN: 10003,
  NOT_FOUND: 10004,
  ALREADY_EXISTS: 10005,
  WECHAT_LOGIN_FAILED: 20001,
  ADMIN_AUTH_FAILED: 20002,
  BILL_EXISTS: 30001,
  ROOM_OCCUPIED: 30002,
  PROPERTY_LIMIT_EXCEEDED: 30003,
  UPLOAD_FAILED: 40001,
} as const;
