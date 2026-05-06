"use client";

import { useEffect, useState } from "react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const TIME_OPTIONS: { value: string; label: string }[] = [];
for (let h = 0; h < 24; h++) {
  for (const m of [0, 30]) {
    const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const suffix = h >= 12 ? "PM" : "AM";
    const displayH = h % 12 === 0 ? 12 : h % 12;
    const label = `${displayH}:${String(m).padStart(2, "0")} ${suffix}`;
    TIME_OPTIONS.push({ value, label });
  }
}

type HourRow = {
  day_of_week: number;
  is_closed: boolean;
  open_time: string | null;
  close_time: string | null;
};

const DEFAULT_HOURS: HourRow[] = [
  { day_of_week: 0, is_closed: true, open_time: null, close_time: null },
  { day_of_week: 1, is_closed: false, open_time: "09:00", close_time: "18:00" },
  { day_of_week: 2, is_closed: false, open_time: "09:00", close_time: "18:00" },
  { day_of_week: 3, is_closed: false, open_time: "09:00", close_time: "18:00" },
  { day_of_week: 4, is_closed: false, open_time: "09:00", close_time: "18:00" },
  { day_of_week: 5, is_closed: false, open_time: "09:00", close_time: "19:00" },
  { day_of_week: 6, is_closed: false, open_time: "08:00", close_time: "16:00" },
];

export default function HoursTab({ shopSlug }: { shopSlug: string }) {
  const [hours, setHours] = useState<HourRow[]>(DEFAULT_HOURS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/${shopSlug}/admin/hours`);
        const data = await res.json();
        if (data.ok && data.hours.length > 0) {
          // Merge with defaults so all 7 days are always present
          const merged = DEFAULT_HOURS.map((def) => {
            const found = data.hours.find((h: HourRow) => h.day_of_week === def.day_of_week);
            return found ?? def;
          });
          setHours(merged);
        }
      } catch {
        setError("Failed to load hours.");
      } finally {
        setLoading(false);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopSlug]);

  function updateDay(dayIndex: number, field: keyof HourRow, value: string | boolean | null) {
    setHours((prev) =>
      prev.map((h) =>
        h.day_of_week === dayIndex ? { ...h, [field]: value } : h
      )
    );
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch(`/api/${shopSlug}/admin/hours`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours }),
      });
      const data = await res.json();
      if (data.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(data.error || "Failed to save.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={emptyBox}>Loading hours...</div>;

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>Hours</h2>
          <p style={{ margin: "4px 0 0", color: "#666", fontSize: 13 }}>
            Set when your shop is open. These control available booking times.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ ...goldButton, opacity: saving ? 0.6 : 1, cursor: saving ? "not-allowed" : "pointer" }}
        >
          {saving ? "Saving..." : saved ? "✓ Saved" : "Save Hours"}
        </button>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {hours.map((h) => (
          <div
            key={h.day_of_week}
            style={{
              ...cardStyle,
              opacity: h.is_closed ? 0.55 : 1,
              borderColor: h.is_closed ? "#1a1a1a" : "#232323",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "120px 1fr",
                gap: 16,
                alignItems: "center",
              }}
            >
              {/* Day name + toggle */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Toggle
                  checked={!h.is_closed}
                  onChange={(checked) => updateDay(h.day_of_week, "is_closed", !checked)}
                />
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: h.is_closed ? "#555" : "#fff",
                  }}
                >
                  {DAYS[h.day_of_week]}
                </span>
              </div>

              {/* Time selectors or closed label */}
              {h.is_closed ? (
                <span style={{ color: "#555", fontSize: 13 }}>Closed</span>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <select
                    value={h.open_time ?? "09:00"}
                    onChange={(e) => updateDay(h.day_of_week, "open_time", e.target.value)}
                    style={selectStyle}
                  >
                    {TIME_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <span style={{ color: "#555", fontSize: 13 }}>to</span>
                  <select
                    value={h.close_time ?? "18:00"}
                    onChange={(e) => updateDay(h.day_of_week, "close_time", e.target.value)}
                    style={selectStyle}
                  >
                    {TIME_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ marginTop: 16, padding: "12px 16px", background: "#1a0a0a", border: "1px solid #440000", borderRadius: 10, color: "#ff7070", fontSize: 14 }}>
          {error}
        </div>
      )}

      {saved && (
        <div style={{ marginTop: 16, padding: "12px 16px", background: "#001a00", border: "1px solid #003300", borderRadius: 10, color: "#4dcf4d", fontSize: 14 }}>
          Hours saved! Booking availability updated.
        </div>
      )}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        width: 40,
        height: 22,
        borderRadius: 999,
        border: "none",
        background: checked ? "#d4af37" : "#333",
        position: "relative",
        cursor: "pointer",
        flexShrink: 0,
        transition: "background 0.15s",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: checked ? 21 : 3,
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.15s",
        }}
      />
    </button>
  );
}

const cardStyle: React.CSSProperties = {
  border: "1px solid #232323",
  background: "#070707",
  borderRadius: 14,
  padding: "14px 18px",
};

const selectStyle: React.CSSProperties = {
  padding: "8px 12px",
  background: "#111",
  border: "1px solid #2a2a2a",
  color: "#fff",
  borderRadius: 8,
  fontSize: 14,
  outline: "none",
  cursor: "pointer",
};

const emptyBox: React.CSSProperties = {
  border: "1px dashed #2a2a2a",
  borderRadius: 18,
  padding: 28,
  textAlign: "center",
  color: "#9a9a9a",
  background: "#070707",
};

const goldButton: React.CSSProperties = {
  padding: "10px 20px",
  borderRadius: 10,
  border: "none",
  background: "#d4af37",
  color: "#000",
  fontWeight: 800,
  cursor: "pointer",
  fontSize: 14,
  whiteSpace: "nowrap",
};
