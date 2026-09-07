export type UserRole = 'CUSTOMER' | 'BUSINESS' | 'ADMIN';
export type LeadStatus = 'NEW' | 'VIEWED' | 'QUOTED' | 'ACCEPTED' | 'REJECTED' | 'COMPLETED';
export type QuoteStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
export type QuestionType = 'TEXT' | 'NUMBER' | 'SELECT' | 'MULTISELECT' | 'BOOLEAN' | 'DATE';
export type ServiceRequestStatus = 'OPEN' | 'MATCHED' | 'EXPIRED' | 'CANCELLED' | 'FULFILLED';

export interface User {
  id: string; phone: string; name: string; avatarUrl?: string; role: UserRole;
  business?: { id: string; name: string; slug: string; status: string; isVerified: boolean };
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  description?: string;
  parentId?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  _count?: { businesses: number };
}

export interface SubCategory {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryQuestion {
  id: string;
  categoryId: string;
  subCategoryId?: string;
  key: string;
  label: string;
  type: QuestionType;
  options?: unknown;
  isRequired: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ServiceRequestLead {
  id: string;
  businessId: string;
  status: LeadStatus;
  isUnlocked: boolean;
}

export interface ServiceRequest {
  id: string;
  customerId: string;
  categoryId: string;
  subCategoryId: string;
  message: string;
  jobAddress?: string;
  jobDate?: string;
  budget?: number;
  answers?: Record<string, unknown>;
  status: ServiceRequestStatus;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  // Present on getMine()/getById() responses
  category?: Pick<Category, 'id' | 'name' | 'slug'>;
  subCategory?: Pick<SubCategory, 'id' | 'name' | 'slug'>;
  // Present on getMine() only
  leads?: ServiceRequestLead[];
}

export interface Business {
  id: string; name: string; slug: string; description?: string;
  category: { name: string; slug: string; icon?: string };
  suburb?: string; city: string; lat?: number; lng?: number;
  phone?: string; whatsapp?: string;
  logoUrl?: string; photos: string[];
  ratingAvg: number; reviewCount: number;
  isVerified: boolean; isSponsored: boolean;
  priceMin?: number; priceMax?: number;
  distanceKm?: number;
  services: Service[];
}

export interface Service {
  id: string; title: string; description?: string; priceMin?: number; priceMax?: number;
}

export interface Lead {
  id: string; status: LeadStatus; message: string;
  jobAddress?: string; jobDate?: string; budget?: number;
  business: Pick<Business, 'id' | 'name' | 'slug' | 'logoUrl'>;
  quotes: Quote[];
  createdAt: string;
}

export interface Quote {
  id: string; amount: number; description: string;
  validUntil: string; status: QuoteStatus;
}

export interface Review {
  id: string; rating: number; comment?: string; reply?: string;
  isVerified: boolean;
  customer: { name: string; avatarUrl?: string };
  createdAt: string;
}

export interface SearchMeta {
  total: number; page: number; limit: number; totalPages: number; hasMore: boolean;
}
