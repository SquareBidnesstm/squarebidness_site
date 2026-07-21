"use client";

export default function ShareButton({ url, title }: { url: string; title: string }) {
  async function handleShare() {
    if (navigator.share) {
      await navigator.share({ title, url });
    } else {
      await navigator.clipboard.writeText(url);
      alert("Link copied!");
    }
  }

  return (
    <button onClick={handleShare} className="btn--outline">
      Share Link
    </button>
  );
}
