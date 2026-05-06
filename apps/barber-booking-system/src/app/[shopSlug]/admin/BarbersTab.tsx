"use client";

import { useEffect, useState, useCallback } from "react";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const TIME_OPTIONS: { value: string; label: string }[] = [];
for (let h = 0; h < 24; h++) {
  for (const m of [0, 30]) {
    const v = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const suf = h >= 12 ? "PM" : "AM";
    const dh = h % 12 === 0 ? 12 : h % 12;
    TIME_OPTIONS.push({ value: v, label: `${dh}:${String(m).padStart(2, "0")} ${suf}` });
  }
}

type HourRow = { day_of_week: number; is_closed: boolean; open_time: string | null; close_time: string | null };

const DEFAULT_SHOP_HOURS: HourRow[] = [
  { day_of_week: 0, is_closed: true, open_time: null, close_time: null },
  { day_of_week: 1, is_closed: false, open_time: "09:00", close_time: "18:00" },
  { day_of_week: 2, is_closed: false, open_time: "09:00", close_time: "18:00" },
  { day_of_week: 3, is_closed: false, open_time: "09:00", close_time: "18:00" },
  { day_of_week: 4, is_closed: false, open_time: "09:00", close_time: "18:00" },
  { day_of_week: 5, is_closed: false, open_time: "09:00", close_time: "19:00" },
  { day_of_week: 6, is_closed: false, open_time: "08:00", close_time: "16:00" },
];

type Barber = {
  id: string;
  slug: string;
  name: string;
  display_name: string;
  role: string;
  active: boolean;
  sort_order: number;
};

type EditState = {
  name: string;
  display_name: string;
  role: string;
};

const COMMON_ROLES = [
  "Barber", "Head Barber", "Master Barber", "Apprentice",
  "Stylist", "Master Stylist", "Cosmetologist", "Color Specialist", "Braider",
  "Nail Technician", "Nail Artist",
  "Esthetician", "Massage Therapist", "Facialist",
  "Lash Artist", "Lash Tech",
  "Specialist", "Owner",
];

