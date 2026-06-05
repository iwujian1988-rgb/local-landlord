export interface Landlord {
  id: number;
  openId: string;
  unionId?: string;
  name: string;
  phone: string;
  avatar?: string;
  defaultPayeeName?: string;
  paymentNote?: string;
  maxProperties: number;
  status: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateLandlordDTO {
  name?: string;
  phone?: string;
  avatar?: string;
  defaultPayeeName?: string;
  paymentNote?: string;
  maxProperties?: number;
  status?: number;
}
