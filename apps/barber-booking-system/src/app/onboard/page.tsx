"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern (ET)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/Denver", label: "Mountain (MT)" },
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
  { value: "America/Phoenix", label: "Arizona (no DST)" },
  { value: "America/Anchorage", label: "Alaska (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii (HT)" },
];

const SHOP_TYPES = [
  { value: "barbershop", label: "Barbershop" },
  { value: "beauty_salon", label: "Beauty Salon" },
  { value: "nail_salon", label: "Nail Salon" },
  { value: "spa", label: "Spa" },
  { value: "lash_studio", label: "Lash Studio" },
  { value: "other", label: "Other" },
];

const ROLES_BY_TYPE: Record<string, string[]> = {
  barbershop: ["Barber", "Head Barber", "Master Barber", "Apprentice"],
  beauty_salon: ["Stylist", "Master Stylist", "Cosmetologist", "Braider", "Color Specialist"],
  nail_salon: ["Nail Technician", "Senior Nail Tech", "Nail Artist"],
  spa: ["Esthetician", "Massage Therapist", "Spa Specialist", "Facialist"],
  lash_studio: ["Lash Artist", "Lash Tech", "Senior Lash Artist"],
  other: ["Specialist", "Senior Specialist", "Owner"],
};

type Barber = { name: string; role: string };

