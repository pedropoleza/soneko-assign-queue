export type SalesRep = {
  id: string;
  ghl_user_id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  position: number;
  active: boolean;
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
  created_at: string;
  rep_name: string | null;
  rep_avatar: string | null;
};

export type Queue = {
  current_position: number;
  last_assigned_rep_id: string | null;
  last_assigned_at: string | null;
} | null;

export type AppState = {
  location: { id: string; ghl_location_id: string; name: string };
  reps: SalesRep[];
  queue: Queue;
  next_rep: SalesRep | null;
  assignments: Assignment[];
  stats: {
    total_assignments: number;
    total_skipped: number;
    active_reps: number;
    monthly_by_rep: Record<string, number>;
  };
};
