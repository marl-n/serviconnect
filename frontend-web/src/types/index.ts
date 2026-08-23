export interface User {
  id: string;
  phone: string;
  email?: string;
  name: string;
  avatarUrl?: string;
  role: 'CUSTOMER' | 'BUSINESS' | 'ADMIN';
  business?: BusinessSummary;
}

export interface BusinessSummary {
  id: string;
  name: string;
  slug: string;
  status: string;
  isVerified: boolean;
}

export interface Business {
  id: string;
  name: string;
  slug: string;
  description?: string;
  category: Category;
  suburb?: string;
  city: string;
  logoUrl?: string;
  coverUrl?: string;
  photos: string[];
  ratingAvg: number;
  reviewCount: number;
  isVerified: boolean;
  priceMin?: number;
  priceMax?: number;
  phone?: string;
  whatsapp?: string;
  services: Service[];
  distanceKm?: number;
  isSponsored?: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
}

export interface Service {
  id: string;
  title: string;
  description?: string;
  priceMin?: number;
  priceMax?: number;
}

export interface Lead {
  id: string;
  status: 'NEW' | 'VIEWED' | 'QUOTED' | 'ACCEPTED' | 'REJECTED' | 'COMPLETED';
  message: string;
  jobAddress?: string;
  jobDate?: string;
  budget?: number;
  business: BusinessSummary;
  quotes: Quote[];
  createdAt: string;
}

export interface Quote {
  id: string;
  amount: number;
  description: string;
  validUntil: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
}

export interface Review {
  id: string;
  rating: number;
  comment?: string;
  reply?: string;
  isVerified: boolean;
  customer: { name: string; avatarUrl?: string };
  createdAt: string;
}

export interface SearchResult {
  data: Business[];
  meta: { total: number; page: number; limit: number; totalPages: number; hasMore: boolean };
}
