export enum AdminRole {
  SUPER_ADMIN = 0,
  OPERATOR = 1,
}

export interface Admin {
  id: number;
  username: string;
  name: string;
  role: AdminRole;
  status: 0 | 1;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminLoginDTO {
  username: string;
  password: string;
}

export interface CreateAdminDTO {
  username: string;
  password: string;
  name: string;
  role?: AdminRole;
}
