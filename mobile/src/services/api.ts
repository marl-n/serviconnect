import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'sc_token';

export const api = axios.create({
 baseURL: 'http://192.168.0.127:3000/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const authApi = {
  sendOtp: (phone: string) => api.post('/auth/otp/send', { phone }),
  verifyOtp: (phone: string, code: string, role?: string, name?: string) =>
    api.post('/auth/otp/verify', { phone, code, role, name }),
  getMe: () => api.get('/auth/me'),
};

export const searchApi = {
  search: (params: Record<string, any>) => api.get('/search', { params }),
  categories: () => api.get('/search/categories'),
  autocomplete: (q: string) => api.get('/search/autocomplete', { params: { q } }),
};

export const businessApi = {
  getBySlug: (slug: string) => api.get(`/businesses/${slug}`),
  getMyBusiness: () => api.get('/businesses/me/profile'),
  getDashboard: () => api.get('/businesses/me/dashboard'),
  create: (data: any) => api.post('/businesses', data),
  update: (id: string, data: any) => api.patch(`/businesses/${id}`, data),
};

export const leadsApi = {
  createLead: (data: any) => api.post('/leads', data),
  getMyLeads: () => api.get('/leads/my'),
  getLeadById: (id: string) => api.get(`/leads/${id}`),
  getBusinessLeads: (bizId: string, status?: string) =>
    api.get(`/leads/business/${bizId}`, { params: { status } }),
  sendQuote: (leadId: string, data: any) => api.post(`/leads/${leadId}/quote`, data),
  acceptQuote: (quoteId: string) => api.post(`/leads/quotes/${quoteId}/accept`),
  updateStatus: (leadId: string, status: string) =>
    api.patch(`/leads/${leadId}/status`, { status }),
};

export const reviewsApi = {
  getBusinessReviews: (bizId: string) => api.get(`/reviews/business/${bizId}`),
  createReview: (data: any) => api.post('/reviews', data),
};

export async function saveToken(token: string) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}


