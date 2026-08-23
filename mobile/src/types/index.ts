export type UserRole = 'CUSTOMER' | 'BUSINESS' | 'ADMIN';
export type LeadStatus = 'NEW' | 'VIEWED' | 'QUOTED' | 'ACCEPTED' | 'REJECTED' | 'COMPLETED';
export type QuoteStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

export interface User {
  id: string; phone: string; name: string; avatarUrl?: string; role: UserRole;
  business?: { id: string; name: string; slug: string; status: string; isVerified: boolean };
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
