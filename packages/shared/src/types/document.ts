export enum DocumentType {
  CONTRACT = 0,
  DEPOSIT_RECEIPT = 1,
  RENT_RECEIPT = 2,
  UTILITY = 3,
  MAINTENANCE = 4,
  OTHER = 5,
}

export interface Document {
  id: number;
  roomId: number;
  type: DocumentType;
  name: string;
  imageUrl: string;
  note?: string;
  uploadedAt: string;
}

export interface UploadDocumentDTO {
  type: DocumentType;
  name: string;
  imageUrl: string;
  note?: string;
}
