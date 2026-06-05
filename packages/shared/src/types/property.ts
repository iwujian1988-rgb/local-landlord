export interface Property {
  id: number;
  landlordId: number;
  name: string;
  address?: string;
  coverImage?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
  // 聚合字段
  roomCount?: number;
  rentedCount?: number;
  vacantCount?: number;
  overdueCount?: number;
  monthlyExpected?: number;
}

export interface CreatePropertyDTO {
  name: string;
  address?: string;
  coverImage?: string;
  note?: string;
}

export interface UpdatePropertyDTO {
  name?: string;
  address?: string;
  coverImage?: string;
  note?: string;
}
