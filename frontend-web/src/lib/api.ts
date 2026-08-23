import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token from localStorage on every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('sc_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('sc_token');
      window.location.href = '/auth/login';
    }
    return Promise.reject(err);
  },
);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  sendOtp: (phone: string) => api.post('/auth/otp/send', { phone }),
  verifyOtp: (phone: string, code: string, role?: string, name?: string) =>
    api.post('/auth/otp/verify', { phone, code, role, name }),
  getMe: () => api.get('/auth/me'),
};

// ─── Search ───────────────────────────────────────────────────────────────────
export const searchApi = {
  search: (params: Record<string, any>) => api.get('/search', { params }),
  categories: () => api.get('/search/categories'),
  autocomplete: (q: string) => api.get('/search/autocomplete', { params: { q } }),
};

// ─── Businesses ───────────────────────────────────────────────────────────────
export const businessApi = {
  getBySlug: (slug: string) => api.get(`/businesses/${slug}`),
  getMyBusiness: () => api.get('/businesses/me/profile'),
  getDashboard: () => api.get('/businesses/me/dashboard'),
  create: (data: any) => api.post('/businesses', data),
  update: (id: string, data: any) => api.patch(`/businesses/${id}`, data),
  submitVerification: (id: string, docs: any) => api.post(`/businesses/${id}/verify`, docs),
};

// ─── Leads ────────────────────────────────────────────────────────────────────
export const leadsApi = {
  createLead: (data: any) => api.post('/leads', data),
  getBusinessLeads: (businessId: string, status?: string) =>
    api.get(`/leads/business/${businessId}`, { params: { status } }),
  getMyLeads: () => api.get('/leads/my'),
  updateStatus: (id: string, status: string) => api.patch(`/leads/${id}/status`, { status }),
  sendQuote: (leadId: string, data: any) => api.post(`/leads/${leadId}/quote`, data),
  acceptQuote: (quoteId: string) => api.post(`/leads/quotes/${quoteId}/accept`),
};

// ─── Reviews ──────────────────────────────────────────────────────────────────
export const reviewsApi = {
  getBusinessReviews: (businessId: string, page = 1) =>
    api.get(`/reviews/business/${businessId}`, { params: { page } }),
  createReview: (data: any) => api.post('/reviews', data),
  reply: (reviewId: string, reply: string) => api.patch(`/reviews/${reviewId}/reply`, { reply }),
};
