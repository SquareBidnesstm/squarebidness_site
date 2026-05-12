export default function OrganizerLoginPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 950, letterSpacing: "-0.05em", marginBottom: 6 }}>Welcome back.</h1>
        <p style={{ color: "#a1a1aa", marginBottom: 28 }}>Sign in to manage your events.</p>

        <form action="/api/organizer/login" method="POST" style={{ display: "grid", gap: 14 }}>
          <div className="form-group">
            <label className="label">Email</label>
            <input name="email" type="email" className="input" required placeholder="you@example.com" />
          </div>
          <div className="form-group">
            <label className="label">Password</label>
            <input name="password" type="password" className="input" required placeholder="Your password" />
          </div>

          <button type="submit" className="btn btn--primary btn--wide" style={{ marginTop: 4 }}>
            Sign In
          </button>

          <p style={{ textAlign: "center", color: "#555", fontSize: "0.85rem" }}>
            No account?{" "}
            <a href="/organizer/signup" style={{ color: "#a1a1aa" }}>List an event</a>
          </p>
        </form>
      </div>
    </div>
  );
}
