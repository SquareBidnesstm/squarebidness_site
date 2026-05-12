const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Wrong password.",
  missing: "Enter your admin password.",
  server_error: "Something went wrong.",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? "An error occurred.") : null;

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <p style={{ color: "#a1a1aa", fontSize: 11, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 10 }}>
            Square Bidness Events
          </p>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 950, letterSpacing: "-0.05em" }}>Admin</h1>
        </div>

        {errorMessage && (
          <div style={{ background: "#1a0505", border: "1px solid #7f1d1d", borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "#fca5a5", fontSize: "0.9rem", textAlign: "center" }}>
            {errorMessage}
          </div>
        )}

        <form action="/api/admin/login" method="POST" style={{ display: "grid", gap: 12 }}>
          <div className="form-group">
            <label className="label">Password</label>
            <input
              name="password"
              type="password"
              className="input"
              required
              autoFocus
              placeholder="Admin password"
            />
          </div>
          <button type="submit" className="btn btn--primary btn--wide" style={{ marginTop: 4 }}>
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
