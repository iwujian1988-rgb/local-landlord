export enum RoomStatus {
  VACANT = 0,
  RENTED = 1,
}

export type RoomDisplayStatus = 'vacant' | 'rented' | 'pending_rent' | 'overdue' | 'expiring_soon';

export interface Room {
  id: number;
  propertyId: number;
  name: string;
  rent: number;
  status: RoomStatus;
  availableDate?: string;
  deposit?: number;
  area?: string;
  floor?: string;
  orientation?: string;
  facilities?: string[];
  images?: string[];
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoomDetail extends Room {
  property: { id: number; name: string };
  tenant: Tenant | null;
  feeItems: FeeItem[];
  latestBill: Bill | null;
  monthlyTotal: number;
}

import type { Tenant } from './tenant';
import type { FeeItem } from './fee';
import type { Bill } from './bill';

export interface CreateRoomDTO {
  name: string;
  rent: number;
  deposit?: number;
  area?: string;
  floor?: string;
  orientation?: string;
  facilities?: string[];
  images?: string[];
  note?: string;
}

export interface UpdateRoomDTO extends Partial<CreateRoomDTO> {}
