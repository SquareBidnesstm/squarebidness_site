import type { Metadata } from "next";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import type { Article, ContentCategory } from "@/types";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/types";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "News",
  description: "Latest news and editorial from SB Network covering Louisiana business, culture, community, and health.",
};

const CATEGORIES: ContentCategory[] = ["community", "business", "culture", "health", "events", "technology"];

export default async function NewsPage({
  searchParams,
}: {
  searchParams?: Promise<{ category?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const activeCategory = params.category as ContentCategory | undefined;

  const query = supabaseServer
    .from("network_articles")
    .select("id, slug, title, excerpt, cover_image, category, author, published_at")
    .eq("published", true)
    .order("published_at", { ascending: false })
    .limit(24);

  if (activeCategory && CATEGORIES.includes(activeCategory)) {
    query.eq("category", activeCategory);
  }

  const { data: articles } = await query;

  return (
    <main>
      <div className="wrap">
        <div style={{ padding: "48px 0 32px", borderBottom: "1px solid var(--border)" }}>
          <h1 style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 950, letterSpacing: "-0.04em", marginBottom: 24 }}>
            News
          </h1>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link
              href="/news"
              style={{
                padding: "6px 16px",
                borderRadius: 999,
                fontSize: "0.78rem",
                fontWeight: 700,
                border: "1px solid",
                borderColor: !activeCategory ? "var(--gold)" : "var(--border)",
                color: !activeCategory ? "var(--gold)" : "var(--muted)",
              }}
            >
              All
            </Link>
            {CATEGORIES.map((cat) => (
              <Link
                key={cat}
                href={`/news?category=${cat}`}
                style={{
                  padding: "6px 16px",
                  borderRadius: 999,
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  border: "1px solid",
                  borderColor: activeCategory === cat ? CATEGORY_COLORS[cat] : "var(--border)",
                  color: activeCategory === cat ? CATEGORY_COLORS[cat] : "var(--muted)",
                }}
              >
                {CATEGORY_LABELS[cat]}
              </Link>
            ))}
          </div>
        </div>

        {articles && articles.length > 0 ? (
          <div className="grid-3" style={{ padding: "40px 0 80px" }}>
            {articles.map((article) => (
              <Link
                key={article.id}
                href={`/news/${article.slug}`}
                className="card"
                style={{ display: "block" }}
              >
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
                    <span className="pill" style={{ color: CATEGORY_COLORS[article.category as ContentCategory] }}>
                      {CATEGORY_LABELS[article.category as ContentCategory]}
                    </span>
                    <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                      {new Date(article.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                  <div className="card__title">{article.title}</div>
                  <div className="card__excerpt">{article.excerpt}</div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty" style={{ padding: "80px 0" }}>
            <div className="empty__icon">📰</div>
            <div className="empty__text">
              {activeCategory ? `No ${CATEGORY_LABELS[activeCategory]} articles yet` : "No articles published yet"}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
