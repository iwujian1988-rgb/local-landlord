import request from './request';

/** 统一 API 错误处理 */
const handleApiError = (error: any): never => {
  const message = error?.response?.data?.message || error?.message || '网络请求失败，请稍后重试';
  console.error('[Admin API Error]', message, error);
  throw error;
};

export const propertyApi = {
  list: (params?: any) => request.get('/admin/properties', { params }).catch(handleApiError),
  detail: (id: number) => request.get(`/admin/properties/${id}`).catch(handleApiError),
  create: (data: any) => request.post('/admin/properties', data).catch(handleApiError),
  update: (id: number, data: any) => request.put(`/admin/properties/${id}`, data).catch(handleApiError),
  remove: (id: number) => request.delete(`/admin/properties/${id}`).catch(handleApiError),
};

export const roomApi = {
  list: (params?: any) => request.get('/admin/rooms', { params }).catch(handleApiError),
  detail: (id: number) => request.get(`/admin/rooms/${id}`).catch(handleApiError),
  create: (data: any) => request.post('/admin/rooms', data).catch(handleApiError),
  update: (id: number, data: any) => request.put(`/admin/rooms/${id}`, data).catch(handleApiError),
  updateStatus: (id: number, status: number) => request.put(`/admin/rooms/${id}/status`, { status }).catch(handleApiError),
  remove: (id: number) => request.delete(`/admin/rooms/${id}`).catch(handleApiError),
};

export const tenantApi = {
  list: (params?: any) => request.get('/admin/tenants', { params }).catch(handleApiError),
  detail: (id: number) => request.get(`/admin/tenants/${id}`).catch(handleApiError),
  create: (data: any) => request.post('/admin/tenants', data).catch(handleApiError),
  update: (id: number, data: any) => request.put(`/admin/tenants/${id}`, data).catch(handleApiError),
  moveOut: (id: number, data: any) => request.put(`/admin/tenants/${id}/move-out`, data).catch(handleApiError),
  remove: (id: number) => request.delete(`/admin/tenants/${id}`).catch(handleApiError),
};

export const billApi = {
  list: (params?: any) => request.get('/admin/bills', { params }).catch(handleApiError),
  confirm: (id: number, data: any) => request.put(`/admin/bills/${id}/confirm`, data).catch(handleApiError),
  batchConfirm: (ids: number[]) => request.post('/admin/bills/batch-confirm', { ids }).catch(handleApiError),
  batchRemind: (ids: number[]) => request.post('/admin/bills/batch-remind', { ids }).catch(handleApiError),
  overdue: (params?: any) => request.get('/admin/bills/overdue', { params }).catch(handleApiError),
};

export const contractApi = {
  list: (params?: any) => request.get('/admin/contracts', { params }).catch(handleApiError),
  upload: (data: { roomId: number; name: string; imageUrl: string; note?: string }) => request.post('/admin/contracts/upload', data).catch(handleApiError),
  remove: (id: number) => request.delete(`/admin/contracts/${id}`).catch(handleApiError),
};

export const adminApi = {
  list: (params?: any) => request.get('/admin/admins', { params }).catch(handleApiError),
  create: (data: any) => request.post('/admin/admins', data).catch(handleApiError),
  update: (id: number, data: any) => request.put(`/admin/admins/${id}`, data).catch(handleApiError),
  resetPassword: (id: number, password: string) => request.put(`/admin/admins/${id}/reset-password`, { password }).catch(handleApiError),
};

export const landlordApi = {
  list: (params?: any) => request.get('/admin/landlords', { params }).catch(handleApiError),
  detail: (id: number) => request.get(`/admin/landlords/${id}`).catch(handleApiError),
  create: (data: any) => request.post('/admin/landlords', data).catch(handleApiError),
  update: (id: number, data: any) => request.put(`/admin/landlords/${id}`, data).catch(handleApiError),
  updateStatus: (id: number, status: number) => request.put(`/admin/landlords/${id}/status`, { status }).catch(handleApiError),
};

export const statsApi = {
  getRentStats: (params?: any) => request.get('/admin/stats/rent', { params }).catch(handleApiError),
  getOccupancyStats: (params?: any) => request.get('/admin/stats/occupancy', { params }).catch(handleApiError),
  getLandlordActivity: (params?: any) => request.get('/admin/stats/activity', { params }).catch(handleApiError),
};

export const dashboardApi = {
  getSummary: () => request.get('/admin/dashboard/summary').catch(handleApiError),
};

export const settingsApi = {
  getNotifications: () => request.get('/admin/settings/notifications').catch(handleApiError),
  updateNotifications: (data: any) => request.put('/admin/settings/notifications', data).catch(handleApiError),
  getParams: () => request.get('/admin/settings/params').catch(handleApiError),
  updateParams: (data: any) => request.put('/admin/settings/params', data).catch(handleApiError),
};