export default function BarbersTab({ shopSlug }: { shopSlug: string }) {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ name: "", display_name: "", role: "" });
  const [saving, setSaving] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [newBarber, setNewBarber] = useState<EditState>({ name: "", display_name: "", role: "Barber" });
  const [addingSaving, setAddingSaving] = useState(false);
  const [hoursOpen, setHoursOpen] = useState<string | null>(null);
  const [barberHours, setBarberHours] = useState<Record<string, HourRow[]>>({});
  const [hoursSaving, setHoursSaving] = useState(false);
  const [hoursSaved, setHoursSaved] = useState<string | null>(null);

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopSlug]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/${shopSlug}/admin/barbers`);
      const data = await res.json();
      if (data.ok) setBarbers(data.barbers);
      else setError(data.error || "Failed to load barbers.");
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  const loadBarberHours = useCallback(async (barberId: string) => {
    if (barberHours[barberId]) return; // already loaded
    const res = await fetch(`/api/${shopSlug}/admin/barbers/${barberId}/hours`);
    const data = await res.json();
    if (data.ok) {
      const loaded: HourRow[] = data.hours;
      const merged = DEFAULT_SHOP_HOURS.map((def) => loaded.find((h) => h.day_of_week === def.day_of_week) ?? def);
      setBarberHours((prev) => ({ ...prev, [barberId]: merged }));
    }
  }, [shopSlug, barberHours]);

  function updateBarberHourDay(barberId: string, dayIndex: number, field: keyof HourRow, value: string | boolean | null) {
    setBarberHours((prev) => ({
      ...prev,
      [barberId]: (prev[barberId] ?? DEFAULT_SHOP_HOURS).map((h) =>
        h.day_of_week === dayIndex ? { ...h, [field]: value } : h
      ),
    }));
    setHoursSaved(null);
  }

  async function saveBarberHours(barberId: string) {
    const hours = barberHours[barberId];
    if (!hours) return;
    setHoursSaving(true);
    const res = await fetch(`/api/${shopSlug}/admin/barbers/${barberId}/hours`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hours }),
    });
    const data = await res.json();
    if (data.ok) { setHoursSaved(barberId); setTimeout(() => setHoursSaved(null), 3000); }
    setHoursSaving(false);
  }

  async function clearBarberHours(barberId: string) {
    await fetch(`/api/${shopSlug}/admin/barbers/${barberId}/hours`, { method: "DELETE" });
    setBarberHours((prev) => { const n = { ...prev }; delete n[barberId]; return n; });
    setHoursOpen(null);
  }

  function startEdit(b: Barber) {
    setEditingId(b.id);
    setEditState({ name: b.name, display_name: b.display_name || b.name, role: b.role });
    setAddingNew(false);
  }

  async function saveEdit(id: string) {
    setSaving(true);
    const res = await fetch(`/api/${shopSlug}/admin/barbers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editState.name.trim(),
        display_name: editState.display_name.trim() || editState.name.trim(),
        role: editState.role,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setBarbers((prev) => prev.map((b) => (b.id === id ? data.barber : b)));
      setEditingId(null);
    }
    setSaving(false);
  }

  async function toggleActive(b: Barber) {
    const res = await fetch(`/api/${shopSlug}/admin/barbers/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !b.active }),
    });
    const data = await res.json();
    if (data.ok) {
      setBarbers((prev) => prev.map((x) => (x.id === b.id ? data.barber : x)));
    }
  }

  async function addBarber() {
    if (!newBarber.name.trim()) return;
    setAddingSaving(true);
    const res = await fetch(`/api/${shopSlug}/admin/barbers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newBarber.name.trim(),
        display_name: newBarber.display_name.trim() || newBarber.name.trim(),
        role: newBarber.role,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setBarbers((prev) => [...prev, data.barber]);
      setNewBarber({ name: "", display_name: "", role: "Barber" });
      setAddingNew(false);
    }
    setAddingSaving(false);
  }

  if (loading) return <div style={emptyBox}>Loading barbers...</div>;
  if (error) return <div style={{ ...emptyBox, color: "#ffb3b3", borderColor: "#532323" }}>{error}</div>;

  const activeBarbers = barbers.filter((b) => b.active);
  const inactiveBarbers = barbers.filter((b) => !b.active);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>Barbers</h2>
          <p style={{ margin: "4px 0 0", color: "#666", fontSize: 13 }}>
            {activeBarbers.length} active · {inactiveBarbers.length} inactive
          </p>
        </div>
        <button
          onClick={() => { setAddingNew(true); setEditingId(null); }}
          style={goldButton}
        >
          + Add Barber
        </button>
      </div>

      {/* Add new barber form */}
      {addingNew && (
        <div style={{ ...cardStyle, marginBottom: 16, border: "1px solid #3a3000" }}>
          <div style={{ color: "#d4af37", fontSize: 13, marginBottom: 14, fontWeight: 700 }}>
            New Barber
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 160px", gap: 12, marginBottom: 14 }}>
            <div>
              <div style={labelStyle}>Full Name</div>
              <input
                value={newBarber.name}
                onChange={(e) => setNewBarber((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Marcus Johnson"
                style={inputStyle}
                autoFocus
              />
            </div>
            <div>
              <div style={labelStyle}>Display Name <span style={{ color: "#555" }}>(shown to clients)</span></div>
              <input
                value={newBarber.display_name}
                onChange={(e) => setNewBarber((p) => ({ ...p, display_name: e.target.value }))}
                placeholder="e.g. Marcus or Marcus J."
                style={inputStyle}
              />
            </div>
            <div>
              <div style={labelStyle}>Role</div>
              <select
                value={newBarber.role}
                onChange={(e) => setNewBarber((p) => ({ ...p, role: e.target.value }))}
                style={inputStyle}
              >
                {COMMON_ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={addBarber}
              disabled={addingSaving || !newBarber.name.trim()}
              style={{ ...goldButton, opacity: addingSaving ? 0.6 : 1, cursor: addingSaving ? "not-allowed" : "pointer" }}
            >
              {addingSaving ? "Saving..." : "Save Barber"}
            </button>
            <button
              onClick={() => { setAddingNew(false); setNewBarber({ name: "", display_name: "", role: "Barber" }); }}
              style={secondaryButton}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Active barbers */}
      <div style={{ display: "grid", gap: 12 }}>
        {barbers.map((b) => {
          const isEditing = editingId === b.id;

          return (
            <div
              key={b.id}
              style={{ ...cardStyle, opacity: b.active ? 1 : 0.45 }}
            >
              {isEditing ? (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 160px", gap: 12, marginBottom: 14 }}>
                    <div>
                      <div style={labelStyle}>Full Name</div>
                      <input
                        value={editState.name}
                        onChange={(e) => setEditState((p) => ({ ...p, name: e.target.value }))}
                        style={inputStyle}
                        autoFocus
                      />
                    </div>
                    <div>
                      <div style={labelStyle}>Display Name</div>
                      <input
                        value={editState.display_name}
                        onChange={(e) => setEditState((p) => ({ ...p, display_name: e.target.value }))}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <div style={labelStyle}>Role</div>
                      <select
                        value={editState.role}
                        onChange={(e) => setEditState((p) => ({ ...p, role: e.target.value }))}
                        style={inputStyle}
                      >
                        {COMMON_ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      onClick={() => saveEdit(b.id)}
                      disabled={saving || !editState.name.trim()}
                      style={{ ...goldButton, opacity: saving ? 0.6 : 1 }}
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                    <button onClick={() => setEditingId(null)} style={secondaryButton}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 18, fontWeight: 700 }}>
                        {b.display_name || b.name}
                      </span>
                      {b.display_name && b.display_name !== b.name && (
                        <span style={{ color: "#555", fontSize: 13 }}>({b.name})</span>
                      )}
                      {!b.active && (
                        <span style={{ color: "#ff5555", fontSize: 12, fontWeight: 700 }}>Inactive</span>
                      )}
                    </div>
                    <div style={{ color: "#666", fontSize: 13 }}>
                      {b.role} · <span style={{ color: "#555" }}>/{b.slug}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => startEdit(b)} style={secondaryButton}>
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        const next = hoursOpen === b.id ? null : b.id;
                        setHoursOpen(next);
                        if (next) loadBarberHours(b.id);
                      }}
                      style={{
                        ...secondaryButton,
                        color: hoursOpen === b.id ? "#d4af37" : "#fff",
                        borderColor: hoursOpen === b.id ? "#3a2a00" : "#2d2d2d",
                      }}
                    >
                      Hours
                    </button>
                    <button
                      onClick={() => toggleActive(b)}
                      style={{
                        ...secondaryButton,
                        color: b.active ? "#ff7070" : "#5cd600",
                        borderColor: b.active ? "#440000" : "#1e4400",
                      }}
                    >
                      {b.active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </div>
              )}

              {/* Barber hours editor */}
              {hoursOpen === b.id && !isEditing && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #1a1a1a" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#d4af37" }}>Custom Hours for {b.display_name || b.name}</div>
                      <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>Overrides shop hours. Leave default to use shop hours.</div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => clearBarberHours(b.id)} style={{ ...secondaryButton, fontSize: 12, padding: "6px 12px", color: "#ff7070", borderColor: "#440000" }}>
                        Reset to shop hours
                      </button>
                      <button
                        onClick={() => saveBarberHours(b.id)}
                        disabled={hoursSaving}
                        style={{ ...goldButton, fontSize: 12, padding: "6px 14px" }}
                      >
                        {hoursSaving ? "Saving..." : hoursSaved === b.id ? "✓ Saved" : "Save"}
                      </button>
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {(barberHours[b.id] ?? DEFAULT_SHOP_HOURS).map((h) => (
                      <div key={h.day_of_week} style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 12, alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => updateBarberHourDay(b.id, h.day_of_week, "is_closed", !h.is_closed)}
                            style={{
                              width: 34, height: 18, borderRadius: 999, border: "none",
                              background: !h.is_closed ? "#d4af37" : "#333", position: "relative", cursor: "pointer", flexShrink: 0,
                            }}
                          >
                            <span style={{
                              position: "absolute", top: 2,
                              left: !h.is_closed ? 18 : 2, width: 14, height: 14,
                              borderRadius: "50%", background: "#fff", transition: "left 0.15s",
                            }} />
                          </button>
                          <span style={{ fontSize: 13, color: h.is_closed ? "#555" : "#fff", fontWeight: 600 }}>
                            {DAY_FULL[h.day_of_week].slice(0, 3)}
                          </span>
                        </div>
                        {h.is_closed ? (
                          <span style={{ fontSize: 12, color: "#555" }}>Closed</span>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <select value={h.open_time ?? "09:00"} onChange={(e) => updateBarberHourDay(b.id, h.day_of_week, "open_time", e.target.value)} style={smallSelect}>
                              {TIME_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                            <span style={{ color: "#555", fontSize: 12 }}>–</span>
                            <select value={h.close_time ?? "18:00"} onChange={(e) => updateBarberHourDay(b.id, h.day_of_week, "close_time", e.target.value)} style={smallSelect}>
                              {TIME_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {barbers.length === 0 && !addingNew && (
        <div style={emptyBox}>No barbers yet. Add one above.</div>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  border: "1px solid #232323",
  background: "#070707",
  borderRadius: 16,
  padding: 18,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#666",
  marginBottom: 6,
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "#111",
  border: "1px solid #2a2a2a",
  color: "#fff",
  borderRadius: 8,
  fontSize: 15,
  outline: "none",
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
  padding: "10px 16px",
  borderRadius: 10,
  border: "none",
  background: "#d4af37",
  color: "#000",
  fontWeight: 800,
  cursor: "pointer",
  fontSize: 14,
  whiteSpace: "nowrap",
};

const smallSelect: React.CSSProperties = {
  padding: "6px 10px",
  background: "#111",
  border: "1px solid #2a2a2a",
  color: "#fff",
  borderRadius: 6,
  fontSize: 13,
  outline: "none",
  cursor: "pointer",
};

const secondaryButton: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "1px solid #2d2d2d",
  background: "#111",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 14,
  whiteSpace: "nowrap",
};
