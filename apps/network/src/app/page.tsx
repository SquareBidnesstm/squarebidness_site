import type { Metadata } from "next";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import type { Article, Show, ContentCategory } from "@/types";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/types";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "SB Network | Square Bidness",
  description: "Louisiana-rooted content from Square Bidness Holdings.",
};

const TICKER_ITEMS = [
  "Square Bidness Network",
  "Louisiana Built",
  "Community First",
  "Business. Culture. Health.",
  "7 Parish Coverage",
  "Tangipahoa to Rapides",
];

function CategoryPill({ category }: { category: ContentCategory }) {
  return (
    <span
      className="pill"
      style={{ color: CATEGORY_COLORS[category] }}
    >
      {CATEGORY_LABELS[category]}
    </span>
  );
}

function ArticleCard({ article }: { article: Article }) {
  return (
    <Link href={`/news/${article.slug}`} className="card" style={{ display: "block" }}>
      {article.cover_image && (
        <img src={article.cover_image} alt={article.title} className="card__img" />
      )}
      {!article.cover_image && (
        <div className="card__img" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "var(--muted)", fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>SB Network</span>
        </div>
      )}
      <div className="card__body">
        <div className="card__meta">
          <CategoryPill category={article.category} />
          <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
            {new Date(article.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        </div>
        <div className="card__title">{article.title}</div>
        <div className="card__excerpt">{article.excerpt}</div>
      </div>
    </Link>
  );
}

function ShowCard({ show }: { show: Show }) {
  return (
    <Link href={`/shows/${show.slug}`} className="card" style={{ display: "block" }}>
      {show.cover_image && (
        <img src={show.cover_image} alt={show.title} className="card__img" />
      )}
      {!show.cover_image && (
        <div className="card__img" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "var(--muted)", fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>Show</span>
        </div>
      )}
      <div className="card__body">
        <div className="card__meta">
          <CategoryPill category={show.category} />
          <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
            {show.episode_count} {show.episode_count === 1 ? "episode" : "episodes"}
          </span>
        </div>
        <div className="card__title">{show.title}</div>
        <div className="card__excerpt">{show.description}</div>
      </div>
    </Link>
  );
}

export default async function HomePage() {
  const [{ data: articles }, { data: shows }] = await Promise.all([
    supabaseServer
      .from("network_articles")
      .select("id, slug, title, excerpt, cover_image, category, author, published_at")
      .eq("published", true)
      .order("published_at", { ascending: false })
      .limit(7),
    supabaseServer
      .from("network_shows")
      .select("id, slug, title, description, cover_image, category, episode_count")
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(4),
  ]);

  const featured = articles?.[0] ?? null;
  const secondary = articles?.slice(1, 3) ?? [];
  const remaining = articles?.slice(3) ?? [];

  return (
    <>
      {/* Ticker */}
      <div className="ticker">
        <div className="ticker__inner" aria-hidden="true">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span key={i}>{item}</span>
          ))}
        </div>
      </div>

      {/* Hero */}
      <section className="hero">
        <div className="wrap">
          <div className="hero__eyebrow">
            <span className="hero__eyebrow-dot" />
            Square Bidness Network
          </div>
          <h1 className="hero__title">
            Louisiana&apos;s <em>independent</em> voice for business, culture, and community.
          </h1>
          <p className="hero__sub">
            Original content covering the people, businesses, and stories driving the region forward.
          </p>
          <div className="hero__actions">
            <Link href="/news" className="btn btn--gold">Latest News</Link>
            <Link href="/shows" className="btn btn--outline">Browse Shows</Link>
          </div>
        </div>
      </section>

      <main>
        <div className="wrap">
          {/* Featured articles */}
          {(featured || secondary.length > 0) && (
            <section className="section">
              <div className="section__header">
                <h2 className="section__title">Featured</h2>
                <Link href="/news" className="section__link">All News &rarr;</Link>
              </div>
              <div className="featured">
                <div className="featured__main">
                  {featured ? (
                    <ArticleCard article={featured as Article} />
                  ) : (
                    <div className="card" style={{ minHeight: 280, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>First story coming soon</span>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {secondary.map((a) => (
                    <ArticleCard key={a.id} article={a as Article} />
                  ))}
                  {secondary.length === 0 && (
                    <div className="card" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>More coming soon</span>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Shows */}
          <section className="section" style={{ borderTop: "1px solid var(--border)", paddingTop: 48 }}>
            <div className="section__header">
              <h2 className="section__title">Shows</h2>
              <Link href="/shows" className="section__link">All Shows &rarr;</Link>
            </div>
            {shows && shows.length > 0 ? (
              <div className="grid-4">
                {shows.map((s) => (
                  <ShowCard key={s.id} show={s as Show} />
                ))}
              </div>
            ) : (
              <div className="empty">
                <div className="empty__icon">📺</div>
                <div className="empty__text">Shows launching soon</div>
              </div>
            )}
          </section>

          {/* More news */}
          {remaining.length > 0 && (
            <section className="section" style={{ borderTop: "1px solid var(--border)", paddingTop: 48 }}>
              <div className="section__header">
                <h2 className="section__title">More News</h2>
              </div>
              <div className="grid-3">
                {remaining.map((a) => (
                  <ArticleCard key={a.id} article={a as Article} />
                ))}
              </div>
            </section>
          )}

          {/* Coverage area callout */}
          <section className="section" style={{ borderTop: "1px solid var(--border)", paddingTop: 48 }}>
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--gold-border)",
                borderRadius: "var(--radius)",
                padding: "40px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 24,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--gold)", marginBottom: 8 }}>
                  Coverage Area
                </div>
                <h2 style={{ fontSize: "1.4rem", fontWeight: 900, letterSpacing: "-0.03em", marginBottom: 8 }}>
                  7 Parish Louisiana Region
                </h2>
                <p style={{ color: "var(--muted)", fontSize: "0.88rem", maxWidth: 480 }}>
                  Tangipahoa &middot; Rapides &middot; Washington &middot; St. Helena &middot; Livingston &middot; St. Landry &middot; Avoyelles
                </p>
              </div>
              <Link href="/about" className="btn btn--outline">
                About the Network
              </Link>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
