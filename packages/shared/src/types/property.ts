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

/** Admin-only variant: the admin backend needs to specify landlordId in the
 *  body because there's no JWT-derived landlord context (unlike the landlord
 *  API which gets landlordId from the token). */
export interface CreateAdminPropertyDTO extends CreatePropertyDTO {
  landlordId: number;
}

export interface UpdatePropertyDTO {
  name?: string;
  address?: string;
  coverImage?: string;
  note?: string;
}
