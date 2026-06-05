export enum FeeType {
  FIXED = 0,
  MANUAL = 1,
}

export interface FeeItem {
  id: number;
  roomId: number;
  name: string;
  type: FeeType;
  amount?: number;
  enabled: boolean;
  isRent: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFeeItemDTO {
  name: string;
  type: FeeType;
  amount?: number;
  enabled?: boolean;
}

export interface UpdateFeeItemDTO {
  name?: string;
  type?: FeeType;
  amount?: number;
  enabled?: boolean;
  sortOrder?: number;
}
