import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Add SB Events to Your Home Screen",
  description: "Add Square Bidness Events to your phone home screen for faster ticket buying next time.",
  robots: "noindex,nofollow",
};

export default function AddHomescreenPage() {
  return (
    <main style={{
      minHeight: "100vh",
      background: "radial-gradient(circle at 18% 0%, rgba(239,68,68,.12), transparent 28%), linear-gradient(180deg, #111, #070707)",
      color: "#fff",
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{ width: "min(760px, calc(100% - 32px))", margin: "0 auto", padding: "24px 0 48px" }}>

        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src="/events-192.png" alt="SB Events" style={{ width: 56, height: 56, borderRadius: 16, objectFit: "cover", boxShadow: "0 14px 34px rgba(0,0,0,.4)", flexShrink: 0 }} />
            <div>
              <strong style={{ display: "block", fontSize: "1.05rem" }}>SB Events</strong>
              <span style={{ display: "block", color: "#a1a1aa", fontSize: "0.9rem", marginTop: 2 }}>Buy tickets. Any event. Any time.</span>
            </div>
          </div>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", padding: "0 16px", minHeight: 46, borderRadius: 12, background: "#1a1a1a", color: "#fff", border: "1px solid rgba(255,255,255,.1)", textDecoration: "none", fontWeight: 800, whiteSpace: "nowrap" }}>
            Back to Events
          </Link>
        </div>

        {/* Hero */}
        <div style={{ border: "1px solid rgba(255,255,255,.1)", background: "linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.025))", borderRadius: 22, padding: 24, boxShadow: "0 24px 70px rgba(0,0,0,.36)", marginBottom: 18 }}>
          <p style={{ margin: "0 0 8px", color: "#ef4444", fontSize: "0.78rem", fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase" }}>Faster Next Time</p>
          <h1 style={{ margin: 0, fontSize: "clamp(2rem, 7vw, 3.6rem)", lineHeight: 0.96, letterSpacing: "-0.055em" }}>
            Add SB Events<br />to your phone
          </h1>
          <p style={{ margin: "14px 0 0", color: "#a1a1aa", fontSize: "1.02rem", lineHeight: 1.55 }}>
            Save it to your home screen so next time you can tap the icon, browse events, and buy tickets without searching for the link.
          </p>
        </div>

        {/* App icon preview */}
        <div style={{ border: "1px solid rgba(255,255,255,.1)", background: "linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.025))", borderRadius: 22, padding: 24, marginBottom: 18, display: "grid", placeItems: "center", textAlign: "center", boxShadow: "0 24px 70px rgba(0,0,0,.36)" }}>
          <div style={{ width: "min(300px, 100%)", borderRadius: 34, border: "1px solid rgba(255,255,255,.16)", background: "linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,.02)), #101010", padding: "28px 18px" }}>
            <img src="/events-192.png" alt="SB Events app icon" style={{ width: 104, height: 104, borderRadius: 24, objectFit: "cover", display: "block", margin: "0 auto 12px", boxShadow: "0 14px 30px rgba(0,0,0,.4)" }} />
            <p style={{ margin: 0, fontSize: "1.25rem", fontWeight: 900 }}>SB Events on your phone</p>
            <p style={{ margin: "8px 0 0", color: "#a1a1aa", fontSize: "0.92rem", lineHeight: 1.45 }}>
              The home screen name is already set to <strong style={{ color: "#fff" }}>SB Events</strong>.
            </p>
          </div>
        </div>

        {/* iPhone / Android instructions */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginBottom: 18 }}>
          <div style={{ border: "1px solid rgba(255,255,255,.1)", background: "linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.025))", borderRadius: 22, padding: 22, boxShadow: "0 24px 70px rgba(0,0,0,.36)" }}>
            <h2 style={{ margin: "0 0 14px", fontSize: "1.35rem" }}>iPhone</h2>
            <ol style={{ margin: 0, paddingLeft: 22, color: "#a1a1aa", lineHeight: 1.6 }}>
              <li style={{ margin: "8px 0" }}>Open SB Events in <strong style={{ color: "#fff" }}>Safari</strong>.</li>
              <li style={{ margin: "8px 0" }}>Tap the <strong style={{ color: "#fff" }}>share button</strong> (box with arrow).</li>
              <li style={{ margin: "8px 0" }}>Scroll down and tap <strong style={{ color: "#fff" }}>Add to Home Screen</strong>.</li>
              <li style={{ margin: "8px 0" }}>Name it <strong style={{ color: "#fff" }}>SB Events</strong> and tap <strong style={{ color: "#fff" }}>Add</strong>.</li>
            </ol>
          </div>

          <div style={{ border: "1px solid rgba(255,255,255,.1)", background: "linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.025))", borderRadius: 22, padding: 22, boxShadow: "0 24px 70px rgba(0,0,0,.36)" }}>
            <h2 style={{ margin: "0 0 14px", fontSize: "1.35rem" }}>Android</h2>
            <ol style={{ margin: 0, paddingLeft: 22, color: "#a1a1aa", lineHeight: 1.6 }}>
              <li style={{ margin: "8px 0" }}>Open SB Events in <strong style={{ color: "#fff" }}>Chrome</strong>.</li>
              <li style={{ margin: "8px 0" }}>Tap the <strong style={{ color: "#fff" }}>three-dot menu</strong> (top right).</li>
              <li style={{ margin: "8px 0" }}>Tap <strong style={{ color: "#fff" }}>Add to Home screen</strong> or <strong style={{ color: "#fff" }}>Install app</strong>.</li>
              <li style={{ margin: "8px 0" }}>Tap <strong style={{ color: "#fff" }}>Add</strong> to confirm.</li>
            </ol>
          </div>
        </div>

        {/* CTA */}
        <Link href="/" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 54, borderRadius: 14, background: "#ef4444", color: "#fff", fontWeight: 900, fontSize: "1rem", textDecoration: "none" }}>
          Browse Events →
        </Link>

      </div>
    </main>
  );
}
