import request from './request';
import type {
  Property,
  CreateAdminPropertyDTO,
  UpdatePropertyDTO,
  Room,
  CreateRoomDTO,
  UpdateRoomDTO,
  Tenant,
  CreateAdminTenantDTO,
  UpdateTenantDTO,
  Bill,
  ConfirmPaymentDTO,
  Landlord,
  UpdateLandlordDTO,
  Admin,
  CreateAdminDTO,
  ApiResponse,
  PaginatedData,
  UploadAdminDocumentDTO,
  Document,
} from '@local-landlord/shared';

/** Unwrap the standard API response envelope */
function unwrap<T>(promise: Promise<any>): Promise<T> {
  return promise.then((res: ApiResponse<T>) => res.data);
}

/** Unwrap a paginated API response */
function unwrapPaginated<T>(promise: Promise<any>): Promise<PaginatedData<T>> {
  return promise.then((res: ApiResponse<PaginatedData<T>>) => res.data);
}

/** Unwrap any API response (used when the shape is flexible) */
function unwrapAny(promise: Promise<any>): Promise<any> {
  return promise.then((res) => (res as any).data);
}

/** Unified API error handling */
const handleApiError = (error: any): never => {
  const message = error?.response?.data?.message || error?.message || '网络请求失败，请稍后重试';
  console.error('[Admin API Error]', message, error);
  throw error;
};

export const propertyApi = {
  list: (params?: Record<string, unknown>): Promise<PaginatedData<Property>> =>
    unwrapPaginated(request.get('/admin/properties', { params }).catch(handleApiError)),
  detail: (id: number): Promise<Property> =>
    unwrap(request.get(`/admin/properties/${id}`).catch(handleApiError)),
  create: (data: CreateAdminPropertyDTO): Promise<Property> =>
    unwrap(request.post('/admin/properties', data).catch(handleApiError)),
  update: (id: number, data: UpdatePropertyDTO): Promise<Property> =>
    unwrap(request.put(`/admin/properties/${id}`, data).catch(handleApiError)),
  remove: (id: number): Promise<void> =>
    unwrap(request.delete(`/admin/properties/${id}`).catch(handleApiError)),
};

export const roomApi = {
  list: (params?: Record<string, unknown>): Promise<PaginatedData<Room>> =>
    unwrapPaginated(request.get('/admin/rooms', { params }).catch(handleApiError)),
  detail: (id: number): Promise<Room> =>
    unwrap(request.get(`/admin/rooms/${id}`).catch(handleApiError)),
  create: (data: CreateRoomDTO): Promise<Room> =>
    unwrap(request.post('/admin/rooms', data).catch(handleApiError)),
  update: (id: number, data: UpdateRoomDTO): Promise<Room> =>
    unwrap(request.put(`/admin/rooms/${id}`, data).catch(handleApiError)),
  updateStatus: (id: number, status: number): Promise<Room> =>
    unwrap(request.put(`/admin/rooms/${id}/status`, { status }).catch(handleApiError)),
  remove: (id: number): Promise<void> =>
    unwrap(request.delete(`/admin/rooms/${id}`).catch(handleApiError)),
};

export const tenantApi = {
  list: (params?: Record<string, unknown>): Promise<PaginatedData<Tenant>> =>
    unwrapPaginated(request.get('/admin/tenants', { params }).catch(handleApiError)),
  detail: (id: number): Promise<Tenant> =>
    unwrap(request.get(`/admin/tenants/${id}`).catch(handleApiError)),
  create: (data: CreateAdminTenantDTO): Promise<Tenant> =>
    unwrap(request.post('/admin/tenants', data).catch(handleApiError)),
  update: (id: number, data: UpdateTenantDTO): Promise<Tenant> =>
    unwrap(request.put(`/admin/tenants/${id}`, data).catch(handleApiError)),
  moveOut: (id: number, data: { moveOutDate: string }): Promise<Tenant> =>
    unwrap(request.put(`/admin/tenants/${id}/move-out`, data).catch(handleApiError)),
  remove: (id: number): Promise<void> =>
    unwrap(request.delete(`/admin/tenants/${id}`).catch(handleApiError)),
};

