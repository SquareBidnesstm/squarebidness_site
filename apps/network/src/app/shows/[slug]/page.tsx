import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import type { Show, Episode, ContentCategory } from "@/types";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/types";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { data } = await supabaseServer
    .from("network_shows")
    .select("title, description, cover_image")
    .eq("slug", slug)
    .eq("published", true)
    .single();

  if (!data) return { title: "Show Not Found" };

  return {
    title: data.title,
    description: data.description,
    openGraph: {
      title: data.title,
      description: data.description,
      images: data.cover_image ? [{ url: data.cover_image }] : [],
    },
  };
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default async function ShowPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [{ data: show }, { data: episodes }] = await Promise.all([
    supabaseServer
      .from("network_shows")
      .select("*")
      .eq("slug", slug)
      .eq("published", true)
      .single(),
    supabaseServer
      .from("network_episodes")
      .select("*")
      .eq("published", true)
      .order("episode_number", { ascending: true }),
  ]);

  if (!show) notFound();

  const s = show as Show;
  const eps = (episodes ?? []) as Episode[];
  const showEps = eps.filter((e) => e.show_id === s.id);

  return (
    <main>
      <div className="wrap">
        <div className="show-header">
          <Link href="/shows" style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 600, display: "inline-block", marginBottom: 20 }}>
            &larr; All Shows
          </Link>
          <div style={{ display: "flex", gap: 32, alignItems: "flex-start", flexWrap: "wrap" }}>
            {s.cover_image && (
              <img
                src={s.cover_image}
                alt={s.title}
                style={{ width: 180, height: 180, objectFit: "cover", borderRadius: 12, flexShrink: 0 }}
              />
            )}
            <div>
              <div style={{ marginBottom: 12 }}>
                <span className="pill" style={{ color: CATEGORY_COLORS[s.category as ContentCategory] }}>
                  {CATEGORY_LABELS[s.category as ContentCategory]}
                </span>
              </div>
              <h1 className="show-header__title">{s.title}</h1>
              <p className="show-header__desc">{s.description}</p>
              <p style={{ marginTop: 12, fontSize: "0.82rem", color: "var(--muted)" }}>
                {showEps.length} {showEps.length === 1 ? "episode" : "episodes"}
              </p>
            </div>
          </div>
        </div>

        {showEps.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 80 }}>
            {showEps.map((ep) => (
              <div key={ep.id} className="card" style={{ display: "flex", gap: 20, alignItems: "center", padding: 20 }}>
                {ep.thumbnail && (
                  <img
                    src={ep.thumbnail}
                    alt={ep.title}
                    style={{ width: 140, height: 80, objectFit: "cover", borderRadius: 8, flexShrink: 0 }}
                  />
                )}
                {!ep.thumbnail && (
                  <div style={{ width: 140, height: 80, background: "var(--surface2)", borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: "var(--muted)", fontSize: "0.7rem" }}>EP {ep.episode_number}</span>
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: 700, marginBottom: 4 }}>
                    Episode {ep.episode_number}
                  </div>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>{ep.title}</div>
                  <div style={{ fontSize: "0.82rem", color: "var(--muted)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>
                    {ep.description}
                  </div>
                </div>
                <div style={{ flexShrink: 0, textAlign: "right" }}>
                  {ep.duration_seconds && (
                    <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: 8 }}>
                      {formatDuration(ep.duration_seconds)}
                    </div>
                  )}
                  {ep.video_url && (
                    <a
                      href={ep.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn--gold"
                      style={{ fontSize: "0.78rem", padding: "8px 16px" }}
                    >
                      Watch
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty" style={{ padding: "80px 0" }}>
            <div className="empty__icon">🎬</div>
            <div className="empty__text">Episodes coming soon</div>
          </div>
        )}
      </div>
    </main>
  );
}
