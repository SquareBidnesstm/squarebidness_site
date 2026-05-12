export default function OrganizerSignupPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 480 }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 950, letterSpacing: "-0.05em", marginBottom: 6 }}>List your event.</h1>
        <p style={{ color: "#a1a1aa", marginBottom: 28 }}>
          Create your organizer account to start selling tickets on Square Bidness Events.
        </p>

        <form action="/api/organizer/signup" method="POST" style={{ display: "grid", gap: 14 }}>
          <div className="form-group">
            <label className="label">Organizer / Business Name</label>
            <input name="name" className="input" required placeholder="e.g. Marcus Productions" />
          </div>
          <div className="form-group">
            <label className="label">Email</label>
            <input name="email" type="email" className="input" required placeholder="you@example.com" />
          </div>
          <div className="form-group">
            <label className="label">Phone</label>
            <input name="phone" type="tel" className="input" placeholder="(555) 000-0000" />
          </div>
          <div className="form-group">
            <label className="label">Password</label>
            <input name="password" type="password" className="input" required minLength={8} placeholder="Min. 8 characters" />
          </div>

          <button type="submit" className="btn btn--primary btn--wide" style={{ marginTop: 4 }}>
            Create Account
          </button>

          <p style={{ textAlign: "center", color: "#555", fontSize: "0.85rem" }}>
            Already have an account?{" "}
            <a href="/organizer/login" style={{ color: "#a1a1aa" }}>Sign in</a>
          </p>
        </form>
      </div>
    </div>
  );
}
