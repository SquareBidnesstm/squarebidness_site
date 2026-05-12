const ERROR_MESSAGES: Record<string, string> = {
  missing_fields: "Please fill in all required fields.",
  password_too_short: "Password must be at least 8 characters.",
  email_exists: "An account with this email already exists.",
  db_error: "Could not create account. Please try again.",
  server_error: "Something went wrong. Please try again.",
};

export default async function OrganizerSignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? "An error occurred.") : null;

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 480 }}>
        <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#a1a1aa", fontSize: "0.85rem", textDecoration: "none", marginBottom: 28 }}>
          ← Back to events
        </a>
        <h1 style={{ fontSize: "2rem", fontWeight: 950, letterSpacing: "-0.05em", marginBottom: 6 }}>List your event.</h1>
        <p style={{ color: "#a1a1aa", marginBottom: 28 }}>
          Create your organizer account to start selling tickets on Square Bidness Events.
        </p>

        {errorMessage && (
          <div style={{ background: "#1a0505", border: "1px solid #7f1d1d", borderRadius: 8, padding: "10px 14px", marginBottom: 18, color: "#fca5a5", fontSize: "0.9rem" }}>
            {errorMessage}
          </div>
        )}

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
