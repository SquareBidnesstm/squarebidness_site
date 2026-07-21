export type ContentCategory =
  | "community"
  | "business"
  | "culture"
  | "health"
  | "events"
  | "technology";

export interface Show {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: ContentCategory;
  cover_image: string | null;
  episode_count: number;
  published: boolean;
  created_at: string;
}

export interface Episode {
  id: string;
  show_id: string;
  slug: string;
  title: string;
  description: string;
  thumbnail: string | null;
  video_url: string | null;
  duration_seconds: number | null;
  episode_number: number;
  published: boolean;
  published_at: string;
  shows?: Pick<Show, "title" | "slug">;
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  cover_image: string | null;
  category: ContentCategory;
  author: string;
  published: boolean;
  published_at: string;
}

export const CATEGORY_LABELS: Record<ContentCategory, string> = {
  community: "Community",
  business: "Business",
  culture: "Culture",
  health: "Health",
  events: "Events",
  technology: "Technology",
};

export const CATEGORY_COLORS: Record<ContentCategory, string> = {
  community: "#d8b35a",
  business: "#22c55e",
  culture: "#a855f7",
  health: "#3b82f6",
  events: "#ef4444",
  technology: "#06b6d4",
};
