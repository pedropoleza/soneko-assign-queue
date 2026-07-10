export type QrCode = {
  id: string;
  slug: string;
  target_url: string;
  name: string;
  is_active: boolean;
  origin: string;
  created_at: string;
  updated_at: string;
  // present in list responses
  scans?: number;
  scans_7d?: number;
  last_scan_at?: string | null;
};

export type SlugCheck = {
  slug: string;
  available: boolean;
  reason: 'invalid_format' | 'reserved' | 'taken' | null;
};

export type Analytics = {
  qr: QrCode;
  days: number;
  total: number;
  in_range: number;
  unique_visitors: number;
  last_scan_at: string | null;
  by_day: Array<{ day: string; count: number }>;
  top_countries: Array<{ country: string; count: number }>;
  top_cities: Array<{ city: string; count: number }>;
};

export type Overview = {
  days: number;
  total_qrs: number;
  active_qrs: number;
  total_scans: number;
  scans_in_range: number;
  unique_in_range: number;
  by_day: Array<{ day: string; count: number }>;
  top: Array<{ id: string; slug: string; name: string; is_active: boolean; scans: number }>;
};

export type CreateInput = { slug: string; target_url: string; name: string; origin?: string };
export type UpdateInput = Partial<{
  slug: string;
  target_url: string;
  name: string;
  is_active: boolean;
  origin: string;
}>;
