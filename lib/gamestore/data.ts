import type { SupabaseClient } from "@supabase/supabase-js";

export type EventRow = {
  id: string;
  title: string;
  slug: string;
  cover_image_path?: string | null;
  description: string | null;
  game_type: string | null;
  starts_at: string;
  ends_at: string | null;
  capacity: number;
  price_display: string | null;
  status: "draft" | "published" | "cancelled";
  event_categories:
    | {
        name: string;
        slug: string;
      }
    | null;
};

export type EventDetailRow = EventRow & {
  created_at?: string;
  updated_at?: string;
  price_cents: number | null;
  deposit_cents: number | null;
  currency: string | null;
};

export type EventRegistrationRow = {
  id: string;
  event_id: string;
  status: "confirmed" | "waitlisted" | "cancelled" | "checked_in" | "pending_payment";
  waitlist_position: number | null;
  created_at: string;
  events:
    | {
        title: string;
        slug: string;
        starts_at: string;
      }
    | null;
};

export type PostRow = {
  id: string;
  title: string;
  slug: string;
  cover_image_path?: string | null;
  body: string | null;
  published_at: string | null;
};

export type ProfileListRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "customer" | "staff" | "admin";
  newsletter_opt_in: boolean;
  marketing_consent: boolean;
  interests: string[] | null;
};

export type AdminNoteRow = {
  id: string;
  body: string;
  created_at: string;
  subject_profile_id: string;
  author_id: string;
  subject_profile:
    | {
        email: string | null;
        full_name: string | null;
      }
    | null;
};

export type ProductRequestRow = {
  id: string;
  product_name: string;
  category: string | null;
  notes: string | null;
  status: "new" | "in_review" | "fulfilled" | "cancelled" | "awaiting_stock";
  quantity: number | null;
  desired_price: number | null;
  priority_flag?: boolean;
  expected_fulfillment_at?: string | null;
  stock_notified_at?: string | null;
  created_at: string;
};

export async function getPublishedEvents(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("events")
    .select(
      "id, title, slug, cover_image_path, description, game_type, starts_at, ends_at, capacity, price_display, status, event_categories(name, slug)",
    )
    .eq("status", "published")
    .order("starts_at", { ascending: true });

  if (error) return [];
  return ((data ?? []) as Array<
    Omit<EventRow, "event_categories"> & {
      event_categories: EventRow["event_categories"][];
    }
  >).map((event) => ({
    ...event,
    event_categories: Array.isArray(event.event_categories)
      ? (event.event_categories[0] ?? null)
      : event.event_categories,
  }));
}

export async function getUpcomingEvents(supabase: SupabaseClient, limit = 3) {
  const { data, error } = await supabase
    .from("events")
    .select(
      "id, title, slug, cover_image_path, description, game_type, starts_at, ends_at, capacity, price_display, status, event_categories(name, slug)",
    )
    .eq("status", "published")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(limit);

  if (error) return [];
  return ((data ?? []) as Array<
    Omit<EventRow, "event_categories"> & {
      event_categories: EventRow["event_categories"][];
    }
  >).map((event) => ({
    ...event,
    event_categories: Array.isArray(event.event_categories)
      ? (event.event_categories[0] ?? null)
      : event.event_categories,
  }));
}

export async function getEventBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<EventDetailRow | null> {
  const { data, error } = await supabase
    .from("events")
    .select(
      "id, title, slug, cover_image_path, description, game_type, starts_at, ends_at, capacity, price_display, price_cents, deposit_cents, currency, status, created_at, updated_at, event_categories(name, slug)",
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error || !data) return null;
  const row = data as Omit<EventDetailRow, "event_categories"> & {
    event_categories: EventDetailRow["event_categories"][];
  };

  return {
    ...row,
    event_categories: Array.isArray(row.event_categories)
      ? (row.event_categories[0] ?? null)
      : row.event_categories,
  };
}

