export type SalesRep = {
  id: string;
  ghl_user_id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  position: number;
  active: boolean;
  weight: number;
  vacation_start: string | null;
  vacation_end: string | null;
  working_hours_start: string | null;
  working_hours_end: string | null;
  timezone: string;
  available: boolean;
  recent_leads: number;
  fair_score: number;
  last_assigned_at: string | null;
  tag_rules: string[];
};

export type RecentChip = {
  id: string;
  rep_name: string | null;
  contact_name: string | null;
  created_at: string;
  was_skipped: boolean;
};

export type Assignment = {
  id: string;
  ghl_contact_id: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_source: string | null;
  contact_tags: string[] | null;
  assigned_rep_id: string | null;
  was_skipped: boolean;
  skipped_from_rep_id: string | null;
  ghl_sync_status: 'pending' | 'synced' | 'failed';
  ghl_sync_error: string | null;
  sync_attempts: number;
  last_sync_attempt_at: string | null;
  created_at: string;
  rep_name: string | null;
  rep_avatar: string | null;
};

export type Queue = {
  current_position: number;
  last_assigned_rep_id: string | null;
  last_assigned_at: string | null;
  current_rep_picks_used: number;
} | null;

export type AppState = {
  location: { id: string; ghl_location_id: string; name: string };
  reps: SalesRep[];
  queue: Queue;
  next_rep: SalesRep | null;
  assignments: Assignment[];
  recent_chips: RecentChip[];
  stats: {
    total_assignments: number;
    total_skipped: number;
    total_failed: number;
    active_reps: number;
    available_reps: number;
    monthly_by_rep: Record<string, number>;
    previous_monthly_by_rep: Record<string, number>;
    last_webhook_at: string | null;
    window_days: number;
  };
};

export type TagRule = {
  id: string;
  tag: string;
  rep_id: string;
  rep_name: string;
  priority: number;
};

export type DistributionPoint = { day: string; count: number };
export type DistributionByRep = {
  rep_id: string;
  rep_name: string;
  day_count: number;
  days: DistributionPoint[];
};
