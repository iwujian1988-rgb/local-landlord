export enum TenantStatus {
  MOVED_OUT = 0,
  ACTIVE = 1,
}

export interface Tenant {
  id: number;
  roomId: number;
  name: string;
  phone: string;
  moveInDate: string;
  contractEndDate: string;
  rentDay: number;
  deposit?: number;
  note?: string;
  status: TenantStatus;
  moveOutDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTenantDTO {
  name: string;
  phone: string;
  moveInDate: string;
  contractEndDate: string;
  rentDay: number;
  deposit?: number;
  note?: string;
}

/** Admin-only variant: admin backend takes roomId from the body, while the
 *  landlord API takes it from the URL path. */
export interface CreateAdminTenantDTO extends CreateTenantDTO {
  roomId: number;
}

export interface UpdateTenantDTO {
  name?: string;
  phone?: string;
  contractEndDate?: string;
  rentDay?: number;
  note?: string;
}
