import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import type { Article, ContentCategory } from "@/types";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/types";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { data } = await supabaseServer
    .from("network_articles")
    .select("title, excerpt, cover_image")
    .eq("slug", slug)
    .eq("published", true)
    .single();

  if (!data) return { title: "Article Not Found" };

  return {
    title: data.title,
    description: data.excerpt,
    openGraph: {
      title: data.title,
      description: data.excerpt,
      images: data.cover_image ? [{ url: data.cover_image }] : [],
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { data: article } = await supabaseServer
    .from("network_articles")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .single();

  if (!article) notFound();

  const a = article as Article;

  return (
    <main>
      <div className="wrap--narrow">
        <div className="article-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <Link href="/news" style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 600 }}>
              &larr; News
            </Link>
            <span style={{ color: "var(--border)" }}>|</span>
            <span className="pill" style={{ color: CATEGORY_COLORS[a.category] }}>
              {CATEGORY_LABELS[a.category]}
            </span>
          </div>
          <h1 className="article-header__title">{a.title}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 16, color: "var(--muted)", fontSize: "0.82rem" }}>
            <span>{a.author}</span>
            <span>&middot;</span>
            <span>
              {new Date(a.published_at).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        </div>

        {a.cover_image && (
          <img
            src={a.cover_image}
            alt={a.title}
            style={{ width: "100%", borderRadius: "var(--radius)", marginBottom: 40, aspectRatio: "16/9", objectFit: "cover" }}
          />
        )}

        <div
          className="article-body"
          dangerouslySetInnerHTML={{ __html: a.body }}
        />

        <div style={{ marginTop: 48, paddingTop: 32, borderTop: "1px solid var(--border)" }}>
          <Link href="/news" className="btn btn--outline">
            &larr; Back to News
          </Link>
        </div>
      </div>
    </main>
  );
}
