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

// Normalize any video URL to an embeddable iframe src
function getEmbedSrc(url: string): string | null {
  if (!url) return null;
  // Cloudflare Stream — already an iframe URL or a watch URL
  if (url.includes("videodelivery.net") || url.includes("cloudflarestream.com")) {
    // Convert watch URL to embed URL if needed
    if (url.includes("iframe.videodelivery.net")) return url;
    const id = url.split("/").pop()?.split("?")[0];
    return id ? `https://iframe.videodelivery.net/${id}` : null;
  }
  // YouTube
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0`;
  // Vimeo
  const vi = url.match(/vimeo\.com\/(\d+)/);
  if (vi) return `https://player.vimeo.com/video/${vi[1]}`;
  return null;
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
          <div style={{ display: "flex", flexDirection: "column", gap: 40, paddingBottom: 80 }}>
            {showEps.map((ep) => {
              const embedSrc = ep.video_url ? getEmbedSrc(ep.video_url) : null;
              return (
                <div key={ep.id}>
                  {/* ── Video player ── */}
                  {embedSrc ? (
                    <div style={{ position: "relative", paddingTop: "56.25%", background: "#000", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
                      <iframe
                        src={embedSrc}
                        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                        allowFullScreen
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
                      />
                    </div>
                  ) : ep.thumbnail ? (
                    <div style={{ position: "relative", paddingTop: "56.25%", background: "#000", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
                      <img
                        src={ep.thumbnail}
                        alt={ep.title}
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                  ) : null}

                  {/* ── Episode info ── */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                    <div>
                      <div style={{ fontSize: "0.72rem", color: "var(--gold)", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
                        Episode {ep.episode_number}
                        {ep.duration_seconds && (
                          <span style={{ color: "var(--muted)", marginLeft: 12, fontWeight: 600 }}>
                            {formatDuration(ep.duration_seconds)}
                          </span>
                        )}
                      </div>
                      <h2 style={{ fontSize: "1.1rem", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: 8 }}>{ep.title}</h2>
                      {ep.description && (
                        <p style={{ fontSize: "0.88rem", color: "var(--muted)", lineHeight: 1.6 }}>{ep.description}</p>
                      )}
                    </div>
                    {!embedSrc && ep.video_url && (
                      <a
                        href={ep.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn--gold"
                        style={{ fontSize: "0.78rem", padding: "8px 16px", flexShrink: 0 }}
                      >
                        Watch →
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
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