export async function getPublishedPosts(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("posts")
    .select("id, title, slug, cover_image_path, body, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(12);

  if (error) return [];
  return (data ?? []) as PostRow[];
}

export async function getRecentPosts(supabase: SupabaseClient, limit = 3) {
  const { data, error } = await supabase
    .from("posts")
    .select("id, title, slug, cover_image_path, body, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) return [];
  return (data ?? []) as PostRow[];
}

export async function getPostBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<PostRow | null> {
  const { data, error } = await supabase
    .from("posts")
    .select("id, title, slug, cover_image_path, body, published_at")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error || !data) return null;
  return data as PostRow;
}

export async function getUserRegistrations(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("event_registrations")
    .select("id, event_id, status, waitlist_position, created_at, events(title, slug, starts_at)")
    .eq("user_id", userId)
    .in("status", ["confirmed", "waitlisted", "checked_in", "pending_payment"])
    .order("created_at", { ascending: false });

  if (error) return [];
  return ((data ?? []) as Array<
    Omit<EventRegistrationRow, "events"> & {
      events: EventRegistrationRow["events"][];
    }
  >).map((registration) => ({
    ...registration,
    events: Array.isArray(registration.events)
      ? (registration.events[0] ?? null)
      : registration.events,
  }));
}

export async function getUserProductRequests(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("product_reservation_requests")
    .select(
      "id, product_name, category, notes, status, quantity, desired_price, priority_flag, expected_fulfillment_at, stock_notified_at, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as ProductRequestRow[];
}

export async function getEventRegistrationsForStaff(
  supabase: SupabaseClient,
  eventId: string,
) {
  const { data, error } = await supabase
    .from("event_registrations")
    .select(
      "id, event_id, user_id, status, waitlist_position, created_at, payment_intent_id, payment_status, paid_at, check_in_token",
    )
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  if (error) return [];

  const registrations = (data ?? []) as Array<{
    id: string;
    event_id: string;
    user_id: string;
    status: string;
    waitlist_position: number | null;
    created_at: string;
    payment_intent_id: string | null;
    payment_status: string | null;
    paid_at: string | null;
    check_in_token: string | null;
  }>;

  const userIds = [...new Set(registrations.map((item) => item.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .in("id", userIds);

  const profileById = new Map(
    (profiles ?? []).map((profile) => [
      profile.id,
      { email: profile.email, full_name: profile.full_name },
    ]),
  );

  return registrations.map((registration) => ({
    ...registration,
    profiles: profileById.get(registration.user_id) ?? null,
  }));
}

export async function getAllProfilesForStaff(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, role, newsletter_opt_in, marketing_consent, interests",
    )
    .order("updated_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as ProfileListRow[];
}

export async function getAdminNotesForStaff(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("admin_notes")
    .select("id, body, created_at, subject_profile_id, author_id")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) return [];

  const notes = (data ?? []) as Array<{
    id: string;
    body: string;
    created_at: string;
    subject_profile_id: string;
    author_id: string;
  }>;

  const profileIds = [...new Set(notes.map((note) => note.subject_profile_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .in("id", profileIds);

  const profileById = new Map(
    (profiles ?? []).map((profile) => [
      profile.id,
      { email: profile.email, full_name: profile.full_name },
    ]),
  );

  return notes.map((note) => ({
    ...note,
    subject_profile: profileById.get(note.subject_profile_id) ?? null,
  }));
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

/** Per input HTML `datetime-local` (ora locale browser/server coerente con salvataggio precedente). */
export function formatForDatetimeLocalInput(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export type ProductRequestStaffRow = ProductRequestRow & {
  user_id: string | null;
};

export async function getProductRequestsForStaff(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("product_reservation_requests")
    .select(
      "id, user_id, product_name, category, notes, status, quantity, desired_price, priority_flag, expected_fulfillment_at, stock_notified_at, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as ProductRequestStaffRow[];
}

export type NewsletterSubscriberRow = {
  id: string;
  email: string;
  opted_in: boolean;
  source: string | null;
  created_at: string;
};

export async function getNewsletterSubscribersForStaff(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("newsletter_subscribers")
    .select("id, email, opted_in, source, created_at")
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as NewsletterSubscriberRow[];
}

export async function getProfileByIdForStaff(
  supabase: SupabaseClient,
  profileId: string,
): Promise<ProfileListRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, role, newsletter_opt_in, marketing_consent, interests",
    )
    .eq("id", profileId)
    .maybeSingle();

  if (error || !data) return null;
  return data as ProfileListRow;
}

export async function getAdminNotesForSubject(
  supabase: SupabaseClient,
  subjectProfileId: string,
) {
  const { data, error } = await supabase
    .from("admin_notes")
    .select("id, body, created_at, author_id")
    .eq("subject_profile_id", subjectProfileId)
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as Array<{
    id: string;
    body: string;
    created_at: string;
    author_id: string;
  }>;
}

export async function getRegistrationsForProfileStaff(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("event_registrations")
    .select("id, status, waitlist_position, created_at, events(title, slug, starts_at)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return [];
  return ((data ?? []) as Array<{
    id: string;
    status: string;
    waitlist_position: number | null;
    created_at: string;
    events:
      | { title: string; slug: string; starts_at: string }
      | { title: string; slug: string; starts_at: string }[]
      | null;
  }>).map((row) => ({
    ...row,
    events: Array.isArray(row.events) ? row.events[0] ?? null : row.events,
  }));
}

export type GamePageRow = {
  id: string;
  slug: string;
  display_name: string;
  eyebrow: string | null;
  hero_title: string;
  intro: string | null;
  body: string | null;
  hero_image_path: string | null;
  status: string;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

export type GamePageHubRow = {
  slug: string;
  display_name: string;
  eyebrow: string | null;
  intro: string | null;
  hero_image_path: string | null;
  sort_order: number;
};

export async function getPublishedGamePageSummaries(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("game_pages")
    .select("slug, display_name, eyebrow, intro, hero_image_path, sort_order")
    .eq("status", "published")
    .order("sort_order", { ascending: true });

  if (error) return [];
  return (data ?? []) as GamePageHubRow[];
}

export async function getPublishedGamePageBySlug(supabase: SupabaseClient, slug: string) {
  const { data, error } = await supabase
    .from("game_pages")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error || !data) return null;
  return data as GamePageRow;
}

export async function listAllGamePagesAdmin(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("game_pages")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) return [];
  return (data ?? []) as GamePageRow[];
}

export function formatCurrencyLabel(value: number | null) {
  if (value == null) return null;
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

const registrationStatusLabels: Record<string, string> = {
  confirmed: "Confermato",
  waitlisted: "Lista d'attesa",
  cancelled: "Annullato",
  checked_in: "Check-in effettuato",
  pending_payment: "In attesa di pagamento",
};

export function formatRegistrationStatus(
  status: string,
  waitlistPosition?: number | null,
) {
  if (status === "waitlisted" && waitlistPosition) {
    return `Lista d'attesa #${waitlistPosition}`;
  }
  return registrationStatusLabels[status] ?? status;
}

const productRequestStatusLabels: Record<string, string> = {
  new: "Nuova",
  in_review: "In revisione",
  fulfilled: "Completata",
  cancelled: "Annullata",
  awaiting_stock: "In attesa merce",
};

export function formatProductRequestStatus(status: string) {
  return productRequestStatusLabels[status] ?? status;
}
