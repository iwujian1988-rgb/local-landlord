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

/** Admin-only variant: admin backend requires roomId in the body and pins
 *  type=CONTRACT server-side, so the client doesn't send `type`. */
export interface UploadAdminDocumentDTO {
  roomId: number;
  name: string;
  imageUrl: string;
  note?: string;
}
