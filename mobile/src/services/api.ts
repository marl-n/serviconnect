import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'sc_token';
const API_PATH = '/api/v1';

/**
 * Resolves the API base URL from EXPO_PUBLIC_API_URL (set in mobile/.env, or
 * in the EAS build environment). Accepts either the server origin
 * ("http://192.168.0.126:3000") or the full API root
 * ("http://192.168.0.126:3000/api/v1") — /api/v1 is appended only if missing.
 *
 * Expo inlines EXPO_PUBLIC_* at bundle time, so this must stay a literal
 * `process.env.EXPO_PUBLIC_API_URL` access, and changes need a Metro restart.
 */
function resolveApiBaseUrl(): string {
  const raw = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!raw) {
    throw new Error(
      'EXPO_PUBLIC_API_URL is not set. Copy mobile/.env.example to mobile/.env, set it to your ' +
        'backend (e.g. http://192.168.0.126:3000/api/v1), then restart with `npx expo start --clear`.',
    );
  }
  if (!/^https?:\/\/[^/]+/i.test(raw)) {
    throw new Error(`EXPO_PUBLIC_API_URL must be an http(s) URL, got "${raw}".`);
  }
  const base = raw.replace(/\/+$/, '');
  return base.toLowerCase().endsWith(API_PATH) ? base : `${base}${API_PATH}`;
}

export const API_BASE_URL = resolveApiBaseUrl();

/** Server origin (no /api/v1) — uploaded files are served from <origin>/uploads/. */
export const SERVER_ORIGIN = API_BASE_URL.slice(0, -API_PATH.length);

/** Turns a stored upload path ("/uploads/x.jpg") into a loadable URL. */
export const fileUrl = (path: string) => (/^https?:\/\//i.test(path) ? path : `${SERVER_ORIGIN}${path}`);

export const api = axios.create({
  baseURL: API_BASE_URL,
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
  getSubCategories: (categoryId: string) =>
    api.get(`/businesses/category/${categoryId}/subcategories`),
  setSubCategories: (bizId: string, subCategoryIds: string[]) =>
    api.post(`/businesses/${bizId}/subcategories`, { subCategoryIds }),
  getServiceAreas: (bizId: string) => api.get(`/businesses/${bizId}/service-areas`),
  setServiceAreas: (bizId: string, townIds: string[]) =>
    api.post(`/businesses/${bizId}/service-areas`, { townIds }),
};

export const creditsApi = {
  wallet: () => api.get('/credits/wallet'),
};

export const categoryQuestionsApi = {
  list: (categoryId: string, subCategoryId?: string) =>
    api.get('/category-questions', { params: { categoryId, subCategoryId } }),
};

export const serviceRequestsApi = {
  create: (data: {
    categoryId: string;
    subCategoryId: string;
    message: string;
    jobAddress?: string;
    jobDate?: string;
    budget?: number;
    answers?: Record<string, unknown>;
    townId: string;
    suburbId?: string;
    photos?: string[];
  }) => api.post('/service-requests', data),
  getMine: () => api.get('/service-requests/my'),
  getById: (id: string) => api.get(`/service-requests/${id}`),
};

export const locationsApi = {
  provinces: () => api.get('/locations/provinces'),
  towns: (provinceId: string, q?: string) => api.get('/locations/towns', { params: { provinceId, q: q || undefined } }),
  suburbs: (townId: string) => api.get('/locations/suburbs', { params: { townId } }),
};

export const uploadsApi = {
  /** Uploads one local image (an ImagePicker uri) and returns its stored path, e.g. "/uploads/123.jpg". */
  image: async (uri: string, mimeType?: string): Promise<string> => {
    const type = mimeType || (/\.png$/i.test(uri) ? 'image/png' : 'image/jpeg');
    const form = new FormData();
    form.append('file', { uri, name: `photo.${type.split('/')[1]}`, type } as any);
    const res = await api.post('/uploads/images', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    });
    return res.data.url;
  },
};

export const leadsApi = {
  createLead: (data: any) => api.post('/leads', data),
  feed: (status?: string) => api.get('/leads/feed', { params: { status } }),
  unlock: (leadId: string) => api.post(`/leads/${leadId}/unlock`),
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
  getBusinessReviews: (businessId: string, page = 1) =>
    api.get(`/reviews/business/${businessId}`, { params: { page } }),
  getMyReviews: () => api.get('/reviews/my'),
  canReview: (businessId: string) => api.get(`/reviews/can-review/${businessId}`),
  createReview: (data: { businessId: string; rating: number; comment?: string }) =>
    api.post('/reviews', data),
  replyToReview: (reviewId: string, reply: string) =>
    api.patch(`/reviews/${reviewId}/reply`, { reply }),
};

export const notificationsApi = {
  list: () => api.get('/notifications'),
  unreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id: string) => api.post(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read'),
};

export const savedApi = {
  getMySaved: () => api.get('/saved'),
  isSaved: (businessId: string) => api.get(`/saved/${businessId}/check`),
  save: (businessId: string) => api.post(`/saved/${businessId}`),
  unsave: (businessId: string) => api.delete(`/saved/${businessId}`),
};

export async function saveToken(token: string) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}