function slugify(str: string) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function OnboardPage() {
  const router = useRouter();

  const [shopType, setShopType] = useState("barbershop");
  const [shopName, setShopName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [timezone, setTimezone] = useState("America/Chicago");
  const [ownerName, setOwnerName] = useState("");
  const [barbers, setBarbers] = useState<Barber[]>([{ name: "", role: "Barber" }]);

  const availableRoles = ROLES_BY_TYPE[shopType] ?? ROLES_BY_TYPE.other;

  function handleShopTypeChange(val: string) {
    setShopType(val);
    // Reset barber roles to first role for new type
    const firstRole = ROLES_BY_TYPE[val]?.[0] ?? "Specialist";
    setBarbers((prev) => prev.map((b) => ({ ...b, role: firstRole })));
  }
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ shopSlug: string; shopName: string } | null>(null);

  function handleShopNameChange(val: string) {
    setShopName(val);
    if (!slugEdited) setSlug(slugify(val));
  }

  function addBarber() {
    if (barbers.length >= 8) return;
    setBarbers((prev) => [...prev, { name: "", role: "Barber" }]);
  }

  function removeBarber(i: number) {
    setBarbers((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateBarber(i: number, field: keyof Barber, value: string) {
    setBarbers((prev) =>
      prev.map((b, idx) => (idx === i ? { ...b, [field]: value } : b))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!shopName || !slug || !city || !state || !ownerName) {
      setError("All shop fields are required.");
      return;
    }

    if (barbers.some((b) => !b.name.trim())) {
      setError("All barber names are required.");
      return;
    }

    if (!pin || pin.length < 4) {
      setError("PIN must be at least 4 digits.");
      return;
    }

    if (pin !== pinConfirm) {
      setError("PINs don't match.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopType, shopName, slug, city, state, timezone, ownerName, barbers, pin }),
      });

      const data = await res.json();

      if (res.ok && data.ok) {
        setDone({ shopSlug: data.shopSlug, shopName: data.shopName });
      } else {
        setError(data.error || "Something went wrong.");
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#050505",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 500 }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>🎉</div>
          <h2 style={{ fontSize: 32, fontWeight: 900, marginBottom: 12 }}>
            {done.shopName} is live!
          </h2>
          <p style={{ color: "#888", marginBottom: 28 }}>
            Your booking page is ready. Share it with your clients.
          </p>
          <div
            style={{
              background: "#0d0d0d",
              border: "1px solid #1f1f1f",
              borderRadius: 12,
              padding: "16px 24px",
              marginBottom: 24,
              color: "#d4af37",
              fontWeight: 700,
              fontSize: 16,
            }}
          >
            booking.squarebidness.com/{done.shopSlug}
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => router.push(`/${done.shopSlug}`)}
              style={{
                padding: "14px 24px",
                borderRadius: 10,
                border: "none",
                background: "#d4af37",
                color: "#000",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              View Booking Page
            </button>
            <button
              onClick={() => router.push(`/${done.shopSlug}/admin`)}
              style={{
                padding: "14px 24px",
                borderRadius: 10,
                border: "1px solid #2a2a2a",
                background: "transparent",
                color: "#888",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Go to Admin
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#050505", color: "#fff" }}>
      <section style={{ maxWidth: 600, margin: "0 auto", padding: "56px 24px" }}>
        <div
          style={{
            color: "#d4af37",
            fontSize: 12,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          SquareBidness
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 900, marginBottom: 8 }}>
          Get Your Shop Online
        </h1>
        <p style={{ color: "#555", marginBottom: 40, fontSize: 15 }}>
          Set up your booking page in 2 minutes.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 32 }}>
          {/* Shop info */}
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 20, color: "#aaa" }}>
              Shop Info
            </h2>
            <div style={{ display: "grid", gap: 16 }}>
              <Field label="Shop Type" required>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  {SHOP_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => handleShopTypeChange(t.value)}
                      style={{
                        padding: "10px 8px",
                        borderRadius: 8,
                        border: shopType === t.value ? "none" : "1px solid #2a2a2a",
                        background: shopType === t.value ? "#d4af37" : "#111",
                        color: shopType === t.value ? "#000" : "#888",
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Shop Name" required>
                <input
                  value={shopName}
                  onChange={(e) => handleShopNameChange(e.target.value)}
                  placeholder="Dapper Lounge"
                  style={fieldStyle}
                />
              </Field>

              <Field label="URL Slug" required hint="your-shop-name — letters, numbers, hyphens">
                <div style={{ position: "relative" }}>
                  <span
                    style={{
                      position: "absolute",
                      left: 14,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#555",
                      fontSize: 14,
                      pointerEvents: "none",
                    }}
                  >
                    /
                  </span>
                  <input
                    value={slug}
                    onChange={(e) => {
                      setSlugEdited(true);
                      setSlug(slugify(e.target.value));
                    }}
                    placeholder="dapper-lounge"
                    style={{ ...fieldStyle, paddingLeft: 22 }}
                  />
                </div>
              </Field>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="City" required>
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Hammond"
                    style={fieldStyle}
                  />
                </Field>
                <Field label="State" required>
                  <input
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="LA"
                    maxLength={2}
                    style={fieldStyle}
                  />
                </Field>
              </div>

              <Field label="Timezone" required>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  style={fieldStyle}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Owner Name" required>
                <input
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Josh Watkins"
                  style={fieldStyle}
                />
              </Field>
            </div>
          </div>

          {/* Barbers */}
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 20, color: "#aaa" }}>
              {shopType === "barbershop" ? "Barbers" :
               shopType === "nail_salon" ? "Nail Techs" :
               shopType === "spa" ? "Specialists" :
               shopType === "lash_studio" ? "Lash Artists" : "Stylists / Specialists"}
            </h2>
            <div style={{ display: "grid", gap: 12 }}>
              {barbers.map((b, i) => (
                <div
                  key={i}
                  style={{ display: "grid", gridTemplateColumns: "1fr 140px auto", gap: 10, alignItems: "center" }}
                >
                  <input
                    value={b.name}
                    onChange={(e) => updateBarber(i, "name", e.target.value)}
                    placeholder={`Barber ${i + 1} name`}
                    style={fieldStyle}
                  />
                  <select
                    value={b.role}
                    onChange={(e) => updateBarber(i, "role", e.target.value)}
                    style={fieldStyle}
                  >
                    {availableRoles.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  {barbers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeBarber(i)}
                      style={{
                        padding: "12px",
                        borderRadius: 8,
                        border: "1px solid #330000",
                        background: "#1a0000",
                        color: "#ff6666",
                        cursor: "pointer",
                        fontSize: 16,
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {barbers.length < 8 && (
                <button
                  type="button"
                  onClick={addBarber}
                  style={{
                    padding: "12px",
                    borderRadius: 10,
                    border: "1px dashed #2a2a2a",
                    background: "transparent",
                    color: "#555",
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  + Add Barber
                </button>
              )}
            </div>
          </div>

          {/* Admin PIN */}
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 20, color: "#aaa" }}>
              Admin PIN
            </h2>
            <div style={{ display: "grid", gap: 16 }}>
              <Field label="PIN" required hint="4+ digits — used to access your admin dashboard">
                <input
                  type="password"
                  inputMode="numeric"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="••••"
                  style={{ ...fieldStyle, letterSpacing: "0.2em", textAlign: "center" }}
                />
              </Field>
              <Field label="Confirm PIN" required>
                <input
                  type="password"
                  inputMode="numeric"
                  value={pinConfirm}
                  onChange={(e) => setPinConfirm(e.target.value)}
                  placeholder="••••"
                  style={{ ...fieldStyle, letterSpacing: "0.2em", textAlign: "center" }}
                />
              </Field>
            </div>
          </div>

          {error && (
            <div
              style={{
                padding: "14px 16px",
                background: "#1a0a0a",
                border: "1px solid #440000",
                borderRadius: 10,
                color: "#ff7070",
                fontSize: 14,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "18px",
              borderRadius: 12,
              border: "none",
              background: loading ? "#a88d20" : "#d4af37",
              color: "#000",
              fontWeight: 800,
              fontSize: 17,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Creating your shop..." : "Launch My Booking Page"}
          </button>
        </form>
      </section>
    </main>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "baseline",
          marginBottom: 6,
        }}
      >
        <label style={{ fontSize: 14, fontWeight: 600 }}>{label}</label>
        {required && <span style={{ color: "#d4af37", fontSize: 12 }}>required</span>}
        {hint && <span style={{ color: "#555", fontSize: 12 }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  background: "#111",
  border: "1px solid #2a2a2a",
  color: "#fff",
  borderRadius: 8,
  fontSize: 15,
  outline: "none",
};
