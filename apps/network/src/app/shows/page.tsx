import type { Metadata } from "next";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import type { Show, ContentCategory } from "@/types";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/types";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Shows",
  description: "Original shows and series from SB Network.",
};

export default async function ShowsPage() {
  const { data: shows } = await supabaseServer
    .from("network_shows")
    .select("*")
    .eq("published", true)
    .order("created_at", { ascending: false });

  return (
    <main>
      <div className="wrap">
        <div style={{ padding: "48px 0 40px", borderBottom: "1px solid var(--border)", marginBottom: 40 }}>
          <h1 style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 950, letterSpacing: "-0.04em", marginBottom: 12 }}>
            Shows
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "0.95rem" }}>
            Original programming from Square Bidness Network.
          </p>
        </div>

        {shows && shows.length > 0 ? (
          <div className="grid-3" style={{ paddingBottom: 80 }}>
            {shows.map((show) => {
              const s = show as Show;
              return (
                <Link key={s.id} href={`/shows/${s.slug}`} className="card" style={{ display: "block" }}>
                  {s.cover_image && (
                    <img src={s.cover_image} alt={s.title} className="card__img" />
                  )}
                  {!s.cover_image && (
                    <div className="card__img" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ color: "var(--muted)", fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>Show</span>
                    </div>
                  )}
                  <div className="card__body">
                    <div className="card__meta">
                      <span className="pill" style={{ color: CATEGORY_COLORS[s.category as ContentCategory] }}>
                        {CATEGORY_LABELS[s.category as ContentCategory]}
                      </span>
                      <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                        {s.episode_count} {s.episode_count === 1 ? "ep" : "eps"}
                      </span>
                    </div>
                    <div className="card__title">{s.title}</div>
                    <div className="card__excerpt">{s.description}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="empty" style={{ padding: "100px 0" }}>
            <div className="empty__icon">📺</div>
            <div className="empty__text">Shows launching soon</div>
          </div>
        )}
      </div>
    </main>
  );
}