export const billApi = {
  list: (params?: Record<string, unknown>): Promise<PaginatedData<Bill>> =>
    unwrapPaginated(request.get('/admin/bills', { params }).catch(handleApiError)),
  confirm: (id: number, data: ConfirmPaymentDTO): Promise<Bill> =>
    unwrap(request.put(`/admin/bills/${id}/confirm`, data).catch(handleApiError)),
  batchConfirm: (ids: number[], data?: ConfirmPaymentDTO): Promise<void> =>
    unwrap(request.post('/admin/bills/batch-confirm', { ids, ...data }).catch(handleApiError)),
  batchRemind: (ids: number[]): Promise<void> =>
    unwrap(request.post('/admin/bills/batch-remind', { ids }).catch(handleApiError)),
  overdue: (params?: Record<string, unknown>): Promise<PaginatedData<Bill>> =>
    unwrapPaginated(request.get('/admin/bills/overdue', { params }).catch(handleApiError)),
};

export const contractApi = {
  list: (params?: Record<string, unknown>): Promise<PaginatedData<Document>> =>
    unwrapPaginated(request.get('/admin/contracts', { params }).catch(handleApiError)),
  upload: (data: UploadAdminDocumentDTO): Promise<Document> =>
    unwrap(request.post('/admin/contracts/upload', data).catch(handleApiError)),
  remove: (id: number): Promise<void> =>
    unwrap(request.delete(`/admin/contracts/${id}`).catch(handleApiError)),
};

export const adminApi = {
  list: (params?: Record<string, unknown>): Promise<PaginatedData<Admin>> =>
    unwrapPaginated(request.get('/admin/admins', { params }).catch(handleApiError)),
  create: (data: CreateAdminDTO): Promise<Admin> =>
    unwrap(request.post('/admin/admins', data).catch(handleApiError)),
  update: (id: number, data: Partial<CreateAdminDTO>): Promise<Admin> =>
    unwrap(request.put(`/admin/admins/${id}`, data).catch(handleApiError)),
  resetPassword: (id: number, password: string): Promise<void> =>
    unwrap(request.put(`/admin/admins/${id}/reset-password`, { password }).catch(handleApiError)),
};

export const landlordApi = {
  list: (params?: Record<string, unknown>): Promise<PaginatedData<Landlord>> =>
    unwrapPaginated(request.get('/admin/landlords', { params }).catch(handleApiError)),
  detail: (id: number): Promise<Landlord> =>
    unwrap(request.get(`/admin/landlords/${id}`).catch(handleApiError)),
  create: (data: Partial<Landlord>): Promise<Landlord> =>
    unwrap(request.post('/admin/landlords', data).catch(handleApiError)),
  update: (id: number, data: UpdateLandlordDTO): Promise<Landlord> =>
    unwrap(request.put(`/admin/landlords/${id}`, data).catch(handleApiError)),
  updateStatus: (id: number, status: number): Promise<Landlord> =>
    unwrap(request.put(`/admin/landlords/${id}/status`, { status }).catch(handleApiError)),
};

// Stats and dashboard responses have dynamic shapes, so we use unknown-based returns
export const statsApi = {
  getRentStats: (params?: Record<string, unknown>): Promise<Record<string, unknown>> =>
    unwrapAny(request.get('/admin/stats/rent', { params }).catch(handleApiError)),
  getOccupancyStats: (params?: Record<string, unknown>): Promise<Record<string, unknown>> =>
    unwrapAny(request.get('/admin/stats/occupancy', { params }).catch(handleApiError)),
  getLandlordActivity: (params?: Record<string, unknown>): Promise<Record<string, unknown>> =>
    unwrapAny(request.get('/admin/stats/activity', { params }).catch(handleApiError)),
};

export const dashboardApi = {
  getSummary: (): Promise<Record<string, unknown>> =>
    unwrapAny(request.get('/admin/dashboard/summary').catch(handleApiError)),
};

export const settingsApi = {
  getNotifications: (): Promise<Record<string, unknown>> =>
    unwrapAny(request.get('/admin/settings/notifications').catch(handleApiError)),
  updateNotifications: (data: Record<string, unknown>): Promise<void> =>
    unwrap(request.put('/admin/settings/notifications', data).catch(handleApiError)),
  getParams: (): Promise<Record<string, unknown>> =>
    unwrapAny(request.get('/admin/settings/params').catch(handleApiError)),
  updateParams: (data: Record<string, unknown>): Promise<void> =>
    unwrap(request.put('/admin/settings/params', data).catch(handleApiError)),
};
